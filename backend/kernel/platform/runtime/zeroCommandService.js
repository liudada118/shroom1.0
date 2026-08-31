function normalizeDisplaySystemId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// 与 manifest validator 保持同一身份规则：组件非空、trim 后稳定且不能包含
// channelId 分隔符；内部空格和 Unicode 名称仍是合法身份。
const DISPLAY_SYSTEM_ID_PATTERN = /^[^:\s](?:[^:]*[^:\s])?$/;
const CHANNEL_ID_PATTERN = /^[^:\s](?:[^:]*[^:\s])?:[^:\s](?:[^:]*[^:\s])?$/;

function createZeroCommandError(message, {
  code = 'INVALID_COMMAND',
  httpStatus = 400,
} = {}) {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = httpStatus;
  return error;
}

function normalizeChannelIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((channelId) => (typeof channelId === 'string' ? channelId.trim() : ''))
    .filter(Boolean))];
}

function isChannelInDisplaySystem(channelId, displaySystemId) {
  return !displaySystemId || channelId.startsWith(`${displaySystemId}:`);
}

function normalizeResolution(result) {
  if (Array.isArray(result)) {
    return { channelIds: normalizeChannelIds(result), skipped: [] };
  }
  if (!result || typeof result !== 'object') {
    return { channelIds: [], skipped: [] };
  }
  return {
    channelIds: normalizeChannelIds(
      result.channelIds || result.targetChannelIds || result.resolvedChannelIds,
    ),
    skipped: Array.isArray(result.skipped) ? [...result.skipped] : [],
  };
}

function normalizeStoreResult(result, targetChannelIds) {
  if (Array.isArray(result)) {
    return { affectedChannelIds: normalizeChannelIds(result), skipped: [] };
  }
  if (!result || typeof result !== 'object') {
    return { affectedChannelIds: [...targetChannelIds], skipped: [] };
  }
  return {
    affectedChannelIds: normalizeChannelIds(result.affectedChannelIds || result.affected),
    skipped: Array.isArray(result.skipped) ? [...result.skipped] : [],
  };
}

function createSkipped(channelId, reason, extra = {}) {
  return { channelId, reason, ...extra };
}

function normalizeZeroCommand(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    throw createZeroCommandError('calibration.zero payload must be an object');
  }
  const unexpected = Object.keys(command).filter((field) => (
    field !== 'enabled' && field !== 'displaySystemId' && field !== 'channelIds'
  ));
  if (unexpected.length) {
    throw createZeroCommandError(
      `calibration.zero payload contains unsupported field(s): ${unexpected.join(', ')}`,
    );
  }
  if (typeof command.enabled !== 'boolean') {
    throw createZeroCommandError('calibration.zero payload.enabled must be a boolean');
  }

  const normalized = { enabled: command.enabled };
  if (Object.prototype.hasOwnProperty.call(command, 'displaySystemId')) {
    if (
      typeof command.displaySystemId !== 'string'
      || command.displaySystemId !== command.displaySystemId.trim()
      || !DISPLAY_SYSTEM_ID_PATTERN.test(command.displaySystemId)
    ) {
      throw createZeroCommandError('calibration.zero payload.displaySystemId has an invalid format');
    }
    normalized.displaySystemId = command.displaySystemId;
  }

  if (Object.prototype.hasOwnProperty.call(command, 'channelIds')) {
    if (!Array.isArray(command.channelIds)) {
      throw createZeroCommandError('calibration.zero payload.channelIds must be an array');
    }
    if (command.channelIds.length === 0) {
      throw createZeroCommandError('calibration.zero payload.channelIds must not be empty');
    }
    const channelIds = normalizeChannelIds(command.channelIds);
    if (
      channelIds.length !== command.channelIds.length
      || channelIds.some((channelId, index) => (
        channelId !== command.channelIds[index] || !CHANNEL_ID_PATTERN.test(channelId)
      ))
    ) {
      throw createZeroCommandError('calibration.zero payload.channelIds must contain unique canonical channel IDs');
    }
    normalized.channelIds = channelIds;
  }

  return normalized;
}

/**
 * 创建按 manifest channelId 工作的零点命令服务。
 *
 * 不再维护按旧串口角色命名的固定字段。命令目标由当前展示系统的 runtime
 * 通道动态解析；显式 channelIds 始终保持精确寻址，不会退化成输出别名。
 */
function createZeroCommandService({
  zeroStateStore,
  resolveTargetChannelIds,
  getActiveDisplaySystemId,
} = {}) {
  if (!zeroStateStore || typeof zeroStateStore.capture !== 'function' || typeof zeroStateStore.clear !== 'function') {
    throw new Error('zeroStateStore with capture/clear is required');
  }
  if (typeof resolveTargetChannelIds !== 'function') {
    throw new Error('resolveTargetChannelIds is required');
  }
  if (typeof getActiveDisplaySystemId !== 'function') {
    throw new Error('getActiveDisplaySystemId is required');
  }

  function resolveTargets({ displaySystemId, channelIds, hasExplicitChannelIds, operation }) {
    const requestedChannelIds = normalizeChannelIds(channelIds);
    const requestedDisplaySystemId = normalizeDisplaySystemId(displaySystemId);
    const activeDisplaySystemId = requestedDisplaySystemId || (!hasExplicitChannelIds
      && typeof getActiveDisplaySystemId === 'function'
      ? normalizeDisplaySystemId(getActiveDisplaySystemId())
      : '');

    if (!hasExplicitChannelIds && !activeDisplaySystemId) {
      throw createZeroCommandError(
        'calibration.zero requires an active display system or explicit channelIds',
        { code: 'COMMAND_EXECUTION_FAILED', httpStatus: 409 },
      );
    }

    const scopeSkipped = [];
    const scopedRequestedChannelIds = hasExplicitChannelIds
      ? requestedChannelIds.filter((channelId) => {
        if (isChannelInDisplaySystem(channelId, activeDisplaySystemId)) return true;
        scopeSkipped.push(createSkipped(channelId, 'display-system-scope-mismatch', {
          displaySystemId: activeDisplaySystemId,
        }));
        return false;
      })
      : undefined;

    if (scopeSkipped.length) {
      throw createZeroCommandError(
        `calibration.zero channelIds are outside display system "${activeDisplaySystemId}"`,
      );
    }

    const resolution = normalizeResolution(resolveTargetChannelIds({
      displaySystemId: activeDisplaySystemId || undefined,
      channelIds: scopedRequestedChannelIds,
      operation,
    }));
    const resolvedScopeSkipped = [];
    const targetChannelIds = resolution.channelIds.filter((channelId) => {
      if (isChannelInDisplaySystem(channelId, activeDisplaySystemId)) return true;
      resolvedScopeSkipped.push(createSkipped(channelId, 'display-system-scope-mismatch', {
        displaySystemId: activeDisplaySystemId,
      }));
      return false;
    });

    if (resolvedScopeSkipped.length) {
      throw createZeroCommandError(
        'calibration.zero target resolver returned channels outside the requested display system',
        { code: 'COMMAND_EXECUTION_FAILED', httpStatus: 500 },
      );
    }

    if (targetChannelIds.length === 0) {
      const reason = resolution.skipped[0]?.reason || 'no-target-channels';
      throw createZeroCommandError(
        `calibration.zero could not resolve any target channels (${reason})`,
        { code: 'COMMAND_EXECUTION_FAILED', httpStatus: 409 },
      );
    }

    return {
      displaySystemId: activeDisplaySystemId || null,
      requestedChannelIds: hasExplicitChannelIds ? requestedChannelIds : null,
      targetChannelIds,
      skipped: [...scopeSkipped, ...resolution.skipped, ...resolvedScopeSkipped],
    };
  }

  function handle(command = {}) {
    const normalizedCommand = normalizeZeroCommand(command);
    const { enabled, displaySystemId, channelIds } = normalizedCommand;
    const hasExplicitChannelIds = Object.prototype.hasOwnProperty.call(normalizedCommand, 'channelIds');

    const operation = enabled ? 'capture' : 'clear';
    const targets = resolveTargets({
      displaySystemId,
      channelIds,
      hasExplicitChannelIds,
      operation,
    });
    const storeResult = normalizeStoreResult(
      zeroStateStore[operation](targets.targetChannelIds),
      targets.targetChannelIds,
    );
    if (storeResult.affectedChannelIds.length === 0) {
      const reason = storeResult.skipped[0]?.reason || 'no-target-state';
      throw createZeroCommandError(
        `calibration.zero did not affect any target channels (${reason})`,
        { code: 'COMMAND_EXECUTION_FAILED', httpStatus: 409 },
      );
    }
    return {
      handled: true,
      enabled,
      operation,
      ...targets,
      affectedChannelIds: storeResult.affectedChannelIds,
      affected: storeResult.affectedChannelIds.length,
      skipped: [...targets.skipped, ...storeResult.skipped],
    };
  }

  function captureZero(target = {}) {
    return handle({ ...target, enabled: true });
  }

  function clearZero(target = {}) {
    return handle({ ...target, enabled: false });
  }

  function handleResetZero(value, target = {}) {
    if (value !== true && value !== false) return false;
    return handle({ ...target, enabled: value });
  }

  return {
    captureZero,
    clearZero,
    handle,
    handleResetZero,
  };
}

module.exports = {
  createZeroCommandError,
  createZeroCommandService,
  normalizeZeroCommand,
};
