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

const LEGACY_SERIAL_ROLES = new Set(Object.values(SERIAL_ROLES));

function normalizeBackendSerialRole(role) {
  const rawRole = String(role || '').trim();
  if (!rawRole) return '';
  const normalizedRole = normalizeSerialRole(rawRole);
  return typeof normalizedRole === 'string' ? normalizedRole : rawRole;
}

/**
 * SDK 合约保持只认识四个旧串口角色；应用后端在它外面补一层 manifest 动态角色适配。
 * 这样无需修改 SDK，HTTP 的 serial.open/serial.close 也能承载 armLeft 等任意 serialRole。
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
   * @param {{name?: string, when?: Function, handle: Function}} handler 命令处理器。
   * @returns {object} 原 handler，便于测试或链式使用。
   */
  function register(handler) {
    if (!handler || typeof handler.handle !== 'function') {
      throw new Error('command handler requires handle(message, context)');
    }
    handlers.push(handler);
    return handler;
  }

  /**
   * 处理一条命令。
   *
   * @param {object} message 标准化后的命令对象，兼容旧 WebSocket 字段。
   * @param {object} context 调用上下文，例如 scope/transport/clientName。
   * @returns {{handled: boolean, stop: boolean, results: object[]}} 执行摘要。
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
