/**
 * licenseManager.js
 * 授权验证统一模块（验证方）
 *
 * 取代 licenseHelper.js 中失效的授权逻辑（readEndDate/initLicense 等，
 * 它们依赖不存在的 module2.decrypt）。licenseHelper.js 里仍在用的路径函数
 * resolveConfigFile / getConfigFileCandidates / getWritableConfigFile 不在本模块职责内。
 *
 * 两个授权版本，按密钥格式自动识别：
 *   能 base64→JSON 且含 signature → 离线版（RSA-SHA256 验签 + 防回拨本机时间，全程不联网）
 *   否则按 hex                     → 在线版（ECB 解密拿 file/moduleConfig + 联网 /licenseCheck 校时校状态）
 *
 * 在线版：启动 + 每 2h POST {BASE_URL}/licenseCheck { key }，
 *   用返回 time 判过期、valid/status 决定放行；取不到响应即 fail-closed（停用），
 *   绝不回退本机时间——修掉旧的 nowDate=0 "离线永不过期" bug。
 * 离线版：getTrustedNow(主/备锚点) + verifyOfflineLicense（公钥已内置、无机器码）。
 *   rolledBack 不硬停：getTrustedNow 已返回 max(本机,锚点) 的防回拨时间，用它判过期即可防白嫖。
 */

const path = require('path');
const logger = require('./logger');
const config = require('./configManager');

// 在线密钥解密沿用现有 ECB（零改动），用于本地解出 file/moduleConfig。
const ecb = require('./aes_ecb');

// 离线版加密库：容错加载，文件缺失时仅离线版不可用，不影响应用启动。
let cryptoLib = null;
try {
  cryptoLib = require('./crypto-lib.cjs');
} catch (err) {
  logger.warn('[License] crypto-lib.cjs 尚未就绪，离线版暂不可用：' + err.message);
}

// ─── 锚点文件路径（防回拨可信时间，离线版用）────────────────────────────────────
// 主：userData 下隐蔽文件；备：db 目录（启动已创建）。读取大值、写入两份。
const GUARD_MAIN = path.join(config.APP_DATA_DIR, '.tg.dat');
const GUARD_BAK = path.join(config.DB_DIR, '.tg.bak');

// ─── 模块内授权状态缓存 ─────────────────────────────────────────────────────────
// server.js 的各处过期判断统一读 isLicenseValid()，不再各自比较 nowDate < endDate。
const state = {
  type: null,              // 'online' | 'offline' | null
  rawKey: null,            // config.txt 原始密钥串（在线轮询复检要用）
  checking: false,         // 是否正在首检/复检中（前端据此区分"校验中"与"未授权"，避免启动瞬间闪红）
  valid: false,            // 当前是否放行（默认 false = fail-closed）
  reason: null,            // 不放行时给前端展示的原因
  warning: null,           // 轻提示（如检测到时间回拨），不影响放行
  payload: null,           // 归一化的 { date, file, moduleConfig }，在线/离线通用
  expireTimestamp: null,   // 到期时间戳（ms）
  remainingDays: null,     // 剩余天数
  lastCheckedAt: null,     // 上次成功校验时间（ms：在线=服务器时间，离线=可信时间）
  sensorTypes: null,       // 授权传感器列表
  isAllTypes: false,
};

let pollTimer = null;

// ─── 内部辅助 ───────────────────────────────────────────────────────────────────

/** 把 state 置为未授权（fail-closed）。extra 可携带已解出的 payload/expireTimestamp 供 UI 展示。 */
function setInvalid(type, rawKey, reason, extra) {
  state.type = type;
  state.rawKey = rawKey;
  state.valid = false;
  state.reason = reason;
  state.warning = null;
  state.payload = (extra && extra.payload) || null;
  state.expireTimestamp = (extra && extra.expireTimestamp) || null;
  state.remainingDays = null;
  state.sensorTypes = null;
  state.isAllTypes = false;
}

/** 在线版原始 payload → 归一化 { date, file, moduleConfig }。 */
function normalizeOnline(p) {
  return {
    date: parseFloat(p.date),
    file: p.file,
    moduleConfig: p.moduleConfig || null,
  };
}

/** 离线版校验结果 → 归一化 { date, file, moduleConfig }。把 sensorTypes 还原成 file 形态。 */
function normalizeOffline(r) {
  let file;
  if (r.isAllTypes) {
    file = 'all';
  } else if (Array.isArray(r.sensorTypes)) {
    file = r.sensorTypes.length === 1 ? r.sensorTypes[0] : r.sensorTypes;
  } else {
    file = r.sensorType;
  }
  return { date: r.expireTimestamp, file, moduleConfig: null };
}

/** /licenseCheck 的 status → 兜底提示文案（服务器未给 reason 时用）。 */
function statusReason(status) {
  switch (status) {
    case 'SUSPENDED': return '密钥已被暂停，请联系供应商';
    case 'REVOKED': return '密钥已被吊销，请联系供应商';
    case 'EXPIRED': return '密钥已过期';
    case 'INVALID': return '密钥无效';
    case 'UNKNOWN': return '未知密钥';
    case 'DB_ERROR': return '授权服务异常，请稍后重试';
    default: return '授权校验未通过';
  }
}

// ─── 对外接口 ───────────────────────────────────────────────────────────────────

/**
 * 识别密钥格式。
 * @param {string} rawKey
 * @returns {'online'|'offline'|'invalid'}
 */
function identifyKeyType(rawKey) {
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) return 'invalid';
  const key = rawKey.trim();
  // 离线：base64 解出 JSON 且含 payload+signature
  try {
    const obj = JSON.parse(Buffer.from(key, 'base64').toString('utf-8'));
    if (obj && obj.payload && obj.signature) return 'offline';
  } catch (e) {
    /* 非离线格式，继续判 hex */
  }
  // 在线：纯 hex 字符串
  if (/^[0-9a-fA-F]+$/.test(key)) return 'online';
  return 'invalid';
}

/**
 * 在线版：POST {BASE_URL}{LICENSE_CHECK_PATH} { key } 做校时+校状态。
 * @param {string} hexKey
 * @returns {Promise<object|null>} 解析后的响应；网络/超时/解析失败/无 time → null（fail-closed）。
 */
function fetchLicenseCheck(hexKey) {
  return new Promise((resolve) => {
    try {
      const ks = config.keyServer;
      const url = new URL(ks.BASE_URL + ks.LICENSE_CHECK_PATH);
      const lib = url.protocol === 'https:' ? require('https') : require('http');
      const body = JSON.stringify({ key: hexKey });

      const req = lib.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: ks.TIMEOUT_MS,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            // 无 time 字段视为无效响应 → fail-closed
            if (!json || typeof json.time !== 'number') { resolve(null); return; }
            resolve(json);
          } catch (e) {
            resolve(null);
          }
        });
      });

      req.on('error', (err) => {
        logger.warn('[License] /licenseCheck 请求失败：' + err.message);
        resolve(null);
      });
      req.on('timeout', () => {
        req.destroy();
        logger.warn('[License] /licenseCheck 超时');
        resolve(null);
      });
      req.write(body);
      req.end();
    } catch (e) {
      logger.warn('[License] /licenseCheck 异常：' + e.message);
      resolve(null);
    }
  });
}

/**
 * 在线版加载：本地 ECB 解出 file/moduleConfig + 调 /licenseCheck 判定，写入 state。
 * @param {string} hexKey
 * @returns {Promise<boolean>} 是否放行
 */
async function loadOnline(hexKey) {
  // 1. 本地解密拿 file/moduleConfig（licenseCheck 不返回 moduleConfig）
  let rawPayload = null;
  try {
    const plain = ecb.decryptStr(hexKey);
    if (plain) rawPayload = JSON.parse(plain);
  } catch (e) {
    rawPayload = null;
  }
  if (!rawPayload || !rawPayload.date || !rawPayload.file) {
    setInvalid('online', hexKey, '密钥无效，解密失败');
    return false;
  }

  // 2. 联网校验；取不到响应 → fail-closed（仍保留本地解出的 payload 供 UI 展示）
  const resp = await fetchLicenseCheck(hexKey);
  if (!resp) {
    setInvalid('online', hexKey, '无法连接授权服务器，已暂停使用', {
      payload: normalizeOnline(rawPayload),
      expireTimestamp: parseFloat(rawPayload.date),
    });
    return false;
  }

  // 3. valid 决定放行；SUSPENDED/REVOKED 立即停用（远程吊销）
  const blocked = resp.status === 'SUSPENDED' || resp.status === 'REVOKED';
  const allow = resp.valid === true && !blocked;

  state.type = 'online';
  state.rawKey = hexKey;
  state.valid = allow;
  state.reason = allow ? null : (resp.reason || statusReason(resp.status));
  state.warning = null;
  state.payload = normalizeOnline(rawPayload);
  state.expireTimestamp = (resp.expireTimestamp != null) ? resp.expireTimestamp : parseFloat(rawPayload.date);
  state.remainingDays = (resp.remainingDays != null) ? resp.remainingDays : null;
  state.sensorTypes = resp.sensorTypes || null;
  state.isAllTypes = !!resp.isAllTypes;
  state.lastCheckedAt = resp.time; // 上次成功校验（服务器时间）

  if (allow) {
    logger.info(`[License] 在线授权有效，剩余 ${state.remainingDays} 天`);
  } else {
    logger.warn(`[License] 在线授权未通过：status=${resp.status} reason=${state.reason}`);
  }
  return allow;
}

/**
 * 防回拨可信时间（主/备锚点）：读两份取较大值对齐主文件，调 getTrustedNow，再补写备份。
 * @returns {{ now:number, rolledBack:boolean }}
 */
function trustedNowWithBackup() {
  if (!cryptoLib) return { now: 0, rolledBack: true };

  const a = cryptoLib.readTimeAnchor(GUARD_MAIN);
  const b = cryptoLib.readTimeAnchor(GUARD_BAK);
  const maxAnchor = Math.max(a || 0, b || 0);
  // 用较大锚点对齐主文件，避免某一份落后导致 getTrustedNow 取到更小的时间
  if (maxAnchor > (a || 0)) {
    cryptoLib.writeTimeAnchor(GUARD_MAIN, maxAnchor);
  }

  const { now, rolledBack } = cryptoLib.getTrustedNow(GUARD_MAIN);
  // getTrustedNow 已写主文件，这里把可信时间补写到备份，保持两份一致
  cryptoLib.writeTimeAnchor(GUARD_BAK, now);
  return { now, rolledBack };
}

/**
 * 离线版加载：可信时间 + RSA 验签判定，写入 state。公钥已内置，无机器码。
 * @param {string} code - base64 的 { payload, signature }
 * @returns {boolean} 是否放行
 */
function loadOffline(code) {
  if (!cryptoLib) {
    setInvalid('offline', code, '离线校验库(crypto-lib.cjs)未就绪');
    return false;
  }

  const { now, rolledBack } = trustedNowWithBackup();
  if (rolledBack) {
    // 不硬停：now 已是防回拨时间，用它判过期足够防白嫖；回拨可能是改时区/NTP 校时等正常操作
    logger.warn('[License] 检测到本机时间被回拨，已用防回拨时间判过期');
  }

  const r = cryptoLib.verifyOfflineLicense(code, { nowMs: now });

  state.type = 'offline';
  state.rawKey = code;
  state.valid = r.valid === true;
  state.reason = state.valid ? null : (r.error || '离线授权无效');
  state.warning = rolledBack ? '检测到系统时间曾被回拨，已按可信时间校验' : null;
  state.payload = state.valid ? normalizeOffline(r) : null;
  state.expireTimestamp = r.expireTimestamp || null;
  state.remainingDays = (r.remainingDays != null) ? r.remainingDays : null;
  state.sensorTypes = r.sensorTypes || null;
  state.isAllTypes = !!r.isAllTypes;
  state.lastCheckedAt = now;

  if (state.valid) {
    logger.info(`[License] 离线授权有效，剩余 ${state.remainingDays} 天`);
  } else {
    logger.warn('[License] 离线授权未通过：' + state.reason);
  }
  return state.valid;
}

/**
 * 启动/写入时按格式分流加载。旧 config.txt（老 ECB 在线密钥）走在线版，零兼容分支。
 * 注意：在线版的 2h 轮询由调用方（server.js）在加载后据 getState().type 启动。
 * @param {string} rawKey
 * @returns {Promise<boolean>} 是否放行
 */
async function loadFromKey(rawKey) {
  state.checking = true;
  try {
    const type = identifyKeyType(rawKey);
    if (type === 'offline') {
      stopOnlinePolling();
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
 * 同步预取 payload（仅供启动时配置 db/串口用）：不联网、不判有效性。
 * 在线版本地 ECB 解密；离线版 RSA 验签通过才取 payload（签名无效返回 null，不信任伪造内容）。
 * @param {string} rawKey
 * @returns {{ type:'online'|'offline', payload:{date:number,file:any,moduleConfig:any} }|null}
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
    // nowMs 此处不影响 payload 提取；只要签名有效就能拿到 sensorTypes
    const r = cryptoLib.verifyOfflineLicense(rawKey.trim(), { nowMs: 0 });
    if (!r || !r.sensorTypes) return null; // 签名无效
    return { type, payload: normalizeOffline(r) };
  }
  return null;
}

/**
 * 启动在线版 2h 轮询复检。每次复检后通过 onChange(state, prevValid) 回调给 server.js 广播。
 * @param {(state:object, prevValid:boolean)=>void} [onChange]
 */
function startOnlinePolling(onChange) {
  stopOnlinePolling();
  pollTimer = setInterval(async () => {
    if (state.type !== 'online' || !state.rawKey) return;
    const prevValid = state.valid;
    await loadOnline(state.rawKey);
    if (typeof onChange === 'function') {
      try { onChange(getState(), prevValid); } catch (e) { logger.error('[License] 轮询回调异常', e); }
    }
  }, config.keyServer.POLL_INTERVAL_MS);
  if (pollTimer && pollTimer.unref) pollTimer.unref(); // 不阻止进程退出
}

/** 停止在线轮询（如重新写入密钥、切到离线版时）。 */
function stopOnlinePolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/**
 * 统一授权有效性出口。server.js 各处过期判断改调它，替代散落的 nowDate < endDate。
 * @returns {boolean}
 */
function isLicenseValid() {
  return state.valid === true;
}

/** 当前授权状态快照（供 server.js 广播给前端：在线/离线、剩余天数、原因等）。 */
function getState() {
  return { ...state };
}

module.exports = {
  // 路径常量
  GUARD_MAIN,
  GUARD_BAK,
  // 识别 / 加载
  identifyKeyType,
  peekPayload,
  loadFromKey,
  loadOnline,
  loadOffline,
  fetchLicenseCheck,
  // 时间锚点
  trustedNowWithBackup,
  // 轮询
  startOnlinePolling,
  stopOnlinePolling,
  // 状态出口
  isLicenseValid,
  getState,
};
