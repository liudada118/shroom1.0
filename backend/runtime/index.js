const legacyServer = require('../server/server');
const logger = require('../common/logger');
const { CommandRouter } = require('./commandRouter');
const {
  broadcastToChannel,
  getChannelClientCounts,
} = require('../services/websocket/websocketChannelService');

const commandRouter = new CommandRouter({ logger });

function registerLegacyHandler(type) {
  commandRouter.register(type, (command) => {
    if (typeof legacyServer.handleCommand === 'function') {
      return legacyServer.handleCommand(command);
    }
    logger.warn('[Runtime] legacy handler is unavailable', { type });
    return null;
  });
}

['serial', 'license-check', 'export-csv', 'db-query', 'ws-send'].forEach(registerLegacyHandler);

function openServer() {
  if (typeof legacyServer.openServer !== 'function') {
    throw new Error('legacy server does not export openServer');
  }
  return legacyServer.openServer();
}

function shutdownServer() {
  if (typeof legacyServer.shutdownServer === 'function') {
    return legacyServer.shutdownServer();
  }
  return Promise.resolve();
}

function getWsServer(channel = 'sit') {
  if (typeof legacyServer.getWsServer === 'function') {
    return legacyServer.getWsServer(channel);
  }
  return null;
}

function handleCommand(command) {
  return commandRouter.dispatch(command);
}

function broadcastRealtime(data, channel = 'sit') {
  return broadcastToChannel(getWsServer, data, channel);
}

function getRuntimeStatus() {
  return {
    clients: getChannelClientCounts(getWsServer),
    channels: typeof legacyServer.getRealtimeChannels === 'function'
      ? legacyServer.getRealtimeChannels()
      : [],
    channelBus: typeof legacyServer.getChannelBusStatus === 'function'
      ? legacyServer.getChannelBusStatus()
      : {},
    subscriptions: typeof legacyServer.getWsSubscriptionStatus === 'function'
      ? legacyServer.getWsSubscriptionStatus()
      : null,
  };
}

module.exports = {
  broadcastRealtime,
  commandRouter,
  getRuntimeStatus,
  getWsServer,
  handleCommand,
  openServer,
  shutdownServer,
};
