const { createSerialPort: defaultCreateSerialPort } = require('./serialHelper');

const SERIAL_PORT_ROLES = Object.freeze({
  SIT: 'sit',
  BACK: 'back',
  HEAD: 'head',
  SENSOR: 'sensor',
});

const DEFAULT_RECONNECT_INTERVAL_MS = 3000;

function normalizePortId(portId) {
  return String(portId || '').trim();
}

function normalizePortConfig(portId, config = {}) {
  const normalizedPortId = normalizePortId(config.portId || config.role || portId);
  if (!normalizedPortId) {
    throw new Error('serial portId is required');
  }

  return {
    ...config,
    portId: normalizedPortId,
    role: config.role || normalizedPortId,
    autoOpen: config.autoOpen !== false,
    reconnect: config.reconnect === true,
  };
}

/**
 * 创建串口管理器。
 *
 * 目标接口对齐架构文档：业务层先 registerPort，再 start/stop，
 * manager 统一维护物理串口生命周期、重复打开保护和状态上报。
 */
function createSerialManager({
  createSerialPort = defaultCreateSerialPort,
  parserManager,
  logger,
} = {}) {
  const registeredPorts = new Map();
  const workers = new Map();
  let reconnectTimer = null;

  function getWorker(portId) {
    return workers.get(normalizePortId(portId)) || null;
  }

  function getEntry(portId) {
    return getWorker(portId);
  }

  function getPort(portId) {
    return getWorker(portId)?.port || null;
  }

  function isOpen(portId) {
    return Boolean(getPort(portId)?.isOpen);
  }

  function removeDataHandler(worker) {
    if (worker?.dataHandler) {
      worker.port.removeListener('data', worker.dataHandler);
    }
  }

  function markWorkerStatus(worker, status, extra = {}) {
    if (!worker) return;
    worker.status = status;
    worker.updatedAt = Date.now();
    Object.assign(worker, extra);
  }

  function registerPort(portIdOrConfig, maybeConfig = {}) {
    const config = typeof portIdOrConfig === 'object'
      ? normalizePortConfig(portIdOrConfig.portId || portIdOrConfig.role, portIdOrConfig)
      : normalizePortConfig(portIdOrConfig, maybeConfig);

    registeredPorts.set(config.portId, config);
    return { ...config };
  }

  function setReconnect(portId, reconnect) {
    const normalizedPortId = normalizePortId(portId);
    const config = registeredPorts.get(normalizedPortId);
    if (!config) return null;

    const nextConfig = {
      ...config,
      reconnect: reconnect === true,
    };
    registeredPorts.set(normalizedPortId, nextConfig);
    return { ...nextConfig };
  }

  function closeByPath(portPath, { exceptPortId } = {}) {
    if (!portPath) return;

    [...workers.entries()].forEach(([portId, worker]) => {
      if (portId !== exceptPortId && worker.path === portPath) {
        void stop(portId, `duplicate path ${portPath}`);
      }
    });
  }

  function start(portId, overrides = {}) {
    const normalizedPortId = normalizePortId(portId);
    const registered = registeredPorts.get(normalizedPortId);
    if (!registered) {
      throw new Error(`serial port is not registered: ${normalizedPortId}`);
    }

    const config = normalizePortConfig(normalizedPortId, {
      ...registered,
      ...overrides,
      portId: normalizedPortId,
    });
    const {
      path,
      baudRate,
      autoOpen,
      parserChannel,
      dataHandler,
      onOpenError,
    } = config;

    if (!path) {
      throw new Error(`serial path is required for port: ${normalizedPortId}`);
    }

    void stop(normalizedPortId, 'restart same port');
    closeByPath(path, { exceptPortId: normalizedPortId });

    const worker = {
      ...config,
      status: 'opening',
      port: null,
      openedAt: Date.now(),
      updatedAt: Date.now(),
      lastError: null,
    };
    workers.set(normalizedPortId, worker);

    const port = createSerialPort(
      {
        path,
        baudRate,
        autoOpen,
      },
      function handleOpenError(err) {
        if (err) {
          markWorkerStatus(worker, 'error', { lastError: err.message || String(err) });
          if (typeof onOpenError === 'function') {
            onOpenError(err);
          } else {
            logger?.warn?.(`[SerialManager] ${normalizedPortId} open error:`, err);
          }
          return;
        }
        markWorkerStatus(worker, 'open', { lastError: null });
      }
    );

    worker.port = port;

    if (parserChannel && parserManager) {
      parserManager.pipe(port, parserChannel);
    }

    if (typeof dataHandler === 'function') {
      port.on('data', dataHandler);
    }

    port.on('error', (error) => {
      markWorkerStatus(worker, 'error', { lastError: error.message || String(error) });
      logger?.warn?.(`[SerialManager] ${normalizedPortId} runtime error:`, error);
    });

    port.on('close', () => {
      if (workers.get(normalizedPortId) === worker) {
        markWorkerStatus(worker, 'closed');
      }
    });

    return port;
  }

  function stop(portId, reason = 'stop') {
    const normalizedPortId = normalizePortId(portId);
    const worker = getWorker(normalizedPortId);
    if (!worker) return Promise.resolve();

    removeDataHandler(worker);
    workers.delete(normalizedPortId);
    markWorkerStatus(worker, 'stopping');

    if (!worker.port?.isOpen) {
      markWorkerStatus(worker, 'closed');
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      worker.port.close((err) => {
        if (err) {
          logger?.warn?.(`[SerialManager] ${normalizedPortId} close error (${reason}):`, err);
          markWorkerStatus(worker, 'error', { lastError: err.message || String(err) });
        } else {
          markWorkerStatus(worker, 'closed');
        }
        resolve();
      });
    });
  }

  function open(portIdOrConfig, options) {
    const config = registerPort(portIdOrConfig, options);
    return start(config.portId);
  }

  function close(portId, reason = 'close') {
    return stop(portId, reason);
  }

  function reconnectPort(portId, reason = 'serial reconnect') {
    const normalizedPortId = normalizePortId(portId);
    const config = registeredPorts.get(normalizedPortId);
    if (!config || config.reconnect !== true || isOpen(normalizedPortId)) {
      return {
        portId: normalizedPortId,
        attempted: false,
        status: getStatus(normalizedPortId)?.status || 'unregistered',
      };
    }

    try {
      start(normalizedPortId, { reconnect: true });
      logger?.info?.(`[SerialManager] reconnect ${normalizedPortId} (${reason})`);
      return {
        portId: normalizedPortId,
        attempted: true,
        ok: true,
      };
    } catch (error) {
      const message = error?.message || String(error);
      logger?.warn?.(`[SerialManager] reconnect ${normalizedPortId} failed:`, message);
      return {
        portId: normalizedPortId,
        attempted: true,
        ok: false,
        error: message,
      };
    }
  }

  function reconnectAll({ portIds, reason = 'serial reconnect' } = {}) {
    const targetPortIds = Array.isArray(portIds) && portIds.length > 0
      ? portIds.map(normalizePortId).filter(Boolean)
      : [...registeredPorts.keys()];

    return targetPortIds.map((targetPortId) => reconnectPort(targetPortId, reason));
  }

  function stopReconnectLoop() {
    if (!reconnectTimer) return false;
    clearInterval(reconnectTimer);
    reconnectTimer = null;
    return true;
  }

  function startReconnectLoop({
    intervalMs = DEFAULT_RECONNECT_INTERVAL_MS,
    reason = 'serial reconnect',
    onReconnect,
  } = {}) {
    stopReconnectLoop();
    reconnectTimer = setInterval(() => {
      const results = reconnectAll({ reason });
      if (typeof onReconnect === 'function' && results.some((result) => result.attempted)) {
        onReconnect(results);
      }
    }, intervalMs);

    return reconnectTimer;
  }

  function buildStatus(config, worker = null) {
    return {
      portId: config.portId,
      role: config.role || config.portId,
      path: config.path || null,
      baudRate: config.baudRate || null,
      parserChannel: config.parserChannel || null,
      reconnect: config.reconnect === true,
      isRegistered: true,
      isOpen: Boolean(worker?.port?.isOpen),
      status: worker?.status || 'registered',
      openedAt: worker?.openedAt || null,
      updatedAt: worker?.updatedAt || null,
      lastError: worker?.lastError || null,
    };
  }

  function getStatus(portId) {
    const normalizedPortId = normalizePortId(portId);
    if (normalizedPortId) {
      const config = registeredPorts.get(normalizedPortId);
      if (!config) return null;
      return buildStatus(config, getWorker(normalizedPortId));
    }

    return [...registeredPorts.values()].map((config) => (
      buildStatus(config, getWorker(config.portId))
    ));
  }

  function closeAll(reason = 'close all') {
    stopReconnectLoop();
    return Promise.all([...workers.keys()].map((portId) => stop(portId, reason)));
  }

  return {
    roles: SERIAL_PORT_ROLES,
    close,
    closeAll,
    closeByPath,
    getEntry,
    getPort,
    getStatus,
    isOpen,
    open,
    registerPort,
    reconnectAll,
    reconnectPort,
    setReconnect,
    start,
    startReconnectLoop,
    stopReconnectLoop,
    stop,
  };
}

module.exports = {
  SERIAL_PORT_ROLES,
  createSerialManager,
};
