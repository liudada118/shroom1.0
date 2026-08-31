const {
  normalizeOrderDefinition,
  normalizePointDefinition,
} = require('@shroom/backend/processing/configMappingExecutor.js');
const {
  validateCoordinateMapDefinition,
} = require('./displaySystemCoordinateMap');

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

/**
 * 读一份 JSON 定义文件，把「读失败」变成结果对象而不是异常。
 *
 * 不抛错是整个校验模块的基调：一份 manifest 可能同时四个文件出问题，抛错只能报第一个、
 * 用户来回改四轮。返回 `{ok, value, errors}` 让调用方一次收齐。
 *
 * `readJsonFile` **注入**而不是本模块 require fs：既让校验能脱盘测，也让读文件只由加载器
 * 一处实现 —— 否则两边对编码/BOM 的处理会漂移。
 *
 * @param {string} filePath JSON 文件绝对路径。
 * @param {(filePath: string) => object} readJsonFile 注入的读取函数。
 * @returns {{ok: boolean, value: object|null, errors: string[]}} 读取结果。
 */
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

/**
 * 校验线序（ADC 采样顺序）定义。
 *
 * ⚠️ **线序是 1 基的**（`index <= 0` 报错），而点位表是 0 基的。同一份 manifest 里两个
 * 文件基数不同是历史约定，改任一侧都会让所有既有配置错位。
 *
 * 两级错误处理有意不同：形状没解出来（`normalizeOrderDefinition` 抛错）→ **立刻返回**，
 * 逐项检查无从下手；逐项越界 → **累积一起返回**，用户要的是完整清单。`matrixTotal > 0`
 * 的守卫让尺寸缺失时跳过上界检查而不是把每项都判越界（尺寸缺失由 manifest 校验器报）。
 *
 * @param {*} definition 线序定义原始 JSON。
 * @param {object} options 校验上下文。
 * @param {string} options.source 文件路径，用于拼错误信息。
 * @param {number} options.matrixTotal 矩阵点总数（rows × cols），0 表示未知。
 * @returns {string[]} 错误列表；全部通过为空数组。
 */
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

/**
 * 校验点位表（每个采样值落到矩阵哪一格）定义。
 *
 * 行列是 **0 基**的（与 1 基的线序相反，见上）。
 *
 * `rows`/`cols` 要求与 `sensor.matrix` **严格相等**而非「不超过」—— 对不上说明拿错了文件
 * （换传感器时最常见的错），早报错比出一片错位的图好。`maxPointCount` 取**线序长度**而非
 * 矩阵总数：能落格的点数上限由采样值个数决定，矩阵可能比采样点多（有空格），拿矩阵总数
 * 当上限会放过真正的越界。
 *
 * @param {*} definition 点位表定义原始 JSON。
 * @param {object} options 校验上下文。
 * @param {string} options.source 文件路径，用于拼错误信息。
 * @param {{rows?: number, cols?: number}} options.matrix manifest 声明的矩阵尺寸。
 * @param {number} options.maxPointCount 可用采样值个数（= 线序长度），0 表示不检查。
 * @returns {string[]} 错误列表；全部通过为空数组。
 */
function validatePointOrderDefinition(definition, {
  source,
  matrix,
  maxPointCount,
}) {
  const errors = [];
  let normalized;

  try {
    // 文件校验需要继续逐点报告越界位置，运行时执行器仍使用严格边界检查。
    normalized = normalizePointDefinition(definition, { enforceMatrixBounds: false });
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

/**
 * 校验算法数据定义（数值变换链 + 指标声明）。
 *
 * `definition == null` 直接通过：算法本身是可选的，没有算法数据文件不是错。
 *
 * ⚠️ 两个操作类型都走**白名单**（`ALGORITHM_OPERATION_TYPES` /
 * `ALGORITHM_METRIC_OPERATION_TYPES`）而不是黑名单 —— 这是二开边界的落点之一：算法数据是
 * 用户可写的 JSON，未知 `type` 必须被拒而不是被忽略。**新增运算要同时改这里和执行器。**
 *
 * `SAFE_METRIC_ID` 要求字母开头、只含 `[A-Za-z0-9._-]`：这些 id 会变成对象键、进 HTTP
 * 响应和前端选择器。重复 id 也判错，下游按 id 取值、重复只有一条生效。`metrics` 不是数组
 * 时只报「必须是数组」不再逐项报（形状错了逐项报没意义）。
 *
 * @param {*} definition 算法数据原始 JSON；null/undefined 视为未配置。
 * @param {{source: string}} options 校验上下文，`source` 为文件路径。
 * @returns {string[]} 错误列表；通过为空数组。
 */
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

/**
 * 校验一个传感器条目引用的全部定义文件，一次性收齐所有错误。
 *
 * 调用方按传感器逐条调用（多传感器系统里每条矩阵尺寸不同，不能拿第一条的尺寸校第二条）。
 * 本函数不抛错，读文件的异常都由 readJsonDefinition 转成错误项。
 *
 * 四个文件的读取**刻意不对称**：`lineOrder`/`pointOrder` 无条件读（manifest 校验器已定它们
 * 必填，走到这里一定有值），`algorithmData`/`coordinateMap` 先判存在再读。
 *
 * `lineOrderLength` 那段三层三元是在不重复解析的前提下取长度（线序有裸数组 / `{order}` /
 * `{adcOrder}` 三种写法，都取不到退回矩阵总数），唯一用途是当点位表的点数上限。线序校验
 * 失败也照样算它并继续校点位表 —— 目的仍是一次报全。
 *
 * @param {{sensor?: object, resolvedFiles?: object}} config 单个传感器条目（含
 *        已解析成绝对路径的 resolvedFiles）。
 * @param {object} [options] 依赖。
 * @param {(filePath: string) => object} [options.readJsonFile] 注入的 JSON 读取函数。
 * @returns {{ok: boolean, errors: string[]}} 校验结果。
 */
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

  if (config.resolvedFiles?.coordinateMap) {
    const coordinateMapResult = readJsonDefinition(config.resolvedFiles.coordinateMap, readJsonFile);
    if (!coordinateMapResult.ok) {
      errors.push(...coordinateMapResult.errors);
    } else {
      errors.push(...validateCoordinateMapDefinition(coordinateMapResult.value, {
        source: config.resolvedFiles.coordinateMap,
        matrix,
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
  validateCoordinateMapDefinition,
  validateDisplaySystemDefinitionFiles,
  validateLineOrderDefinition,
  validatePointOrderDefinition,
};
