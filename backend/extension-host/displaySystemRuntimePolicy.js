const DEFAULT_LEGACY_PARSER_CHANNELS = Object.freeze([
  'sit',
  'back',
  'head',
  'sensor',
]);

function normalizeValue(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeLowerValue(value) {
  return normalizeValue(value).toLowerCase();
}

function getRuntimeMode(binding = {}) {
  return normalizeLowerValue(
    binding.runtimeMode
    || binding.metadata?.runtimeMode
    || binding.runtimeChannel?.runtimeMode
    || binding.runtimeChannel?.metadata?.runtimeMode
    || binding.sensor?.runtimeMode
  );
}

function getBindingSensorType(binding = {}) {
  return normalizeValue(
    binding.sensorType
    || binding.sensor?.type
    || binding.runtimeChannel?.sensor?.type
  );
}

function getBindingParserChannel(binding = {}) {
  return normalizeValue(
    binding.parserChannel
    || binding.runtimeChannel?.parserChannel?.role
    || binding.runtimeChannel?.parserChannel?.id
  );
}

function isParallelRuntimeMode(mode) {
  return mode === 'parallel' || mode === 'shadow';
}

function isActiveRuntimeMode(mode) {
  return mode === 'active';
}

function isDisabledRuntimeMode(mode) {
  return mode === 'disabled' || mode === 'template' || mode === 'planned';
}

/**
 * 判断 Display System binding 是否可以挂到 parser 实时数据流。
 *
 * 旧 runtime 仍然消费 sit/back/head/sensor 等通道时，manifest runtime 默认只注册不监听，
 * 避免一个 parser 同时被新旧链路重复处理。需要并行验证时，在 manifest metadata 中显式设置
 * runtimeMode: "parallel" 或 "shadow"。如果需要由 Display Systems 接管旧通道，必须显式使用
 * runtimeMode: "active"，并由启动侧传入 allowActiveDisplaySystem。
 *
 * @param {object} binding Display System runtime binding。
 * @param {object} options 调度策略选项。
 * @param {string} [options.currentSensorType] 当前运行时传感器类型。
 * @param {Function} [options.getSensorType] 当前传感器类型 getter。
 * @param {boolean} [options.allowParallelWithLegacy=false] 是否允许默认并行消费旧通道。
 * @param {boolean} [options.allowActiveDisplaySystem=false] 是否允许 active manifest 接管旧通道。
 * @param {string[]} [options.legacyParserChannels] legacy runtime 保护的 parser 通道。
 * @returns {{ allowed: boolean, reason: string | null }} 调度判断结果。
 */
function evaluateDisplaySystemDispatchPolicy(binding = {}, {
  currentSensorType,
  getSensorType,
  allowParallelWithLegacy = false,
  allowActiveDisplaySystem = false,
  legacyParserChannels = DEFAULT_LEGACY_PARSER_CHANNELS,
} = {}) {
  const runtimeMode = getRuntimeMode(binding);
  if (isDisabledRuntimeMode(runtimeMode)) {
    return { allowed: false, reason: `runtime mode ${runtimeMode} is not active` };
  }

  const expectedSensorType = getBindingSensorType(binding);
  const activeSensorType = normalizeValue(currentSensorType || getSensorType?.());
  if (expectedSensorType && activeSensorType && expectedSensorType !== activeSensorType) {
    return {
      allowed: false,
      reason: `sensor type mismatch: expected ${expectedSensorType}, current ${activeSensorType}`,
    };
  }

  const parserChannel = getBindingParserChannel(binding);
  const protectedChannels = new Set((legacyParserChannels || []).map(normalizeValue));
  if (
    parserChannel
    && protectedChannels.has(parserChannel)
    && isActiveRuntimeMode(runtimeMode)
    && !allowActiveDisplaySystem
  ) {
    return {
      allowed: false,
      reason: `active runtime for legacy parser channel ${parserChannel} is not enabled`,
    };
  }

  if (
    parserChannel
    && protectedChannels.has(parserChannel)
    && !allowParallelWithLegacy
    && !allowActiveDisplaySystem
    && !isParallelRuntimeMode(runtimeMode)
    && !isActiveRuntimeMode(runtimeMode)
  ) {
    return {
      allowed: false,
      reason: `legacy parser channel ${parserChannel} is protected`,
    };
  }

  return { allowed: true, reason: null };
}

module.exports = {
  DEFAULT_LEGACY_PARSER_CHANNELS,
  evaluateDisplaySystemDispatchPolicy,
  getBindingParserChannel,
  getBindingSensorType,
  getRuntimeMode,
  isActiveRuntimeMode,
  isParallelRuntimeMode,
};
