/**
 * backend/runtime —— Electron 侧唯一的后端启停入口。
 *
 * 每个导出都是「转发给 kernel/platform/server.js、旧实现缺失时降级」的薄壳，
 * 实现全在 server 侧。**导出契约是冻结的**：扩展往 `backend/extensions/` 加，
 * 不得反向改这里。
 */
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
 * 必须懒加载：模块顶层 require 会形成 server → runtime → server 的初始化循环。
 *
 * @returns {object} 旧 server 导出对象。
 */
function getLegacyServer() {
  if (!legacyServer) {
    legacyServer = require('../kernel/platform/server');
  }
  return legacyServer;
}

/**
 * 把一类命令注册到路由表，处理逻辑统一转发给旧 server 的 handleCommand。
 *
 * ⚠️ **下面注册的五类命令目前全是空转**：`server.handleCommand`（server.js:1811）
 * 对任何命令只打一条 `unsupported command` 警告返回 null。命令已改由各自专用服务
 * 处理，路由表留着是为了「没人接」在日志里可见，不是静默丢弃。
 *
 * @param {string} type 命令类型名，对应 `commandRouter.dispatch` 的 `command.type`。
 * @returns {void}
 */
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

/**
 * 启动后端（Electron 主进程的唯一后端启动入口）。
 *
 * 本文件唯一一处「缺实现就抛」的转发（其余都静默降级）：后端没起来还把窗口开出去，
 * 用户看到的是一个永远连不上的界面，比直接崩更难排查。
 *
 * @returns {*} 旧 server 的 openServer 返回值。
 * @throws {Error} 旧 server 未导出 openServer 时抛出。
 */
function openServer() {
  const server = getLegacyServer();
  if (typeof server.openServer !== 'function') {
    throw new Error('legacy server does not export openServer');
  }
  return server.openServer();
}

/**
 * 关停后端（Electron 退出前调用）。
 *
 * 与 `openServer` 相反，缺实现时返回 resolved Promise 而不抛 —— 退出路径上抛异常会让
 * Electron 卡在关闭中间态，串口和数据库反而来不及释放。
 *
 * @returns {Promise<*>} 旧 server 的关停 Promise；无该导出时为 resolved Promise。
 */
function shutdownServer() {
  const server = getLegacyServer();
  if (typeof server.shutdownServer === 'function') {
    return server.shutdownServer();
  }
  return Promise.resolve();
}

/**
 * 取 WebSocket Server 实例。
 *
 * ⚠️ **`channel` 不影响返回值**：全后端只有一个 WebSocket 端口 19999，通道隔离靠订阅，
 * 旧实现（server.js:1793）直接 `void channel` 返回单例。参数留着只为旧调用方不改签名 ——
 * 别当成「按通道取服务」，也别据此推断存在 sit/back/head 那张固定通道表。
 *
 * @param {string} [channel='sit'] 业务通道名，当前被旧实现忽略。
 * @returns {import('ws').Server|null} 共享 WebSocket Server；旧 server 无该导出时为 null。
 */
function getWsServer(channel = 'sit') {
  const server = getLegacyServer();
  if (typeof server.getWsServer === 'function') {
    return server.getWsServer(channel);
  }
  return null;
}

/**
 * 派发一条命令到命令路由表。
 *
 * @param {{type: string}} command 命令对象，`type` 决定落到哪个已注册处理器。
 * @returns {*} 处理器返回值；未注册的类型由 CommandRouter 决定行为。
 */
function handleCommand(command) {
  return commandRouter.dispatch(command);
}

/**
 * 广播一帧实时数据。
 *
 * ⚠️ **实参顺序在这里翻了一次**：本函数 `(data, channel)`，转发时是
 * `publishRealtimeFrame(channel, data)`。本函数这个顺序是因为调用方多数只传数据。
 *
 * 不要在这一层往 payload 贴 sitData/backData 之类顶层字段 —— 帧由 `kernel/realtime`
 * 统一包成 `sensor.frame` schema v1，线上协议不认别的。
 *
 * @param {*} data 帧数据。
 * @param {string} [channel='sit'] 目标通道名。
 * @returns {number} 实际投递到的订阅者数量；发布器不可用时为 0。
 */
function broadcastRealtime(data, channel = 'sit') {
  const server = getLegacyServer();
  if (typeof server.publishRealtimeFrame !== 'function') {
    logger.warn('[Runtime] realtime telemetry publisher is unavailable', { channel });
    return 0;
  }
  return server.publishRealtimeFrame(channel, data);
}

/**
 * 汇总一份运行时状态快照，供上层做诊断展示。
 *
 * 四块：各通道在线客户端数、通道元数据、通道总线统计、WS 订阅表。除元数据外三块缺
 * 导出时降级为空值 —— 诊断路径缺一块不该把整个查询打挂。
 *
 * ⚠️ `channel?.standard !== true` 目前**空转**：`buildRealtimeChannelMetadata` 造出的
 * 元数据里没有 `standard` 字段（`standard: true` 只出现在
 * `realtimeTelemetryGateway.js` 给 `channelBus.publish` 的发布选项里）。留着无害，
 * 但别以为它过滤掉了什么。
 *
 * @returns {{clients: Record<string, number>, channels: object[], channelBus: object, subscriptions: object|null}}
 *          运行时状态快照。
 */
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
