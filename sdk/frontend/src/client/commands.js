import schema from '../../../../shared/commandSchema.json';

export function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createMessage(type, payload = {}, requestId = createRequestId()) {
  const definition = schema.commands[type];
  if (!definition) throw new Error(`unsupported command type: ${type}`);
  const missing = (definition.required || []).filter((field) => payload[field] == null);
  if (missing.length) throw new Error(`missing required payload field(s): ${missing.join(', ')}`);
  return { type, payload, requestId };
}

export const createCommand = createMessage;

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
  zeroCapture: () => createCommand('calibration.zero', { enabled: true }),
  zeroClear: () => createCommand('calibration.zero', { enabled: false }),
};
