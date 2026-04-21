const { EventEmitter } = require("events");

const sdkEventBus = new EventEmitter();
sdkEventBus.setMaxListeners(100);

function publishSdkEvent(type, data = {}) {
  sdkEventBus.emit("event", {
    type,
    timestamp: new Date().toISOString(),
    data,
  });
}

module.exports = {
  sdkEventBus,
  publishSdkEvent,
};
