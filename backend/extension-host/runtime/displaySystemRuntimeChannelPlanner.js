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
 * 关键是**每个字段都给缺省值**，这份对象一路传到 frame processor，让下游不必层层判空。
 * `enabled` 由 `type !== 'none'` 推出而不让 manifest 单独声明 —— 两个字段各写一次必然出现
 * 「type 是 none 但 enabled 是 true」的自相矛盾。
 *
 * `timeoutMs` 默认 1000：算法跑在进程外，没有超时会让一路卡死的算法拖住整条实时流。
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
    packageManifest: algorithm.packageManifest || null,
    package: algorithm.package || null,
    apiVersion: Number(algorithm.apiVersion || algorithm.package?.apiVersion || 1),
    input: algorithm.input || {},
    output: algorithm.output || {},
    timeoutMs: Number(algorithm.timeoutMs || 1000),
    enabled: type !== 'none',
  };
}

/**
 * 把 manifest 的 runtimeDefinition 摊平成「一条 parser 通道 = 一份计划」的数组。
 *
 * 每条计划独立自洽（自带完整 sensor/display/processing）而不是「公共配置 + 通道差异」，
 * 因为下游全按单通道处理。代价是 `display` 在各通道重复，是有意的冗余。`status` 一律
 * `'planned'`，真状态由 registry 注册时改写。
 *
 * ⚠️ 两处「通道值优先于系统级值」是多传感器正确性所系：`matrix` 判据是
 * `channel.matrix?.total` 而不是判对象存在（空 `{}` 也是对象但不是有效尺寸），系统级
 * `displayMetadata.matrix` 只是**第一路**的尺寸，不按通道取会让后面的通道拿错行列数解帧。
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
    // 当前 UI 仍用展示系统第一路 sensor.type 作为切换值；同一系统内其它异构 sensor
    // 也必须跟随这一个激活键，而不是拿各自 type 与全局选择逐路比较。
    activationSensorType: sensorDefinition.type || channel.sensorType,
    // serialRole 是这一路传感器在系统内的标识（用于串口/parser 键），
    // outputChannel 是它推送到前端和采集存储的通道名，两者可以不同。
    serialRole: channel.channel,
    baudRate: Number(channel.baudRate || channel.protocol?.baudRate) || null,
    stored: channel.stored !== false,
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
      // sensorDefinition.id 是展示系统 ID；每路真实 sensorId 必须来自 parser channel。
      // 否则所有串口都会在诊断快照里显示成同一个展示系统名。
      id: channel.channel,
      label: channel.label || channel.channel,
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
