/**
 * 创建控制命令应用服务。
 *
 * HTTP 和 WebSocket 都通过该服务执行控制命令，入口层不再直接依赖
 * WebSocket command router。当前实现复用既有 router，后续可以继续
 * 将具体命令 handler 下沉到 application service。
 */
function createControlCommandService({ commandRouter, logger } = {}) {
  if (!commandRouter || typeof commandRouter.handle !== 'function') {
    throw new Error('commandRouter with handle(command, context) is required');
  }

  /**
   * 执行一条控制命令。
   *
   * try/catch 里**记了日志又原样 rethrow**，看着多余，其实是这一层唯一的职责：路由器
   * (`controlCommandRouter.handle`) 已经把每个 handler 的异常收成结果条目了，能冒到这里
   * 的只有**归一阶段**的抛错（`validateCommandEnvelope` 的 `CommandProtocolError`，带
   * `code`/`httpStatus`）。那类错误必须继续往上抛，HTTP 层要靠 `httpStatus` 回状态码；
   * 但它也必须留下日志，否则一条格式错的命令在后端日志里毫无痕迹。
   *
   * `command || {}` 兜底：空命令交给路由器会走「没人接」路径（`ok: false`），比在这里
   * 抛错更符合调用方预期 —— HTTP 层能把它回成一个正常的失败响应。
   *
   * @param {object} command 命令对象。
   * @param {object} [context] 调用上下文。
   * @returns {object} 路由器的执行摘要。
   * @throws {Error} 命令归一/校验失败时原样抛出（带 code 与 httpStatus）。
   */
  function execute(command, context = {}) {
    try {
      return commandRouter.handle(command || {}, context);
    } catch (error) {
      logger?.warn?.('[ControlCommandService] command failed', error.message || error);
      throw error;
    }
  }

  /**
   * HTTP 入口：补上传输标记后执行。
   *
   * 三个字段（`clientName`/`scope`/`transport`）值都是 `'http'`，冗余是有意的：handler 侧
   * 历史上用不同字段判断来源，全给齐才不用去逐个 handler 确认它读的是哪个。
   *
   * `...context` **展开在后面**，所以调用方能覆盖这三个默认值 —— 例如把 `clientName` 换成
   * 具体的客户端标识用于审计。想反过来「强制不可覆盖」就得把展开挪到前面，那会破坏现有
   * 调用方，改之前先看 controlRoutes.js。
   *
   * @param {object} command 命令对象。
   * @param {object} [context] 额外上下文，可覆盖默认标记。
   * @returns {object} 路由器的执行摘要。
   */
  function executeHttp(command, context = {}) {
    return execute(command, {
      clientName: 'http',
      scope: 'http',
      transport: 'http',
      ...context,
    });
  }

  /**
   * WebSocket 入口：**新协议命令一律拒绝**，只放旧字段命令通过。
   *
   * 刻意的传输面收口（ARCHITECTURE.md 也记着）：控制命令走 HTTP `POST /api/commands`，WebSocket 只
   * 承担实时帧、系统事件和 subscribe/unsubscribe —— 那条连接是广播用的、无请求-响应语义，而控制命令
   * 要状态码、要一一对应的回执、要按连接鉴权。旧字段命令暂时继续兼容（老前端还在用），新代码别走。
   * 拒绝时**返回结果对象而不抛错**，形状与路由器的执行摘要对齐，WebSocket 侧回执代码就不用写分支。
   *
   * ⚠️ 判据是**同时存在 `payload` 与 `requestId` 两个键**（`hasOwnProperty` 判存在不判真值），故意
   * 不用 `isCommandEnvelope`（它还要求有 `type`）—— 判宽一点，才不会让一条缺 `type` 的新协议命令漏
   * 进旧路径被误解释。
   *
   * @param {object} command 命令对象。
   * @param {object} [context] 额外上下文，可覆盖 `transport`。
   * @returns {object} 路由器的执行摘要，或形状一致的 TRANSPORT_NOT_ALLOWED 拒绝结果。
   */
  function executeWs(command, context = {}) {
    const isNewCommand = !!(
      command &&
      typeof command === 'object' &&
      Object.prototype.hasOwnProperty.call(command, 'payload') &&
      Object.prototype.hasOwnProperty.call(command, 'requestId')
    );
    if (isNewCommand) {
      return {
        handled: false,
        stop: true,
        ok: false,
        command,
        error: {
          code: 'TRANSPORT_NOT_ALLOWED',
          message: 'control commands must use HTTP POST /api/commands',
        },
      };
    }
    return execute(command, {
      transport: 'websocket',
      ...context,
    });
  }

  return {
    execute,
    executeHttp,
    executeWs,
    registerHandler: (handler) => commandRouter.register(handler),
  };
}

module.exports = {
  createControlCommandService,
};
