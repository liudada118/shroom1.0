const {
  normalizeOrderDefinition,
  normalizePointDefinition,
} = require('../processing/configMappingExecutor');

const ALGORITHM_OPERATION_TYPES = new Set([
  'scale',
  'offset',
  'clamp',
  'zeroBelow',
]);
const ALGORITHM_METRIC_OPERATION_TYPES = new Set([
  'sum',
  'average',
  'max',
  'min',
  'activeCount',
  'activeRatio',
  'external',
]);
const SAFE_METRIC_ID = /^[A-Za-z][A-Za-z0-9._-]*$/;

function readJsonDefinition(filePath, readJsonFile) {
  try {
    return {
      ok: true,
      value: readJsonFile(filePath),
      errors: [],
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      errors: [`${filePath}: ${error.message}`],
    };
  }
}

function validateLineOrderDefinition(definition, {
  source,
  matrixTotal,
}) {
  const errors = [];
  let order = [];

  try {
    order = normalizeOrderDefinition(definition);
  } catch (error) {
    return [`${source}: ${error.message}`];
  }

  order.forEach((index, offset) => {
    if (!Number.isInteger(index) || index <= 0) {
      errors.push(`${source}: order[${offset}] must be a positive integer`);
    } else if (matrixTotal > 0 && index > matrixTotal) {
      errors.push(`${source}: order[${offset}] exceeds matrix total ${matrixTotal}`);
    }
  });

  return errors;
}

function validatePointOrderDefinition(definition, {
  source,
  matrix,
  maxPointCount,
}) {
  const errors = [];
  let normalized;

  try {
    normalized = normalizePointDefinition(definition);
  } catch (error) {
    return [`${source}: ${error.message}`];
  }

  if (normalized.rows !== matrix.rows) {
    errors.push(`${source}: matrix.rows must match sensor.matrix.rows ${matrix.rows}`);
  }
  if (normalized.cols !== matrix.cols) {
    errors.push(`${source}: matrix.cols must match sensor.matrix.cols ${matrix.cols}`);
  }
  if (maxPointCount > 0 && normalized.points.length > maxPointCount) {
    errors.push(`${source}: points length exceeds available ordered values ${maxPointCount}`);
  }

  normalized.points.forEach((point, offset) => {
    if (!Array.isArray(point) || point.length < 2) {
      errors.push(`${source}: points[${offset}] must be [row, col]`);
      return;
    }
    const [row, col] = point;
    if (!Number.isInteger(row) || row < 0 || row >= normalized.rows) {
      errors.push(`${source}: points[${offset}][0] row is outside 0..${normalized.rows - 1}`);
    }
    if (!Number.isInteger(col) || col < 0 || col >= normalized.cols) {
      errors.push(`${source}: points[${offset}][1] col is outside 0..${normalized.cols - 1}`);
    }
  });

  return errors;
}

function validateAlgorithmDataDefinition(definition, { source }) {
  if (definition == null) return [];
  if (typeof definition !== 'object' || Array.isArray(definition)) {
    return [`${source}: algorithm data must be an object`];
  }

  const errors = [];
  ['scale', 'offset', 'min', 'max', 'zeroBelow'].forEach((key) => {
    if (definition[key] != null && typeof definition[key] !== 'number') {
      errors.push(`${source}: ${key} must be a number`);
    }
  });

  const operations = Array.isArray(definition.operations) ? definition.operations : [];
  operations.forEach((operation, offset) => {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
      errors.push(`${source}: operations[${offset}] must be an object`);
      return;
    }
    if (!ALGORITHM_OPERATION_TYPES.has(operation.type)) {
      errors.push(`${source}: operations[${offset}].type is not supported`);
    }
  });

  const metricIds = new Set();
  const metrics = Array.isArray(definition.metrics) ? definition.metrics : [];
  if (definition.metrics != null && !Array.isArray(definition.metrics)) {
    errors.push(`${source}: metrics must be an array`);
  }
  metrics.forEach((metric, offset) => {
    if (!metric || typeof metric !== 'object' || Array.isArray(metric)) {
      errors.push(`${source}: metrics[${offset}] must be an object`);
      return;
    }
    if (!SAFE_METRIC_ID.test(String(metric.id || ''))) {
      errors.push(`${source}: metrics[${offset}].id is invalid`);
    } else if (metricIds.has(metric.id)) {
      errors.push(`${source}: duplicate metric id ${metric.id}`);
    } else {
      metricIds.add(metric.id);
    }
    if (!ALGORITHM_METRIC_OPERATION_TYPES.has(metric.operation)) {
      errors.push(`${source}: metrics[${offset}].operation is not supported`);
    }
    ['threshold', 'scale', 'offset'].forEach((key) => {
      if (metric[key] != null && typeof metric[key] !== 'number') {
        errors.push(`${source}: metrics[${offset}].${key} must be a number`);
      }
    });
  });

  return errors;
}

function validateDisplaySystemDefinitionFiles(config, {
  readJsonFile,
} = {}) {
  const errors = [];
  const matrix = config.sensor?.matrix || {};
  const matrixTotal = Number(matrix.rows || 0) * Number(matrix.cols || 0);

  const lineOrderResult = readJsonDefinition(config.resolvedFiles?.lineOrder, readJsonFile);
  if (!lineOrderResult.ok) {
    errors.push(...lineOrderResult.errors);
  } else {
    errors.push(...validateLineOrderDefinition(lineOrderResult.value, {
      source: config.resolvedFiles.lineOrder,
      matrixTotal,
    }));
  }

  const lineOrderLength = Array.isArray(lineOrderResult.value)
    ? lineOrderResult.value.length
    : Array.isArray(lineOrderResult.value?.order)
      ? lineOrderResult.value.order.length
      : Array.isArray(lineOrderResult.value?.adcOrder)
        ? lineOrderResult.value.adcOrder.length
        : matrixTotal;

  const pointOrderResult = readJsonDefinition(config.resolvedFiles?.pointOrder, readJsonFile);
  if (!pointOrderResult.ok) {
    errors.push(...pointOrderResult.errors);
  } else {
    errors.push(...validatePointOrderDefinition(pointOrderResult.value, {
      source: config.resolvedFiles.pointOrder,
      matrix,
      maxPointCount: lineOrderLength,
    }));
  }

  if (config.resolvedFiles?.algorithmData) {
    const algorithmDataResult = readJsonDefinition(config.resolvedFiles.algorithmData, readJsonFile);
    if (!algorithmDataResult.ok) {
      errors.push(...algorithmDataResult.errors);
    } else {
      errors.push(...validateAlgorithmDataDefinition(algorithmDataResult.value, {
        source: config.resolvedFiles.algorithmData,
      }));
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateAlgorithmDataDefinition,
  validateDisplaySystemDefinitionFiles,
  validateLineOrderDefinition,
  validatePointOrderDefinition,
};
