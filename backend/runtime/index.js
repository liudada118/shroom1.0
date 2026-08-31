/**
 * backend/runtime —— Electron 侧唯一的后端启停入口。
 *
 * 按 `backend/README.md` 的边界约定，Electron 主进程只通过本文件启停后端、
 * 只通过 `backend/common/logger.js` 出日志，这两条路径与本文件的导出契约是冻结的：
 * 扩展可以往 `backend/extensions/` 加东西，但不得反向改这里。所以下面每个导出
 * 都是「转发给 kernel/platform/server.js 并在旧实现缺失时降级」的薄壳，
 * 真正的实现全在 server 侧。
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

/**
 * 把一类命令注册到路由表，处理逻辑统一转发给旧 server 的 handleCommand。
 *
 * ⚠️ 当前 `kernel/platform/server.js` 的 `handleCommand`（该文件 1811 行）对任何
 * 命令都只打一条 `unsupported command` 警告并返回 null —— 也就是说下面注册的五类
 * 命令走到这里全都是「告警 + null」。这不是笔误：命令已经改由各自的专用服务
 * （串口编排、许可校验、CSV 导出等）直接处理，路由表留着是为了旧调用方 dispatch
 * 时有个明确的落点、而不是静默丢弃。保留这层的代价是一条警告日志，收益是
 * 「命令没人接」这件事在日志里可见。
 *
 * @param {string} type 命令类型名，与 `commandRouter.dispatch` 收到的 `command.type` 对应。
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
 * 这里是全后端唯一一处「旧实现缺失就抛」的地方，其余转发函数都走静默降级。
 * 原因是启动失败必须让 Electron 立刻看见：后端没起来还继续把窗口开出去，
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
 * 与 openServer 相反，这里缺实现时返回一个已完成的 Promise 而不是抛错 ——
 * 退出路径上抛异常会让 Electron 卡在关闭中间态，串口和数据库反而来不及释放。
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
 * ⚠️ `channel` 参数实际不影响返回值：现在全后端只有一个 WebSocket 端口（19999），
 * 所有 manifest 的 outputChannel 都映射到同一个物理服务，旧 server 的实现
 * （该文件 1793 行）直接 `void channel` 后返回单例。参数和 `'sit'` 默认值
 * 留着纯粹是为了旧调用方不用改签名 —— 别把它当成「按通道取服务」，
 * 也别据此推断存在 sit/back/head 那张固定通道表，那张表已经从线上协议里去掉了。
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
 * 注意实参顺序在这里翻了一次：本函数是 `(data, channel)`，转发给旧 server 的
 * `publishRealtimeFrame` 时是 `(channel, data)`。保持本函数的顺序是因为调用方
 * 绝大多数只传数据、走默认通道。
 *
 * 帧本身由 `kernel/realtime` 侧统一包成 `sensor.frame` schema v1 再发，
 * 这里不做任何字段加工 —— 不要在这一层往 payload 上贴 sitData/backData 之类的
 * 顶层字段，线上协议已经不认了。
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
 * 四块内容分别来自：各通道在线客户端数、通道元数据、通道总线统计、WS 订阅表。
 * 除通道元数据外的三块在旧 server 未导出对应函数时降级为空值而不报错 ——
 * 状态查询属于诊断路径，缺一块不该把整个查询打挂。
 *
 * ⚠️ 下面那句 `channel?.standard !== true` 目前是空转：通道元数据由
 * `websocketChannelService.buildRealtimeChannelMetadata` 构造，字段固定为
 * channelId/name/port/displaySystemId/sensorId/serialRole/outputChannel/
 * sensorType/transport/messageType/schemaVersion/legacy，**没有 standard**。
 * `standard: true` 只出现在 `kernel/realtime/realtimeTelemetryGateway.js`
 * 给 channelBus.publish 传的发布选项里，不会流到这份元数据上。留着不删是因为
 * 它无害，且哪天元数据真带上这个标记时语义正好；但别以为现在它过滤掉了什么。
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
