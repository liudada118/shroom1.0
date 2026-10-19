const { recordBusinessEvent } = require('./businessEvents');

/** Observe connection-bound frames without retaining pressure values or emitting per-frame events. */
function createFrameUsageObserver({ channelBus, getContext, emit = recordBusinessEvent, now = Date.now,
  schedule = setInterval, unschedule = clearInterval, firstFrameTimeoutMs = 10000, gapMs = 2000, summaryMs = 30000 }) {
  const connections = new Map();
  let closed = false;

  /** Keep roles local; only anonymous system identity and transport type leave this observer. */
  function roleKey(role) { return ({ port1: 'sit', port2: 'back', portHead: 'head', portSensor: 'sensor' })[role] || String(role || 'sit'); }
  /** Emit a fixed-vocabulary transition with no port path, sensor labels or payload data. */
  function report(entry, featureId, action, result, durationMs) {
    emit('device_connection_result', { ...entry.properties, featureId, action, result,
      ...(durationMs === undefined ? {} : { durationMs: Math.min(86400000, Math.max(0, durationMs)) }) });
  }
  /** Attach a timer only to real opened connections, and forget closed or failed connections. */
  function connection(status, connectionType = 'serial') {
    if (closed || !status) return;
    const context = getContext(), key = `${context.systemType}:${roleKey(status.role)}`;
    if (['closed', 'error', 'disconnected'].includes(status.status)) {
      const previous = connections.get(key); if (previous) summarize(previous, now());
      connections.delete(key); return;
    }
    if (!['open', 'connected'].includes(status.status) || connections.has(key)) return;
    connections.set(key, { key, role: roleKey(status.role), openedAt: now(), firstSeen: false, timedOut: false,
      paused: false, lastReceived: null, windowAt: now(), frames: 0, properties: { systemType: context.systemType,
        systemOrigin: context.systemOrigin || 'custom', connectionType } });
    if (connections.size > 64) connections.delete(connections.keys().next().value);
  }
  /** Flush only counts and elapsed time, including short connections that never reach a full window. */
  function summarize(entry, at) {
    if (!entry.frames) return;
    emit('usage_session_summary', { ...entry.properties, featureId: 'sensor_frames', action: 'receive_summary',
      count: entry.frames, durationMs: Math.min(86400000, Math.max(0, at - entry.windowAt)) });
    entry.frames = 0; entry.windowAt = at;
  }
  /** Match explicit serial metadata or output role; a second sensor cannot satisfy the first sensor's timer. */
  function receive(event) {
    if (closed) return;
    try {
      const frame = event?.payload, context = getContext();
      if (context.playback || context.allowed === false || frame?.type !== 'sensor.frame' || frame.source !== 'realtime' || !frame.payload?.value?.length) return;
      const systemType = frame.displaySystemId || frame.sensorType;
      if (systemType !== context.systemType) return;
      const role = roleKey(frame.serial?.role || frame.outputChannel || frame.sensorId);
      const entry = connections.get(`${systemType}:${role}`)
        || connections.get(`${systemType}:halow`);
      if (!entry) return;
      const receivedAt = now();
      if (!entry.firstSeen) {
        report(entry, 'sensor_first_frame', entry.timedOut ? 'first_frame_recovered' : 'first_frame', 'success', receivedAt - entry.openedAt);
        entry.firstSeen = true;
      } else if (entry.paused) report(entry, 'sensor_stream_gap', 'stream_recovered', 'success', receivedAt - entry.lastReceived);
      entry.lastReceived = receivedAt; entry.paused = false; entry.frames++;
    } catch { /* Counters cannot interrupt canonical frame publication. */ }
  }
  /** Report a bounded receive-rate summary and transitions, excluding intentional playback and closed ports. */
  function tick() {
    if (closed) return;
    const current = getContext(), at = now();
    for (const [key, entry] of connections) {
      if (entry.properties.systemType !== current.systemType) { summarize(entry, at); connections.delete(key); continue; }
      if (current.playback || current.allowed === false) {
        entry.windowAt = at; entry.frames = 0; entry.lastReceived = null; entry.paused = false; entry.openedAt = at; continue;
      }
      if (!entry.firstSeen && !entry.timedOut && at - entry.openedAt >= firstFrameTimeoutMs) {
        entry.timedOut = true; report(entry, 'sensor_first_frame', 'first_frame_timeout', 'failure', at - entry.openedAt);
      }
      if (entry.firstSeen && entry.lastReceived !== null && !entry.paused && at - entry.lastReceived > gapMs) {
        entry.paused = true; report(entry, 'sensor_stream_gap', 'stream_paused', 'unknown', at - entry.lastReceived);
      }
      if (entry.frames && at - entry.windowAt >= summaryMs) {
        summarize(entry, at);
      }
    }
  }
  const unsubscribe = channelBus.subscribe('*', receive), timer = schedule(tick, 1000); timer?.unref?.();
  /** Remove the side observer before shutting down the realtime bus. */
  function dispose() { for (const entry of connections.values()) summarize(entry, now()); closed = true; unsubscribe(); unschedule(timer); connections.clear(); }
  return { connection, tick, dispose };
}

module.exports = { createFrameUsageObserver };
