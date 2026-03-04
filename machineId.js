/**
 * machineId.js
 * 机器指纹采集模块 - 用于密钥一机一用绑定
 *
 * 采集 CPU 型号 + 总内存 + 第一个非内部网卡 MAC 地址，
 * 做 SHA256 哈希后取前 16 位作为机器码。
 *
 * 机器码特点：
 * - 同一台机器每次生成结果一致
 * - 不同机器生成结果不同
 * - 不暴露原始硬件信息
 * - 更换硬件（CPU/内存/网卡）后会变化
 */
const os = require('os');
const crypto = require('crypto');

/**
 * 获取第一个非内部（非 loopback）网卡的 MAC 地址
 * @returns {string} MAC 地址，如 "aa:bb:cc:dd:ee:ff"，未找到时返回 "00:00:00:00:00:00"
 */
function getFirstMac() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内部接口和 IPv6
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        return iface.mac;
      }
    }
  }
  return '00:00:00:00:00:00';
}

/**
 * 生成当前机器的唯一机器码
 * 基于 CPU 型号 + CPU 核心数 + 总内存 + MAC 地址
 * @returns {string} 16 位十六进制机器码
 */
function getMachineId() {
  const cpuModel = os.cpus().length > 0 ? os.cpus()[0].model : 'unknown';
  const cpuCount = os.cpus().length;
  const totalMem = os.totalmem();
  const mac = getFirstMac();

  const raw = `${cpuModel}|${cpuCount}|${totalMem}|${mac}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');

  // 取前 16 位，转为大写，方便用户阅读和输入
  return hash.substring(0, 16).toUpperCase();
}

/**
 * 获取机器码的可读格式（每4位用横杠分隔）
 * 例如：A1B2-C3D4-E5F6-G7H8
 * @returns {string} 格式化的机器码
 */
function getMachineIdFormatted() {
  const id = getMachineId();
  return id.match(/.{1,4}/g).join('-');
}

/**
 * 验证密钥中的机器码是否与当前机器匹配
 * @param {string} keyMachineId - 密钥中的机器码
 * @returns {boolean} 是否匹配
 */
function verifyMachineId(keyMachineId) {
  if (!keyMachineId) {
    // 旧密钥没有 machineId，向后兼容，返回 true
    return true;
  }
  const currentId = getMachineId();
  // 忽略大小写和横杠进行比较
  const normalizedKey = keyMachineId.replace(/-/g, '').toUpperCase();
  const normalizedCurrent = currentId.replace(/-/g, '').toUpperCase();
  return normalizedKey === normalizedCurrent;
}

module.exports = {
  getMachineId,
  getMachineIdFormatted,
  verifyMachineId,
};
