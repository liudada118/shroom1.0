import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Segmented,
  Spin,
  Upload,
  message,
} from 'antd';
import {
  ApiOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  LeftOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  MATRIX_DISPLAY_MODES,
  createDirectionCheckFrame,
  createMatrixDisplayRenderers,
  inferMatrixDisplayModeId,
} from '@shroom/frontend/core/matrixDisplayModes.js';
import { commandClient } from '../../services/command/commandClient';
import { registerRuntimeDisplayDefinition } from '../../displays/registry';
import useMainWebSocket from '../../services/ws/useMainWebSocket';
import DisplayCanvasConfigurator from './canvasConfigurator/DisplayCanvasConfigurator.jsx';
import MatrixWidget from './widgets/MatrixWidget.jsx';
import CoordinatePointWidget from './widgets/CoordinatePointWidget.jsx';
import StatsWidget from './widgets/StatsWidget.jsx';
import { calculatePressureMetrics } from './displayProfileRuntime';
import { applyMatrixTransform } from '../../displays/matrixTransform';
import { DEFAULT_COLORMAP_ID } from './colormaps';
import RendererHost from '../../renderers/RendererHost.jsx';
import { readManifestChannelFrames } from './manifestSceneAdapter.js';
import {
  buildManifestWidgetRendererParams,
  resolveManifestWidgetGeometry,
} from './manifestWidgetGeometry.js';
import {
  buildBuilderPortViews,
  buildBuilderSensorFilePath,
  buildBuilderSensorDrafts,
  buildBuilderSensorPlan,
  buildPortLabels,
  ensureBuilderPortWidgets,
  getInvalidBuilderSensorIds,
  normalizeBuilderSensorIds,
} from './builderMultiSensor.js';
import {
  buildDetectedProtocolFormPatch,
  buildProtocolGeometryDefaults,
  buildSerialPortOptions,
  buildSerialTemplateFormPatch,
  formatProtocolCandidateLabels,
  getDetectableProtocolCandidateIds,
  unwrapControlApiData,
} from './protocolAutoDetect.js';
import { listAgentRendererApps, requestJson } from './api.js';
import AgentRendererHost from './AgentRendererHost.jsx';
import {
  isAgentRendererId,
  parseAgentRendererId,
} from './agentRendererBridge.js';
import './DisplaySystemBuilder.css';

const EMPTY_PROTOCOL_DETECTION = Object.freeze({ status: 'idle' });

const DEFAULT_VALUES = {
  id: '',
  name: '',
  serialTemplate: 'pressure-fixed-length',
  displayTemplate: 'shape-heatmap-2d',
  version: '1.0.0',
  sensorType: '',
  ports: ['sit'],
  portLabels: {},
  transportType: 'binary',
  baudRate: 1000000,
  framingType: 'fixedLength',
  frameLength: null,
  delimiter: '',
  includeDelimiter: false,
  dataBits: 8,
  valueType: 'uint8',
  byteOffset: 0,
  valueCount: null,
  // 帧校验默认关闭：帧头留空、校验算法选 none，行为与引入这组字段之前一致。
  validationHeader: '',
  validationHeaderOffset: 0,
  checksumType: 'none',
  checksumByteOffset: -1,
  checksumRangeExplicit: true,
  checksumRangeStart: 0,
  checksumRangeEnd: -1,
  lineOrderMode: 'identity',
  lineOrderJson: '',
  pointOrderJson: '',
  coordinateMapJson: '',
  backendAlgorithm: 'none',
  algorithmPackageId: '',
  algorithmPackageManifest: null,
  algorithmLanguage: 'js',
  algorithmSource: '',
  algorithmTimeoutMs: 1000,
  algorithmMetrics: [],
  scale: 1,
  offset: 0,
  zeroBelow: 0,
  rendererId: 'heatmap',
  visualizationAlgorithmId: 'identity',
  normalizeMax: 100,
  threshold: 20,
  smoothRadius: 1,
  matrixTransformType: 'none',
  matrixTransformFactor: 1,
  profileLabel: '默认方案',
  canvasConfig: buildDefaultCanvasConfig(),
  showPressurePanel: true,
  pressurePanelTitle: 'Pressure Data',
  primaryMetric: 'totalPressure',
  pressureMetrics: ['averagePressure', 'maxPressure', 'totalPressure'],
  showAreaPanel: true,
  areaPanelTitle: 'Pressure Area',
  areaMetrics: ['activePoints', 'area'],
  activeThreshold: 0,
  pointArea: 2.1,
  areaUnit: 'cm²',
  runtimeMode: 'parallel',
};

const SENSOR_FORM_FIELDS = [
  'sensorLabel',
  'outputChannel',
  'stored',
  'sensorType',
  'serialTemplate',
  'transportType',
  'baudRate',
  'framingType',
  'frameLength',
  'delimiter',
  'includeDelimiter',
  'dataBits',
  'valueType',
  'byteOffset',
  'valueCount',
  'validationHeader',
  'validationHeaderOffset',
  'checksumType',
  'checksumByteOffset',
  'checksumRangeExplicit',
  'checksumRangeStart',
  'checksumRangeEnd',
  'lineOrderMode',
  'lineOrderJson',
  'pointOrderJson',
  'coordinateMapJson',
  'backendAlgorithm',
  'algorithmPackageId',
  'algorithmPackageManifest',
  'algorithmLanguage',
  'algorithmSource',
  'algorithmTimeoutMs',
  'algorithmMetrics',
  'scale',
  'offset',
  'min',
  'max',
  'zeroBelow',
];

const PROTOCOL_FORM_FIELDS = new Set([
  'serialTemplate',
  'transportType',
  'baudRate',
  'framingType',
  'frameLength',
  'delimiter',
  'includeDelimiter',
  'dataBits',
  'valueType',
  'byteOffset',
  'valueCount',
  'validationHeader',
  'validationHeaderOffset',
  'checksumType',
  'checksumByteOffset',
  'checksumRangeExplicit',
  'checksumRangeStart',
  'checksumRangeEnd',
]);

function cloneBuilderValue(value) {
  if (Array.isArray(value)) return value.map(cloneBuilderValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneBuilderValue(item)]),
    );
  }
  return value;
}

function pickSensorFormValues(values = {}) {
  return Object.fromEntries(SENSOR_FORM_FIELDS.map((field) => [field, cloneBuilderValue(values[field])]));
}

/**
 * 生成默认画布配置。展示模板只描述"用哪个渲染器、要不要压力统计"，
 * 画布的真实形态由这里落成 widget 列表，保存时直接写进 display.canvas。
 *
 * @param {object} [options] 生成参数。
 * @param {string} [options.rendererId] 主 widget 的渲染类型。
 * @param {boolean} [options.showStats] 是否附带压力统计卡片。
 * @param {string} [options.source] widget 数据来源通道。
 * @returns {{colormap: object, overlays: string[], widgets: object[]}} 画布配置。
 */
function buildDefaultCanvasConfig({
  rendererId = 'heatmap',
  showStats = false,
  source = 'sitData',
} = {}) {
  const widgets = [{
    id: 'main',
    type: rendererId,
    label: '压力数据',
    source,
    columnSpan: showStats ? 8 : 12,
  }];
  if (showStats) {
    widgets.push({
      id: 'stats',
      type: 'pressureStats',
      label: '压力统计',
      source,
      columnSpan: 4,
    });
  }
  return { colormap: { id: DEFAULT_COLORMAP_ID }, overlays: [], widgets };
}

/**
 * 只登记值、不渲染控件的表单占位。画布配置是对象，用 Input 承载会把
 * `[object Object]` 塞进 DOM；这里让 Form.Item 只负责把值带进 validateFields()。
 */
function FormValueHolder() {
  return null;
}

const SIDEBAR_METRIC_OPTIONS = [
  { value: 'totalPressure', label: '总压力' },
  { value: 'averagePressure', label: '平均压力' },
  { value: 'maxPressure', label: '最大压力' },
  { value: 'activePoints', label: '有效点数' },
  { value: 'area', label: '受压面积' },
];

const ALGORITHM_METRIC_OPERATION_OPTIONS = [
  { value: 'sum', label: '求和' },
  { value: 'average', label: '平均值' },
  { value: 'max', label: '最大值' },
  { value: 'min', label: '最小值' },
  { value: 'activeCount', label: '阈值以上点数' },
  { value: 'activeRatio', label: '阈值以上占比' },
  { value: 'external', label: '算法包直接输出' },
];

const RUNTIME_MODE_OPTIONS = [
  { value: 'parallel', label: '并行运行' },
  { value: 'shadow', label: '只验证，不输出' },
  { value: 'disabled', label: '暂不启用' },
];

const SERIAL_ROLE_LABELS = {
  sit: '主传感器',
  back: '靠背',
  head: '头枕',
  sensor: '扩展传感器',
};

function getMetricPanel(metricId, sidebar = {}) {
  const reference = `algorithm.${metricId}`;
  const inPressure = sidebar.pressure?.metrics?.includes(reference);
  const inArea = sidebar.area?.metrics?.includes(reference);
  if (inPressure && inArea) return 'both';
  if (inArea) return 'area';
  return 'pressure';
}

async function requestControlApi(path, options) {
  return unwrapControlApiData(await requestJson(path, options));
}

function parseDefinition(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${label} JSON 无效：${error.message}`);
  }
}

/**
 * 将 manifest 中的帧分隔符转换为编辑器使用的十六进制文本。
 * 兼容旧配置保存的字符串和新配置保存的字节数组。
 *
 * @param {string | number[]} value 帧分隔符。
 * @returns {string} 供表单显示的十六进制文本。
 */
function formatByteSequence(value) {
  if (typeof value === 'string') return value.trim().toUpperCase();
  if (!Array.isArray(value)) return '';
  return value
    .map((byte) => Number(byte))
    .filter((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

/**
 * 校验点位坐标并推导矩阵尺寸，点位文件是矩阵尺寸的唯一数据源。
 *
 * @param {string | object | number[][]} value 点位 JSON 文本或对象。
 * @param {string} label 错误提示中的字段名称。
 * @returns {{ definition: object, rows: number, cols: number, pointCount: number, matrixCellCount: number }}
 */
function normalizePointOrderDefinition(value, label = '矩阵点位') {
  const parsed = typeof value === 'string' ? parseDefinition(value, label) : value;
  const points = Array.isArray(parsed) ? parsed : parsed?.points;
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error(`${label}必须包含非空 points 数组`);
  }

  let inferredRows = 0;
  let inferredCols = 0;
  const coordinateKeys = new Set();
  points.forEach((point, index) => {
    if (!Array.isArray(point) || point.length < 2) {
      throw new Error(`${label} points[${index}] 必须是 [row, col]`);
    }
    const [row, col] = point;
    if (!Number.isInteger(row) || row < 0 || !Number.isInteger(col) || col < 0) {
      throw new Error(`${label} points[${index}] 的行列必须是非负整数`);
    }
    const coordinateKey = `${row},${col}`;
    if (coordinateKeys.has(coordinateKey)) {
      throw new Error(`${label}存在重复坐标 [${row}, ${col}]`);
    }
    coordinateKeys.add(coordinateKey);
    inferredRows = Math.max(inferredRows, row + 1);
    inferredCols = Math.max(inferredCols, col + 1);
  });

  const rawRows = Array.isArray(parsed) ? undefined : parsed?.rows ?? parsed?.matrix?.rows;
  const rawCols = Array.isArray(parsed) ? undefined : parsed?.cols ?? parsed?.matrix?.cols;
  const rows = rawRows == null ? inferredRows : Number(rawRows);
  const cols = rawCols == null ? inferredCols : Number(rawCols);
  if (!Number.isInteger(rows) || rows <= 0 || !Number.isInteger(cols) || cols <= 0) {
    throw new Error(`${label}推导出的矩阵尺寸无效`);
  }
  if (rows < inferredRows || cols < inferredCols) {
    throw new Error(`${label}中的矩阵尺寸无法容纳全部坐标`);
  }

  const extra = Array.isArray(parsed) ? {} : { ...parsed };
  delete extra.rows;
  delete extra.cols;
  delete extra.matrix;
  delete extra.points;
  return {
    definition: {
      ...extra,
      matrix: {
        ...(Array.isArray(parsed) ? {} : parsed.matrix),
        rows,
        cols,
      },
      points,
    },
    rows,
    cols,
    pointCount: points.length,
    matrixCellCount: rows * cols,
  };
}

/**
 * 校验传感器物理坐标矩阵并计算真实边界。
 *
 * @param {string | object | number[][][]} value 坐标 JSON 文本或对象。
 * @param {string} label 错误提示中的字段名称。
 * @returns {{ definition: object, rows: number, cols: number, pointCount: number, bounds: object }}
 */
function normalizeCoordinateMapDefinition(value, label = '形状坐标') {
  const parsed = typeof value === 'string' ? parseDefinition(value, label) : value;
  const coordinates = Array.isArray(parsed) ? parsed : parsed?.coordinates;
  if (!Array.isArray(coordinates) || !coordinates.length || !Array.isArray(coordinates[0]) || !coordinates[0].length) {
    throw new Error(`${label}必须是 rows × cols × [x, y] 数组`);
  }

  const rows = coordinates.length;
  const cols = coordinates[0].length;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const normalizedCoordinates = coordinates.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== cols) {
      throw new Error(`${label}第 ${rowIndex + 1} 行必须包含 ${cols} 个坐标`);
    }
    return row.map((coordinate, colIndex) => {
      if (!Array.isArray(coordinate) || coordinate.length < 2) {
        throw new Error(`${label}[${rowIndex}][${colIndex}] 必须是 [x, y]`);
      }
      const x = Number(coordinate[0]);
      const y = Number(coordinate[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`${label}[${rowIndex}][${colIndex}] 必须是有限数值`);
      }
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      return [x, y];
    });
  });
  if (maxX === minX || maxY === minY) {
    throw new Error(`${label}必须具有非零宽度和高度`);
  }

  const extra = Array.isArray(parsed) ? {} : { ...parsed };
  delete extra.matrix;
  delete extra.coordinates;
  delete extra.bounds;
  delete extra.rows;
  delete extra.cols;
  delete extra.pointCount;
  return {
    definition: {
      ...extra,
      matrix: { rows, cols },
      coordinates: normalizedCoordinates,
    },
    rows,
    cols,
    pointCount: rows * cols,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}

function createIdentityPointOrder(rows, cols) {
  return {
    matrix: { rows, cols },
    points: Array.from({ length: rows * cols }, (_, index) => [
      Math.floor(index / cols),
      index % cols,
    ]),
  };
}

function getFormPointCount(form) {
  try {
    return normalizePointOrderDefinition(form.getFieldValue('pointOrderJson')).pointCount;
  } catch {
    try {
      return normalizeCoordinateMapDefinition(form.getFieldValue('coordinateMapJson')).pointCount;
    } catch {
      return Number(form.getFieldValue('valueCount')) || 0;
    }
  }
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null));
}

/**
 * 渲染模板缩略图。
 * 使用固定模拟数据展示热力图或数字矩阵的视觉差异，不参与真实传感器计算。
 */
function DisplayTemplatePreview({ rendererId = 'heatmap', large = false }) {
  const isMatrix = rendererId === 'matrix' || rendererId === 'numMatrix';
  const isRaw = rendererId === 'raw2d';
  const isPointGrid = rendererId === 'pointGrid';
  const cells = Array.from({ length: 48 }, (_, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    const distance = Math.hypot(col - 3.5, row - 2.5);
    const level = Math.max(0, Math.min(5, 5 - Math.floor(distance * 1.35)));
    const value = level ? level * 18 + ((row * 7 + col * 3) % 9) : 0;
    return { index, level, value };
  });

  return (
    <div className={`display-template-preview is-${rendererId}${large ? ' is-large' : ''}`} aria-hidden="true">
      <div className="template-preview-toolbar">
        <i />
        <i />
        <i />
      </div>
      <div className="template-preview-body">
        <div className="template-preview-grid">
          {cells.map((cell) => (
            <span
              className={`preview-cell level-${cell.level}`}
              key={cell.index}
            >
              {isMatrix ? cell.value : null}
              {isPointGrid ? <b style={{ height: `${4 + cell.level * 3}px` }} /> : null}
              {isRaw ? <i /> : null}
            </span>
          ))}
        </div>
        <div className="template-preview-metrics">
          <span><i />压力</span>
          <strong>{isMatrix ? '72.4' : '86.2'}</strong>
          <span><i />面积</span>
          <strong>{isRaw ? '128' : '214'}</strong>
          <b />
        </div>
      </div>
    </div>
  );
}

/**
 * 从经典串口模板中提取用户最需要核对的参数。
 */
function getSerialTemplateFacts(template = {}) {
  const defaults = template.defaults || {};
  return [
    defaults.baudRate ? `${Number(defaults.baudRate).toLocaleString()} baud` : '自定义波特率',
    defaults.framingType === 'fixedLength' ? '固定长度' : '分隔符分帧',
    `${defaults.dataBits || 8} Bit`,
  ];
}

function inferSerialTemplate(manifest = {}) {
  if (manifest.metadata?.builder?.serialTemplate) {
    return manifest.metadata.builder.serialTemplate;
  }
  const protocol = manifest.sensors?.[0]?.protocol || manifest.protocol || {};
  if (protocol.framing?.type === 'fixedLength') {
    return 'pressure-fixed-length';
  }
  return protocol.decoding?.valueType?.includes('16')
    ? 'pressure-adc16-tail'
    : 'pressure-u8-tail';
}

function buildFormValues(editor) {
  const manifest = editor?.manifest || {};
  const declaredSensors = Array.isArray(manifest.sensors) && manifest.sensors.length
    ? manifest.sensors
    : [];
  const primarySensor = declaredSensors[0] || {};
  const manifestPorts = declaredSensors.length
    ? declaredSensors.map((sensor) => sensor.id).filter(Boolean)
    : (manifest.sensor?.ports || ['sit']);
  const manifestPortLabels = {
    ...(manifest.sensor?.portLabels || {}),
    ...Object.fromEntries(declaredSensors
      .filter((sensor) => sensor?.id)
      .map((sensor) => [sensor.id, sensor.label || sensor.id])),
  };
  const primaryProtocol = primarySensor.protocol || manifest.protocol || {};
  const primaryAlgorithm = primarySensor.algorithm || manifest.algorithm || {};
  const algorithmPackageManifest = editor?.definitions?.algorithmPackage || null;
  const display = manifest.display || {};
  const profile = display.profiles?.find((item) => item.id === display.defaultProfile)
    || display.profiles?.[0]
    || {};
  const algorithmData = editor?.definitions?.algorithmData || {};
  const algorithmMetricDefinitions = new Map(
    (display.sidebar?.algorithmMetrics || []).map((metric) => [metric.id, metric]),
  );
  const algorithmMetricSource = primaryAlgorithm.type === 'json'
    ? (algorithmData.metrics || [])
    : (display.sidebar?.algorithmMetrics?.length
      ? display.sidebar.algorithmMetrics
      : (algorithmPackageManifest?.output?.metricDefinitions || []));
  const algorithmMetrics = algorithmMetricSource.map((metric) => {
    const displayMetric = algorithmMetricDefinitions.get(metric.id) || {};
    return {
      ...metric,
      label: displayMetric.label || metric.label || metric.id,
      unit: displayMetric.unit || metric.unit || '',
      decimals: displayMetric.decimals ?? metric.decimals ?? 2,
      panel: getMetricPanel(metric.id, display.sidebar),
    };
  });
  const selectedVisualizationAlgorithm = display.visualizationAlgorithms
    ?.find((item) => item.id === profile.visualizationAlgorithm) || {};
  const algorithmType = primaryAlgorithm.type || 'none';
  const isCodeAlgorithm = algorithmType === 'js' || algorithmType === 'python';
  const matrixTransform = display.matrixTransform || { type: 'none', factor: 1 };
  let pointOrderInfo = null;
  try {
    if (editor?.definitions?.pointOrder) {
      pointOrderInfo = normalizePointOrderDefinition(editor.definitions.pointOrder);
    }
  } catch {
    pointOrderInfo = null;
  }
  let coordinateMapInfo = null;
  try {
    if (editor?.definitions?.coordinateMap) {
      coordinateMapInfo = normalizeCoordinateMapDefinition(editor.definitions.coordinateMap);
    }
  } catch {
    coordinateMapInfo = null;
  }
  return {
    ...DEFAULT_VALUES,
    id: manifest.id || '',
    name: manifest.name || '',
    version: manifest.version || '1.0.0',
    sensorType: primarySensor.type || manifest.sensor?.type || '',
    serialTemplate: inferSerialTemplate(manifest),
    displayTemplate: manifest.metadata?.builder?.displayTemplate
      || inferMatrixDisplayModeId(profile.renderer),
    ports: manifestPorts,
    portLabels: buildPortLabels(manifestPorts, manifestPortLabels),
    transportType: manifest.metadata?.builder?.transportType || 'binary',
    baudRate: primaryProtocol.baudRate || 1000000,
    framingType: primaryProtocol.framing?.type || 'fixedLength',
    frameLength: primaryProtocol.framing?.frameLength || 1024,
    delimiter: formatByteSequence(primaryProtocol.framing?.delimiter),
    includeDelimiter: primaryProtocol.framing?.includeDelimiter === true,
    dataBits: primaryProtocol.decoding?.valueType?.includes('16') ? 12 : 8,
    valueType: primaryProtocol.decoding?.valueType || 'uint8',
    byteOffset: primaryProtocol.decoding?.byteOffset || 0,
    // 协议点数描述线上帧，几何点数描述如何展示；两者不同时必须保留协议真值。
    valueCount: primaryProtocol.decoding?.valueCount || pointOrderInfo?.pointCount || null,
    validationHeader: formatByteSequence(primaryProtocol.validation?.header),
    validationHeaderOffset: primaryProtocol.validation?.headerOffset ?? 0,
    checksumType: primaryProtocol.validation?.checksum?.type || 'none',
    checksumByteOffset: primaryProtocol.validation?.checksum?.byteOffset ?? -1,
    checksumRangeExplicit: Array.isArray(primaryProtocol.validation?.checksum?.range),
    checksumRangeStart: primaryProtocol.validation?.checksum?.range?.[0] ?? 0,
    checksumRangeEnd: primaryProtocol.validation?.checksum?.range?.[1] ?? -1,
    lineOrderMode: manifest.metadata?.builder?.lineOrderMode
      || (editor?.definitions?.lineOrder ? 'custom' : 'identity'),
    lineOrderJson: editor?.definitions?.lineOrder ? JSON.stringify(editor.definitions.lineOrder, null, 2) : '',
    pointOrderJson: pointOrderInfo ? JSON.stringify(pointOrderInfo.definition, null, 2) : '',
    coordinateMapJson: coordinateMapInfo ? JSON.stringify(coordinateMapInfo.definition, null, 2) : '',
    backendAlgorithm: algorithmPackageManifest ? 'package' : (isCodeAlgorithm ? 'code' : algorithmType),
    algorithmPackageId: algorithmPackageManifest?.id || '',
    algorithmPackageManifest,
    algorithmLanguage: algorithmType === 'python' ? 'python' : 'js',
    algorithmSource: editor?.definitions?.algorithmSource || '',
    algorithmTimeoutMs: primaryAlgorithm.timeoutMs || 1000,
    algorithmMetrics,
    scale: algorithmData.scale ?? 1,
    offset: algorithmData.offset ?? 0,
    min: algorithmData.min,
    max: algorithmData.max,
    zeroBelow: algorithmData.zeroBelow ?? 0,
    rendererId: profile.renderer || display.renderers?.[0]?.id || 'heatmap',
    visualizationAlgorithmId: profile.visualizationAlgorithm || 'identity',
    normalizeMax: selectedVisualizationAlgorithm.options?.max ?? 100,
    threshold: selectedVisualizationAlgorithm.options?.threshold ?? 20,
    smoothRadius: selectedVisualizationAlgorithm.options?.radius ?? 1,
    matrixTransformType: matrixTransform.type || 'none',
    matrixTransformFactor: matrixTransform.factor ?? 1,
    profileLabel: profile.label || '默认方案',
    // display.canvas 是可选段：老 manifest 没有它，就用顶层 widgets 反推一份等价配置。
    canvasConfig: display.canvas?.widgets?.length
      ? {
        colormap: display.canvas.colormap || { id: DEFAULT_COLORMAP_ID },
        overlays: display.canvas.overlays || [],
        widgets: display.canvas.widgets,
      }
      : {
        colormap: display.canvas?.colormap || { id: DEFAULT_COLORMAP_ID },
        overlays: display.canvas?.overlays || [],
        widgets: display.widgets?.length
          ? display.widgets
          : buildDefaultCanvasConfig({
            rendererId: profile.renderer || 'heatmap',
            source: `${manifest.sensor?.ports?.[0] || 'sit'}Data`,
          }).widgets,
      },
    showPressurePanel: display.sidebar?.pressure?.visible ?? true,
    pressurePanelTitle: display.sidebar?.pressure?.title || 'Pressure Data',
    primaryMetric: display.sidebar?.pressure?.primaryMetric || 'totalPressure',
    pressureMetrics: display.sidebar?.pressure?.metrics || ['averagePressure', 'maxPressure', 'totalPressure'],
    showAreaPanel: display.sidebar?.area?.visible ?? true,
    areaPanelTitle: display.sidebar?.area?.title || 'Pressure Area',
    areaMetrics: display.sidebar?.area?.metrics || ['activePoints', 'area'],
    activeThreshold: display.sidebar?.area?.threshold ?? 0,
    pointArea: display.sidebar?.area?.pointArea ?? 2.1,
    areaUnit: display.sidebar?.area?.unit || 'cm²',
    runtimeMode: manifest.metadata?.runtimeMode || 'parallel',
  };
}

function buildSensorFormDrafts(editor) {
  const manifest = editor?.manifest || {};
  const builderMetadata = manifest.metadata?.builder || {};
  const perSensorSettings = builderMetadata.sensors || {};
  return buildBuilderSensorDrafts(editor).map((draft) => {
    const sensor = draft.sensor || {};
    const settings = perSensorSettings[draft.id] || {};
    const inferredLineOrderMode = draft.definitions?.lineOrder ? 'custom' : 'identity';
    const sensorEditor = {
      manifest: {
        ...manifest,
        sensors: [sensor],
        sensor: {
          ...(manifest.sensor || {}),
          type: sensor.type,
          matrix: sensor.matrix,
          ports: [sensor.id],
          portLabels: { [sensor.id]: sensor.label || sensor.id },
        },
        files: sensor.files,
        protocol: sensor.protocol,
        algorithm: sensor.algorithm,
        metadata: {
          ...(manifest.metadata || {}),
          builder: {
            ...builderMetadata,
            serialTemplate: settings.serialTemplate || inferSerialTemplate({ sensors: [sensor] }),
            transportType: settings.transportType
              || (draft.id === manifest.sensors?.[0]?.id ? builderMetadata.transportType : 'binary'),
            lineOrderMode: settings.lineOrderMode || inferredLineOrderMode,
          },
        },
      },
      definitions: draft.definitions,
    };
    return {
      ...draft,
      values: pickSensorFormValues({
        ...buildFormValues(sensorEditor),
        sensorLabel: sensor.label || sensor.id,
        outputChannel: sensor.outputChannel || sensor.id,
        stored: sensor.stored !== false,
        sensorType: sensor.type || '',
      }),
    };
  });
}

function updateSensorDraftValues(drafts, sensorId, values = {}) {
  if (!sensorId) return drafts;
  const nextValues = pickSensorFormValues(values);
  return (Array.isArray(drafts) ? drafts : []).map((draft) => {
    if (draft.id !== sensorId) return draft;
    return {
      ...draft,
      sensor: {
        ...(draft.sensor || {}),
        id: sensorId,
        label: String(nextValues.sensorLabel || sensorId).trim() || sensorId,
        outputChannel: String(nextValues.outputChannel || sensorId).trim() || sensorId,
        type: String(nextValues.sensorType || draft.sensor?.type || '').trim(),
        stored: nextValues.stored !== false,
      },
      values: nextValues,
    };
  });
}

function createSensorDraft(sensorId, sourceValues = {}, sourceDraft = null) {
  const id = String(sensorId || '').trim();
  const values = {
    ...pickSensorFormValues({ ...DEFAULT_VALUES, ...sourceValues }),
    sensorLabel: sourceValues.portLabels?.[id] || SERIAL_ROLE_LABELS[id] || id,
    outputChannel: id,
    stored: true,
  };
  return {
    id,
    isNew: true,
    sensor: {
      ...(cloneBuilderValue(sourceDraft?.sensor) || {}),
      id,
      label: values.sensorLabel,
      outputChannel: id,
      type: values.sensorType || sourceDraft?.sensor?.type || '',
      stored: true,
    },
    definitions: cloneBuilderValue(sourceDraft?.definitions || {}),
    values,
  };
}

function compileSensorDraftForSave(draft, {
  multiple = false,
  algorithmPackagesById = new Map(),
} = {}) {
  const values = draft?.values || {};
  const sensorId = String(draft?.id || '').trim();
  const normalizedCoordinateMap = values.coordinateMapJson
    ? normalizeCoordinateMapDefinition(values.coordinateMapJson, `${sensorId} 形状坐标`)
    : null;
  let normalizedPointOrder = values.pointOrderJson
    ? normalizePointOrderDefinition(values.pointOrderJson, `${sensorId} 点位顺序`)
    : null;
  if (!normalizedPointOrder && normalizedCoordinateMap) {
    normalizedPointOrder = normalizePointOrderDefinition(
      createIdentityPointOrder(normalizedCoordinateMap.rows, normalizedCoordinateMap.cols),
      `${sensorId} 点位顺序`,
    );
  }
  if (!normalizedPointOrder) {
    throw new Error(`传感器 ${sensorId} 尚未导入形状坐标`);
  }
  if (normalizedCoordinateMap && (
    normalizedCoordinateMap.rows !== normalizedPointOrder.rows
    || normalizedCoordinateMap.cols !== normalizedPointOrder.cols
  )) {
    throw new Error(`传感器 ${sensorId} 的形状坐标尺寸必须与点位顺序尺寸一致`);
  }

  const normalizedMatrix = normalizedCoordinateMap || normalizedPointOrder;
  const previousSensor = cloneBuilderValue(draft.sensor || {});
  const previousFiles = previousSensor.files || {};
  const defaultPath = (fileName) => buildBuilderSensorFilePath(sensorId, fileName, { multiple });
  const files = {
    ...previousFiles,
    lineOrder: draft.isNew
      ? defaultPath('line-order.json')
      : (previousFiles.lineOrder || defaultPath('line-order.json')),
    pointOrder: draft.isNew
      ? defaultPath('point-order.json')
      : (previousFiles.pointOrder || defaultPath('point-order.json')),
  };
  if (normalizedCoordinateMap) {
    files.coordinateMap = draft.isNew
      ? defaultPath('coordinate-map.json')
      : (previousFiles.coordinateMap || defaultPath('coordinate-map.json'));
  } else {
    delete files.coordinateMap;
  }

  const hasChecksum = values.checksumType && values.checksumType !== 'none';
  const trimmedHeader = String(values.validationHeader || '').trim();
  const frameValidation = trimmedHeader || hasChecksum
    ? {
      ...(trimmedHeader
        ? {
          header: trimmedHeader,
          headerOffset: Number(values.validationHeaderOffset) || 0,
        }
        : {}),
      ...(hasChecksum
        ? {
          checksum: {
            type: values.checksumType,
            byteOffset: values.checksumByteOffset ?? -1,
            ...(values.checksumRangeExplicit === false
              ? {}
              : { range: [values.checksumRangeStart ?? 0, values.checksumRangeEnd ?? -1] }),
          },
        }
        : {}),
    }
    : null;
  const protocol = {
    ...(previousSensor.protocol || {}),
    baudRate: values.baudRate,
    framing: values.framingType === 'delimiter'
      ? {
        type: 'delimiter',
        delimiter: values.delimiter,
        includeDelimiter: values.includeDelimiter === true,
      }
      : { type: 'fixedLength', frameLength: values.frameLength },
    decoding: {
      ...(previousSensor.protocol?.decoding || {}),
      valueType: values.valueType,
      byteOffset: values.byteOffset,
      valueCount: Number(values.valueCount) || normalizedPointOrder.pointCount,
    },
  };
  if (frameValidation) protocol.validation = frameValidation;
  else delete protocol.validation;

  const selectedPackage = values.backendAlgorithm === 'package'
    ? algorithmPackagesById.get(values.algorithmPackageId)
    : null;
  const algorithmPackageManifest = selectedPackage?.packageManifest
    || values.algorithmPackageManifest
    || null;
  const algorithmPackageSource = selectedPackage?.algorithmSource
    || values.algorithmSource
    || '';
  if (values.backendAlgorithm === 'package' && !algorithmPackageManifest) {
    throw new Error(`传感器 ${sensorId} 尚未选择已注册算法包`);
  }
  const compatibleTotals = selectedPackage?.compatibility?.matrixTotals;
  const matrixTotal = normalizedMatrix.rows * normalizedMatrix.cols;
  if (Array.isArray(compatibleTotals) && compatibleTotals.length
    && !compatibleTotals.includes(matrixTotal)) {
    throw new Error(
      `算法包 ${selectedPackage.name} 仅支持 ${compatibleTotals.join('/')} 点，`
      + `传感器 ${sensorId} 当前为 ${matrixTotal} 点`,
    );
  }
  const algorithmType = values.backendAlgorithm === 'package'
    ? 'python'
    : values.backendAlgorithm === 'code'
      ? values.algorithmLanguage
      : values.backendAlgorithm;
  const previousAlgorithmType = previousSensor.algorithm?.type || 'none';
  let algorithm = { ...(previousSensor.algorithm || {}), type: algorithmType || 'none' };
  if (algorithmType === 'json') {
    algorithm = {
      ...algorithm,
      dataFile: draft.isNew || previousAlgorithmType !== 'json'
        ? defaultPath('algorithm-data.json')
        : (algorithm.dataFile || defaultPath('algorithm-data.json')),
      input: { ...(algorithm.input || {}), source: 'rawData' },
      timeoutMs: values.algorithmTimeoutMs,
    };
    delete algorithm.entry;
  } else if (values.backendAlgorithm === 'package') {
    algorithm = {
      ...algorithm,
      type: 'python',
      packageManifest: draft.isNew || !previousSensor.algorithm?.packageManifest
        ? defaultPath('algorithm-package.json')
        : previousSensor.algorithm.packageManifest,
      apiVersion: Number(algorithmPackageManifest.apiVersion || 2),
      input: { ...(algorithm.input || {}), source: 'rawData' },
      timeoutMs: values.algorithmTimeoutMs,
    };
    delete algorithm.entry;
    delete algorithm.dataFile;
  } else if (algorithmType === 'js' || algorithmType === 'python') {
    const entryName = algorithmType === 'python' ? 'algorithm.py' : 'algorithm.js';
    algorithm = {
      ...algorithm,
      entry: draft.isNew || previousAlgorithmType !== algorithmType
        ? defaultPath(entryName)
        : (algorithm.entry || defaultPath(entryName)),
      input: { ...(algorithm.input || {}), source: 'rawData' },
      timeoutMs: values.algorithmTimeoutMs,
    };
    delete algorithm.dataFile;
    delete algorithm.packageManifest;
  } else {
    algorithm = { type: 'none' };
  }

  const configuredAlgorithmMetrics = (values.algorithmMetrics || [])
    .filter((metric) => metric?.id)
    .map((metric) => ({ ...metric, id: metric.id.trim() }));
  const definitions = {
    lineOrder: values.lineOrderMode === 'custom'
      ? parseDefinition(values.lineOrderJson, `${sensorId} 线序`)
      : { order: Array.from({ length: normalizedPointOrder.pointCount }, (_, index) => index + 1) },
    pointOrder: normalizedPointOrder.definition,
    ...(normalizedCoordinateMap ? { coordinateMap: normalizedCoordinateMap.definition } : {}),
  };
  if (algorithmType === 'json') {
    definitions.algorithmData = compactObject({
      scale: values.scale,
      offset: values.offset,
      min: values.min,
      max: values.max,
      zeroBelow: values.zeroBelow,
      metrics: configuredAlgorithmMetrics.map((metric) => compactObject({
        id: metric.id,
        operation: metric.operation,
        threshold: metric.threshold,
        scale: metric.scale,
        offset: metric.offset,
      })),
    });
  }
  if (values.backendAlgorithm === 'package') {
    definitions.algorithmPackage = algorithmPackageManifest;
    definitions.algorithmSource = algorithmPackageSource;
  } else if (algorithmType === 'js' || algorithmType === 'python') {
    definitions.algorithmSource = values.algorithmSource;
  }

  return {
    sensor: {
      ...previousSensor,
      id: sensorId,
      label: String(values.sensorLabel || sensorId).trim() || sensorId,
      outputChannel: String(values.outputChannel || '').trim(),
      type: String(values.sensorType || '').trim(),
      matrix: { rows: normalizedMatrix.rows, cols: normalizedMatrix.cols },
      files,
      protocol,
      algorithm,
      stored: values.stored !== false,
    },
    definitions,
    normalizedCoordinateMap,
    normalizedPointOrder,
    configuredAlgorithmMetrics,
    values,
  };
}

export default function DisplaySystemBuilder({ embedded = false, onActivated, onClose }) {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const [catalog, setCatalog] = useState(null);
  const [agentRendererRegistry, setAgentRendererRegistry] = useState({
    status: 'loading',
    apps: [],
    error: '',
  });
  const [systems, setSystems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editorAccess, setEditorAccess] = useState(null);
  const [loadedChartCards, setLoadedChartCards] = useState([]);
  const [activeStep, setActiveStep] = useState('connection');
  const [sensorDrafts, setSensorDrafts] = useState([]);
  const [activeSensorId, setActiveSensorId] = useState(null);
  const [serialPorts, setSerialPorts] = useState([]);
  const [serialPortsLoading, setSerialPortsLoading] = useState(false);
  const [serialPortsError, setSerialPortsError] = useState('');
  const [probePortBySensor, setProbePortBySensor] = useState({});
  const [protocolDetectionBySensor, setProtocolDetectionBySensor] = useState({});
  const activeSensorIdRef = useRef(null);
  const probePortBySensorRef = useRef({});
  const protocolProbeGenerationRef = useRef(0);
  const systemId = Form.useWatch('id', form);
  const systemName = Form.useWatch('name', form);
  const sensorType = Form.useWatch('sensorType', form);
  const framingType = Form.useWatch('framingType', form);
  const checksumType = Form.useWatch('checksumType', form);
  const delimiter = Form.useWatch('delimiter', form);
  const frameLength = Form.useWatch('frameLength', form);
  const baudRate = Form.useWatch('baudRate', form);
  const dataBits = Form.useWatch('dataBits', form);
  const valueCount = Form.useWatch('valueCount', form);
  const ports = Form.useWatch('ports', form);
  const createPorts = Form.useWatch('ports', createForm);
  const lineOrderMode = Form.useWatch('lineOrderMode', form);
  const pointOrderJson = Form.useWatch('pointOrderJson', form);
  const coordinateMapJson = Form.useWatch('coordinateMapJson', form);
  const backendAlgorithm = Form.useWatch('backendAlgorithm', form);
  const algorithmPackageId = Form.useWatch('algorithmPackageId', form);
  const algorithmLanguage = Form.useWatch('algorithmLanguage', form);
  const algorithmMetrics = Form.useWatch('algorithmMetrics', form);
  const visualizationAlgorithmId = Form.useWatch('visualizationAlgorithmId', form);
  const rendererId = Form.useWatch('rendererId', form);
  const matrixTransformType = Form.useWatch('matrixTransformType', form);
  const matrixTransformFactor = Form.useWatch('matrixTransformFactor', form);
  const serialTemplate = Form.useWatch('serialTemplate', form);
  const displayTemplate = Form.useWatch('displayTemplate', form);
  const showPressurePanel = Form.useWatch('showPressurePanel', form);
  const showAreaPanel = Form.useWatch('showAreaPanel', form);
  const canvasConfig = Form.useWatch('canvasConfig', form);
  const [previewFrames, setPreviewFrames] = useState({});
  const [previewDataMode, setPreviewDataMode] = useState('direction');

  // 实时帧的解包逻辑与 ManifestDisplayRenderer 一致。用户可以显式选择
  // 1..N 方向测试帧或串口实时帧，页面不再暗中切换数据来源。
  const handlePreviewMessage = useCallback((message) => {
    const routedFrames = readManifestChannelFrames(message, systemId);
    if (!routedFrames.length) return;
    setPreviewFrames((current) => routedFrames.reduce(
      (next, frame) => ({ ...next, [frame.channel]: frame.renderValues }),
      current,
    ));
  }, [systemId]);
  useMainWebSocket({ onMessage: handlePreviewMessage });

  useEffect(() => {
    activeSensorIdRef.current = activeSensorId;
  }, [activeSensorId]);

  useEffect(() => () => {
    protocolProbeGenerationRef.current += 1;
    activeSensorIdRef.current = null;
  }, []);

  const loadIndex = useCallback(async () => {
    const [systemsPayload, catalogPayload] = await Promise.all([
      requestJson('/api/display-systems'),
      requestJson('/api/display-systems/catalog'),
    ]);
    setSystems(systemsPayload.displaySystems?.systems || []);
    setCatalog(catalogPayload.catalog || {});
  }, []);

  const loadSerialPorts = useCallback(async () => {
    setSerialPortsLoading(true);
    setSerialPortsError('');
    try {
      const payload = await requestControlApi('/api/serial/ports');
      setSerialPorts(Array.isArray(payload?.ports) ? payload.ports : []);
    } catch (error) {
      setSerialPortsError(error.message || '串口列表读取失败');
    } finally {
      setSerialPortsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIndex()
      .catch((error) => message.error(error.message))
      .finally(() => setLoading(false));
  }, [loadIndex]);

  useEffect(() => {
    let active = true;
    listAgentRendererApps()
      .then((apps) => {
        if (active) setAgentRendererRegistry({ status: 'ready', apps, error: '' });
      })
      .catch((error) => {
        if (active) {
          setAgentRendererRegistry({
            status: 'error',
            apps: [],
            error: error.message || 'Agent 渲染器目录读取失败',
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    loadSerialPorts();
  }, [loadSerialPorts]);

  const resetProtocolProbeUi = useCallback(() => {
    protocolProbeGenerationRef.current += 1;
    probePortBySensorRef.current = {};
    setProbePortBySensor({});
    setProtocolDetectionBySensor({});
  }, []);

  const startNew = useCallback(() => {
    resetProtocolProbeUi();
    createForm.resetFields();
    createForm.setFieldsValue({
      id: '',
      name: '',
      sensorType: '',
      ports: ['sit'],
    });
    setEditorAccess(null);
    setLoadedChartCards([]);
    setCreateModalOpen(true);
  }, [createForm, resetProtocolProbeUi]);

  const createDraft = useCallback(async () => {
    try {
      const values = await createForm.validateFields();
      const duplicateId = systems.some((system) => system.id === values.id);
      if (duplicateId) {
        createForm.setFields([{ name: 'id', errors: ['系统 ID 已存在，请换一个'] }]);
        return;
      }
      const duplicateSensorType = systems.some((system) => system.sensorType === values.sensorType);
      if (duplicateSensorType) {
        createForm.setFields([{ name: 'sensorType', errors: ['传感器类型已被其他配置使用'] }]);
        return;
      }

      setSelectedId(null);
      setEditorAccess({ editable: true, origin: 'user' });
      setLoadedChartCards([]);
      setActiveStep('connection');
      setPreviewDataMode('direction');
      const nextFormValues = {
        ...DEFAULT_VALUES,
        ...values,
        portLabels: buildPortLabels(values.ports, values.portLabels),
      };
      const nextDrafts = normalizeBuilderSensorIds(values.ports).map((sensorId) => (
        createSensorDraft(sensorId, nextFormValues)
      ));
      setSensorDrafts(nextDrafts);
      setActiveSensorId(nextDrafts[0]?.id || null);
      form.resetFields();
      form.setFieldsValue({ ...nextFormValues, ...(nextDrafts[0]?.values || {}) });
      setCreateModalOpen(false);
      message.success('已创建配置草稿，请导入传感器形状坐标文件后继续配置');
    } catch (error) {
      if (!error?.errorFields) message.error(error.message);
    }
  }, [createForm, form, systems]);

  const editSystem = useCallback(async (id) => {
    resetProtocolProbeUi();
    setLoading(true);
    try {
      const payload = await requestJson(`/api/display-systems/${encodeURIComponent(id)}/editor`);
      setSelectedId(id);
      setEditorAccess({
        editable: payload.editor?.editable === true,
        origin: payload.editor?.origin || 'system',
      });
      setLoadedChartCards(payload.editor?.manifest?.display?.chartCards || []);
      setActiveStep('connection');
      setPreviewDataMode('direction');
      const nextDrafts = buildSensorFormDrafts(payload.editor);
      const nextFormValues = buildFormValues(payload.editor);
      setSensorDrafts(nextDrafts);
      setActiveSensorId(nextDrafts[0]?.id || null);
      form.resetFields();
      form.setFieldsValue({ ...nextFormValues, ...(nextDrafts[0]?.values || {}) });
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [form, resetProtocolProbeUi]);

  const rendererOptions = useMemo(
    () => [
      ...MATRIX_DISPLAY_MODES.map((item) => ({
        value: item.rendererId,
        label: item.label,
      })),
      ...agentRendererRegistry.apps.filter((app) => app.rendererId).map((app) => ({
        value: app.rendererId,
        label: `Agent · ${app.label}`,
      })),
    ],
    [agentRendererRegistry.apps],
  );
  const visualizationOptions = useMemo(
    () => (catalog?.visualizationAlgorithms || []).map((item) => ({ value: item.id, label: item.label })),
    [catalog],
  );
  const sidebarMetricOptions = useMemo(() => [
    ...SIDEBAR_METRIC_OPTIONS,
    ...(algorithmMetrics || [])
      .filter((metric) => metric?.id)
      .map((metric) => ({
        value: `algorithm.${metric.id}`,
        label: metric.label || metric.id,
      })),
  ], [algorithmMetrics]);
  const selectedSerialTemplate = useMemo(
    () => catalog?.serialTemplates?.find((item) => item.id === serialTemplate),
    [catalog, serialTemplate],
  );
  const detectableProtocolCandidateIds = useMemo(
    () => getDetectableProtocolCandidateIds(catalog?.serialTemplates || []),
    [catalog],
  );
  const serialPortOptions = useMemo(
    () => buildSerialPortOptions(serialPorts),
    [serialPorts],
  );
  const selectedProbePortPath = activeSensorId
    ? (probePortBySensor[activeSensorId] || '')
    : '';
  const activeProtocolDetection = useMemo(
    () => (activeSensorId
      ? (protocolDetectionBySensor[activeSensorId] || EMPTY_PROTOCOL_DETECTION)
      : EMPTY_PROTOCOL_DETECTION),
    [activeSensorId, protocolDetectionBySensor],
  );
  const protocolDetectionInProgress = useMemo(
    () => Object.values(protocolDetectionBySensor)
      .some((state) => state?.status === 'detecting'),
    [protocolDetectionBySensor],
  );
  const selectedDisplayTemplate = useMemo(
    () => MATRIX_DISPLAY_MODES.find((item) => item.id === displayTemplate)
      || catalog?.displayTemplates?.find((item) => item.id === displayTemplate),
    [catalog, displayTemplate],
  );
  const algorithmModeOptions = useMemo(
    () => (catalog?.algorithmModes || [
      { id: 'none', label: '不处理' },
      { id: 'json', label: '参数化数值处理' },
      { id: 'code', label: '自定义代码函数' },
    ]).map((item) => ({ value: item.id, label: item.label })),
    [catalog],
  );
  const algorithmPackageOptions = useMemo(
    () => (catalog?.algorithmPackages || []).map((item) => ({
      value: item.id,
      label: `${item.name} · v${item.version}`,
    })),
    [catalog],
  );
  const algorithmPackagesById = useMemo(
    () => new Map((catalog?.algorithmPackages || []).map((item) => [item.id, item])),
    [catalog],
  );
  const selectedAlgorithmPackage = useMemo(
    () => algorithmPackagesById.get(algorithmPackageId) || null,
    [algorithmPackageId, algorithmPackagesById],
  );
  const codeLanguageOptions = useMemo(
    () => (catalog?.codeLanguages || []).map((item) => ({
      value: item.id,
      label: item.label,
    })),
    [catalog],
  );
  const pointOrderInfo = useMemo(() => {
    if (!pointOrderJson) return null;
    try {
      return normalizePointOrderDefinition(pointOrderJson);
    } catch {
      return null;
    }
  }, [pointOrderJson]);
  const coordinateMapInfo = useMemo(() => {
    if (!coordinateMapJson) return null;
    try {
      return normalizeCoordinateMapDefinition(coordinateMapJson);
    } catch {
      return null;
    }
  }, [coordinateMapJson]);
  const matrixInfo = coordinateMapInfo || pointOrderInfo;
  const pointCount = pointOrderInfo?.pointCount || coordinateMapInfo?.pointCount || 0;
  const matrixRenderers = useMemo(
    () => createMatrixDisplayRenderers({
      matrix: matrixInfo
        ? { rows: matrixInfo.rows, cols: matrixInfo.cols }
        : { rows: 1, cols: Math.max(pointCount, 1) },
      coordinateMap: coordinateMapInfo?.definition,
    }),
    [coordinateMapInfo, matrixInfo, pointCount],
  );
  const availableRenderers = useMemo(() => [
    ...matrixRenderers,
    ...agentRendererRegistry.apps.filter((app) => app.rendererId).map((app) => ({
      id: app.rendererId,
      type: app.rendererId,
      label: `Agent · ${app.label}`,
      params: {},
    })),
  ], [agentRendererRegistry.apps, matrixRenderers]);
  const agentRendererById = useMemo(
    () => new Map(agentRendererRegistry.apps
      .filter((app) => app.rendererId)
      .map((app) => [app.rendererId, app])),
    [agentRendererRegistry.apps],
  );
  const selectedRendererDefinition = useMemo(
    () => availableRenderers.find((item) => item.id === rendererId),
    [availableRenderers, rendererId],
  );
  const renderMatrixInfo = useMemo(() => {
    if (!matrixInfo) return null;
    const factor = Number(matrixTransformFactor) || 1;
    if (matrixTransformType === 'interpolate') {
      return {
        rows: Math.max(1, Math.round(matrixInfo.rows * factor)),
        cols: Math.max(1, Math.round(matrixInfo.cols * factor)),
      };
    }
    if (matrixTransformType === 'downsample') {
      return {
        rows: Math.max(1, Math.round(matrixInfo.rows * factor)),
        cols: Math.max(1, Math.round(matrixInfo.cols * factor)),
      };
    }
    return { rows: matrixInfo.rows, cols: matrixInfo.cols };
  }, [matrixInfo, matrixTransformFactor, matrixTransformType]);
  const previewSensorDefinitions = useMemo(() => {
    const draftById = new Map(sensorDrafts.map((draft) => [draft.id, draft]));
    return normalizeBuilderSensorIds(ports || [], { fallback: false }).flatMap((sensorId) => {
      const draft = draftById.get(sensorId);
      if (!draft) return [];
      const sensorValues = draft.id === activeSensorId
        ? { ...draft.values, pointOrderJson, coordinateMapJson }
        : draft.values;
      let sensorPointOrder = null;
      let sensorCoordinateMap = null;
      try {
        if (sensorValues.pointOrderJson) {
          sensorPointOrder = normalizePointOrderDefinition(sensorValues.pointOrderJson);
        }
      } catch {
        sensorPointOrder = null;
      }
      try {
        if (sensorValues.coordinateMapJson) {
          sensorCoordinateMap = normalizeCoordinateMapDefinition(sensorValues.coordinateMapJson);
        }
      } catch {
        sensorCoordinateMap = null;
      }
      const geometry = sensorCoordinateMap || sensorPointOrder;
      return [{
        ...(draft.sensor || {}),
        id: sensorId,
        label: sensorValues.sensorLabel || draft.sensor?.label || sensorId,
        outputChannel: sensorValues.outputChannel || draft.sensor?.outputChannel || sensorId,
        matrix: geometry
          ? { rows: geometry.rows, cols: geometry.cols }
          : draft.sensor?.matrix,
        coordinateMap: sensorCoordinateMap?.definition || null,
        previewPointCount: sensorPointOrder?.pointCount
          || sensorCoordinateMap?.pointCount
          || (Number(draft.sensor?.matrix?.rows || 0) * Number(draft.sensor?.matrix?.cols || 0)),
      }];
    });
  }, [activeSensorId, coordinateMapJson, pointOrderJson, ports, sensorDrafts]);
  // 预览跟随当前传感器页签；机器 id 和 outputChannel 可以不同。
  const previewSensor = previewSensorDefinitions.find((sensor) => sensor.id === activeSensorId)
    || previewSensorDefinitions[0];
  const previewChannel = previewSensor?.outputChannel || activeSensorId || 'sit';
  const realtimePreviewValues = useMemo(
    () => previewFrames[previewChannel] || [],
    [previewChannel, previewFrames],
  );
  const directionCheckValues = useMemo(
    () => createDirectionCheckFrame(pointCount),
    [pointCount],
  );
  const previewUsesDirectionData = previewDataMode === 'direction';
  const previewValues = previewUsesDirectionData
    ? directionCheckValues
    : realtimePreviewValues;
  // 每张卡片按自己的 source 选传感器、帧和几何；不能拿当前页签的手形套到座椅卡片。
  const previewCards = useMemo(() => {
    const widgets = canvasConfig?.widgets || [];
    if (!widgets.length || !previewSensorDefinitions.length) return [];
    const matrixTransform = {
      type: matrixTransformType || 'none',
      factor: Number(matrixTransformFactor) || 1,
    };
    const primaryDefinition = {
      sourceMatrix: previewSensorDefinitions[0]?.matrix,
      sourceCoordinateMap: previewSensorDefinitions[0]?.coordinateMap,
    };
    const channels = previewSensorDefinitions.map((sensor) => {
      const outputChannel = sensor.outputChannel || sensor.id;
      const values = previewUsesDirectionData
        ? createDirectionCheckFrame(sensor.previewPointCount || 0)
        : (previewFrames[outputChannel] || previewFrames[sensor.id] || []);
      return {
        displaySystemId: systemId || '',
        sensorId: sensor.id,
        sensorLabel: sensor.label || sensor.id,
        sensorType: sensor.type || sensorType || '',
        outputChannel,
        channelId: systemId && sensor.id ? `${systemId}:${sensor.id}` : sensor.id,
        timestamp: null,
        values,
        rawValues: values,
        matrix: sensor.matrix || { rows: 1, cols: values.length },
        metrics: calculatePressureMetrics(values),
        algorithmMetrics: {},
        serial: null,
      };
    });
    return widgets.flatMap((widget) => {
      const geometry = resolveManifestWidgetGeometry({
        source: widget.source,
        sensors: previewSensorDefinitions,
        definition: primaryDefinition,
        matrixTransform,
      });
      const sourceSensor = geometry.sourceSensor || previewSensorDefinitions[0];
      const sourceChannel = sourceSensor?.outputChannel || sourceSensor?.id || previewChannel;
      const rawValues = previewUsesDirectionData
        ? createDirectionCheckFrame(sourceSensor?.previewPointCount || 0)
        : (previewFrames[sourceChannel] || previewFrames[sourceSensor?.id] || []);
      if (!rawValues.length) return [];
      const sourceMatrix = geometry.sourceMatrix || { rows: 1, cols: rawValues.length };
      const transformed = applyMatrixTransform(rawValues, sourceMatrix, matrixTransform);
      return [{
        widget,
        values: widget.type === 'pressureStats' ? rawValues : transformed.values,
        rawValues,
        matrix: transformed.matrix,
        coordinateMap: geometry.coordinateMap,
        layout: geometry.coordinatePointLayout,
        metrics: calculatePressureMetrics(rawValues),
        channel: sourceChannel,
        sourceSensor,
        channels,
      }];
    });
  }, [
    canvasConfig,
    matrixTransformFactor,
    matrixTransformType,
    previewChannel,
    previewFrames,
    previewSensorDefinitions,
    previewUsesDirectionData,
    sensorType,
    systemId,
  ]);
  const previewColormap = canvasConfig?.colormap || { id: DEFAULT_COLORMAP_ID };
  const previewOverlays = useMemo(
    () => new Set(canvasConfig?.overlays || []),
    [canvasConfig],
  );
  const bytesPerValue = Number(dataBits) === 12 ? 2 : 1;
  const wireValueCount = Number(valueCount) > 0 ? Number(valueCount) : pointCount;
  const payloadBytes = framingType === 'fixedLength'
    ? (Number(frameLength) || wireValueCount * bytesPerValue)
    : wireValueCount * bytesPerValue;
  const configurationSteps = [
    {
      id: 'connection',
      label: '数据接入',
      complete: Boolean(
        ports?.length
        && serialTemplate
        && baudRate
        && (framingType === 'delimiter' ? delimiter : frameLength)
      ),
      detail: selectedSerialTemplate
        ? `${selectedSerialTemplate.label} · ${Number(baudRate || 0).toLocaleString()} baud`
        : '待选择经典配置',
    },
    {
      id: 'mapping',
      label: '传感器映射',
      complete: Boolean(systemId && systemName && sensorType && pointCount),
      detail: matrixInfo
        ? `${matrixInfo.rows} × ${matrixInfo.cols} · ${pointCount} 点`
        : '待导入坐标',
    },
    {
      id: 'render',
      label: '显示验证',
      complete: Boolean(displayTemplate),
      detail: selectedDisplayTemplate?.label || '待选择模板',
    },
  ];
  const completedStepCount = configurationSteps.filter((step) => step.complete).length;
  const activeStepTitle = {
    connection: '串口数据配置',
    mapping: '传感器映射',
    render: '显示验证',
  }[activeStep];
  const activeStepDescription = {
    connection: '选择数据协议并确认串口通信参数',
    mapping: '导入点位坐标并设置数据处理规则',
    render: '选择矩阵展示形式并检查点位方向',
  }[activeStep];

  const importCoordinateMapFile = useCallback(async (file) => {
    try {
      const content = await file.text();
      const coordinateInfo = normalizeCoordinateMapDefinition(content, '形状坐标文件');
      let pointInfo = null;
      try {
        const currentPointInfo = normalizePointOrderDefinition(form.getFieldValue('pointOrderJson'));
        if (currentPointInfo.rows === coordinateInfo.rows && currentPointInfo.cols === coordinateInfo.cols) {
          pointInfo = currentPointInfo;
        }
      } catch {
        pointInfo = null;
      }
      if (!pointInfo) {
        pointInfo = normalizePointOrderDefinition(
          createIdentityPointOrder(coordinateInfo.rows, coordinateInfo.cols),
        );
      }
      const dataBitsValue = Number(form.getFieldValue('dataBits')) || 8;
      const configuredValueCount = Number(form.getFieldValue('valueCount')) || 0;
      const protocolGeometryDefaults = buildProtocolGeometryDefaults({
        valueCount: configuredValueCount,
        frameLength: form.getFieldValue('frameLength'),
        pointCount: pointInfo.pointCount,
        bytesPerValue: dataBitsValue === 12 ? 2 : 1,
        fixedLength: form.getFieldValue('framingType') === 'fixedLength',
      });
      form.setFieldsValue({
        coordinateMapJson: JSON.stringify(coordinateInfo.definition, null, 2),
        pointOrderJson: JSON.stringify(pointInfo.definition, null, 2),
        // valueCount/frameLength 描述线上帧，坐标点数只在协议尚未声明时补默认。
        ...protocolGeometryDefaults,
      });
      const shapeRatio = coordinateInfo.bounds.height >= coordinateInfo.bounds.width
        ? `1:${(coordinateInfo.bounds.height / coordinateInfo.bounds.width).toFixed(2)}`
        : `${(coordinateInfo.bounds.width / coordinateInfo.bounds.height).toFixed(2)}:1`;
      message.success(`已读取 ${coordinateInfo.rows} × ${coordinateInfo.cols} 坐标，共 ${coordinateInfo.pointCount} 个点，形状比例 ${shapeRatio}`);
    } catch (error) {
      message.error(error.message);
    }
    return Upload.LIST_IGNORE;
  }, [form]);

  const readOnly = Boolean(selectedId && editorAccess?.editable === false);
  const configuredSensorIds = useMemo(
    () => normalizeBuilderSensorIds(ports || [], { fallback: false }),
    [ports],
  );
  const configuredSensorDrafts = useMemo(() => {
    const draftById = new Map(sensorDrafts.map((draft) => [draft.id, draft]));
    return configuredSensorIds.map((id) => draftById.get(id)).filter(Boolean);
  }, [configuredSensorIds, sensorDrafts]);
  const configuredSensorPlan = useMemo(() => (configuredSensorIds.length
    ? buildBuilderSensorPlan({
      displaySystemId: systemId,
      ports: configuredSensorIds,
      portLabels: Object.fromEntries(configuredSensorDrafts.map((draft) => [
        draft.id,
        draft.sensor?.label || draft.id,
      ])),
      sensors: configuredSensorDrafts.map((draft) => draft.sensor),
    })
    : []), [configuredSensorDrafts, configuredSensorIds, systemId]);
  const resolveBuilderSourceValue = useCallback((source) => {
    const key = String(source || '').trim();
    const sensor = configuredSensorPlan.find((item) => [
      item.source,
      item.outputChannel,
      item.id,
      item.channelId,
      `${item.id}Data`,
    ].includes(key));
    return sensor?.outputChannel || key;
  }, [configuredSensorPlan]);
  const activeSensorDraft = useMemo(
    () => sensorDrafts.find((draft) => draft.id === activeSensorId) || null,
    [activeSensorId, sensorDrafts],
  );

  const switchActiveSensor = useCallback((nextSensorId) => {
    if (!nextSensorId || nextSensorId === activeSensorId) return;
    protocolProbeGenerationRef.current += 1;
    activeSensorIdRef.current = nextSensorId;
    setProtocolDetectionBySensor((current) => (
      current[activeSensorId]?.status === 'detecting'
        ? { ...current, [activeSensorId]: { status: 'idle' } }
        : current
    ));
    const committed = updateSensorDraftValues(
      sensorDrafts,
      activeSensorId,
      form.getFieldsValue(true),
    );
    const nextDraft = committed.find((draft) => draft.id === nextSensorId);
    if (!nextDraft) return;
    setSensorDrafts(committed);
    setActiveSensorId(nextSensorId);
    form.setFieldsValue(nextDraft.values);
  }, [activeSensorId, form, sensorDrafts]);

  const handlePortsChange = useCallback((nextPorts = []) => {
    const normalizedTags = [...new Set((Array.isArray(nextPorts) ? nextPorts : [])
      .map((port) => String(port || '').trim())
      .filter(Boolean))];
    if (normalizedTags.some((port, index) => port !== nextPorts[index])
      || normalizedTags.length !== nextPorts.length) {
      form.setFieldValue('ports', normalizedTags);
    }
    const safeIds = normalizeBuilderSensorIds(normalizedTags, { fallback: false });
    const currentValues = { ...form.getFieldsValue(true), ports: normalizedTags };
    let nextDrafts = updateSensorDraftValues(sensorDrafts, activeSensorId, currentValues);
    safeIds.forEach((sensorId) => {
      if (nextDrafts.some((draft) => draft.id === sensorId)) return;
      const sourceDraft = nextDrafts.find((draft) => draft.id === activeSensorId) || nextDrafts[0];
      nextDrafts = [...nextDrafts, createSensorDraft(sensorId, currentValues, sourceDraft)];
    });
    const nextActiveId = safeIds.includes(activeSensorId) ? activeSensorId : (safeIds[0] || null);
    const nextActiveDraft = nextDrafts.find((draft) => draft.id === nextActiveId);
    if (nextActiveId !== activeSensorId) {
      protocolProbeGenerationRef.current += 1;
      activeSensorIdRef.current = nextActiveId;
      setProtocolDetectionBySensor((current) => (
        current[activeSensorId]?.status === 'detecting'
          ? { ...current, [activeSensorId]: { status: 'idle' } }
          : current
      ));
    }
    setSensorDrafts(nextDrafts);
    setActiveSensorId(nextActiveId);
    if (nextActiveDraft && nextActiveId !== activeSensorId) {
      form.setFieldsValue(nextActiveDraft.values);
    }
  }, [activeSensorId, form, sensorDrafts]);

  const handleFormValuesChange = useCallback((changedValues, allValues) => {
    if (!activeSensorId || Object.prototype.hasOwnProperty.call(changedValues, 'ports')) return;
    let nextValues = allValues;
    if (
      Object.prototype.hasOwnProperty.call(changedValues, 'checksumRangeStart')
      || Object.prototype.hasOwnProperty.call(changedValues, 'checksumRangeEnd')
    ) {
      form.setFieldsValue({ checksumRangeExplicit: true });
      nextValues = { ...allValues, checksumRangeExplicit: true };
    }
    if (Object.keys(changedValues).some((field) => PROTOCOL_FORM_FIELDS.has(field))) {
      // 用户在探测期间手动改了协议时，正在返回的旧结果必须作废，不能覆盖刚改的值。
      protocolProbeGenerationRef.current += 1;
      setProtocolDetectionBySensor((current) => ({
        ...current,
        [activeSensorId]: { status: 'idle' },
      }));
    }
    setSensorDrafts((current) => updateSensorDraftValues(current, activeSensorId, nextValues));
  }, [activeSensorId, form]);

  const applySerialTemplate = useCallback((templateId) => {
    const template = catalog?.serialTemplates?.find((item) => item.id === templateId);
    if (!template) return;
    const currentValues = form.getFieldsValue(true);
    const patch = buildSerialTemplateFormPatch({
      template,
      currentValues,
      pointCount: getFormPointCount(form),
    });
    if (!patch) return;
    if (activeSensorId) {
      // 手动选模板和自动识别互斥；旧探测即使稍后返回也不能反向覆盖手动选择。
      protocolProbeGenerationRef.current += 1;
      setProtocolDetectionBySensor((current) => ({
        ...current,
        [activeSensorId]: { status: 'idle' },
      }));
    }
    form.setFieldsValue(patch);
    if (activeSensorId) {
      setSensorDrafts((current) => updateSensorDraftValues(
        current,
        activeSensorId,
        { ...currentValues, ...patch },
      ));
    }
  }, [activeSensorId, catalog, form]);

  const selectProbePort = useCallback((path) => {
    if (!activeSensorId) return;
    protocolProbeGenerationRef.current += 1;
    const normalizedPath = String(path || '').trim();
    const nextPorts = { ...probePortBySensorRef.current };
    if (normalizedPath) nextPorts[activeSensorId] = normalizedPath;
    else delete nextPorts[activeSensorId];
    probePortBySensorRef.current = nextPorts;
    setProbePortBySensor(nextPorts);
    setProtocolDetectionBySensor((current) => ({
      ...current,
      [activeSensorId]: { status: 'idle' },
    }));
  }, [activeSensorId]);

  const detectCurrentSensorProtocol = useCallback(async () => {
    const sensorId = activeSensorId;
    const path = String(probePortBySensorRef.current[sensorId] || '').trim();
    if (readOnly || !sensorId) return;
    if (!path) {
      setProtocolDetectionBySensor((current) => ({
        ...current,
        [sensorId]: { status: 'error', reason: '请先选择当前传感器对应的物理串口' },
      }));
      return;
    }
    if (!detectableProtocolCandidateIds.length) {
      setProtocolDetectionBySensor((current) => ({
        ...current,
        [sensorId]: { status: 'error', reason: '协议目录中没有可自动探测的预设' },
      }));
      return;
    }

    const generation = protocolProbeGenerationRef.current + 1;
    protocolProbeGenerationRef.current = generation;
    setProtocolDetectionBySensor((current) => ({
      ...current,
      [sensorId]: { status: 'detecting', path },
    }));

    try {
      const result = await requestControlApi('/api/serial/protocol-detect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          path,
          candidateIds: detectableProtocolCandidateIds,
        }),
      });
      const isStale = (
        protocolProbeGenerationRef.current !== generation
        || activeSensorIdRef.current !== sensorId
        || probePortBySensorRef.current[sensorId] !== path
      );
      if (isStale) return;

      if (result?.status === 'matched') {
        const currentValues = form.getFieldsValue(true);
        const patch = buildDetectedProtocolFormPatch({
          match: result.match,
          serialTemplates: catalog?.serialTemplates || [],
          currentValues,
        });
        if (!patch) {
          setProtocolDetectionBySensor((current) => ({
            ...current,
            [sensorId]: {
              status: 'error',
              path,
              reason: '识别结果缺少完整协议定义，未修改当前配置',
            },
          }));
          return;
        }

        form.setFieldsValue(patch);
        setSensorDrafts((current) => updateSensorDraftValues(
          current,
          sensorId,
          { ...currentValues, ...patch },
        ));
        const matchedTemplate = (catalog?.serialTemplates || [])
          .find((template) => template.id === result.match.id);
        setProtocolDetectionBySensor((current) => ({
          ...current,
          [sensorId]: {
            status: 'matched',
            path,
            id: result.match.id,
            label: result.match.label || matchedTemplate?.label || result.match.id,
          },
        }));
        message.success(`已为 ${sensorId} 识别并应用协议：${result.match.label || matchedTemplate?.label || result.match.id}`);
        return;
      }

      setProtocolDetectionBySensor((current) => ({
        ...current,
        [sensorId]: {
          status: result?.status === 'ambiguous' ? 'ambiguous' : 'unknown',
          path,
          candidates: result?.candidates || [],
          reason: result?.reason || '',
        },
      }));
    } catch (error) {
      const isStale = (
        protocolProbeGenerationRef.current !== generation
        || activeSensorIdRef.current !== sensorId
        || probePortBySensorRef.current[sensorId] !== path
      );
      if (isStale) return;
      setProtocolDetectionBySensor((current) => ({
        ...current,
        [sensorId]: {
          status: 'error',
          path,
          reason: error.message || '协议识别失败',
        },
      }));
    }
  }, [
    activeSensorId,
    catalog,
    detectableProtocolCandidateIds,
    form,
    readOnly,
  ]);

  const protocolDetectionFeedback = useMemo(() => {
    const status = activeProtocolDetection.status || 'idle';
    if (status === 'detecting') {
      return {
        tone: 'working',
        title: `正在读取 ${activeProtocolDetection.path || selectedProbePortPath}`,
        detail: `按目录中的 ${detectableProtocolCandidateIds.length} 个候选协议采样，请保持传感器持续发送数据。`,
      };
    }
    if (status === 'matched') {
      return {
        tone: 'success',
        title: `已识别：${activeProtocolDetection.label || activeProtocolDetection.id}`,
        detail: '协议与通信字段已写入当前传感器；物理串口、业务名称、线序、算法和显示配置均未改动。',
      };
    }
    if (status === 'ambiguous') {
      const labels = formatProtocolCandidateLabels(activeProtocolDetection.candidates);
      return {
        tone: 'warning',
        title: '识别结果有歧义，未修改配置',
        detail: labels
          ? `当前数据同时符合：${labels}。请手动选择协议或缩小候选范围。`
          : (activeProtocolDetection.reason || '多个协议具有相同线上的可观测特征，请手动选择。'),
      };
    }
    if (status === 'unknown') {
      return {
        tone: 'warning',
        title: '暂未识别出协议，未修改配置',
        detail: activeProtocolDetection.reason || '请确认串口、传感器供电和持续发帧状态后重试。',
      };
    }
    if (status === 'error') {
      return {
        tone: 'error',
        title: '协议识别失败，未修改配置',
        detail: activeProtocolDetection.reason || '请刷新串口列表后重试。',
      };
    }
    if (serialPortsError) {
      return {
        tone: 'error',
        title: '串口列表读取失败',
        detail: serialPortsError,
      };
    }
    if (!serialPortOptions.length) {
      return {
        tone: 'neutral',
        title: '暂未发现可用物理串口',
        detail: '连接传感器后点击“刷新串口”。自动识别不会保存串口路径。',
      };
    }
    return {
      tone: 'neutral',
      title: selectedProbePortPath ? '可以开始识别' : '请选择当前传感器对应的物理串口',
      detail: `将只尝试目录中的 ${detectableProtocolCandidateIds.length} 个可探测协议；左右手、座椅、靠背等业务角色仍由你定义。`,
    };
  }, [
    activeProtocolDetection,
    detectableProtocolCandidateIds.length,
    selectedProbePortPath,
    serialPortOptions.length,
    serialPortsError,
  ]);

  const applyFramingType = useCallback((nextFramingType) => {
    protocolProbeGenerationRef.current += 1;
    if (activeSensorId) {
      setProtocolDetectionBySensor((current) => ({
        ...current,
        [activeSensorId]: { status: 'idle' },
      }));
    }
    const total = Number(form.getFieldValue('valueCount')) || getFormPointCount(form);
    const dataBits = Number(form.getFieldValue('dataBits')) || 8;
    form.setFieldsValue({
      framingType: nextFramingType,
      frameLength: nextFramingType === 'fixedLength' && total
        ? total * (dataBits === 12 ? 2 : 1)
        : form.getFieldValue('frameLength'),
      delimiter: nextFramingType === 'delimiter'
        ? (form.getFieldValue('delimiter') || 'AA 55 03 99')
        : form.getFieldValue('delimiter'),
    });
  }, [activeSensorId, form]);

  const applyDataBits = useCallback((dataBits) => {
    protocolProbeGenerationRef.current += 1;
    if (activeSensorId) {
      setProtocolDetectionBySensor((current) => ({
        ...current,
        [activeSensorId]: { status: 'idle' },
      }));
    }
    const total = Number(form.getFieldValue('valueCount')) || getFormPointCount(form);
    form.setFieldsValue({
      dataBits,
      valueType: dataBits === 12 ? 'uint16le' : 'uint8',
      valueCount: total || form.getFieldValue('valueCount'),
      frameLength: form.getFieldValue('framingType') === 'fixedLength' && total
        ? total * (dataBits === 12 ? 2 : 1)
        : form.getFieldValue('frameLength'),
    });
  }, [activeSensorId, form]);

  const applyDisplayTemplate = useCallback((templateId) => {
    const matrixMode = MATRIX_DISPLAY_MODES.find((item) => item.id === templateId);
    const template = matrixMode
      ? {
        ...matrixMode,
        defaults: {
          rendererId: matrixMode.rendererId,
          visualizationAlgorithmId: 'identity',
          profileLabel: matrixMode.label,
          showStats: false,
          showPressurePanel: true,
          showAreaPanel: true,
        },
      }
      : catalog?.displayTemplates?.find((item) => item.id === templateId);
    if (!template) return;
    const defaults = template.defaults || {};
    form.setFieldsValue({
      displayTemplate: templateId,
      ...defaults,
      // 模板只声明渲染器和是否要统计卡片，画布形态在这里落成 widget 列表，
      // 换模板等于重置画布布局，配色和叠加层沿用用户已有选择。
      canvasConfig: {
        ...buildDefaultCanvasConfig({
          rendererId: defaults.rendererId || 'heatmap',
          showStats: defaults.showStats ?? true,
          source: `${form.getFieldValue('ports')?.[0] || 'sit'}Data`,
        }),
        colormap: form.getFieldValue('canvasConfig')?.colormap || { id: DEFAULT_COLORMAP_ID },
        overlays: form.getFieldValue('canvasConfig')?.overlays || [],
      },
    });
  }, [catalog, form]);

  const applyRendererId = useCallback((nextRendererId) => {
    const currentCanvas = form.getFieldValue('canvasConfig') || {};
    const widgets = Array.isArray(currentCanvas.widgets) ? currentCanvas.widgets : [];
    const shouldApplyAgent = isAgentRendererId(nextRendererId);
    form.setFieldsValue({
      rendererId: nextRendererId,
      canvasConfig: {
        ...currentCanvas,
        widgets: widgets.map((widget) => {
          if (widget.type === 'pressureStats') return widget;
          if (shouldApplyAgent || isAgentRendererId(widget.type)) {
            return { ...widget, type: nextRendererId };
          }
          return widget;
        }),
      },
    });
  }, [form]);

  const updateCanvasConfig = useCallback((next) => {
    form.setFieldsValue({ canvasConfig: next });
  }, [form]);

  const getCodeTemplate = useCallback((language) => (
    catalog?.codeLanguages?.find((item) => item.id === language)?.template || ''
  ), [catalog]);

  const applyAlgorithmPackage = useCallback((packageId) => {
    const algorithmPackage = algorithmPackagesById.get(packageId);
    if (!algorithmPackage) {
      form.setFieldsValue({ algorithmPackageId: packageId });
      return;
    }
    form.setFieldsValue({
      backendAlgorithm: 'package',
      algorithmPackageId: algorithmPackage.id,
      algorithmPackageManifest: algorithmPackage.packageManifest,
      algorithmLanguage: 'python',
      algorithmSource: algorithmPackage.algorithmSource,
      algorithmMetrics: (algorithmPackage.metricDefinitions || []).map((metric) => ({
        ...metric,
        operation: 'external',
        panel: metric.panel || 'none',
        scale: 1,
        offset: 0,
      })),
    });
  }, [algorithmPackagesById, form]);

  const applyAlgorithmMode = useCallback((mode) => {
    if (mode === 'package') {
      const currentId = form.getFieldValue('algorithmPackageId');
      const nextId = algorithmPackagesById.has(currentId)
        ? currentId
        : algorithmPackageOptions[0]?.value;
      if (nextId) applyAlgorithmPackage(nextId);
      else form.setFieldsValue({ backendAlgorithm: mode });
      return;
    }
    const next = { backendAlgorithm: mode };
    if (mode === 'code' && !String(form.getFieldValue('algorithmSource') || '').trim()) {
      const language = form.getFieldValue('algorithmLanguage') || 'js';
      next.algorithmLanguage = language;
      next.algorithmSource = getCodeTemplate(language);
    }
    form.setFieldsValue(next);
  }, [algorithmPackageOptions, algorithmPackagesById, applyAlgorithmPackage, form, getCodeTemplate]);

  const applyAlgorithmLanguage = useCallback((language) => {
    form.setFieldsValue({
      algorithmLanguage: language,
      algorithmSource: getCodeTemplate(language),
    });
  }, [form, getCodeTemplate]);

  const applyMatrixTransformType = useCallback((type) => {
    form.setFieldsValue({
      matrixTransformType: type,
      matrixTransformFactor: type === 'interpolate'
        ? 2
        : type === 'downsample'
          ? 0.5
          : 1,
    });
  }, [form]);

  useEffect(() => {
    if (!pointOrderInfo && !coordinateMapInfo) return;
    let effectivePointOrder = pointOrderInfo;
    if (coordinateMapInfo && (
      !pointOrderInfo
      || pointOrderInfo.rows !== coordinateMapInfo.rows
      || pointOrderInfo.cols !== coordinateMapInfo.cols
    )) {
      effectivePointOrder = normalizePointOrderDefinition(
        createIdentityPointOrder(coordinateMapInfo.rows, coordinateMapInfo.cols),
      );
    }
    if (!effectivePointOrder) return;
    const currentDataBits = Number(form.getFieldValue('dataBits')) || 8;
    const detectedValueCount = Number(form.getFieldValue('valueCount')) || 0;
    const protocolGeometryDefaults = buildProtocolGeometryDefaults({
      valueCount: detectedValueCount,
      frameLength: form.getFieldValue('frameLength'),
      pointCount: effectivePointOrder.pointCount,
      bytesPerValue: currentDataBits === 12 ? 2 : 1,
      fixedLength: framingType === 'fixedLength',
    });
    form.setFieldsValue({
      ...(effectivePointOrder !== pointOrderInfo
        ? { pointOrderJson: JSON.stringify(effectivePointOrder.definition, null, 2) }
        : {}),
      ...protocolGeometryDefaults,
    });
  }, [activeSensorId, coordinateMapInfo, dataBits, form, framingType, pointOrderInfo]);

  const save = useCallback(async () => {
    if (protocolDetectionInProgress) {
      message.warning('请等待协议识别完成后再保存');
      return;
    }
    if (readOnly) {
      message.error('系统内置展示系统为只读，不能覆盖保存');
      return;
    }
    setSaving(true);
    try {
      const values = await form.validateFields();
      const sensorIds = normalizeBuilderSensorIds(values.ports, { fallback: false });
      if (!sensorIds.length) throw new Error('请至少配置一个传感器 ID');
      const currentDrafts = updateSensorDraftValues(
        sensorDrafts,
        activeSensorId,
        values,
      );
      const draftById = new Map(currentDrafts.map((draft) => [draft.id, draft]));
      const orderedDrafts = sensorIds.map((sensorId) => draftById.get(sensorId));
      if (orderedDrafts.some((draft) => !draft)) {
        throw new Error('传感器页签状态不完整，请重新选择串口角色后再保存');
      }
      // setFieldsValue 不触发 onValuesChange；这里强制把当前页快照写回草稿后再编译。
      const compiledSensors = orderedDrafts.map((draft) => compileSensorDraftForSave(draft, {
        multiple: orderedDrafts.length > 1,
        algorithmPackagesById,
      }));
      const outputChannels = compiledSensors.map(({ sensor }) => sensor.outputChannel);
      if (outputChannels.some((channel) => !channel)) {
        throw new Error('每个传感器都必须填写 outputChannel');
      }
      if (new Set(outputChannels).size !== outputChannels.length) {
        throw new Error('每个传感器的 outputChannel 必须唯一');
      }
      setSensorDrafts(currentDrafts);
      const sensors = compiledSensors.map(({ sensor }) => sensor);
      const primarySensorState = compiledSensors[0];
      const primarySource = `${primarySensorState.sensor.outputChannel}Data`;
      const normalizedCoordinateMap = primarySensorState.normalizedCoordinateMap;
      const normalizedMatrix = normalizedCoordinateMap || primarySensorState.normalizedPointOrder;
      const primarySensorValues = primarySensorState.values;
      const portLabels = Object.fromEntries(
        sensors.map((sensor) => [sensor.id, sensor.label]),
      );
      const sensorPlan = buildBuilderSensorPlan({
        displaySystemId: values.id,
        ports: sensorIds,
        portLabels,
        sensors,
      });
      // 画布是 widget 的唯一真相。已经显式指向某路的 source 原样保留，
      // 尚未出现的串口则自动补一个数据 widget，不再全部挤到主路。
      const canvas = values.canvasConfig?.widgets?.length
        ? values.canvasConfig
        : buildDefaultCanvasConfig({
          rendererId: values.rendererId,
          showStats: true,
          source: primarySource,
        });
      const canvasWidgets = isAgentRendererId(values.rendererId)
        ? canvas.widgets.map((widget) => (
          widget.type === 'pressureStats' ? widget : { ...widget, type: values.rendererId }
        ))
        : canvas.widgets;
      const widgets = ensureBuilderPortWidgets({
        widgets: canvasWidgets,
        sensorPlan,
        rendererId: values.rendererId,
      });
      const builtInDisplayRenderers = createMatrixDisplayRenderers({
        matrix: { rows: normalizedMatrix.rows, cols: normalizedMatrix.cols },
        coordinateMap: normalizedCoordinateMap?.definition,
      });
      const referencedAgentRendererIds = [...new Set([
        values.rendererId,
        ...widgets.map((widget) => widget.type),
      ].filter(isAgentRendererId))];
      const agentDisplayRenderers = referencedAgentRendererIds.map((agentRendererId) => {
        const app = agentRendererById.get(agentRendererId);
        return {
          id: agentRendererId,
          type: agentRendererId,
          label: app ? `Agent · ${app.label}` : agentRendererId,
          options: {},
        };
      });
      const displayRenderers = [...builtInDisplayRenderers, ...agentDisplayRenderers];
      const displayViews = buildBuilderPortViews(displayRenderers, sensorPlan);

      const visualizationAlgorithms = (catalog.visualizationAlgorithms || []).map((algorithm) => {
        const options = { ...(algorithm.options || {}) };
        if (algorithm.id === 'normalize') options.max = values.normalizeMax;
        if (algorithm.id === 'threshold') options.threshold = values.threshold;
        if (algorithm.id === 'smooth') options.radius = values.smoothRadius;
        return { ...algorithm, options };
      });
      const configuredAlgorithmMetrics = primarySensorState.configuredAlgorithmMetrics;
      const configuredAlgorithmMetricIds = new Set(
        configuredAlgorithmMetrics.map((metric) => metric.id),
      );
      const metricReferencesForPanel = (panel) => configuredAlgorithmMetrics
        .filter((metric) => metric.panel === panel || metric.panel === 'both')
        .map((metric) => `algorithm.${metric.id}`);
      const pressureMetrics = [
        ...(values.pressureMetrics || []).filter((metric) => !metric.startsWith('algorithm.')),
        ...metricReferencesForPanel('pressure'),
      ];
      const areaMetrics = [
        ...(values.areaMetrics || []).filter((metric) => !metric.startsWith('algorithm.')),
        ...metricReferencesForPanel('area'),
      ];
      const primaryMetric = values.primaryMetric?.startsWith('algorithm.')
        && !configuredAlgorithmMetricIds.has(values.primaryMetric.slice(10))
        ? 'totalPressure'
        : values.primaryMetric;
      const matrixDefinition = { ...primarySensorState.sensor.matrix };
      const fileDefinition = { ...primarySensorState.sensor.files };
      const protocolDefinition = cloneBuilderValue(primarySensorState.sensor.protocol);
      const algorithmDefinition = cloneBuilderValue(primarySensorState.sensor.algorithm);
      const manifest = {
        schemaVersion: 3,
        id: values.id,
        name: values.name,
        version: values.version,
        description: 'Created with Display System Builder',
        sensors,
        // 顶层单数字段是给 v1/v2 调用方的兼容投影；逐路真相只在 sensors[]。
        sensor: {
          type: primarySensorState.sensor.type,
          matrix: matrixDefinition,
          ports: sensorPlan.map((sensor) => sensor.id),
          portLabels,
        },
        files: fileDefinition,
        protocol: protocolDefinition,
        algorithm: algorithmDefinition,
        display: {
          layout: { type: 'grid', columns: 12 },
          matrixTransform: {
            type: values.matrixTransformType,
            factor: values.matrixTransformFactor,
          },
          views: displayViews,
          widgets,
          canvas: {
            colormap: canvas.colormap || { id: DEFAULT_COLORMAP_ID },
            overlays: canvas.overlays || [],
            widgets,
          },
          renderers: displayRenderers,
          visualizationAlgorithms,
          profiles: [{
            id: 'default',
            label: values.profileLabel,
            renderer: values.rendererId,
            visualizationAlgorithm: values.visualizationAlgorithmId,
            widgets: widgets.map((widget) => widget.id),
          }],
          defaultView: values.rendererId,
          defaultProfile: 'default',
          controls: { serial: true, capture: true, replay: true, download: true },
          sidebar: {
            source: primarySource,
            algorithmMetrics: configuredAlgorithmMetrics.map((metric) => ({
              id: metric.id,
              label: metric.label || metric.id,
              unit: metric.unit || '',
              decimals: metric.decimals ?? 2,
            })),
            pressure: {
              visible: values.showPressurePanel,
              title: values.pressurePanelTitle,
              primaryMetric,
              metrics: pressureMetrics,
            },
            area: {
              visible: values.showAreaPanel,
              title: values.areaPanelTitle,
              threshold: values.activeThreshold,
              pointArea: values.pointArea,
              unit: values.areaUnit,
              metrics: areaMetrics,
            },
          },
          chartCards: cloneBuilderValue(loadedChartCards),
        },
        metadata: {
          runtimeMode: values.runtimeMode,
          createdBy: 'display-system-builder',
          builder: {
            lineOrderMode: primarySensorValues.lineOrderMode,
            pointOrderMode: normalizedCoordinateMap ? 'generated-row-major' : 'point-order-file',
            coordinateMapMode: normalizedCoordinateMap ? 'physical-coordinate-file' : 'regular-grid',
            serialTemplate: primarySensorValues.serialTemplate,
            displayTemplate: values.displayTemplate,
            transportType: primarySensorValues.transportType,
            sensors: Object.fromEntries(compiledSensors.map(({ sensor, values: sensorValues }) => [
              sensor.id,
              {
                serialTemplate: sensorValues.serialTemplate,
                transportType: sensorValues.transportType,
                lineOrderMode: sensorValues.lineOrderMode,
              },
            ])),
          },
        },
      };
      const definitions = {
        ...cloneBuilderValue(primarySensorState.definitions),
        sensors: Object.fromEntries(compiledSensors.map(({ sensor, definitions: sensorDefinitions }) => [
          sensor.id,
          sensorDefinitions,
        ])),
      };

      const savePayload = await requestJson('/api/display-systems', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ manifest, definitions, overwrite: Boolean(selectedId) }),
      });
      const savedRuntimeDefinition = savePayload?.result?.displaySystem?.runtimeDefinition;
      if (savedRuntimeDefinition) {
        registerRuntimeDisplayDefinition(savedRuntimeDefinition);
      }
      await loadIndex();
      window.dispatchEvent(new CustomEvent('shroom-display-systems-updated'));
      setSelectedId(values.id);
      setEditorAccess({ editable: true, origin: 'user' });
      await commandClient.execute('sensor.switch', { sensorType: primarySensorState.sensor.type });
      localStorage.setItem('file', primarySensorState.sensor.type);
      onActivated?.(primarySensorState.sensor.type);
      message.success(`已保存并加载：${values.name}`);
      if (embedded && typeof onClose === 'function') {
        onClose();
      } else {
        navigate('/system');
      }
      // 授权刷新不属于展示激活的关键路径，失败时也不能让配置弹窗继续停留。
      commandClient.execute('license.refresh').catch((error) => {
        console.warn('[DisplaySystems] license refresh failed after save', error);
      });
    } catch (error) {
      message.error(error.message);
    } finally {
      setSaving(false);
    }
  }, [
    activeSensorId,
    agentRendererById,
    algorithmPackagesById,
    loadedChartCards,
    catalog,
    embedded,
    form,
    loadIndex,
    navigate,
    onActivated,
    onClose,
    protocolDetectionInProgress,
    readOnly,
    selectedId,
    sensorDrafts,
  ]);

  if (loading && !catalog) {
    return <div className="display-builder-loading"><Spin /></div>;
  }

  return (
    <>
    <div className={`display-builder-page${embedded ? ' is-embedded' : ''}`}>
      <aside className="display-builder-sidebar">
        <div className="display-builder-brand">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => (embedded && typeof onClose === 'function' ? onClose() : navigate('/system'))}
            title={embedded ? '关闭配置' : '返回系统'}
            aria-label={embedded ? '关闭配置' : '返回系统'}
          />
          <div><strong>传感器列表</strong><span>{systems.length} 个配置</span></div>
          <Button
            type="text"
            icon={<PlusOutlined />}
            onClick={startNew}
            title="新建展示系统"
            aria-label="新建展示系统"
          />
        </div>
        <div className="display-builder-list-label">展示系统</div>
        <div className="display-builder-list" role="list">
          {systems.map((system) => (
            <button
              type="button"
              key={system.id}
              className={[
                selectedId === system.id ? 'is-active' : '',
                system.editable ? 'is-user-system' : 'is-system-system',
              ].filter(Boolean).join(' ')}
              onClick={() => editSystem(system.id)}
            >
              <strong>
                {system.name}
                <em>{system.editable ? '自定义' : <><LockOutlined /> 系统内置</>}</em>
              </strong>
              <span>{system.sensorType} · {system.matrix?.rows}×{system.matrix?.cols}</span>
            </button>
          ))}
          {!systems.length ? <p className="display-builder-empty">暂无已保存配置</p> : null}
        </div>
      </aside>

      <main className="display-builder-main">
        <header className="display-builder-header">
          <div>
            <h1>{activeStepTitle}</h1>
            <span>
              {systemName || selectedId || '未命名传感器'}
              {' · '}
              {readOnly ? '系统内置，只读' : activeStepDescription}
            </span>
          </div>
          <div className="display-builder-actions">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadIndex().catch((error) => message.error(error.message))}
              title="刷新配置列表"
              aria-label="刷新配置列表"
            />
          </div>
        </header>

        <Form
          form={form}
          layout="vertical"
          initialValues={DEFAULT_VALUES}
          className="display-builder-form"
          disabled={readOnly}
          onValuesChange={handleFormValuesChange}
        >
          <div className="display-builder-workspace">
            <div className="display-builder-primary">
              {configuredSensorDrafts.length ? (
                <div className="builder-sensor-tabs" role="tablist" aria-label="逐传感器配置">
                  <span>正在配置</span>
                  {configuredSensorDrafts.map((draft) => (
                    <button
                      type="button"
                      role="tab"
                      id={`builder-sensor-tab-${draft.id}`}
                      aria-controls="builder-sensor-editor"
                      aria-selected={draft.id === activeSensorId}
                      className={draft.id === activeSensorId ? 'is-active' : ''}
                      key={draft.id}
                      title={`${draft.sensor?.label || draft.id} · ${draft.id} → ${draft.sensor?.outputChannel || draft.id}`}
                      onClick={() => switchActiveSensor(draft.id)}
                    >
                      <strong>{draft.sensor?.label || draft.id}</strong>
                      <small>{draft.id} → {draft.sensor?.outputChannel || draft.id}</small>
                    </button>
                  ))}
                </div>
              ) : null}
              <div
                id="builder-sensor-editor"
                className="builder-sensor-editor"
                role="tabpanel"
                aria-labelledby={activeSensorId ? `builder-sensor-tab-${activeSensorId}` : undefined}
              >
                <nav className="builder-stepper" aria-label="配置步骤">
                  {configurationSteps.map((step, index) => (
                    <div className="builder-step-slot" key={step.id}>
                      <button
                        type="button"
                        className={[
                          'builder-step',
                          activeStep === step.id ? 'is-active' : '',
                          step.complete ? 'is-complete' : '',
                        ].filter(Boolean).join(' ')}
                        aria-current={activeStep === step.id ? 'step' : undefined}
                        onClick={() => setActiveStep(step.id)}
                      >
                        <span>{index + 1}</span>
                        <strong>{step.label}</strong>
                      </button>
                      {index < configurationSteps.length - 1 ? <i className="builder-step-line" /> : null}
                    </div>
                  ))}
                </nav>

              <section
                className="builder-module-panel connection-module"
                hidden={activeStep !== 'connection'}
              >
                  <div className="field-cluster protocol-detect-cluster">
                    <div className="cluster-heading protocol-detect-heading">
                      <div>
                        <h3>自动识别数据协议</h3>
                        <p>临时读取物理串口，为当前传感器匹配协议预设；不会保存 COM 路径，也不会判断业务角色。</p>
                      </div>
                      <strong>{activeSensorDraft?.sensor?.label || activeSensorId || '当前传感器'}</strong>
                    </div>
                    <div className="protocol-detect-controls">
                      <div className="protocol-port-select">
                        <span>临时物理串口</span>
                        <Select
                          allowClear
                          showSearch
                          value={selectedProbePortPath || undefined}
                          options={serialPortOptions}
                          loading={serialPortsLoading}
                          disabled={readOnly || activeProtocolDetection.status === 'detecting'}
                          placeholder="选择当前传感器实际连接的 COM"
                          optionFilterProp="label"
                          onChange={selectProbePort}
                        />
                      </div>
                      <Button
                        icon={<ReloadOutlined />}
                        loading={serialPortsLoading}
                        disabled={readOnly || activeProtocolDetection.status === 'detecting'}
                        onClick={loadSerialPorts}
                      >
                        刷新串口
                      </Button>
                      <Button
                        type="primary"
                        icon={<ApiOutlined />}
                        loading={activeProtocolDetection.status === 'detecting'}
                        disabled={
                          readOnly
                          || !selectedProbePortPath
                          || !detectableProtocolCandidateIds.length
                        }
                        onClick={detectCurrentSensorProtocol}
                      >
                        一键识别
                      </Button>
                    </div>
                    <div
                      className={`protocol-detect-feedback is-${protocolDetectionFeedback.tone}`}
                      role="status"
                      aria-live="polite"
                    >
                      <span className="protocol-detect-feedback-dot" />
                      <div>
                        <strong>{protocolDetectionFeedback.title}</strong>
                        <small>{protocolDetectionFeedback.detail}</small>
                      </div>
                    </div>
                  </div>

                  <div className="field-cluster template-picker-cluster">
                    <div className="cluster-heading">
                      <div><h3>选择经典配置</h3><p>选择后会自动填充通信参数，所有值仍可在下方修改。</p></div>
                      <strong>{selectedSerialTemplate?.label || '未选择'}</strong>
                    </div>
                    <Form.Item name="serialTemplate" hidden><Input /></Form.Item>
                    <div className="serial-template-grid" role="radiogroup" aria-label="经典串口配置">
                      {(catalog?.serialTemplates || []).map((template) => {
                        const selected = template.id === serialTemplate;
                        return (
                          <button
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            className={`serial-template-card${selected ? ' is-selected' : ''}`}
                            key={template.id}
                            disabled={readOnly}
                            onClick={() => applySerialTemplate(template.id)}
                          >
                            <span className="template-card-icon"><ApiOutlined /></span>
                            <span className="template-card-copy">
                              <strong>{template.label}</strong>
                              <small>{template.description}</small>
                            </span>
                            <span className="template-card-facts">
                              {getSerialTemplateFacts(template).map((fact) => <i key={fact}>{fact}</i>)}
                            </span>
                            {selected ? <CheckCircleFilled className="template-card-check" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="field-cluster">
                    <div className="cluster-heading">
                      <div><h3>通信参数</h3><p>模板只是起点，下面的值就是最终写入协议配置的参数。</p></div>
                    </div>
                    <Form.Item name="transportType" hidden><Input /></Form.Item>
                    <Form.Item name="includeDelimiter" hidden valuePropName="checked"><Checkbox /></Form.Item>
                    <Form.Item name="validationHeaderOffset" hidden><InputNumber /></Form.Item>
                    <Form.Item name="checksumRangeExplicit" hidden valuePropName="checked"><Checkbox /></Form.Item>
                    <div className="form-grid serial-fields-grid">
                      <Form.Item
                        className="serial-role-field"
                        name="ports"
                        label="传感器 ID / 串口角色"
                        tooltip="可选择内置角色，也可直接输入自定义稳定 ID；业务名称在当前传感器页签单独设置。"
                        rules={[
                          { required: true, message: '请至少配置一个传感器 ID' },
                          {
                            validator: (_, value) => {
                              const invalid = getInvalidBuilderSensorIds(value);
                              return invalid.length
                                ? Promise.reject(new Error(`ID 仅允许字母、数字、点、下划线和连字符：${invalid.join('、')}`))
                                : Promise.resolve();
                            },
                          },
                        ]}
                      >
                        <Select
                          mode="tags"
                          tokenSeparators={[',', '，']}
                          onChange={handlePortsChange}
                          options={(catalog?.serialRoles || []).map((role) => ({
                            value: role,
                            label: `${SERIAL_ROLE_LABELS[role] || role} (${role})`,
                          }))}
                        />
                      </Form.Item>
                      <Form.Item name="sensorLabel" label="当前传感器业务名称" rules={[{ required: true }]}>
                        <Input placeholder="例如：左手、右手、座椅或靠背" />
                      </Form.Item>
                      <Form.Item
                        name="outputChannel"
                        label="当前 outputChannel"
                        rules={[
                          { required: true, whitespace: true, message: '请输入 outputChannel' },
                          {
                            validator: (_, value) => {
                              const normalized = String(value || '').trim();
                              const duplicate = configuredSensorDrafts.some((draft) => (
                                draft.id !== activeSensorId
                                && String(draft.values?.outputChannel || draft.sensor?.outputChannel || '').trim() === normalized
                              ));
                              return duplicate
                                ? Promise.reject(new Error('outputChannel 必须跨传感器唯一'))
                                : Promise.resolve();
                            },
                          },
                        ]}
                      >
                        <Input placeholder={activeSensorId || 'sensor'} />
                      </Form.Item>
                      <Form.Item name="stored" label="采集存储" valuePropName="checked">
                        <Checkbox>采集时写入数据库并支持回放 / CSV</Checkbox>
                      </Form.Item>
                      <Form.Item name="baudRate" label="波特率" rules={[{ required: true }]}>
                        <Select showSearch options={(catalog?.baudRates || []).map((value) => ({ value, label: String(value) }))} />
                      </Form.Item>
                      <Form.Item name="dataBits" label="数据精度">
                        <Segmented block options={[{ value: 8, label: '8 Bit' }, { value: 12, label: '12 Bit' }]} onChange={applyDataBits} />
                      </Form.Item>
                      <Form.Item className="framing-type-field" name="framingType" label="分帧方式">
                        <Segmented block options={(catalog?.framingTypes || []).map((item) => ({ value: item.id, label: item.label }))} onChange={applyFramingType} />
                      </Form.Item>
                      {framingType === 'delimiter' ? (
                        <Form.Item className="frame-rule-field" name="delimiter" label="分隔符 / 帧尾" rules={[{ required: true }]}>
                          <Input placeholder="AA 55 03 99" />
                        </Form.Item>
                      ) : (
                        <Form.Item className="frame-rule-field" name="frameLength" label="帧长度（字节）" rules={[{ required: true }]}>
                          <InputNumber min={1} />
                        </Form.Item>
                      )}
                    </div>
                    <div className="form-grid serial-fields-grid">
                      <Form.Item
                        className="frame-rule-field"
                        name="validationHeader"
                        label="帧头校验（留空不校验）"
                        tooltip="十六进制字节，例如 AA 55。帧头不匹配的数据会被丢弃，不进入线序映射。"
                      >
                        <Input placeholder="AA 55" />
                      </Form.Item>
                      <Form.Item name="checksumType" label="校验算法">
                        <Select
                          options={[
                            { value: 'none', label: '不校验' },
                            ...(catalog?.checksumTypes || []).map((type) => ({ value: type, label: type })),
                          ]}
                        />
                      </Form.Item>
                      {checksumType && checksumType !== 'none' ? (
                        <>
                          <Form.Item
                            name="checksumByteOffset"
                            label="校验字节位置"
                            tooltip="负数表示从帧尾倒数，-1 即最后一个字节。"
                          >
                            <InputNumber />
                          </Form.Item>
                          <Form.Item name="checksumRangeStart" label="校验区间起（含）">
                            <InputNumber />
                          </Form.Item>
                          <Form.Item name="checksumRangeEnd" label="校验区间止（不含）">
                            <InputNumber />
                          </Form.Item>
                        </>
                      ) : null}
                    </div>
                    <div className="protocol-result-strip">
                      <span><span className="protocol-status-dot" />协议参数已同步</span>
                      <strong>{Number(baudRate || 0).toLocaleString()} baud</strong>
                      <strong>{dataBits || 8} Bit</strong>
                      <strong>{framingType === 'delimiter' ? `帧尾 ${delimiter || '未设置'}` : `${frameLength || 0} 字节 / 帧`}</strong>
                    </div>
                  </div>

                  <div className="module-footer">
                    <span>通信参数确认后，继续配置传感器点位。</span>
                    <Button
                      type="primary"
                      icon={<ArrowRightOutlined />}
                      iconPosition="end"
                      disabled={protocolDetectionInProgress}
                      onClick={() => setActiveStep('mapping')}
                    >
                      下一步：传感器映射
                    </Button>
                  </div>
              </section>

              <section
                className="builder-module-panel mapping-module"
                hidden={activeStep !== 'mapping'}
              >
                  <div className="field-cluster">
                    <div className="cluster-heading">
                      <div><h3>传感器与点位</h3><p>坐标文件决定矩阵尺寸和主界面中传感器的真实形状。</p></div>
                    </div>
                    <div className="form-grid three-columns">
                      <Form.Item name="name" label="展示名称" rules={[{ required: true }]}><Input placeholder="自定义座椅" /></Form.Item>
                      <Form.Item name="sensorType" label="传感器类型" rules={[{ required: true }]}><Input placeholder="customSeat" /></Form.Item>
                      <Form.Item name="id" label="系统 ID" rules={[{ required: true }, { pattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/, message: '仅允许字母、数字、点、下划线和连字符' }]}><Input disabled={Boolean(selectedId)} placeholder="custom-seat" /></Form.Item>
                    </div>
                    <div className="coordinate-map-heading">
                      <div>
                        <h3>传感器形状坐标</h3>
                        <p>导入 `rows × cols × [x, y]` 坐标矩阵，不需要手动填写行数和列数。</p>
                      </div>
                      <Upload
                        accept=".json,application/json"
                        beforeUpload={importCoordinateMapFile}
                        disabled={readOnly}
                        maxCount={1}
                        showUploadList={false}
                      >
                        <Button icon={<UploadOutlined />}>导入坐标 JSON</Button>
                      </Upload>
                    </div>
                    <Form.Item name="coordinateMapJson" hidden><Input /></Form.Item>
                    <Form.Item name="pointOrderJson" hidden><Input /></Form.Item>
                    {coordinateMapInfo ? (
                      <dl className="coordinate-map-derived">
                        <div><dt>坐标矩阵</dt><dd>{coordinateMapInfo.rows} × {coordinateMapInfo.cols}</dd></div>
                        <div><dt>采样点数</dt><dd>{pointCount}</dd></div>
                        <div>
                          <dt>物理宽高比</dt>
                          <dd>
                            {coordinateMapInfo.bounds.height >= coordinateMapInfo.bounds.width
                              ? `1:${(coordinateMapInfo.bounds.height / coordinateMapInfo.bounds.width).toFixed(2)}`
                              : `${(coordinateMapInfo.bounds.width / coordinateMapInfo.bounds.height).toFixed(2)}:1`}
                          </dd>
                        </div>
                      </dl>
                    ) : pointOrderInfo ? (
                      <dl className="coordinate-map-derived">
                        <div><dt>规则矩阵</dt><dd>{pointOrderInfo.rows} × {pointOrderInfo.cols}</dd></div>
                        <div><dt>采样点数</dt><dd>{pointCount}</dd></div>
                        <div><dt>渲染方式</dt><dd>等距网格</dd></div>
                      </dl>
                    ) : (
                      <p className="coordinate-map-empty">尚未导入形状坐标。导入后自动生成默认点位顺序和采样点数。</p>
                    )}
                  </div>

                  <details className="advanced-config module-advanced">
                    <summary>
                      <span className="advanced-summary-title">
                        <SettingOutlined />
                        <span><strong>高级数据处理</strong><small>运行模式、数据偏移、线序和后端算法</small></span>
                      </span>
                      <span className="advanced-toggle" />
                    </summary>
                    <div className="advanced-config-content">
                      <div className="advanced-group">
                        <div className="advanced-group-heading"><h3>运行与解码</h3><p>只有协议包含额外字段时才需要修改数据偏移。</p></div>
                        <div className="form-grid four-columns">
                          <Form.Item name="version" label="配置版本"><Input /></Form.Item>
                          <Form.Item name="runtimeMode" label="运行模式"><Select options={RUNTIME_MODE_OPTIONS} /></Form.Item>
                          <Form.Item name="valueType" hidden><Input /></Form.Item>
                          <Form.Item name="byteOffset" label="数据偏移"><InputNumber min={0} /></Form.Item>
                          <Form.Item name="valueCount" label="采样点数（自动）"><InputNumber min={1} disabled /></Form.Item>
                        </div>
                      </div>
                      <div className="advanced-group">
                        <div className="advanced-group-heading"><h3>线序</h3><p>处理原始采样值的读取顺序，不改变物理坐标。</p></div>
                        <div className="line-order-editor">
                          <Form.Item name="lineOrderMode" label="线序来源"><Segmented options={[{ value: 'identity', label: '自动生成' }, { value: 'custom', label: '自定义 JSON' }]} /></Form.Item>
                          {lineOrderMode === 'custom'
                            ? <Form.Item name="lineOrderJson" rules={[{ required: true }]}><Input.TextArea rows={9} spellCheck={false} placeholder={'{\n  "order": [1, 2, 3]\n}'} /></Form.Item>
                            : <p className="field-note">自动按采样点数生成从 1 开始的一基索引。</p>}
                        </div>
                      </div>
                      <div className="advanced-group">
                        <div className="advanced-group-heading">
                          <h3>实时数据函数</h3>
                          <p>函数的第一个入参始终是串口解码后的原始数据；返回结果用于实时展示、采集和回放。</p>
                        </div>
                        <div className="form-grid four-columns">
                          <Form.Item name="backendAlgorithm" label="处理方式">
                            <Select options={algorithmModeOptions} onChange={applyAlgorithmMode} />
                          </Form.Item>
                          <Form.Item name="algorithmPackageManifest" hidden><FormValueHolder /></Form.Item>
                          {backendAlgorithm === 'package' ? (
                            <Form.Item
                              name="algorithmPackageId"
                              label="Python 算法包"
                              rules={[{ required: true, message: '请选择已注册算法包' }]}
                            >
                              <Select
                                showSearch
                                options={algorithmPackageOptions}
                                onChange={applyAlgorithmPackage}
                                optionFilterProp="label"
                                placeholder="选择平台已注册算法包"
                              />
                            </Form.Item>
                          ) : null}
                          {backendAlgorithm === 'json' ? <>
                            <Form.Item name="scale" label="缩放"><InputNumber step={0.1} /></Form.Item>
                            <Form.Item name="offset" label="偏移"><InputNumber step={0.1} /></Form.Item>
                            <Form.Item name="zeroBelow" label="低值清零"><InputNumber min={0} /></Form.Item>
                            <Form.Item name="min" label="最小值"><InputNumber /></Form.Item>
                            <Form.Item name="max" label="最大值"><InputNumber /></Form.Item>
                          </> : null}
                        </div>
                        {backendAlgorithm === 'package' && selectedAlgorithmPackage ? (
                          <div className="algorithm-contract">
                            <strong>{selectedAlgorithmPackage.name}</strong>
                            <span>{selectedAlgorithmPackage.description || '平台内置 Python V2 算法包'}</span>
                            <small>
                              API V{selectedAlgorithmPackage.packageManifest?.apiVersion || 2}
                              {' · '}
                              {selectedAlgorithmPackage.sampleRateHz
                                ? `建议 ${selectedAlgorithmPackage.sampleRateHz} Hz`
                                : '跟随输入帧'}
                              {' · '}
                              输出 {(selectedAlgorithmPackage.metricDefinitions || []).length} 个指标
                            </small>
                          </div>
                        ) : null}
                        {backendAlgorithm === 'code' ? (
                          <div className="algorithm-code-workbench">
                            <div className="algorithm-code-toolbar">
                              <Form.Item name="algorithmLanguage" label="代码语言">
                                <Segmented
                                  block
                                  options={codeLanguageOptions}
                                  onChange={applyAlgorithmLanguage}
                                />
                              </Form.Item>
                              <Form.Item name="algorithmTimeoutMs" label="单帧超时（毫秒）">
                                <InputNumber min={50} max={10000} step={50} />
                              </Form.Item>
                            </div>
                            <div className="algorithm-contract">
                              <strong>函数约定</strong>
                              {algorithmLanguage === 'python' ? (
                                <span>
                                  <code>calculate(raw_data, context)</code>
                                  中的 <code>raw_data</code> 是原始数组，
                                  <code>context["normalized_data"]</code> 是映射后的矩阵。
                                </span>
                              ) : (
                                <span>
                                  <code>calculate(rawData, context)</code>
                                  中的 <code>rawData</code> 是原始数组，
                                  <code>context.normalizedData</code> 是映射后的矩阵。
                                </span>
                              )}
                              <small>返回数组，或返回 {'{ data: 数组, metrics: 指标对象 }'}。用户代码在后端运行，请只加载可信代码。</small>
                            </div>
                            <Form.Item
                              name="algorithmSource"
                              label={`${algorithmLanguage === 'python' ? 'Python' : 'JavaScript'} 函数代码`}
                              rules={[{ required: true, message: '请输入完整的 calculate 函数' }]}
                            >
                              <Input.TextArea
                                className="algorithm-code-editor"
                                rows={16}
                                spellCheck={false}
                                autoCapitalize="off"
                                autoCorrect="off"
                              />
                            </Form.Item>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </details>

                  <div className="module-footer">
                    <Button icon={<LeftOutlined />} onClick={() => setActiveStep('connection')}>返回数据接入</Button>
                    <span>点位与算法确认后，继续验证主界面显示。</span>
                    <Button type="primary" icon={<ArrowRightOutlined />} iconPosition="end" onClick={() => setActiveStep('render')}>
                      下一步：显示验证
                    </Button>
                  </div>
              </section>

              <section
                className="builder-module-panel render-module"
                hidden={activeStep !== 'render'}
              >
                  <Form.Item name="displayTemplate" hidden><Input /></Form.Item>
                  {/* 画布配置只由当前矩阵形式生成，表单项负责把对象带进保存流程。 */}
                  <Form.Item name="canvasConfig" hidden><FormValueHolder /></Form.Item>

                  <div className="matrix-essential-settings">
                    <section className="matrix-essential-item shape-setting">
                      <div className="matrix-essential-index">01</div>
                      <div className="matrix-essential-copy">
                        <span>设置形状</span>
                        <strong>{matrixInfo ? `${matrixInfo.rows} × ${matrixInfo.cols} 坐标矩阵` : '尚未设置形状'}</strong>
                        <small>
                          {matrixInfo
                            ? `${pointCount} 个点 · 形状完全由坐标文件决定`
                            : '导入 rows × cols × [x, y] 坐标 JSON'}
                        </small>
                      </div>
                      <Upload
                        accept=".json,application/json"
                        beforeUpload={importCoordinateMapFile}
                        disabled={readOnly}
                        maxCount={1}
                        showUploadList={false}
                      >
                        <Button icon={<UploadOutlined />}>
                          {matrixInfo ? '更换形状文件' : '导入形状文件'}
                        </Button>
                      </Upload>
                    </section>

                    <section className="matrix-essential-item data-setting">
                      <div className="matrix-essential-index">02</div>
                      <div className="matrix-essential-copy">
                        <span>设置数据</span>
                        <strong>
                          {previewUsesDirectionData
                            ? (pointCount ? `测试帧 1-${pointCount}` : '等待形状文件')
                            : (realtimePreviewValues.length
                              ? `实时帧 ${realtimePreviewValues.length} 点`
                              : '等待串口数据')}
                        </strong>
                        <small>
                          {previewUsesDirectionData
                            ? '用连续数字检查起点、终点和行列方向'
                            : '直接查看当前串口解码后的最新一帧'}
                        </small>
                      </div>
                      <Segmented
                        className="preview-data-source"
                        value={previewDataMode}
                        onChange={setPreviewDataMode}
                        options={[
                          { value: 'direction', label: '1-N 测试数据' },
                          { value: 'realtime', label: '串口实时数据' },
                        ]}
                      />
                    </section>
                  </div>

                  <div className="matrix-display-setting">
                    <div className="matrix-display-setting-heading">
                      <div><span>显示方式</span><strong>{selectedDisplayTemplate?.label || '未选择'}</strong></div>
                      <small>只改变画面，不改变形状和原始数据</small>
                    </div>
                    <div className="matrix-mode-picker" role="radiogroup" aria-label="矩阵展示形式">
                      {MATRIX_DISPLAY_MODES.map((template) => {
                        const selected = template.id === displayTemplate;
                        return (
                          <button
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            className={selected ? 'is-selected' : ''}
                            key={template.id}
                            disabled={readOnly}
                            onClick={() => applyDisplayTemplate(template.id)}
                          >
                            <DisplayTemplatePreview rendererId={template.rendererId || 'heatmap'} />
                            <strong>{template.label}</strong>
                            {selected ? <CheckCircleFilled /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="render-live-preview matrix-primary-preview">
                    <div className="render-live-preview-heading">
                      <span>结果预览</span>
                      <strong>{rendererOptions.find((item) => item.value === rendererId)?.label || rendererId}</strong>
                      <em className={previewUsesDirectionData ? 'is-direction-check' : 'is-realtime'}>
                        {previewUsesDirectionData
                          ? (pointCount > 0 ? `测试数据 1-${pointCount}` : '等待形状')
                          : (realtimePreviewValues.length ? '串口实时数据' : '等待串口')}
                      </em>
                    </div>
                      <DisplayCanvasConfigurator
                        value={canvasConfig}
                        onChange={updateCanvasConfig}
                        renderers={availableRenderers}
                      sourceOptions={configuredSensorPlan.map((sensor) => ({
                        value: sensor.outputChannel,
                        label: `${sensor.label} (${sensor.id})`,
                      }))}
                      defaultSource={activeSensorDraft?.sensor?.outputChannel || activeSensorId || ''}
                      resolveSourceValue={resolveBuilderSourceValue}
                      colormapIds={catalog?.colormaps?.map((item) => item.id) || null}
                      readOnly={readOnly}
                      emptyState={(
                        <div className="canvas-empty-state">
                          {previewUsesDirectionData ? (
                            <>
                              <strong>先设置形状</strong>
                              <small>导入坐标文件后，这里会立即显示 1 到点位总数。</small>
                            </>
                          ) : (
                            <>
                              <strong>等待串口数据</strong>
                              <small>串口解码出一帧数据后，这里会立即显示。</small>
                            </>
                          )}
                        </div>
                      )}
                    >
                      {previewCards.length ? (
                        <div className="manifest-widget-grid">
                          {previewCards.map(({
                            widget,
                            values,
                            matrix: cardMatrix,
                            coordinateMap: cardCoordinateMap,
                            layout,
                            metrics,
                            channel,
                            rawValues,
                            sourceSensor,
                            channels,
                          }) => {
                            if (widget.type === 'pressureStats') {
                              return (
                                <StatsWidget
                                  key={widget.id}
                                  label={widget.label || widget.id}
                                  metrics={metrics}
                                  columnSpan={widget.columnSpan}
                                />
                              );
                            }
                            if (!['heatmap', 'matrix', 'raw2d'].includes(widget.type)) {
                              if (parseAgentRendererId(widget.type)) {
                                const outputChannel = sourceSensor?.outputChannel
                                  || sourceSensor?.id
                                  || channel;
                                const sensorId = sourceSensor?.id || outputChannel;
                                return (
                                  <div
                                    key={widget.id}
                                    className="manifest-widget-slot builder-plugin-preview"
                                    style={{ gridColumn: `span ${widget.columnSpan || 12}` }}
                                  >
                                    <AgentRendererHost
                                      rendererId={widget.type}
                                      app={agentRendererById.get(widget.type)}
                                      registryLoading={agentRendererRegistry.status === 'loading'}
                                      registryError={agentRendererRegistry.error}
                                      widgetId={widget.id}
                                      label={widget.label || widget.id}
                                      identity={{
                                        displaySystemId: systemId || '',
                                        sensorId,
                                        sensorLabel: sourceSensor?.label || sensorId,
                                        sensorType: sourceSensor?.type || sensorType || '',
                                        outputChannel,
                                        channelId: systemId && sensorId ? `${systemId}:${sensorId}` : sensorId,
                                      }}
                                      values={values}
                                      rawValues={rawValues}
                                      matrix={cardMatrix}
                                      metrics={metrics}
                                      algorithmMetrics={{}}
                                      serial={null}
                                      channels={channels}
                                    />
                                  </div>
                                );
                              }
                              return (
                                <div
                                  key={widget.id}
                                  className="manifest-widget-slot builder-plugin-preview"
                                  style={{ gridColumn: `span ${widget.columnSpan || 12}` }}
                                >
                                  <RendererHost
                                    rendererId={widget.type}
                                    label={widget.label || widget.id}
                                    params={buildManifestWidgetRendererParams({
                                      rendererId: widget.type,
                                      params: selectedRendererDefinition?.params,
                                      matrix: cardMatrix,
                                      coordinateMap: cardCoordinateMap,
                                    })}
                                    values={values}
                                    channel={channel}
                                    coordinateMap={cardCoordinateMap}
                                    local
                                  />
                                </div>
                              );
                            }
                            if (layout) {
                              return (
                                <CoordinatePointWidget
                                  key={widget.id}
                                  label={widget.label || widget.id}
                                  layout={layout}
                                  values={values}
                                  showValues={widget.type !== 'heatmap'}
                                  columnSpan={widget.columnSpan}
                                  colormap={previewColormap}
                                  overlays={previewOverlays}
                                />
                              );
                            }
                            return (
                              <MatrixWidget
                                key={widget.id}
                                label={widget.label || widget.id}
                                matrix={cardMatrix}
                                values={values}
                                showValues={widget.type !== 'heatmap' && values.length <= 1024}
                                columnSpan={widget.columnSpan}
                                colormap={previewColormap}
                                overlays={previewOverlays}
                              />
                            );
                          })}
                        </div>
                      ) : null}
                    </DisplayCanvasConfigurator>
                    <small>
                      {matrixInfo
                        ? `${matrixInfo.rows} × ${matrixInfo.cols} 原始矩阵 → ${renderMatrixInfo.rows} × ${renderMatrixInfo.cols} 渲染矩阵`
                        : '形状文件同时决定矩阵尺寸、点位数量和方向'}
                    </small>
                  </div>

                  <details className="render-main-controls render-advanced-controls matrix-render-advanced">
                        <summary>
                          <SettingOutlined />
                          <span><strong>高级显示设置</strong><small>插值、缩小、过滤和数据面板</small></span>
                        </summary>
                        <div className="form-grid render-fields-grid">
                          <Form.Item name="profileLabel" label="方案名称"><Input /></Form.Item>
                          <Form.Item
                            name="rendererId"
                            label="默认渲染器"
                            extra={agentRendererRegistry.error || 'Agent 渲染器在受限 iframe 中运行'}
                          >
                            <Select options={rendererOptions} onChange={applyRendererId} />
                          </Form.Item>
                          <Form.Item name="visualizationAlgorithmId" label="可视算法"><Select options={visualizationOptions} /></Form.Item>
                          <Form.Item className="matrix-transform-field" name="matrixTransformType" label="矩阵展示方式">
                            <Segmented
                              block
                              options={[
                                { value: 'none', label: '原始点位' },
                                { value: 'interpolate', label: '双线性插值' },
                                { value: 'downsample', label: '平均缩小' },
                              ]}
                              onChange={applyMatrixTransformType}
                            />
                          </Form.Item>
                          {matrixTransformType === 'interpolate' ? (
                            <Form.Item name="matrixTransformFactor" label="插值倍率">
                              <Select options={[{ value: 2, label: '2 倍' }, { value: 4, label: '4 倍' }]} />
                            </Form.Item>
                          ) : null}
                          {matrixTransformType === 'downsample' ? (
                            <Form.Item name="matrixTransformFactor" label="缩小比例">
                              <Select options={[{ value: 0.5, label: '缩小为 1/2' }, { value: 0.25, label: '缩小为 1/4' }]} />
                            </Form.Item>
                          ) : null}
                          {visualizationAlgorithmId === 'normalize' ? <Form.Item name="normalizeMax" label="归一化最大值"><InputNumber min={1} /></Form.Item> : null}
                          {visualizationAlgorithmId === 'threshold' ? <Form.Item name="threshold" label="过滤阈值"><InputNumber min={0} /></Form.Item> : null}
                          {visualizationAlgorithmId === 'smooth' ? <Form.Item name="smoothRadius" label="平滑半径"><InputNumber min={1} max={4} /></Form.Item> : null}
                        </div>
                        <div className="render-widget-toggles">
                          <Form.Item name="showPressurePanel" valuePropName="checked"><Checkbox>压力数据图表</Checkbox></Form.Item>
                          <Form.Item name="showAreaPanel" valuePropName="checked"><Checkbox>受压面积图表</Checkbox></Form.Item>
                        </div>
                  </details>

                  <details className="advanced-config module-advanced">
                    <summary>
                      <span className="advanced-summary-title">
                        <SettingOutlined />
                        <span><strong>渲染与指标细节</strong><small>左侧面板字段、面积参数和算法命名输出</small></span>
                      </span>
                      <span className="advanced-toggle" />
                    </summary>
                    <div className="advanced-config-content">
                      <div className="advanced-group">
                        <div className="advanced-group-heading"><h3>左侧数据面板</h3><p>基础统计始终读取 normalizedData，不受渲染滤镜影响。</p></div>
                        <div className="form-grid four-columns">
                          {showPressurePanel ? <>
                            <Form.Item name="pressurePanelTitle" label="压力面板标题"><Input /></Form.Item>
                            <Form.Item name="primaryMetric" label="主指标"><Select options={sidebarMetricOptions} /></Form.Item>
                            <Form.Item name="pressureMetrics" label="压力指标"><Select mode="multiple" options={sidebarMetricOptions} /></Form.Item>
                          </> : null}
                          {showAreaPanel ? <>
                            <Form.Item name="areaPanelTitle" label="区域面板标题"><Input /></Form.Item>
                            <Form.Item name="areaMetrics" label="区域指标"><Select mode="multiple" options={sidebarMetricOptions} /></Form.Item>
                            <Form.Item name="activeThreshold" label="有效点阈值"><InputNumber min={0} /></Form.Item>
                            <Form.Item name="pointArea" label="单点面积"><InputNumber min={0} step={0.1} /></Form.Item>
                            <Form.Item name="areaUnit" label="面积单位"><Input placeholder="cm²" /></Form.Item>
                          </> : null}
                        </div>
                      </div>
                      <div className="algorithm-metric-editor">
                        <div className="algorithm-metric-heading">
                          <div><strong>算法输出指标</strong><span>聚合结果随实时帧输出，也可以设为左侧主指标。</span></div>
                        </div>
                        <Form.List name="algorithmMetrics">
                          {(fields, { add, remove }) => (
                            <>
                              {fields.map((field) => (
                                <div className="algorithm-metric-row" key={field.key}>
                                  <Form.Item
                                    name={[field.name, 'id']}
                                    label="输出 Key"
                                    rules={[
                                      { required: true },
                                      { pattern: /^[A-Za-z][A-Za-z0-9._-]*$/, message: '使用字母开头，只允许字母、数字、点、下划线和连字符' },
                                    ]}
                                  ><Input placeholder="supportRate" /></Form.Item>
                                  <Form.Item name={[field.name, 'label']} label="显示名称" rules={[{ required: true }]}><Input placeholder="支撑率" /></Form.Item>
                                  <Form.Item name={[field.name, 'operation']} label="算法" rules={[{ required: true }]}><Select options={ALGORITHM_METRIC_OPERATION_OPTIONS} /></Form.Item>
                                  <Form.Item name={[field.name, 'panel']} label="显示位置"><Select options={[
                                    { value: 'pressure', label: '压力数据' },
                                    { value: 'area', label: '受压区域' },
                                    { value: 'both', label: '两个面板' },
                                  ]} /></Form.Item>
                                  <Form.Item name={[field.name, 'threshold']} label="阈值"><InputNumber /></Form.Item>
                                  <Form.Item name={[field.name, 'scale']} label="结果乘数"><InputNumber step={0.1} /></Form.Item>
                                  <Form.Item name={[field.name, 'offset']} label="结果偏移"><InputNumber step={0.1} /></Form.Item>
                                  <Form.Item name={[field.name, 'unit']} label="单位"><Input placeholder="%" /></Form.Item>
                                  <Form.Item name={[field.name, 'decimals']} label="小数位"><InputNumber min={0} max={6} /></Form.Item>
                                  <Button
                                    className="algorithm-metric-remove"
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    title="删除算法指标"
                                    aria-label="删除算法指标"
                                    onClick={() => remove(field.name)}
                                  />
                                </div>
                              ))}
                              <Button
                                icon={<PlusOutlined />}
                                onClick={() => {
                                  form.setFieldValue('backendAlgorithm', 'json');
                                  add({
                                    operation: 'sum',
                                    panel: 'pressure',
                                    threshold: 0,
                                    scale: 1,
                                    offset: 0,
                                    decimals: 2,
                                  });
                                }}
                              >添加算法输出</Button>
                            </>
                          )}
                        </Form.List>
                      </div>
                    </div>
                  </details>

                  <div className="module-footer">
                    <Button icon={<LeftOutlined />} onClick={() => setActiveStep('mapping')}>返回传感器映射</Button>
                    <span>{readOnly ? '系统内置配置仅供查看。' : '保存后会立即加载到主界面。'}</span>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={saving}
                      disabled={readOnly || protocolDetectionInProgress}
                      onClick={save}
                    >
                      {readOnly
                        ? '系统配置只读'
                        : (protocolDetectionInProgress ? '等待协议识别' : '保存并显示')}
                    </Button>
                  </div>
              </section>
              </div>
            </div>
          </div>
        </Form>
      </main>

      <aside className="configuration-summary" aria-label="配置摘要">
        <div className="summary-heading">
          <h2>配置摘要</h2>
          <div className={completedStepCount === 3 ? 'summary-status is-ready' : 'summary-status'}>
            {completedStepCount === 3 ? <CheckCircleFilled /> : <span>{completedStepCount}/3</span>}
            <strong>{completedStepCount === 3 ? '配置已验证' : `还需完成 ${3 - completedStepCount} 步`}</strong>
          </div>
        </div>

        <dl className="summary-values">
          <div><dt>数据协议</dt><dd>{selectedSerialTemplate?.label || '未选择'}</dd></div>
          <div><dt>串口角色</dt><dd>{ports?.length ? ports.map((role) => SERIAL_ROLE_LABELS[role] || role).join(' / ') : '未选择'}</dd></div>
          <div><dt>波特率</dt><dd>{baudRate ? Number(baudRate).toLocaleString() : '未设置'}</dd></div>
          <div><dt>数据精度</dt><dd>{dataBits ? `${dataBits} Bit` : '未设置'}</dd></div>
          <div><dt>分帧方式</dt><dd>{framingType === 'delimiter' ? '分隔符' : '固定长度'}</dd></div>
          <div><dt>帧长度</dt><dd>{payloadBytes ? `${payloadBytes} 字节` : '待计算'}</dd></div>
          <div><dt>数据点数</dt><dd>{pointCount ? `${pointCount} 点` : '待导入'}</dd></div>
          <div>
            <dt>显示矩阵</dt>
            <dd>{renderMatrixInfo ? `${renderMatrixInfo.rows} × ${renderMatrixInfo.cols}` : '待导入'}</dd>
          </div>
          <div><dt>矩阵形式</dt><dd>{selectedDisplayTemplate?.label || '未选择'}</dd></div>
        </dl>

        <p className="summary-footnote">
          {readOnly
            ? '系统内置展示系统只能查看，不能覆盖修改。'
            : '保存后自动加载到主界面，无需重启软件。'}
        </p>
      </aside>
    </div>

    <Modal
      className="display-builder-modal"
      open={createModalOpen}
      title="新建展示系统"
      okText="创建并配置"
      cancelText="取消"
      onOk={createDraft}
      onCancel={() => setCreateModalOpen(false)}
    >
      <p className="display-builder-modal-intro">先填写基础身份和数据通道。创建草稿后导入矩阵点位文件，矩阵尺寸无需手动设置。</p>
      <Form form={createForm} layout="vertical" requiredMark={false}>
        <div className="display-builder-modal-grid">
          <Form.Item name="name" label="展示名称" rules={[{ required: true, message: '请输入展示名称' }]}>
            <Input placeholder="例如：座椅压力分布" autoFocus />
          </Form.Item>
          <Form.Item
            name="sensorType"
            label="传感器类型"
            rules={[
              { required: true, message: '请输入传感器类型' },
              { pattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/, message: '仅允许字母、数字、点、下划线和连字符' },
            ]}
          >
            <Input placeholder="例如：customSeat" />
          </Form.Item>
          <Form.Item
            name="id"
            label="系统 ID"
            rules={[
              { required: true, message: '请输入系统 ID' },
              { pattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/, message: '仅允许字母、数字、点、下划线和连字符' },
            ]}
          >
            <Input placeholder="例如：custom-seat" />
          </Form.Item>
          <Form.Item
            name="ports"
            label="传感器 ID / 串口角色"
            rules={[
              { required: true, message: '请至少配置一个传感器 ID' },
              {
                validator: (_, value) => {
                  const invalid = getInvalidBuilderSensorIds(value);
                  return invalid.length
                    ? Promise.reject(new Error(`ID 仅允许字母、数字、点、下划线和连字符：${invalid.join('、')}`))
                    : Promise.resolve();
                },
              },
            ]}
          >
            <Select
              mode="tags"
              tokenSeparators={[',', '，']}
              onChange={(nextPorts) => createForm.setFieldValue(
                'ports',
                [...new Set(nextPorts.map((port) => String(port || '').trim()).filter(Boolean))],
              )}
              options={(catalog?.serialRoles || []).map((role) => ({
                value: role,
                label: `${SERIAL_ROLE_LABELS[role] || role} (${role})`,
              }))}
            />
          </Form.Item>
          {(createPorts || []).map((role) => (
            <Form.Item
              key={`create-port-label-${role}`}
              name={['portLabels', role]}
              label={`${SERIAL_ROLE_LABELS[role] || role}业务名称`}
            >
              <Input placeholder="例如：左手、右手、座椅或靠背" />
            </Form.Item>
          ))}
        </div>
      </Form>
    </Modal>

    </>
  );
}
