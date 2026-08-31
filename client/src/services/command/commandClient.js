import { createCommand } from './commandSchema';

const DEFAULT_HTTP_BASE_URL = 'http://127.0.0.1:19245';

export class CommandClientError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'CommandClientError';
    this.code = options.code || 'COMMAND_REQUEST_FAILED';
    this.requestId = options.requestId || null;
    this.status = options.status || 0;
  }
}

function commandFromLegacyFields(message = {}) {
  const commands = [];
  const displayOptions = message.smallBed12BDisplayOptions;

  ['sit', 'back', 'head', 'sensor'].forEach((role) => {
    const field = `${role}Port`;
    if (message[field] != null) {
      commands.push(createCommand('serial.open', { role, path: message[field], baudRate: message.baudRate }));
    }
  });

  const closingRoles = ['sit', 'back', 'head', 'sensor'].filter((role) => message[`${role}Close`] === true);
  if (closingRoles.length) commands.push(createCommand('serial.close', { roles: closingRoles }));
  if (message.serialReset != null) commands.push(createCommand('serial.refresh'));
  if (message.exchange != null) commands.push(createCommand('serial.exchange'));
  if (message.autoConnectHand0205Double === true) commands.push(createCommand('serial.autoConnect'));
  if (message.file != null) commands.push(createCommand('sensor.switch', { sensorType: message.file }));

  if (message.local != null) {
    commands.push(createCommand('history.mode', {
      local: message.local,
      ...(message.history != null ? { history: message.history } : {}),
      ...(displayOptions ? { displayOptions } : {}),
    }));
  }
  if (message.getTime != null) {
    commands.push(createCommand('history.load', {
      date: message.getTime,
      ...(message.index != null ? { index: message.index } : {}),
      ...(message.history != null ? { history: message.history } : {}),
      ...(displayOptions ? { displayOptions } : {}),
    }));
  }

  const playbackPayload = {};
  ['play', 'speed', 'index', 'value', 'up', 'down'].forEach((field) => {
    if (message[field] != null) playbackPayload[field] = message[field];
  });
  if (message.history != null && message.local == null && message.getTime == null) {
    playbackPayload.history = message.history;
  }
  if (Object.keys(playbackPayload).length) commands.push(createCommand('playback.control', playbackPayload));

  if (
    message.flag != null || message.colHZ != null || message.collectOptions != null ||
    message.time != null || message.colName != null
  ) {
    commands.push(createCommand('collection.control', {
      active: message.flag === true,
      ...(message.colHZ != null ? { frequencyHz: message.colHZ } : {}),
      ...(message.collectOptions != null ? { options: message.collectOptions } : {}),
      ...(message.time != null ? { startedAt: message.time } : {}),
      ...(message.colName != null ? { name: message.colName } : {}),
    }));
  }
  if (message.download != null) {
    commands.push(createCommand('export.csv', { date: message.download, options: message.downloadOptions || {} }));
  }
  if (message.delete != null) commands.push(createCommand('history.delete', { date: message.delete }));

  if (message.baudRate != null || message.gauss != null || displayOptions) {
    commands.push(createCommand('runtime.configure', {
      ...(message.baudRate != null ? { baudRate: message.baudRate } : {}),
      ...(message.gauss != null ? { gauss: message.gauss } : {}),
      ...(displayOptions ? { displayOptions } : {}),
    }));
  }
  if (message.resetZero != null) {
    commands.push(createCommand('calibration.zero', {
      enabled: message.resetZero,
      ...(message.displaySystemId != null ? { displaySystemId: message.displaySystemId } : {}),
      ...(message.channelIds != null ? { channelIds: message.channelIds } : {}),
    }));
  }

  const selectionPayload = {};
  if (message.sitIndex != null) selectionPayload.sitIndex = message.sitIndex;
  if (message.backIndex != null) selectionPayload.backIndex = message.backIndex;
  if (message.headIndex != null) selectionPayload.headIndex = message.headIndex;
  if (message.indexArr != null) selectionPayload.indexRange = message.indexArr;
  if (message.variety != null) selectionPayload.diff = message.variety;
  if (Object.keys(selectionPayload).length) commands.push(createCommand('analysis.selection', selectionPayload));

  if (message.date?.date != null) {
    commands.push(createCommand('license.activate', {
      key: message.date.date,
      ...(message.date.startTime != null ? { startTime: message.date.startTime } : {}),
    }));
  }
  if (message.refreshLicense === true) commands.push(createCommand('license.refresh'));
  if (message.getSensorTypes === true) commands.push(createCommand('sensor.types.list'));

  return commands;
}

export class CommandClient {
  constructor({ baseUrl = DEFAULT_HTTP_BASE_URL, fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  async execute(type, payload = {}, options = {}) {
    return this.executeEnvelope(createCommand(type, payload, options.requestId));
  }

  async executeEnvelope(command) {
    if (!this.fetchImpl) throw new CommandClientError('fetch is not available');
    let response;
    try {
      response = await Reflect.apply(this.fetchImpl, globalThis, [`${this.baseUrl}/api/commands`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(command),
      }]);
    } catch (error) {
      throw new CommandClientError(error.message || 'command request failed', { requestId: command.requestId });
    }

    const body = await response.json().catch(() => ({}));
    const ack = body?.data || body;
    if (!response.ok || body?.code !== 0 || ack?.ok !== true) {
      throw new CommandClientError(ack?.message || body?.message || `HTTP ${response.status}`, {
        code: ack?.code,
        requestId: ack?.requestId || command.requestId,
        status: response.status,
      });
    }
    return ack;
  }

  async executeLegacyControl(message) {
    const commands = commandFromLegacyFields(message);
    if (!commands.length) {
      throw new CommandClientError('legacy control message cannot be mapped', { code: 'INVALID_COMMAND' });
    }
    const acknowledgements = [];
    for (const command of commands) {
      acknowledgements.push(await this.executeEnvelope(command));
    }
    return acknowledgements;
  }
}

export const commandClient = new CommandClient();
export { commandFromLegacyFields };
