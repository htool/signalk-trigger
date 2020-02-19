const jexl = require("jexl");
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
          expressions.push({
            expression: jexl.compile(trigger.condition),
            event: trigger.event,
            context: trigger.context
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
      if (expression.expression.evalSync(context[expression.context])) {
        app.emit(expression.event, delta);
        console.log("event triggered", expression.event);
      }
    });
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
            }
          }
        }
      }
    }
  };

  return plugin;
};
