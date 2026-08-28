const WebSocket = require('ws');
const { createChannelBus } = require('@shroom/backend/telemetry/channelBus.js');
const { createRealtimeTelemetryGateway } = require('../../realtime/realtimeTelemetryGateway');
const {
  createWebSocketSubscriptionManager,
} = require('./websocketSubscriptionService');
const { CHANNELS } = require('./websocketChannelService');

function createWebSocketServers({
  sitPort = CHANNELS.sit.port,
  backPort = CHANNELS.back.port,
  headPort = CHANNELS.head.port,
} = {}) {
  return {
    sit: new WebSocket.Server({ port: sitPort }),
    back: new WebSocket.Server({ port: backPort }),
    head: new WebSocket.Server({ port: headPort }),
  };
}

/**
 * 创建 WebSocket 运行时装配。
 *
 * 这里集中创建 legacy WebSocket server、订阅管理器、ChannelBus 和实时 telemetry 网关。
 * server.js 只保留发布函数、连接处理器绑定和关闭生命周期。
 *
 * @param {object} options 创建参数。
 * @param {object} options.logger 日志对象。
 * @param {Function} options.getSensorType 当前传感器类型读取函数。
 * @returns {object} WebSocket 运行时依赖集合。
 */
function createWebSocketRuntime({
  logger,
  getSensorType,
  channelBusFactory = createChannelBus,
  realtimeTelemetryGatewayFactory = createRealtimeTelemetryGateway,
  webSocketServersFactory = createWebSocketServers,
  webSocketSubscriptionManagerFactory = createWebSocketSubscriptionManager,
} = {}) {
  const wsSubscriptions = webSocketSubscriptionManagerFactory({ logger });
  const channelBus = channelBusFactory();
  const realtimeTelemetryGateway = realtimeTelemetryGatewayFactory({
    channelBus,
    wsSubscriptions,
    getSensorType,
  });
  const wsServers = webSocketServersFactory();

  /**
   * 发布实时帧到旧 WebSocket 通道和标准 telemetry 通道。
   *
   * @param {string} channel 实时通道，通常是 sit/back/head。
   * @param {string | object} payload 帧数据。
   * @returns {number} 旧 WebSocket 通道发送数量。
   */
  function publishRealtimeFrame(channel, payload) {
    return realtimeTelemetryGateway.publishRealtimeFrame(channel, payload).legacySent;
  }

  return {
    channelBus,
    publishRealtimeFrame,
    realtimeTelemetryGateway,
    wsServers,
    wsSubscriptions,
  };
}

module.exports = {
  createWebSocketServers,
  createWebSocketRuntime,
};
