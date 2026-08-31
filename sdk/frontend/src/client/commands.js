import schema from '../../../../shared/commandSchema.json';

export function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function validatePayloadRule(type, field, value, rule) {
  const label = `${type} payload.${field}`;
  if (rule.type === 'boolean' && typeof value !== 'boolean') throw new Error(`${label} must be a boolean`);
  if (rule.type === 'string') {
    if (typeof value !== 'string') throw new Error(`${label} must be a string`);
    if ((rule.minLength || 0) > value.length) throw new Error(`${label} is too short`);
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) throw new Error(`${label} has an invalid format`);
  }
  if (rule.type === 'array') {
    if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
    if ((rule.minItems || 0) > value.length) throw new Error(`${label} must not be empty`);
    if (rule.uniqueItems && new Set(value).size !== value.length) throw new Error(`${label} must contain unique items`);
    value.forEach((item, index) => validatePayloadRule(type, `${field}[${index}]`, item, rule.items || {}));
  }
}

function validatePayload(type, payload, definition) {
  const properties = definition.properties || {};
  if (definition.additionalProperties === false) {
    const unexpected = Object.keys(payload).filter((field) => !(field in properties));
    if (unexpected.length) throw new Error(`${type} payload contains unsupported field(s): ${unexpected.join(', ')}`);
  }
  Object.entries(properties).forEach(([field, rule]) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      validatePayloadRule(type, field, payload[field], rule);
    }
  });
}

export function createMessage(type, payload = {}, requestId = createRequestId()) {
  const definition = schema.commands[type];
  if (!definition) throw new Error(`unsupported command type: ${type}`);
  const missing = (definition.required || []).filter((field) => payload[field] == null);
  if (missing.length) throw new Error(`missing required payload field(s): ${missing.join(', ')}`);
  validatePayload(type, payload, definition);
  return { type, payload, requestId };
}

export const createCommand = createMessage;

function zeroTargetPayload(options) {
  const { displaySystemId, channelIds } = options || {};
  return {
    ...(displaySystemId != null ? { displaySystemId } : {}),
    ...(channelIds != null ? { channelIds } : {}),
  };
}

export const sensorCommands = {
  serialList: () => createCommand('serial.refresh'),
  serialOpen: ({ role = 'sit', path, port, portPath, channels, baudRate } = {}) => {
    const channelEntry = channels && Object.entries(channels).find(([, value]) => value);
    return createCommand('serial.open', {
      role: channelEntry?.[0] || role,
      path: channelEntry?.[1] || path || port || portPath,
      baudRate,
    });
  },
  serialClose: ({ roles, channels } = {}) => createCommand('serial.close', { roles: roles || channels }),
  systemSwitch: ({ sensorType } = {}) => createCommand('sensor.switch', { sensorType }),
  captureStart: ({ name, hz, metadata } = {}) => createCommand('collection.control', {
    active: true,
    name,
    frequencyHz: hz,
    options: metadata,
  }),
  captureStop: () => createCommand('collection.control', { active: false }),
  replayLoad: ({ captureName, captureId } = {}) => createCommand('history.load', { date: captureName || captureId }),
  replayPlay: ({ speed = 1 } = {}) => createCommand('playback.control', { play: true, speed }),
  replayPause: () => createCommand('playback.control', { play: false }),
  replaySeek: ({ index } = {}) => createCommand('playback.control', { value: index }),
  exportCsv: ({ captureName, captureId, language, path } = {}) => createCommand('export.csv', {
    date: captureName || captureId,
    options: { language, path, format: 'csv' },
  }),
  zeroCapture: (options) => createCommand('calibration.zero', {
    enabled: true,
    ...zeroTargetPayload(options),
  }),
  zeroClear: (options) => createCommand('calibration.zero', {
    enabled: false,
    ...zeroTargetPayload(options),
  }),
};
