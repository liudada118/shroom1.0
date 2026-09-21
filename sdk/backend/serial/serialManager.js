const { createSerialPort: defaultCreateSerialPort } = require('./serialHelper');
const { getSerialPathReservation, normalizeSerialPath } = require('./serialPathReservation');
const { validateFrame } = require('../protocol/displaySystemProtocol');
const { createSerialError, normalizeSerialError, serializeSerialError } = require('./serialErrors');

const SERIAL_PORT_ROLES = Object.freeze({ SIT: 'sit', BACK: 'back', HEAD: 'head', SENSOR: 'sensor' });
const DEFAULT_RECONNECT_INTERVAL_MS = 3000;

/** 归一业务角色标识。 */
function normalizePortId(portId) { return String(portId || '').trim(); }

/** 归一登记配置，保留显式关闭自动打开/重连的语义。 */
function normalizePortConfig(portId, config = {}) {
  const id = normalizePortId(config.portId || config.role || portId);
  if (!id) throw new Error('serial portId is required');
  return { ...config, portId: id, role: config.role || id,
    path: String(config.path || '').trim(), autoOpen: config.autoOpen !== false, reconnect: config.reconnect === true };
}

/**
 * 管理串口连接、取消、有限重连及低频状态通知。
 * start 仍同步返回 SerialPort；调用 waitForOpen 才能确认物理打开结果。
 * ⚠️ 超时/取消后的迟到 open 必须关闭；关闭未确认前锁住路径，避免幽灵连接抢占新连接。
 */
function createSerialManager({ createSerialPort = defaultCreateSerialPort, parserManager, logger,
  onStatus, openTimeoutMs = 10000, closeTimeoutMs = 3000, dataTimeoutMs = 5000,
  maxReconnectAttempts = 3 } = {}) {
  const registeredPorts = new Map();
  const workers = new Map();
  const closingPaths = new Map();
  let reconnectTimer = null;
  let nextConnectionId = 0;
  let revision = 0;

  /** 取得当前连接实例；旧回调不得以角色名覆盖它。 */
  function getWorker(portId) { return workers.get(normalizePortId(portId)) || null; }
  /** 读取当前物理端口。 */
  function getPort(portId) { return getWorker(portId)?.port || null; }
  /** 判断端口是否处于可用的物理打开状态。 */
  function isOpen(portId) { return getWorker(portId)?.status === 'open' && Boolean(getPort(portId)?.isOpen); }

  /** 协议探测也必须避开尚未释放的路径，包括被新实例替换的旧连接。 */
  function isPathBusy(path) {
    const key = normalizeSerialPath(path);
    return closingPaths.has(key) || [...workers.values()].some((worker) => normalizeSerialPath(worker.path) === key
      && (worker.status === 'opening' || worker.port?.isOpen));
  }

  /** 生成状态快照；error 给界面，lastError 保留旧调用方兼容。 */
  function buildStatus(config, worker = null) {
    return { portId: config.portId, role: config.role || config.portId, path: worker?.path || config.path || null,
      baudRate: worker?.baudRate || config.baudRate || null, parserChannel: config.parserChannel || null,
      reconnect: config.reconnect === true, isRegistered: true,
      isOpen: Boolean(worker?.port?.isOpen), status: worker?.status || 'registered',
      connectionId: worker?.connectionId || null, openedAt: worker?.openedAt || null, updatedAt: worker?.updatedAt || null,
      revision: worker?.revision || 0,
      lastError: worker?.error?.message || null, error: serializeSerialError(worker?.error),
      health: worker?.health || 'waiting', retryAttempt: worker?.retryAttempt || 0 };
  }
  /** 读取单通道或全部已登记通道状态。 */
  function getStatus(portId) {
    const id = normalizePortId(portId);
    if (id) return registeredPorts.has(id) ? buildStatus(registeredPorts.get(id), getWorker(id)) : null;
    return [...registeredPorts.values()].map((config) => buildStatus(config, getWorker(config.portId)));
  }
  /** 发布状态变化；隔离界面发布器异常，避免影响硬件清理。 */
  function publish(worker) {
    if (getWorker(worker.portId) !== worker) return;
    worker.updatedAt = Date.now();
    worker.revision = ++revision;
    try { onStatus?.(getStatus(worker.portId)); } catch (error) { logger?.warn?.('[SerialManager] status publish failed', error); }
  }
  /** 保存重连意图，手动关闭及初次打开失败必须禁用自动重连。 */
  function setReconnect(portId, reconnect) {
    const id = normalizePortId(portId);
    const config = registeredPorts.get(id);
    if (!config) return null;
    const next = { ...config, reconnect: reconnect === true };
    registeredPorts.set(id, next);
    return { ...next };
  }
  /** 拒绝重复连接和跨通道抢占，校验失败不覆盖旧配置。 */
  function assertAvailable(config) {
    const current = getWorker(config.portId);
    if (current?.status === 'opening') throw createSerialError('SERIAL_CONNECT_BUSY', '', config);
    if (getSerialPathReservation(config.path)) throw createSerialError('SERIAL_PORT_RESERVED', '', config);
    if (closingPaths.has(normalizeSerialPath(config.path))) throw createSerialError('SERIAL_CLOSE_FAILED', 'previous connection is still closing', config);
    const occupied = [...workers.values()].find((worker) => worker.portId !== config.portId && normalizeSerialPath(worker.path) === normalizeSerialPath(config.path)
      && (worker.status === 'opening' || worker.port?.isOpen));
    if (occupied) throw createSerialError('SERIAL_PORT_BUSY', 'in use by ' + occupied.role, config);
  }
  /** 登记配置，不做物理打开。 */
  function registerPort(portIdOrConfig, maybeConfig = {}) {
    const config = typeof portIdOrConfig === 'object'
      ? normalizePortConfig(portIdOrConfig.portId || portIdOrConfig.role, portIdOrConfig)
      : normalizePortConfig(portIdOrConfig, maybeConfig);
    assertAvailable(config);
    registeredPorts.set(config.portId, config);
    return { ...config };
  }
  /** 清除当前连接的采样监听和定时器，不移除业务 parser 上的其他监听器。 */
  function detach(worker) {
    clearTimeout(worker.openTimer);
    clearInterval(worker.healthTimer);
    worker.port?.removeListener('data', worker.rawHandler);
    if (worker.dataHandler) worker.port?.removeListener('data', worker.dataHandler);
    worker.parser?.removeListener('data', worker.frameHandler);
    if (worker.parser) worker.port?.unpipe?.(worker.parser);
  }
  /** 等待物理资源关闭；未完成的 open 保留锁，迟到回调负责释放。 */
  function release(worker) {
    if (worker.released) return Promise.resolve({ ok: true });
    if (worker.releasePromise) return worker.releasePromise;
    worker.releasePromise = new Promise((resolve) => { worker.finishRelease = resolve; });
    closingPaths.set(normalizeSerialPath(worker.path), worker);
    const timer = setTimeout(() => {
      const error = createSerialError('SERIAL_CLOSE_FAILED', 'close timeout', { ...worker, stage: 'close' });
      worker.finishRelease({ ok: false, error });
      if (getWorker(worker.portId) === worker && worker.status === 'stopping') {
        worker.status = 'error'; worker.error = error; publish(worker);
      }
    }, closeTimeoutMs);
    timer.unref?.();
    // 一次失败回调不意味着资源已释放，迟到成功仍须释放路径锁。
    worker.finishClose = (error) => {
      clearTimeout(timer);
      if (!error) worker.released = true;
      if (!error && closingPaths.get(normalizeSerialPath(worker.path)) === worker) closingPaths.delete(normalizeSerialPath(worker.path));
      worker.finishRelease(error ? { ok: false, error: normalizeSerialError(error, { ...worker, stage: 'close' }, 'SERIAL_CLOSE_FAILED') } : { ok: true });
      if (error) worker.releasePromise = null;
    };
    const releasing = worker.releasePromise;
    closeReleasedPort(worker);
    return releasing;
  }
  /** 关闭被取消的端口；打开仍在进行时由打开回调再次进入此函数。 */
  function closeReleasedPort(worker) {
    if (worker.openPending) return;
    if (!worker.port?.isOpen) { worker.finishClose?.(); return; }
    if (worker.closePending) return;
    worker.closePending = true;
    try { worker.port.close((error) => { worker.closePending = false; worker.finishClose?.(error); }); }
    catch (error) { worker.closePending = false; worker.finishClose?.(error); }
  }
  /** 终止打开并回传真实失败，旧回调只能清理自己的实例。 */
  function failOpen(worker, error) {
    if (worker.cancelled) return;
    worker.cancelled = true;
    worker.status = 'error'; worker.error = error;
    if (!worker.retryAttempt || worker.retryAttempt >= maxReconnectAttempts) setReconnect(worker.portId, false);
    detach(worker);
    worker.rejectOpen(error);
    publish(worker);
    void release(worker);
    try { worker.onOpenError?.(error); } catch (callbackError) { logger?.warn?.('[SerialManager] open callback failed', callbackError); }
  }
  /** 记录数据健康变化，恢复后清除告警，避免逐帧发布状态。 */
  function setHealth(worker, health, code) {
    if (worker.cancelled || worker.health === health) return;
    worker.health = health;
    worker.error = code ? createSerialError(code, '', { ...worker, stage: 'data' }) : null;
    publish(worker);
  }
  /** 观察已有 parser 的输出，只使用该通道已声明的校验规则。 */
  function recordFrame(worker, frame) {
    if (worker.cancelled || worker.status !== 'open') return;
    worker.lastFrameAt = Date.now();
    const valid = !worker.protocol || validateFrame(frame, worker.protocol).ok;
    worker.badFrames = valid ? 0 : worker.badFrames + 1;
    if (valid) { worker.retryAttempt = 0; setHealth(worker, 'ok'); }
    else if (worker.badFrames >= 10) setHealth(worker, 'invalid', 'SERIAL_BAD_FRAMES');
  }
  /** 处理打开结果并启动数据静默监测，物理打开和数据就绪是两个不同状态。 */
  function finishOpen(worker, error) {
    worker.openPending = false;
    if (worker.cancelled || getWorker(worker.portId) !== worker) { closeReleasedPort(worker); return; }
    if (worker.status === 'open') return;
    if (error) { failOpen(worker, normalizeSerialError(error, worker)); return; }
    clearTimeout(worker.openTimer);
    worker.status = 'open'; worker.error = null; worker.openedAt = Date.now();
    worker.resolveOpen(buildStatus(registeredPorts.get(worker.portId), worker));
    publish(worker);
    worker.healthTimer = setInterval(() => {
      if (worker.status !== 'open' || worker.cancelled) return;
      const now = Date.now();
      if (now - (worker.lastDataAt || worker.openedAt) >= dataTimeoutMs) setHealth(worker, 'silent', 'SERIAL_NO_DATA');
      else if (worker.parser && now - (worker.lastFrameAt || worker.openedAt) >= dataTimeoutMs) setHealth(worker, 'unframed', 'SERIAL_NO_FRAME');
    }, Math.min(1000, dataTimeoutMs));
    worker.healthTimer.unref?.();
  }
  /** 同步创建端口，旧连接关闭完成后才开始打开新端口。 */
  function start(portId, overrides = {}) {
    const id = normalizePortId(portId);
    const registered = registeredPorts.get(id);
    if (!registered) throw new Error('serial port is not registered: ' + id);
    const config = normalizePortConfig(id, { ...registered, ...overrides, portId: id });
    if (!config.path) throw createSerialError('SERIAL_PORT_NOT_FOUND', 'path is required', config);
    assertAvailable(config);
    const previous = getWorker(id);
    if (previous?.status === 'open' && previous.port.isOpen && normalizeSerialPath(previous.path) === normalizeSerialPath(config.path)
      && previous.baudRate === config.baudRate && previous.parserChannel === config.parserChannel) return previous.port;
    const closing = previous ? stop(id, 'replace connection') : Promise.resolve({ ok: true });
    const worker = { ...config, connectionId: ++nextConnectionId, status: 'opening', health: 'waiting',
      retryAttempt: overrides.retryAttempt || 0, port: null, error: null, openedAt: null,
      updatedAt: Date.now(), badFrames: 0, cancelled: false, openPending: false };
    worker.openResult = new Promise((resolve, reject) => { worker.resolveOpen = resolve; worker.rejectOpen = reject; });
    // 旧同步调用方只监听状态；仍提前消费拒绝，HTTP 可以独立 await 原 Promise。
    worker.openResult.catch(() => {});
    workers.set(id, worker);
    registeredPorts.set(id, config);
    worker.rawHandler = (data) => {
      if (worker.cancelled || !data?.length) return;
      worker.lastDataAt = Date.now();
      if (!worker.parser) recordFrame(worker, data);
    };
    worker.frameHandler = (frame) => recordFrame(worker, frame);
    try {
      worker.port = createSerialPort({ path: config.path, baudRate: config.baudRate, autoOpen: false });
      worker.port.on('open', () => finishOpen(worker));
      worker.port.on('error', (error) => {
        if (worker.cancelled) return;
        if (worker.status === 'opening') { failOpen(worker, normalizeSerialError(error, worker)); return; }
        worker.error = normalizeSerialError(error, { ...worker, stage: 'runtime' }, 'SERIAL_RUNTIME_ERROR');
        worker.status = 'error'; worker.cancelled = true; detach(worker); publish(worker); void release(worker);
      });
      worker.port.on('close', () => {
        if (worker.cancelled) { worker.finishClose?.(); return; }
        if (worker.status === 'opening') { failOpen(worker, createSerialError('SERIAL_DISCONNECTED', '', worker)); return; }
        worker.status = 'closed'; worker.error = createSerialError('SERIAL_DISCONNECTED', '', { ...worker, stage: 'runtime' });
        worker.cancelled = true; detach(worker); publish(worker);
      });
      if (config.parserChannel && parserManager) {
        worker.parser = parserManager.pipe(worker.port, config.parserChannel);
        worker.parser.on('data', worker.frameHandler);
      }
      worker.port.on('data', worker.rawHandler);
      if (typeof config.dataHandler === 'function') worker.port.on('data', config.dataHandler);
      publish(worker);
      worker.openTimer = setTimeout(() => failOpen(worker, createSerialError('SERIAL_CONNECT_TIMEOUT', '', worker)), openTimeoutMs);
      worker.openTimer.unref?.();
      closing.then((result) => {
        if (worker.cancelled) return;
        if (result?.ok === false) { failOpen(worker, result.error); return; }
        if (config.autoOpen) {
          worker.openPending = true;
          try { worker.port.open((error) => finishOpen(worker, error)); }
          catch (error) { finishOpen(worker, error); }
        }
      });
    } catch (error) {
      const failure = normalizeSerialError(error, worker);
      failOpen(worker, failure);
      throw failure;
    }
    return worker.port;
  }
  /** 等待当前这一次物理打开，取消/超时不会被之后的重连冒充成功。 */
  function waitForOpen(portId) {
    const worker = getWorker(portId);
    return worker?.openResult || Promise.reject(createSerialError('SERIAL_OPEN_FAILED', 'no connection attempt', { role: portId }));
  }
  /** 停止当前实例；返回可检查的关闭结果，兼容未 await 的旧调用方。 */
  function stop(portId, reason = 'stop') {
    const worker = getWorker(portId);
    if (!worker) return Promise.resolve({ ok: true });
    if (worker.status === 'opening') worker.rejectOpen(createSerialError('SERIAL_CONNECT_CANCELLED', reason, worker));
    worker.cancelled = true; worker.status = 'stopping'; worker.error = null;
    detach(worker); publish(worker);
    return release(worker).then((result) => {
      worker.status = result.ok ? 'closed' : 'error'; worker.error = result.error || null;
      publish(worker);
      return result;
    });
  }
  /** 关闭同一路径的其他角色，调用方可等待资源释放。 */
  function closeByPath(path, { exceptPortId } = {}) {
    return Promise.all([...workers.values()].filter((worker) => normalizeSerialPath(worker.path) === normalizeSerialPath(path) && worker.portId !== exceptPortId)
      .map((worker) => { setReconnect(worker.portId, false); return stop(worker.portId, 'close by path'); }));
  }
  /** 登记并启动一路串口。 */
  function open(portIdOrConfig, options) { return start(registerPort(portIdOrConfig, options).portId); }
  /** 手动关闭必须撤销重连意图。 */
  function close(portId, reason = 'close') { setReconnect(portId, false); return stop(portId, reason); }
  /** 为意外断开的连接进行有限重试，打开中或资源未释放时不重复尝试。 */
  function reconnectPort(portId, reason = 'serial reconnect') {
    const id = normalizePortId(portId);
    const config = registeredPorts.get(id);
    const worker = getWorker(id);
    if (!config?.reconnect || isOpen(id) || worker?.status === 'opening' || worker?.status === 'stopping' || closingPaths.has(normalizeSerialPath(config.path))) {
      return { portId: id, attempted: false, status: worker?.status || 'unregistered' };
    }
    try {
      start(id, { retryAttempt: (worker?.retryAttempt || 0) + 1 });
      logger?.info?.('[SerialManager] reconnect ' + id + ' (' + reason + ')');
      return { portId: id, attempted: true, ok: true };
    } catch (error) {
      setReconnect(id, false);
      return { portId: id, attempted: true, ok: false, error: error.message };
    }
  }
  /** 重连指定角色或全部登记角色。 */
  function reconnectAll({ portIds, reason = 'serial reconnect' } = {}) {
    return (portIds?.length ? portIds : [...registeredPorts.keys()]).map((id) => reconnectPort(id, reason));
  }
  /** 停止全局重连轮询。 */
  function stopReconnectLoop() {
    if (!reconnectTimer) return false;
    clearInterval(reconnectTimer); reconnectTimer = null; return true;
  }
  /** 启动后台重连，不把发起尝试当成打开成功。 */
  function startReconnectLoop({ intervalMs = DEFAULT_RECONNECT_INTERVAL_MS, reason = 'serial reconnect', onReconnect } = {}) {
    stopReconnectLoop();
    reconnectTimer = setInterval(() => {
      const results = reconnectAll({ reason });
      if (results.some((result) => result.attempted)) onReconnect?.(results);
    }, intervalMs);
    return reconnectTimer;
  }
  /** 关闭所有端口并禁用后续重连。 */
  function closeAll(reason = 'close all') {
    stopReconnectLoop();
    return Promise.all([...workers.keys()].map((id) => close(id, reason)));
  }
  return { roles: SERIAL_PORT_ROLES, close, closeAll, closeByPath, getEntry: getWorker, getPort, getStatus,
    isOpen, isPathBusy, open, registerPort, reconnectAll, reconnectPort, setReconnect, start, startReconnectLoop,
    stopReconnectLoop, stop, waitForOpen };
}

module.exports = { SERIAL_PORT_ROLES, createSerialManager };
