export const AGENT_RENDERER_SCHEMA_VERSION = 1;
export const AGENT_RENDERER_PREFIX = 'agent:';

export const AGENT_RENDERER_MESSAGE_TYPES = Object.freeze({
  INIT: 'shroom.renderer.init',
  FRAME: 'shroom.renderer.frame',
  READY: 'shroom.renderer.ready',
  ERROR: 'shroom.renderer.error',
});

function asTrimmedString(value) {
  return value == null ? '' : String(value).trim();
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toSerializableValue(value, depth = 0) {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (depth >= 6 || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    return undefined;
  }
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    return Array.from(value, (item) => {
      const next = toSerializableValue(item, depth + 1);
      return next === undefined ? null : next;
    });
  }
  if (typeof value !== 'object') return undefined;

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return [];
    const next = toSerializableValue(item, depth + 1);
    return next === undefined ? [] : [[key, next]];
  }));
}

function normalizeValues(values) {
  if (!Array.isArray(values) && !ArrayBuffer.isView(values)) return [];
  return Array.from(values, (value) => (
    typeof value === 'number' && Number.isFinite(value) ? value : null
  ));
}

function normalizeMatrix(matrix = {}) {
  const rows = Math.max(0, Math.trunc(toFiniteNumber(matrix?.rows ?? matrix?.height)));
  const cols = Math.max(0, Math.trunc(toFiniteNumber(matrix?.cols ?? matrix?.width)));
  return { rows, cols, total: rows * cols };
}

function normalizeMetrics(metrics) {
  const serializable = toSerializableValue(metrics);
  return serializable && typeof serializable === 'object' && !Array.isArray(serializable)
    ? serializable
    : {};
}

function normalizeSerial(serial) {
  if (!serial || typeof serial !== 'object' || Array.isArray(serial)) return null;
  const baudRate = Number(serial.baudRate);
  const normalized = {
    role: asTrimmedString(serial.role) || null,
    portId: asTrimmedString(serial.portId) || null,
    path: asTrimmedString(serial.path) || null,
    baudRate: Number.isFinite(baudRate) && baudRate > 0 ? baudRate : null,
    parserChannel: asTrimmedString(serial.parserChannel) || null,
    status: asTrimmedString(serial.status) || null,
    isOpen: typeof serial.isOpen === 'boolean' ? serial.isOpen : null,
    openedAt: normalizeTimestamp(serial.openedAt),
  };
  return Object.values(normalized).some((value) => value != null) ? normalized : null;
}

function normalizeTimestamp(timestamp) {
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) return timestamp;
  if (typeof timestamp === 'string' && timestamp.trim()) return timestamp.trim();
  return null;
}

function normalizeRendererHeight(height) {
  if (height == null || String(height).trim() === '') return 480;
  const numeric = Number(height);
  return Number.isFinite(numeric)
    ? Math.max(160, Math.min(2000, Math.round(numeric)))
    : 480;
}

function normalizeIdentity(identity = {}) {
  return {
    displaySystemId: asTrimmedString(identity.displaySystemId),
    sensorId: asTrimmedString(identity.sensorId),
    sensorLabel: asTrimmedString(identity.sensorLabel),
    sensorType: asTrimmedString(identity.sensorType),
    outputChannel: asTrimmedString(identity.outputChannel),
    channelId: asTrimmedString(identity.channelId),
  };
}

function normalizeChannel(channel = {}, fallbackIdentity = {}) {
  const identity = normalizeIdentity({ ...fallbackIdentity, ...channel });
  return {
    ...identity,
    timestamp: normalizeTimestamp(channel.timestamp),
    values: normalizeValues(channel.values),
    rawValues: normalizeValues(channel.rawValues),
    matrix: normalizeMatrix(channel.matrix),
    metrics: normalizeMetrics(channel.metrics),
    algorithmMetrics: normalizeMetrics(channel.algorithmMetrics),
    serial: normalizeSerial(channel.serial),
  };
}

export function parseAgentRendererId(rendererId) {
  const value = asTrimmedString(rendererId);
  if (!value.startsWith(AGENT_RENDERER_PREFIX)) return null;
  const appId = value.slice(AGENT_RENDERER_PREFIX.length).trim();
  return appId || null;
}

export function isAgentRendererId(rendererId) {
  return Boolean(parseAgentRendererId(rendererId));
}

export function toAgentRendererId(appId) {
  const normalized = asTrimmedString(appId);
  return normalized ? `${AGENT_RENDERER_PREFIX}${normalized}` : '';
}

/**
 * 兼容 raw、HttpResult 和旧 result 三种列表响应，只保留真正有 iframe entryUrl 的应用。
 */
export function normalizeAgentRendererApps(payload) {
  const body = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const apps = Array.isArray(body)
    ? body
    : Array.isArray(body?.apps)
      ? body.apps
      : Array.isArray(body?.result?.apps)
        ? body.result.apps
        : [];

  const seen = new Set();
  return apps.flatMap((app) => {
    if (!app || typeof app !== 'object' || Array.isArray(app)) return [];
    const explicitRendererId = asTrimmedString(app.rendererId);
    const explicitAppId = asTrimmedString(app.id || app.appId);
    const rendererId = isAgentRendererId(explicitRendererId)
      ? explicitRendererId
      : toAgentRendererId(explicitAppId);
    const appId = parseAgentRendererId(rendererId);
    const entryUrl = asTrimmedString(app.entryUrl || app.renderer?.entryUrl);
    if (!appId || !entryUrl || seen.has(rendererId)) return [];
    seen.add(rendererId);
    return [{
      appId,
      id: rendererId,
      rendererId,
      name: asTrimmedString(app.name || app.label || appId) || appId,
      label: asTrimmedString(app.renderer?.label || app.name || app.label || appId) || appId,
      entryUrl,
      height: normalizeRendererHeight(app.renderer?.height ?? app.height),
      permissions: Array.isArray(app.permissions)
        ? app.permissions.map(asTrimmedString).filter(Boolean)
        : [],
    }];
  });
}

export function resolveAgentRendererEntryUrl(entryUrl, baseUrl = '', appId = '') {
  const value = asTrimmedString(entryUrl);
  const normalizedAppId = asTrimmedString(appId);
  if (!value || !normalizedAppId) return '';
  const base = asTrimmedString(baseUrl)
    || (typeof window !== 'undefined' ? window.location?.href : '');
  try {
    const resolved = base ? new URL(value, base) : new URL(value);
    const apiBase = base ? new URL(base) : resolved;
    const pageOrigin = typeof window !== 'undefined'
      && ['http:', 'https:'].includes(window.location?.protocol)
      ? window.location.origin
      : '';
    const loopbackHost = ['127.0.0.1', 'localhost', '::1'].includes(apiBase.hostname);
    const expectedPrefix = `/api/agent-apps/${encodeURIComponent(normalizedAppId)}/files/`;
    return ['http:', 'https:'].includes(resolved.protocol)
      && (apiBase.origin === pageOrigin || loopbackHost)
      && resolved.origin === apiBase.origin
      && resolved.pathname.startsWith(expectedPrefix)
      ? resolved.href
      : '';
  } catch {
    return '';
  }
}

export function buildAgentRendererInit({ rendererId, widgetId, label, identity } = {}) {
  const normalizedRendererId = asTrimmedString(rendererId);
  return {
    type: AGENT_RENDERER_MESSAGE_TYPES.INIT,
    schemaVersion: AGENT_RENDERER_SCHEMA_VERSION,
    payload: {
      appId: parseAgentRendererId(normalizedRendererId) || '',
      rendererId: normalizedRendererId,
      widgetId: asTrimmedString(widgetId),
      label: asTrimmedString(label),
      ...normalizeIdentity(identity),
    },
  };
}

/**
 * 建立 iframe 唯一允许接收的帧 DTO。字段逐项重建，避免把 React/Electron 对象、函数或
 * 串口句柄跨进程传给 Agent 页面。channels 为空时仍补入当前路，保证单路应用行为稳定。
 */
export function buildAgentRendererFrame({
  identity,
  timestamp,
  values,
  rawValues,
  matrix,
  metrics,
  algorithmMetrics,
  serial,
  channels,
} = {}) {
  const canonicalIdentity = normalizeIdentity(identity);
  const current = normalizeChannel({
    ...canonicalIdentity,
    timestamp,
    values,
    rawValues,
    matrix,
    metrics,
    algorithmMetrics,
    serial,
  });
  const normalizedChannels = (Array.isArray(channels) ? channels : [])
    .map((channel) => normalizeChannel(channel, canonicalIdentity))
    .filter((channel) => channel.channelId || channel.sensorId || channel.outputChannel);

  return {
    type: AGENT_RENDERER_MESSAGE_TYPES.FRAME,
    schemaVersion: AGENT_RENDERER_SCHEMA_VERSION,
    payload: {
      ...current,
      channels: normalizedChannels.length ? normalizedChannels : [current],
    },
  };
}

/** ready 可能早于 iframe onLoad 冒泡；首次握手 init 在前，已握手时只补最新 frame。 */
export function buildAgentRendererReadyMessages(initMessage, frameMessage, { initPosted = false } = {}) {
  return [initPosted ? null : initMessage, frameMessage].filter(Boolean);
}

export function getAgentRendererInitSignature(initMessage) {
  const payload = toSerializableValue(initMessage?.payload);
  return JSON.stringify(payload && typeof payload === 'object' ? payload : {});
}

/**
 * sandbox iframe 没有 same-origin，event.origin 会是 `null`；可信边界只能绑定到当前
 * iframe 的 contentWindow。只接受 v1 ready/error，忽略 iframe 发来的其它命令。
 */
export function readAgentRendererResponse(event, expectedSource) {
  if (!event || !expectedSource || event.source !== expectedSource) return null;
  const data = event.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (Number(data.schemaVersion) !== AGENT_RENDERER_SCHEMA_VERSION) return null;
  if (![AGENT_RENDERER_MESSAGE_TYPES.READY, AGENT_RENDERER_MESSAGE_TYPES.ERROR].includes(data.type)) {
    return null;
  }
  const payload = data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)
    ? data.payload
    : {};
  return {
    status: data.type === AGENT_RENDERER_MESSAGE_TYPES.READY ? 'ready' : 'error',
    message: asTrimmedString(payload.message || payload.error || data.message || data.error),
  };
}
