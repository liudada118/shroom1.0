const crypto = require('crypto');
// 包内自带一份 schema，不向上跑出包根 —— 见 README「已知妥协」。
// 仓库根的 shared/commandSchema.json 是同一份内容，漂移由 contract/commandSchema.test.js 守。
const schema = require('./commandSchema.json');

const COMMAND_ERROR_CODES = Object.freeze({
  INVALID_COMMAND: 'INVALID_COMMAND',
  COMMAND_NOT_SUPPORTED: 'COMMAND_NOT_SUPPORTED',
  COMMAND_EXECUTION_FAILED: 'COMMAND_EXECUTION_FAILED',
  LICENSE_REQUIRED: 'LICENSE_REQUIRED',
  TRANSPORT_NOT_ALLOWED: 'TRANSPORT_NOT_ALLOWED',
});

class CommandProtocolError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'CommandProtocolError';
    this.code = code;
    this.httpStatus = options.httpStatus || 400;
    this.requestId = options.requestId || null;
    this.commandType = options.commandType || null;
  }
}

function createRequestId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `cmd_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function createCommand(type, payload = {}, requestId = createRequestId()) {
  return { type, payload, requestId };
}

function isCommandEnvelope(message) {
  return !!(
    message &&
    typeof message === 'object' &&
    !Array.isArray(message) &&
    Object.prototype.hasOwnProperty.call(message, 'type') &&
    Object.prototype.hasOwnProperty.call(message, 'payload') &&
    Object.prototype.hasOwnProperty.call(message, 'requestId')
  );
}

function validateCommandEnvelope(message) {
  const requestId = typeof message?.requestId === 'string' ? message.requestId.trim() : '';
  const commandType = typeof message?.type === 'string' ? message.type.trim() : '';

  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new CommandProtocolError(COMMAND_ERROR_CODES.INVALID_COMMAND, 'command must be an object');
  }
  if (!commandType) {
    throw new CommandProtocolError(COMMAND_ERROR_CODES.INVALID_COMMAND, 'command type is required', { requestId });
  }
  if (!requestId) {
    throw new CommandProtocolError(COMMAND_ERROR_CODES.INVALID_COMMAND, 'command requestId is required', { commandType });
  }
  if (!message.payload || typeof message.payload !== 'object' || Array.isArray(message.payload)) {
    throw new CommandProtocolError(COMMAND_ERROR_CODES.INVALID_COMMAND, 'command payload must be an object', {
      commandType,
      requestId,
    });
  }

  const definition = schema.commands[commandType];
  if (!definition) {
    throw new CommandProtocolError(COMMAND_ERROR_CODES.COMMAND_NOT_SUPPORTED, `unsupported command type: ${commandType}`, {
      commandType,
      httpStatus: 404,
      requestId,
    });
  }

  const missing = (definition.required || []).filter((field) => message.payload[field] == null);
  if (missing.length) {
    throw new CommandProtocolError(
      COMMAND_ERROR_CODES.INVALID_COMMAND,
      `missing required payload field(s): ${missing.join(', ')}`,
      { commandType, requestId },
    );
  }

  return {
    type: commandType,
    payload: message.payload,
    requestId,
  };
}

function normalizeRoles(roles) {
  const values = roles == null ? ['sit', 'back', 'head', 'sensor'] : (Array.isArray(roles) ? roles : [roles]);
  return [...new Set(values.map((role) => String(role || '').trim()).filter(Boolean))];
}

function serialPortField(role) {
  return role === 'sit' ? 'sitPort' : role === 'back' ? 'backPort' : role === 'head' ? 'headPort' : role === 'sensor' ? 'sensorPort' : '';
}

function serialCloseField(role) {
  return role === 'sit' ? 'sitClose' : role === 'back' ? 'backClose' : role === 'head' ? 'headClose' : role === 'sensor' ? 'sensorClose' : '';
}

function toLegacyCommand(envelope) {
  const { type, payload } = envelope;

  switch (type) {
    case 'serial.open': {
      const field = serialPortField(payload.role);
      if (!field) {
        throw new CommandProtocolError(COMMAND_ERROR_CODES.INVALID_COMMAND, `unsupported serial role: ${payload.role}`, {
          commandType: envelope.type,
          requestId: envelope.requestId,
        });
      }
      return { [field]: payload.path, ...(payload.baudRate != null ? { baudRate: payload.baudRate } : {}) };
    }
    case 'serial.close':
      return normalizeRoles(payload.roles || payload.role).reduce((command, role) => {
        const field = serialCloseField(role);
        if (field) command[field] = true;
        return command;
      }, {});
    case 'serial.refresh': return { serialReset: true };
    case 'serial.exchange': return { exchange: true };
    case 'serial.autoConnect': return { autoConnectHand0205Double: true };
    case 'sensor.switch': return { file: payload.sensorType };
    case 'history.mode': return {
      local: payload.local,
      ...(payload.history != null ? { history: payload.history } : {}),
      ...(payload.play != null ? { play: payload.play } : {}),
      ...(payload.displayOptions ? { smallBed12BDisplayOptions: payload.displayOptions } : {}),
    };
    case 'history.load': return {
      getTime: payload.date,
      ...(payload.index != null ? { index: payload.index } : {}),
      ...(payload.history != null ? { history: payload.history } : {}),
      ...(payload.displayOptions ? { smallBed12BDisplayOptions: payload.displayOptions } : {}),
    };
    case 'history.delete': return { delete: payload.date };
    case 'playback.control': return {
      ...payload,
      ...(payload.seekIndex != null ? { value: payload.seekIndex } : {}),
    };
    case 'collection.control': return {
      flag: payload.active,
      ...(payload.frequencyHz != null ? { colHZ: payload.frequencyHz } : {}),
      ...(payload.options != null ? { collectOptions: payload.options } : {}),
      ...(payload.startedAt != null ? { time: payload.startedAt } : {}),
      ...(payload.name != null ? { colName: payload.name } : {}),
    };
    case 'export.csv': return { download: payload.date, downloadOptions: payload.options || {} };
    case 'runtime.configure': return {
      ...(payload.baudRate != null ? { baudRate: payload.baudRate } : {}),
      ...(payload.gauss != null ? { gauss: payload.gauss } : {}),
      ...(payload.displayOptions ? { smallBed12BDisplayOptions: payload.displayOptions } : {}),
    };
    case 'calibration.zero': return { resetZero: payload.enabled };
    case 'analysis.selection': return {
      ...(payload.sitIndex != null ? { sitIndex: payload.sitIndex } : {}),
      ...(payload.backIndex != null ? { backIndex: payload.backIndex } : {}),
      ...(payload.headIndex != null ? { headIndex: payload.headIndex } : {}),
      ...(payload.indexRange != null ? { indexArr: payload.indexRange } : {}),
      ...(payload.diff != null ? { variety: payload.diff } : {}),
    };
    case 'license.activate': return { date: { date: payload.key, startTime: payload.startTime } };
    case 'license.refresh': return { refreshLicense: true };
    case 'sensor.types.list': return { getSensorTypes: true };
    default:
      throw new CommandProtocolError(COMMAND_ERROR_CODES.COMMAND_NOT_SUPPORTED, `unsupported command type: ${type}`, {
        commandType: type,
        httpStatus: 404,
        requestId: envelope.requestId,
      });
  }
}

function normalizeCommand(message) {
  if (!isCommandEnvelope(message)) {
    return { command: message || {}, envelope: null, legacy: true };
  }
  const envelope = validateCommandEnvelope(message);
  return { command: toLegacyCommand(envelope), envelope, legacy: false };
}

function createCommandAck({ requestId, commandType, ok, code, message, data }) {
  return {
    type: 'command.ack',
    requestId: requestId || null,
    commandType: commandType || null,
    status: ok ? 'accepted' : 'rejected',
    ok: !!ok,
    code: code || (ok ? 'OK' : COMMAND_ERROR_CODES.COMMAND_EXECUTION_FAILED),
    message: message || (ok ? 'command accepted' : 'command rejected'),
    ...(data === undefined ? {} : { data }),
  };
}

module.exports = {
  COMMAND_ERROR_CODES,
  CommandProtocolError,
  commandSchema: schema,
  createCommand,
  createCommandAck,
  createRequestId,
  isCommandEnvelope,
  normalizeCommand,
  toLegacyCommand,
  validateCommandEnvelope,
};
