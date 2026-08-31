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
 * 不抛错是这一整个校验模块的基调：一份 manifest 可能同时有四个文件出问题，抛错
 * 只能报第一个，用户改一个再看到下一个，来回四轮。返回 `{ok, value, errors}` 让
 * 调用方能把所有问题一次收齐。
 *
 * `readJsonFile` 是**注入**进来的（而不是本模块直接 require fs）：一是让校验逻辑
 * 能在没有磁盘的情况下测，二是让读文件这件事只由加载器一处实现，避免这里和加载器
 * 对编码/BOM 的处理出现差异。
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
 * ⚠️ **线序是 1 基的**（`index <= 0` 就报错），而点位表是 0 基的（见
 * `validatePointOrderDefinition` 里 `row < 0`）。同一份 manifest 里两个文件基数
 * 不同是历史约定，改任一侧都会让所有既有配置错位，所以只能在这里写清楚。
 *
 * 两级错误处理有意不同：
 * - `normalizeOrderDefinition` 抛错 → **立刻返回**。形状都没解出来（不是数组、
 *   也不是 `{order}`/`{adcOrder}`），逐项检查无从下手，继续跑只会产出一堆噪音。
 * - 逐项越界 → **累积后一起返回**。用户要的是「哪几个位置写错了」的完整清单。
 *
 * `matrixTotal > 0` 的守卫是为了在矩阵尺寸缺失时跳过上界检查而不是把每一项都判成
 * 越界 —— 尺寸本身缺失由 manifest 校验器负责报，这里不重复报第二遍。
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
 * `rows`/`cols` 要求与 `sensor.matrix` **严格相等**而不是「不超过」：点位表的行列数
 * 就是这块传感器的物理形状，对不上说明拿错了文件（换传感器时最常见的错），这种情况
 * 让它早报错比让画面出一片错位的图好。
 *
 * `maxPointCount` 来自**线序长度**而不是矩阵总数：点位表的第 i 项对应的是线序重排后
 * 第 i 个值，所以能落格的点数上限由线序有多少个采样值决定。矩阵可能比采样点多
 * （有空格），拿矩阵总数当上限会放过真正的越界。
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
 * 两个操作类型都走**白名单**（`ALGORITHM_OPERATION_TYPES` /
 * `ALGORITHM_METRIC_OPERATION_TYPES`）而不是黑名单 —— 这是二开边界的落点之一：
 * 算法数据是用户可写的 JSON，只允许声明式的、由本仓实现的有限几种运算，写一个未知
 * 的 `type` 会被拒而不是被忽略。要新增运算必须同时改这里的集合和执行器，白名单
 * 保证两边不会悄悄脱节。
 *
 * `SAFE_METRIC_ID` 限制指标 id 必须字母开头、只含 `[A-Za-z0-9._-]`：这些 id 会变成
 * 对象键、出现在 HTTP 响应和前端选择器里，允许任意字符会带来注入和取值歧义。
 * 重复 id 也判错，因为下游是按 id 取指标的，重复只有一个能生效，静默覆盖会让用户
 * 看到「我配了两条，只出一条」。
 *
 * ⚠️ `metrics` 不是数组时会报错，但下面的循环用的是被兜成 `[]` 的本地变量，
 * 所以只报「必须是数组」这一条、不再逐项报 —— 这是有意的，形状错了逐项报没意义。
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
 * 调用方按传感器逐条调用（多传感器系统里每条的矩阵尺寸不同，不能拿第一条的尺寸去
 * 校验第二条的文件）。
 *
 * 四个文件的读取方式**刻意不对称**：
 * - `lineOrder` / `pointOrder` **无条件读**，因为 manifest 校验器已经把
 *   `files.lineOrder` 和 `files.pointOrder` 定为必填（displaySystemConfigValidator
 *   的 `files.xxx is required`），走到这里它们一定有值。
 * - `algorithmData` / `coordinateMap` 先判存在再读，它们是可选的。
 *
 * `lineOrderLength` 那段三层三元是在**不重复解析**的前提下取长度：线序文件有三种
 * 合法写法（裸数组 / `{order}` / `{adcOrder}`），都取不到就退回矩阵总数。它的唯一
 * 用途是当点位表的点数上限（理由见 validatePointOrderDefinition）。注意即使线序
 * 校验失败也会继续算这个长度并继续校验点位表 —— 目的还是一次报全，而不是让用户
 * 修一个再发现下一个。
 *
 * 本函数不抛错，读文件的异常都由 readJsonDefinition 转成错误项。
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
