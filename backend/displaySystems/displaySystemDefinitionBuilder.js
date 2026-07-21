const path = require('path');

/**
 * 获取显示系统矩阵尺寸。
 *
 * @param {object} config 已校验的显示系统配置。
 * @returns {{ rows: number, cols: number, width: number, height: number, total: number }} 标准矩阵尺寸。
 */
function buildMatrixDefinition(config) {
  const rows = Number(config.sensor?.matrix?.rows || 0);
  const cols = Number(config.sensor?.matrix?.cols || 0);
  return {
    rows,
    cols,
    width: cols,
    height: rows,
    total: rows * cols,
  };
}

/**
 * 获取文件的展示名称。
 *
 * @param {string | null | undefined} filePath 文件路径。
 * @returns {string | null} 文件名。
 */
function getFileName(filePath) {
  if (!filePath) return null;
  return path.basename(filePath);
}

/**
 * 把 manifest 中的文件声明合并成 runtime 可用的文件定义。
 *
 * @param {object} config 已校验的显示系统配置。
 * @returns {object} 文件定义。
 */
function buildFileDefinition(config) {
  return {
    lineOrder: config.resolvedFiles?.lineOrder || config.files?.lineOrder || null,
    pointOrder: config.resolvedFiles?.pointOrder || config.files?.pointOrder || null,
    algorithmData: config.resolvedFiles?.algorithmData || config.algorithm?.dataFile || null,
    algorithmEntry: config.resolvedFiles?.algorithmEntry || config.algorithm?.entry || null,
  };
}

/**
 * 从显示系统 manifest 生成传感器定义。
 *
 * 这层定义只描述“有什么传感器、矩阵多大、绑定哪些配置文件”，不直接打开串口或处理数据帧。
 *
 * @param {object} config 已校验的显示系统配置。
 * @returns {object} 传感器定义。
 */
function buildSensorDefinitionFromDisplaySystem(config) {
  const matrix = buildMatrixDefinition(config);
  const files = buildFileDefinition(config);
  return {
    id: config.id,
    displaySystemId: config.id,
    name: config.name,
    version: config.version,
    type: config.sensor?.type,
    matrix,
    ports: Array.isArray(config.sensor?.ports) ? [...config.sensor.ports] : [],
    protocol: config.protocol ? { ...config.protocol } : null,
    files,
    algorithm: {
      ...(config.algorithm || {}),
      dataFile: files.algorithmData,
      entry: files.algorithmEntry,
    },
    capabilities: {
      lineOrder: Boolean(config.files?.lineOrder),
      pointOrder: Boolean(config.files?.pointOrder),
      algorithm: Boolean(config.algorithm?.type && config.algorithm.type !== 'none'),
      displayMetadata: true,
    },
    metadata: { ...(config.metadata || {}) },
  };
}

/**
 * 从显示系统 manifest 生成 parser channel 定义。
 *
 * 后续串口 manager 可以按 channel 定义把某个串口输入绑定到对应线序、点位和算法。
 *
 * @param {object} config 已校验的显示系统配置。
 * @returns {object[]} parser channel 定义列表。
 */
function buildParserChannelDefinitionsFromDisplaySystem(config) {
  const matrix = buildMatrixDefinition(config);
  const files = buildFileDefinition(config);
  const ports = Array.isArray(config.sensor?.ports) && config.sensor.ports.length > 0
    ? config.sensor.ports
    : ['default'];

  return ports.map((channel) => ({
    id: `${config.id}:${channel}`,
    channel,
    displaySystemId: config.id,
    sensorType: config.sensor?.type,
    matrix,
    protocol: config.protocol ? { ...config.protocol } : null,
    lineOrderFile: files.lineOrder,
    pointOrderFile: files.pointOrder,
    algorithm: {
      ...(config.algorithm || {}),
      dataFile: files.algorithmData,
      entry: files.algorithmEntry,
    },
  }));
}

/**
 * 从显示系统 manifest 生成前端可读的展示元数据。
 *
 * 前端只需要展示身份、矩阵、视图和文件摘要，不需要拿到所有后端内部路径细节。
 *
 * @param {object} config 已校验的显示系统配置。
 * @returns {object} 展示元数据。
 */
function buildDisplayMetadataFromDisplaySystem(config) {
  const matrix = buildMatrixDefinition(config);
  const files = buildFileDefinition(config);
  const views = Array.isArray(config.display?.views) ? config.display.views.map((view) => ({ ...view })) : [];
  const widgets = Array.isArray(config.display?.widgets) ? config.display.widgets.map((widget) => ({ ...widget })) : [];
  return {
    id: config.id,
    name: config.name,
    version: config.version,
    description: config.description || '',
    sensorType: config.sensor?.type,
    matrix,
    views,
    widgets,
    layout: config.display?.layout || { type: 'grid', columns: 12 },
    controls: config.display?.controls || {},
    sidebar: config.display?.sidebar ? { ...config.display.sidebar } : null,
    defaultView: config.display?.defaultView || views[0]?.id || views[0]?.type || 'heatmap',
    renderers: Array.isArray(config.display?.renderers)
      ? config.display.renderers.map((renderer) => ({ ...renderer }))
      : [],
    visualizationAlgorithms: Array.isArray(config.display?.visualizationAlgorithms)
      ? config.display.visualizationAlgorithms.map((algorithm) => ({ ...algorithm }))
      : [],
    profiles: Array.isArray(config.display?.profiles)
      ? config.display.profiles.map((profile) => ({ ...profile }))
      : [],
    defaultProfile: config.display?.defaultProfile || null,
    protocol: config.protocol ? { ...config.protocol } : null,
    files: {
      lineOrder: getFileName(files.lineOrder),
      pointOrder: getFileName(files.pointOrder),
      algorithmData: getFileName(files.algorithmData),
      algorithmEntry: getFileName(files.algorithmEntry),
    },
    algorithmType: config.algorithm?.type || 'none',
    metadata: { ...(config.metadata || {}) },
  };
}

/**
 * 生成显示系统运行时定义。
 *
 * @param {object} config 已校验的显示系统配置。
 * @returns {{ sensorDefinition: object, parserChannels: object[], displayMetadata: object }} 运行时定义。
 */
function buildDisplaySystemRuntimeDefinition(config) {
  return {
    sensorDefinition: buildSensorDefinitionFromDisplaySystem(config),
    parserChannels: buildParserChannelDefinitionsFromDisplaySystem(config),
    displayMetadata: buildDisplayMetadataFromDisplaySystem(config),
  };
}

module.exports = {
  buildDisplayMetadataFromDisplaySystem,
  buildDisplaySystemRuntimeDefinition,
  buildParserChannelDefinitionsFromDisplaySystem,
  buildSensorDefinitionFromDisplaySystem,
};
