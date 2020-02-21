const jexl = require('jexl');
const extractIdentifiers = require('./lib/extractIdentifiers.js');
const PLUGIN_ID = 'signalk-trigger';
const PLUGIN_NAME = 'Signalk trigger';
var triggers = [];
var unsubscribes = [];
module.exports = function(app) {
  var plugin = {};

  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = 'A plugin to trigger events when a condition is met';

  plugin.start = function(options, restartPlugin) {
    app.debug('Plugin started');
    plugin.options = options;

    // compile all triggers
    if (options.triggers) {
      options.triggers.forEach(trigger => {
        let expr = jexl.compile(trigger.condition);
        triggers.push({
          expression: expr,
          event: trigger.event,
          context: trigger.context,
          triggerType: trigger.triggerType,
          previous: false,
          identifiers: extractIdentifiers(expr._ast)
        });
      });
      // subscribe to all delta messages
      app.signalk.on('delta', handleDelta);
      unsubscribes.push(() => {
        app.signalk.removeListener('delta', handleDelta);
      });

      app.setProviderStatus('Running');

    } else {
      app.setProviderStatus('No triggers set');
    }
  };
  // check all triggers when a delta is received
  function handleDelta(delta) {
    let context = app.getPath('vessels');
    triggers.forEach(trigger => {
      let newValue = trigger.expression.evalSync(context[trigger.context]);
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
          if (`vessels.${trigger.context}` == delta.context) {
            paths = [];
            delta.updates.forEach(update => {
              update.values.forEach(value => {
                //TODO handle more static paths like mmsi
                paths.push(`${value.path}.value`);
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
  // returns true if l1 contains any of the elements of l2
  function includesAny(l1, l2) {
    return l1.some(e => {
      return l2.includes(e);
    });
  }

  function notify(event, type, delta) {
    app.emit(event, {
      event: event,
      type: type,
      value: delta
    });
    app.debug('event triggered: ' + type + ', ' + event);
  }

  plugin.stop = function() {
    // Here we put logic we need when the plugin stops
    app.debug('Plugin stopped');
    triggers = [];
    unsubscribes.forEach(f => f());
    app.setProviderStatus('Stopped');
  };

  plugin.schema = {
    title: PLUGIN_NAME,
    type: 'object',
    properties: {
      triggers: {
        type: 'array',
        title: 'triggers',
        items: {
          type: 'object',
          title: 'trigger',
          required: ['condition', 'context', 'event'],
          properties: {
            condition: {
              type: 'string',
              title: 'condition'
            },
            context: {
              type: 'string',
              title: 'vessel'
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
    }
  };

  return plugin;
};
