const fs = require('fs');
const {
  executeConfiguredMapping,
  loadJsonDefinition: defaultLoadJsonDefinition,
} = require('../processing/configMappingExecutor');
const { decodeProtocolValues, validateFrame } = require('./displaySystemProtocol');
const {
  createJavaScriptAlgorithmRunner,
  createPythonAlgorithmRunner,
} = require('./displaySystemAlgorithmRunner');

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

/**
 * 解析实时帧里承载数据的字段名。
 *
 * sit/back/head/default 沿用旧的三个字段名，legacy 前端依赖它们。
 * 其余通道用 `${通道名}Data`，避免多个传感器在同一个 sitData 字段上互相覆盖。
 *
 * @param {string} outputChannel 输出通道名。
 * @returns {string} 字段名。
 */
function getChannelDataField(outputChannel) {
  if (outputChannel === 'back') return 'backData';
  if (outputChannel === 'head') return 'headData';
  if (outputChannel === 'sit' || outputChannel === 'default' || !outputChannel) return 'sitData';
  return `${outputChannel}Data`;
}

function buildPressureMetrics(values) {
  const numeric = values.map(Number).filter(Number.isFinite);
  const totalPressure = numeric.reduce((sum, value) => sum + value, 0);
  return {
    totalPressure,
    maxPressure: numeric.length ? Math.max(...numeric) : 0,
    averagePressure: numeric.length ? totalPressure / numeric.length : 0,
    nonZeroCount: numeric.filter((value) => value > 0).length,
  };
}

function calculateConfiguredMetric(values, definition = {}) {
  const numeric = values.map(Number).filter(Number.isFinite);
  const operation = definition.operation || 'sum';
  const threshold = Number(definition.threshold || 0);
  let result = 0;

  if (operation === 'average') {
    result = numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : 0;
  } else if (operation === 'max') {
    result = numeric.length ? Math.max(...numeric) : 0;
  } else if (operation === 'min') {
    result = numeric.length ? Math.min(...numeric) : 0;
  } else if (operation === 'activeCount') {
    result = numeric.filter((value) => value > threshold).length;
  } else if (operation === 'activeRatio') {
    result = numeric.length
      ? numeric.filter((value) => value > threshold).length / numeric.length
      : 0;
  } else {
    result = numeric.reduce((sum, value) => sum + value, 0);
  }

  return result * Number(definition.scale ?? 1) + Number(definition.offset ?? 0);
}

function calculateConfiguredMetrics(values, definitions = []) {
  return Object.fromEntries(
    (Array.isArray(definitions) ? definitions : [])
      .filter((definition) => definition?.id && definition.operation !== 'external')
      .map((definition) => [definition.id, calculateConfiguredMetric(values, definition)]),
  );
}

function sanitizeAlgorithmMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return {};
  return Object.fromEntries(Object.entries(metrics).filter(([key, value]) => (
    /^[A-Za-z][A-Za-z0-9._-]*$/.test(key)
    && (
      (typeof value === 'number' && Number.isFinite(value))
      || typeof value === 'string'
      || typeof value === 'boolean'
    )
  )));
}

function normalizeAlgorithmResult(result, fallbackValues) {
  if (Array.isArray(result)) return { data: result, metrics: {} };
  if (!result || typeof result !== 'object') {
    throw new Error('display system algorithm must return an array or { data, metrics }');
  }
  const data = Array.isArray(result.data)
    ? result.data
    : Array.isArray(result.values)
      ? result.values
      : fallbackValues;
  return {
    data: Array.from(data),
    metrics: sanitizeAlgorithmMetrics(result.metrics),
  };
}

function executeAlgorithmResult(
  values,
  algorithm,
  algorithmData,
  algorithmRunners = {},
  executionContext = {},
) {
  const type = algorithm?.type || 'none';
  if (!algorithm?.enabled || type === 'none') return { data: values, metrics: {} };
  if (type === 'json') {
    const data = applyNumericConfig(values, algorithmData || {});
    return {
      data,
      metrics: calculateConfiguredMetrics(data, algorithmData?.metrics),
    };
  }

  const runner = algorithmRunners[type];
  if (typeof runner !== 'function') {
    throw new Error(`display system algorithm runner is not registered: ${type}`);
  }
  const rawData = Array.isArray(executionContext.rawData)
    ? executionContext.rawData
    : values;
  const result = runner([...rawData], {
    algorithm,
    data: algorithmData,
    rawData: [...rawData],
    normalizedData: [...values],
    matrix: executionContext.matrix || null,
  });
  if (result && typeof result.then === 'function') {
    return result.then((resolved) => normalizeAlgorithmResult(resolved, values));
  }
  return normalizeAlgorithmResult(result, values);
}

function executeAlgorithm(values, algorithm, algorithmData, algorithmRunners = {}) {
  return executeAlgorithmResult(values, algorithm, algorithmData, algorithmRunners).data;
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
  algorithmRunners = {},
}) {
  if (!runtimeChannel) {
    throw new Error('runtimeChannel is required');
  }

  let cachedLineOrder;
  let cachedPointOrder;
  let cachedAlgorithmData;
  let droppedFrames = 0;
  let lastDropReason = null;
  const resolvedAlgorithmRunners = { ...algorithmRunners };
  const algorithmBinding = runtimeChannel.processing?.algorithm || {};
  if (
    algorithmBinding.type === 'js'
    && !resolvedAlgorithmRunners.js
    && algorithmBinding.entry
  ) {
    resolvedAlgorithmRunners.js = createJavaScriptAlgorithmRunner({
      entry: algorithmBinding.entry,
      timeoutMs: algorithmBinding.timeoutMs,
      fsLike,
    });
  }
  if (
    algorithmBinding.type === 'python'
    && !resolvedAlgorithmRunners.python
    && algorithmBinding.entry
  ) {
    resolvedAlgorithmRunners.python = createPythonAlgorithmRunner({
      entry: algorithmBinding.entry,
      timeoutMs: algorithmBinding.timeoutMs,
    });
  }

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
    const frameValues = getFrameValues(frame);

    // 帧校验在解码之前：帧头或校验和不对的帧直接丢弃，不进入线序映射和算法。
    // 未声明 protocol.validation 时 validateFrame 恒为 ok，既有 manifest 无影响。
    if (runtimeChannel.protocol) {
      const frameValidation = validateFrame(frameValues, runtimeChannel.protocol);
      if (!frameValidation.ok) {
        droppedFrames += 1;
        lastDropReason = frameValidation.detail || frameValidation.reason;
        return {
          channelId: runtimeChannel.id,
          displaySystemId: runtimeChannel.displaySystemId,
          outputChannel: runtimeChannel.outputChannel || runtimeChannel.serialRole,
          dropped: true,
          dropReason: frameValidation.reason,
          dropDetail: frameValidation.detail || null,
          metrics: { droppedFrames, lastDropReason },
        };
      }
    }

    const values = runtimeChannel.protocol
      ? decodeProtocolValues(frameValues, runtimeChannel.protocol)
      : frameValues;
    const mapped = executeConfiguredMapping(values, {
      lineOrder: getLineOrderDefinition(),
      pointOrder: getPointOrderDefinition(),
    });
    const algorithmData = getAlgorithmData();
    const algorithmResultOrPromise = executeAlgorithmResult(
      mapped,
      runtimeChannel.processing?.algorithm,
      algorithmData,
      resolvedAlgorithmRunners,
      {
        rawData: values,
        matrix: runtimeChannel.display?.matrix || runtimeChannel.sensor?.matrix || null,
      },
    );

    const buildProcessedFrame = (algorithmResult) => {
      const processed = algorithmResult.data;
      const outputChannel = runtimeChannel.outputChannel || runtimeChannel.serialRole;
      const channelDataField = getChannelDataField(outputChannel);
      return {
        channelId: runtimeChannel.id,
        displaySystemId: runtimeChannel.displaySystemId,
        outputChannel,
        rawData: values,
        normalizedData: mapped,
        data: processed,
        [channelDataField]: processed,
        metrics: Object.keys(algorithmResult.metrics).length
          ? { ...buildPressureMetrics(processed), algorithm: algorithmResult.metrics }
          : buildPressureMetrics(processed),
        algorithmMetrics: algorithmResult.metrics,
        metadata: runtimeChannel.display,
      };
    };
    return algorithmResultOrPromise && typeof algorithmResultOrPromise.then === 'function'
      ? algorithmResultOrPromise.then(buildProcessedFrame)
      : buildProcessedFrame(algorithmResultOrPromise);
  }

  return {
    processFrame,
  };
}

module.exports = {
  applyNumericConfig,
  buildPressureMetrics,
  calculateConfiguredMetric,
  calculateConfiguredMetrics,
  createDisplaySystemFrameProcessor,
  executeAlgorithm,
  executeAlgorithmResult,
  getChannelDataField,
  getFrameValues,
  normalizeAlgorithmResult,
  sanitizeAlgorithmMetrics,
};
