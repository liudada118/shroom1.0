/**
 * 敏枕文本协议解析模块。
 *
 * 敏枕串口会输出包含 gyroscope、thermistor 和 humidity 的文本帧。
 * 本模块负责文本缓冲、帧切分、字段解析、矩阵置零和后端高斯平滑。
 */
const TYPE = 'minzhen';
const SENSOR_BAUD_RATE = 115200;
const FRAME_START_PATTERN = /yroscope\s*:/i;
const ZERO_POINT_INDEXES = [384, 416];
const BACKEND_GAUSS_RADIUS = 0.5;
const TEXT_BUFFER_MAX_LENGTH = 4096;
const TEXT_BUFFER_TAIL_LENGTH = 64;

/**
 * 将任意值转成有限数字，非法值统一按 0 处理。
 * @param {unknown} value 原始值。
 * @returns {number} 有限数字。
 */
function toFiniteNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

/**
 * 将敏枕矩阵中已知不稳定点强制置零。
 * @param {number[]} frame 压力矩阵。
 * @param {number[]} zeroPointIndexes 要置零的点位索引。
 * @returns {number[]} 处理后的矩阵。
 */
function maskMatrixValues(frame, zeroPointIndexes = ZERO_POINT_INDEXES) {
  if (!Array.isArray(frame)) return frame;
  zeroPointIndexes.forEach((index) => {
    if (index >= 0 && index < frame.length) {
      frame[index] = 0;
    }
  });
  return frame;
}

/**
 * 对敏枕 32x32 压力矩阵做后端高斯平滑，并再次屏蔽不稳定点。
 * @param {number[]} frame 原始压力矩阵。
 * @param {{gaussBlur?: Function, radius?: number}} options 高斯平滑配置。
 * @returns {number[]} 平滑后的压力矩阵。
 */
function applyBackendGauss(frame, { gaussBlur, radius = BACKEND_GAUSS_RADIUS } = {}) {
  if (!Array.isArray(frame) || frame.length < 1024) return maskMatrixValues(frame);

  const normalizedFrame = frame.slice(0, 1024).map(toFiniteNumber);
  maskMatrixValues(normalizedFrame);

  if (typeof gaussBlur !== 'function') {
    return normalizedFrame;
  }

  const blurredFrame = gaussBlur(normalizedFrame, 32, 32, radius);
  return maskMatrixValues(blurredFrame);
}

/**
 * 归一化敏枕文本字段名。
 * @param {string} rawKey 原始字段名。
 * @returns {string} 标准字段名。
 */
function normalizeSensorKey(rawKey = '') {
  const key = String(rawKey).trim();
  if (/yroscope/i.test(key)) return 'gyroscope';
  if (/thermistor0/i.test(key)) return 'thermistor0';
  if (/thermistor1/i.test(key)) return 'thermistor1';
  if (/thermistor2/i.test(key)) return 'thermistor2';
  if (/thermistor/i.test(key)) return 'thermistor';
  if (/humidity/i.test(key)) return 'humidity';
  return key;
}

/**
 * 从文本字段中提取数字字符串。
 * @param {unknown} value 原始字段值。
 * @returns {string} 数字字符串。
 */
function cleanSensorNumber(value) {
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  return match ? match[0] : '';
}

/**
 * 解析一段敏枕文本中的字段列表。
 * @param {string} text 敏枕文本帧。
 * @returns {{key:string, value:string}[]} 字段列表。
 */
function parseSensorFields(text = '') {
  const fields = [];
  const fieldPattern = /(yroscope|thermistor0|thermistor1|thermistor2|thermistor|humidity)\s*:/ig;
  const matches = [...String(text).matchAll(fieldPattern)];

  matches.forEach((match, index) => {
    const nextMatch = matches[index + 1];
    fields.push({
      key: normalizeSensorKey(match[1]),
      value: String(text)
        .slice(match.index + match[0].length, nextMatch ? nextMatch.index : undefined)
        .trim(),
    });
  });

  return fields;
}

/**
 * 解析一帧敏枕文本数据。
 * @param {Buffer | Uint8Array | string} buffer 原始文本帧。
 * @returns {null | {tempObj: object}} 解析后的传感器对象。
 */
function parseSensorFrame(buffer) {
  const text = Buffer.from(buffer || []).toString();
  if (!/yroscope/i.test(text) || !/thermistor/i.test(text)) {
    return null;
  }

  const tempObj = {};
  parseSensorFields(text).forEach((field) => {
    const { key, value } = field;
    if (!key) return;

    if (key === 'gyroscope') {
      const newValue = value
        .split(/[\t,\s]+/)
        .map((v) => cleanSensorNumber(v))
        .filter(Boolean)
        .slice(0, 6);
      tempObj[key] = newValue;

      const angleFbRaw = Number(newValue[2]);
      const angleLrRaw = Number(newValue[0]);
      if (Number.isFinite(angleFbRaw)) {
        tempObj.angle_fb = (angleFbRaw / 15000).toFixed(2);
      }
      if (Number.isFinite(angleLrRaw)) {
        tempObj.angle_lr = (angleLrRaw / 15000).toFixed(2);
      }
    } else if (['thermistor0', 'thermistor1', 'thermistor2', 'humidity'].includes(key)) {
      tempObj[key] = cleanSensorNumber(value);
    } else {
      tempObj[key] = value.trim();
    }
  });

  if (!Array.isArray(tempObj.gyroscope) || tempObj.gyroscope.length < 6) {
    return null;
  }
  if (!['thermistor0', 'thermistor1', 'thermistor2', 'humidity'].every((key) => tempObj[key] !== undefined)) {
    return null;
  }

  return { tempObj };
}

/**
 * 查找下一帧敏枕文本的起始位置。
 * @param {string} text 缓冲文本。
 * @returns {number} 起始索引，未找到返回 -1。
 */
function getFrameStartIndex(text) {
  const match = String(text).match(FRAME_START_PATTERN);
  return match ? match.index : -1;
}

/**
 * 从文本缓冲中取出下一帧完整敏枕文本。
 * @param {{buffer:string}} state 文本缓冲状态。
 * @returns {null | string} 完整文本帧。
 */
function takeNextTextFrame(state) {
  const firstStart = getFrameStartIndex(state.buffer);
  if (firstStart < 0) {
    state.buffer = state.buffer.slice(-TEXT_BUFFER_TAIL_LENGTH);
    return null;
  }

  if (firstStart > 0) {
    state.buffer = state.buffer.slice(firstStart);
  }

  const nextStart = getFrameStartIndex(state.buffer.slice(1));
  if (nextStart >= 0) {
    const frameText = state.buffer.slice(0, nextStart + 1);
    state.buffer = state.buffer.slice(nextStart + 1);
    return frameText;
  }

  const humidityMatch = state.buffer.match(/humidity\s*:\s*-?\d+(?:\.\d+)?/i);
  if (humidityMatch) {
    const frameEnd = humidityMatch.index + humidityMatch[0].length;
    const frameText = state.buffer.slice(0, frameEnd);
    state.buffer = state.buffer.slice(frameEnd).slice(-TEXT_BUFFER_TAIL_LENGTH);
    return frameText;
  }

  return null;
}

/**
 * 创建敏枕文本帧提取器。
 * @returns {{reset: Function, push: Function, getBuffer: Function}} 文本帧提取器。
 */
function createTextFrameExtractor() {
  const state = { buffer: '' };
  return {
    reset() {
      state.buffer = '';
    },
    push(data) {
      state.buffer += Buffer.from(data || []).toString();
      if (state.buffer.length > TEXT_BUFFER_MAX_LENGTH) {
        state.buffer = state.buffer.slice(-TEXT_BUFFER_MAX_LENGTH);
      }

      const frames = [];
      let frameText = takeNextTextFrame(state);
      while (frameText) {
        frames.push(frameText);
        frameText = takeNextTextFrame(state);
      }
      return frames;
    },
    getBuffer() {
      return state.buffer;
    },
  };
}

module.exports = {
  TYPE,
  SENSOR_BAUD_RATE,
  BACKEND_GAUSS_RADIUS,
  ZERO_POINT_INDEXES,
  applyBackendGauss,
  cleanSensorNumber,
  createTextFrameExtractor,
  maskMatrixValues,
  normalizeSensorKey,
  parseSensorFields,
  parseSensorFrame,
};
