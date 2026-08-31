const DEFAULT_LEGACY_PARSER_CHANNELS = Object.freeze([
  'sit',
  'back',
  'head',
  'sensor',
]);

/**
 * 归一成去空白的字符串，null/undefined 变空串。
 *
 * 这里统一走空串而不是保留 null，是为了让下游的判断都能写成
 * `if (value)` 而不必区分「没这个字段」和「字段是空的」—— 对调度策略来说
 * 这两种情况的处理方式完全相同。
 *
 * @param {*} value 原始值。
 * @returns {string} 归一后的字符串。
 */
function normalizeValue(value) {
  return value == null ? '' : String(value).trim();
}

/**
 * 归一并转小写，用于运行模式这类枚举值比较。
 *
 * @param {*} value 原始值。
 * @returns {string} 小写归一串。
 */
function normalizeLowerValue(value) {
  return normalizeValue(value).toLowerCase();
}

/**
 * 从 binding 上取运行模式。
 *
 * ⚠️ 五个取值来源按优先级短路：`runtimeMode` → `metadata.runtimeMode` →
 * `runtimeChannel.runtimeMode` → `runtimeChannel.metadata.runtimeMode` →
 * `sensor.runtimeMode`。其中 **`metadata.runtimeMode` 是 manifest 作者可以随意
 * 填写的字段** —— manifest 校验器对 `metadata` 是整体透传、不做白名单。
 * 这条路径与下面 `evaluateDisplaySystemDispatchPolicy` 里 parallel/shadow 那道
 * 判断合起来构成一处自审批口子，详见该函数的注释。
 *
 * 多来源不是冗余设计，是迁移期产物：不同来源的 binding（旧 runtime 拼的、
 * 通道规划器生成的、manifest 直接给的）把这个字段放在不同层级上。
 *
 * @param {object} [binding={}] runtime binding。
 * @returns {string} 小写运行模式；都取不到时为空串。
 */
function getRuntimeMode(binding = {}) {
  return normalizeLowerValue(
    binding.runtimeMode
    || binding.metadata?.runtimeMode
    || binding.runtimeChannel?.runtimeMode
    || binding.runtimeChannel?.metadata?.runtimeMode
    || binding.sensor?.runtimeMode
  );
}

/**
 * 从 binding 上取期望的传感器类型（同样是多来源短路，迁移期产物）。
 *
 * @param {object} [binding={}] runtime binding。
 * @returns {string} 传感器类型；取不到为空串。
 */
function getBindingSensorType(binding = {}) {
  return normalizeValue(
    binding.sensorType
    || binding.sensor?.type
    || binding.runtimeChannel?.sensor?.type
  );
}

/**
 * 从 binding 上取 parser 通道名。
 *
 * 注意后两个来源是 `role` 优先于 `id`：同一个物理 parser 在 manifest 里有
 * 「角色」和「标识」两个名字，保护名单（sit/back/head/sensor）比的是角色。
 *
 * @param {object} [binding={}] runtime binding。
 * @returns {string} parser 通道名；取不到为空串。
 */
function getBindingParserChannel(binding = {}) {
  return normalizeValue(
    binding.parserChannel
    || binding.runtimeChannel?.parserChannel?.role
    || binding.runtimeChannel?.parserChannel?.id
  );
}

/**
 * 是否为「与旧链路并行」的运行模式。
 *
 * `parallel` 和 `shadow` 都归为一类：两者都表示新链路只旁听、不接管，
 * 区别只在上层怎么用这份旁听结果（shadow 通常只比对不出图）。
 * 对调度闸来说二者等价，所以合成一个判断。
 *
 * @param {string} mode 已小写归一的运行模式。
 * @returns {boolean} 是否并行/影子模式。
 */
function isParallelRuntimeMode(mode) {
  return mode === 'parallel' || mode === 'shadow';
}

/**
 * 是否为「接管旧通道」的运行模式。
 *
 * 这是唯一一个真正需要运营侧开关（`allowActiveDisplaySystem`）放行的模式。
 *
 * @param {string} mode 已小写归一的运行模式。
 * @returns {boolean} 是否 active。
 */
function isActiveRuntimeMode(mode) {
  return mode === 'active';
}

/**
 * 是否为「不该上实时流」的运行模式。
 *
 * 三个值语义不同但结论相同：`disabled` 是显式关掉，`template` 是给二开当模板
 * 抄的骨架，`planned` 是还没做完的占位。都不该挂到实时数据流上，所以合成一个判断。
 *
 * @param {string} mode 已小写归一的运行模式。
 * @returns {boolean} 是否应拒绝挂载。
 */
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

  // ⚠️ 这道闸有一处自审批口子，读的时候必须知道：
  //
  // 条件里含 `&& !isParallelRuntimeMode(runtimeMode)`，也就是说 manifest 只要自己
  // 声明 `runtimeMode: 'parallel'`（或 'shadow'），整个条件立刻为假、直接放行 ——
  // **绕过了 `allowParallelWithLegacy` 这个运营侧开关**。而 runtimeMode 的取值来源
  // 之一是 `metadata.runtimeMode`（见 getRuntimeMode），manifest 校验器对 metadata
  // 是整体透传不做白名单，等于 manifest 作者可以给自己批准并行挂载。
  //
  // 对比上面那道 active 闸：它写的是 `isActiveRuntimeMode(runtimeMode) &&
  // !allowActiveDisplaySystem`，声明 active 反而**触发**检查、必须有开关才过。
  // 四档模式里只有 active 真正有守门人。
  //
  // 现状不改是因为并行模式本身只旁听不接管、不会顶掉旧链路的输出，风险等级低于
  // active；但要把「谁批准的」纳入规则时，闸必须改成读一个**外部批准过的档位**
  // （或 proposedBy），而不是读 manifest 自己填的 runtimeMode —— 光在写入侧校验
  // 拦不住，绕过点在这里的调度侧。
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
