const fs = require('fs');
const {
  executeConfiguredMapping,
  loadJsonDefinition: defaultLoadJsonDefinition,
} = require('../processing/configMappingExecutor');

function loadOptionalJson(filePath, fsLike) {
  if (!filePath) return null;
  return defaultLoadJsonDefinition(filePath, fsLike);
}

function getFrameValues(frame) {
  if (Array.isArray(frame)) return frame;
  if (Array.isArray(frame?.data)) return frame.data;
  if (Array.isArray(frame?.sitData)) return frame.sitData;
  if (Array.isArray(frame?.backData)) return frame.backData;
  if (Array.isArray(frame?.headData)) return frame.headData;
  throw new Error('display system frame must be an array or contain data/sitData/backData/headData');
}

function applyNumericConfig(values, config = {}) {
  const operations = Array.isArray(config.operations) ? config.operations : [];
  const implicitOperations = [];

  if (typeof config.scale === 'number') implicitOperations.push({ type: 'scale', value: config.scale });
  if (typeof config.offset === 'number') implicitOperations.push({ type: 'offset', value: config.offset });
  if (typeof config.min === 'number' || typeof config.max === 'number') {
    implicitOperations.push({ type: 'clamp', min: config.min, max: config.max });
  }
  if (typeof config.zeroBelow === 'number') {
    implicitOperations.push({ type: 'zeroBelow', value: config.zeroBelow });
  }

  return [...implicitOperations, ...operations].reduce((nextValues, operation) => {
    if (operation.type === 'scale') {
      return nextValues.map((value) => value * Number(operation.value ?? 1));
    }
    if (operation.type === 'offset') {
      return nextValues.map((value) => value + Number(operation.value ?? 0));
    }
    if (operation.type === 'clamp') {
      const min = typeof operation.min === 'number' ? operation.min : -Infinity;
      const max = typeof operation.max === 'number' ? operation.max : Infinity;
      return nextValues.map((value) => Math.min(max, Math.max(min, value)));
    }
    if (operation.type === 'zeroBelow') {
      const threshold = Number(operation.value ?? 0);
      return nextValues.map((value) => (value < threshold ? 0 : value));
    }
    return nextValues;
  }, values);
}

function getChannelDataField(outputChannel) {
  if (outputChannel === 'back') return 'backData';
  if (outputChannel === 'head') return 'headData';
  return 'sitData';
}

/**
 * 创建 Display System 通用帧处理器。
 *
 * 处理器按 manifest 生成的 runtime channel plan 读取 JSON 配置：
 * line-order.json 决定原始值顺序，point-order.json 决定展示矩阵落点，
 * algorithm-data.json 只承载可配置的数值后处理，不再为每个传感器写死函数。
 *
 * @param {object} options 创建参数。
 * @param {object} options.runtimeChannel runtime channel plan。
 * @param {object} [options.fsLike] 文件系统适配器，测试可注入。
 * @returns {{ processFrame: Function }} 帧处理器。
 */
function createDisplaySystemFrameProcessor({
  runtimeChannel,
  fsLike = fs,
}) {
  if (!runtimeChannel) {
    throw new Error('runtimeChannel is required');
  }

  let cachedLineOrder;
  let cachedPointOrder;
  let cachedAlgorithmData;

  function getLineOrderDefinition() {
    if (cachedLineOrder !== undefined) return cachedLineOrder;
    cachedLineOrder = loadOptionalJson(runtimeChannel.processing?.lineOrder?.source, fsLike);
    return cachedLineOrder;
  }

  function getPointOrderDefinition() {
    if (cachedPointOrder !== undefined) return cachedPointOrder;
    cachedPointOrder = loadOptionalJson(runtimeChannel.processing?.pointOrder?.source, fsLike);
    return cachedPointOrder;
  }

  function getAlgorithmData() {
    if (cachedAlgorithmData !== undefined) return cachedAlgorithmData;
    cachedAlgorithmData = loadOptionalJson(runtimeChannel.processing?.algorithm?.dataFile, fsLike);
    return cachedAlgorithmData;
  }

  function processFrame(frame) {
    const values = getFrameValues(frame);
    const mapped = executeConfiguredMapping(values, {
      lineOrder: getLineOrderDefinition(),
      pointOrder: getPointOrderDefinition(),
    });
    const algorithmData = getAlgorithmData();
    const processed = runtimeChannel.processing?.algorithm?.enabled
      ? applyNumericConfig(mapped, algorithmData || {})
      : mapped;

    const outputChannel = runtimeChannel.outputChannel || runtimeChannel.serialRole;
    const channelDataField = getChannelDataField(outputChannel);
    return {
      channelId: runtimeChannel.id,
      displaySystemId: runtimeChannel.displaySystemId,
      outputChannel,
      data: processed,
      [channelDataField]: processed,
      metadata: runtimeChannel.display,
    };
  }

  return {
    processFrame,
  };
}

module.exports = {
  applyNumericConfig,
  createDisplaySystemFrameProcessor,
  getChannelDataField,
  getFrameValues,
};
