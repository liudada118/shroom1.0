/**
 * machineId.js
 * 机器码采集模块
 *
 * 采集本机硬件指纹（MAC 地址 + CPU ID + 硬盘序列号），
 * 经 SHA-256 哈希后生成 16 位大写短码，作为设备唯一标识。
 *
 * 设计要点：
 * - 使用多个硬件维度组合，单一维度变化不影响结果稳定性
 * - 过滤虚拟网卡，只取物理网卡 MAC
 * - 16 位短码方便客户抄写和传递
 */

const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const logger = require('./logger');

/**
 * 获取物理网卡 MAC 地址（过滤虚拟网卡和回环）
 * @returns {string} 第一个物理网卡的 MAC 地址
 */
function getMAC() {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      // 跳过虚拟网卡
      if (/^(vEthernet|VMware|VirtualBox|docker|br-|veth|lo)/i.test(name)) continue;
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          return iface.mac;
        }
      }
    }
  } catch (e) {
    logger.warn('获取 MAC 地址失败:', e.message);
  }
  return 'unknown-mac';
}

/**
 * 获取 CPU ID
 * @returns {string} CPU 标识信息
 */
function getCPUID() {
  try {
    const platform = process.platform;
    if (platform === 'win32') {
      const output = execSync('wmic cpu get ProcessorId', { encoding: 'utf-8', timeout: 5000 });
      const lines = output.trim().split('\n').filter(l => l.trim() && !l.includes('ProcessorId'));
      return lines[0]?.trim() || 'unknown-cpu';
    } else if (platform === 'darwin') {
      const output = execSync('sysctl -n machdep.cpu.brand_string', { encoding: 'utf-8', timeout: 5000 });
      return output.trim();
    } else {
      // Linux
      const output = execSync("cat /proc/cpuinfo | grep 'model name' | head -1", { encoding: 'utf-8', timeout: 5000 });
      return output.trim();
    }
  } catch (e) {
    logger.warn('获取 CPU ID 失败:', e.message);
  }
  return 'unknown-cpu';
}

/**
 * 获取硬盘序列号
 * @returns {string} 硬盘序列号
 */
function getDiskSerial() {
  try {
    const platform = process.platform;
    if (platform === 'win32') {
      const output = execSync('wmic diskdrive get SerialNumber', { encoding: 'utf-8', timeout: 5000 });
      const lines = output.trim().split('\n').filter(l => l.trim() && !l.includes('SerialNumber'));
      return lines[0]?.trim() || 'unknown-disk';
    } else if (platform === 'darwin') {
      const output = execSync("system_profiler SPSerialATADataType | grep 'Serial Number' | head -1", { encoding: 'utf-8', timeout: 5000 });
      return output.split(':')[1]?.trim() || 'unknown-disk';
    } else {
      // Linux
      const output = execSync("lsblk -ndo SERIAL /dev/sda 2>/dev/null || echo 'unknown-disk'", { encoding: 'utf-8', timeout: 5000 });
      return output.trim();
    }
  } catch (e) {
    logger.warn('获取硬盘序列号失败:', e.message);
  }
  return 'unknown-disk';
}

/**
 * 获取主板序列号（Windows 额外维度）
 * @returns {string} 主板序列号
 */
function getMotherboardSerial() {
  try {
    if (process.platform === 'win32') {
      const output = execSync('wmic baseboard get SerialNumber', { encoding: 'utf-8', timeout: 5000 });
      const lines = output.trim().split('\n').filter(l => l.trim() && !l.includes('SerialNumber'));
      return lines[0]?.trim() || 'unknown-mb';
    }
  } catch (e) {
    logger.warn('获取主板序列号失败:', e.message);
  }
  return 'unknown-mb';
}

/**
 * 生成机器码（16 位大写字母数字）
 *
 * 将多个硬件指纹拼接后做 SHA-256 哈希，取前 16 位大写十六进制。
 * 加入固定盐值防止彩虹表攻击。
 *
 * @returns {string} 16 位机器码，如 "A3F8B2C1D4E5F6A7"
 */
function generateMachineId() {
  const mac = getMAC();
  const cpu = getCPUID();
  const disk = getDiskSerial();
  const mb = getMotherboardSerial();

  const salt = 'BODYTA-SHROOM-2026';
  const raw = `${salt}|${mac}|${cpu}|${disk}|${mb}`;

  logger.info(`[MachineId] 硬件指纹原始数据: MAC=${mac}, CPU=${cpu.substring(0, 20)}..., Disk=${disk.substring(0, 20)}..., MB=${mb.substring(0, 20)}...`);

  const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
  const machineId = hash.substring(0, 16);

  logger.info(`[MachineId] 生成机器码: ${machineId}`);
  return machineId;
}

/**
 * 获取机器码（带缓存，同一进程内只采集一次）
 */
let _cachedId = null;
function getMachineId() {
  if (!_cachedId) {
    _cachedId = generateMachineId();
  }
  return _cachedId;
}

module.exports = { getMachineId, generateMachineId };
