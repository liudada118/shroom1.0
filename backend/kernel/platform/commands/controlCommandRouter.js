const {
  COMMAND_ERROR_CODES,
  isCommandEnvelope,
  normalizeCommand,
  validateCommandEnvelope,
} = require('@shroom/backend/contract/commandProtocol.js');
const {
  SERIAL_ROLES,
  normalizeSerialRole,
} = require('@shroom/backend/contract/sdkApiContract.js');

// SDK 合约里冻结的四个旧角色（sit/back/head/sensor）。它们与 manifest 里任意命名的
// serialRole（armLeft、legRight…）走**两条不同的执行路径**，见 normalizeDynamicSerialCommand：
// 落在这个集合里的走 SDK 的 normalizeCommand，落不进来的走 channelPorts/channelClose。
const LEGACY_SERIAL_ROLES = new Set(Object.values(SERIAL_ROLES));

/**
 * 归一串口角色名，**但不拒绝未知角色**。
 *
 * `normalizeSerialRole` 来自 SDK 合约，只做两件事：trim + 查别名表（目前只有
 * `seat → sit`）。它对未知角色原样返回，这里再兜一层「不是字符串就用原值」——
 * 于是 `armLeft` 这类 manifest 自定义角色能安全穿过。
 *
 * **这正是本函数存在的理由**：SDK 合约刻意只认识四个旧角色（那是它的公开契约，不能因为
 * 某个应用的 manifest 就扩），而应用后端必须支持任意 serialRole。归一在外面做一层，
 * SDK 就不用改。
 *
 * 空值返回空串（而不是 undefined），让调用方统一用 `if (!role)` 判断。
 *
 * @param {*} role 原始角色名。
 * @returns {string} 归一后的角色名；空输入为 ''。
 */
function normalizeBackendSerialRole(role) {
  const rawRole = String(role || '').trim();
  if (!rawRole) return '';
  const normalizedRole = normalizeSerialRole(rawRole);
  return typeof normalizedRole === 'string' ? normalizedRole : rawRole;
}

/**
 * SDK 合约保持只认识四个旧串口角色；应用后端在它外面补一层 manifest 动态角色适配。
 * 这样无需修改 SDK，HTTP 的 serial.open/serial.close 也能承载 armLeft 等任意 serialRole。
 *
 * **返回 null 的含义是「这条命令不需要动态适配」**，调用方（normalizeRouterCommand）据此
 * 回落到 SDK 的 `normalizeCommand`。四条返回 null 的路径各有理由：
 * 1. 不是命令信封 → 旧 WebSocket 裸命令，与串口角色无关。
 * 2. 不是 `serial.open`/`serial.close` → 只有这两类命令带角色。
 * 3. 角色是旧角色**且拼写已经规范** → SDK 自己就能处理，绕一圈没有意义。
 * 4. `serial.close` 既没有动态角色又没有别名要归一 → 同上。
 *
 * 第 3、4 条那个「拼写是否已规范」的判断（`role === rawRole` / `aliasesNormalized`）容易
 * 读成多余，其实是必需的：`seat` 是旧角色的别名，归一后落进 LEGACY_SERIAL_ROLES，但
 * **SDK 的 normalizeCommand 拿到原始 `seat` 并不会自己归一**，所以必须由这里重建一条
 * payload 已换成 `sit` 的命令再交给它。
 *
 * `serial.open` 与 `serial.close` 的输出形状不同，反映的是底层能力差异：open 一次只开
 * 一路（`channelPorts` 是单键对象，因为要带路径），close 可以一次关多路
 * （`channelClose` 是数组）。close 分支还会把旧角色与动态角色**分别**处理后合并 ——
 * 旧角色那半交给 SDK 生成，动态角色那半自己拼，两者在同一条命令里共存。
 *
 * 两处 `new Set` 去重是必要的：同一个角色关两次会让串口编排器对已关闭的端口再走一遍关闭
 * 流程；`seat` 与 `sit` 同时传进来时归一后也会撞成同一个。
 *
 * @param {*} message 原始命令（可能是信封，也可能是旧裸命令）。
 * @returns {{command: object, envelope: object, legacy: boolean}|null} 适配结果；
 *          不需要适配时为 null。
 */
function normalizeDynamicSerialCommand(message) {
  if (!isCommandEnvelope(message)) return null;
  if (message.type !== 'serial.open' && message.type !== 'serial.close') return null;
  const envelope = validateCommandEnvelope(message);

  if (envelope.type === 'serial.open') {
    const rawRole = String(envelope.payload.role || '').trim();
    const role = normalizeBackendSerialRole(rawRole);
    if (!role) return null;
    if (LEGACY_SERIAL_ROLES.has(role)) {
      if (role === rawRole) return null;
      return normalizeCommand({
        ...envelope,
        payload: { ...envelope.payload, role },
      });
    }
    return {
      command: { channelPorts: { [role]: envelope.payload.path } },
      envelope,
      legacy: false,
    };
  }

  const requestedRoles = envelope.payload.roles ?? envelope.payload.role;
  if (requestedRoles == null) return null;
  const rawRoles = [...new Set(
    (Array.isArray(requestedRoles) ? requestedRoles : [requestedRoles])
      .map((role) => String(role || '').trim())
      .filter(Boolean),
  )];
  const roles = [...new Set(rawRoles.map(normalizeBackendSerialRole).filter(Boolean))];
  const dynamicRoles = roles.filter((role) => !LEGACY_SERIAL_ROLES.has(role));
  const aliasesNormalized = roles.length !== rawRoles.length || roles.some((role, index) => role !== rawRoles[index]);
  if (!dynamicRoles.length && !aliasesNormalized) return null;
  const legacyRoles = roles.filter((role) => LEGACY_SERIAL_ROLES.has(role));
  const legacyCommand = legacyRoles.length
    ? normalizeCommand({
      ...envelope,
      payload: { ...envelope.payload, roles: legacyRoles },
    }).command
    : {};
  return {
    command: {
      ...legacyCommand,
      ...(dynamicRoles.length ? { channelClose: dynamicRoles } : {}),
    },
    envelope,
    legacy: false,
  };
}

/**
 * 路由器入口的命令归一：先试动态串口角色适配，不适用就交给 SDK 的标准归一。
 *
 * 顺序不能反。SDK 的 `normalizeCommand` 对任何输入都返回一个结果（不是信封就当旧裸命令，
 * `legacy: true`），**永远不会返回假值**，所以它必须放在 `||` 的右边 —— 放左边动态适配
 * 那一支就永远走不到。
 *
 * 三种输出形态都是 `{command, envelope, legacy}`：
 * - 动态角色命令 → `legacy: false`，command 里带 `channelPorts`/`channelClose`。
 * - 标准信封 → `legacy: false`，command 是 SDK 转出的旧字段形态。
 * - 旧裸命令 → `legacy: true`，`envelope` 为 null，command 就是原对象。
 *
 * 形状统一是 `handle` 能对三种来源一视同仁的前提；`legacyProtocol` 这个标记会随上下文传给
 * 每个 handler，让需要区分的（例如要不要回 `command.ack`）自己判断。
 *
 * @param {*} message 原始命令。
 * @returns {{command: object, envelope: object|null, legacy: boolean}} 归一结果。
 */
function normalizeRouterCommand(message) {
  return normalizeDynamicSerialCommand(message) || normalizeCommand(message);
}

/**
 * 创建 HTTP/旧 WebSocket 共用的传输无关命令路由器。
 *
 * 这里不关心命令来自哪里，只负责：
 * 1. 按 handler.when 判断是否命中。
 * 2. 调用 handler.handle 执行业务。
 * 3. 支持 handler 返回 { stop: true } 中断后续处理。
 */
function createControlCommandRouter({ logger } = {}) {
  const handlers = [];

  /**
   * 注册一个命令处理器。
   *
   * **注册顺序 = 执行顺序**（用数组而不是 Map）。这对二开很关键：想在内置行为之前拦一条
   * 命令，就得在 server.js 里比内置注册更早地 register；想兜底，就注册在最后。带
   * `stop: true` 的 handler 会截断它后面的全部处理器。
   *
   * `name` 只用于日志和结果条目（缺省显示 `anonymous`），不参与去重 —— **同名可以注册
   * 多次，都会被执行**。这与 `commandRouter.js` 那个按 type 覆盖的表相反。
   *
   * 缺 `handle` 时抛错：注册在启动期，写错就该立刻炸。
   *
   * @param {{name?: string, when?: Function, handle: Function}} handler 命令处理器。
   *        `when(command, context)` 返回假即跳过；不提供 `when` 表示**每条命令都要过它**。
   * @returns {object} 原 handler，便于测试或链式使用。
   * @throws {Error} handler 没有 handle 方法。
   */
  function register(handler) {
    if (!handler || typeof handler.handle !== 'function') {
      throw new Error('command handler requires handle(message, context)');
    }
    handlers.push(handler);
    return handler;
  }

  /**
   * 处理一条命令：归一 → 逐个问 handler → 汇总结果。
   *
   * **每个 handler 单独 try/catch，一个失败不打断其余**（失败被记成一条带 `error`/`code`
   * 的结果条目）。这与 `commandRouter.dispatch` 让异常上冒的做法相反，原因是这里一条命令
   * 会触发多个副作用：串口开失败不该连带着让状态记录和回执也不执行。代价是**调用方必须
   * 检查 `ok`**，光看没抛异常不代表都成功了。
   *
   * `ok` 的定义有个容易踩的点：`results.length > 0 && 没有 error`。**一条命令谁都没接时
   * `ok` 是 false**（`handled` 也是 false），而不是「无事发生所以算成功」—— 这样 HTTP 层
   * 才能把「不支持的命令」回成失败而不是 200。
   *
   * `stop: true` 的语义是「这条命令到我为止」，它会**立刻返回**，后面的 handler 一个都不
   * 执行。用于独占型命令（例如某个扩展完全接管了 serial.open）。注意 stop 只由 handler 的
   * 返回值决定，抛错的 handler 不会 stop。
   *
   * 上下文里额外塞了三个字段供 handler 判断来源：`commandEnvelope`（标准信封，旧裸命令时
   * 为 null）、`legacyProtocol`、`originalMessage`（未归一的原始输入 —— 需要读归一时被丢掉
   * 的字段时用它）。
   *
   * 日志只记 `error.message`，不记堆栈：命令失败在这条链路上是常见的可预期情况（串口被
   * 占用、设备没插），打全堆栈会淹掉日志。
   *
   * @param {object} message 命令对象；三种形态都收（标准信封、动态角色串口命令、旧
   *        WebSocket 裸命令），由 normalizeRouterCommand 统一。
   * @param {object} [context] 调用上下文，例如 scope/transport/clientName。
   * @returns {{handled: boolean, stop: boolean, results: object[], ok: boolean,
   *   command: object|null, legacyProtocol: boolean}} 执行摘要。
   */
  function handle(message, context = {}) {
    const normalized = normalizeRouterCommand(message);
    const command = normalized.command;
    const commandContext = {
      ...context,
      commandEnvelope: normalized.envelope,
      legacyProtocol: normalized.legacy,
      originalMessage: message,
    };
    const results = [];
    for (const handler of handlers) {
      try {
        const shouldHandle = typeof handler.when === 'function'
          ? handler.when(command, commandContext)
          : true;
        if (!shouldHandle) continue;

        const result = handler.handle(command, commandContext) || {};
        results.push({
          name: handler.name || 'anonymous',
          ...result,
        });
        if (result.stop === true) {
          return {
            handled: true,
            stop: true,
            results,
            ok: !results.some((item) => item.error),
            command: normalized.envelope,
            legacyProtocol: normalized.legacy,
          };
        }
      } catch (error) {
        logger?.warn?.(`[ControlCommand] ${handler.name || 'anonymous'} failed`, error.message || error);
        results.push({
          name: handler.name || 'anonymous',
          code: error.code || COMMAND_ERROR_CODES.COMMAND_EXECUTION_FAILED,
          httpStatus: error.httpStatus,
          error: error.message || String(error),
        });
      }
    }

    return {
      handled: results.length > 0,
      stop: false,
      results,
      ok: results.length > 0 && !results.some((result) => result.error),
      command: normalized.envelope,
      legacyProtocol: normalized.legacy,
    };
  }

  return {
    handle,
    register,
  };
}

module.exports = {
  createControlCommandRouter,
  normalizeDynamicSerialCommand,
};
