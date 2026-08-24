'use strict';

/**
 * 传感器注册表的读取入口。
 *
 * registry.json 是唯一真相，这个文件只做三件事：读、查、算覆盖率。
 * 不要在这里补数据 —— 缺什么就往 registry.json 里补，让守卫测试盯着。
 */

const registry = require('./registry.json');

const SENSORS = registry.sensors;
const DELIMITERS = registry.delimiters;

/** 全部传感器类型名。 */
function listSensorTypes() {
  return Object.keys(SENSORS);
}

/**
 * 取一个传感器的技术定义。
 * @returns {object|null} 找不到返回 null —— 调用方必须处理，这就是「客户插了个我们不认识的传感器」。
 */
function getSensor(sensorType) {
  if (!sensorType) return null;
  const entry = SENSORS[sensorType];
  if (!entry) return null;
  return { sensorType, ...entry };
}

/** 有可用协议画像、能真解帧的类型。 */
function listVerifiedSensorTypes() {
  return listSensorTypes().filter((type) => SENSORS[type].verified === true);
}

/** 可售但 SDK 解不出来的类型 —— 这个列表应该只减不增。 */
function listUnverifiedSensorTypes() {
  return listSensorTypes().filter((type) => SENSORS[type].verified !== true);
}

/** 把 hex 定界字符串转成 Buffer，给 DelimiterParser 用。 */
function resolveDelimiter(nameOrHex) {
  if (!nameOrHex) return null;
  const hex = (DELIMITERS[nameOrHex] || nameOrHex).replace(/\s+/g, '');
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error(`delimiter "${nameOrHex}" is not a valid hex string`);
  }
  return Buffer.from(hex, 'hex');
}

/**
 * 按帧长反查候选类型 —— listPorts 自检的核心：
 * 收到一帧，长度是 274，那大概率是 handGloveFullPacket。
 * 返回数组而不是单值，因为多个类型可以共用同一帧长（比如 1024 点的那几个）。
 */
function findByFrameLength(byteLength) {
  if (!Number.isFinite(byteLength)) return [];
  return listSensorTypes().filter((type) => {
    const { protocol = {} } = SENSORS[type];
    if (protocol.packetLength === byteLength) return true;
    if (protocol.payloadBytes === byteLength) return true;
    if (!protocol.pressureLength) return false;
    const bytesPerValue = protocol.valueType && protocol.valueType !== 'uint8' ? 2 : 1;
    return protocol.pressureLength * bytesPerValue === byteLength;
  });
}

/**
 * 覆盖率 —— 给守卫测试和 CI 打印用。
 * 「27 个可售类型里 10 个能解」比一句「基本都支持了」有用得多。
 */
function coverage() {
  const total = listSensorTypes().length;
  const verified = listVerifiedSensorTypes().length;
  return {
    total,
    verified,
    unverified: total - verified,
    percent: total === 0 ? 0 : Math.round((verified / total) * 100),
  };
}

module.exports = {
  registry,
  SENSORS,
  DELIMITERS,
  listSensorTypes,
  listVerifiedSensorTypes,
  listUnverifiedSensorTypes,
  getSensor,
  resolveDelimiter,
  findByFrameLength,
  coverage,
};
