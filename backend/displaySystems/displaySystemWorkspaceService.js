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

const SAFE_DISPLAY_SYSTEM_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const BUILDER_ALGORITHM_TYPES = new Set(['none', 'json']);

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

function writeJsonAtomic(filePath, value, fsLike = fs) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  fsLike.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  if (fsLike.existsSync(filePath)) fsLike.unlinkSync(filePath);
  fsLike.renameSync(temporaryPath, filePath);
}

function readJsonOptional(filePath, fsLike = fs) {
  if (!filePath || !fsLike.existsSync(filePath)) return null;
  return JSON.parse(fsLike.readFileSync(filePath, 'utf8'));
}

function buildDisplaySystemBuilderCatalog() {
  return {
    serialTemplates: [
      {
        id: 'pressure-u8-tail',
        label: '经典 8 Bit 帧',
        description: '921600 baud，AA 55 03 99 帧尾，按 uint8 解码',
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
      {
        id: 'pressure-fixed-length',
        label: '固定长度原始帧',
        description: '1000000 baud，不使用分隔符，按矩阵点数读取完整 uint8 帧',
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
    transportTypes: [
      { id: 'binary', label: '二进制串口' },
    ],
    baudRates: [9600, 115200, 460800, 921600, 1000000, 1500000, 2000000],
    framingTypes: [
      { id: 'fixedLength', label: '不分包（固定长度）' },
      { id: 'delimiter', label: '按分隔符分包' },
    ],
    valueTypes: ['uint8', 'int8', 'uint16le', 'uint16be', 'int16le', 'int16be'],
    backendAlgorithms: [
      { id: 'none', label: '不处理' },
      { id: 'json', label: '数值处理' },
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
  };
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
      throw new Error('page builder only supports none and json backend algorithms');
    }

    const manifest = {
      ...inputManifest,
      schemaVersion: 2,
      id,
      files: {
        lineOrder: 'line-order.json',
        pointOrder: 'point-order.json',
      },
      algorithm: algorithmType === 'json'
        ? { ...inputManifest.algorithm, type: 'json', dataFile: 'algorithm-data.json', entry: null }
        : { type: 'none' },
    };
    const validation = validateDisplaySystemConfig(manifest, { source: 'page builder' });
    if (!validation.ok) {
      const error = new Error('display system manifest validation failed');
      error.details = validation.errors;
      throw error;
    }

    const matrix = validation.value.sensor.matrix;
    const total = matrix.rows * matrix.cols;
    const identity = createIdentityDefinitions(matrix);
    const lineOrder = definitions.lineOrder || identity.lineOrder;
    const pointOrder = definitions.pointOrder || identity.pointOrder;
    const algorithmData = algorithmType === 'json' ? (definitions.algorithmData || {}) : null;
    const definitionErrors = [
      ...validateLineOrderDefinition(lineOrder, { source: 'line-order.json', matrixTotal: total }),
      ...validatePointOrderDefinition(pointOrder, {
        source: 'point-order.json',
        matrix,
        maxPointCount: Array.isArray(lineOrder?.order) ? lineOrder.order.length : total,
      }),
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
    if (algorithmData) {
      writeJsonAtomic(path.join(directory, 'algorithm-data.json'), algorithmData, fsLike);
    }
    writeJsonAtomic(path.join(directory, 'display-system.json'), manifest, fsLike);

    return { id, directory, manifest };
  }

  function read(config) {
    if (!config?.manifestPath) return null;
    return {
      manifest: readJsonOptional(config.manifestPath, fsLike),
      definitions: {
        lineOrder: readJsonOptional(config.resolvedFiles?.lineOrder, fsLike),
        pointOrder: readJsonOptional(config.resolvedFiles?.pointOrder, fsLike),
        algorithmData: readJsonOptional(config.resolvedFiles?.algorithmData, fsLike),
      },
      writable: !path.relative(
        path.resolve(writableRoot),
        path.resolve(path.dirname(config.manifestPath)),
      ).startsWith('..'),
    };
  }

  return {
    getCatalog: () => ({
      ...buildDisplaySystemBuilderCatalog(),
      writableRoot,
    }),
    read,
    save,
    writableRoot,
  };
}

module.exports = {
  buildDisplaySystemBuilderCatalog,
  createDisplaySystemWorkspaceService,
  createIdentityDefinitions,
};
