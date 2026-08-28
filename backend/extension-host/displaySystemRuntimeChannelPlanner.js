/**
 * Display Systems 实时链路计划生成器。
 *
 * 这里不打开串口、不创建 parser，只把 manifest 生成的 runtimeDefinition
 * 进一步整理成可执行计划。后续 serial manager / runtime registry 可以按
 * plan 去真正绑定串口、parser、lineOrder、pointOrder 和 algorithm。
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
