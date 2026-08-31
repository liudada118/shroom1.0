/**
 * 把展示系统 id 归一成字符串；非字符串一律变空串。
 *
 * 恒返回字符串（不返回 null/undefined）是本模块的一条约定：下游全部用「空串 = 不限定
 * 展示系统」表达无作用域，见 isChannelInDisplaySystem。
 *
 * @param {*} value 待归一的值。
 * @returns {string} trim 后的 id；非字符串为 ''。
 */
function normalizeDisplaySystemId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// 与 manifest validator 保持同一身份规则：组件非空、trim 后稳定且不能包含
// channelId 分隔符；内部空格和 Unicode 名称仍是合法身份。
const DISPLAY_SYSTEM_ID_PATTERN = /^[^:\s](?:[^:]*[^:\s])?$/;
const CHANNEL_ID_PATTERN = /^[^:\s](?:[^:]*[^:\s])?:[^:\s](?:[^:]*[^:\s])?$/;

/**
 * 造一个带 code 与 httpStatus 的零点命令错误。
 *
 * 把 HTTP 状态码挂在错误对象上，是为了让 HTTP 层不需要维护一张「错误消息 → 状态码」
 * 的对照表 —— 语义只在这里定义一次。本模块用到三档，区分是刻意的：
 * - **400 `INVALID_COMMAND`**（默认）：请求本身写错了，改请求就能好。
 * - **409 `COMMAND_EXECUTION_FAILED`**：请求合法但当前状态下做不了（没有活动展示
 *   系统、目标解析不出通道、通道没有数据）。前端应提示用户而不是报 bug。
 * - **500 `COMMAND_EXECUTION_FAILED`**：本仓内部代码违约（见 resolveTargets 里对
 *   解析器返回值的越界检查）。这一档不该出现，出现了是要修代码的。
 *
 * @param {string} message 错误消息。
 * @param {{code?: string, httpStatus?: number}} [options] 错误分类。
 * @returns {Error} 带 code/httpStatus 的错误（**返回而不抛**，由调用方决定何时抛）。
 */
function createZeroCommandError(message, {
  code = 'INVALID_COMMAND',
  httpStatus = 400,
} = {}) {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = httpStatus;
  return error;
}

/**
 * 把一组 channelId 归一成 trim 过、去重、无空值的数组。
 *
 * 这个函数有**两种截然不同的用法**，看清楚再改：
 * - 在 `normalizeZeroCommand` 里它是**探针**：归一结果与原数组逐项比对，不一致就报错。
 *   也就是说用户请求里的重复项和带空白的项**不会被修好，而是被拒**（fail-closed —— 请求
 *   写错了就该改请求，静默修正会让前端一直带着 bug 跑）。
 * - 在其他地方（解析器返回值、仓库返回值）它是**清洗器**：那些是内部数据，容错处理。
 *
 * @param {*} value 待归一的值。
 * @returns {string[]} 去重保序的非空 id 数组；非数组输入返回 []。
 */
function normalizeChannelIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((channelId) => (typeof channelId === 'string' ? channelId.trim() : ''))
    .filter(Boolean))];
}

/**
 * 判断一路通道是否属于某个展示系统。
 *
 * **空 displaySystemId 恒为 true** —— 表达「不限定作用域」。这不是漏判：显式指定
 * channelIds 且没有活动展示系统时就是无作用域模式。
 *
 * 用前缀比较（而不是切分再比较）在这里是安全的：`DISPLAY_SYSTEM_ID_PATTERN` 与
 * `CHANNEL_ID_PATTERN` 都禁止 id 内含 `:`，所以 `"a:"` 这个前缀不可能歧义地匹配到
 * 别的展示系统。**这条安全性依赖那两个正则**，放宽正则前要先回来看这里。
 *
 * @param {string} channelId canonical channelId。
 * @param {string} displaySystemId 展示系统 id；空串表示不限定。
 * @returns {boolean} 是否在作用域内。
 */
function isChannelInDisplaySystem(channelId, displaySystemId) {
  return !displaySystemId || channelId.startsWith(`${displaySystemId}:`);
}

/**
 * 归一注入的 `resolveTargetChannelIds` 的返回值。
 *
 * 兼容三种键名（`channelIds` / `targetChannelIds` / `resolvedChannelIds`）和「直接返回
 * 数组」的写法，是因为解析器是**注入**的 —— 它由装配层提供，历史上换过形状，而这里
 * 不该因为一个键名改动就整条命令失效。
 *
 * 无法识别的返回值退化成 `{channelIds: [], skipped: []}`，也就是**没有目标**。这与
 * normalizeStoreResult 的兜底方向刻意相反，理由见那边。空目标最终会被 resolveTargets
 * 判成 409，不会静默扩大作用域。
 *
 * @param {*} result 解析器返回值。
 * @returns {{channelIds: string[], skipped: object[]}} 归一结果。
 */
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

/**
 * 归一零点仓库 `capture`/`clear` 的返回值。
 *
 * ⚠️ **兜底方向与 normalizeResolution 相反，这是有意的。** 仓库返回不可识别的值（旧版
 * 仓库返回 undefined）时，这里假定「全部目标都成功了」（`[...targetChannelIds]`），
 * 而解析器返回不可识别值时假定「没有目标」。
 *
 * 理由是两边的失败代价不对称：
 * - 目标解析猜多了 = **给不该归零的通道归零**，是会改用户数据的错。所以宁可判 409。
 * - 仓库结果猜少了 = 明明成功了却报 409「没有影响任何通道」，用户会重复按归零，反而
 *   掩盖了真实状态。所以宁可信任它成功。
 *
 * @param {*} result 仓库返回值。
 * @param {string[]} targetChannelIds 本次的目标通道（用于兜底）。
 * @returns {{affectedChannelIds: string[], skipped: object[]}} 归一结果。
 */
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

/**
 * 造一条 skipped 记录。
 *
 * 形状与零点仓库的 skipped 保持一致（`{channelId, reason, ...}`），这样 handle 返回的
 * skipped 列表里，来自作用域检查的和来自仓库的可以直接拼在一起给前端，不需要区分来源。
 *
 * ⚠️ `...extra` 展开在后面，所以 extra 里同名的键**会覆盖** channelId / reason。
 * 当前调用点只传 `displaySystemId`，没问题；新增字段时别用这两个名字。
 *
 * @param {*} channelId 通道 id。
 * @param {string} reason 跳过原因（供前端和排查用的稳定标识）。
 * @param {object} [extra] 附加字段。
 * @returns {object} skipped 记录。
 */
function createSkipped(channelId, reason, extra = {}) {
  return { channelId, reason, ...extra };
}

/**
 * 严格校验并归一 `calibration.zero` 命令载荷 —— **fail-closed，一处不合就拒**。
 *
 * 零点会改用户看到的所有数据，而且改动是持久的（重启前一直生效），所以这里刻意不做
 * 任何宽容处理。四条严格规则各挡一类真实事故：
 *
 * 1. **拒绝未知字段。** 前端把 `channelIds` 拼成 `channelId`（少个 s）时，宽容的实现
 *    会忽略它、退回「给整个活动展示系统归零」—— 用户想给一路归零，结果全归了。
 * 2. **`enabled` 必须是真布尔**，不是真值判断。`enabled: "false"` 这个字符串在真值判断
 *    下为真，会把「取消归零」执行成「归零」，方向完全相反。
 * 3. **`channelIds` 存在但为空数组直接拒**。它表达不了任何意图，而按「空就忽略」处理
 *    又会退化成全展示系统归零（同第 1 条的事故）。
 * 4. **channelIds 必须已经是 canonical 形式**：归一后的数组要与原数组逐项相等，且每项
 *    匹配 `CHANNEL_ID_PATTERN`。带空白的、重复的都判错而不是修好 —— 静默修正会让前端
 *    一直带着拼错的 id 跑，直到某天两个 id 归一后撞在一起。
 *
 * `hasOwnProperty` 判存在而非判真值：`displaySystemId`/`channelIds` 的「没传」和
 * 「传了个空的」要有不同的处理（前者按活动展示系统，后者报错）。
 *
 * @param {*} command 原始命令载荷。
 * @returns {{enabled: boolean, displaySystemId?: string, channelIds?: string[]}} 归一后的命令。
 * @throws {Error} 任一条不满足；错误带 code `INVALID_COMMAND` 与 httpStatus 400。
 */
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

  /**
   * 求这条命令真正要作用的通道列表，并把作用域越界全部判成错误。
   *
   * 作用域怎么定（这是本函数最容易读错的一段）：
   * - 请求里带了 displaySystemId → 用它。
   * - 没带、**且没有显式 channelIds** → 用当前活动展示系统。
   * - 没带、**但有显式 channelIds** → 作用域为空串，即**不限定**。显式寻址就是精确
   *   寻址，不该被当前正在看哪个展示系统影响（否则同一条命令在不同界面下打到不同通道）。
   * - 既没有显式 channelIds 又没有活动展示系统 → 409。宁可什么都不做，也不能默认「全部」。
   *
   * **两次作用域检查，状态码刻意不同**：
   * - 用户传进来的 channelIds 越界 → 400，是请求错。
   * - 注入的解析器**返回了**作用域外的通道 → 500，是本仓内部违约。这条检查本质是断言，
   *   它防的是「解析器某次改动后开始跨展示系统返回通道」这类回归 —— 那种 bug 的现象是
   *   给 A 归零时 B 也被归零，极难从现象定位，所以在这里挡死。
   *
   * 越界时**整条命令失败**而不是过滤掉越界项继续做（`scopeSkipped` 收集了记录却仍然
   * 抛错）：部分执行的归零是最糟的状态 —— 用户看到「成功」，但只有一半通道生效。
   *
   * @param {object} options 参数。
   * @param {string} [options.displaySystemId] 请求指定的展示系统。
   * @param {string[]} [options.channelIds] 请求指定的通道。
   * @param {boolean} options.hasExplicitChannelIds 请求里是否**存在** channelIds 字段。
   * @param {'capture'|'clear'} options.operation 本次操作（透传给解析器，便于它区分）。
   * @returns {{displaySystemId: string|null, requestedChannelIds: string[]|null,
   *   targetChannelIds: string[], skipped: object[]}} 目标解析结果。
   * @throws {Error} 无作用域（409）、越界（400/500）、解析不出任何目标（409）。
   */
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

  /**
   * 执行一条 `calibration.zero` 命令：校验 → 解析目标 → 调仓库 → 汇总结果。
   *
   * `enabled` 到操作的映射是全模块唯一一处：true = capture（记下当前值作基准），
   * false = clear（清除基准）。两者都走同一条目标解析和错误路径，所以「归零」和
   * 「取消归零」的行为对称性是结构保证的，不靠两处代码同步。
   *
   * **影响 0 路时抛 409 而不是返回一个 affected=0 的成功结果。** 归零是用户按了按钮
   * 的动作，「成功但什么都没变」在界面上和成功无法区分，用户会以为已经归零了。第一条
   * skipped 的 reason 被拼进错误消息，这样 HTTP 响应本身就带着「为什么没生效」
   * （`unknown-channel` = 这一路没来过帧，`no-source-data` = 来过但当前无数据）。
   *
   * 返回体里 `affectedChannelIds` 与 `affected`（计数）同时给，是前端两种用法：列出
   * 具体通道、显示「已对 N 路归零」。
   *
   * @param {object} [command] 原始命令载荷。
   * @returns {object} 执行结果（handled/enabled/operation/目标信息/affected/skipped）。
   * @throws {Error} 载荷不合法（400）、无法解析目标或未影响任何通道（409）、解析器越界（500）。
   */
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

  /**
   * 归零（记基准）的便捷入口。
   *
   * `enabled: true` 展开在 `...target` **之后**，所以 target 里就算带了 `enabled` 也
   * 覆盖不掉 —— 这个函数的名字就是它的语义，不允许被参数反转。
   *
   * 注意 target 仍然要过 normalizeZeroCommand 的严格校验，所以带未知字段一样会被拒。
   *
   * @param {{displaySystemId?: string, channelIds?: string[]}} [target] 目标范围。
   * @returns {object} 同 handle。
   */
  function captureZero(target = {}) {
    return handle({ ...target, enabled: true });
  }

  /**
   * 取消归零（清基准）的便捷入口。展开顺序的理由同 captureZero。
   *
   * @param {{displaySystemId?: string, channelIds?: string[]}} [target] 目标范围。
   * @returns {object} 同 handle。
   */
  function clearZero(target = {}) {
    return handle({ ...target, enabled: false });
  }

  /**
   * 旧命令通道的适配入口：值是布尔就当零点命令处理，否则**返回 false 表示「不是我的」**。
   *
   * 返回 false 而不是抛错，是旧命令分发链的约定 —— 分发器依次问每个处理器「这条是不是
   * 你的」，返回 false 就继续问下一个。在这里抛错会让一条本该由别人处理的命令直接失败。
   *
   * 严格判 `=== true || === false` 而不是判类型或真值：与 normalizeZeroCommand 第 2 条
   * 同源，`"true"` 这类字符串不能被当成布尔，否则方向可能反。
   *
   * @param {*} value 命令值，只有真布尔才被接受。
   * @param {{displaySystemId?: string, channelIds?: string[]}} [target] 目标范围。
   * @returns {object|false} 执行结果；非布尔值返回 false（未处理）。
   */
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
