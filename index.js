const jexl = require('jexl');
const _ = require('lodash');
const extractIdentifiers = require('./lib/extractIdentifiers.js');
const PLUGIN_ID = 'signalk-trigger';
const PLUGIN_NAME = 'Signalk trigger';
var triggers = [];
var unsubscribes = [];
var StartingUp = true;
var eventSuppressTime = 0;
var events = [];

module.exports = function(app) {
  var plugin = {};

  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = 'A plugin to trigger events when a condition is met';

  plugin.start = function(options, restartPlugin) {
    plugin.options = options;
    let startupSilence = options.startupSilence;
    eventSuppressTime = options.eventSuppressTime;
    let contextMap = createContextMap(options.context);
    app.debug('Plugin started. Startup silence time: ' + startupSilence + 's. Duplicate suppress period: ' + eventSuppressTime + 's.');
    // compile all triggers
    if (options.triggers) {
      options.triggers.forEach(trigger => {
        let expr = jexl.compile(trigger.condition);
        let identifiers = extractPaths(extractIdentifiers(expr), contextMap);
        let contexts = options.context.map(mapping => {
          return mapping.path.split('.')[0];
        });
        triggers.push({
          expression: expr,
          event: trigger.event,
          context: contexts,
          triggerType: trigger.triggerType,
          previous: false,
          identifiers: identifiers
        });
      });
      // subscribe to all delta messages
      app.signalk.on('delta', handleDelta);
      unsubscribes.push(() => {
        app.signalk.removeListener('delta', handleDelta);
      });

      app.setPluginStatus('Running');

      setTimeout(() => {
        app.debug('Startup silence of ' + startupSilence + ' seconds passed. Values should have settled. Turning events on.');
        StartingUp = false;
      }, startupSilence * 1000);

    } else {
      app.setPluginStatus('No triggers set');
    }
  };
  // check all triggers when a delta is received
  function handleDelta(delta) {
    //exclude notifications to avoid creating a lot of deltas when an event happens
    if (typeof delta.updates[0].values[0] != 'undefined') {
      // Skip updates without value
      if (delta.updates[0].values[0].path.split('.')[0] != 'notifications') {
        let context = generateContext(plugin.options.context);
        triggers.forEach(trigger => {
          let newValue = trigger.expression.evalSync(context);
          if (newValue == true && trigger.previous == false) {
            if (trigger.triggerType != 'FALLING') {
              notify(trigger.event, 'RISING', delta);
            }
          } else if (newValue == false && trigger.previous == true) {
            if (trigger.triggerType != 'RISING') {
              notify(trigger.event, 'FALLING', delta);
            }
          } else if (newValue == true) {
            if (trigger.triggerType == 'ALWAYS') {
              if (contextTest(trigger.context, delta.context)) {
                paths = [];
                delta.updates.forEach(update => {
                  update.values.forEach(value => {
                    if (value.path == '') {
                      paths = paths.concat(Object.keys(value.value));
                    } else {
                      paths.push(value.path);
                    }
                  });
                });
                if (includesAny(paths, trigger.identifiers)) {
                  notify(trigger.event, 'NO_CHANGE', delta);
                }
              }
            }
          }
          trigger.previous = newValue;
        });
      }
    }
  }

  // returns true if l1 contains any of the elements of l2
  function includesAny(l1, l2) {
    return l1.some(e => {
      return l2.includes(e);
    });
  }
  // compare list of contexts with deltacontext return true if deltaContext is matches with atleast one element of contexts
  function contextTest(contexts, deltaContext) {
    return contexts.some(context => {
      return `vessels.${context}` == deltaContext;
    });
  }

  function createContextMap(variables) {
    let res = {};
    variables.forEach(variable => {
      res[variable.name] = variable.path;
    });
    return res;
  }

  function generateContext(variables) {
    let res = {};
    let context = app.getPath('vessels');
    variables.forEach((variable) => {
      res[variable.name] = _.get(context, variable.path);
    });
    return res;
  }

  // removes .value from the end of an identifier to match the signalk path in a delta
  function extractPaths(identifiers, contextMap) {
    let paths = identifiers.map(identifier => {
      return contextMap[identifier];
    });
    return paths.map(identifier => {
      let pathElements = identifier.split('.');
      if (pathElements[pathElements.length - 1] == 'value') {
        pathElements.pop();
      }
      pathElements.shift();
      return pathElements.join('.');
    });
  }

  function notify(event, type, delta) {
    if (suppressEvent(type, event) == false) {
      app.emit(event, {
        event: event,
        type: type,
        value: delta
      });
      app.debug('event triggered: ' + type + ', ' + event);
      recordEvent(type, event);
    }
  }

  function suppressEvent (type, event) {
    if (StartingUp == true) {
      app.debug('event suppressed (StartingUp): ' + type + ', ' + event);
      return true;
    } else {
      app.debug('Events : ' + JSON.stringify(events));
      if (events.some(Event => Event.type === type && Event.event === event)) {
        if (events.some(Event => Event.type === type && Event.event === event && (Event.epoch > Date.now() - (eventSuppressTime*1000)))) {
          // Recent entry, suppress
          app.debug('event suppressed (within ' + eventSuppressTime + ' seconds): ' + type + ', ' + event );
          return true;
        } else {
          // Old entry, remove and don't suppressed
          app.debug('Events before remove: ' + JSON.stringify(events));
          events = events.filter(Event => Event.type != type || Event.event != event);
          app.debug('Events after remove: ' + JSON.stringify(events));
          return false;
        }
      } else {
        // Also no reason to suppress
        return false;
      }
    }
  }

  function recordEvent (type, event) {
    let Event = {
      'event': event,
      'type': type,
      'epoch': Date.now()
    }
    app.debug('Event: ' + JSON.stringify(Event));
    events.push(Event);
    app.debug('event recorded: ' + JSON.stringify(events));
  }

  plugin.stop = function() {
    // Here we put logic we need when the plugin stops
    app.debug('Plugin stopped');
    triggers = [];
    unsubscribes.forEach(f => f());
    app.setPluginStatus('Stopped');
  };

  plugin.schema = {
    title: PLUGIN_NAME,
    type: 'object',
    properties: {
      startupSilence: {
        type: 'number',
        title: 'Seconds to suppress events at startup to wait for values to settle',
        default: 60
      },
      eventSuppressTime: {
        type: 'number',
        title: 'Seconds to suppress duplicate events',
        default: 300
      },
      context: {
        type: 'array',
        title: 'context',
        items: {
          type: 'object',
          title: 'variable',
          properties: {
            path: {
              type: 'string',
              title: 'path'
            },
            name: {
              type: 'string',
              title: 'name'
            }
          }
        }
      },
      triggers: {
        type: 'array',
        title: 'triggers',
        items: {
          type: 'object',
          title: 'trigger',
          required: ['condition', 'event', 'triggerType'],
          properties: {
            condition: {
              type: 'string',
              title: 'condition'
            },
            event: {
              type: 'string',
              title: 'event'
            },
            triggerType: {
              type: 'string',
              title: 'trigger type',
              enum: ['RISING', 'FALLING', 'BOTH', 'ALWAYS'],
              enumNames: ['Rising edge', 'Falling edge', 'Both edges', 'for all deltas'],
              default: 'BOTH'
            }
          }
        }
      }
    }
  };

  plugin.uiSchema = {
    triggers: {
      'ui:options': {
        orderable: false
      }
    },
    context: {
      'ui:options': {
        orderable: false
      }
    }
  };

  return plugin;
};
