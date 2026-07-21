import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Select,
  Segmented,
  Space,
  Spin,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './DisplaySystemBuilder.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:19245';

const DEFAULT_VALUES = {
  id: '',
  name: '',
  serialTemplate: 'pressure-u8-tail',
  displayTemplate: 'heatmap-overview',
  version: '1.0.0',
  sensorType: '',
  rows: 32,
  cols: 32,
  ports: ['sit'],
  transportType: 'binary',
  baudRate: 921600,
  framingType: 'delimiter',
  frameLength: 1024,
  delimiter: 'AA 55 03 99',
  dataBits: 8,
  valueType: 'uint8',
  byteOffset: 0,
  valueCount: 1024,
  lineOrderMode: 'identity',
  pointOrderMode: 'identity',
  lineOrderJson: '',
  pointOrderJson: '',
  backendAlgorithm: 'none',
  algorithmMetrics: [],
  scale: 1,
  offset: 0,
  zeroBelow: 0,
  rendererId: 'heatmap',
  visualizationAlgorithmId: 'identity',
  normalizeMax: 100,
  threshold: 20,
  smoothRadius: 1,
  profileLabel: '默认方案',
  showStats: true,
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

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null));
}

function inferSerialTemplate(manifest = {}) {
  if (manifest.metadata?.builder?.serialTemplate) {
    return manifest.metadata.builder.serialTemplate;
  }
  if (manifest.protocol?.framing?.type === 'fixedLength') {
    return 'pressure-fixed-length';
  }
  return manifest.protocol?.decoding?.valueType?.includes('16')
    ? 'pressure-adc16-tail'
    : 'pressure-u8-tail';
}

function buildFormValues(editor) {
  const manifest = editor?.manifest || {};
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
  return {
    ...DEFAULT_VALUES,
    id: manifest.id || '',
    name: manifest.name || '',
    version: manifest.version || '1.0.0',
    sensorType: manifest.sensor?.type || '',
    serialTemplate: inferSerialTemplate(manifest),
    displayTemplate: manifest.metadata?.builder?.displayTemplate
      || (profile.renderer === 'matrix' ? 'numeric-matrix' : 'heatmap-overview'),
    rows: manifest.sensor?.matrix?.rows || 32,
    cols: manifest.sensor?.matrix?.cols || 32,
    ports: manifest.sensor?.ports || ['sit'],
    transportType: manifest.metadata?.builder?.transportType || 'binary',
    baudRate: manifest.protocol?.baudRate || 921600,
    framingType: manifest.protocol?.framing?.type || 'fixedLength',
    frameLength: manifest.protocol?.framing?.frameLength || 1024,
    delimiter: (manifest.protocol?.framing?.delimiter || []).map((byte) => byte.toString(16).padStart(2, '0')).join(' '),
    dataBits: manifest.protocol?.decoding?.valueType?.includes('16') ? 12 : 8,
    valueType: manifest.protocol?.decoding?.valueType || 'uint8',
    byteOffset: manifest.protocol?.decoding?.byteOffset || 0,
    valueCount: manifest.protocol?.decoding?.valueCount || null,
    lineOrderMode: manifest.metadata?.builder?.lineOrderMode
      || (editor?.definitions?.lineOrder ? 'custom' : 'identity'),
    pointOrderMode: manifest.metadata?.builder?.pointOrderMode
      || (editor?.definitions?.pointOrder ? 'custom' : 'identity'),
    lineOrderJson: editor?.definitions?.lineOrder ? JSON.stringify(editor.definitions.lineOrder, null, 2) : '',
    pointOrderJson: editor?.definitions?.pointOrder ? JSON.stringify(editor.definitions.pointOrder, null, 2) : '',
    backendAlgorithm: manifest.algorithm?.type || 'none',
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
    profileLabel: profile.label || '默认方案',
    showStats: display.widgets?.some((widget) => widget.type === 'pressureStats') ?? true,
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

export default function DisplaySystemBuilder() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [catalog, setCatalog] = useState(null);
  const [systems, setSystems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const framingType = Form.useWatch('framingType', form);
  const lineOrderMode = Form.useWatch('lineOrderMode', form);
  const pointOrderMode = Form.useWatch('pointOrderMode', form);
  const backendAlgorithm = Form.useWatch('backendAlgorithm', form);
  const algorithmMetrics = Form.useWatch('algorithmMetrics', form);
  const visualizationAlgorithmId = Form.useWatch('visualizationAlgorithmId', form);
  const serialTemplate = Form.useWatch('serialTemplate', form);
  const displayTemplate = Form.useWatch('displayTemplate', form);
  const rows = Form.useWatch('rows', form);
  const cols = Form.useWatch('cols', form);
  const showPressurePanel = Form.useWatch('showPressurePanel', form);
  const showAreaPanel = Form.useWatch('showAreaPanel', form);

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
    setSelectedId(null);
    form.setFieldsValue(DEFAULT_VALUES);
  }, [form]);

  const editSystem = useCallback(async (id) => {
    setLoading(true);
    try {
      const payload = await requestJson(`/api/display-systems/${encodeURIComponent(id)}/editor`);
      setSelectedId(id);
      form.setFieldsValue(buildFormValues(payload.editor));
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [form]);

  const rendererOptions = useMemo(
    () => (catalog?.renderers || []).map((item) => ({ value: item.id, label: item.label })),
    [catalog],
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
    () => catalog?.displayTemplates?.find((item) => item.id === displayTemplate),
    [catalog, displayTemplate],
  );

  const applySerialTemplate = useCallback((templateId) => {
    const template = catalog?.serialTemplates?.find((item) => item.id === templateId);
    if (!template) return;
    const defaults = template.defaults || {};
    const total = Math.max(1, Number(form.getFieldValue('rows')) || 1)
      * Math.max(1, Number(form.getFieldValue('cols')) || 1);
    form.setFieldsValue({
      serialTemplate: templateId,
      transportType: defaults.transportType || 'binary',
      baudRate: defaults.baudRate,
      framingType: defaults.framingType,
      delimiter: defaults.delimiter,
      frameLength: defaults.framingType === 'fixedLength'
        ? total * (defaults.bytesPerValue || 1)
        : form.getFieldValue('frameLength'),
      valueType: defaults.valueType,
      dataBits: defaults.dataBits || 8,
      byteOffset: defaults.byteOffset || 0,
      valueCount: total,
    });
  }, [catalog, form]);

  const applyFramingType = useCallback((nextFramingType) => {
    const total = Math.max(1, Number(form.getFieldValue('rows')) || 1)
      * Math.max(1, Number(form.getFieldValue('cols')) || 1);
    const dataBits = Number(form.getFieldValue('dataBits')) || 8;
    form.setFieldsValue({
      framingType: nextFramingType,
      frameLength: nextFramingType === 'fixedLength'
        ? total * (dataBits === 12 ? 2 : 1)
        : form.getFieldValue('frameLength'),
      delimiter: nextFramingType === 'delimiter'
        ? (form.getFieldValue('delimiter') || 'AA 55 03 99')
        : form.getFieldValue('delimiter'),
    });
  }, [form]);

  const applyDataBits = useCallback((dataBits) => {
    const total = Math.max(1, Number(form.getFieldValue('rows')) || 1)
      * Math.max(1, Number(form.getFieldValue('cols')) || 1);
    form.setFieldsValue({
      dataBits,
      valueType: dataBits === 12 ? 'uint16le' : 'uint8',
      valueCount: total,
      frameLength: form.getFieldValue('framingType') === 'fixedLength'
        ? total * (dataBits === 12 ? 2 : 1)
        : form.getFieldValue('frameLength'),
    });
  }, [form]);

  const applyDisplayTemplate = useCallback((templateId) => {
    const template = catalog?.displayTemplates?.find((item) => item.id === templateId);
    if (!template) return;
    form.setFieldsValue({ displayTemplate: templateId, ...(template.defaults || {}) });
  }, [catalog, form]);

  useEffect(() => {
    if (!selectedSerialTemplate || !rows || !cols) return;
    const total = Number(rows) * Number(cols);
    const dataBits = Number(form.getFieldValue('dataBits')) || 8;
    form.setFieldsValue({
      valueCount: total,
      ...(framingType === 'fixedLength'
        ? { frameLength: total * (dataBits === 12 ? 2 : 1) }
        : {}),
    });
  }, [cols, form, framingType, rows, selectedSerialTemplate]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const primaryPort = values.ports[0] || 'sit';
      const widgets = [{
        id: 'main',
        type: values.rendererId,
        label: '压力数据',
        source: `${primaryPort}Data`,
        columnSpan: values.showStats ? 8 : 12,
      }];
      if (values.showStats) {
        widgets.push({
          id: 'stats',
          type: 'pressureStats',
          label: '压力统计',
          source: `${primaryPort}Data`,
          columnSpan: 4,
        });
      }

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
      const manifest = {
        schemaVersion: 2,
        id: values.id,
        name: values.name,
        version: values.version,
        description: 'Created with Display System Builder',
        sensor: {
          type: values.sensorType,
          matrix: { rows: values.rows, cols: values.cols },
          ports: values.ports,
        },
        protocol: {
          baudRate: values.baudRate,
          framing: values.framingType === 'delimiter'
            ? { type: 'delimiter', delimiter: values.delimiter }
            : { type: 'fixedLength', frameLength: values.frameLength },
          decoding: {
            valueType: values.valueType,
            byteOffset: values.byteOffset,
            valueCount: values.valueCount,
          },
        },
        algorithm: { type: values.backendAlgorithm },
        display: {
          layout: { type: 'grid', columns: 12 },
          views: (catalog.renderers || []).map((renderer) => ({
            id: renderer.id,
            type: renderer.type,
            label: renderer.label,
            source: `${primaryPort}Data`,
          })),
          widgets,
          renderers: catalog.renderers || [],
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
            pointOrderMode: values.pointOrderMode,
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
      if (values.pointOrderMode === 'custom') {
        definitions.pointOrder = parseDefinition(values.pointOrderJson, '点位顺序');
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

      await requestJson('/api/display-systems', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ manifest, definitions, overwrite: Boolean(selectedId) }),
      });
      await loadIndex();
      setSelectedId(values.id);
      message.success('展示系统已保存并重新加载');
    } catch (error) {
      message.error(error.message);
    } finally {
      setSaving(false);
    }
  }, [catalog, form, loadIndex, selectedId]);

  if (loading && !catalog) {
    return <div className="display-builder-loading"><Spin /></div>;
  }

  return (
    <div className="display-builder-page">
      <aside className="display-builder-sidebar">
        <div className="display-builder-brand">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/system')} aria-label="返回系统" />
          <div><strong>展示系统配置器</strong><span>Display Systems</span></div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={startNew} block>新建展示系统</Button>
        <div className="display-builder-list" role="list">
          {systems.map((system) => (
            <button
              type="button"
              key={system.id}
              className={selectedId === system.id ? 'is-active' : ''}
              onClick={() => editSystem(system.id)}
            >
              <strong>{system.name}</strong>
              <span>{system.sensorType} · {system.matrix?.rows}×{system.matrix?.cols}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="display-builder-main">
        <header className="display-builder-header">
          <div><span>{selectedId ? '编辑配置' : '新建配置'}</span><h1>{selectedId || '新的展示系统'}</h1></div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => loadIndex().catch((error) => message.error(error.message))}>刷新</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>保存并加载</Button>
          </Space>
        </header>

        <Alert
          type="info"
          showIcon
          message="保存后立即重新发现并绑定，不需要重启应用。页面配置器只允许安全的 JSON 数值算法；受信任的 JS/Python 算法仍通过插件包安装。"
          description={catalog?.writableRoot ? `配置文件目录：${catalog.writableRoot}` : null}
        />

        <Form form={form} layout="vertical" initialValues={DEFAULT_VALUES} className="display-builder-form">
          <section>
            <div className="section-heading"><span>01</span><div><h2>系统定义</h2><p>系统身份、传感器矩阵和串口角色</p></div></div>
            <div className="form-grid four-columns">
              <Form.Item name="id" label="系统 ID" rules={[{ required: true }, { pattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/, message: '仅允许字母、数字、点、下划线和连字符' }]}><Input disabled={Boolean(selectedId)} placeholder="custom-seat" /></Form.Item>
              <Form.Item name="name" label="展示名称" rules={[{ required: true }]}><Input placeholder="自定义座椅" /></Form.Item>
              <Form.Item name="sensorType" label="传感器类型" rules={[{ required: true }]}><Input placeholder="customSeat" /></Form.Item>
              <Form.Item name="version" label="版本"><Input /></Form.Item>
              <Form.Item name="rows" label="矩阵行数" rules={[{ required: true }]}><InputNumber min={1} max={256} /></Form.Item>
              <Form.Item name="cols" label="矩阵列数" rules={[{ required: true }]}><InputNumber min={1} max={256} /></Form.Item>
              <Form.Item name="ports" label="串口角色" rules={[{ required: true }]}><Select mode="multiple" options={(catalog?.serialRoles || []).map((role) => ({ value: role, label: role }))} /></Form.Item>
              <Form.Item name="runtimeMode" label="运行模式"><Select options={['parallel', 'shadow', 'disabled'].map((value) => ({ value, label: value }))} /></Form.Item>
            </div>
          </section>

          <section className="template-section">
            <div className="section-heading"><span>02</span><div><h2>串口解析</h2><p>选择经典模板后，只调整实际硬件不同的参数</p></div></div>
            <div className="serial-template-choice">
              <Form.Item name="serialTemplate" label="三个经典模板">
                <Segmented
                  block
                  options={(catalog?.serialTemplates || []).map((item) => ({ value: item.id, label: item.label }))}
                  onChange={applySerialTemplate}
                />
              </Form.Item>
              <p>{selectedSerialTemplate?.description}</p>
            </div>
            <div className="form-grid protocol-grid">
              <Form.Item name="transportType" label="传输形式"><Select options={catalog?.transportTypes?.map((item) => ({ value: item.id, label: item.label }))} /></Form.Item>
              <Form.Item name="framingType" label="是否分包"><Segmented block options={(catalog?.framingTypes || []).map((item) => ({ value: item.id, label: item.label }))} onChange={applyFramingType} /></Form.Item>
              <Form.Item name="baudRate" label="波特率" rules={[{ required: true }]}><Select showSearch options={(catalog?.baudRates || []).map((value) => ({ value, label: String(value) }))} /></Form.Item>
              <Form.Item name="dataBits" label="数据精度"><Segmented block options={[{ value: 8, label: '8 Bit' }, { value: 12, label: '12 Bit' }]} onChange={applyDataBits} /></Form.Item>
              {framingType === 'delimiter' ? (
                <Form.Item name="delimiter" label="分隔符（十六进制）" rules={[{ required: true }]}><Input placeholder="AA 55 03 99" /></Form.Item>
              ) : (
                <Form.Item name="frameLength" label="完整帧字节数" rules={[{ required: true }]}><InputNumber min={1} /></Form.Item>
              )}
            </div>
          </section>

          <section className="display-template-section">
            <div className="section-heading"><span>03</span><div><h2>数据展示</h2><p>选择默认的数据展现形式</p></div></div>
            <div className="display-template-choice">
                <Form.Item name="displayTemplate" label="数据展示模板">
                  <Segmented
                    block
                    options={(catalog?.displayTemplates || []).map((item) => ({ value: item.id, label: item.label }))}
                    onChange={applyDisplayTemplate}
                  />
                </Form.Item>
                <p>{selectedDisplayTemplate?.description}</p>
            </div>
          </section>

          <details className="advanced-config">
            <summary>高级配置</summary>
            <div className="advanced-config-content">
          <section>
            <div className="section-heading"><span>04</span><div><h2>高级解码</h2><p>仅在数据包包含包头或额外字段时调整</p></div></div>
            <div className="form-grid four-columns">
              <Form.Item name="valueType" hidden><Input /></Form.Item>
              <Form.Item name="byteOffset" label="数据偏移"><InputNumber min={0} /></Form.Item>
              <Form.Item name="valueCount" label="数值数量"><InputNumber min={1} /></Form.Item>
            </div>
          </section>

          <section>
            <div className="section-heading"><span>05</span><div><h2>线序与点位</h2><p>默认按矩阵顺序自动生成，也可以粘贴已有 JSON</p></div></div>
            <div className="mapping-columns">
              <div>
                <Form.Item name="lineOrderMode" label="线序来源"><Segmented options={[{ value: 'identity', label: '自动生成' }, { value: 'custom', label: '自定义 JSON' }]} /></Form.Item>
                {lineOrderMode === 'custom' ? <Form.Item name="lineOrderJson" rules={[{ required: true }]}><Input.TextArea rows={9} spellCheck={false} placeholder={'{\n  "order": [1, 2, 3]\n}'} /></Form.Item> : <p className="field-note">自动生成 1 到 rows×cols 的一基索引。</p>}
              </div>
              <div>
                <Form.Item name="pointOrderMode" label="点位顺序来源"><Segmented options={[{ value: 'identity', label: '自动生成' }, { value: 'custom', label: '自定义 JSON' }]} /></Form.Item>
                {pointOrderMode === 'custom' ? <Form.Item name="pointOrderJson" rules={[{ required: true }]}><Input.TextArea rows={9} spellCheck={false} placeholder={'{\n  "matrix": { "rows": 2, "cols": 2 },\n  "points": [[0,0], [0,1]]\n}'} /></Form.Item> : <p className="field-note">自动按从左到右、从上到下生成矩阵坐标。</p>}
              </div>
            </div>
          </section>

          <section>
            <div className="section-heading"><span>06</span><div><h2>后端算法</h2><p>作用于实时、采集和回放共用的标准矩阵</p></div></div>
            <div className="form-grid four-columns">
              <Form.Item name="backendAlgorithm" label="算法类型"><Select options={(catalog?.backendAlgorithms || []).map((item) => ({ value: item.id, label: item.label }))} /></Form.Item>
              {backendAlgorithm === 'json' ? <>
                <Form.Item name="scale" label="缩放"><InputNumber step={0.1} /></Form.Item>
                <Form.Item name="offset" label="偏移"><InputNumber step={0.1} /></Form.Item>
                <Form.Item name="zeroBelow" label="低值清零"><InputNumber min={0} /></Form.Item>
                <Form.Item name="min" label="最小值"><InputNumber /></Form.Item>
                <Form.Item name="max" label="最大值"><InputNumber /></Form.Item>
              </> : null}
            </div>
          </section>

          <section>
            <div className="section-heading"><span>07</span><div><h2>渲染与展示</h2><p>选择默认方案；保存后仍可在展示页面菜单中切换</p></div></div>
            <div className="form-grid four-columns">
              <Form.Item name="profileLabel" label="方案名称"><Input /></Form.Item>
              <Form.Item name="rendererId" label="默认渲染器"><Select options={rendererOptions} /></Form.Item>
              <Form.Item name="visualizationAlgorithmId" label="默认可视算法"><Select options={visualizationOptions} /></Form.Item>
              <Form.Item name="showStats" label="页面组件" valuePropName="checked"><Checkbox>显示压力统计</Checkbox></Form.Item>
              {visualizationAlgorithmId === 'normalize' ? <Form.Item name="normalizeMax" label="归一化最大值"><InputNumber min={1} /></Form.Item> : null}
              {visualizationAlgorithmId === 'threshold' ? <Form.Item name="threshold" label="过滤阈值"><InputNumber min={0} /></Form.Item> : null}
              {visualizationAlgorithmId === 'smooth' ? <Form.Item name="smoothRadius" label="平滑半径"><InputNumber min={1} max={4} /></Form.Item> : null}
            </div>
          </section>

          <section>
            <div className="section-heading"><span>08</span><div><h2>左侧数据面板</h2><p>选择内置压力指标，或把算法命名输出放到左侧面板</p></div></div>
            <div className="form-grid four-columns">
              <Form.Item name="showPressurePanel" label="压力数据" valuePropName="checked"><Checkbox>显示压力数据面板</Checkbox></Form.Item>
              {showPressurePanel ? <>
                <Form.Item name="pressurePanelTitle" label="压力面板标题"><Input /></Form.Item>
                <Form.Item name="primaryMetric" label="主指标"><Select options={sidebarMetricOptions} /></Form.Item>
                <Form.Item name="pressureMetrics" label="压力指标"><Select mode="multiple" options={sidebarMetricOptions} /></Form.Item>
              </> : null}
              <Form.Item name="showAreaPanel" label="受压区域" valuePropName="checked"><Checkbox>显示受压区域面板</Checkbox></Form.Item>
              {showAreaPanel ? <>
                <Form.Item name="areaPanelTitle" label="区域面板标题"><Input /></Form.Item>
                <Form.Item name="areaMetrics" label="区域指标"><Select mode="multiple" options={sidebarMetricOptions} /></Form.Item>
                <Form.Item name="activeThreshold" label="有效点阈值"><InputNumber min={0} /></Form.Item>
                <Form.Item name="pointArea" label="单点面积"><InputNumber min={0} step={0.1} /></Form.Item>
                <Form.Item name="areaUnit" label="面积单位"><Input placeholder="cm²" /></Form.Item>
              </> : null}
            </div>
            <div className="algorithm-metric-editor">
              <div className="algorithm-metric-heading">
                <div><strong>算法输出指标</strong><span>安全聚合结果会随实时帧一起输出，也可以作为左侧主指标。</span></div>
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
          </section>
            </div>
          </details>
        </Form>
      </main>
    </div>
  );
}
