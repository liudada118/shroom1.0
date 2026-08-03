const fs = require('fs');
const path = require('path');
const {
  validateDisplaySystemConfig,
} = require('./displaySystemConfigValidator');
const {
  validateAlgorithmDataDefinition,
  validateLineOrderDefinition,
  validatePointOrderDefinition,
} = require('./displaySystemConfigFileValidator');
const {
  normalizePointDefinition,
} = require('../processing/configMappingExecutor');
const {
  canonicalizeCoordinateMapDefinition,
  normalizeCoordinateMapDefinition,
  validateCoordinateMapDefinition,
} = require('./displaySystemCoordinateMap');
const {
  PROTOCOL_CHECKSUM_TYPES,
  PROTOCOL_VALUE_TYPES,
} = require('./displaySystemProtocol');
const {
  CANVAS_COLORMAPS,
  CANVAS_OVERLAYS,
  CHART_OVERLAYS,
  DISPLAY_CHART_CARD_LIMIT,
} = require('./displaySystemCanvasCatalog');
const {
  normalizeCanvasConfig,
  normalizeChartAppearanceConfig,
  normalizeChartCardsConfig,
  validateDisplayConfig,
} = require('./displaySystemPage');

const SAFE_DISPLAY_SYSTEM_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const BUILDER_ALGORITHM_TYPES = new Set(['none', 'json', 'js', 'python']);
const CODE_ALGORITHM_TYPES = new Set(['js', 'python']);

const DEFAULT_ALGORITHM_SOURCES = Object.freeze({
  js: `module.exports = function calculate(rawData, context) {
  // rawData: 串口解码后的原始一维数据。
  // context.normalizedData: 完成线序和点位映射后的矩阵数据。
  return {
    data: context.normalizedData,
    metrics: {},
  };
};
`,
  python: `def calculate(raw_data, context):
    # raw_data: 串口解码后的原始一维数据。
    # context["normalized_data"]: 完成线序和点位映射后的矩阵数据。
    return {
        "data": context["normalized_data"],
        "metrics": {},
    }
`,
});

function createIdentityDefinitions(matrix) {
  const rows = Number(matrix?.rows || 0);
  const cols = Number(matrix?.cols || 0);
  const total = rows * cols;
  return {
    lineOrder: { order: Array.from({ length: total }, (_, index) => index + 1) },
    pointOrder: {
      matrix: { rows, cols },
      points: Array.from({ length: total }, (_, index) => [Math.floor(index / cols), index % cols]),
    },
  };
}

/**
 * 将用户提供的点位数据统一保存为带矩阵信息的标准结构。
 * 矩阵尺寸由点位坐标推导，避免 manifest 和点位文件分别维护尺寸。
 *
 * @param {object | number[][]} definition 原始点位定义。
 * @returns {{ matrix: { rows: number, cols: number }, points: number[][] }} 标准点位定义。
 */
function canonicalizePointDefinition(definition) {
  const normalized = normalizePointDefinition(definition);
  const extra = Array.isArray(definition) ? {} : { ...definition };
  delete extra.rows;
  delete extra.cols;
  delete extra.matrix;
  delete extra.points;
  return {
    ...extra,
    matrix: {
      ...(Array.isArray(definition) ? {} : definition.matrix),
      rows: normalized.rows,
      cols: normalized.cols,
    },
    points: normalized.points,
  };
}

function writeJsonAtomic(filePath, value, fsLike = fs) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  fsLike.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  if (fsLike.existsSync(filePath)) fsLike.unlinkSync(filePath);
  fsLike.renameSync(temporaryPath, filePath);
}

function writeTextAtomic(filePath, value, fsLike = fs) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  const text = String(value || '').replace(/\r\n/g, '\n');
  fsLike.writeFileSync(temporaryPath, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  if (fsLike.existsSync(filePath)) fsLike.unlinkSync(filePath);
  fsLike.renameSync(temporaryPath, filePath);
}

function readJsonOptional(filePath, fsLike = fs) {
  if (!filePath || !fsLike.existsSync(filePath)) return null;
  return JSON.parse(fsLike.readFileSync(filePath, 'utf8'));
}

function readTextOptional(filePath, fsLike = fs) {
  if (!filePath || !fsLike.existsSync(filePath)) return null;
  return fsLike.readFileSync(filePath, 'utf8');
}

function validateBuilderAlgorithmSource(type, source) {
  if (!CODE_ALGORITHM_TYPES.has(type)) return;
  if (typeof source !== 'string' || !source.trim()) {
    throw new Error(`${type} algorithm source is required`);
  }
  if (type === 'js' && !/module\.exports\s*=/.test(source)) {
    throw new Error('JavaScript algorithm must export calculate with module.exports');
  }
  if (type === 'python' && !/^\s*def\s+calculate\s*\(\s*raw_data\s*,\s*context\s*\)\s*:/m.test(source)) {
    throw new Error('Python algorithm must define calculate(raw_data, context)');
  }
}

function buildDisplaySystemBuilderCatalog() {
  return {
    serialTemplates: [
      {
        id: 'pressure-fixed-length',
        label: '经典 8 Bit 帧',
        description: '1000000 baud，不分包，按矩阵点数读取完整 uint8 帧',
        defaults: {
          transportType: 'binary',
          baudRate: 1000000,
          framingType: 'fixedLength',
          delimiter: '',
          dataBits: 8,
          valueType: 'uint8',
          byteOffset: 0,
          bytesPerValue: 1,
        },
      },
      {
        id: 'pressure-u8-tail',
        label: '921600 分包协议',
        description: '921600 baud，使用 AA 55 03 99 帧尾分包，按 uint8 解码',
        defaults: {
          transportType: 'binary',
          baudRate: 921600,
          framingType: 'delimiter',
          delimiter: 'AA 55 03 99',
          dataBits: 8,
          valueType: 'uint8',
          byteOffset: 0,
          bytesPerValue: 1,
        },
      },
      {
        id: 'pressure-adc16-tail',
        label: '经典 12 Bit ADC',
        description: '1500000 baud，8 字节帧尾，按 uint16le 解码',
        defaults: {
          transportType: 'binary',
          baudRate: 1500000,
          framingType: 'delimiter',
          delimiter: 'AA 00 55 00 03 00 99 00',
          dataBits: 12,
          valueType: 'uint16le',
          byteOffset: 0,
          bytesPerValue: 2,
        },
      },
    ],
    displayTemplates: [
      {
        id: 'heatmap-overview',
        label: '热力图总览',
        description: '彩色热力图、压力统计和左侧受压区域数据',
        defaults: {
          rendererId: 'heatmap',
          visualizationAlgorithmId: 'identity',
          profileLabel: '热力图总览',
          showStats: true,
          showPressurePanel: true,
          showAreaPanel: true,
        },
      },
      {
        id: 'numeric-matrix',
        label: '数字矩阵',
        description: '直接显示每个点的数值，同时保留压力统计',
        defaults: {
          rendererId: 'matrix',
          visualizationAlgorithmId: 'identity',
          profileLabel: '数字矩阵',
          showStats: true,
          showPressurePanel: true,
          showAreaPanel: true,
        },
      },
    ],
    serialRoles: ['sit', 'back', 'head', 'sensor'],
    // 多传感器系统的 outputChannel 可以任意取名，这里只给建议值而不是枚举。
    // sit/back/head 三路会入库并进历史回放，其它通道目前只有实时显示。
    outputChannelSuggestions: [
      { id: 'sit', label: '坐垫（入库）', stored: true },
      { id: 'back', label: '靠背（入库）', stored: true },
      { id: 'head', label: '头枕（入库）', stored: true },
      { id: 'sensor', label: '附加传感器（仅实时显示）', stored: false },
    ],
    transportTypes: [
      { id: 'binary', label: '二进制串口' },
    ],
    baudRates: [9600, 115200, 460800, 921600, 1000000, 1500000, 2000000],
    framingTypes: [
      { id: 'fixedLength', label: '不分包（固定长度）' },
      { id: 'delimiter', label: '按分隔符分包' },
    ],
    // 直接取协议层的支持列表，避免 Builder 下拉框和解码器实现各写一份而漂移。
    valueTypes: [...PROTOCOL_VALUE_TYPES],
    checksumTypes: [...PROTOCOL_CHECKSUM_TYPES],
    backendAlgorithms: [
      { id: 'none', label: '不处理' },
      { id: 'json', label: '数值处理' },
    ],
    algorithmModes: [
      { id: 'none', label: '不处理' },
      { id: 'json', label: '参数化数值处理' },
      { id: 'code', label: '自定义代码函数' },
    ],
    codeLanguages: [
      {
        id: 'js',
        label: 'JavaScript',
        filename: 'algorithm.js',
        template: DEFAULT_ALGORITHM_SOURCES.js,
      },
      {
        id: 'python',
        label: 'Python',
        filename: 'algorithm.py',
        template: DEFAULT_ALGORITHM_SOURCES.python,
      },
    ],
    renderers: [
      { id: 'heatmap', type: 'heatmap', label: '热力图' },
      { id: 'matrix', type: 'matrix', label: '数值矩阵' },
      { id: 'raw2d', type: 'raw2d', label: '原始二维数据' },
    ],
    visualizationAlgorithms: [
      { id: 'identity', type: 'identity', label: '原始数据', options: {} },
      { id: 'normalize', type: 'normalize', label: '归一化', options: { max: 100 } },
      { id: 'threshold', type: 'threshold', label: '阈值过滤', options: { threshold: 20 } },
      { id: 'smooth', type: 'smooth', label: '邻域平滑', options: { radius: 1 } },
    ],
    // display.canvas 的可选值目录。色值实现留在前端 colormaps.js，
    // 这里只登记 id 和中文名，保证前端零件栏、后端校验用的是同一份白名单。
    colormaps: [...CANVAS_COLORMAPS],
    overlays: [...CANVAS_OVERLAYS],
    // 图表表面能落地的叠加层是画布那份的子集，不含 legend。
    chartOverlays: [...CHART_OVERLAYS],
    chartCardLimit: DISPLAY_CHART_CARD_LIMIT,
  };
}

/** 只挑出草稿层能落地的三段，别的字段一律不接受 —— 这条通路只动 display 段。 */
const DISPLAY_SECTION_FIELDS = Object.freeze(['canvas', 'chartAppearance', 'chartCards']);

/**
 * 把 display 段的三个字段合并进原 manifest 的 `display`。
 *
 * `undefined` 表示"这次不改这一段"，`null` 表示"清掉这一段回到内置默认"。
 * 分开这两种语义是必要的：只保存配色的那次请求不该顺手把图表卡片清空。
 *
 * @param {object} display 原 manifest 的 display 段。
 * @param {object} patch 要合并的三段。
 * @returns {object} 新的 display 段。
 */
function mergeDisplaySection(display, patch = {}) {
  const next = { ...(display && typeof display === 'object' && !Array.isArray(display) ? display : {}) };
  DISPLAY_SECTION_FIELDS.forEach((field) => {
    if (!(field in patch) || patch[field] === undefined) return;
    if (patch[field] === null) {
      delete next[field];
      return;
    }
    next[field] = patch[field];
  });
  return next;
}

/**
 * 落盘前把这三段归一成规范形状。
 *
 * 前端传来的可能是 `colormap: 'thermal'` 这种简写。运行时无所谓（加载 manifest
 * 时还会再归一一遍），但**文件内容是要给人看的** —— 用户拿这个文件夹去二开，
 * 里面写着什么就是他学到的写法，所以磁盘上留规范形状。
 *
 * 只归一这三个字段。整段过一遍 `normalizeDisplayConfig` 会把 widgets / profiles
 * 也重写掉，那就不是"只动 display 段那三个字段"了。
 */
const DISPLAY_SECTION_NORMALIZERS = Object.freeze({
  canvas: (value) => {
    const normalized = normalizeCanvasConfig(value, []);
    // `canvas.widgets` 缺省的含义是"跟随 display.widgets"。这里不能把当时那份
    // 抄成一份显式清单 —— 抄了之后再改 display.widgets，画布就跟不上了。
    if (!Array.isArray(value?.widgets)) delete normalized.widgets;
    return normalized;
  },
  chartAppearance: (value) => normalizeChartAppearanceConfig(value),
  chartCards: (value) => normalizeChartCardsConfig(value),
});

/**
 * 合并 → 校验 → 归一，`saveDisplaySection` 和 `duplicate` 共用这一条。
 *
 * 校验跑在**归一之前**：`chartAppearance` 里写了 `legend` 这种错，归一会静默丢掉，
 * 只有先校验才能把它报给用户，而不是保存成功却没生效。
 *
 * @param {object} display 原 manifest 的 display 段。
 * @param {object} patch 要写入的三段。
 * @returns {object} 可落盘的新 display 段。
 */
function buildDisplaySection(display, patch) {
  const merged = mergeDisplaySection(display, patch);
  const errors = validateDisplayConfig(merged, { source: 'display draft' });
  if (errors.length) {
    const error = new Error('display section validation failed');
    error.details = errors;
    throw error;
  }
  const next = { ...merged };
  DISPLAY_SECTION_FIELDS.forEach((field) => {
    if (next[field] === undefined) return;
    next[field] = DISPLAY_SECTION_NORMALIZERS[field](next[field]);
  });
  return next;
}

/**
 * 递归复制一个目录。
 *
 * 必须递归：v3 多传感器 manifest 的线序 / 点位文件在 `cushion/` 这类子目录里，
 * 只复制顶层文件会造出一个读不出数据的新展示系统。
 *
 * @param {string} sourceDirectory 源目录。
 * @param {string} targetDirectory 目标目录。
 * @param {object} fsLike 文件系统实现。
 * @returns {void}
 */
function copyDirectoryRecursive(sourceDirectory, targetDirectory, fsLike) {
  fsLike.mkdirSync(targetDirectory, { recursive: true });
  fsLike.readdirSync(sourceDirectory, { withFileTypes: true }).forEach((entry) => {
    const from = path.join(sourceDirectory, entry.name);
    const to = path.join(targetDirectory, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(from, to, fsLike);
      return;
    }
    // 逐字节复制而不是 JSON 往返：v1/v2/v3、algorithm.js / algorithm.py、
    // assets/ 里的图片全都自动正确，语义上也就是用户说的"把文件夹复制一份"。
    fsLike.copyFileSync(from, to);
  });
}

function createDisplaySystemWorkspaceService({
  writableRoot,
  fsLike = fs,
} = {}) {
  if (!writableRoot) throw new Error('display system writableRoot is required');
  fsLike.mkdirSync(writableRoot, { recursive: true });

  function save({ manifest: inputManifest, definitions = {}, overwrite = false } = {}) {
    if (!inputManifest || typeof inputManifest !== 'object') {
      throw new Error('display system manifest is required');
    }
    const id = String(inputManifest.id || '').trim();
    if (!SAFE_DISPLAY_SYSTEM_ID.test(id)) {
      throw new Error('display system id may only contain letters, numbers, dot, underscore and hyphen');
    }

    const algorithmType = inputManifest.algorithm?.type || 'none';
    if (!BUILDER_ALGORITHM_TYPES.has(algorithmType)) {
      throw new Error('page builder only supports none, json, js and python backend algorithms');
    }
    const algorithmSource = definitions.algorithmSource
      ?? DEFAULT_ALGORITHM_SOURCES[algorithmType]
      ?? null;
    validateBuilderAlgorithmSource(algorithmType, algorithmSource);

    const suppliedPointOrder = definitions.pointOrder == null
      ? null
      : canonicalizePointDefinition(definitions.pointOrder);
    const pointDefinition = suppliedPointOrder
      ? normalizePointDefinition(suppliedPointOrder)
      : null;
    const suppliedCoordinateMap = definitions.coordinateMap == null
      ? null
      : canonicalizeCoordinateMapDefinition(definitions.coordinateMap);
    const coordinateDefinition = suppliedCoordinateMap
      ? normalizeCoordinateMapDefinition(suppliedCoordinateMap)
      : null;
    const derivedMatrix = coordinateDefinition
      ? { rows: coordinateDefinition.rows, cols: coordinateDefinition.cols }
      : pointDefinition
      ? { rows: pointDefinition.rows, cols: pointDefinition.cols }
      : inputManifest.sensor?.matrix;
    const derivedValueCount = pointDefinition?.points.length ?? coordinateDefinition?.pointCount;

    const manifest = {
      ...inputManifest,
      schemaVersion: 2,
      id,
      sensor: {
        ...inputManifest.sensor,
        matrix: derivedMatrix,
      },
      protocol: {
        ...inputManifest.protocol,
        decoding: {
          ...inputManifest.protocol?.decoding,
          ...(derivedValueCount == null ? {} : { valueCount: derivedValueCount }),
        },
      },
      files: {
        lineOrder: 'line-order.json',
        pointOrder: 'point-order.json',
        ...(suppliedCoordinateMap ? { coordinateMap: 'coordinate-map.json' } : {}),
      },
      algorithm: algorithmType === 'json'
        ? { ...inputManifest.algorithm, type: 'json', dataFile: 'algorithm-data.json', entry: null }
        : CODE_ALGORITHM_TYPES.has(algorithmType)
          ? {
            ...inputManifest.algorithm,
            type: algorithmType,
            entry: algorithmType === 'python' ? 'algorithm.py' : 'algorithm.js',
            dataFile: null,
            input: {
              source: 'rawData',
              ...(inputManifest.algorithm?.input || {}),
            },
            timeoutMs: Number(inputManifest.algorithm?.timeoutMs || 1000),
          }
          : { type: 'none' },
    };
    const validation = validateDisplaySystemConfig(manifest, { source: 'page builder' });
    if (!validation.ok) {
      const error = new Error('display system manifest validation failed');
      error.details = validation.errors;
      throw error;
    }
    const persistedManifest = {
      ...manifest,
      protocol: validation.value.protocol,
    };

    const matrix = validation.value.sensor.matrix;
    const total = matrix.rows * matrix.cols;
    const identity = createIdentityDefinitions(matrix);
    const pointOrder = suppliedPointOrder || identity.pointOrder;
    const pointCount = suppliedPointOrder?.points.length || total;
    const lineOrder = definitions.lineOrder || {
      order: Array.from({ length: pointCount }, (_, index) => index + 1),
    };
    const algorithmData = algorithmType === 'json' ? (definitions.algorithmData || {}) : null;
    const definitionErrors = [
      ...validateLineOrderDefinition(lineOrder, { source: 'line-order.json', matrixTotal: total }),
      ...validatePointOrderDefinition(pointOrder, {
        source: 'point-order.json',
        matrix,
        maxPointCount: Array.isArray(lineOrder?.order) ? lineOrder.order.length : total,
      }),
      ...(suppliedCoordinateMap
        ? validateCoordinateMapDefinition(suppliedCoordinateMap, {
          source: 'coordinate-map.json',
          matrix,
        })
        : []),
      ...validateAlgorithmDataDefinition(algorithmData, { source: 'algorithm-data.json' }),
    ];
    if (definitionErrors.length) {
      const error = new Error('display system definition validation failed');
      error.details = definitionErrors;
      throw error;
    }

    const directory = path.join(writableRoot, id);
    if (fsLike.existsSync(directory) && !overwrite) {
      const error = new Error('display system already exists');
      error.code = 'DISPLAY_SYSTEM_EXISTS';
      throw error;
    }
    fsLike.mkdirSync(directory, { recursive: true });
    writeJsonAtomic(path.join(directory, 'line-order.json'), lineOrder, fsLike);
    writeJsonAtomic(path.join(directory, 'point-order.json'), pointOrder, fsLike);
    if (suppliedCoordinateMap) {
      writeJsonAtomic(path.join(directory, 'coordinate-map.json'), suppliedCoordinateMap, fsLike);
    }
    if (algorithmData) {
      writeJsonAtomic(path.join(directory, 'algorithm-data.json'), algorithmData, fsLike);
    }
    if (CODE_ALGORITHM_TYPES.has(algorithmType)) {
      const filename = algorithmType === 'python' ? 'algorithm.py' : 'algorithm.js';
      writeTextAtomic(path.join(directory, filename), algorithmSource, fsLike);
    }
    writeJsonAtomic(path.join(directory, 'display-system.json'), persistedManifest, fsLike);

    return { id, directory, manifest: persistedManifest };
  }

  /**
   * 把主界面拖出来的外观固化进 manifest 的 display 段。
   *
   * **刻意不复用 `save()`。** 那条通路内嵌了 Builder 的单传感器向导假设：
   * 强制 `schemaVersion: 2`、把 `files` 重写成扁平路径、重建 `algorithm` 段。
   * 拿一份 v3 多传感器 manifest 过一遍它只为了改一个配色，会把 manifest 改坏。
   * 这里读原文、只合并 display 下那三段、逐字写回，其余字段一个都不碰。
   *
   * @param {object} config 已加载的展示系统配置（要有 `manifestPath`）。
   * @param {{canvas?: object, chartAppearance?: object, chartCards?: object[]}} patch 要写入的三段。
   * @returns {{id: string, directory: string, manifest: object}} 写入结果。
   */
  function saveDisplaySection(config, patch = {}) {
    if (!config?.manifestPath) throw new Error('display system manifestPath is required');
    const manifest = readJsonOptional(config.manifestPath, fsLike);
    if (!manifest || typeof manifest !== 'object') {
      throw new Error('display system manifest is not readable');
    }
    const display = buildDisplaySection(manifest.display, patch);
    const nextManifest = { ...manifest, display };
    writeJsonAtomic(config.manifestPath, nextManifest, fsLike);
    return {
      id: String(manifest.id || ''),
      directory: path.dirname(config.manifestPath),
      manifest: nextManifest,
    };
  }

  /**
   * 把整个展示系统目录复制成一个新 id 的新模块，并写入 display 段。
   *
   * 这是自带展示系统唯一的保存出路：它的目录在资源目录里、不可写，
   * 所以**不检查源能不能写**，只检查源能不能读、目标 id 有没有被占。
   *
   * @param {object} config 源展示系统配置（要有 `manifestPath`）。
   * @param {{id: string, name?: string, canvas?: object, chartAppearance?: object,
   *          chartCards?: object[]}} options 新模块的身份与要写入的三段。
   * @returns {{id: string, directory: string, manifest: object}} 新模块。
   */
  function duplicate(config, options = {}) {
    if (!config?.manifestPath) throw new Error('display system manifestPath is required');
    const id = String(options.id || '').trim();
    if (!SAFE_DISPLAY_SYSTEM_ID.test(id)) {
      throw new Error('display system id may only contain letters, numbers, dot, underscore and hyphen');
    }
    const sourceDirectory = config.sourceDirectory || path.dirname(config.manifestPath);
    const manifest = readJsonOptional(config.manifestPath, fsLike);
    if (!manifest || typeof manifest !== 'object') {
      throw new Error('display system manifest is not readable');
    }
    const directory = path.join(writableRoot, id);
    if (fsLike.existsSync(directory)) {
      const error = new Error('display system already exists');
      error.code = 'DISPLAY_SYSTEM_EXISTS';
      throw error;
    }
    const display = buildDisplaySection(manifest.display, options);
    const nextManifest = {
      ...manifest,
      id,
      name: String(options.name || '').trim() || `${manifest.name || id} 副本`,
      display,
      metadata: {
        ...(manifest.metadata || {}),
        // 必须显式写 'user'：`classifyDisplaySystemAccess` 把 `metadata.origin` 当
        // 最高优先级的判据，自带系统那份写着 'system'，照抄过来的话副本明明躺在
        // 可写目录里也会被判成不可编辑，用户就再也保存不了第二次。
        origin: 'user',
        // 记下来源，以后要做"和原版比一比"或者"跟随原版升级"时有据可查。
        derivedFrom: String(manifest.id || ''),
      },
    };
    copyDirectoryRecursive(sourceDirectory, directory, fsLike);
    // manifest 的文件名跟着源目录走 —— 源里叫 display-system.json 就还叫这个。
    writeJsonAtomic(path.join(directory, path.basename(config.manifestPath)), nextManifest, fsLike);
    return { id, directory, manifest: nextManifest };
  }

  function read(config) {
    if (!config?.manifestPath) return null;
    const pathIsWritable = !path.relative(
      path.resolve(writableRoot),
      path.resolve(path.dirname(config.manifestPath)),
    ).startsWith('..');
    const editable = typeof config.editable === 'boolean'
      ? config.editable
      : pathIsWritable;
    return {
      manifest: readJsonOptional(config.manifestPath, fsLike),
      definitions: {
        lineOrder: readJsonOptional(config.resolvedFiles?.lineOrder, fsLike),
        pointOrder: readJsonOptional(config.resolvedFiles?.pointOrder, fsLike),
        coordinateMap: readJsonOptional(config.resolvedFiles?.coordinateMap, fsLike),
        algorithmData: readJsonOptional(config.resolvedFiles?.algorithmData, fsLike),
        algorithmSource: readTextOptional(config.resolvedFiles?.algorithmEntry, fsLike),
      },
      editable,
      origin: config.origin || (editable ? 'user' : 'system'),
      writable: editable && pathIsWritable,
    };
  }

  return {
    getCatalog: () => ({
      ...buildDisplaySystemBuilderCatalog(),
      writableRoot,
    }),
    read,
    save,
    saveDisplaySection,
    duplicate,
    writableRoot,
  };
}

module.exports = {
  DEFAULT_ALGORITHM_SOURCES,
  buildDisplaySystemBuilderCatalog,
  createDisplaySystemWorkspaceService,
  createIdentityDefinitions,
  validateBuilderAlgorithmSource,
};
