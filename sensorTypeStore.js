/**
 * sensorTypeStore.js
 * 传感器类型清单存储（主进程）
 *
 * 清单来源优先级：远程 > 本地缓存 > 内置兜底。
 *   - initSensorTypes(BASE_URL)：后台拉 GET {BASE_URL}/sensorTypes（5s 超时），
 *     成功则落地 userData/sensorTypes.cache.json；失败/超时/DB_ERROR/空清单 → 保留当前（缓存或内置）。
 *     不阻塞启动：调用方不要 await，拉取在后台完成后再广播更新。
 *   - getSnapshot()：永远同步返回 { time, flat, map }（缓存/内置），不依赖网络拉取是否完成。
 *   - getSensorArr()：返回当前 flat 清单。
 *   - getSensorLabel(value)：value→中文名，查不到原样返回 value。
 *
 * 内置兜底清单 = licenseSensorGroups.json 的授权分类注册表，
 * 供断网首次安装、无缓存时使用。后台「传感器类型管理」新增的类型靠远程/缓存覆盖。
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const config = require('./configManager');
const LICENSE_SENSOR_GROUPS = require('./licenseSensorGroups.json');

const CACHE_FILE = path.join(config.APP_DATA_DIR, 'sensorTypes.cache.json');
const FETCH_TIMEOUT_MS = 5000;

// ─── 内置兜底清单（与授权分类、Title.jsx 的可见内置系统保持同源）────────────
// 后台「传感器类型管理」新增的类型靠远程/缓存覆盖；动态类型仍可按具体 value 授权。
const BUILTIN_GROUPS = LICENSE_SENSOR_GROUPS.map((group) => ({
  group: group.label,
  icon: group.icon,
  items: group.items.map(({ label, value }) => ({ label, value })),
}));

// ─── 内部辅助 ───────────────────────────────────────────────────────────────────

/** groups → 扁平 flat（{label,value,group}），与后台 flat 形状一致。 */
function deriveFlat(groups) {
  const flat = [];
  (groups || []).forEach((g) => {
    (g.items || []).forEach((it) => {
      flat.push({ label: it.label, value: it.value, group: g.group });
    });
  });
  return flat;
}

/** flat → value→label 映射。 */
function deriveMap(flat) {
  const map = {};
  (flat || []).forEach((s) => { if (s && s.value != null) map[s.value] = s.label; });
  return map;
}

/** 任意来源（远程/缓存）的原始对象 → 规范化快照 { time, flat, map }（map 缺失则从 flat 派生）。 */
function normalizeSnapshot(json) {
  const flat = Array.isArray(json.flat) ? json.flat : [];
  const map = (json.map && typeof json.map === 'object') ? json.map : deriveMap(flat);
  return { time: typeof json.time === 'number' ? json.time : 0, flat, map };
}

// 内置兜底快照
const BUILTIN_FLAT = deriveFlat(BUILTIN_GROUPS);
const BUILTIN = { time: 0, flat: BUILTIN_FLAT, map: deriveMap(BUILTIN_FLAT) };

// 当前生效快照（远程 > 缓存 > 内置），getSnapshot 永远从这里同步取。
let current = BUILTIN;

/** 启动即同步读本地缓存，保证 getSnapshot 立刻可用（不依赖网络）。 */
function loadCacheSync() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const json = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      if (json && Array.isArray(json.flat) && json.flat.length) {
        current = normalizeSnapshot(json);
        return;
      }
    }
  } catch (e) {
    logger.warn('[SensorTypes] 读取本地缓存失败：' + e.message);
  }
  current = BUILTIN;
}

/** 落地缓存。 */
function writeCache(snapshot) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ time: snapshot.time, flat: snapshot.flat, map: snapshot.map }));
  } catch (e) {
    logger.warn('[SensorTypes] 写本地缓存失败：' + e.message);
  }
}

/**
 * 拉 GET {BASE_URL}/sensorTypes（纯 REST，5s 超时）。
 * @returns {Promise<object|null>} 失败/超时/DB_ERROR/空 flat → null（沿用缓存或内置）。
 */
function fetchSensorTypes(BASE_URL) {
  return new Promise((resolve) => {
    try {
      if (!BASE_URL) { resolve(null); return; }
      const url = new URL(BASE_URL.replace(/\/+$/, '') + '/sensorTypes');
      const lib = url.protocol === 'https:' ? require('https') : require('http');
      const req = lib.request(url, { method: 'GET', timeout: FETCH_TIMEOUT_MS }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            // DB 异常（error:"DB_ERROR"）或空清单 → 视为不可用，走兜底
            if (!json || json.error || !Array.isArray(json.flat) || json.flat.length === 0) {
              resolve(null);
              return;
            }
            resolve(normalizeSnapshot(json));
          } catch (e) { resolve(null); }
        });
      });
      req.on('error', (err) => { logger.warn('[SensorTypes] /sensorTypes 请求失败：' + err.message); resolve(null); });
      req.on('timeout', () => { req.destroy(); logger.warn('[SensorTypes] /sensorTypes 超时'); resolve(null); });
      req.end();
    } catch (e) {
      logger.warn('[SensorTypes] /sensorTypes 异常：' + e.message);
      resolve(null);
    }
  });
}

// ─── 对外接口 ───────────────────────────────────────────────────────────────────

/**
 * 后台拉取远程清单并更新（不阻塞启动：调用方不要 await）。
 * 成功 → 更新 current + 落地缓存；失败 → 保留当前（缓存/内置）。
 * @returns {Promise<boolean>} 是否从远程成功更新（调用方据此决定是否广播）。
 */
async function initSensorTypes(BASE_URL) {
  const remote = await fetchSensorTypes(BASE_URL);
  if (remote) {
    current = remote;
    writeCache(remote);
    logger.info(`[SensorTypes] 远程清单已更新：${remote.flat.length} 项`);
    return true;
  }
  logger.info('[SensorTypes] 远程不可用，沿用' + (current === BUILTIN ? '内置兜底' : '本地缓存') + '清单');
  return false;
}

/** 当前快照 { time, flat, map }（供 WS 下发）。 */
function getSnapshot() {
  return { time: current.time, flat: current.flat, map: current.map };
}

/** 当前传感器清单（flat）。 */
function getSensorArr() {
  return current.flat;
}

/** value→中文名，查不到原样返回 value。 */
function getSensorLabel(value) {
  return (current.map && current.map[value]) || value;
}

// 模块加载即同步读缓存，使 getSnapshot/getSensorArr 立即可用。
loadCacheSync();

module.exports = {
  initSensorTypes,
  getSnapshot,
  getSensorArr,
  getSensorLabel,
};
