const { EventEmitter } = require('events');

function createChannelBus() {
  const emitter = new EventEmitter();
  const stats = new Map();

  function publish(channelId, payload, metadata = {}) {
    const channel = String(channelId || '').trim();
    if (!channel) {
      throw new Error('channelId is required');
    }

    const now = Date.now();
    const current = stats.get(channel) || { count: 0, lastTimestamp: 0 };
    stats.set(channel, {
      count: current.count + 1,
      lastTimestamp: now,
    });

    const event = {
      channelId: channel,
      payload,
      metadata,
      timestamp: now,
    };

    emitter.emit(channel, event);
    emitter.emit('*', event);
    return event;
  }

  function subscribe(channelId, handler) {
    const channel = String(channelId || '*').trim() || '*';
    emitter.on(channel, handler);
    return () => emitter.off(channel, handler);
  }

  function getStats() {
    return [...stats.entries()].reduce((result, [channelId, value]) => {
      result[channelId] = { ...value };
      return result;
    }, {});
  }

  return {
    getStats,
    publish,
    subscribe,
  };
}

module.exports = {
  createChannelBus,
};
