/**
 * Display Systems 实时链路计划生成器。
 *
 * 这里不打开串口、不创建 parser，只把 manifest 生成的 runtimeDefinition
 * 进一步整理成可执行计划。后续 serial manager / runtime registry 可以按
 * plan 去真正绑定串口、parser、lineOrder、pointOrder 和 algorithm。
 */

/**
 * 把 manifest 里的算法声明补全成固定形状的算法绑定。
 *
 * 关键是**每个字段都给缺省值**：这份对象会一路传到 frame processor，让下游写
 * `binding.input.xxx` 而不必层层判空。`type` 缺省 `'none'`，`enabled` 直接由
 * `type !== 'none'` 推出而不是让 manifest 单独声明 —— 两个字段各写一次必然会出现
 * 「type 是 none 但 enabled 是 true」的自相矛盾状态，这里从源头消掉。
 *
 * `timeoutMs` 默认 1000：算法通道（Python 等）跑在进程外，没有超时会让一路卡死的
 * 算法把整条实时流拖住。改小要确认最慢的算法能在新值内返回。
 *
 * @param {object} [algorithm={}] manifest 里的算法声明。
 * @returns {{type: string, entry: string|null, dataFile: string|null, input: object,
 *            output: object, timeoutMs: number, enabled: boolean}} 归一后的算法绑定。
 */
function normalizeAlgorithmBinding(algorithm = {}) {
  const type = algorithm.type || 'none';
  return {
    type,
    entry: algorithm.entry || null,
    dataFile: algorithm.dataFile || null,
    input: algorithm.input || {},
    output: algorithm.output || {},
    timeoutMs: Number(algorithm.timeoutMs || 1000),
    enabled: type !== 'none',
  };
}

/**
 * 把 manifest 的 runtimeDefinition 摊平成「一条 parser 通道 = 一份计划」的数组。
 *
 * 输出是**一条一条独立自洽的计划**，而不是「一份公共配置 + 各通道差异」：因为
 * 下游（runtime registry、binder、dispatcher）都是按单通道处理的，让每条计划自带
 * 完整的 sensor / display / processing，下游就不用回头去查它属于哪个系统。代价是
 * 多传感器系统里 `display` 那块会在各通道间重复，这是有意的冗余。
 *
 * 两处「通道自己的值优先于系统级值」值得注意（也是多传感器系统的正确性所系）：
 * - `matrix`：`channel.matrix?.total ? channel.matrix : displayMetadata.matrix`。
 *   系统级 `displayMetadata.matrix` 只是**第一路**的尺寸，多路不同尺寸时若不按通道
 *   取，后面的通道会拿着错误的行列数去解帧。判据用 `.total` 而不是判对象存在 ——
 *   空的 `{}` 也是对象，但不构成有效尺寸。
 * - `serialRole` 取 `channel.channel`，`outputChannel` 缺省回落到它。前者是物理/
 *   parser 键，后者只是给前端和采集存储看的展示别名，二者可以不同。
 *
 * `status` 一律为 `'planned'`：这里只是计划，真正的状态由 registry 注册时改写。
 *
 * @param {{sensorDefinition?: object, displayMetadata?: object, parserChannels?: object[]}}
 *        runtimeDefinition manifest 归一后的运行时定义。
 * @returns {object[]} 通道计划数组；没有 parserChannels 时为空数组。
 */
function buildRuntimeChannelPlan(runtimeDefinition) {
  const sensorDefinition = runtimeDefinition?.sensorDefinition || {};
  const displayMetadata = runtimeDefinition?.displayMetadata || {};
  const parserChannels = Array.isArray(runtimeDefinition?.parserChannels)
    ? runtimeDefinition.parserChannels
    : [];

  return parserChannels.map((channel) => ({
    id: channel.id,
    displaySystemId: channel.displaySystemId,
    // serialRole 是这一路传感器在系统内的标识（用于串口/parser 键），
    // outputChannel 是它推送到前端和采集存储的通道名，两者可以不同。
    serialRole: channel.channel,
    outputChannel: channel.outputChannel || channel.channel,
    label: channel.label || channel.channel,
    parserChannel: {
      id: channel.id,
      role: channel.channel,
      sensorType: channel.sensorType,
      matrix: channel.matrix,
      protocol: channel.protocol || null,
    },
    protocol: channel.protocol || null,
    processing: {
      lineOrder: {
        source: channel.lineOrderFile,
        type: 'file',
      },
      pointOrder: {
        source: channel.pointOrderFile,
        type: 'file',
      },
      algorithm: normalizeAlgorithmBinding(channel.algorithm),
    },
    display: {
      metadataId: displayMetadata.id,
      defaultView: displayMetadata.defaultView,
      // 通道自己的矩阵优先：多传感器系统里 displayMetadata.matrix 只是第一路的尺寸。
      matrix: channel.matrix?.total ? channel.matrix : displayMetadata.matrix,
      matrixTransform: displayMetadata.matrixTransform || { type: 'none', factor: 1, method: 'none' },
      layout: displayMetadata.layout,
      views: displayMetadata.views || [],
      widgets: displayMetadata.widgets || [],
      controls: displayMetadata.controls || {},
      renderers: displayMetadata.renderers || [],
      visualizationAlgorithms: displayMetadata.visualizationAlgorithms || [],
      profiles: displayMetadata.profiles || [],
      defaultProfile: displayMetadata.defaultProfile || null,
    },
    metadata: { ...(displayMetadata.metadata || {}) },
    runtimeMode: displayMetadata.metadata?.runtimeMode || null,
    sensor: {
      id: sensorDefinition.id,
      type: channel.sensorType || sensorDefinition.type,
      matrix: channel.matrix?.total ? channel.matrix : sensorDefinition.matrix,
    },
    status: 'planned',
  }));
}

/**
 * 把通道计划挂回 runtimeDefinition，返回**新对象**而不改原值。
 *
 * 不就地修改是因为 runtimeDefinition 来自 manifest 加载结果，可能被多处持有；
 * 就地加字段会让「manifest 原样」和「已规划」两种状态混在同一个对象上，之后无法
 * 判断某处拿到的是哪一份。
 *
 * 多存一个 `runtimeChannelCount` 是给诊断/日志用的：调用方常常只想知道「规划出几条」，
 * 不必为此遍历数组，也让日志里这个数与数组本身不会因中途过滤而不一致。
 *
 * @param {object} runtimeDefinition manifest 归一后的运行时定义。
 * @returns {object} 带 `runtimeChannels` 与 `runtimeChannelCount` 的新定义。
 */
function attachRuntimeChannelPlan(runtimeDefinition) {
  const runtimeChannels = buildRuntimeChannelPlan(runtimeDefinition);
  return {
    ...runtimeDefinition,
    runtimeChannels,
    runtimeChannelCount: runtimeChannels.length,
  };
}

module.exports = {
  attachRuntimeChannelPlan,
  buildRuntimeChannelPlan,
};
