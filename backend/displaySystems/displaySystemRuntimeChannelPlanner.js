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
    serialRole: channel.channel,
    parserChannel: {
      id: channel.id,
      role: channel.channel,
      sensorType: channel.sensorType,
      matrix: channel.matrix,
    },
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
      matrix: displayMetadata.matrix || channel.matrix,
    },
    metadata: { ...(displayMetadata.metadata || {}) },
    runtimeMode: displayMetadata.metadata?.runtimeMode || null,
    sensor: {
      id: sensorDefinition.id,
      type: sensorDefinition.type,
      matrix: sensorDefinition.matrix || channel.matrix,
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
