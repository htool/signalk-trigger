const jexl = require("jexl");
const extractIdentifiers = require('./lib/extractIdentifiers.js');
const PLUGIN_ID = 'signalk-trigger';
const PLUGIN_NAME = 'Signalk trigger';
var expressions = [];
var unsubscribes = [];
module.exports = function(app) {
  var plugin = {};

  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = 'A plugin to trigger events when a condition is met';

  plugin.start = function(options, restartPlugin) {
    app.debug('Plugin started');
    plugin.options = options;

    // compile all expressions
    if (options.triggers) {
      options.triggers.forEach(trigger => {
        if (trigger.condition && trigger.event && trigger.context) {
          let expr = jexl.compile(trigger.condition);
          expressions.push({
            expression: expr,
            event: trigger.event,
            context: trigger.context,
            triggerType: trigger.triggerType,
            previous: false,
            identifiers: extractIdentifiers(expr._ast)
          });
        } else {
          app.setProviderError("incomplete trigger configuration encountered");
        }
      });
      // subscribe to all delta messages
      app.signalk.on('delta', handleDelta);
      unsubscribes.push(() => {
        app.signalk.removeListener('delta', handleDelta);
      });

      app.setProviderStatus("Running");

    } else {
      app.setProviderStatus("No triggers set");
    }
  };
  // check all triggers when a delta is received
  function handleDelta(delta) {
    let context = app.getPath('vessels');
    expressions.forEach(expression => {
      let newValue = expression.expression.evalSync(context[expression.context]);
      if (newValue == true && expression.previous == false) {
        if (expression.triggerType != 'FALLING') {
          notify(expression.event, 'RISING', delta);
        }
      } else if (newValue == false && expression.previous == true) {
        if (expression.triggerType != 'RISING') {
          notify(expression.event, 'FALLING', delta);
        }
      } else if (newValue == true) {
        if (expression.triggerType == 'ALWAYS') {
          // TODO only notify if delta updates a value in the condition
          if (`vessels.${expression.context}` == delta.context) {
            paths = [];
            delta.updates.forEach(update => {
              update.values.forEach(value => {
                //TODO handle more static paths like mmsi
                paths.push(`${value.path}.value`);
              });
            });
            if (includesAny(paths, expression.identifiers)) {
              notify(expression.event, 'NO_CHANGE', delta);
            }
          }
        }
      }
      expression.previous = newValue;
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
    app.debug("event triggered: " + type + ", " + event);
  }

  plugin.stop = function() {
    // Here we put logic we need when the plugin stops
    app.debug('Plugin stopped');
    expressions = [];
    unsubscribes.forEach(f => f());
    app.setProviderStatus("Stopped");
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
              title: "condition"
            },
            context: {
              type: 'string',
              title: "vessel"
            },
            event: {
              type: 'string',
              title: "event"
            },
            triggerType: {
              type: 'string',
              title: 'trigger type',
              enum: ['RISING', 'FALLING', 'BOTH', "ALWAYS"],
              enumNames: ['Rising edge', 'Falling edge', 'Both edges', "for all deltas"],
              default: 'BOTH'
            }
          }
        }
      }
    }
  };

  return plugin;
};
