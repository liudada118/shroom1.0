/**
 * 按类型名精确分发的命令路由表。
 *
 * ⚠️ **本仓有两个命令路由器，不要混用也不要合并**：
 * - 本文件：`register(type, handler)` + `dispatch(command)`，**一个类型一个处理器**，
 *   靠 Map 精确命中。只服务 `backend/runtime/index.js` 那条 Electron 兼容入口
 *   （见那里的 `registerLegacyHandler`）。
 * - `controlCommandRouter.js`：`register(handler)` + `handle(message, context)`，
 *   **责任链**，每个 handler 自己用 `when()` 判断要不要接，可以多个连着处理。HTTP 与
 *   WebSocket 的控制命令走那一条。
 *
 * 两者形状不同是因为职责不同：这里要的是「这类命令交给谁」的静态表；那边要的是
 * 「一条命令可能触发多个副作用（开串口 + 记状态 + 回执）」的管道。
 *
 * 保留本类的现实理由：`runtime/index.js` 注册的那五类命令目前**全部落到「告警 + null」**
 * （旧 server 的 handleCommand 已被各专用服务取代），路由表存在的价值是让「命令没人接」
 * 这件事在日志里可见，而不是静默丢弃。
 */
class CommandRouter {
  /**
   * @param {object} [options] 参数。
   * @param {object} [options.logger] 日志器；缺省用 `console`。兜到 console 而不是抛错，
   *        是因为这条路由是 Electron 启停链路的一部分 —— 缺个 logger 不该让后端起不来。
   */
  constructor({ logger } = {}) {
    this.logger = logger || console;
    this.handlers = new Map();
  }

  /**
   * 登记一类命令的处理器。
   *
   * 参数不合法时**抛错**（与 dispatch 的「告警 + null」相反）：注册发生在启动期，写错了
   * 应该立刻炸出来；而分发发生在运行期，一条坏命令不该让后端挂掉。
   *
   * ⚠️ **同名类型会被静默覆盖**（`Map.set`）。这是刻意的 —— 允许后注册的实现替换先注册的
   * （扩展覆盖内置）。代价是重复注册没有任何提示，排查「我的 handler 没被调用」时要先
   * 确认没有第二处注册同一个 type。
   *
   * 返回 `this` 支持链式注册。
   *
   * @param {string} type 命令类型名。
   * @param {Function} handler 处理函数，签名 `(command) => *`。
   * @returns {CommandRouter} 自身（链式）。
   * @throws {Error} type 为空或 handler 不是函数。
   */
  register(type, handler) {
    if (!type || typeof handler !== 'function') {
      throw new Error('CommandRouter.register requires a command type and handler');
    }
    this.handlers.set(type, handler);
    return this;
  }

  /**
   * 查询某类命令有没有登记处理器。
   *
   * 给调用方做「能力探测」用（先问再发，而不是发完看返回值是不是 null）—— `dispatch`
   * 的 null 返回同时表示「没人接」和「接了但返回 null」，无法区分。
   *
   * @param {string} type 命令类型名。
   * @returns {boolean} 是否已登记。
   */
  has(type) {
    return this.handlers.has(type);
  }

  /**
   * 分发一条命令。
   *
   * `command.type || command.action` 两个字段名都认：`action` 是旧 WebSocket 协议的字段名，
   * 新代码用 `type`。**`type` 优先**，两个都带时以 `type` 为准。
   *
   * **两条失败路径都是「告警 + 返回 null」，不抛错。** 命令来自 Electron 主进程与旧前端，
   * 一条格式不对或没人接的命令抛出去会顺着 IPC 冒到主进程，可能把整个应用带下去。代价是
   * 调用方无法从返回值区分「没人接」（用 `has()` 先问）和「接了但返回 null」。
   *
   * `this.logger.warn?.()` 用可选调用：注入的 logger 只保证有 `info` 之类的可能性，缺
   * `warn` 时静默跳过日志也比在分发路径上抛错好。
   *
   * 处理器抛出的异常**不被捕获**，直接向上冒。这与 `controlCommandRouter.handle` 逐个
   * try/catch 的做法相反：那边一条命令要过多个 handler，一个失败不该拖垮其余；这里一个
   * 类型只有一个处理器，它失败就是这条命令失败，包装成错误结果反而掩盖问题。
   *
   * @param {{type?: string, action?: string}} [command] 命令对象。
   * @returns {*} 处理器返回值；缺类型或未注册时为 null。
   */
  dispatch(command = {}) {
    const type = command.type || command.action;
    if (!type) {
      this.logger.warn?.('[CommandRouter] command missing type/action', command);
      return null;
    }

    const handler = this.handlers.get(type);
    if (!handler) {
      this.logger.warn?.('[CommandRouter] unsupported command', { type });
      return null;
    }

    return handler(command);
  }
}

module.exports = {
  CommandRouter,
};
