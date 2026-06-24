const HttpResult = require('../common/HttpResult');

/**
 * 统一前端、SDK 和旧协议里对串口角色的命名。
 * HTTP API 对外推荐使用 sit/back/head/sensor，seat 仅作为兼容别名。
 */
function normalizeRole(role) {
  const normalized = String(role || '').trim();
  if (normalized === 'seat') return 'sit';
  return normalized;
}

/**
 * 从请求体中按优先级取字段，兼容 SDK 新字段和旧前端字段。
 */
function getBodyValue(body, keys) {
  for (const key of keys) {
    if (body && body[key] != null) return body[key];
  }
  return undefined;
}

/**
 * 将 HTTP 的串口打开请求转换成旧命令对象。
 * 这样 HTTP 与旧 WebSocket 共享同一套 command handler，不复制业务逻辑。
 */
function buildOpenSerialCommand(body = {}) {
  const role = normalizeRole(body.role || body.channel || body.portId);
  const portPath = getBodyValue(body, ['path', 'port', 'portPath']);
  if (!role || !portPath) {
    throw new Error('role and port/path are required');
  }

  if (role === 'sit') return { sitPort: portPath };
  if (role === 'back') return { backPort: portPath };
  if (role === 'head') return { headPort: portPath };
  if (role === 'sensor') return { sensorPort: portPath };
  throw new Error(`unsupported serial role: ${role}`);
}

/**
 * 将 HTTP 的串口关闭请求转换成旧命令对象。
 */
function buildCloseSerialCommand(body = {}) {
  const role = normalizeRole(body.role || body.channel || body.portId);
  if (!role) throw new Error('role is required');

  if (role === 'sit') return { sitClose: true };
  if (role === 'back') return { backClose: true };
  if (role === 'head') return { headClose: true };
  if (role === 'sensor') return { sensorClose: true };
  throw new Error(`unsupported serial role: ${role}`);
}

/**
 * 注册 HTTP 控制面路由。
 *
 * 架构约定：
 * - HTTP 负责控制命令、配置、查询和导出。
 * - WebSocket 负责实时订阅、实时帧推送和旧命令兼容。
 * - 这里不直接操作串口/数据库，而是转发给 wsCommandRouter 复用已有 handler。
 */
function registerControlRoutes(app, {
  getPort,
  getRealtimeChannels,
  listPorts,
  logger,
  serialManager,
  controlCommandService,
}) {
  /**
   * HTTP 控制命令统一入口。
   * 返回 command router 的执行结果，方便 SDK 判断命令是否被处理。
   */
  function dispatchCommand(command, res, { scope = 'http' } = {}) {
    try {
      const result = controlCommandService.executeHttp(command, { scope });
      res.json(new HttpResult(0, {
        handled: result.handled,
        stop: result.stop,
        results: result.results,
      }, 'success'));
    } catch (error) {
      logger?.warn?.('[HTTP] command failed', error.message || error);
      res.status(400).json(new HttpResult(1, {}, error.message || 'command failed'));
    }
  }

  app.post('/api/commands', (req, res) => {
    dispatchCommand(req.body || {}, res);
  });

  // 串口控制：SDK 和自动化脚本优先使用这些 HTTP API。
  app.get('/api/serial/ports', async (req, res) => {
    try {
      const ports = getPort(await listPorts());
      res.json(new HttpResult(0, { ports }, 'success'));
    } catch (error) {
      logger?.warn?.('[HTTP] list serial ports failed', error.message || error);
      res.status(500).json(new HttpResult(1, {}, error.message || 'list serial ports failed'));
    }
  });

  app.get('/api/serial/status', (req, res) => {
    const role = req.query.role || req.query.portId;
    res.json(new HttpResult(0, {
      serial: role ? serialManager.getStatus(role) : serialManager.getStatus(),
    }, 'success'));
  });

  app.post('/api/serial/open', (req, res) => {
    dispatchCommand(buildOpenSerialCommand(req.body), res);
  });

  app.post('/api/serial/close', (req, res) => {
    dispatchCommand(buildCloseSerialCommand(req.body), res);
  });

  app.post('/api/serial/exchange', (req, res) => {
    dispatchCommand({ exchange: true }, res);
  });

  app.post('/api/serial/refresh', (req, res) => {
    dispatchCommand({ serialReset: true }, res);
  });

  app.post('/api/serial/auto-connect-hand-glove-double', (req, res) => {
    dispatchCommand({ autoConnectHand0205Double: true }, res);
  });

  // 传感器类型和当前通道状态查询。
  app.get('/api/sensor/current', (req, res) => {
    res.json(new HttpResult(0, {
      channels: getRealtimeChannels(),
      serial: serialManager.getStatus(),
    }, 'success'));
  });

  app.post('/api/sensor/type', (req, res) => {
    const sensorType = req.body?.type || req.body?.file || req.body?.sensorType;
    if (!sensorType) {
      res.status(400).json(new HttpResult(1, {}, 'type is required'));
      return;
    }
    dispatchCommand({ file: sensorType }, res);
  });

  app.post('/api/history/load', (req, res) => {
    const date = req.body?.date || req.body?.getTime;
    if (!date) {
      res.status(400).json(new HttpResult(1, {}, 'date is required'));
      return;
    }
    dispatchCommand({ getTime: date }, res);
  });

  // 回放、采集和导出仍通过 command router 进入原有服务，避免双写业务规则。
  app.post('/api/playback/control', (req, res) => {
    const command = {};
    ['local', 'play', 'speed', 'index', 'history', 'value'].forEach((key) => {
      if (req.body?.[key] != null) command[key] = req.body[key];
    });
    dispatchCommand(command, res);
  });

  app.post('/api/collection/start', (req, res) => {
    dispatchCommand({
      flag: true,
      colHZ: req.body?.frequencyHz ?? req.body?.colHZ,
      collectOptions: req.body?.collectOptions,
      time: req.body?.time,
      colName: req.body?.name || req.body?.colName,
    }, res);
  });

  app.post('/api/collection/stop', (req, res) => {
    dispatchCommand({ flag: false }, res);
  });

  app.post('/api/export/csv', (req, res) => {
    const date = req.body?.date || req.body?.download;
    if (!date) {
      res.status(400).json(new HttpResult(1, {}, 'date is required'));
      return;
    }
    dispatchCommand({
      download: date,
      downloadOptions: req.body?.downloadOptions || req.body?.options || {},
    }, res);
  });
}

module.exports = {
  registerControlRoutes,
};
