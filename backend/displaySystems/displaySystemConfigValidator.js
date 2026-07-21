const {
  normalizeProtocolConfig,
  validateProtocolConfig,
} = require('./displaySystemProtocol');
const {
  normalizeDisplayConfig,
  validateDisplayConfig,
} = require('./displaySystemPage');

const DISPLAY_SYSTEM_SCHEMA_VERSION = 2;
const SUPPORTED_DISPLAY_SYSTEM_SCHEMA_VERSIONS = Object.freeze([1, 2]);

const ALGORITHM_TYPES = Object.freeze({
  NONE: 'none',
  JSON: 'json',
  JS: 'js',
  PYTHON: 'python',
  EXTERNAL: 'external',
});

/**
 * 判断值是否为非空字符串。
 *
 * @param {unknown} value 待检查的值。
 * @returns {boolean} 是否为非空字符串。
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 判断值是否为正整数。
 *
 * @param {unknown} value 待检查的值。
 * @returns {boolean} 是否为正整数。
 */
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * 规范化算法配置。
 *
 * 算法不是必填项；没有算法时明确归一化为 none，方便后续生成系统时走默认数据通道。
 *
 * @param {object | undefined} algorithm 原始算法配置。
 * @returns {object} 规范化后的算法配置。
 */
function normalizeAlgorithmConfig(algorithm = {}) {
  const type = isNonEmptyString(algorithm.type) ? algorithm.type.trim() : ALGORITHM_TYPES.NONE;
  return {
    type,
    entry: algorithm.entry || null,
    dataFile: algorithm.dataFile || null,
    input: algorithm.input || {},
    output: algorithm.output || {},
    timeoutMs: Number(algorithm.timeoutMs || 1000),
  };
}

/**
 * 校验展示系统 manifest。
 *
 * 这是配置驱动展示系统的最小契约。它不关心前端怎么渲染，也不直接打开串口；
 * 只保证“系统身份、矩阵尺寸、线序文件、点位文件、算法声明”这些关键配置可被后续模块稳定读取。
 *
 * @param {object} config 原始 manifest 对象。
 * @param {object} options 校验选项。
 * @param {string} [options.source] 配置来源，用于错误提示。
 * @returns {{ ok: boolean, errors: string[], value: object | null }} 校验结果。
 */
function validateDisplaySystemConfig(config, { source = 'display system manifest' } = {}) {
  const errors = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {
      ok: false,
      errors: [`${source}: config must be an object`],
      value: null,
    };
  }

  if (!isNonEmptyString(config.id)) errors.push(`${source}: id is required`);
  if (!isNonEmptyString(config.name)) errors.push(`${source}: name is required`);

  const schemaVersion = config.schemaVersion == null
    ? 1
    : Number(config.schemaVersion);
  if (!SUPPORTED_DISPLAY_SYSTEM_SCHEMA_VERSIONS.includes(schemaVersion)) {
    errors.push(`${source}: schemaVersion must be one of ${SUPPORTED_DISPLAY_SYSTEM_SCHEMA_VERSIONS.join(', ')}`);
  }

  const sensor = config.sensor || {};
  if (!isNonEmptyString(sensor.type)) errors.push(`${source}: sensor.type is required`);

  const matrix = sensor.matrix || {};
  if (!isPositiveInteger(matrix.rows)) errors.push(`${source}: sensor.matrix.rows must be a positive integer`);
  if (!isPositiveInteger(matrix.cols)) errors.push(`${source}: sensor.matrix.cols must be a positive integer`);

  const files = config.files || {};
  if (!isNonEmptyString(files.lineOrder)) errors.push(`${source}: files.lineOrder is required`);
  if (!isNonEmptyString(files.pointOrder)) errors.push(`${source}: files.pointOrder is required`);

  const algorithm = normalizeAlgorithmConfig(config.algorithm);
  if (!Object.values(ALGORITHM_TYPES).includes(algorithm.type)) {
    errors.push(`${source}: algorithm.type must be one of ${Object.values(ALGORITHM_TYPES).join(', ')}`);
  }

  if (algorithm.type !== ALGORITHM_TYPES.NONE && !isNonEmptyString(algorithm.entry) && !isNonEmptyString(algorithm.dataFile)) {
    errors.push(`${source}: algorithm.entry or algorithm.dataFile is required when algorithm.type is not none`);
  }
  if (!Number.isInteger(algorithm.timeoutMs) || algorithm.timeoutMs <= 0) {
    errors.push(`${source}: algorithm.timeoutMs must be a positive integer`);
  }

  if (schemaVersion >= 2 && config.protocol == null) {
    errors.push(`${source}: protocol is required for schemaVersion 2`);
  }
  errors.push(...validateProtocolConfig(config.protocol, { source }));
  errors.push(...validateDisplayConfig(config.display, { source }));

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      value: null,
    };
  }

  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion,
      id: config.id.trim(),
      name: config.name.trim(),
      version: isNonEmptyString(config.version) ? config.version.trim() : '0.0.0',
      description: isNonEmptyString(config.description) ? config.description.trim() : '',
      sensor: {
        type: sensor.type.trim(),
        matrix: {
          rows: matrix.rows,
          cols: matrix.cols,
        },
        ports: Array.isArray(sensor.ports) ? sensor.ports.slice() : [],
      },
      files: {
        lineOrder: files.lineOrder.trim(),
        pointOrder: files.pointOrder.trim(),
      },
      protocol: normalizeProtocolConfig(config.protocol),
      algorithm,
      display: normalizeDisplayConfig(config.display),
      metadata: config.metadata || {},
    },
  };
}

module.exports = {
  ALGORITHM_TYPES,
  DISPLAY_SYSTEM_SCHEMA_VERSION,
  SUPPORTED_DISPLAY_SYSTEM_SCHEMA_VERSIONS,
  validateDisplaySystemConfig,
};
