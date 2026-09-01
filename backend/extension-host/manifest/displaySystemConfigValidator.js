const {
  normalizeProtocolConfig,
  validateProtocolConfig,
} = require('@shroom/backend/protocol/displaySystemProtocol.js');
const {
  normalizeDisplayConfig,
  validateDisplayConfig,
} = require('./displaySystemPage');
const { multiSensorStableContract } = require('@shroom/backend/contract');

const DISPLAY_SYSTEM_SCHEMA_VERSION = multiSensorStableContract.manifest.schemaVersion;
const SUPPORTED_DISPLAY_SYSTEM_SCHEMA_VERSIONS = Object.freeze([
  ...multiSensorStableContract.manifest.supportedSchemaVersions,
]);

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
 * channelId 由 `${displaySystemId}:${sensorId}` 组成，因此两个身份组件
 * 都不能自带分隔符。否则同一字符串无法唯一还原展示系统和传感器。
 *
 * @param {unknown} value 待检查的 identity 组件。
 * @returns {boolean} 是否包含 canonical channelId 分隔符。
 */
function containsChannelIdSeparator(value) {
  return typeof value === 'string' && value.includes(':');
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
 * 把 v1/v2 的单数 sensor 升格为 v3 的 sensors 数组。
 *
 * 这是整条链路上唯一的归一化点：下游只需要读 `sensors[]`，不必再分版本。
 * 旧 manifest 的 `sensor.ports` 每一项生成一个条目，矩阵/协议/文件/算法全部继承顶层声明，
 * 因此升格前后行为完全等价。没有 ports 时生成单个 `default` 条目。
 *
 * @param {object} config 原始 manifest。
 * @returns {object[]} 升格后的 sensors 数组。
 */
function upgradeSensorsFromLegacyConfig(config) {
  const sensor = config.sensor || {};
  const ports = Array.isArray(sensor.ports) && sensor.ports.length > 0
    ? sensor.ports
    : ['default'];
  const portLabels = sensor.portLabels
    && typeof sensor.portLabels === 'object'
    && !Array.isArray(sensor.portLabels)
    ? sensor.portLabels
    : {};

  return ports.map((port) => ({
    id: port,
    label: portLabels[port] || sensor.label || null,
    outputChannel: port,
    type: sensor.type,
    matrix: sensor.matrix,
    protocol: config.protocol,
    files: config.files,
    algorithm: config.algorithm,
  }));
}

/**
 * 校验单个传感器条目。
 *
 * @param {object} rawSensor 原始传感器条目。
 * @param {object} options 校验上下文。
 * @returns {{ errors: string[], value: object | null }} 校验结果。
 */
function validateSensorEntry(rawSensor, { source, index, schemaVersion, label }) {
  const errors = [];
  const sensor = rawSensor && typeof rawSensor === 'object' && !Array.isArray(rawSensor)
    ? rawSensor
    : {};

  if (rawSensor !== sensor) {
    return { errors: [`${source}: ${label} must be an object`], value: null };
  }

  if (schemaVersion >= DISPLAY_SYSTEM_SCHEMA_VERSION && !isNonEmptyString(sensor.id)) {
    errors.push(`${source}: ${label}.id is required for schemaVersion ${schemaVersion}`);
  }
  const id = isNonEmptyString(sensor.id) ? sensor.id.trim() : String(index);
  if (containsChannelIdSeparator(id)) {
    errors.push(`${source}: ${label}.id must not contain ":"`);
  }
  if (!isNonEmptyString(sensor.type)) errors.push(`${source}: ${label}.type is required`);

  const matrix = sensor.matrix || {};
  if (!isPositiveInteger(matrix.rows)) errors.push(`${source}: ${label}.matrix.rows must be a positive integer`);
  if (!isPositiveInteger(matrix.cols)) errors.push(`${source}: ${label}.matrix.cols must be a positive integer`);

  const files = sensor.files || {};
  if (!isNonEmptyString(files.lineOrder)) errors.push(`${source}: ${label}.files.lineOrder is required`);
  if (!isNonEmptyString(files.pointOrder)) errors.push(`${source}: ${label}.files.pointOrder is required`);
  if (files.coordinateMap != null && !isNonEmptyString(files.coordinateMap)) {
    errors.push(`${source}: ${label}.files.coordinateMap must be a non-empty string`);
  }

  const algorithm = normalizeAlgorithmConfig(sensor.algorithm);
  if (!Object.values(ALGORITHM_TYPES).includes(algorithm.type)) {
    errors.push(`${source}: ${label}.algorithm.type must be one of ${Object.values(ALGORITHM_TYPES).join(', ')}`);
  }
  if (algorithm.type !== ALGORITHM_TYPES.NONE && !isNonEmptyString(algorithm.entry) && !isNonEmptyString(algorithm.dataFile)) {
    errors.push(`${source}: ${label}.algorithm.entry or ${label}.algorithm.dataFile is required when algorithm.type is not none`);
  }
  if (!Number.isInteger(algorithm.timeoutMs) || algorithm.timeoutMs <= 0) {
    errors.push(`${source}: ${label}.algorithm.timeoutMs must be a positive integer`);
  }

  if (schemaVersion >= 2 && sensor.protocol == null) {
    errors.push(`${source}: ${label}.protocol is required for schemaVersion ${schemaVersion}`);
  }
  errors.push(...validateProtocolConfig(sensor.protocol, { source: `${source}: ${label}` }));

  if (errors.length > 0) return { errors, value: null };

  return {
    errors: [],
    value: {
      id,
      label: isNonEmptyString(sensor.label) ? sensor.label.trim() : id,
      outputChannel: isNonEmptyString(sensor.outputChannel) ? sensor.outputChannel.trim() : id,
      type: sensor.type.trim(),
      matrix: { rows: matrix.rows, cols: matrix.cols },
      files: {
        lineOrder: files.lineOrder.trim(),
        pointOrder: files.pointOrder.trim(),
        coordinateMap: isNonEmptyString(files.coordinateMap) ? files.coordinateMap.trim() : null,
      },
      protocol: normalizeProtocolConfig(sensor.protocol),
      algorithm,
      // Display System 统一按 channelId 入库，任意 outputChannel 都可下载/回放。
      // 仅显式写 stored:false 时关闭这一路采集。
      stored: sensor.stored !== false,
    },
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
  if (isNonEmptyString(config.id) && containsChannelIdSeparator(config.id.trim())) {
    errors.push(`${source}: id must not contain ":"`);
  }
  if (!isNonEmptyString(config.name)) errors.push(`${source}: name is required`);

  const schemaVersion = config.schemaVersion == null
    ? 1
    : Number(config.schemaVersion);
  if (!SUPPORTED_DISPLAY_SYSTEM_SCHEMA_VERSIONS.includes(schemaVersion)) {
    errors.push(`${source}: schemaVersion must be one of ${SUPPORTED_DISPLAY_SYSTEM_SCHEMA_VERSIONS.join(', ')}`);
  }

  // v3 用 sensors 数组声明多传感器；v1/v2 的单数 sensor 在这里升格，下游不再分版本。
  const declaredSensors = Array.isArray(config.sensors) && config.sensors.length > 0;
  if (schemaVersion >= DISPLAY_SYSTEM_SCHEMA_VERSION && !declaredSensors) {
    errors.push(`${source}: sensors is required for schemaVersion ${schemaVersion}`);
  }
  const rawSensors = declaredSensors
    ? config.sensors
    : upgradeSensorsFromLegacyConfig(config);
  if (Array.isArray(config.sensors) && config.sensors.length === 0) {
    errors.push(`${source}: sensors must contain at least one entry`);
  }

  const sensorValues = [];
  rawSensors.forEach((rawSensor, index) => {
    const label = declaredSensors ? `sensors[${index}]` : 'sensor';
    const result = validateSensorEntry(rawSensor, {
      source,
      index,
      schemaVersion,
      label,
    });
    errors.push(...result.errors);
    if (result.value) sensorValues.push(result.value);
  });

  const seenSensorIds = new Set();
  const seenOutputChannels = new Set();
  sensorValues.forEach((sensor) => {
    if (seenSensorIds.has(sensor.id)) {
      errors.push(`${source}: duplicate sensor id ${sensor.id}`);
    }
    seenSensorIds.add(sensor.id);
    if (seenOutputChannels.has(sensor.outputChannel)) {
      errors.push(`${source}: duplicate sensor outputChannel ${sensor.outputChannel}`);
    }
    seenOutputChannels.add(sensor.outputChannel);
  });

  errors.push(...validateDisplayConfig(config.display, { source }));

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      value: null,
    };
  }

  // 第一个传感器同时投影到旧的单数字段。既有调用方（文件校验器、
  // workspace service、前端 metadata）继续按 sensor/files/protocol 读取，
  // 多传感器信息只在新增的 sensors[] 里，因此单传感器系统行为不变。
  const [primary] = sensorValues;

  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion,
      id: config.id.trim(),
      name: config.name.trim(),
      version: isNonEmptyString(config.version) ? config.version.trim() : '0.0.0',
      description: isNonEmptyString(config.description) ? config.description.trim() : '',
      sensors: sensorValues,
      sensor: {
        type: primary.type,
        matrix: { ...primary.matrix },
        ports: sensorValues.map((item) => item.id),
      },
      files: { ...primary.files },
      protocol: primary.protocol,
      algorithm: primary.algorithm,
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
