const HttpResult = require('../common/HttpResult');
const { loadSerialProtocolPresets } = require('../serial/protocols');
const {
  HTTP_ROUTES,
  SERIAL_ROLES,
  normalizeSerialRole,
} = require('../contracts/sdkApiContract');
const {
  COMMAND_ERROR_CODES,
  CommandProtocolError,
  createCommand,
  createCommandAck,
  isCommandEnvelope,
} = require('../contracts/commandProtocol');

/**
 * 统一前端、SDK 和旧协议里对串口角色的命名。
 * HTTP API 对外推荐使用 sit/back/head/sensor，seat 仅作为兼容别名。
 */
function normalizeRole(role) {
  return normalizeSerialRole(role);
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

  if (role === SERIAL_ROLES.SIT) return { sitPort: portPath };
  if (role === SERIAL_ROLES.BACK) return { backPort: portPath };
  if (role === SERIAL_ROLES.HEAD) return { headPort: portPath };
  if (role === SERIAL_ROLES.SENSOR) return { sensorPort: portPath };
  throw new Error(`unsupported serial role: ${role}`);
}

/**
 * 将 HTTP 的串口关闭请求转换成旧命令对象。
 */
function buildCloseSerialCommand(body = {}) {
  const role = normalizeRole(body.role || body.channel || body.portId);
  if (!role) throw new Error('role is required');

  if (role === SERIAL_ROLES.SIT) return { sitClose: true };
  if (role === SERIAL_ROLES.BACK) return { backClose: true };
  if (role === SERIAL_ROLES.HEAD) return { headClose: true };
  if (role === SERIAL_ROLES.SENSOR) return { sensorClose: true };
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
  serialProtocolDirectories = [],
}) {
  /**
   * HTTP 控制命令统一入口。
   * 返回 command router 的执行结果，方便 SDK 判断命令是否被处理。
   */
  function dispatchCommand(command, res, { requireEnvelope = false, scope = 'http' } = {}) {
    try {
      if (requireEnvelope && !isCommandEnvelope(command)) {
        throw new CommandProtocolError(
          COMMAND_ERROR_CODES.INVALID_COMMAND,
          'expected command envelope: { type, payload, requestId }',
        );
      }
      const result = controlCommandService.executeHttp(command, { scope });
      const envelope = result.command || command;
      if (!result.handled) {
        throw new CommandProtocolError(
          COMMAND_ERROR_CODES.COMMAND_NOT_SUPPORTED,
          `no handler registered for command: ${envelope.type || 'unknown'}`,
          { commandType: envelope.type, httpStatus: 404, requestId: envelope.requestId },
        );
      }
      const failedResult = result.results?.find((item) => item.error);
      if (failedResult) {
        throw new CommandProtocolError(
          failedResult.code || COMMAND_ERROR_CODES.COMMAND_EXECUTION_FAILED,
          failedResult.error,
          { commandType: envelope.type, httpStatus: failedResult.httpStatus || 500, requestId: envelope.requestId },
        );
      }

      const ack = createCommandAck({
        requestId: envelope.requestId,
        commandType: envelope.type,
        ok: true,
        data: {
          handlers: result.results?.map((item) => item.name) || [],
          results: result.results || [],
          stop: result.stop,
        },
      });
      res.json(new HttpResult(0, ack, 'success'));
    } catch (error) {
      logger?.warn?.('[HTTP] command failed', error.message || error);
      const httpStatus = error.httpStatus || 400;
      const ack = createCommandAck({
        requestId: error.requestId || command?.requestId,
        commandType: error.commandType || command?.type,
        ok: false,
        code: error.code || COMMAND_ERROR_CODES.COMMAND_EXECUTION_FAILED,
        message: error.message || 'command failed',
      });
      res.status(httpStatus).json(new HttpResult(1, ack, ack.message));
    }
  }

  app.post(HTTP_ROUTES.commands, (req, res) => {
    dispatchCommand(req.body || {}, res, { requireEnvelope: true });
  });

  // 串口控制：SDK 和自动化脚本优先使用这些 HTTP API。
  app.get(HTTP_ROUTES.serialPorts, async (req, res) => {
    try {
      const ports = getPort(await listPorts());
      res.json(new HttpResult(0, { ports }, 'success'));
    } catch (error) {
      logger?.warn?.('[HTTP] list serial ports failed', error.message || error);
      res.status(500).json(new HttpResult(1, {}, error.message || 'list serial ports failed'));
    }
  });

  app.get(HTTP_ROUTES.serialStatus, (req, res) => {
    const role = req.query.role || req.query.portId;
    res.json(new HttpResult(0, {
      serial: role ? serialManager.getStatus(role) : serialManager.getStatus(),
    }, 'success'));
  });

  app.post(HTTP_ROUTES.serialOpen, (req, res) => {
    buildOpenSerialCommand(req.body);
    const role = normalizeRole(req.body?.role || req.body?.channel || req.body?.portId);
    const path = getBodyValue(req.body, ['path', 'port', 'portPath']);
    dispatchCommand(createCommand('serial.open', { role, path, baudRate: req.body?.baudRate }), res);
  });

  app.post(HTTP_ROUTES.serialClose, (req, res) => {
    buildCloseSerialCommand(req.body);
    const role = normalizeRole(req.body?.role || req.body?.channel || req.body?.portId);
    dispatchCommand(createCommand('serial.close', { roles: [role] }), res);
  });

  app.post(HTTP_ROUTES.serialExchange, (req, res) => {
    dispatchCommand(createCommand('serial.exchange'), res);
  });

  app.post(HTTP_ROUTES.serialRefresh, (req, res) => {
    dispatchCommand(createCommand('serial.refresh'), res);
  });

  app.post(HTTP_ROUTES.serialAutoConnectHandGloveDouble, (req, res) => {
    dispatchCommand(createCommand('serial.autoConnect'), res);
  });

  /**
   * 串口协议预设列表。
   *
   * 目的是让「新建传感器」不用手抄字节：选一个预设，波特率 / 分帧 / 解码三段直接填好。
   * 返回的 `protocol` 段就是展示系统 manifest 的 `protocol` 段，可以整段写进
   * `display-system.json`，不需要转换。
   *
   * 坏掉的预设文件不会让这个接口失败 —— 它们带着原因出现在 `invalid` 里，
   * 好的预设照常返回。用户往可写目录丢了一个写错的 JSON，不应该让整个列表变空。
   */
  app.get(HTTP_ROUTES.serialProtocols, (req, res) => {
    try {
      const result = loadSerialProtocolPresets({ extraDirectories: serialProtocolDirectories });
      res.json(new HttpResult(0, {
        protocols: result.presets,
        invalid: result.invalid,
        directories: result.directories,
      }, 'success'));
    } catch (error) {
      logger?.warn?.('[HTTP] list serial protocols failed', error.message || error);
      res.status(500).json(new HttpResult(1, {}, error.message || 'list serial protocols failed'));
    }
  });

  // 传感器类型和当前通道状态查询。
  app.get(HTTP_ROUTES.sensorCurrent, (req, res) => {
    res.json(new HttpResult(0, {
      channels: getRealtimeChannels(),
      serial: serialManager.getStatus(),
    }, 'success'));
  });

  app.post(HTTP_ROUTES.sensorType, (req, res) => {
    const sensorType = req.body?.type || req.body?.file || req.body?.sensorType;
    if (!sensorType) {
      res.status(400).json(new HttpResult(1, {}, 'type is required'));
      return;
    }
    dispatchCommand(createCommand('sensor.switch', { sensorType }), res);
  });

  app.post(HTTP_ROUTES.historyLoad, (req, res) => {
    const date = req.body?.date || req.body?.getTime;
    if (!date) {
      res.status(400).json(new HttpResult(1, {}, 'date is required'));
      return;
    }
    dispatchCommand(createCommand('history.load', { date }), res);
  });

  // 回放、采集和导出仍通过 command router 进入原有服务，避免双写业务规则。
  app.post(HTTP_ROUTES.playbackControl, (req, res) => {
    const command = {};
    ['local', 'play', 'speed', 'index', 'history', 'value'].forEach((key) => {
      if (req.body?.[key] != null) command[key] = req.body[key];
    });
    dispatchCommand(createCommand('playback.control', command), res);
  });

  app.post(HTTP_ROUTES.collectionStart, (req, res) => {
    dispatchCommand(createCommand('collection.control', {
      active: true,
      frequencyHz: req.body?.frequencyHz ?? req.body?.colHZ,
      options: req.body?.collectOptions,
      startedAt: req.body?.time,
      name: req.body?.name || req.body?.colName,
    }), res);
  });

  app.post(HTTP_ROUTES.collectionStop, (req, res) => {
    dispatchCommand(createCommand('collection.control', { active: false }), res);
  });

  app.post(HTTP_ROUTES.exportCsv, (req, res) => {
    const date = req.body?.date || req.body?.download;
    if (!date) {
      res.status(400).json(new HttpResult(1, {}, 'date is required'));
      return;
    }
    dispatchCommand(createCommand('export.csv', {
      date,
      options: req.body?.downloadOptions || req.body?.options || {},
    }), res);
  });
}

module.exports = {
  registerControlRoutes,
};
