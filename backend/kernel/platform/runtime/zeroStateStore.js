// 四个可扣零的处理阶段。顺序即数据流顺序（解码 → 归一 → 处理 → 映射），
// 前端「零点基准取哪一级」的选项直接对应这四个名字。
//
// ⚠️ `mapped` 是给兼容链路（legacy 帧处理）用的。新的 display system 帧处理器
// **刻意不写 mapped**（见 displaySystemFrameProcessorFactory 里那处行内注释）——
// 它的 normalized 就是映射结果，两边都记会在兼容链路上重复扣零。所以这一列在新链路
// 上恒为空数组，不是漏了。
const ZERO_STAGES = Object.freeze([
  'decoded',
  'normalized',
  'processed',
  'mapped',
]);

const ZERO_STAGE_SET = new Set(ZERO_STAGES);

/**
 * 拷一份帧数据；非数组统一变成空数组。
 *
 * 兜成 `[]` 而不是 null/undefined，是本模块的一条基础约定：`entry.sources[stage]`
 * **恒为数组**，于是 `capture`、`listChannelIds` 里的 `.length > 0` 都不用先判类型。
 *
 * 浅拷贝就够：帧是纯数值数组。拷贝本身是必须的 —— 存进来的帧和发出去的帧都可能被
 * 调用方继续改（实时链路上那份数组马上要被下一级处理），共享引用会让基准悄悄变化。
 *
 * @param {*} frame 待拷贝的帧。
 * @returns {number[]} 新数组；非数组输入返回 []。
 */
function cloneFrame(frame) {
  return Array.isArray(frame) ? [...frame] : [];
}

/**
 * 建一份四阶段全空的状态对象。
 *
 * 四个键**一次建齐**（而不是按需添加），这样任何 `state[stage]` 取值都不会是
 * undefined —— 全模块因此不需要一处 `?.length` 或 `|| []`。
 *
 * @returns {Record<string, number[]>} 四阶段状态。
 */
function createStageState() {
  return ZERO_STAGES.reduce((state, stage) => {
    state[stage] = [];
    return state;
  }, {});
}

/**
 * 深拷一份四阶段状态。
 *
 * 只按 `ZERO_STAGES` 枚举拷，输入里多出来的键会被丢掉 —— 这是有意的形状收口：状态
 * 对象来自本模块内部也来自 `capture`（拿 sources 当 baselines），固定按四阶段重建能
 * 保证两者形状永远一致。
 *
 * @param {object} [state] 源状态。
 * @returns {Record<string, number[]>} 新的四阶段状态。
 */
function cloneStageState(state = {}) {
  return ZERO_STAGES.reduce((snapshot, stage) => {
    snapshot[stage] = cloneFrame(state[stage]);
    return snapshot;
  }, {});
}

/**
 * 解析 canonical channelId，形状不对返回 null。
 *
 * 返回 null 而不抛错，是因为它同时被当**谓词**用（`getEntry`、`capture`、`clear` 里
 * 都是先判再继续，把不合法 id 记进 skipped 而不是让整批操作失败）。需要抛错的路径走
 * `requireChannelId`。
 *
 * 拒绝首尾空白（`channelId !== channelId.trim()`，两段也各查一次）是为了让 Map 的键
 * 唯一：`"a:b"` 和 `" a:b"` 若都能进来就是两条互不相干的零点记录，而用户看到的是同
 * 一个通道。
 *
 * @param {*} channelId 待解析的 channelId。
 * @returns {{channelId: string, displaySystemId: string, sensorId: string}|null} 解析结果。
 */
function parseChannelId(channelId) {
  if (typeof channelId !== 'string' || channelId !== channelId.trim()) return null;
  const parts = channelId.split(':');
  // canonical channelId 是严格的 `displaySystemId:sensorId` 两段式。
  // 如果组件本身允许冒号，单凭 channelId 就无法唯一还原身份。
  if (
    parts.length !== 2
    || !parts[0]
    || !parts[1]
    || parts.some((part) => part !== part.trim())
  ) return null;
  return {
    channelId,
    displaySystemId: parts[0],
    sensorId: parts[1],
  };
}

/**
 * 判断对象自身是否有某个键。
 *
 * 用 `Object.prototype.hasOwnProperty.call` 而不是 `object.hasOwnProperty(key)`：
 * identity 是从 HTTP 请求体 / JSON 里来的，键名可以是 `hasOwnProperty` 本身，直接调
 * 会炸。
 *
 * 用「有没有这个键」而不是「值真不真」判断，是 resolveChannelIdentity 的关键：
 * `{sensorId: undefined}` 表示调用方**声称**要指定身份但给了空值，那是错误，必须报；
 * 而键完全不存在才是「没提供身份，按 channelId 推」。两者不能混。
 *
 * @param {object} object 目标对象。
 * @param {string} key 键名。
 * @returns {boolean} 是否为自身属性。
 */
function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * 求一路通道的身份：channelId 与显式 identity 必须相互印证。
 *
 * 三层检查对应三种错法：显式 `channelId` 与参数不符（调用方自己矛盾）；displaySystemId / sensorId
 * 为空或含 `:`（含冒号会让拼出的 channelId 无法唯一还原）；拼起来与 channelId 不等。抛 TypeError
 * 而不是返回错误对象 —— 调用方全是本仓内部代码，这类不一致是编码错误，该在测试阶段就炸出来。
 *
 * ⚠️ **意义是「校验」不是「补齐」**：旧实现按第一个冒号切开 channelId 并静默重写身份，于是调用方
 * 传错身份时毫无提示、零点记到另一路通道上 —— 现象是「给 A 归零，B 的画面变了」。
 *
 * @param {string} channelId canonical channelId。
 * @param {object} [identity] 可选的显式身份。
 * @returns {{channelId: string, displaySystemId: string, sensorId: string}} 校验后的身份。
 * @throws {TypeError} channelId 不合法，或显式身份与之矛盾。
 */
function resolveChannelIdentity(channelId, identity = {}) {
  const parsed = requireChannelId(channelId);
  const input = identity && typeof identity === 'object' ? identity : {};
  const hasExplicitIdentity = hasOwn(input, 'displaySystemId') || hasOwn(input, 'sensorId');

  if (hasOwn(input, 'channelId') && input.channelId !== channelId) {
    throw new TypeError('zero state identity channelId must match channelId');
  }

  if (!hasExplicitIdentity) return parsed;

  const displaySystemId = typeof input.displaySystemId === 'string'
    ? input.displaySystemId.trim()
    : '';
  const sensorId = typeof input.sensorId === 'string' ? input.sensorId.trim() : '';
  if (
    !displaySystemId
    || !sensorId
    || displaySystemId.includes(':')
    || sensorId.includes(':')
  ) {
    throw new TypeError(
      'zero state identity requires non-empty displaySystemId and sensorId without colons',
    );
  }
  if (`${displaySystemId}:${sensorId}` !== channelId) {
    throw new TypeError('zero state identity must match channelId');
  }
  return {
    channelId,
    displaySystemId,
    sensorId,
  };
}

/**
 * parseChannelId 的抛错版本。
 *
 * 写路径（`updateSources`、`apply`）用它，批量操作（`capture`、`clear`）不用 ——
 * 后者要把不合法 id 记进 skipped 继续处理下一个，见 createOperationResult。
 *
 * 定义在 resolveChannelIdentity 之后但被它调用，靠函数声明提升，不是笔误。
 *
 * @param {*} channelId 待校验的 channelId。
 * @returns {{channelId: string, displaySystemId: string, sensorId: string}} 解析结果。
 * @throws {TypeError} channelId 不是严格的两段式。
 */
function requireChannelId(channelId) {
  const parsed = parseChannelId(channelId);
  if (!parsed) {
    throw new TypeError('zero state requires a complete channelId');
  }
  return parsed;
}

/**
 * 归一阶段名，并拒绝未知阶段。
 *
 * `'raw'` → `'decoded'` 是历史别名：早期只有「原始」和「处理后」两级，后来细分成四级，
 * `raw` 这个名字还留在旧命令和旧前端里。
 *
 * 未知阶段**抛错**而不是落到某个默认值：默认到 decoded 会让「前端传了个拼错的阶段名」
 * 表现为「归零基准取错了一级」，画面差一点但看不出错在哪。
 *
 * @param {string} stage 阶段名。
 * @returns {string} 四阶段之一。
 * @throws {TypeError} 阶段名不在 ZERO_STAGES 里。
 */
function normalizeStage(stage) {
  const normalized = stage === 'raw' ? 'decoded' : stage;
  if (!ZERO_STAGE_SET.has(normalized)) {
    throw new TypeError(`unsupported zero state stage: ${String(stage)}`);
  }
  return normalized;
}

/**
 * 组装存进仓库的 identity。
 *
 * `...input` 先展开、三个身份字段后覆盖，顺序是刻意的：调用方可以附带任意额外字段
 * （sensorType、label 之类，快照和状态接口会原样带出去给前端显示），但**三个身份字段
 * 一律以校验过的 channel 为准，覆盖不掉**。
 *
 * `outputChannel` 兜底成 `sensorId` 而不是留空：它是展示别名，缺失时用 sensorId 当
 * 别名是最不会出错的选择（display system 的 outputChannel 本身也是这么兜的）。
 *
 * @param {{channelId: string, displaySystemId: string, sensorId: string}} channel 校验过的身份。
 * @param {object} [identity] 调用方附带的字段。
 * @returns {object} 合并后的 identity。
 */
function normalizeIdentity(channel, identity = {}) {
  const input = identity && typeof identity === 'object' ? identity : {};
  const outputChannel = typeof input.outputChannel === 'string'
    && input.outputChannel.trim()
    ? input.outputChannel.trim()
    : channel.sensorId;
  return {
    ...input,
    channelId: channel.channelId,
    displaySystemId: channel.displaySystemId,
    sensorId: channel.sensorId,
    outputChannel,
  };
}

/**
 * 把「要操作哪些通道」的入参归一成去重后的数组。
 *
 * 收单个值也收数组，是因为归零命令既有「给这一路归零」也有「给这个展示系统的全部通道
 * 归零」两种用法，不想在两处各写一遍包装。
 *
 * **去重是必须的**：重复 id 会让 `affectedChannelIds` 出现两次同一个通道，前端据此
 * 提示「已对 N 路归零」时数字就错了；`capture` 也会对同一条 entry 连做两次（第二次是
 * 拿刚写进去的 baselines 当 sources，结果不对）。
 *
 * 保序（用 Set 记录已见而不是 `[...new Set()]` 之外再排序）是为了让 skipped 里的报错
 * 顺序和用户传进来的顺序一致，便于对账。
 *
 * ⚠️ 这里**不校验 id 合法性**，只去重 —— 合法性交给各调用方按自己的策略处理
 * （批量操作记 skipped，写路径直接抛）。
 *
 * @param {string|string[]|null|undefined} channelIds 单个 id、id 数组，或空。
 * @returns {*[]} 去重保序后的候选列表。
 */
function normalizeRequestedChannelIds(channelIds) {
  const candidates = Array.isArray(channelIds)
    ? channelIds
    : (channelIds === undefined || channelIds === null ? [] : [channelIds]);
  const seen = new Set();
  return candidates.filter((channelId) => {
    if (seen.has(channelId)) return false;
    seen.add(channelId);
    return true;
  });
}

/**
 * 建一个批量操作的空结果。
 *
 * 「成功的 + 被跳过的（带原因）」这个双列表形状是零点功能唯一的可观测面。用户报
 * 「我按了归零但没反应」时，答案就在 `skipped` 的 reason 里，三种原因各对应一类现象：
 * - `invalid-channel-id` —— 前端传的 id 形状不对（多半是拼 channelId 时漏了展示系统）。
 * - `unknown-channel` —— 这一路从未收到过帧，仓库里没有它（串口没开或没订阅）。
 * - `no-source-data` —— 收到过帧但当前四个阶段全空。
 *
 * 批量操作**不因为个别失败而整体失败**，正是为了让这份清单能一次收齐。
 *
 * @returns {{affectedChannelIds: string[], skipped: Array<{channelId: *, reason: string}>}} 空结果。
 */
function createOperationResult() {
  return {
    affectedChannelIds: [],
    skipped: [],
  };
}

/**
 * 创建按 canonical channelId 隔离的零点状态仓库。
 *
 * 仓库只认识完整的 `displaySystemId:sensorId`，不会从 legacy 角色推断通道。
 * 每个通道分别保存最新 source 与已捕获 baseline，复用 sensorId 的展示系统
 * 也不会因此共享零点。
 */
function createZeroStateStore() {
  const channels = new Map();

  /**
   * 取一条通道记录；id 不合法或不存在都返回 null。
   *
   * 先过 `parseChannelId` 再查 Map，是为了让「id 形状不对」和「这一路没数据」在读接口
   * 上表现一致（都是 null）。读接口不区分这两种错法 —— 需要区分的是 capture/clear，
   * 它们各自判过再走。
   *
   * @param {*} channelId canonical channelId。
   * @returns {object|null} 内部记录（**不是拷贝**，仅供本闭包内使用）。
   */
  function getEntry(channelId) {
    return parseChannelId(channelId) ? channels.get(channelId) || null : null;
  }

  /**
   * 把一条内部记录拷成对外快照。
   *
   * 三层全部拷开（identity 浅拷、两组四阶段各自拷数组），这是仓库的封装底线：所有对外
   * 接口都只返回快照，调用方拿到的东西改了也影响不到零点基准。零点是「用户按了一次
   * 归零」的持久结果，被某个读取方顺手改掉会是极难定位的问题。
   *
   * @param {object|null} entry 内部记录。
   * @returns {object|null} 快照；entry 为空时返回 null。
   */
  function snapshotEntry(entry) {
    if (!entry) return null;
    return {
      identity: { ...entry.identity },
      sources: cloneStageState(entry.sources),
      baselines: cloneStageState(entry.baselines),
    };
  }

  /**
   * 记录某一路通道当前帧的四个阶段快照（帧处理器每帧调一次）。
   *
   * 这是热路径上唯一的写入口，也是通道记录被**惰性创建**的地方 —— 仓库不预先知道有
   * 哪些通道，谁来过帧就有谁。这解释了 capture 的 `unknown-channel`：那一路从来没
   * 收到过帧。
   *
   * identity 采用「合并后重新归一」而不是「只在首次写入时设」：sensorType、label 之类
   * 的元数据可能在链路跑起来之后才补全（例如解析器晚一点才认出传感器类型），后到的
   * 信息要能补上；而三个身份字段每次都被 normalizeIdentity 强制回校验值，补不坏。
   *
   * @param {string} channelId canonical channelId。
   * @param {object} [stages] 本帧各阶段数据（decoded/normalized/processed/mapped，
   *        `raw` 是 decoded 的别名）。
   * @param {object} [identity] 身份与附加元数据。
   * @returns {object} 写入后的快照。
   * @throws {TypeError} channelId 不合法或与显式身份矛盾。
   */
  function updateSources(channelId, stages = {}, identity = {}) {
    // 显式 identity 存在时必须与 canonical channelId 相互校验，
    // 不再用“第一个冒号”静默重写 displaySystemId / sensorId。
    const channel = resolveChannelIdentity(channelId, identity);
    const current = channels.get(channelId);
    const entry = current || {
      identity: normalizeIdentity(channel, identity),
      sources: createStageState(),
      baselines: createStageState(),
    };

    entry.identity = normalizeIdentity(channel, {
      ...entry.identity,
      ...(identity && typeof identity === 'object' ? identity : {}),
    });

    const input = stages && typeof stages === 'object' ? stages : {};
    for (const stage of ZERO_STAGES) {
      const value = stage === 'decoded' && !Array.isArray(input.decoded)
        ? input.raw
        : input[stage];
      // source 是同一物理帧的原子快照。当前帧没有某个阶段时必须清空，
      // 否则下一次 capture 会把旧帧的 mapped 与新帧的 processed 拼在一起。
      entry.sources[stage] = Array.isArray(value) ? cloneFrame(value) : [];
    }

    channels.set(channelId, entry);
    return snapshotEntry(entry);
  }

  /**
   * 读某一路的最新四阶段 source 快照。
   *
   * 未知通道返回 **null**（而不是四个空数组）：调用方要能区分「这一路没来过帧」和
   * 「来过帧但当前阶段是空的」，前者是链路问题，后者是数据问题。
   *
   * @param {*} channelId canonical channelId。
   * @returns {Record<string, number[]>|null} 快照；未知通道为 null。
   */
  function getSources(channelId) {
    const entry = getEntry(channelId);
    return entry ? cloneStageState(entry.sources) : null;
  }

  /**
   * 读某一路已捕获的四阶段零点基准。
   *
   * 返回值语义同 getSources：未知通道为 null。判断「这一路有没有归过零」要看四个阶段
   * 是不是都空，而不是看返回值是不是 null。
   *
   * @param {*} channelId canonical channelId。
   * @returns {Record<string, number[]>|null} 基准快照；未知通道为 null。
   */
  function getBaselines(channelId) {
    const entry = getEntry(channelId);
    return entry ? cloneStageState(entry.baselines) : null;
  }

  /**
   * 读某一路某一阶段的零点基准。
   *
   * 与 getBaselines 不同，未知通道返回 **`[]` 而不是 null** —— 这个签名是给「拿来就
   * 逐点相减」的调用方用的，恒返回数组能省掉它们各自的判空。想区分「没这一路」的场景
   * 请用 getBaselines。
   *
   * @param {*} channelId canonical channelId。
   * @param {string} stage 阶段名（接受 `raw` 别名）。
   * @returns {number[]} 基准数组；未捕获或未知通道为 []。
   * @throws {TypeError} 阶段名未知。
   */
  function getBaseline(channelId, stage) {
    const normalizedStage = normalizeStage(stage);
    const entry = getEntry(channelId);
    return entry ? cloneFrame(entry.baselines[normalizedStage]) : [];
  }

  /**
   * 捕获零点：把这些通道当前的 sources 定为新的 baselines（用户按「归零」时走这里）。
   *
   * 要求四阶段里**至少有一个非空**才算捕获成功，否则记 `no-source-data`。这条判断是
   * 为了挡住「串口刚断、画面还停在最后一帧」时按归零 —— 那时 sources 已被清空，捕获
   * 一份全空基准等于把归零悄悄取消了，用户会以为归零失效。
   *
   * 四个阶段**整组替换**（`cloneStageState(entry.sources)`）而不是逐阶段合并：sources
   * 是同一物理帧的原子快照，逐阶段合并会把上一帧的 mapped 和这一帧的 processed 拼成
   * 一份不存在的「帧」，两级之间的差值就不再有物理意义。
   *
   * @param {string|string[]} channelIds 目标通道。
   * @returns {{affectedChannelIds: string[], skipped: Array<{channelId: *, reason: string}>}} 结果。
   */
  function capture(channelIds) {
    const result = createOperationResult();
    for (const channelId of normalizeRequestedChannelIds(channelIds)) {
      if (!parseChannelId(channelId)) {
        result.skipped.push({ channelId, reason: 'invalid-channel-id' });
        continue;
      }
      const entry = channels.get(channelId);
      if (!entry) {
        result.skipped.push({ channelId, reason: 'unknown-channel' });
        continue;
      }

      const captured = ZERO_STAGES.some((stage) => entry.sources[stage].length > 0);

      if (captured) {
        // 四阶段一起替换：当前帧缺少的阶段明确变为空，不能保留另一帧的旧基准。
        entry.baselines = cloneStageState(entry.sources);
        result.affectedChannelIds.push(channelId);
      } else {
        result.skipped.push({ channelId, reason: 'no-source-data' });
      }
    }
    return result;
  }

  /**
   * 清除零点基准（取消归零），但**保留通道记录和 sources**。
   *
   * 只把 baselines 换成全空，不删 Map 里的 entry：删掉会让紧接着的 capture 报
   * `unknown-channel`（要等下一帧到来才恢复），而用户的操作序列「归零 → 取消 → 再归零」
   * 是完全正常的。
   *
   * 未知通道记 skipped 而不是当成「已经没有基准了、算成功」：前端要能区分「取消成功」
   * 和「这一路压根不在」。
   *
   * @param {string|string[]} channelIds 目标通道。
   * @returns {{affectedChannelIds: string[], skipped: Array<{channelId: *, reason: string}>}} 结果。
   */
  function clear(channelIds) {
    const result = createOperationResult();
    for (const channelId of normalizeRequestedChannelIds(channelIds)) {
      if (!parseChannelId(channelId)) {
        result.skipped.push({ channelId, reason: 'invalid-channel-id' });
        continue;
      }
      const entry = channels.get(channelId);
      if (!entry) {
        result.skipped.push({ channelId, reason: 'unknown-channel' });
        continue;
      }
      entry.baselines = createStageState();
      result.affectedChannelIds.push(channelId);
    }
    return result;
  }

  /**
   * 列出仓库里的通道 id，可按展示系统过滤、可只要「有数据」的。
   *
   * `withSourcesOnly` 存在的场景是「给整个展示系统归零」：只对确实在出数据的那几路
   * 捕获，否则那些声明了但没插线的通道会被记一堆 `no-source-data`，把真正的失败埋掉。
   *
   * `displaySystemId === undefined` 才表示不过滤 —— 传 `null` 会被当成一个要精确匹配的
   * 值（匹配不上任何东西）。这一点在拼查询参数时容易踩到。
   *
   * 末尾 `.sort()` 是为了输出稳定：这份列表会进 HTTP 响应和测试断言，Map 的插入顺序
   * 取决于哪一路先来帧，即串口枚举顺序，跑两次可能不一样。
   *
   * @param {object} [options] 过滤条件。
   * @param {string} [options.displaySystemId] 只要这个展示系统的通道。
   * @param {boolean} [options.withSourcesOnly] 只要四阶段中至少一个非空的通道。
   * @returns {string[]} 排序后的 channelId 列表。
   */
  function listChannelIds({ displaySystemId, withSourcesOnly = false } = {}) {
    return Array.from(channels.entries())
      .filter(([, entry]) => (
        displaySystemId === undefined || entry.identity.displaySystemId === displaySystemId
      ))
      .filter(([, entry]) => (
        !withSourcesOnly
        || ZERO_STAGES.some((stage) => entry.sources[stage].length > 0)
      ))
      .map(([channelId]) => channelId)
      .sort();
  }

  /**
   * 导出快照：给了 channelId 就出那一路，没给就出全部（按 id 为键的字典）。
   *
   * 两种返回形状由参数**存在性**决定（`channelId !== undefined`），不是由真值决定 ——
   * 所以 `snapshot(null)` 是「查这一路」（结果 null），不是「查全部」。
   *
   * 这是零点子系统的诊断出口，运行状态接口和测试都从这里取。
   *
   * @param {string} [channelId] 指定通道；省略则导出全部。
   * @returns {object|null|Record<string, object>} 单路快照，或按 id 的快照字典。
   */
  function snapshot(channelId) {
    if (channelId !== undefined) return snapshotEntry(getEntry(channelId));
    return listChannelIds().reduce((state, id) => {
      state[id] = snapshotEntry(channels.get(id));
      return state;
    }, {});
  }

  /**
   * 对一帧做扣零：逐点减去基准并下限截到 0。
   *
   * 热路径上每帧每路调一次。**长度不等（含基准为空）就原样返回** —— 换传感器、改点位表都会让长度
   * 变，拿旧基准去减会整片错位，比不扣零糟得多（帧处理器那边还会再查一次，是刻意的双层保护）。
   * 非有限值（NaN/Infinity）返回原值而非 0，坏点要在画面上仍表现为坏点。先 `cloneFrame` 再 map，
   * 不改调用方的数组。`requireChannelId` 用抛错版：走到这一步 channelId 一定是链路自己拼的。
   *
   * ⚠️ `Math.max(0, ...)` 截负让**扣零不可逆** —— 想看真实值取 `rawData`，不能拿 `data` 加回基准。
   * 截负本身是必需的：归零后压力小于基准是常态（人离床、手抬起），负值在热力图和压力总和上没有
   * 物理意义，还会让 `nonZeroCount` 之类指标失真。
   *
   * @param {string} channelId canonical channelId。
   * @param {string} stage 阶段名（接受 `raw` 别名）。
   * @param {*} frame 待扣零的帧。
   * @returns {number[]} 扣零后的新数组；非数组输入返回 []，无可用基准时返回原帧拷贝。
   * @throws {TypeError} channelId 不合法或阶段名未知。
   */
  function apply(channelId, stage, frame) {
    requireChannelId(channelId);
    const normalizedStage = normalizeStage(stage);
    if (!Array.isArray(frame)) return [];
    const input = cloneFrame(frame);
    const baseline = channels.get(channelId)?.baselines[normalizedStage];
    if (!Array.isArray(baseline) || baseline.length !== input.length || baseline.length === 0) {
      return input;
    }
    return input.map((value, index) => {
      const numericValue = Number(value);
      const numericBaseline = Number(baseline[index]);
      if (!Number.isFinite(numericValue) || !Number.isFinite(numericBaseline)) return value;
      return Math.max(0, numericValue - numericBaseline);
    });
  }

  return {
    updateSources,
    getSources,
    getBaselines,
    getBaseline,
    capture,
    clear,
    listChannelIds,
    snapshot,
    apply,
  };
}

module.exports = {
  ZERO_STAGES,
  createZeroStateStore,
};
