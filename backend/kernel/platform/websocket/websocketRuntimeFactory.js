const WebSocket = require('ws');
const { createChannelBus } = require('@shroom/backend/telemetry/channelBus.js');
const { createRealtimeTelemetryGateway } = require('../../realtime/realtimeTelemetryGateway');
const {
  createWebSocketSubscriptionManager,
} = require('./websocketSubscriptionService');
const { SHARED_WEBSOCKET_PORT } = require('./websocketChannelService');

/**
 * 起唯一的那个 WebSocket Server。
 *
 * **全后端只有一个 WebSocket 端口（19999）**，所有传感器的实时帧都从这里出去，
 * 通道隔离靠订阅（`displaySystemId:sensorId`）而不是靠开多个端口。
 * 历史上是每个通道一个端口，改成单端口是因为 manifest 可以声明任意多个 sensor ——
 * 端口数跟着 manifest 变会让防火墙规则、前端连接管理和端口占用检测全部变成动态问题。
 *
 * 抽成独立函数并从 `createWebSocketRuntime` 的 `webSocketServerFactory` 注入，
 * 是为了让测试能换成假 server（真起一个端口会让测试之间互相抢 19999）。
 *
 * ⚠️ `new WebSocket.Server({port})` 会**立即监听**，端口被占时通过 server 的 `'error'`
 * 事件异步报出来，不是同步抛。所以这里 return 成功不代表端口拿到了 ——
 * 端口冲突（通常是上一次进程没退干净）的现象是前端连不上而后端日志看起来正常。
 *
 * @param {object} [options] 参数。
 * @param {number} [options.port=19999] 监听端口；改它等于改前后端契约。
 * @returns {import('ws').Server} WebSocket Server 实例。
 */
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
