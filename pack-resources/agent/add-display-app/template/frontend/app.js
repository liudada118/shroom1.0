(() => {
  'use strict';

  const SCHEMA_VERSION = 1;
  const TYPES = Object.freeze({
    INIT: 'shroom.renderer.init',
    FRAME: 'shroom.renderer.frame',
    READY: 'shroom.renderer.ready',
    ERROR: 'shroom.renderer.error',
  });
  const canvas = document.getElementById('grid');
  const context = canvas.getContext('2d', { alpha: false });
  const title = document.getElementById('title');
  const channel = document.getElementById('channel');
  const stateText = document.getElementById('state');
  const summary = document.getElementById('summary');
  const state = {
    identity: null,
    frame: null,
    framesByChannelId: new Map(),
    lastError: '',
  };

  function post(type, payload = {}) {
    window.parent.postMessage({ type, schemaVersion: SCHEMA_VERSION, payload }, '*');
  }

  function reportError(error) {
    const message = error instanceof Error ? error.message : String(error || 'renderer error');
    state.lastError = message;
    stateText.textContent = message;
    stateText.dataset.level = 'error';
    post(TYPES.ERROR, { message });
  }

  function requireObject(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${name} must be an object`);
    }
    return value;
  }

  function requireCanonicalIdentity(payload) {
    const displaySystemId = typeof payload.displaySystemId === 'string'
      ? payload.displaySystemId.trim()
      : '';
    const sensorId = typeof payload.sensorId === 'string' ? payload.sensorId.trim() : '';
    const channelId = typeof payload.channelId === 'string' ? payload.channelId.trim() : '';
    if (!displaySystemId || !sensorId || displaySystemId.includes(':') || sensorId.includes(':')) {
      throw new Error('displaySystemId and sensorId must be non-empty canonical identity parts');
    }
    if (channelId !== `${displaySystemId}:${sensorId}`) {
      throw new Error('channelId does not match displaySystemId:sensorId');
    }
    return { displaySystemId, sensorId, channelId };
  }

  function acceptInit(payload) {
    requireObject(payload, 'init.payload');
    const identity = requireCanonicalIdentity(payload);
    const sensorLabel = typeof payload.sensorLabel === 'string' && payload.sensorLabel.trim()
      ? payload.sensorLabel.trim()
      : identity.sensorId;
    state.identity = Object.freeze({ ...identity, sensorLabel });
    state.frame = null;
    state.framesByChannelId.clear();
    title.textContent = sensorLabel;
    channel.textContent = identity.channelId;
    stateText.textContent = 'initialized';
    stateText.dataset.level = 'ok';
    draw();
    post(TYPES.READY, {});
  }

  function normalizeValues(values, fieldName) {
    if (!Array.isArray(values)) throw new Error(`${fieldName} must be an array`);
    return values.map((value) => {
      if (value === null) return null;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${fieldName} items must be finite numbers or null`);
      }
      return value;
    });
  }

  function normalizeMatrix(matrix, fieldName) {
    if (matrix == null) return null;
    requireObject(matrix, fieldName);
    const rows = Number(matrix.rows);
    const cols = Number(matrix.cols);
    const total = Number(matrix.total);
    if (!Number.isInteger(rows) || rows < 0 || !Number.isInteger(cols) || cols < 0
      || !Number.isInteger(total) || total !== rows * cols) {
      throw new Error(`${fieldName} must contain nonnegative rows/cols and matching total`);
    }
    return rows > 0 && cols > 0 ? { rows, cols, total } : null;
  }

  function normalizeTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
    return null;
  }

  function normalizeSerial(serial, fieldName) {
    if (serial == null) return null;
    requireObject(serial, fieldName);
    const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
    const baudRate = Number(serial.baudRate);
    const normalized = {
      role: text(serial.role),
      portId: text(serial.portId),
      path: text(serial.path),
      baudRate: Number.isFinite(baudRate) && baudRate > 0 ? baudRate : null,
      parserChannel: text(serial.parserChannel),
      status: text(serial.status),
      isOpen: typeof serial.isOpen === 'boolean' ? serial.isOpen : null,
      openedAt: normalizeTimestamp(serial.openedAt),
    };
    return Object.values(normalized).some((value) => value != null) ? normalized : null;
  }

  function normalizeFrame(payload, fieldName) {
    requireObject(payload, fieldName);
    const identity = requireCanonicalIdentity(payload);
    const timestamp = normalizeTimestamp(payload.timestamp);
    return {
      ...identity,
      sensorLabel: typeof payload.sensorLabel === 'string' && payload.sensorLabel.trim()
        ? payload.sensorLabel.trim()
        : identity.sensorId,
      values: normalizeValues(payload.values, `${fieldName}.values`),
      rawValues: payload.rawValues == null
        ? null
        : normalizeValues(payload.rawValues, `${fieldName}.rawValues`),
      matrix: normalizeMatrix(payload.matrix, `${fieldName}.matrix`),
      timestamp,
      metrics: payload.metrics == null ? {} : { ...requireObject(payload.metrics, `${fieldName}.metrics`) },
      algorithmMetrics: payload.algorithmMetrics == null
        ? {}
        : { ...requireObject(payload.algorithmMetrics, `${fieldName}.algorithmMetrics`) },
      serial: normalizeSerial(payload.serial, `${fieldName}.serial`),
    };
  }

  function acceptFrame(payload) {
    requireObject(payload, 'frame.payload');
    if (!state.identity) throw new Error('frame received before init');
    const currentFrame = normalizeFrame(payload, 'frame.payload');
    if (currentFrame.channelId !== state.identity.channelId) {
      throw new Error(`frame channel mismatch: ${currentFrame.channelId}`);
    }

    if (payload.channels != null && !Array.isArray(payload.channels)) {
      throw new Error('frame.payload.channels must be an array when present');
    }
    const nextFrames = new Map(state.framesByChannelId);
    const seenChannels = new Set();
    (payload.channels || []).forEach((item, index) => {
      const channelFrame = normalizeFrame(item, `frame.payload.channels[${index}]`);
      if (seenChannels.has(channelFrame.channelId)) {
        throw new Error(`duplicate channelId in channels: ${channelFrame.channelId}`);
      }
      seenChannels.add(channelFrame.channelId);
      nextFrames.set(channelFrame.channelId, channelFrame);
    });
    // 顶层始终是当前 widget 路由，保留它作为单路 v1 的可靠兜底。
    nextFrames.set(currentFrame.channelId, currentFrame);
    state.framesByChannelId = nextFrames;
    state.frame = state.framesByChannelId.get(state.identity.channelId);
    const physicalPort = currentFrame.serial?.path || currentFrame.serial?.portId;
    const serialParts = [physicalPort, currentFrame.serial?.baudRate, currentFrame.serial?.status]
      .filter((value) => value != null && value !== '');
    channel.textContent = [state.identity.channelId, serialParts.join(' @ ')].filter(Boolean).join(' · ');
    const frameTime = currentFrame.timestamp == null ? null : new Date(currentFrame.timestamp);
    stateText.textContent = !frameTime || Number.isNaN(frameTime.getTime())
      ? 'frame received'
      : frameTime.toLocaleTimeString();
    stateText.dataset.level = 'ok';
    draw();
  }

  function gridShape(frame) {
    const rows = Number(frame?.matrix?.rows);
    const cols = Number(frame?.matrix?.cols);
    if (Number.isInteger(rows) && rows > 0 && Number.isInteger(cols) && cols > 0
      && rows * cols === frame.values.length) {
      return { rows, cols };
    }
    const fallbackCols = Math.max(1, Math.ceil(Math.sqrt(frame.values.length || 1)));
    return {
      rows: Math.max(1, Math.ceil(frame.values.length / fallbackCols)),
      cols: fallbackCols,
    };
  }

  function colorFor(value, maximum) {
    if (value === null) return '#293047';
    const ratio = maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0;
    const hue = 225 - ratio * 225;
    return `hsl(${hue} 88% ${38 + ratio * 18}%)`;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width: rect.width, height: rect.height };
  }

  function draw() {
    const size = resizeCanvas();
    context.fillStyle = '#050916';
    context.fillRect(0, 0, size.width, size.height);
    if (!state.frame) return;

    const { values } = state.frame;
    const shape = gridShape(state.frame);
    const gap = 2;
    const cellWidth = Math.max(1, (size.width - gap * (shape.cols - 1)) / shape.cols);
    const cellHeight = Math.max(1, (size.height - gap * (shape.rows - 1)) / shape.rows);
    const finite = values.filter((value) => typeof value === 'number');
    const maximum = finite.reduce((current, value) => Math.max(current, value), 0);

    values.forEach((value, index) => {
      const row = Math.floor(index / shape.cols);
      const col = index % shape.cols;
      const x = col * (cellWidth + gap);
      const y = row * (cellHeight + gap);
      context.fillStyle = colorFor(value, maximum);
      context.fillRect(x, y, cellWidth, cellHeight);
      if (cellWidth >= 34 && cellHeight >= 24) {
        context.fillStyle = 'rgba(255,255,255,0.9)';
        context.font = '11px ui-monospace, monospace';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(value === null ? '—' : String(value), x + cellWidth / 2, y + cellHeight / 2);
      }
    });

    const total = finite.reduce((sum, value) => sum + value, 0);
    summary.textContent = `${values.length} values · max ${maximum} · total ${total} · ${state.framesByChannelId.size} channel(s)`;
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    if (message.type !== TYPES.INIT && message.type !== TYPES.FRAME) return;
    try {
      if (message.schemaVersion !== SCHEMA_VERSION) {
        throw new Error(`unsupported renderer message schemaVersion: ${message.schemaVersion}`);
      }
      if (message.type === TYPES.INIT) acceptInit(message.payload);
      else acceptFrame(message.payload);
    } catch (error) {
      reportError(error);
    }
  });

  window.addEventListener('resize', draw);
  window.addEventListener('error', (event) => reportError(event.error || event.message));
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason));
  post(TYPES.READY, {});
  draw();
})();
