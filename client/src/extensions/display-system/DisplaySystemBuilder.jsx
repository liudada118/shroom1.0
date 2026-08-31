import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { buildCoordinatePointLayout } from './coordinatePointLayout';
import { calculatePressureMetrics } from './displayProfileRuntime';
import { applyMatrixTransform } from '../../displays/matrixTransform';
import { DEFAULT_COLORMAP_ID } from './colormaps';
import RendererHost from '../../renderers/RendererHost.jsx';
import { readManifestChannelFrames } from './manifestSceneAdapter.js';
import {
  buildBuilderPortViews,
  buildBuilderSensorPlan,
  buildBuilderSensors,
  buildPortLabels,
  ensureBuilderPortWidgets,
} from './builderMultiSensor.js';
import './DisplaySystemBuilder.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:19245';

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
  dataBits: 8,
  valueType: 'uint8',
  byteOffset: 0,
  valueCount: null,
  // 帧校验默认关闭：帧头留空、校验算法选 none，行为与引入这组字段之前一致。
  validationHeader: '',
  checksumType: 'none',
  checksumByteOffset: -1,
  checksumRangeStart: 0,
  checksumRangeEnd: -1,
  lineOrderMode: 'identity',
  lineOrderJson: '',
  pointOrderJson: '',
  coordinateMapJson: '',
  backendAlgorithm: 'none',
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

async function requestJson(path, options) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(payload.details) && payload.details.length
      ? `：${payload.details.join('；')}`
      : '';
    throw new Error(`${payload.error || `HTTP ${response.status}`}${details}`);
  }
  return payload;
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
  const display = manifest.display || {};
  const profile = display.profiles?.find((item) => item.id === display.defaultProfile)
    || display.profiles?.[0]
    || {};
  const algorithmData = editor?.definitions?.algorithmData || {};
  const algorithmMetricDefinitions = new Map(
    (display.sidebar?.algorithmMetrics || []).map((metric) => [metric.id, metric]),
  );
  const algorithmMetrics = (algorithmData.metrics || []).map((metric) => {
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
    dataBits: primaryProtocol.decoding?.valueType?.includes('16') ? 12 : 8,
    valueType: primaryProtocol.decoding?.valueType || 'uint8',
    byteOffset: primaryProtocol.decoding?.byteOffset || 0,
    valueCount: pointOrderInfo?.pointCount || primaryProtocol.decoding?.valueCount || null,
    validationHeader: formatByteSequence(primaryProtocol.validation?.header),
    checksumType: primaryProtocol.validation?.checksum?.type || 'none',
    checksumByteOffset: primaryProtocol.validation?.checksum?.byteOffset ?? -1,
    checksumRangeStart: primaryProtocol.validation?.checksum?.range?.[0] ?? 0,
    checksumRangeEnd: primaryProtocol.validation?.checksum?.range?.[1] ?? -1,
    lineOrderMode: manifest.metadata?.builder?.lineOrderMode
      || (editor?.definitions?.lineOrder ? 'custom' : 'identity'),
    lineOrderJson: editor?.definitions?.lineOrder ? JSON.stringify(editor.definitions.lineOrder, null, 2) : '',
    pointOrderJson: pointOrderInfo ? JSON.stringify(pointOrderInfo.definition, null, 2) : '',
    coordinateMapJson: coordinateMapInfo ? JSON.stringify(coordinateMapInfo.definition, null, 2) : '',
    backendAlgorithm: isCodeAlgorithm ? 'code' : algorithmType,
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

export default function DisplaySystemBuilder({ embedded = false, onActivated, onClose }) {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const [catalog, setCatalog] = useState(null);
  const [systems, setSystems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editorAccess, setEditorAccess] = useState(null);
  const [activeStep, setActiveStep] = useState('connection');
  const systemId = Form.useWatch('id', form);
  const systemName = Form.useWatch('name', form);
  const sensorType = Form.useWatch('sensorType', form);
  const framingType = Form.useWatch('framingType', form);
  const checksumType = Form.useWatch('checksumType', form);
  const delimiter = Form.useWatch('delimiter', form);
  const frameLength = Form.useWatch('frameLength', form);
  const baudRate = Form.useWatch('baudRate', form);
  const dataBits = Form.useWatch('dataBits', form);
  const ports = Form.useWatch('ports', form);
  const createPorts = Form.useWatch('ports', createForm);
  const lineOrderMode = Form.useWatch('lineOrderMode', form);
  const pointOrderJson = Form.useWatch('pointOrderJson', form);
  const coordinateMapJson = Form.useWatch('coordinateMapJson', form);
  const backendAlgorithm = Form.useWatch('backendAlgorithm', form);
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

  const loadIndex = useCallback(async () => {
    const [systemsPayload, catalogPayload] = await Promise.all([
      requestJson('/api/display-systems'),
      requestJson('/api/display-systems/catalog'),
    ]);
    setSystems(systemsPayload.displaySystems?.systems || []);
    setCatalog(catalogPayload.catalog || {});
  }, []);

  useEffect(() => {
    loadIndex()
      .catch((error) => message.error(error.message))
      .finally(() => setLoading(false));
  }, [loadIndex]);

  const startNew = useCallback(() => {
    createForm.resetFields();
    createForm.setFieldsValue({
      id: '',
      name: '',
      sensorType: '',
      ports: ['sit'],
    });
    setEditorAccess(null);
    setCreateModalOpen(true);
  }, [createForm]);

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
      setActiveStep('connection');
      setPreviewDataMode('direction');
      form.setFieldsValue({
        ...DEFAULT_VALUES,
        ...values,
      });
      setCreateModalOpen(false);
      message.success('已创建配置草稿，请导入传感器形状坐标文件后继续配置');
    } catch (error) {
      if (!error?.errorFields) message.error(error.message);
    }
  }, [createForm, form, systems]);

  const editSystem = useCallback(async (id) => {
    setLoading(true);
    try {
      const payload = await requestJson(`/api/display-systems/${encodeURIComponent(id)}/editor`);
      setSelectedId(id);
      setEditorAccess({
        editable: payload.editor?.editable === true,
        origin: payload.editor?.origin || 'system',
      });
      setActiveStep('connection');
      setPreviewDataMode('direction');
      form.setFieldsValue(buildFormValues(payload.editor));
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [form]);

  const rendererOptions = useMemo(
    () => MATRIX_DISPLAY_MODES.map((item) => ({
      value: item.rendererId,
      label: item.label,
    })),
    [],
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
  const selectedRendererDefinition = useMemo(
    () => matrixRenderers.find((item) => item.id === rendererId),
    [matrixRenderers, rendererId],
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
  // 预览通道就是第一个串口的数据通道；多口系统在这里只验证主通道，
  // 其余通道由保存后的运行时界面按 sensors[] 各自渲染。
  const previewChannel = ports?.[0] || 'sit';
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
  const previewLayout = useMemo(
    () => buildCoordinatePointLayout(coordinateMapInfo?.definition),
    [coordinateMapInfo],
  );
  const previewMetrics = useMemo(
    () => calculatePressureMetrics(previewValues),
    [previewValues],
  );
  // 画布上的卡片和运行时用的是同一批组件，配置时看到什么、保存后就是什么。
  const previewCards = useMemo(() => {
    const widgets = canvasConfig?.widgets || [];
    if (!widgets.length || !previewValues.length) return [];
    const sourceMatrix = matrixInfo
      ? { rows: matrixInfo.rows, cols: matrixInfo.cols }
      : { rows: 1, cols: previewValues.length };
    const transformed = applyMatrixTransform(previewValues, sourceMatrix, {
      type: matrixTransformType || 'none',
      factor: Number(matrixTransformFactor) || 1,
    });
    return widgets.map((widget) => ({
      widget,
      values: widget.type === 'pressureStats' ? previewValues : transformed.values,
      matrix: transformed.matrix,
    }));
  }, [canvasConfig, matrixInfo, matrixTransformFactor, matrixTransformType, previewValues]);
  const previewColormap = canvasConfig?.colormap || { id: DEFAULT_COLORMAP_ID };
  const previewOverlays = useMemo(
    () => new Set(canvasConfig?.overlays || []),
    [canvasConfig],
  );
  const bytesPerValue = Number(dataBits) === 12 ? 2 : 1;
  const payloadBytes = framingType === 'fixedLength'
    ? (Number(frameLength) || pointCount * bytesPerValue)
    : pointCount * bytesPerValue;
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
      form.setFieldsValue({
        coordinateMapJson: JSON.stringify(coordinateInfo.definition, null, 2),
        pointOrderJson: JSON.stringify(pointInfo.definition, null, 2),
        valueCount: pointInfo.pointCount,
        ...(form.getFieldValue('framingType') === 'fixedLength'
          ? { frameLength: pointInfo.pointCount * (dataBitsValue === 12 ? 2 : 1) }
          : {}),
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

  const applySerialTemplate = useCallback((templateId) => {
    const template = catalog?.serialTemplates?.find((item) => item.id === templateId);
    if (!template) return;
    const defaults = template.defaults || {};
    const total = getFormPointCount(form);
    form.setFieldsValue({
      serialTemplate: templateId,
      transportType: defaults.transportType || 'binary',
      baudRate: defaults.baudRate,
      framingType: defaults.framingType,
      delimiter: defaults.delimiter,
      frameLength: defaults.framingType === 'fixedLength' && total
        ? total * (defaults.bytesPerValue || 1)
        : form.getFieldValue('frameLength'),
      valueType: defaults.valueType,
      dataBits: defaults.dataBits || 8,
      byteOffset: defaults.byteOffset || 0,
      valueCount: total || form.getFieldValue('valueCount'),
    });
  }, [catalog, form]);

  const applyFramingType = useCallback((nextFramingType) => {
    const total = getFormPointCount(form);
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
  }, [form]);

  const applyDataBits = useCallback((dataBits) => {
    const total = getFormPointCount(form);
    form.setFieldsValue({
      dataBits,
      valueType: dataBits === 12 ? 'uint16le' : 'uint8',
      valueCount: total || form.getFieldValue('valueCount'),
      frameLength: form.getFieldValue('framingType') === 'fixedLength' && total
        ? total * (dataBits === 12 ? 2 : 1)
        : form.getFieldValue('frameLength'),
    });
  }, [form]);

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

  const updateCanvasConfig = useCallback((next) => {
    form.setFieldsValue({ canvasConfig: next });
  }, [form]);

  const getCodeTemplate = useCallback((language) => (
    catalog?.codeLanguages?.find((item) => item.id === language)?.template || ''
  ), [catalog]);

  const applyAlgorithmMode = useCallback((mode) => {
    const next = { backendAlgorithm: mode };
    if (mode === 'code' && !String(form.getFieldValue('algorithmSource') || '').trim()) {
      const language = form.getFieldValue('algorithmLanguage') || 'js';
      next.algorithmLanguage = language;
      next.algorithmSource = getCodeTemplate(language);
    }
    form.setFieldsValue(next);
  }, [form, getCodeTemplate]);

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
    form.setFieldsValue({
      ...(effectivePointOrder !== pointOrderInfo
        ? { pointOrderJson: JSON.stringify(effectivePointOrder.definition, null, 2) }
        : {}),
      valueCount: effectivePointOrder.pointCount,
      ...(framingType === 'fixedLength'
        ? { frameLength: effectivePointOrder.pointCount * (currentDataBits === 12 ? 2 : 1) }
        : {}),
    });
  }, [coordinateMapInfo, dataBits, form, framingType, pointOrderInfo]);

  const save = useCallback(async () => {
    if (readOnly) {
      message.error('系统内置展示系统为只读，不能覆盖保存');
      return;
    }
    setSaving(true);
    try {
      const values = await form.validateFields();
      const algorithmType = values.backendAlgorithm === 'code'
        ? values.algorithmLanguage
        : values.backendAlgorithm;
      const normalizedCoordinateMap = values.coordinateMapJson
        ? normalizeCoordinateMapDefinition(values.coordinateMapJson)
        : null;
      let normalizedPointOrder = values.pointOrderJson
        ? normalizePointOrderDefinition(values.pointOrderJson)
        : null;
      if (!normalizedPointOrder && normalizedCoordinateMap) {
        normalizedPointOrder = normalizePointOrderDefinition(
          createIdentityPointOrder(normalizedCoordinateMap.rows, normalizedCoordinateMap.cols),
        );
      }
      if (!normalizedPointOrder) {
        throw new Error('请先导入传感器形状坐标文件');
      }
      if (normalizedCoordinateMap && (
        normalizedCoordinateMap.rows !== normalizedPointOrder.rows
        || normalizedCoordinateMap.cols !== normalizedPointOrder.cols
      )) {
        throw new Error('形状坐标尺寸必须与点位顺序尺寸一致');
      }
      const normalizedMatrix = normalizedCoordinateMap || normalizedPointOrder;
      // 帧校验整段可选：帧头和校验算法都没填就不写 validation 字段，
      // 让协议层继续走「不校验」的老路径。
      const hasChecksum = values.checksumType && values.checksumType !== 'none';
      const trimmedHeader = String(values.validationHeader || '').trim();
      const frameValidation = trimmedHeader || hasChecksum
        ? {
          ...(trimmedHeader ? { header: trimmedHeader } : {}),
          ...(hasChecksum
            ? {
              checksum: {
                type: values.checksumType,
                byteOffset: values.checksumByteOffset ?? -1,
                range: [values.checksumRangeStart ?? 0, values.checksumRangeEnd ?? -1],
              },
            }
            : {}),
        }
        : null;
      const primaryPort = values.ports[0] || 'sit';
      const portLabels = buildPortLabels(values.ports, values.portLabels);
      const sensorPlan = buildBuilderSensorPlan({
        displaySystemId: values.id,
        ports: values.ports,
        portLabels,
      });
      // 画布是 widget 的唯一真相。已经显式指向某路的 source 原样保留，
      // 尚未出现的串口则自动补一个数据 widget，不再全部挤到主路。
      const canvas = values.canvasConfig?.widgets?.length
        ? values.canvasConfig
        : buildDefaultCanvasConfig({
          rendererId: values.rendererId,
          showStats: true,
          source: `${primaryPort}Data`,
        });
      const widgets = ensureBuilderPortWidgets({
        widgets: canvas.widgets,
        sensorPlan,
        rendererId: values.rendererId,
      });
      const displayRenderers = createMatrixDisplayRenderers({
        matrix: { rows: normalizedMatrix.rows, cols: normalizedMatrix.cols },
        coordinateMap: normalizedCoordinateMap?.definition,
      });
      const displayViews = buildBuilderPortViews(displayRenderers, sensorPlan);

      const visualizationAlgorithms = (catalog.visualizationAlgorithms || []).map((algorithm) => {
        const options = { ...(algorithm.options || {}) };
        if (algorithm.id === 'normalize') options.max = values.normalizeMax;
        if (algorithm.id === 'threshold') options.threshold = values.threshold;
        if (algorithm.id === 'smooth') options.radius = values.smoothRadius;
        return { ...algorithm, options };
      });
      const configuredAlgorithmMetrics = (values.algorithmMetrics || [])
        .filter((metric) => metric?.id)
        .map((metric) => ({ ...metric, id: metric.id.trim() }));
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
      const matrixDefinition = {
        rows: normalizedMatrix.rows,
        cols: normalizedMatrix.cols,
      };
      const fileDefinition = {
        lineOrder: 'line-order.json',
        pointOrder: 'point-order.json',
        ...(normalizedCoordinateMap ? { coordinateMap: 'coordinate-map.json' } : {}),
      };
      const protocolDefinition = {
        baudRate: values.baudRate,
        framing: values.framingType === 'delimiter'
          ? { type: 'delimiter', delimiter: values.delimiter }
          : { type: 'fixedLength', frameLength: values.frameLength },
        decoding: {
          valueType: values.valueType,
          byteOffset: values.byteOffset,
          valueCount: normalizedPointOrder.pointCount,
        },
        ...(frameValidation ? { validation: frameValidation } : {}),
      };
      const algorithmDefinition = algorithmType === 'json'
        ? {
          type: 'json',
          dataFile: 'algorithm-data.json',
          input: { source: 'rawData' },
          timeoutMs: values.algorithmTimeoutMs,
        }
        : algorithmType === 'js' || algorithmType === 'python'
          ? {
            type: algorithmType,
            entry: algorithmType === 'python' ? 'algorithm.py' : 'algorithm.js',
            input: { source: 'rawData' },
            timeoutMs: values.algorithmTimeoutMs,
          }
          : { type: 'none' };
      const sensors = buildBuilderSensors({
        displaySystemId: values.id,
        ports: sensorPlan.map((sensor) => sensor.id),
        portLabels,
        type: values.sensorType,
        matrix: matrixDefinition,
        files: fileDefinition,
        protocol: protocolDefinition,
        algorithm: algorithmDefinition,
        stored: true,
      });
      const manifest = {
        schemaVersion: 3,
        id: values.id,
        name: values.name,
        version: values.version,
        description: 'Created with Display System Builder',
        sensors,
        // 顶层单数字段是给 v1/v2 调用方的兼容投影；逐路真相只在 sensors[]。
        sensor: {
          type: values.sensorType,
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
            source: `${primaryPort}Data`,
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
        },
        metadata: {
          runtimeMode: values.runtimeMode,
          createdBy: 'display-system-builder',
          builder: {
            lineOrderMode: values.lineOrderMode,
            pointOrderMode: normalizedCoordinateMap ? 'generated-row-major' : 'point-order-file',
            coordinateMapMode: normalizedCoordinateMap ? 'physical-coordinate-file' : 'regular-grid',
            serialTemplate: values.serialTemplate,
            displayTemplate: values.displayTemplate,
            transportType: values.transportType,
          },
        },
      };
      const definitions = {};
      if (values.lineOrderMode === 'custom') {
        definitions.lineOrder = parseDefinition(values.lineOrderJson, '线序');
      }
      definitions.pointOrder = normalizedPointOrder.definition;
      if (normalizedCoordinateMap) {
        definitions.coordinateMap = normalizedCoordinateMap.definition;
      }
      if (values.backendAlgorithm === 'json') {
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
      if (values.backendAlgorithm === 'code') {
        definitions.algorithmSource = values.algorithmSource;
      }

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
      await commandClient.execute('sensor.switch', { sensorType: values.sensorType });
      localStorage.setItem('file', values.sensorType);
      onActivated?.(values.sensorType);
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
  }, [catalog, embedded, form, loadIndex, navigate, onActivated, onClose, readOnly, selectedId]);

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

        <Form form={form} layout="vertical" initialValues={DEFAULT_VALUES} className="display-builder-form" disabled={readOnly}>
          <div className="display-builder-workspace">
            <div className="display-builder-primary">
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
                    <div className="form-grid serial-fields-grid">
                      <Form.Item className="serial-role-field" name="ports" label="串口角色" rules={[{ required: true }]}>
                        <Select
                          mode="multiple"
                          options={(catalog?.serialRoles || []).map((role) => ({
                            value: role,
                            label: `${SERIAL_ROLE_LABELS[role] || role} (${role})`,
                          }))}
                        />
                      </Form.Item>
                      {(ports || []).map((role) => (
                        <Form.Item
                          key={`port-label-${role}`}
                          name={['portLabels', role]}
                          label={`${SERIAL_ROLE_LABELS[role] || role}业务名称`}
                          tooltip={`写入 sensorLabel；例如左手、右手、座椅、靠背。物理 COM 口仍单独绑定到 ${role}。`}
                        >
                          <Input placeholder={SERIAL_ROLE_LABELS[role] || role} />
                        </Form.Item>
                      ))}
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
                    <Button type="primary" icon={<ArrowRightOutlined />} iconPosition="end" onClick={() => setActiveStep('mapping')}>
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
                          {backendAlgorithm === 'json' ? <>
                            <Form.Item name="scale" label="缩放"><InputNumber step={0.1} /></Form.Item>
                            <Form.Item name="offset" label="偏移"><InputNumber step={0.1} /></Form.Item>
                            <Form.Item name="zeroBelow" label="低值清零"><InputNumber min={0} /></Form.Item>
                            <Form.Item name="min" label="最小值"><InputNumber /></Form.Item>
                            <Form.Item name="max" label="最大值"><InputNumber /></Form.Item>
                          </> : null}
                        </div>
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
                      renderers={matrixRenderers}
                      colormapIds={catalog?.colormaps?.map((item) => item.id) || null}
                      readOnly={readOnly}
                      simple
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
                      {previewValues.length ? (
                        <div className="manifest-widget-grid">
                          {previewCards.map(({ widget, values, matrix: cardMatrix }) => {
                            if (widget.type === 'pressureStats') {
                              return (
                                <StatsWidget
                                  key={widget.id}
                                  label={widget.label || widget.id}
                                  metrics={previewMetrics}
                                  columnSpan={widget.columnSpan}
                                />
                              );
                            }
                            if (!['heatmap', 'matrix', 'raw2d'].includes(widget.type)) {
                              return (
                                <div
                                  key={widget.id}
                                  className="manifest-widget-slot builder-plugin-preview"
                                  style={{ gridColumn: `span ${widget.columnSpan || 12}` }}
                                >
                                  <RendererHost
                                    rendererId={widget.type}
                                    label={widget.label || widget.id}
                                    params={selectedRendererDefinition?.params}
                                    values={values}
                                    channel={previewChannel}
                                    local
                                  />
                                </div>
                              );
                            }
                            if (previewLayout) {
                              return (
                                <CoordinatePointWidget
                                  key={widget.id}
                                  label={widget.label || widget.id}
                                  layout={previewLayout}
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
                          <Form.Item name="rendererId" label="默认渲染器"><Select options={rendererOptions} /></Form.Item>
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
                      disabled={readOnly}
                      onClick={save}
                    >
                      {readOnly ? '系统配置只读' : '保存并显示'}
                    </Button>
                  </div>
              </section>
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
          <Form.Item name="ports" label="串口角色" rules={[{ required: true, message: '请选择串口角色' }]}>
            <Select
              mode="multiple"
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
