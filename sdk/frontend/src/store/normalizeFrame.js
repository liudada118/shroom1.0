const CHANNEL_KEYS = {
  sitData: 'sit',
  backData: 'back',
  headData: 'head',
  rightData: 'right',
  leftData: 'left',
};

function toNumberArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    const numberValue = Number(item);
    return Number.isFinite(numberValue) ? numberValue : 0;
  });
}

function inferMatrix(data, matrix = {}) {
  if (matrix.width && matrix.height) {
    return {
      width: matrix.width,
      height: matrix.height,
      data,
    };
  }

  const square = Math.sqrt(data.length);
  if (Number.isInteger(square)) {
    return {
      width: square,
      height: square,
      data,
    };
  }

  return {
    width: null,
    height: null,
    data,
  };
}

function calculateStats(data, stats = {}) {
  if (stats && Object.keys(stats).length) {
    return stats;
  }
  if (!data.length) {
    return {
      max: 0,
      min: 0,
      total: 0,
      mean: 0,
      point: 0,
    };
  }
  let max = -Infinity;
  let min = Infinity;
  let total = 0;
  let point = 0;
  data.forEach((value) => {
    if (value > max) max = value;
    if (value < min) min = value;
    total += value;
    if (value > 0) point += 1;
  });
  return {
    max,
    min,
    total,
    mean: total / data.length,
    point,
  };
}

export function normalizeFramePayload(payload = {}) {
  const data = toNumberArray(payload.matrix?.data || payload.pressureData || payload.data || []);
  const sensorType = payload.sensorType || payload.matrixName || 'unknown';
  const channel = payload.channel || 'sit';

  return {
    sensorType,
    channel,
    mode: payload.mode || payload.numMatrixFlag || 'normal',
    timestamp: payload.timestamp || Date.now(),
    matrix: inferMatrix(data, payload.matrix || {}),
    data,
    raw: {
      data: toNumberArray(payload.raw?.data || payload.rawData || payload.realArr || data),
      rotate: toNumberArray(payload.raw?.rotate || payload.rotate || []),
      zeroFrame: toNumberArray(payload.raw?.zeroFrame || payload.zeroFrame || []),
    },
    stats: calculateStats(data, payload.stats || {}),
    extra: payload.extra || {},
  };
}

export function normalizeLegacyPayload(message = {}) {
  const frames = [];
  Object.entries(CHANNEL_KEYS).forEach(([payloadKey, channel]) => {
    if (!Array.isArray(message[payloadKey])) {
      return;
    }
    frames.push(normalizeFramePayload({
      sensorType: message.sensorType || message.file || message.matrixName,
      channel,
      data: message[payloadKey],
      rawData: message.rawPressureData || message.realArr,
      rotate: message.rotate,
      stats: message.stats,
      extra: {
        tempObj: message.tempObj,
        hz: message.hz,
        handSide: message.handSide,
        outputSide: message.outputSide,
        newArr147: message.newArr147,
        mappedArr195: message.mappedArr195,
      },
      timestamp: message.time || message.timestamp,
    }));
  });

  if (message.tempObj && !frames.length) {
    frames.push(normalizeFramePayload({
      sensorType: message.sensorType || message.file || 'unknown',
      channel: 'sensor',
      data: [],
      extra: {
        tempObj: message.tempObj,
      },
      timestamp: message.time || message.timestamp,
    }));
  }

  return frames;
}

export function normalizeIncomingMessage(message = {}) {
  if (message.type === 'frame') {
    return {
      type: message.type,
      payload: message.payload || {},
      frames: [normalizeFramePayload(message.payload || {})],
      raw: message,
    };
  }

  const frames = normalizeLegacyPayload(message);
  return {
    type: message.type || (frames.length ? 'frame' : 'message'),
    payload: message.payload || message,
    frames,
    raw: message,
  };
}
