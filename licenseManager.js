/**
 * licenseManager.js
 * 授权验证统一模块（验证方，v2：防回拨 + 在线缓存兜底 + 永久锁定/解锁）
 *
 * 两个授权版本，按密钥格式自动识别：
 *   能 base64→JSON 且含 signature → 离线版（RSA 验签 + 回拨闸 + 本机时间判过期）
 *   否则按 hex                     → 在线版（ECB 解出 file + /licenseCheck 缓存 + 回拨闸）
 *
 * v2 时间闸（crypto-lib.cjs）：
 *   - 回拨即锁定：本机/服务器时间低于"已见最高可信时间(高水位)"超过容差 → 锁定（不再像 v1 钳制后继续）。
 *     已取消解锁码机制：锁定后提示"联系厂商重新获取密钥"，写入新密钥时 clearLockState 清除锁定重新校验。
 *   - 在线缓存兜底：在线密钥缓存服务器时间+状态，每 2h 联网刷新；断网时只要没回拨、
 *     缓存未过期/未吊销就继续用 —— 网络抖动不会因一次请求失败就锁。
 *   - 运行中每 5min 复检一次，持续顶高水位（防开着软件不关再回拨时钟）。
 *
 * 状态/缓存文件放 userData 下隐藏文件，HMAC 签名，被改字段即判锁定/失效。
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const config = require('./configManager');

// 在线密钥解密沿用现有 ECB，用于本地解出 file/moduleConfig（runtime 配置 + 展示）。
const ecb = require('./aes_ecb');

// v2 加密库：容错加载，缺失时授权不可用但不崩。
let cryptoLib = null;
try {
  cryptoLib = require('./crypto-lib.cjs');
} catch (err) {
  logger.warn('[License] crypto-lib.cjs 未就绪：' + err.message);
}

// ─── 状态/缓存文件（userData 下隐藏文件）────────────────────────────────────────
const LIC_STATE = path.join(config.APP_DATA_DIR, '.lic_state'); // 回拨高水位 + 锁定态（HMAC）
const LIC_CACHE = path.join(config.APP_DATA_DIR, '.lic_cache'); // 在线缓存：服务器时间 + 密钥状态（HMAC）

// ─── 模块内授权状态缓存 ─────────────────────────────────────────────────────────
const state = {
  type: null,              // 'online' | 'offline' | null
  rawKey: null,            // config.txt 原始密钥串
  checking: false,         // 正在首检/复检中（前端区分"校验中"与"未授权"）
  valid: false,            // 是否放行（默认 false = fail-closed）
  locked: false,           // 是否永久锁定（回拨/篡改），需解锁码
  rolledBack: false,       // 本次是否检测到回拨
  offline: false,          // 本次是否走断网缓存兜底
  reason: null,            // 未放行/锁定的展示原因
  payload: null,           // 归一化 { date, file, moduleConfig }
  expireTimestamp: null,
  remainingDays: null,
  lastCheckedAt: null,
  sensorTypes: null,
  isAllTypes: false,
};

let recheckTimer = null;

// ─── 内部辅助 ───────────────────────────────────────────────────────────────────

/** 置为未授权（非锁定，如解密失败/格式错误）。 */
function setInvalid(type, rawKey, reason, extra) {
  state.type = type;
  state.rawKey = rawKey;
  state.checking = false;
  state.valid = false;
  state.locked = false;
  state.rolledBack = false;
  state.offline = false;
  state.reason = reason;
  state.payload = (extra && extra.payload) || null;
  state.expireTimestamp = (extra && extra.expireTimestamp) || null;
  state.remainingDays = null;
  state.sensorTypes = null;
  state.isAllTypes = false;
}

/** 在线原始 payload → 归一化 { date, file, moduleConfig }。 */
function normalizeOnline(p) {
  return { date: parseFloat(p.date), file: p.file, moduleConfig: p.moduleConfig || null };
}

/** 离线校验结果 → 归一化 { date, file, moduleConfig }（sensorTypes 还原成 file 形态）。 */
function normalizeOffline(r) {
  let file;
  if (r.licenseFile != null) {
    file = r.licenseFile;
  } else if (r.isAllTypes) {
    file = 'all';
  } else if (Array.isArray(r.sensorTypes)) {
    file = r.sensorTypes.length === 1 ? r.sensorTypes[0] : r.sensorTypes;
  } else {
    file = r.sensorType;
  }
  return { date: r.expireTimestamp, file, moduleConfig: null };
}

/** 把 evaluate* 的结果写入 state。payloadForFile：在线传本地解出的归一化 payload，离线传 normalizeOffline(r) 或 null。 */
function applyEval(type, rawKey, r, payloadForFile) {
  state.type = type;
  state.rawKey = rawKey;
  state.locked = !!r.locked;
  state.rolledBack = !!r.rolledBack;
  state.offline = !!r.offline;
  state.valid = (r.valid === true) && !r.locked;
  state.reason = state.valid
    ? null
    : (r.reason || (r.locked ? '检测到异常行为，请联系厂商解锁' : '授权未通过'));
  state.payload = payloadForFile || state.payload;
  state.expireTimestamp = (r.expireTimestamp != null)
    ? r.expireTimestamp
    : (payloadForFile ? payloadForFile.date : null);
  state.remainingDays = (r.remainingDays != null) ? r.remainingDays : null;
  state.sensorTypes = r.sensorTypes || null;
  state.isAllTypes = !!r.isAllTypes;
  state.lastCheckedAt = Date.now();
}

/** 统一出日志。 */
function logOutcome(label) {
  if (state.locked) {
    logger.warn(`[License] ${label}授权已锁定：${state.reason}`);
  } else if (state.valid) {
    logger.info(`[License] ${label}授权有效，剩余 ${state.remainingDays} 天${state.offline ? '（断网缓存兜底）' : ''}`);
  } else {
    logger.warn(`[License] ${label}授权未通过：${state.reason}`);
  }
}

// ─── 对外接口 ───────────────────────────────────────────────────────────────────

/**
 * 识别密钥格式。
 * @returns {'online'|'offline'|'invalid'}
 */
function identifyKeyType(rawKey) {
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) return 'invalid';
  const key = rawKey.trim();
  try {
    const obj = JSON.parse(Buffer.from(key, 'base64').toString('utf-8'));
    if (obj && obj.payload && obj.signature) return 'offline';
  } catch (e) {
    /* 非离线格式 */
  }
  if (/^[0-9a-fA-F]+$/.test(key)) return 'online';
  return 'invalid';
}

/**
 * 同步预取 payload（仅供启动时配置 db/串口）：不联网、不判有效性、不动时间闸。
 * @returns {{ type, payload:{date,file,moduleConfig} }|null}
 */
function peekPayload(rawKey) {
  const type = identifyKeyType(rawKey);
  if (type === 'online') {
    try {
      const plain = ecb.decryptStr(rawKey.trim());
      if (!plain) return null;
      const p = JSON.parse(plain);
      if (!p.date || !p.file) return null;
      return { type, payload: normalizeOnline(p) };
    } catch (e) {
      return null;
    }
  }
  if (type === 'offline') {
    if (!cryptoLib) return null;
    const r = cryptoLib.verifyOfflineLicense(rawKey.trim(), { nowMs: 0 });
    if (!r || !r.sensorTypes) return null;
    return { type, payload: normalizeOffline(r) };
  }
  return null;
}

/**
 * 在线版：POST /licenseCheck { key } 取服务器时间 + 密钥状态。
 * @returns {Promise<object|null>} 失败/超时/解析失败/无 time → null（走缓存兜底）。
 */
function fetchLicenseCheck(hexKey, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    try {
      const ks = config.keyServer;
      const url = new URL(ks.BASE_URL + ks.LICENSE_CHECK_PATH);
      const lib = url.protocol === 'https:' ? require('https') : require('http');
      // clientTime 供服务端维护"可信时间高水位"做服务端权威防回拨；tamper=本地已检测到回拨
      const body = JSON.stringify({ key: hexKey, clientTime: Date.now(), tamper: !!opts.tamper });
      const req = lib.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: ks.TIMEOUT_MS,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (!json || typeof json.time !== 'number') { resolve(null); return; }
            resolve(json);
          } catch (e) { resolve(null); }
        });
      });
      req.on('error', (err) => { logger.warn('[License] /licenseCheck 请求失败：' + err.message); resolve(null); });
      req.on('timeout', () => { req.destroy(); logger.warn('[License] /licenseCheck 超时'); resolve(null); });
      req.write(body);
      req.end();
    } catch (e) {
      logger.warn('[License] /licenseCheck 异常：' + e.message);
      resolve(null);
    }
  });
}

/**
 * 在线版加载：本地 ECB 解出 file/moduleConfig + 缓存感知联网 + evaluateOnlineLicense。
 * @returns {Promise<boolean>} 是否放行
 */
async function loadOnline(hexKey) {
  if (!cryptoLib) { setInvalid('online', hexKey, '加密库未就绪'); return false; }

  // 1. 本地解密拿 file/moduleConfig
  let rawPayload = null;
  try {
    const plain = ecb.decryptStr(hexKey);
    if (plain) rawPayload = JSON.parse(plain);
  } catch (e) { rawPayload = null; }
  if (!rawPayload || !rawPayload.date || !rawPayload.file) {
    setInvalid('online', hexKey, '密钥无效，解密失败');
    return false;
  }

  // 2. 缓存到期(2h)才真正联网；否则用缓存兜底（省流量、扛网络抖动）。
  //    本地已锁定时强制联网上报，拿服务端权威状态（即便缓存未到刷新点）。
  const localLocked = cryptoLib.isLocked(LIC_STATE).locked;
  const cache = cryptoLib.readOnlineCache(LIC_CACHE);
  const needFetch = localLocked || cryptoLib.shouldRefreshOnlineCache(cache, Date.now(), config.keyServer.CACHE_REFRESH_MS);
  const serverResult = needFetch ? await fetchLicenseCheck(hexKey, { tamper: localLocked }) : null;

  // 3. 统一评估（含回拨闸 + 缓存兜底）
  const r = cryptoLib.evaluateOnlineLicense({ statePath: LIC_STATE, cachePath: LIC_CACHE, serverResult });

  // 4. 服务端权威异常：status=TAMPERED → 视为锁定（弹"请联系厂商重新获取密钥"）。
  //    覆盖在线分支与缓存兜底分支两种来源。
  if (r.status === 'TAMPERED') {
    r.locked = true;
    r.valid = false;
    r.reason = r.reason || '检测到系统时间异常，请联系厂商重新获取密钥';
  }

  applyEval('online', hexKey, r, normalizeOnline(rawPayload));
  logOutcome('在线');
  return state.valid;
}

/**
 * 离线版加载：回拨闸 + RSA 验签 + 本机时间判过期。
 * @returns {boolean} 是否放行
 */
function loadOffline(code) {
  if (!cryptoLib) { setInvalid('offline', code, '离线校验库未就绪'); return false; }
  const r = cryptoLib.evaluateOfflineLicense({ activationCode: code, statePath: LIC_STATE });
  applyEval('offline', code, r, r.valid ? normalizeOffline(r) : null);
  logOutcome('离线');
  return state.valid;
}

/**
 * 启动/写入时按格式分流加载。运行期复检由调用方启动 startRuntimeRecheck。
 * @returns {Promise<boolean>} 是否放行
 */
async function loadFromKey(rawKey) {
  state.rawKey = rawKey && typeof rawKey === 'string' ? rawKey.trim() : rawKey;
  state.checking = true;
  try {
    const type = identifyKeyType(rawKey);
    if (type === 'offline') {
      return loadOffline(rawKey.trim());
    }
    if (type === 'online') {
      return await loadOnline(rawKey.trim());
    }
    setInvalid(null, rawKey, '密钥格式无法识别');
    return false;
  } finally {
    state.checking = false;
  }
}

/**
 * 清除锁定/缓存状态：用户写入厂商重新签发的新密钥时调用，让新密钥重新校验。
 * （已取消解锁码机制，锁定后凭新密钥恢复。）删除 .lic_state（含高水位+锁定）与 .lic_cache。
 */
function clearLockState() {
  try { if (fs.existsSync(LIC_STATE)) fs.unlinkSync(LIC_STATE); } catch (e) { logger.warn('[License] 清除锁定状态失败：' + e.message); }
  try { if (fs.existsSync(LIC_CACHE)) fs.unlinkSync(LIC_CACHE); } catch (e) { /* ignore */ }
}

/**
 * 仅清除在线缓存（换在线密钥时调用）。
 * 缓存不与密钥绑定，换密钥若不清旧缓存，新密钥断网时会沿用旧密钥缓存被判有效 → 必须清掉，
 * 强制新密钥先联网激活一次。
 */
function clearOnlineCache() {
  try { if (fs.existsSync(LIC_CACHE)) fs.unlinkSync(LIC_CACHE); } catch (e) { /* ignore */ }
}

/** 当前是否处于锁定态（启动时可用于快速决定弹解锁窗）。 */
function isLockedNow() {
  if (!cryptoLib) return { locked: false, reason: '' };
  return cryptoLib.isLocked(LIC_STATE);
}

/**
 * 运行期复检（5min）：持续顶高水位、catch 开机回拨；在线到点(2h)才联网刷新。
 * 在线/离线都跑。每次复检后回调 onChange(state, prevValid)。
 */
function startRuntimeRecheck(onChange) {
  stopRuntimeRecheck();
  recheckTimer = setInterval(async () => {
    if (!state.rawKey) return;
    const prevValid = state.valid;
    await loadFromKey(state.rawKey);
    if (typeof onChange === 'function') {
      try { onChange(getState(), prevValid); } catch (e) { logger.error('[License] 复检回调异常', e); }
    }
  }, config.keyServer.RECHECK_INTERVAL_MS);
  if (recheckTimer && recheckTimer.unref) recheckTimer.unref();
}

function stopRuntimeRecheck() {
  if (recheckTimer) {
    clearInterval(recheckTimer);
    recheckTimer = null;
  }
}

/** 统一授权有效性出口（锁定时返回 false）。 */
function isLicenseValid() {
  return state.valid === true;
}

/** 当前授权状态快照。 */
function getState() {
  return { ...state };
}

module.exports = {
  LIC_STATE,
  LIC_CACHE,
  identifyKeyType,
  peekPayload,
  loadFromKey,
  loadOnline,
  loadOffline,
  fetchLicenseCheck,
  clearLockState,
  clearOnlineCache,
  isLockedNow,
  startRuntimeRecheck,
  stopRuntimeRecheck,
  isLicenseValid,
  getState,
};
