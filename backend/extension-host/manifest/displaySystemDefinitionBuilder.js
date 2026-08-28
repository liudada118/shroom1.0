const path = require('path');

/**
 * 获取显示系统矩阵尺寸。
 *
 * @param {object} config 已校验的显示系统配置。
 * @returns {{ rows: number, cols: number, width: number, height: number, total: number }} 标准矩阵尺寸。
 */
function buildMatrixDefinition(config) {
  // 兼容两种入参：系统级 config（矩阵在 sensor.matrix 下）与
  // 单个传感器条目（矩阵直接在 matrix 下）。
  const source = config?.matrix ? config : config?.sensor;
  const rows = Number(source?.matrix?.rows || 0);
  const cols = Number(source?.matrix?.cols || 0);
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
  // 同样兼容系统级 config 与单个传感器条目，两者都带 resolvedFiles/files/algorithm。
  return {
    lineOrder: config.resolvedFiles?.lineOrder || config.files?.lineOrder || null,
    pointOrder: config.resolvedFiles?.pointOrder || config.files?.pointOrder || null,
    coordinateMap: config.resolvedFiles?.coordinateMap || config.files?.coordinateMap || null,
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
    sensors: (config.sensors || []).map((sensor) => ({
      id: sensor.id,
      label: sensor.label,
      outputChannel: sensor.outputChannel,
      type: sensor.type,
      matrix: buildMatrixDefinition(sensor),
      protocol: sensor.protocol ? { ...sensor.protocol } : null,
      stored: sensor.stored === true,
    })),
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
      coordinateMap: Boolean(config.files?.coordinateMap),
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
  const sensors = Array.isArray(config.sensors) && config.sensors.length > 0
    ? config.sensors
    // 未经 validator 归一化的旧结构（直接调用本函数的测试与内部工具）在这里就地展开：
    // 每个 port 生成一个条目，继承顶层矩阵/协议/文件/算法。
    : (config.sensor?.ports?.length ? config.sensor.ports : ['default']).map((port) => ({
      ...config,
      id: port,
      outputChannel: port,
      type: config.sensor?.type,
      matrix: config.sensor?.matrix,
    }));

  return sensors.map((sensor, index) => {
    const files = buildFileDefinition(sensor);
    const channel = sensor.id || config.sensor?.ports?.[index] || 'default';
    return {
      id: `${config.id}:${channel}`,
      channel,
      outputChannel: sensor.outputChannel || channel,
      label: sensor.label || channel,
      displaySystemId: config.id,
      sensorType: sensor.type || config.sensor?.type,
      matrix: buildMatrixDefinition(sensor),
      protocol: sensor.protocol ? { ...sensor.protocol } : null,
      coordinateMap: sensor.coordinateMap || null,
      lineOrderFile: files.lineOrder,
      pointOrderFile: files.pointOrder,
      algorithm: {
        ...(sensor.algorithm || {}),
        dataFile: files.algorithmData,
        entry: files.algorithmEntry,
      },
    };
  });
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
    coordinateMap: config.coordinateMap || null,
    // 前端按 outputChannel 把 WebSocket 帧分发到对应 widget，需要知道有哪些通道。
    sensors: (config.sensors || []).map((sensor) => ({
      id: sensor.id,
      label: sensor.label,
      outputChannel: sensor.outputChannel,
      type: sensor.type,
      matrix: buildMatrixDefinition(sensor),
      coordinateMap: sensor.coordinateMap || null,
      stored: sensor.stored === true,
    })),
    views,
    widgets,
    // 画布 / 图表的默认外观和默认卡片。这三段是「基线」—— 前端的撤销就是退回
    // 到它们，保存就是把用户偏好写进它们。少转发一段，那一段的默认值就到不了
    // 前端，撤销会退到内置默认而不是 manifest 声明的样子（`canvas` 就出过这个
    // 问题：README 写着已经穿线，实际上 displayMetadata 里一直没有这个字段）。
    canvas: config.display?.canvas ? { ...config.display.canvas } : null,
    chartAppearance: config.display?.chartAppearance
      ? { ...config.display.chartAppearance }
      : null,
    chartCards: Array.isArray(config.display?.chartCards)
      ? config.display.chartCards.map((card) => ({ ...card }))
      : [],
    layout: config.display?.layout || { type: 'grid', columns: 12 },
    matrixTransform: config.display?.matrixTransform || { type: 'none', factor: 1, method: 'none' },
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
      coordinateMap: getFileName(files.coordinateMap),
      algorithmData: getFileName(files.algorithmData),
      algorithmEntry: getFileName(files.algorithmEntry),
    },
    algorithmType: config.algorithm?.type || 'none',
    editable: config.editable === true,
    origin: config.origin || 'system',
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
