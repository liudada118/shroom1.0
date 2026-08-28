const logger = require('../common/logger');
const { CommandRouter } = require('../kernel/platform/commands/commandRouter');
const {
  getChannelClientCounts,
} = require('../kernel/platform/websocket/websocketChannelService');

const commandRouter = new CommandRouter({ logger });
let legacyServer;

/**
 * 懒加载旧 server 入口。
 *
 * runtime 模块被 require 时不再立刻反向加载 server.js，避免初始化阶段形成
 * server -> runtime -> server 的隐式循环；只有真正调用兼容入口时才读取旧服务。
 *
 * @returns {object} 旧 server 导出对象。
 */
function getLegacyServer() {
  if (!legacyServer) {
    legacyServer = require('../kernel/platform/server');
  }
  return legacyServer;
}

function registerLegacyHandler(type) {
  commandRouter.register(type, (command) => {
    const server = getLegacyServer();
    if (typeof server.handleCommand === 'function') {
      return server.handleCommand(command);
    }
    logger.warn('[Runtime] legacy handler is unavailable', { type });
    return null;
  });
}

['serial', 'license-check', 'export-csv', 'db-query', 'ws-send'].forEach(registerLegacyHandler);

function openServer() {
  const server = getLegacyServer();
  if (typeof server.openServer !== 'function') {
    throw new Error('legacy server does not export openServer');
  }
  return server.openServer();
}

function shutdownServer() {
  const server = getLegacyServer();
  if (typeof server.shutdownServer === 'function') {
    return server.shutdownServer();
  }
  return Promise.resolve();
}

function getWsServer(channel = 'sit') {
  const server = getLegacyServer();
  if (typeof server.getWsServer === 'function') {
    return server.getWsServer(channel);
  }
  return null;
}

function handleCommand(command) {
  return commandRouter.dispatch(command);
}

function broadcastRealtime(data, channel = 'sit') {
  const server = getLegacyServer();
  if (typeof server.publishRealtimeFrame !== 'function') {
    logger.warn('[Runtime] realtime telemetry publisher is unavailable', { channel });
    return 0;
  }
  return server.publishRealtimeFrame(channel, data);
}

function getRuntimeStatus() {
  const server = getLegacyServer();
  const channels = typeof server.getRealtimeChannels === 'function'
    ? server.getRealtimeChannels()
    : [];
  const realtimeChannelIds = channels
    .filter((channel) => channel?.standard !== true)
    .map((channel) => channel.channelId);
  return {
    clients: getChannelClientCounts(getWsServer, realtimeChannelIds),
    channels,
    channelBus: typeof server.getChannelBusStatus === 'function'
      ? server.getChannelBusStatus()
      : {},
    subscriptions: typeof server.getWsSubscriptionStatus === 'function'
      ? server.getWsSubscriptionStatus()
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
