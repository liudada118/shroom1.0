export function toLegacyCommand(message = {}) {
  const { type, payload = {} } = message;

  switch (type) {
    case 'serial.list':
      return { serialReset: true };
    case 'serial.open':
      return {
        ...(payload.channels?.sit ? { sitPort: payload.channels.sit } : {}),
        ...(payload.channels?.back ? { backPort: payload.channels.back } : {}),
        ...(payload.channels?.head ? { headPort: payload.channels.head } : {}),
        ...(payload.channels?.sensor ? { sensorPort: payload.channels.sensor } : {}),
        ...(payload.baudRate ? { baudRate: payload.baudRate } : {}),
      };
    case 'serial.close':
      return {
        sitClose: !payload.channels || payload.channels.includes('sit'),
        backClose: !payload.channels || payload.channels.includes('back'),
        headClose: !payload.channels || payload.channels.includes('head'),
      };
    case 'system.switch':
      return { file: payload.sensorType };
    case 'capture.start':
      return {
        flag: true,
        colName: payload.name,
        colHZ: payload.hz,
      };
    case 'capture.stop':
      return { flag: false };
    case 'replay.load':
      return {
        getTime: payload.captureName || payload.captureId,
        local: true,
      };
    case 'replay.play':
      return {
        play: true,
        speed: payload.speed,
      };
    case 'replay.pause':
      return { play: false };
    case 'replay.seek':
      return { value: payload.index };
    case 'export.csv':
      return {
        download: payload.captureName || payload.captureId,
        downloadOptions: {
          language: payload.language,
          path: payload.path,
          format: 'csv',
        },
      };
    case 'zero.capture':
      return { resetZero: true };
    case 'zero.clear':
      return { resetZero: false };
    default:
      return message;
  }
}
