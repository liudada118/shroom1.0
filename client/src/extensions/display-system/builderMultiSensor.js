const DEFAULT_PORT_LABELS = Object.freeze({
  sit: '主传感器',
  back: '靠背',
  head: '头枕',
  sensor: '扩展传感器',
});

function normalizePorts(ports = []) {
  const normalized = (Array.isArray(ports) ? ports : [])
    .map((port) => String(port || '').trim())
    .filter(Boolean);
  return [...new Set(normalized.length ? normalized : ['sit'])];
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
} = {}) {
  const systemId = String(displaySystemId || '').trim();
  return normalizePorts(ports).map((id) => ({
    id,
    label: String(portLabels?.[id] || DEFAULT_PORT_LABELS[id] || id).trim() || id,
    outputChannel: id,
    source: `${id}Data`,
    channelId: systemId ? `${systemId}:${id}` : id,
  }));
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
} = {}) {
  return buildBuilderSensorPlan({ displaySystemId, ports, portLabels }).map((identity) => ({
    id: identity.id,
    label: identity.label,
    outputChannel: identity.outputChannel,
    type,
    matrix: { ...(matrix || {}) },
    files: { ...(files || {}) },
    protocol: {
      ...(protocol || {}),
      framing: { ...(protocol?.framing || {}) },
      decoding: { ...(protocol?.decoding || {}) },
      ...(protocol?.validation
        ? {
          validation: {
            ...protocol.validation,
            ...(protocol.validation.checksum
              ? { checksum: { ...protocol.validation.checksum } }
              : {}),
          },
        }
        : {}),
    },
    algorithm: {
      ...(algorithm || {}),
      input: { ...(algorithm?.input || {}) },
      output: { ...(algorithm?.output || {}) },
    },
    stored: stored !== false,
  }));
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
  const allowedSources = new Set(plan.map((sensor) => sensor.source));
  const primarySource = plan[0].source;
  const normalized = (Array.isArray(widgets) ? widgets : [])
    .filter((widget) => widget && typeof widget === 'object')
    .map((widget) => {
      const source = String(widget.source || '').trim();
      return {
        ...widget,
        source: allowedSources.has(source) ? source : primarySource,
      };
    });
  const occupiedIds = new Set(normalized.map((widget) => String(widget.id || '')).filter(Boolean));
  const dataWidgets = normalized.filter((widget) => widget.type !== 'pressureStats');
  const coveredSources = new Set(dataWidgets.map((widget) => widget.source));
  const template = dataWidgets[0] || {
    id: 'main',
    type: rendererId,
    label: '压力数据',
    columnSpan: 12,
  };

  plan.forEach((sensor) => {
    if (coveredSources.has(sensor.source)) return;
    const safeId = sensor.id.replace(/[^A-Za-z0-9._-]+/g, '-') || 'sensor';
    normalized.push({
      ...template,
      id: uniqueWidgetId(`${template.id || 'main'}-${safeId}`, occupiedIds),
      label: `${sensor.label} · ${template.label || '压力数据'}`,
      source: sensor.source,
    });
    coveredSources.add(sensor.source);
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
