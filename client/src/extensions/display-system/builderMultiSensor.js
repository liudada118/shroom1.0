const DEFAULT_PORT_LABELS = Object.freeze({
  sit: '主传感器',
  back: '靠背',
  head: '头枕',
  sensor: '扩展传感器',
});

export const BUILDER_SENSOR_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
  }
  return value;
}

/**
 * 把 tags 输入归一成稳定 sensor id：去空白、去重、丢弃不符合 manifest id
 * 规则的值。表单会单独提示非法值，这里保证保存辅助函数永远不制造危险 key。
 */
export function normalizeBuilderSensorIds(ports = [], { fallback = true } = {}) {
  const normalized = (Array.isArray(ports) ? ports : [])
    .map((port) => String(port || '').trim())
    .filter((port) => port && BUILDER_SENSOR_ID_PATTERN.test(port));
  const unique = [...new Set(normalized)];
  return unique.length || !fallback ? unique : ['sit'];
}

export function getInvalidBuilderSensorIds(ports = []) {
  return [...new Set((Array.isArray(ports) ? ports : [])
    .map((port) => String(port || '').trim())
    .filter((port) => port && !BUILDER_SENSOR_ID_PATTERN.test(port)))];
}

export function buildBuilderSensorFilePath(sensorId, fileName, { multiple = false } = {}) {
  const [id] = normalizeBuilderSensorIds([sensorId], { fallback: false });
  const safeFileName = String(fileName || '').replace(/^[/\\]+/, '');
  if (!safeFileName) return '';
  return multiple && id ? `${id}/${safeFileName}` : safeFileName;
}

function uniqueWidgetId(base, occupiedIds) {
  let candidate = base;
  let suffix = 2;
  while (occupiedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  occupiedIds.add(candidate);
  return candidate;
}

/**
 * Builder 多串口的唯一身份映射。
 *
 * `id` / `outputChannel` 是稳定机器键，`label` 是业务名，`source` 供页面路由，
 * `channelId` 供实时、入库、下载和回放统一识别。
 */
export function buildBuilderSensorPlan({
  displaySystemId = '',
  ports = [],
  portLabels = {},
  sensors = [],
} = {}) {
  const systemId = String(displaySystemId || '').trim();
  const sensorById = new Map((Array.isArray(sensors) ? sensors : [])
    .filter((sensor) => sensor?.id)
    .map((sensor) => [String(sensor.id), sensor]));
  return normalizeBuilderSensorIds(ports).map((id) => {
    const sensor = sensorById.get(id) || {};
    const outputChannel = String(sensor.outputChannel || id).trim() || id;
    return {
      id,
      label: String(portLabels?.[id] || sensor.label || DEFAULT_PORT_LABELS[id] || id).trim() || id,
      outputChannel,
      source: `${outputChannel}Data`,
      channelId: systemId ? `${systemId}:${id}` : id,
    };
  });
}

export function buildPortLabels(ports = [], configuredLabels = {}) {
  return Object.fromEntries(
    buildBuilderSensorPlan({ ports, portLabels: configuredLabels })
      .map(({ id, label }) => [id, label]),
  );
}

/**
 * 生成 schema v3 的逐路 sensor 声明。对象字段都拷贝，避免表单后续修改
 * 某一路时意外改到其它路。
 */
export function buildBuilderSensors({
  displaySystemId = '',
  ports = [],
  portLabels = {},
  type,
  matrix,
  files,
  protocol,
  algorithm,
  stored = true,
  sensorDrafts = [],
} = {}) {
  const drafts = (Array.isArray(sensorDrafts) ? sensorDrafts : [])
    .map((draft) => draft?.sensor || draft)
    .filter((sensor) => sensor?.id);
  const draftById = new Map(drafts.map((sensor) => [String(sensor.id), sensor]));
  return buildBuilderSensorPlan({
    displaySystemId,
    ports,
    portLabels,
    sensors: drafts,
  }).map((identity) => {
    const preserved = cloneValue(draftById.get(identity.id) || {});
    return {
      ...preserved,
      id: identity.id,
      label: identity.label,
      outputChannel: identity.outputChannel,
      type: preserved.type || type,
      matrix: cloneValue(preserved.matrix || matrix || {}),
      files: cloneValue(preserved.files || files || {}),
      protocol: cloneValue(preserved.protocol || protocol || {}),
      algorithm: cloneValue(preserved.algorithm || algorithm || { type: 'none' }),
      stored: preserved.stored == null ? stored !== false : preserved.stored !== false,
    };
  });
}

/**
 * 从 editor 响应建立不会丢字段的逐路草稿。definitions.sensors 是 v3 真相；
 * 顶层 definitions 只在第一路兜底，兼容旧后端响应与 v1/v2 manifest。
 */
export function buildBuilderSensorDrafts(editor = {}) {
  const manifest = editor?.manifest || {};
  const legacySensor = manifest.sensor || {};
  const declaredSensors = Array.isArray(manifest.sensors) && manifest.sensors.length
    ? manifest.sensors
    : normalizeBuilderSensorIds(legacySensor.ports || ['sit']).map((id) => ({
      id,
      label: legacySensor.portLabels?.[id] || legacySensor.label || id,
      outputChannel: id,
      type: legacySensor.type,
      matrix: legacySensor.matrix,
      files: manifest.files,
      protocol: manifest.protocol,
      algorithm: manifest.algorithm,
      stored: true,
    }));
  const scopedDefinitions = editor?.definitions?.sensors;
  const sharedDefinitions = cloneValue(editor?.definitions || {});
  delete sharedDefinitions.sensors;

  return declaredSensors.map((sensor, index) => {
    const id = String(sensor?.id || index).trim();
    const scoped = Array.isArray(scopedDefinitions)
      ? scopedDefinitions[index]
      : scopedDefinitions?.[id];
    return {
      id,
      sensor: cloneValue({ ...sensor, id }),
      definitions: cloneValue(scoped || (index === 0 ? sharedDefinitions : {})),
    };
  });
}

/**
 * 保留已经指向当前任一串口的显式 source，并为尚未出现的每路补一个
 * 独立数据 widget。`pressureStats` 只是统计卡，不能代替数据视图。
 */
export function ensureBuilderPortWidgets({
  widgets = [],
  sensorPlan = [],
  rendererId = 'heatmap',
} = {}) {
  const plan = sensorPlan.length ? sensorPlan : buildBuilderSensorPlan();
  const sensorForSource = new Map(plan.flatMap((sensor) => (
    [sensor.source, sensor.outputChannel, sensor.id, sensor.channelId, `${sensor.id}Data`]
      .filter(Boolean)
      .map((source) => [source, sensor])
  )));
  const primarySource = plan[0].source;
  const normalized = (Array.isArray(widgets) ? widgets : [])
    .filter((widget) => widget && typeof widget === 'object')
    .map((widget) => {
      const source = String(widget.source || '').trim();
      return {
        ...widget,
        source: sensorForSource.has(source) ? source : primarySource,
      };
    });
  const occupiedIds = new Set(normalized.map((widget) => String(widget.id || '')).filter(Boolean));
  const dataWidgets = normalized.filter((widget) => widget.type !== 'pressureStats');
  const coveredSensorIds = new Set(dataWidgets
    .map((widget) => sensorForSource.get(widget.source)?.id)
    .filter(Boolean));
  const template = dataWidgets[0] || {
    id: 'main',
    type: rendererId,
    label: '压力数据',
    columnSpan: 12,
  };

  plan.forEach((sensor) => {
    if (coveredSensorIds.has(sensor.id)) return;
    const safeId = sensor.id.replace(/[^A-Za-z0-9._-]+/g, '-') || 'sensor';
    normalized.push({
      ...template,
      id: uniqueWidgetId(`${template.id || 'main'}-${safeId}`, occupiedIds),
      label: `${sensor.label} · ${template.label || '压力数据'}`,
      source: sensor.source,
    });
    coveredSensorIds.add(sensor.id);
  });

  return normalized;
}

/**
 * 每个 renderer 在每路串口上都生成一个 view。主路保留原 renderer id，
 * 因此旧的 defaultView 和 profile 引用仍然有效。
 */
export function buildBuilderPortViews(renderers = [], sensorPlan = []) {
  const plan = sensorPlan.length ? sensorPlan : buildBuilderSensorPlan();
  return plan.flatMap((sensor, sensorIndex) => (
    (Array.isArray(renderers) ? renderers : []).map((renderer) => ({
      id: sensorIndex === 0 ? renderer.id : `${renderer.id}-${sensor.id}`,
      type: renderer.type,
      label: sensorIndex === 0 ? renderer.label : `${sensor.label} · ${renderer.label}`,
      source: sensor.source,
    }))
  ));
}
