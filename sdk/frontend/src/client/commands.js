export function createMessage(type, payload = {}, meta = {}) {
  if (!type) {
    throw new Error('message type is required');
  }
  return {
    type,
    payload,
    meta: {
      timestamp: Date.now(),
      ...meta,
    },
  };
}

export function createCommand(type, payload = {}, meta = {}) {
  return createMessage(type, payload, meta);
}

export const sensorCommands = {
  serialList: () => createCommand('serial.list'),
  serialOpen: ({ sensorType, channels, baudRate } = {}) => createCommand('serial.open', {
    sensorType,
    channels,
    baudRate,
  }),
  serialClose: ({ channels } = {}) => createCommand('serial.close', { channels }),
  systemSwitch: ({ sensorType, mode } = {}) => createCommand('system.switch', { sensorType, mode }),
  captureStart: ({ name, hz, metadata } = {}) => createCommand('capture.start', { name, hz, metadata }),
  captureStop: () => createCommand('capture.stop'),
  captureList: (payload = {}) => createCommand('capture.list', payload),
  replayLoad: ({ captureName, captureId, sensorType } = {}) => createCommand('replay.load', {
    captureName,
    captureId,
    sensorType,
  }),
  replayPlay: ({ speed = 1 } = {}) => createCommand('replay.play', { speed }),
  replayPause: () => createCommand('replay.pause'),
  replaySeek: ({ index } = {}) => createCommand('replay.seek', { index }),
  exportCsv: ({ captureName, captureId, sensorType, language, path } = {}) => createCommand('export.csv', {
    captureName,
    captureId,
    sensorType,
    language,
    path,
  }),
  zeroCapture: ({ sensorType, channel } = {}) => createCommand('zero.capture', { sensorType, channel }),
  zeroClear: ({ sensorType, channel } = {}) => createCommand('zero.clear', { sensorType, channel }),
};
