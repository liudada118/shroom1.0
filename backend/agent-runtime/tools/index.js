const { definitions, schemas, validateValue } = require('./toolSchemas');
const { createAlgorithmLab } = require('../algorithm-lab/service');
const { validateBuiltinTemplate } = require('../../extension-host/workspace/builtinSystemTemplates');
const { nativeInputs, validateNativeConfiguration } = require('../../extension-host/workspace/builtinSystemConfiguration');
const { observeFrames } = require('./frameObserver');
const { validateDisplaySystemConfig } = require('../../extension-host/manifest/displaySystemConfigValidator');
const { validateLineOrderDefinition, validatePointOrderDefinition, validateAlgorithmDataDefinition } = require('../../extension-host/manifest/displaySystemConfigFileValidator');
const { validateCoordinateMapDefinition } = require('../../extension-host/manifest/displaySystemCoordinateMap');
const { normalizeCanvasConfig, normalizeChartAppearanceConfig, normalizeChartCardsConfig, validateDisplayConfig } = require('../../extension-host/manifest/displaySystemPage');
const { buildDisplaySystemDuplicateManifest, displaySystemEditorDigest } = require('../../extension-host/manifest/displaySystemDuplication');

const LIMIT_BYTES = 2 * 1024 * 1024;
const DISPLAY_FIELDS = ['canvas', 'chartAppearance', 'chartCards'];
const CHARTS = Object.freeze({ totalPressure: ['总压力', 'total'], averagePressure: ['平均压力', 'avg'], maxPressure: ['最大压力', 'max'], activePoints: ['受压点数', 'points'], area: ['受压面积', 'area'] });

/** 创建带稳定错误码的工具错误。 */
function fail(code, message, details) { return Object.assign(new Error(message), { code, ...(details ? { details } : {}) }); }
/** 复制纯 JSON，防止提案被模型对象引用改变。 */
function clone(value) { return JSON.parse(JSON.stringify(value)); }
/** 原生副本固定设备输入；只拦截本轮明确要求改变矩阵或映射的误调用。 */
function assertNativeInputCompatibility(sourceType, context = {}) {
  if (!context.taskText) return;
  const matrix = nativeInputs(sourceType).matrix;
  if (!matrix) return;
  for (const match of context.taskText.matchAll(/(\d{1,3})\s*[xX×*＊]\s*(\d{1,3})/g)) {
    if (Number(match[1]) !== matrix.rows || Number(match[2]) !== matrix.cols) throw fail('AGENT_NATIVE_INPUT_MISMATCH',
      `${sourceType} 完整原生副本固定为 ${matrix.rows}×${matrix.cols}。要保留图表和工具布局并使用 ${match[1]}×${match[2]} 点阵，请改用 prepare_create_system 配置新矩阵系统。`);
  }
  for (const match of context.taskText.matchAll(/(?:自定义|更改|修改|重排|重新排列|抽取|截取|提取|筛选|替换).{0,8}(?:线序|点位|映射|协议)/g)) {
    if (/(?:不|不要|别|无需|禁止)\s*$/.test(context.taskText.slice(Math.max(0, match.index - 4), match.index))) continue;
    throw fail('AGENT_NATIVE_INPUT_MISMATCH', `${sourceType} 完整原生副本不能改变协议、线序或点位；若只需图表和工具布局，请改用 prepare_create_system。`);
  }
}
/** 将受支持的本机 URL 固定到回环服务。 */
function localBase(value, protocol) {
  const url = new URL(value);
  if (url.protocol !== protocol || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw fail('AGENT_LOCAL_ENDPOINT_REQUIRED', 'Agent tools require a local loopback endpoint');
  return url.origin;
}
/** 展开现有 HttpResult 包装，保留其他 API 的原始结构。 */
function unwrap(value) { return value && Object.hasOwn(value, 'data') && Object.hasOwn(value, 'code') ? value.data : value; }
/** 生成仅内置统计表达式的图表卡片，不接受模型生成代码。 */
function chartCards(items = []) {
  return items.map((item, index) => ({ templateId: `agent-${item.metric}-${index}`, name: item.name || CHARTS[item.metric][0], formula: CHARTS[item.metric][1], unit: '', decimals: item.decimals ?? 2, color: item.color || '#63D5FF' }));
}
/** 归一待写入的局部段，与服务器当前 normalizer 保持同源。 */
function normalizePatch(patch) {
  const output = {};
  for (const key of DISPLAY_FIELDS) {
    if (!Object.hasOwn(patch, key)) continue;
    const value = patch[key];
    if (value === null) { output[key] = null; continue; }
    if (key === 'canvas') {
      output[key] = normalizeCanvasConfig(value, []);
      if (!Array.isArray(value.widgets)) delete output[key].widgets;
    } else if (key === 'chartAppearance') output[key] = normalizeChartAppearanceConfig(value);
    else output[key] = normalizeChartCardsConfig(value);
  }
  return output;
}
/** 合并显示局部段；null 表示回到默认配置。 */
function mergeDisplay(display, patch) {
  const output = { ...(display || {}) };
  for (const key of DISPLAY_FIELDS) if (Object.hasOwn(patch, key)) {
    if (patch[key] === null) delete output[key]; else output[key] = patch[key];
  }
  return output;
}
/** 拒绝不存在的目录引用，避免虚构可用能力。 */
function findItem(items, id, label) {
  const item = items?.find((candidate) => candidate.id === id);
  if (!item) throw fail('AGENT_CAPABILITY_UNAVAILABLE', `${label} is not registered: ${id}`);
  return item;
}
/** 从工具参数生成安全局部段，再复用平台显示校验。 */
function buildPatch(input, display, catalog) {
  if (!Object.keys(input).length) throw fail('AGENT_INVALID_ARGUMENTS', 'At least one display section is required');
  const patch = clone(input);
  if (Array.isArray(patch.chartCards)) patch.chartCards = chartCards(patch.chartCards);
  for (const key of ['canvas', 'chartAppearance']) {
    if (patch[key]?.colormap) findItem(catalog.colormaps, patch[key].colormap.id, 'Colormap');
    for (const id of patch[key]?.overlays || []) findItem(key === 'canvas' ? catalog.overlays : catalog.chartOverlays, id, 'Overlay');
  }
  const errors = validateDisplayConfig(mergeDisplay(display, patch));
  if (errors.length) throw fail('AGENT_INVALID_DISPLAY', 'Display validation failed', errors);
  return normalizePatch(patch);
}
/** 把坐标轴的单点和含端点区间展开，超出目标尺寸时立即停止。 */
function expandMappingAxis(parts, expected, limit, label) {
  const values = [];
  for (const part of parts) {
    const [start, end] = Array.isArray(part) ? part : [part, part];
    const step = start <= end ? 1 : -1;
    for (let value = start; step > 0 ? value <= end : value >= end; value += step) {
      if (value >= limit || values.length >= expected) throw fail('AGENT_INVALID_MAPPING', `${label} 坐标超出原始帧或展示矩阵范围。`);
      values.push(value);
    }
  }
  if (values.length !== expected || new Set(values).size !== expected) throw fail('AGENT_INVALID_MAPPING', `${label} 坐标数量须等于矩阵尺寸且不能重复。`);
  return values;
}
/** 按源函数的 y 外层、x 内层顺序生成 1 基原始索引及行优先展示点位。 */
function compileAxisMapping(rule, matrix, rawCount) {
  if (!Number.isInteger(rawCount) || rawCount % rule.sourceColumns !== 0) throw fail('AGENT_INVALID_MAPPING', '原始帧点数必须能被 sourceColumns 整除。');
  const x = expandMappingAxis(rule.x, matrix.cols, rule.sourceColumns, 'x');
  const y = expandMappingAxis(rule.y, matrix.rows, rawCount / rule.sourceColumns, 'y');
  return {
    lineOrder: y.flatMap((row) => x.map((col) => row * rule.sourceColumns + col + 1)),
    pointOrder: y.flatMap((_, row) => x.map((__, col) => [row, col])),
  };
}
/** 给用户和模型展示原始/目标点数及跨行样点，便于在应用前核对坐标公式。 */
function mappingPreview(input, payload) {
  return payload.manifest.sensors.map((sensor, index) => {
    const order = payload.definitions.sensors[sensor.id].lineOrder.order;
    const cols = sensor.matrix.cols;
    return { sensorId: sensor.id, rawPoints: sensor.protocol.decoding.valueCount, matrix: sensor.matrix,
      mappedPoints: order.length, sourceAxes: input.sensors[index].axisMapping || null,
      first: order.slice(0, 5), firstRowEnd: order[cols - 1], secondRowStart: order.length > cols ? order[cols] : null,
      last: order.slice(-5),
      indexBase: 1, physicalOrientationVerified: false };
  });
}
/** 从已注册协议、算法和显式映射生成 manifest 与定义文件，不采用模型提供的源码或路径。 */
function buildCreate(input, catalog, protocols) {
  if (!input.rendererId && input.sensors.length !== 1) throw fail('AGENT_INVALID_ARGUMENTS', '多传感器系统必须明确指定 rendererId。');
  const renderer = findItem(catalog.renderers, input.rendererId || 'pointGrid', 'Renderer');
  const sensorDefinitions = {};
  const ids = new Set();
  const singletonPackages = new Set();
  const metricDefinitions = new Map();
  const sensors = input.sensors.map((sensor) => {
    if (sensor.type !== input.id && !sensor.type.startsWith(`${input.id}-`)) throw fail('AGENT_SENSOR_TYPE_REQUIRED', 'Derive each sensor type from the new system ID, such as <systemId>-pressure, to keep the system selectable');
    if (ids.has(sensor.id)) throw fail('AGENT_INVALID_ARGUMENTS', 'Sensor IDs must be unique');
    ids.add(sensor.id);
    const total = sensor.matrix.rows * sensor.matrix.cols;
    const preset = findItem(protocols, sensor.protocolId, 'Protocol');
    const protocol = clone(preset.protocol);
    const rule = sensor.axisMapping;
    if (!rule && (!sensor.lineOrder || !sensor.pointOrder)) throw fail('AGENT_INVALID_MAPPING', '请提供完整 lineOrder 与 pointOrder，或提供可计算的 axisMapping。');
    const mapping = rule ? compileAxisMapping(rule, sensor.matrix, protocol.decoding?.valueCount) : { lineOrder: sensor.lineOrder, pointOrder: sensor.pointOrder };
    if (rule && (sensor.lineOrder && JSON.stringify(sensor.lineOrder) !== JSON.stringify(mapping.lineOrder)
      || sensor.pointOrder && JSON.stringify(sensor.pointOrder) !== JSON.stringify(mapping.pointOrder))) {
      throw fail('AGENT_INVALID_MAPPING', '显式映射与 axisMapping 计算结果不一致；请以坐标规则为准。');
    }
    if (mapping.lineOrder.length !== mapping.pointOrder.length) throw fail('AGENT_INVALID_MAPPING', 'Line order and point order lengths must match');
    const count = mapping.lineOrder.length;
    // 协议读取完整原始帧；线序可以只选其中一部分，展示矩阵不决定协议点数。
    protocol.decoding = { ...protocol.decoding, valueCount: protocol.decoding?.valueCount ?? count };
    const lineOrder = { order: mapping.lineOrder };
    const pointOrder = { matrix: sensor.matrix, points: mapping.pointOrder };
    const coordinateMap = sensor.coordinateMap ? { matrix: sensor.matrix, coordinates: sensor.coordinateMap } : null;
    const errors = [...validateLineOrderDefinition(lineOrder, { source: sensor.id, matrixTotal: total, sourcePointCount: protocol.decoding.valueCount }),
      ...validatePointOrderDefinition(pointOrder, { source: sensor.id, matrix: sensor.matrix, maxPointCount: count }),
      ...(coordinateMap ? validateCoordinateMapDefinition(coordinateMap, { source: sensor.id, matrix: sensor.matrix }) : [])];
    if (errors.length) throw fail('AGENT_INVALID_MAPPING', 'Mapping validation failed', errors);
    const type = sensor.algorithmType || 'none';
    const algorithm = { type: type === 'package' ? 'python' : type };
    const scoped = { lineOrder, pointOrder, ...(coordinateMap ? { coordinateMap } : {}) };
    if (type === 'package') {
      const pkg = findItem(catalog.algorithmPackages, sensor.packageId, 'Algorithm package');
      if (pkg.attachable === false || !pkg.packageManifest || typeof pkg.algorithmSource !== 'string') throw fail('AGENT_CAPABILITY_UNAVAILABLE', 'Algorithm package cannot be attached');
      if (pkg.compatibility?.matrixTotals?.length && !pkg.compatibility.matrixTotals.includes(total)) throw fail('AGENT_ALGORITHM_SHAPE_MISMATCH', 'Algorithm package does not support this matrix size');
      if (pkg.packageManifest.input?.mode === 'multi-sensor') throw fail('AGENT_CAPABILITY_UNAVAILABLE', 'Multi-sensor algorithm packages require explicit binding support');
      if (pkg.singleton && singletonPackages.has(pkg.id)) throw fail('AGENT_CAPABILITY_UNAVAILABLE', 'A singleton algorithm package cannot be attached to multiple sensors');
      if (pkg.singleton) singletonPackages.add(pkg.id);
      if (pkg.packageManifest.resources && Object.keys(pkg.packageManifest.resources).length) throw fail('AGENT_CAPABILITY_UNAVAILABLE', 'Algorithm packages requiring resource files are not supported by this tool');
      scoped.algorithmPackage = clone(pkg.packageManifest);
      scoped.algorithmSource = pkg.algorithmSource;
      algorithm.packageManifest = `${sensor.id}/algorithm-package.json`;
      algorithm.apiVersion = pkg.packageManifest.apiVersion;
      for (const metric of pkg.metricDefinitions || []) metricDefinitions.set(metric.id, { id: metric.id, label: metric.label || metric.id, unit: metric.unit || '', decimals: metric.decimals ?? 2 });
    } else {
      findItem(catalog.backendAlgorithms, type, 'Algorithm');
      if (sensor.packageId) throw fail('AGENT_INVALID_ARGUMENTS', 'packageId requires algorithmType package');
      if (type === 'json') {
        const algorithmErrors = validateAlgorithmDataDefinition(sensor.algorithmData || {}, { source: sensor.id });
        if (algorithmErrors.length) throw fail('AGENT_INVALID_ALGORITHM', 'Algorithm data validation failed', algorithmErrors);
        scoped.algorithmData = sensor.algorithmData || {};
        for (const metric of scoped.algorithmData.metrics || []) metricDefinitions.set(metric.id, { id: metric.id, label: metric.id, unit: '', decimals: 2 });
        algorithm.dataFile = `${sensor.id}/algorithm-data.json`;
      } else if (sensor.algorithmData) throw fail('AGENT_INVALID_ARGUMENTS', 'algorithmData requires algorithmType json');
    }
    sensorDefinitions[sensor.id] = scoped;
    return { id: sensor.id, label: sensor.label || sensor.id, type: sensor.type, outputChannel: sensor.outputChannel || sensor.id, matrix: sensor.matrix,
      protocol, algorithm, files: { lineOrder: `${sensor.id}/line-order.json`, pointOrder: `${sensor.id}/point-order.json`,
        ...(coordinateMap ? { coordinateMap: `${sensor.id}/coordinate-map.json` } : {}) }, stored: true };
  });
  const manifest = { schemaVersion: 3, id: input.id, name: input.name, version: '1.0.0', metadata: { origin: 'user', createdBy: 'embedded-agent' }, sensors,
    display: { layout: { type: 'grid', columns: 12, presentation: 'workspace' },
      views: [{ id: 'main', type: renderer.type || renderer.id, source: 'data' }], widgets: [{ id: 'main', type: renderer.type || renderer.id, source: 'data' }],
      renderers: [{ id: renderer.id, type: renderer.type || renderer.id }], visualizationAlgorithms: [{ id: 'identity', type: 'identity' }],
      profiles: [{ id: 'default', renderer: renderer.id, visualizationAlgorithm: 'identity', widgets: ['main'] }], defaultView: 'main', defaultProfile: 'default', chartCards: chartCards(input.chartCards),
      // 左侧统计读取映射后的原始矩阵通道，不能取 3D 插值或平滑后的画布数据。
      sidebar: { source: sensors[0].id,
        pressure: { primaryMetric: 'totalPressure', metrics: ['averagePressure', 'maxPressure', 'totalPressure'] },
        // 未提供单点物理面积时，以覆盖格数显示，不伪造 mm²/cm²。
        area: { metrics: ['activePoints', 'area'], pointArea: 1, unit: '格' },
        algorithmMetrics: [...metricDefinitions.values()] },
    } };
  const validation = validateDisplaySystemConfig(manifest);
  if (!validation.ok) throw fail('AGENT_INVALID_MANIFEST', 'Manifest validation failed', validation.errors);
  return { manifest, definitions: { sensors: sensorDefinitions }, overwrite: false };
}

/** 创建限定本机能力的 Agent 工具，读操作即时执行，写操作先注册可审阅提案。 */
function createAgentTools({ root, httpBaseUrl = 'http://127.0.0.1:19245', wsUrl = 'ws://127.0.0.1:19999', fetchImpl = globalThis.fetch, WebSocketImpl = require('ws') } = {}) {
  const base = localBase(httpBaseUrl, 'http:');
  const websocket = localBase(wsUrl, 'ws:');
  const lab = root ? createAlgorithmLab({ root, request }) : null;

  /** 在 Agent 首次启用用户分类包前，用目标系统的真实通道核验输入节奏。 */
  async function verifyUserClassifierActivation(configuration, previous, systemId, editor, packages, context) {
    const newBindings = configuration.algorithms.filter((entry) => entry.enabled &&
      !previous?.algorithms?.some((old) => old.packageId === entry.packageId && old.sensorId === entry.sensorId && old.enabled));
    const classifiers = newBindings.map((entry) => ({ entry, item: packages.find((item) => item.id === entry.packageId) }))
      .filter(({ item }) => item?.runtime === 'restricted-python-v1');
    if (!classifiers.length) return [];
    const device = await request('/api/agent-device/status', context);
    if (device.currentSystem?.id !== systemId) throw fail('ALGORITHM_REALTIME_UNVERIFIED', '请先进入目标系统并连接传感器，再让 Agent 启用实时分类；算法可以先保存或添加为停用状态。');
    const channels = [...new Set(classifiers.map(({ entry }) => entry.sensorId))];
    const observations = await Promise.all(channels.map(async (sensorId) => {
      try {
        const matrix = editor.inputs?.matrices?.[sensorId] || editor.inputs?.matrix || editor.manifest?.sensors?.find((sensor) => sensor.id === sensorId)?.matrix;
        if (!matrix) throw fail('ALGORITHM_REALTIME_UNVERIFIED', '目标系统没有可核验的传感器矩阵，不能启用实时分类。');
        return [sensorId, await observeFrames({ WebSocketImpl, wsUrl: websocket, systemId, sensorId, durationMs: 3000, maxFrames: 60,
          expectedPointCount: matrix.total || matrix.rows * matrix.cols, expectedMatrix: { rows: matrix.rows, cols: matrix.cols }, signal: context.signal })];
      } catch (cause) {
        if (cause.code === 'AGENT_CANCELLED') throw cause;
        throw fail('ALGORITHM_REALTIME_UNVERIFIED', `无法核验 ${sensorId} 的实时数据，请检查设备连接后重试。`, { causeCode: cause.code });
      }
    }));
    const observed = new Map(observations);
    return classifiers.map(({ entry, item }) => {
      const frames = observed.get(entry.sensorId);
      if (!frames.liveVerified || frames.timing.intervalCount < 8 || frames.timing.reverseTimestamps) {
        throw fail('ALGORITHM_REALTIME_UNVERIFIED', `${entry.sensorId} 尚未提供至少 9 帧连续、有效的实时数据，不能确认算法兼容；可先保存为停用，连接设备后再启用。`,
          { status: frames.status, intervalCount: frames.timing.intervalCount });
      }
      const targetInterval = 1000 / item.sampleRateHz;
      if (!Number.isFinite(targetInterval) || targetInterval <= 0) throw fail('ALGORITHM_REALTIME_UNVERIFIED', '算法包缺少有效的测试采样间隔，请重新测试并保存算法。');
      const { medianIntervalMs, p90IntervalMs } = frames.timing;
      if (medianIntervalMs > targetInterval * 1.5 || p90IntervalMs > targetInterval * 2) {
        throw fail('ALGORITHM_REALTIME_RATE_UNSUPPORTED', `${entry.sensorId} 实测约 ${Math.round(1000 / medianIntervalMs)} Hz，算法测试参考 ${Math.round(item.sampleRateHz)} Hz；当前输入超出可安全适配范围，已阻止启用。可沿用已有标签选择采集记录，调用 adapt_algorithm_data 后重新分析、生成并测试适配算法；若记录的真实帧不足，再补采或缩小窗口。`,
          { medianIntervalMs, p90IntervalMs, referenceIntervalMs: targetInterval });
      }
      return { packageId: entry.packageId, sensorId: entry.sensorId, observedAt: frames.observedAt,
        observedRateHz: Math.round(1000 / medianIntervalMs), referenceRateHz: Math.round(item.sampleRateHz), status: 'compatible' };
    });
  }

  /** 读取资料目录供用户选择，模型不能修改用户的数据授权范围。 */
  async function listAlgorithmRecords(payload = {}) { return request('/api/agent-algorithms/records', { method: 'POST', body: { offset: payload.offset || 0 } }); }

  /** 将 UI 标签和范围绑定到刚读回的真实记录目录。 */
  async function selectAlgorithmRecords(value) {
    if (value == null) return null;
    if (!Array.isArray(value.records) || value.records.length < 2 || value.records.length > 8 || ![16, 32, 64, 128, 256].includes(value.windowFrames)) throw fail('ALGORITHM_SELECTION_INVALID', '请选择 2～8 条记录，并使用有效窗口长度。');
    const catalog = await listAlgorithmRecords({ offset: value.catalogOffset });
    if (value.systemId !== catalog.systemId) throw fail('ALGORITHM_SELECTION_INVALID', '系统已切换，请刷新采集记录。');
    const seen = new Set(), sessions = new Map();
    const records = value.records.map((item) => {
      const record = catalog.records.find((entry) => entry.id === item.id);
      const label = String(item.label || '').trim();
      if (!record || seen.has(item.id) || !label || label.length > 40 || label === '未知' || !['development', 'validation'].includes(item.split)) throw fail('ALGORITHM_SELECTION_INVALID', '记录、类别或用途无效；同一记录不能重复选择。');
      if (!Number.isInteger(item.startFrame) || item.startFrame < 0 || !Number.isInteger(item.frameLimit) || item.frameLimit < value.windowFrames || item.frameLimit > 2000 || item.startFrame + item.frameLimit > record.count) throw fail('ALGORITHM_SELECTION_INVALID', '帧范围须在记录内，每条最多 2000 帧且至少一个窗口。');
      if (sessions.has(record.date) && sessions.get(record.date) !== item.split) throw fail('ALGORITHM_SELECTION_INVALID', '同次采集的不同通道不能拆到开发集和验证集。');
      seen.add(item.id); sessions.set(record.date, item.split);
      return { ...record, label, split: item.split, startFrame: item.startFrame, frameLimit: item.frameLimit };
    });
    const labels = new Set(records.filter((item) => item.split === 'development').map((item) => item.label));
    if (labels.size < 2 || records.some((item) => !labels.has(item.label))) throw fail('ALGORITHM_SELECTION_INVALID', '开发集至少包含两类，验证集类别须与开发集对应。');
    return { systemId: catalog.systemId, catalogOffset: catalog.offset, windowFrames: value.windowFrames, records };
  }

  /** 请求本机固定路由；写入发出后失去回执必须保留不确定状态。 */
  async function request(route, { method = 'GET', body, signal } = {}) {
    if (signal?.aborted) throw fail('AGENT_CANCELLED', 'Task cancelled');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    /** 转发任务取消到本次请求。 */
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    let responded = false;
    try {
      const response = await fetchImpl(`${base}${route}`, { method, redirect: 'error', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      if (Number(response.headers?.get?.('content-length')) > LIMIT_BYTES) throw fail('AGENT_RESPONSE_TOO_LARGE', 'Local API response exceeds the tool limit');
      let text = '';
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder(); let size = 0;
        try {
          while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > LIMIT_BYTES) { await reader.cancel(); throw fail('AGENT_RESPONSE_TOO_LARGE', 'Local API response exceeds the tool limit'); } text += decoder.decode(part.value, { stream: true }); }
          text += decoder.decode();
        } finally { reader.releaseLock(); }
      } else { text = await response.text(); if (Buffer.byteLength(text) > LIMIT_BYTES) throw fail('AGENT_RESPONSE_TOO_LARGE', 'Local API response exceeds the tool limit'); }
      const value = JSON.parse(text);
      responded = true;
      if (!response.ok || (typeof value.code === 'number' && value.code !== 0)) throw fail(value.errorCode || (typeof value.code === 'string' ? value.code : 'AGENT_HTTP_ERROR'), value.error || value.message || `Local API HTTP ${response.status}`, value.details);
      return unwrap(value);
    } catch (cause) {
      if (method !== 'GET' && !responded) throw fail('AGENT_OPERATION_UNCERTAIN', 'The write was sent but its result is unknown. Read the system before retrying.');
      if (controller.signal.aborted) throw fail(signal?.aborted ? 'AGENT_CANCELLED' : 'AGENT_HTTP_TIMEOUT', signal?.aborted ? 'Task cancelled' : 'Local API request timed out');
      if (cause.code) throw cause;
      throw fail('AGENT_HTTP_UNAVAILABLE', 'Local platform API is unavailable');
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
  }

  /** 核对实时契约与安装策略版本，避免在未知平台语义上写入或解释帧。 */
  async function bootstrap(context) {
    const contract = await request('/api/sdk/contract', context);
    const response = await request('/api/agent-apps/policy', context);
    const policy = response.policy;
    const stable = contract.stableContracts?.multiSensor;
    const required = policy?.bootstrap?.requiredStableContract;
    if (contract.apiVersion !== 'v1' || stable?.name !== 'shroom.multi-sensor' || stable.version !== 1 || stable.status !== 'stable'
      || contract.telemetry?.frameType !== 'sensor.frame' || contract.telemetry.schemaVersion !== 1 || contract.displaySystems?.schemaVersion !== 3
      || policy?.schemaVersion !== 1 || required?.name !== stable.name || required.minimumContractVersion > stable.version
      || required.manifestSchemaVersion !== 3 || required.sensorFrameType !== 'sensor.frame' || required.sensorFrameSchemaVersion !== 1) {
      throw fail('AGENT_CONTRACT_UNSUPPORTED', 'Live platform contract or installed policy is unsupported; update the agent before making changes');
    }
    const routes = { displaySystems: '/api/display-systems', displaySystemCatalog: '/api/display-systems/catalog', displaySystemEditor: '/api/display-systems/:id/editor', displaySystemDisplaySection: '/api/display-systems/:id/display', displaySystemDuplicate: '/api/display-systems/:id/duplicate', serialProtocols: '/api/serial/protocols' };
    for (const [key, value] of Object.entries(routes)) if (contract.http?.routes?.[key] !== value) throw fail('AGENT_CONTRACT_UNSUPPORTED', `Live platform route changed: ${key}`);
    return { contract, policy };
  }

  /** 获取每次写入所依据的实时目录和协议。 */
  async function capabilities(context) {
    await bootstrap(context);
    const [catalog, protocols] = await Promise.all([request('/api/display-systems/catalog', context), request('/api/serial/protocols', context)]);
    return { catalog: catalog.catalog, protocols: protocols.protocols || [] };
  }
  /** 获取带服务器版本戳的系统编辑视图。 */
  async function read(id, context) {
    const value = await request(`/api/display-systems/${encodeURIComponent(id)}/editor`, context);
    if (!value.editor?.manifest && value.editor?.kind !== 'builtin-template') throw fail('AGENT_SYSTEM_NOT_FOUND', 'System editor is unavailable');
    return value.editor;
  }
  /** 核对新系统身份及 sensor.type，避免 Portal 去重或运行时首个匹配隐藏新系统。 */
  async function assertCreateIdentity(input, context) {
    const state = await request('/api/display-systems', context);
    const systems = state.displaySystems?.systems || [];
    if (systems.some((system) => system.id === input.id)) throw fail('DISPLAY_SYSTEM_EXISTS', 'The requested system ID already exists');
    const existing = new Set(systems.flatMap((system) => [system.id, system.sensorType]).filter(Boolean));
    for (const definition of state.displaySystems?.runtimeDefinitions || []) {
      if (definition.sensorDefinition?.type) existing.add(definition.sensorDefinition.type);
      for (const sensor of definition.sensorDefinition?.sensors || []) if (sensor.type) existing.add(sensor.type);
    }
    if ([input.id, ...(input.sensors || []).map((sensor) => sensor.type)].some((type) => existing.has(type))) throw fail('AGENT_SENSOR_TYPE_CONFLICT', 'The system ID or sensor type already identifies another system; choose a unique ID-derived type');
  }
  /** 从真实源配置生成复制预览，映射与资源留在本机，不要求模型重新输出 sensors。 */
  function duplicateDraft(args, editor, catalog) {
    const support = catalog.duplicateSystem;
    if (support?.version !== 1 || !support.checksSourceRevision || !support.checksSourceDigest || !support.independentSensorTypes) {
      throw fail('AGENT_PLATFORM_RESTART_REQUIRED', '当前后端尚未加载完整复制能力，请完全退出并重启 Shroom 后重试。');
    }
    if (!editor.revision) throw fail('AGENT_REVISION_UNAVAILABLE', '复制源缺少配置版本，请重新读取系统。');
    if (args.id === args.sourceSystemId) throw fail('AGENT_INVALID_ARGUMENTS', '副本必须使用不同于源系统的新 ID。');
    const patch = args.patch && Object.keys(args.patch).length ? buildPatch(args.patch, editor.manifest.display, catalog) : {};
    const merged = mergeDisplay(editor.manifest.display, patch);
    const normalized = normalizePatch(Object.fromEntries(DISPLAY_FIELDS.filter((key) => Object.hasOwn(merged, key)).map((key) => [key, merged[key]])));
    const manifest = buildDisplaySystemDuplicateManifest(editor.manifest, { id: args.id, name: args.name, independentSensorTypes: true }, mergeDisplay(merged, normalized));
    const validation = validateDisplaySystemConfig(manifest);
    if (!validation.ok) throw fail('AGENT_INVALID_MANIFEST', '源系统配置无法复制，请检查原配置。', validation.errors);
    return { manifest, sensors: validation.value.sensors, patch };
  }
  /** 保存可审阅提案，只向模型返回简短摘要和待应用状态。 */
  async function propose(proposal, context) {
    if (typeof context.createProposal !== 'function') throw fail('AGENT_PROPOSAL_STORE_UNAVAILABLE', 'Proposal storage is unavailable');
    const saved = await context.createProposal(proposal);
    return { proposalId: saved.id, kind: saved.kind, systemId: saved.systemId, summary: saved.summary, status: 'pending', applied: false,
      ...(saved.mappingPreview ? { mappingPreview: saved.mappingPreview } : {}),
      verification: 'Configuration proposal only; no device or live frame was verified.' };
  }

  /** 写入独立系统后核对名称与完整配置，响应丢失或读回失败保留不确定结果。 */
  async function saveNative(id, value, expectedRevision, context) {
    const result = await request(`/api/display-systems/${encodeURIComponent(id)}/native`, { ...context, method: 'PATCH', body: { ...value, expectedRevision } });
    let editor;
    try { editor = await read(id, context); } catch { throw fail('AGENT_OPERATION_UNCERTAIN', '独立系统已发送保存，但无法读回核验。'); }
    if (result.result?.editor?.revision !== editor.revision || editor.builtinTemplate.name !== value.name || JSON.stringify(editor.configuration) !== JSON.stringify(value.configuration)) throw fail('AGENT_OPERATION_UNCERTAIN', '读回配置与本次修改不一致，请检查实际系统。');
    return editor;
  }

  /** 校验 Manifest 当前输入与已登记算法的点数、归属和输出指标。 */
  function manifestAlgorithmConfiguration(value, editor, packages, systemId) {
    const sensors = editor.manifest.sensors || (editor.manifest.sensor ? [editor.manifest.sensor] : []);
    const matrices = Object.fromEntries(sensors.filter((sensor) => sensor.id && sensor.matrix).map((sensor) => [sensor.id, {
      rows: sensor.matrix.rows, cols: sensor.matrix.cols, total: sensor.matrix.rows * sensor.matrix.cols,
    }]));
    const checked = validateNativeConfiguration({ ...value, showPressure: true, showArea: true }, {
      systemId, packages, inputs: { channels: Object.keys(matrices), matrices },
    });
    return { algorithms: checked.algorithms, charts: checked.charts };
  }

  /** 写入 Manifest 算法绑定并从独立配置接口读回，防止成功响应掩盖未生效状态。 */
  async function saveManifestAlgorithms(id, configuration, expectedRevision, context) {
    const route = `/api/display-systems/${encodeURIComponent(id)}/algorithm-bindings`;
    const result = await request(route, { ...context, method: 'PATCH', body: { expectedRevision, configuration } });
    let saved;
    try { saved = (await request(route, context)).result; }
    catch { throw fail('AGENT_OPERATION_UNCERTAIN', '算法绑定请求已发出，但无法读回当前系统配置。'); }
    if (result.result?.revision !== saved?.revision || JSON.stringify(saved.configuration) !== JSON.stringify(configuration)) throw fail('AGENT_OPERATION_UNCERTAIN', '算法绑定读回不一致，请检查当前系统。');
    return saved;
  }

  /** 校验工具名与固定 schema 后执行只读查询或生成提案。 */
  async function execute(name, args = {}, context = {}) {
    if (!Object.hasOwn(schemas, name)) throw fail('AGENT_UNKNOWN_TOOL', `Unknown tool: ${name}`);
    try { if (Buffer.byteLength(JSON.stringify(args)) > LIMIT_BYTES) throw new Error('arguments exceed the size limit'); validateValue(args, schemas[name]); } catch (cause) { throw fail('AGENT_INVALID_ARGUMENTS', cause.message); }
    if (['get_algorithm_workspace', 'analyze_algorithm_data', 'adapt_algorithm_data', 'test_algorithm', 'prepare_algorithm_package'].includes(name)) {
      if (!lab) throw fail('ALGORITHM_UNAVAILABLE', '算法工作台尚未加载，请重启软件。');
      if (name === 'get_algorithm_workspace') {
        const state = await request('/api/agent-device/status', context);
        return lab.workspace({ ...context, currentSystemId: state.currentSystem?.id });
      }
      if (name === 'adapt_algorithm_data') {
        lab.clearAdaptation(context);
        const selection = context.algorithmSelection;
        if (!selection?.records?.length) throw fail('ALGORITHM_SELECTION_REQUIRED', '请先选择带标签的采集记录，已有采集标签会自动带入。');
        if (selection.records.some((record) => record.channel !== args.sensorId)) throw fail('ALGORITHM_CHANNEL_MISMATCH', '所选记录必须都来自要适配的同一通道。');
        const state = await request('/api/agent-device/status', context);
        if (state.currentSystem?.id !== selection.systemId) throw fail('ALGORITHM_SYSTEM_CHANGED', '请先进入采集记录对应的系统并连接当前设备。');
        const editor = await read(selection.systemId, context);
        const matrix = editor.kind === 'builtin-template' ? editor.inputs?.matrix : editor.manifest?.sensors?.find((sensor) => sensor.id === args.sensorId)?.matrix;
        const channelExists = editor.kind === 'builtin-template' ? editor.inputs?.channels.includes(args.sensorId) : Boolean(matrix);
        if (!(editor.kind === 'builtin-template' ? editor.writable : editor.editable) || !matrix || !channelExists) throw fail('ALGORITHM_BINDING_UNSUPPORTED', '请选择可编辑系统中已登记的传感器通道。');
        const frames = await observeFrames({ WebSocketImpl, wsUrl: websocket, systemId: selection.systemId, sensorId: args.sensorId,
          durationMs: 10000, maxFrames: 60, expectedPointCount: matrix.total || matrix.rows * matrix.cols, expectedMatrix: { rows: matrix.rows, cols: matrix.cols }, signal: context.signal });
        if (!frames.liveVerified || frames.timing.intervalCount < 8 || frames.timing.reverseTimestamps) throw fail('ALGORITHM_REALTIME_UNVERIFIED',
          '当前设备还没有至少 9 帧连续有效的实时数据；请连接设备并稳定采样后再生成适配算法。', { status: frames.status, intervalCount: frames.timing.intervalCount });
        if (frames.timing.p90IntervalMs > frames.timing.medianIntervalMs * 2) throw fail('ALGORITHM_REALTIME_UNSTABLE',
          '当前设备的帧间隔波动过大，无法确定可靠的适配目标；请先检查连接与采样稳定性。', { timing: frames.timing });
        return lab.adapt(context, { sensorId: args.sensorId, measuredIntervalMs: frames.timing.medianIntervalMs });
      }
      if (name === 'analyze_algorithm_data') return lab.analyze(context);
      if (name === 'test_algorithm') return lab.test(args, context);
      return propose(lab.proposal(args, context), context);
    }
    if (context.signal?.aborted) throw fail('AGENT_CANCELLED', 'Task cancelled');
    if (name === 'get_algorithm_state') return request('/api/algorithm-market', context);
    if (name === 'get_current_system') {
      const device = await request('/api/agent-device/status', context);
      if (!Object.hasOwn(device, 'currentSystem')) throw fail('AGENT_PLATFORM_RESTART_REQUIRED', '当前后端尚未提供系统识别信息，请完全退出并重启 Shroom 后重试。');
      return { observedAt: device.observedAt, currentSystem: device.currentSystem,
        selectionStatus: !device.currentSystem ? 'unselected' : device.currentSystem.kind === 'unknown' ? 'unresolved' : 'selected',
        currentChannels: device.currentChannels, collecting: device.collecting,
        localPlayback: device.localPlayback, playing: device.playing, historyMode: device.historyMode,
        scope: '后端实际选中的系统；不证明前端画面已经显示或设备已产生有效数据。' };
    }
    if (name === 'get_current_state') {
      const paths = { systems: '/api/display-systems', websocket: '/api/ws/status', current: '/api/sensor/current', serial: '/api/serial/status', device: '/api/agent-device/status' };
      const results = await Promise.all(Object.entries(paths).map(async ([key, route]) => [key, await request(route, context)]));
      const state = Object.fromEntries(results);
      return { observedAt: new Date().toISOString(), ...state, currentSystem: state.device.currentSystem || null };
    }
    if (name === 'get_capabilities') {
      const section = args.section || 'overview';
      if (section === 'contract') return request('/api/sdk/contract', context);
      if (section === 'policy') return request('/api/agent-apps/policy', context);
      const { catalog, protocols } = await capabilities(context);
      const native = { builtinTemplates: catalog.builtinTemplates || [], builtinTemplateCreation: catalog.builtinTemplateCreation || null, nativeSystemEditing: catalog.nativeSystemEditing || null, manifestAlgorithmEditing: catalog.manifestAlgorithmEditing || null };
      const algorithmDevelopment = { available: Boolean(lab), language: 'restricted-python-v1', entry: 'get_algorithm_workspace', selectedDataOnly: true, execution: 'local numeric interpreter',
        adaptation: 'adapt_algorithm_data measures the current realtime channel and reuses selected labels to test on nearest real frames at a compatible cadence',
        installation: 'saved versions with inputContract appear as user-* realtime candidates; Agent first activation checks live frame cadence, but saved package alone is not verified on current hardware; no arbitrary Python execution' };
      const packages = (catalog.algorithmPackages || []).map(({ algorithmSource, packageManifest, ...item }) => ({ ...item, apiVersion: packageManifest?.apiVersion, input: packageManifest?.input, output: packageManifest?.output }));
      if (section === 'protocols') return { protocols: protocols.map(({ id, label, summary, protocol, matrix }) => ({ id, label, summary, protocol, matrix })) };
      if (section === 'algorithms') return { algorithmDevelopment, nativeSystemEditing: native.nativeSystemEditing, manifestAlgorithmEditing: native.manifestAlgorithmEditing,
        backendAlgorithms: catalog.backendAlgorithms, algorithmPackages: packages, supportedJsonOperations: ['scale', 'offset', 'clamp', 'zeroBelow'], supportedJsonMetrics: ['sum', 'average', 'max', 'min', 'activeCount', 'activeRatio'] };
      if (section === 'display') return { ...native, renderers: catalog.renderers, colormaps: catalog.colormaps, overlays: catalog.overlays, chartOverlays: catalog.chartOverlays, chartMetrics: Object.keys(CHARTS), duplicateSystem: catalog.duplicateSystem || null, chartLimitations: 'Chart tools support only the listed metrics. Respiration/heart-rate charts require an actual compatible algorithm data source and are not provided by renaming pressure charts.' };
      return { ...native, algorithmDevelopment, protocols: protocols.map(({ id, label, matrix, protocol }) => ({ id, label, matrix, valueCount: protocol?.decoding?.valueCount })), renderers: catalog.renderers, backendAlgorithms: catalog.backendAlgorithms, algorithmPackages: packages.map(({ id, name, description }) => ({ id, name, description })), chartMetrics: Object.keys(CHARTS), limits: { maxSensors: 8, maxPoints: 65536, mapping: 'axisMapping 或显式 lineOrder+pointOrder', modifies: DISPLAY_FIELDS, installsCode: 'realtime: unchanged registered builtin package source; offline: tested restricted-python proposals', activatesDevices: 'explicit connect proposal, guarded by server idle and identity checks' } };
    }
    if (name === 'read_system') {
      const editor = await read(args.systemId, context);
      const result = clone(editor);
      if (editor.kind === 'builtin-template') return { ...result, agentGuidance: editor.writable
        ? '这是可编辑的独立系统。使用 prepare_update_native_system 增删改算法和图表、改名或调整原生图表显示开关；矩阵、线序和协议仍固定为原生来源。完整 configuration 中保留其他项。复制使用 prepare_builtin_system 并带上 configuration。算法实际输出可绑定呼吸率趋势。串口仍通过原生设备控件连接。'
        : '这是内置原系统。使用 prepare_builtin_system 创建独立系统后，可继续编辑其算法、图表和名称。' };
      delete result.definitions?.algorithmSource;
      for (const item of Object.values(result.definitions?.sensors || {})) delete item.algorithmSource;
      if (editor.editable) {
        const binding = (await request(`/api/display-systems/${encodeURIComponent(args.systemId)}/algorithm-bindings`, context)).result;
        result.algorithmBindings = binding;
      }
      result.agentGuidance = editor.editable
        ? '当前 Manifest 系统可直接用 prepare_update_manifest_algorithms 增删改算法及真实输出图表，保留本系统 ID、协议、线序和采集数据。读取 algorithmBindings.configuration 并传完整配置；无需创建新系统。'
        : '此系统只读；可用 prepare_duplicate_system 复制成用户系统。配置读回不证明真实帧已运行。';
      return result;
    }
    if (name === 'inspect_frames') {
      await bootstrap(context);
      const editor = await read(args.systemId, context);
      if (editor.kind === 'builtin-template') {
        const matrix = editor.inputs?.matrix;
        if (!matrix || !editor.inputs.channels.includes(args.sensorId)) throw fail('AGENT_SENSOR_NOT_FOUND', '所选通道不属于原生系统。');
        return observeFrames({ WebSocketImpl, wsUrl: websocket, ...args, signal: context.signal,
          expectedPointCount: matrix.total, expectedMatrix: { rows: matrix.rows, cols: matrix.cols } });
      }
      const sensor = editor.manifest.sensors?.find((item) => item.id === args.sensorId);
      const legacy = editor.manifest.sensor;
      if (!sensor && !legacy?.ports?.includes(args.sensorId)) throw fail('AGENT_SENSOR_NOT_FOUND', 'Sensor is not declared in this system');
      const matrix = sensor?.matrix || legacy.matrix;
      return observeFrames({ WebSocketImpl, wsUrl: websocket, ...args, signal: context.signal, expectedPointCount: matrix.rows * matrix.cols, expectedMatrix: { rows: matrix.rows, cols: matrix.cols } });
    }
    const { catalog, protocols } = await capabilities(context);
    if (name === 'prepare_update_manifest_algorithms') {
      if (!catalog.manifestAlgorithmEditing?.supported) throw fail('AGENT_PLATFORM_RESTART_REQUIRED', '请完全退出并重启软件以加载 Manifest 算法绑定能力。');
      const editor = await read(args.systemId, context);
      if (editor.kind === 'builtin-template' || !editor.editable) throw fail('DISPLAY_SYSTEM_READ_ONLY', '请选择用户创建的 Manifest 系统。');
      const binding = (await request(`/api/display-systems/${encodeURIComponent(args.systemId)}/algorithm-bindings`, context)).result;
      const configuration = manifestAlgorithmConfiguration(args.configuration, editor, catalog.algorithmPackages, args.systemId);
      const inputVerification = await verifyUserClassifierActivation(configuration, binding.configuration, args.systemId, editor, catalog.algorithmPackages, context);
      return propose({ kind: 'update_manifest_algorithms', systemId: args.systemId, summary: args.summary, input: clone(args),
        expectedRevision: binding.revision, expectedSystemRevision: editor.revision, before: binding.configuration,
        after: configuration, inputVerification }, context);
    }
    if (['prepare_update_native_system', 'prepare_delete_native_system'].includes(name)) {
      if (!catalog.nativeSystemEditing?.supported) throw fail('AGENT_PLATFORM_RESTART_REQUIRED', '请重启软件加载独立系统编辑能力。');
      const editor = await read(args.systemId, context);
      if (editor.kind !== 'builtin-template' || !editor.writable) throw fail('DISPLAY_SYSTEM_READ_ONLY', '请选择用户创建的原生独立系统。');
      if (name === 'prepare_delete_native_system') return propose({ kind: 'delete_native_system', systemId: args.systemId, summary: args.summary,
        input: clone(args), expectedRevision: editor.revision, before: { name: editor.builtinTemplate.name, configuration: editor.configuration }, after: { deleted: true, dataRetained: true } }, context);
      validateBuiltinTemplate({ ...editor.builtinTemplate, name: args.name });
      const configuration = validateNativeConfiguration(args.configuration, { sourceType: editor.builtinTemplate.sourceType, systemId: args.systemId, packages: catalog.algorithmPackages });
      const inputVerification = await verifyUserClassifierActivation(configuration, editor.configuration, args.systemId, editor, catalog.algorithmPackages, context);
      return propose({ kind: 'update_native_system', systemId: args.systemId, summary: args.summary, input: clone(args), expectedRevision: editor.revision,
        before: { name: editor.builtinTemplate.name, configuration: editor.configuration }, after: { name: args.name.trim(), configuration }, inputVerification }, context);
    }
    if (name === 'prepare_builtin_system') {
      assertNativeInputCompatibility(args.sourceType, context);
      if (!catalog.builtinTemplateCreation?.supported || !catalog.builtinTemplates?.some((item) => item.id === args.sourceType)) throw fail('AGENT_CAPABILITIES_CHANGED', '内置模板不可用，请刷新目录或重启软件。');
      const template = validateBuiltinTemplate({ id: args.id, name: args.name, sourceType: args.sourceType });
      const configuration = validateNativeConfiguration(args.configuration, { sourceType: args.sourceType, systemId: args.id, packages: catalog.algorithmPackages });
      if (args.configuration && !catalog.nativeSystemEditing?.supported) throw fail('AGENT_PLATFORM_RESTART_REQUIRED', '请重启软件加载独立系统编辑能力。');
      await assertCreateIdentity(args, context);
      return propose({ kind: 'builtin_system', systemId: args.id, summary: args.summary, status: 'pending', input: clone(args),
        after: { ...template, configuration, inherits: '原生串口协议、线序、展示和设备控件', independent: '算法、图表配置、归零和采集目录', license: '沿用原系统授权' } }, context);
    }
    if (name === 'prepare_connect_device') {
      const state = await request('/api/agent-device/status', context);
      if (state.schemaVersion !== 1) throw fail('AGENT_CONTRACT_UNSUPPORTED', 'Guarded device connection is unavailable on this platform');
      if (!state.licensed) throw fail('LICENSE_REQUIRED', 'A valid license is required to connect a device');
      if (!state.idle || !state.portsIdle) throw fail('AGENT_DEVICE_BUSY', 'Stop collection/playback and close existing or reconnecting ports before preparing a connection');
      if (!state.availablePorts?.some((port) => port.path === args.portPath)) throw fail('AGENT_PORT_UNAVAILABLE', 'Selected port is not present in the current port list');
      const editor = await read(args.systemId, context);
      if (editor.kind === 'builtin-template') throw fail('AGENT_BINDING_UNSUPPORTED', '原生模板请使用页面中的设备控件连接串口。');
      const sensor = editor.manifest.sensors?.find((item) => item.id === args.sensorId);
      if (!sensor && !editor.manifest.sensor?.ports?.includes(args.sensorId)) throw fail('AGENT_SENSOR_NOT_FOUND', 'The selected sensor is not declared by this system');
      if (['seat', 'sensor'].includes(args.sensorId) || args.systemId === 'minzhen') throw fail('AGENT_BINDING_UNSUPPORTED', 'This legacy serial role requires the existing device controls');
      if (!editor.revision) throw fail('AGENT_REVISION_UNAVAILABLE', 'A target configuration revision is required');
      return propose({ kind: 'connect_device', systemId: args.systemId, summary: args.summary, status: 'pending', input: clone(args), expectedRevision: editor.revision,
        expectedCurrentSystemId: state.currentSystemId, expectedCurrentSensorType: state.currentSensorType,
        before: { currentSystemId: state.currentSystemId, currentSensorType: state.currentSensorType },
        after: { systemId: args.systemId, sensorId: args.sensorId, portPath: args.portPath, activateSystem: state.currentSystemId !== args.systemId || state.currentSensorType !== args.systemId, verification: 'Activate the selected system and open this port only; do not start collection. Realtime data remains to be checked.' } }, context);
    }
    if (name === 'prepare_create_system') {
      const payload = buildCreate(args, catalog, protocols);
      await assertCreateIdentity(args, context);
      return propose({ kind: 'create_system', systemId: args.id, summary: args.summary, status: 'pending', input: clone(args), after: payload.manifest,
        mappingPreview: mappingPreview(args, payload), payload }, context);
    }
    if (name === 'prepare_duplicate_system') {
      const editor = await read(args.sourceSystemId, context);
      if (editor.kind === 'builtin-template') throw fail('AGENT_INVALID_ARGUMENTS', '内置原生系统请使用 prepare_builtin_system，sourceType 为 ' + editor.builtinTemplate.sourceType);
      const draft = duplicateDraft(args, editor, catalog);
      await assertCreateIdentity({ id: args.id, sensors: draft.sensors }, context);
      return propose({ kind: 'duplicate_system', systemId: args.id, summary: args.summary, status: 'pending', input: clone(args),
        after: draft.manifest, patch: draft.patch, expectedRevision: editor.revision, expectedSourceDigest: displaySystemEditorDigest(editor) }, context);
    }
    const editor = await read(args.systemId, context);
    if (editor.writable !== true) throw fail('DISPLAY_SYSTEM_READ_ONLY', 'This built-in system is read-only; create a new system instead');
    if (editor.kind === 'builtin-template') throw fail('AGENT_INVALID_ARGUMENTS', '原生独立系统请使用 prepare_update_native_system 修改算法和图表。');
    if (!editor.revision) throw fail('AGENT_REVISION_UNAVAILABLE', 'Platform must provide an editor revision before changes can be prepared');
    const patch = buildPatch(args.patch, editor.manifest.display, catalog);
    return propose({ kind: 'update_display', systemId: args.systemId, summary: args.summary, status: 'pending', input: clone(args), before: clone(editor.manifest.display || {}), after: mergeDisplay(editor.manifest.display, patch), patch, expectedRevision: editor.revision }, context);
  }

  /** 应用经过审阅的提案，并从真实编辑器读回验证结果。 */
  async function apply(proposal, context = {}) {
    if (!proposal || !['pending', 'applying'].includes(proposal.status)) throw fail('AGENT_PROPOSAL_STATE', 'Only pending proposals can be applied');
    if (proposal.kind === 'algorithm_package') {
      if (!lab) throw fail('ALGORITHM_UNAVAILABLE', '算法工作台尚未加载，请重启软件。');
      const current = await request('/api/agent-device/status', context);
      if (!current.licensed || current.currentSystem?.id !== proposal.systemId) throw fail('ALGORITHM_SYSTEM_CHANGED', '请回到提案对应的已授权系统再保存算法。');
      return lab.apply(proposal);
    }
    const name = proposal.kind === 'update_manifest_algorithms' ? 'prepare_update_manifest_algorithms' : proposal.kind === 'update_native_system' ? 'prepare_update_native_system' : proposal.kind === 'delete_native_system' ? 'prepare_delete_native_system' : proposal.kind === 'builtin_system' ? 'prepare_builtin_system' : proposal.kind === 'create_system' ? 'prepare_create_system' : proposal.kind === 'duplicate_system' ? 'prepare_duplicate_system' : proposal.kind === 'update_display' ? 'prepare_update_display' : proposal.kind === 'connect_device' ? 'prepare_connect_device' : null;
    if (!name) throw fail('AGENT_PROPOSAL_STATE', 'Unknown proposal kind');
    try { validateValue(proposal.input, schemas[name]); } catch (cause) { throw fail('AGENT_INVALID_ARGUMENTS', cause.message); }
    if (proposal.systemId !== (proposal.input.id || proposal.input.systemId)) throw fail('AGENT_PROPOSAL_STATE', 'Proposal identity does not match its input');
    const { catalog, protocols } = await capabilities(context);
    if (proposal.kind === 'update_manifest_algorithms') {
      if (!catalog.manifestAlgorithmEditing?.supported) throw fail('AGENT_CAPABILITIES_CHANGED', 'Manifest 算法绑定能力已变化。');
      const editor = await read(proposal.systemId, context);
      if (editor.kind === 'builtin-template' || !editor.editable) throw fail('DISPLAY_SYSTEM_READ_ONLY', '目标不再是可编辑 Manifest 系统。');
      if (editor.revision !== proposal.expectedSystemRevision) throw fail('DISPLAY_SYSTEM_REVISION_CONFLICT', '系统输入或展示配置已变化，请重新生成提案。');
      const route = `/api/display-systems/${encodeURIComponent(proposal.systemId)}/algorithm-bindings`;
      const binding = (await request(route, context)).result;
      if (binding.revision !== proposal.expectedRevision) throw fail('DISPLAY_SYSTEM_REVISION_CONFLICT', '算法绑定已变化，请重新生成提案。');
      const configuration = manifestAlgorithmConfiguration(proposal.input.configuration, editor, catalog.algorithmPackages, proposal.systemId);
      if (JSON.stringify(configuration) !== JSON.stringify(proposal.after)) throw fail('AGENT_PROPOSAL_STATE', '算法配置提案已变化。');
      const inputVerification = await verifyUserClassifierActivation(configuration, binding.configuration, proposal.systemId, editor, catalog.algorithmPackages, context);
      const saved = await saveManifestAlgorithms(proposal.systemId, configuration, binding.revision, context);
      proposal.appliedRevision = saved.revision;
      return { systemId: proposal.systemId, verified: true, appliedRevision: saved.revision, liveVerified: false, inputVerification,
        verification: '算法绑定已保存到当前系统并读回；实际分类输出请在连接实时设备后查看算法状态和图表。' };
    }
    if (['update_native_system', 'delete_native_system'].includes(proposal.kind)) {
      if (!catalog.nativeSystemEditing?.supported) throw fail('AGENT_CAPABILITIES_CHANGED', '当前后端不支持独立系统编辑。');
      const editor = await read(proposal.systemId, context);
      if (editor.kind !== 'builtin-template' || !editor.writable) throw fail('DISPLAY_SYSTEM_READ_ONLY', '只能修改用户创建的独立系统。');
      if (editor.revision !== proposal.expectedRevision) throw fail('DISPLAY_SYSTEM_REVISION_CONFLICT', '系统已被修改，请重新生成方案。');
      if (proposal.kind === 'delete_native_system') {
        const result = await request(`/api/display-systems/${encodeURIComponent(proposal.systemId)}/native`, { ...context, method: 'DELETE', body: { expectedRevision: proposal.expectedRevision } });
        let state;
        try { state = await request('/api/display-systems', context); } catch { throw fail('AGENT_OPERATION_UNCERTAIN', '删除请求已发出，但无法确认系统目录。'); }
        if (!result.result?.deleted || !Array.isArray(state.displaySystems?.systems) || state.displaySystems.systems.some((item) => item.id === proposal.systemId)) throw fail('AGENT_OPERATION_UNCERTAIN', '尚未确认系统已移除，请刷新目录。');
        return { systemId: proposal.systemId, deleted: true, dataRetained: true, verified: true };
      }
      validateBuiltinTemplate({ ...editor.builtinTemplate, name: proposal.input.name });
      const value = { name: proposal.input.name.trim(), configuration: validateNativeConfiguration(proposal.input.configuration, { sourceType: editor.builtinTemplate.sourceType, systemId: proposal.systemId, packages: catalog.algorithmPackages }) };
      if (JSON.stringify(value) !== JSON.stringify(proposal.after)) throw fail('AGENT_PROPOSAL_STATE', '配置提案内容已变化。');
      const inputVerification = await verifyUserClassifierActivation(value.configuration, editor.configuration, proposal.systemId, editor, catalog.algorithmPackages, context);
      const saved = await saveNative(proposal.systemId, value, proposal.expectedRevision, context);
      proposal.appliedRevision = saved.revision;
      return { systemId: proposal.systemId, verified: true, appliedRevision: saved.revision, liveVerified: false, inputVerification,
        verification: inputVerification.length ? '独立配置已保存；新启用的用户分类算法已核验当前设备输入节奏。实际分类输出仍需在运行状态中观察。'
          : '独立配置已保存；算法运行及设备输入尚未经过本次核验。' };
    }
    if (proposal.kind === 'builtin_system') {
      const { id, name: systemName, sourceType } = proposal.input;
      assertNativeInputCompatibility(sourceType, context);
      const template = validateBuiltinTemplate({ id, name: systemName, sourceType });
      const configuration = validateNativeConfiguration(proposal.input.configuration, { sourceType, systemId: id, packages: catalog.algorithmPackages });
      if (!catalog.builtinTemplateCreation?.supported || !catalog.builtinTemplates?.some((item) => item.id === sourceType)) throw fail('AGENT_CAPABILITIES_CHANGED', '内置模板不可用，请重新准备提案。');
      if (['id', 'name', 'sourceType'].some((key) => template[key] !== proposal.after?.[key])) throw fail('AGENT_PROPOSAL_STATE', '模板提案内容已变化。');
      await assertCreateIdentity(proposal.input, context);
      if (proposal.input.configuration && !catalog.nativeSystemEditing?.supported) throw fail('AGENT_CAPABILITIES_CHANGED', '当前后端不支持独立算法配置。');
      if (proposal.after.configuration && JSON.stringify(configuration) !== JSON.stringify(proposal.after.configuration)) throw fail('AGENT_PROPOSAL_STATE', '算法配置提案已变化。');
      await request('/api/display-systems', { ...context, method: 'POST', body: { builtinTemplate: { ...template, ...(catalog.nativeSystemEditing?.supported && { configuration }) } } });
      let editor;
      try { editor = await read(id, context); } catch { throw fail('AGENT_OPERATION_UNCERTAIN', '模板已发送保存，但读取验证失败，请刷新系统目录。'); }
      if (JSON.stringify(editor.builtinTemplate) !== JSON.stringify(template)) throw fail('AGENT_OPERATION_UNCERTAIN', '模板保存结果与提案不一致，请检查系统目录。');
      if (catalog.nativeSystemEditing?.supported && JSON.stringify(editor.configuration) !== JSON.stringify(configuration)) throw fail('AGENT_OPERATION_UNCERTAIN', '算法图表配置读回不一致。');
      proposal.appliedRevision = editor.revision;
      return { systemId: id, verified: true, appliedRevision: editor.revision, liveVerified: false,
        verification: '内置模板副本已保存并读回核验。请从系统列表进入；串口连接和真机数据尚未验证。' };
    }
    if (proposal.kind === 'connect_device') {
      const args = proposal.input;
      const acknowledgement = await request('/api/agent-device/connect', { ...context, method: 'POST', body: {
        systemId: args.systemId, sensorId: args.sensorId, portPath: args.portPath,
        requestId: `agent-${proposal.id || context.taskId || 'connect'}`,
        expectedRevision: proposal.expectedRevision, expectedCurrentSystemId: proposal.expectedCurrentSystemId,
        expectedCurrentSensorType: proposal.expectedCurrentSensorType,
      } });
      try {
        if (!acknowledgement.accepted || acknowledgement.systemId !== args.systemId || acknowledgement.sensorId !== args.sensorId || acknowledgement.portPath !== args.portPath) throw new Error('Connection acknowledgement does not match the selected target');
        const frames = await execute('inspect_frames', { systemId: args.systemId, sensorId: args.sensorId, durationMs: 3000, maxFrames: 30 }, context);
        const state = await request('/api/agent-device/status', context);
        const editor = await read(args.systemId, context);
        if (state.currentSystemId !== args.systemId || !state.licensed || editor.revision !== proposal.expectedRevision) throw new Error('System changed during device verification');
        const port = state.serial?.find((item) => item.role === acknowledgement.serialRole && item.path === args.portPath);
        if (!port || port.lastError || !['open', 'opening'].includes(port.status)) throw new Error('Selected port did not reach an open or opening state');
        const connected = port.isOpen === true && port.status === 'open';
        const liveVerified = connected && frames.liveVerified === true;
        return { systemId: args.systemId, sensorId: args.sensorId, portPath: args.portPath, accepted: true, connected, liveVerified, frames,
          verification: liveVerified ? 'Selected port is open and matching, recent, nonempty realtime frames were observed. Physical calibration and rendering remain unverified.'
            : connected ? 'Selected port is open; valid realtime data has not yet been verified.' : 'Connection was accepted and is still opening; realtime data has not been verified.' };
      } catch (cause) { throw fail('AGENT_OPERATION_UNCERTAIN', 'Activation/connection was dispatched, but verification did not complete. Inspect the current system and device; no automatic rollback was attempted.', { causeCode: cause.code, cause: cause.message }); }
    }
    let result;
    if (proposal.kind === 'create_system') {
      const payload = buildCreate(proposal.input, catalog, protocols);
      if (JSON.stringify(payload) !== JSON.stringify(proposal.payload)) throw fail('AGENT_CAPABILITIES_CHANGED', 'Registered capabilities changed; prepare a new proposal');
      await assertCreateIdentity(proposal.input, context);
      result = await request('/api/display-systems', { ...context, method: 'POST', body: payload });
    } else if (proposal.kind === 'duplicate_system') {
      const editor = await read(proposal.input.sourceSystemId, context);
      if (editor.revision !== proposal.expectedRevision || displaySystemEditorDigest(editor) !== proposal.expectedSourceDigest) throw fail('DISPLAY_SYSTEM_REVISION_CONFLICT', '复制源的配置或映射已变化，请重新生成提案。');
      const draft = duplicateDraft(proposal.input, editor, catalog);
      if (JSON.stringify(draft.manifest) !== JSON.stringify(proposal.after) || JSON.stringify(draft.patch) !== JSON.stringify(proposal.patch)) throw fail('AGENT_CAPABILITIES_CHANGED', '复制预览已变化，请重新生成提案。');
      await assertCreateIdentity({ id: proposal.systemId, sensors: draft.sensors }, context);
      result = await request(`/api/display-systems/${encodeURIComponent(proposal.input.sourceSystemId)}/duplicate`, { ...context, method: 'POST', body: {
        id: proposal.systemId, name: proposal.input.name, ...draft.patch, independentSensorTypes: true,
        expectedRevision: proposal.expectedRevision, expectedSourceDigest: proposal.expectedSourceDigest,
      } });
    } else {
      const editor = await read(proposal.systemId, context);
      if (editor.revision !== proposal.expectedRevision) throw fail('DISPLAY_SYSTEM_REVISION_CONFLICT', 'System changed; prepare a new proposal');
      const patch = buildPatch(proposal.input.patch, editor.manifest.display, catalog);
      if (JSON.stringify(patch) !== JSON.stringify(proposal.patch)) throw fail('AGENT_CAPABILITIES_CHANGED', 'Proposal content changed; prepare a new proposal');
      result = await request(`/api/display-systems/${encodeURIComponent(proposal.systemId)}/display`, { ...context, method: 'PATCH', body: { ...patch, expectedRevision: proposal.expectedRevision } });
    }
    let editor;
    try { editor = await read(proposal.systemId, context); } catch { throw fail('AGENT_OPERATION_UNCERTAIN', 'Write returned success but readback failed; inspect the system before retrying'); }
    if (JSON.stringify(result.result?.manifest) !== JSON.stringify(editor.manifest)) throw fail('AGENT_OPERATION_UNCERTAIN', 'Readback differs from the write result; another editor may have changed the system');
    if (proposal.kind === 'create_system') {
      for (const [sensorId, expected] of Object.entries(proposal.payload.definitions.sensors)) {
        const saved = editor.definitions?.sensors?.[sensorId];
        if (JSON.stringify(saved?.lineOrder) !== JSON.stringify(expected.lineOrder)
          || JSON.stringify(saved?.pointOrder) !== JSON.stringify(expected.pointOrder)
          || JSON.stringify(saved?.coordinateMap || null) !== JSON.stringify(expected.coordinateMap || null)) {
          throw fail('AGENT_OPERATION_UNCERTAIN', `系统已写入，但 ${sensorId} 线序或点位读回不一致；请检查实际配置。`);
        }
      }
    }
    if (proposal.kind === 'duplicate_system' && JSON.stringify(editor.manifest) !== JSON.stringify(proposal.after)) throw fail('AGENT_OPERATION_UNCERTAIN', '副本已写入，但与确认的配置不一致，请检查实际系统。');
    proposal.appliedRevision = editor.revision;
    return { systemId: proposal.systemId, verified: true, appliedRevision: editor.revision, verification: 'Saved configuration read back successfully. Device activation, live data and physical correctness are not verified.', liveVerified: false };
  }

  /** 恢复显示修改，仅当当前版本仍等于该提案写入版本时才执行。 */
  async function restore(proposal, context = {}) {
    if (proposal?.kind === 'update_manifest_algorithms' && ['applied', 'restoring'].includes(proposal.status) && proposal.appliedRevision) {
      await capabilities(context);
      const saved = await saveManifestAlgorithms(proposal.systemId, proposal.before, proposal.appliedRevision, context);
      return { systemId: proposal.systemId, restored: true, verified: true, revision: saved.revision };
    }
    if (proposal?.kind === 'update_native_system' && ['applied', 'restoring'].includes(proposal.status) && proposal.appliedRevision) {
      await capabilities(context);
      const editor = await saveNative(proposal.systemId, proposal.before, proposal.appliedRevision, context);
      return { systemId: proposal.systemId, restored: true, verified: true, revision: editor.revision };
    }
    if (proposal?.kind !== 'update_display' || !['applied', 'restoring'].includes(proposal.status) || !proposal.appliedRevision) throw fail('AGENT_RESTORE_UNAVAILABLE', 'Only applied display changes can be restored; created systems are retained');
    await bootstrap(context);
    const patch = Object.fromEntries(DISPLAY_FIELDS.filter((key) => Object.hasOwn(proposal.patch, key)).map((key) => [key, proposal.before[key] ?? null]));
    const result = await request(`/api/display-systems/${encodeURIComponent(proposal.systemId)}/display`, { ...context, method: 'PATCH', body: { ...patch, expectedRevision: proposal.appliedRevision } });
    let editor;
    try { editor = await read(proposal.systemId, context); } catch { throw fail('AGENT_OPERATION_UNCERTAIN', 'Restore was sent but readback failed; inspect the system'); }
    if (JSON.stringify(result.result?.manifest) !== JSON.stringify(editor.manifest)) throw fail('AGENT_OPERATION_UNCERTAIN', 'Restored configuration differs from readback');
    return { systemId: proposal.systemId, restored: true, verified: true, revision: editor.revision };
  }

  return { definitions, execute, apply, restore, listAlgorithmRecords, selectAlgorithmRecords };
}

module.exports = { createAgentTools };
