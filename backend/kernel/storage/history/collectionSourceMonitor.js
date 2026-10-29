/** Track current-connection live frames without retaining sensor values or broadcasting per-frame changes. */
function createCollectionSourceMonitor({ channelBus, getContext, onStatus = () => {}, onUnavailable = () => {},
  now = Date.now, schedule = setInterval, unschedule = clearInterval, timeoutMs = 5000 }) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('timeoutMs must be positive');
  let disposed = false, refreshing = false, systemId = null, unavailableReported = false;
  const received = new Map();
  let publishedKey = null;
  let current = { systemId: null, ready: false, connected: false, code: 'COLLECTION_DEVICE_NOT_CONNECTED',
    timeoutMs, lastFrameAgeMs: null };

  /** Read only the current source identity and connection state; unavailable context fails closed. */
  function context() {
    let value;
    try { value = getContext() || {}; } catch { value = {}; }
    return { systemId: typeof value.systemId === 'string' ? value.systemId : null,
      connected: value.connected === true, playback: value.playback === true, collecting: value.collecting === true,
      connectionKey: typeof value.connectionKey === 'string' ? value.connectionKey : null,
      roleConnectionKeys: value.roleConnectionKeys && typeof value.roleConnectionKeys === 'object' && !Array.isArray(value.roleConnectionKeys)
        ? value.roleConnectionKeys : null,
      roles: Array.isArray(value.roles) ? [...new Set(value.roles.filter(role => typeof role === 'string' && role))].sort() : [] };
  }

  /** Legacy contexts use one generation key; current contexts bind each role to its own connection. */
  function connectionKey(source, role) {
    const value = source.roleConnectionKeys
      ? Object.hasOwn(source.roleConnectionKeys, role) ? source.roleConnectionKeys[role] : null
      : source.connectionKey;
    return typeof value === 'string' && value ? value : null;
  }

  /** Prefer the physical source: a single glove port may publish the opposite hand's logical channel. */
  function frameRole(frame) {
    if (frame.serial?.role != null) return typeof frame.serial.role === 'string' ? frame.serial.role : null;
    const protocol = frame.payload?.protocol;
    if (protocol && Object.hasOwn(protocol, 'packetSourcePort')) {
      return ['sit', 'back'].includes(protocol.packetSourcePort) ? protocol.packetSourcePort : null;
    }
    return frame.outputChannel || frame.sensorId;
  }

  /** Accept only complete numeric canonical frames from an allowed role in this active system. */
  function accepts(event, source) {
    const frame = event?.payload;
    if (event?.metadata?.synthetic === true || !source.connected || source.playback || !source.systemId
      || frame?.type !== 'sensor.frame' || frame.source !== 'realtime' || frame.displaySystemId !== source.systemId
      || typeof frame.sensorId !== 'string' || !frame.sensorId
      || frame.channelId !== `${source.systemId}:${frame.sensorId}` || event.channelId !== frame.channelId) return false;
    const role = frameRole(frame);
    if (!source.roles.includes(role) || !connectionKey(source, role)) return false;
    const values = frame.payload?.value;
    if (!Array.isArray(values) || values.length === 0) return false;
    for (let index = 0; index < values.length; index += 1) {
      if (typeof values[index] !== 'number' || !Number.isFinite(values[index])) return false;
    }
    return true;
  }

  /** Recheck age synchronously so a start command cannot slip between interval ticks. */
  function refresh(event) {
    if (disposed || refreshing) return { ...current };
    refreshing = true;
    try {
      const source = context(), at = now();
      if (systemId !== source.systemId || !source.connected || source.playback) {
        received.clear();
        systemId = source.systemId;
      }
      // One role reconnecting or becoming unhealthy must not discard fresh data from another live role.
      for (const [role, entry] of received) {
        if (!source.roles.includes(role) || connectionKey(source, role) !== entry.connectionKey || at < entry.lastFrameAt) received.delete(role);
      }
      if (event && accepts(event, source) && Number.isFinite(at)) {
        const role = frameRole(event.payload);
        received.set(role, { connectionKey: connectionKey(source, role), lastFrameAt: at });
      }
      let lastFrameAt = null;
      for (const entry of received.values()) if (lastFrameAt === null || entry.lastFrameAt > lastFrameAt) lastFrameAt = entry.lastFrameAt;
      const age = lastFrameAt === null ? null : Math.max(0, at - lastFrameAt);
      const connected = source.connected && Boolean(source.systemId && (source.connectionKey || source.roleConnectionKeys));
      const code = source.playback ? 'COLLECTION_PLAYBACK_ACTIVE' : !connected ? 'COLLECTION_DEVICE_NOT_CONNECTED'
        : age === null || !Number.isFinite(age) || age >= timeoutMs ? 'COLLECTION_DATA_NOT_READY' : null;
      current = { systemId: source.systemId, ready: code === null, connected, code, timeoutMs, lastFrameAgeMs: age };
      const key = JSON.stringify([current.systemId, current.ready, current.connected, current.code]);
      if (!source.collecting || current.ready) unavailableReported = false;
      // Save state and the latch before callbacks: publishing or stopping may synchronously query status again.
      const unavailable = source.collecting && !current.ready && !unavailableReported;
      if (unavailable) unavailableReported = true;
      if (key !== publishedKey) {
        publishedKey = key;
        try { onStatus({ ...current }); } catch { /* A detached UI must not interrupt frame processing. */ }
      }
      if (unavailable) {
        try { onUnavailable({ ...current }); }
        catch { unavailableReported = false; /* Retry cleanup on the next check without interrupting the source. */ }
      }
      return { ...current };
    } finally { refreshing = false; }
  }

  /** Return a fresh source snapshot; callers cannot mutate the monitor's saved state. */
  function status() { return refresh(); }

  const unsubscribe = channelBus.subscribe('*', refresh);
  const timer = schedule(() => refresh(), Math.min(1000, timeoutMs));
  timer?.unref?.();

  /** Stop timers and subscriptions, discard freshness, and prevent late frames from restoring readiness. */
  function dispose() {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    unschedule(timer);
    received.clear();
    current = { ...current, ready: false, connected: false, code: 'COLLECTION_DEVICE_NOT_CONNECTED', lastFrameAgeMs: null };
  }

  return { status, refresh, dispose };
}

module.exports = { createCollectionSourceMonitor };
