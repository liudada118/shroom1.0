const WebSocket = require('ws');
const { createChannelBus } = require('@shroom/backend/telemetry/channelBus.js');
const { createRealtimeTelemetryGateway } = require('../../realtime/realtimeTelemetryGateway');
const {
  createWebSocketSubscriptionManager,
} = require('./websocketSubscriptionService');
const { SHARED_WEBSOCKET_PORT } = require('./websocketChannelService');

function createWebSocketServer({ port = SHARED_WEBSOCKET_PORT } = {}) {
  return new WebSocket.Server({ port });
}

/**
 * 创建 WebSocket 运行时装配。
 *
 * 这里集中创建单个 WebSocket server、订阅管理器、ChannelBus 和传感器帧网关。
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
  webSocketServerFactory = createWebSocketServer,
  webSocketSubscriptionManagerFactory = createWebSocketSubscriptionManager,
} = {}) {
  const wsSubscriptions = webSocketSubscriptionManagerFactory({ logger });
  const channelBus = channelBusFactory();
  const realtimeTelemetryGateway = realtimeTelemetryGatewayFactory({
    channelBus,
    wsSubscriptions,
    getSensorType,
  });
  const wsServer = webSocketServerFactory();

  /**
   * 将内部帧转换成唯一 sensor.frame 后发布到 canonical channelId。
   *
   * @param {string} channel manifest 声明的任意 outputChannel。
   * @param {string | object} payload 帧数据。
   * @returns {number} 实际发送成功的客户端数量。
   */
  function publishRealtimeFrame(channel, payload, options) {
    return realtimeTelemetryGateway.publishRealtimeFrame(channel, payload, options).sent;
  }

  return {
    channelBus,
    publishRealtimeFrame,
    realtimeTelemetryGateway,
    wsServer,
    wsSubscriptions,
  };
}

module.exports = {
  createWebSocketServer,
  createWebSocketRuntime,
};
