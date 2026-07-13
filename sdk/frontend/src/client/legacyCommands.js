export function toLegacyCommand(message = {}) {
  const { type, payload = {} } = message;

  switch (type) {
    case 'serial.open': {
      const field = payload.role === 'back' ? 'backPort'
        : payload.role === 'head' ? 'headPort'
          : payload.role === 'sensor' ? 'sensorPort' : 'sitPort';
      return { [field]: payload.path, ...(payload.baudRate != null ? { baudRate: payload.baudRate } : {}) };
    }
    case 'serial.close':
      return (payload.roles || ['sit', 'back', 'head', 'sensor']).reduce((command, role) => {
        command[`${role}Close`] = true;
        return command;
      }, {});
    case 'serial.refresh': return { serialReset: true };
    case 'serial.exchange': return { exchange: true };
    case 'sensor.switch': return { file: payload.sensorType };
    case 'collection.control': return {
      flag: payload.active,
      colName: payload.name,
      colHZ: payload.frequencyHz,
      collectOptions: payload.options,
    };
    case 'history.load': return { getTime: payload.date, local: true };
    case 'playback.control': return { ...payload };
    case 'export.csv': return { download: payload.date, downloadOptions: payload.options || {} };
    case 'calibration.zero': return { resetZero: payload.enabled };
    default: return message;
  }
}
