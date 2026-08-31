/**
 * 按类型名精确分发的命令路由表。
 *
 * 用法：`new CommandRouter({logger})` → `register(type, handler)` 登记 → `dispatch(command)` 分发，
 * `has(type)` 做能力探测。目前只服务 `backend/runtime/index.js` 那条 Electron 兼容入口。
 *
 * ⚠️ **本仓有两个命令路由器，不要混用也不要合并**：本文件是「一个类型一个处理器」的静态表
 * （Map 精确命中）；`controlCommandRouter.js` 是**责任链**（每个 handler 用 `when()` 自判，可多个
 * 连着处理），HTTP 与 WebSocket 的控制命令走那一条。形状不同是因为一条控制命令常要触发多个副作用。
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
   * `type` 与 `action` 两个字段名都认（`action` 是旧 WebSocket 协议的写法），**`type` 优先**。
   * 处理器自己抛出的异常不捕获、直接上冒 —— 一个类型只有一个处理器，它失败就是这条命令失败。
   *
   * ⚠️ **两条失败路径（缺类型 / 没人接）都是「告警 + 返回 null」而不抛错**：命令来自 Electron
   * 主进程与旧前端，抛出去会顺着 IPC 冒到主进程、可能把整个应用带下去。代价是返回值无法区分
   * 「没人接」和「接了但返回 null」—— 要区分就先用 `has()` 问。
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
