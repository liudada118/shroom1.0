'use strict';

/**
 * 串口自检。
 *
 * 存在理由：客户接入失败时，最贵的失败方式是「沉默」——
 * 波特率错了不报错，只是读到乱码；线没接 TX 不报错，只是一直没数据；
 * 传感器类型选错了不报错，只是矩阵形状不对。
 * 这个模块把这三种沉默变成打印出来的事实。
 *
 * 采样和分析是分开的：analyzeSample 是纯函数，喂合成 buffer 就能测，不用插硬件。
 */

const {
  DELIMITERS,
  SENSORS,
  findByFrameLength,
  getSensor,
  resolveDelimiter,
  listSensorTypes,
} = require('../sensors');

const DEFAULT_WINDOW_MS = 600;

/** 采样窗口里至少要看到这么多个定界符才算「找到帧结构」。少于 2 个就量不出帧长。 */
const MIN_DELIMITER_HITS = 3;

/** 注册表里出现过的全部波特率，按被多少种传感器使用排序 —— 先试最可能的。 */
function candidateBaudRates() {
  const counts = new Map();
  listSensorTypes().forEach((type) => {
    const baud = SENSORS[type].protocol && SENSORS[type].protocol.baudRate;
    if (!Number.isFinite(baud)) return;
    counts.set(baud, (counts.get(baud) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .map(([baud]) => baud);
}

/** 注册表里出现过的全部定界符，去重。 */
function candidateDelimiters() {
  const seen = new Map();
  const add = (name, hex) => {
    const buf = resolveDelimiter(hex);
    if (buf && !seen.has(buf.toString('hex'))) seen.set(buf.toString('hex'), { name, bytes: buf });
  };
  Object.entries(DELIMITERS).forEach(([name, hex]) => add(name, hex));
  listSensorTypes().forEach((type) => {
    const d = SENSORS[type].protocol && SENSORS[type].protocol.delimiter;
    if (d) add(type, d);
  });
  return [...seen.values()];
}

/**
 * 用已知波特率收窄候选。
 * 四种手套的帧形状完全一样（256 点 16x16），但 handGlove115200 只跑 115200 ——
 * 在 921600 下探到的帧不可能是它。帧长认不出来的差别，波特率能认出来。
 * 一个都不匹配时保留全部：宁可多列，不要空手。
 */
function narrowByBaudRate(candidates, baudRate) {
  if (!Number.isFinite(baudRate)) return candidates;
  const matched = candidates.filter((type) => {
    const p = SENSORS[type].protocol;
    return p && p.baudRate === baudRate;
  });
  return matched.length > 0 ? matched : candidates;
}

function findAllOccurrences(buffer, needle) {
  const hits = [];
  let from = 0;
  for (;;) {
    const at = buffer.indexOf(needle, from);
    if (at === -1) break;
    hits.push(at);
    from = at + 1; // +1 而不是 +needle.length：定界符自重叠时也不漏
  }
  return hits;
}

/** 取众数间隔。帧长固定时所有间隔都一样，偶发丢字节不会带偏结论。 */
function modeGap(hits) {
  if (hits.length < 2) return null;
  const counts = new Map();
  for (let i = 1; i < hits.length; i += 1) {
    const gap = hits[i] - hits[i - 1];
    counts.set(gap, (counts.get(gap) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  counts.forEach((count, gap) => {
    if (count > bestCount || (count === bestCount && gap > best)) {
      best = gap;
      bestCount = count;
    }
  });
  return { gap: best, hits: bestCount + 1 };
}

/** 文本协议（民振那种 'yroscope:' 打头的）没有二进制定界符，得单独认。 */
function detectTextProtocol(buffer) {
  const text = buffer.toString('latin1');
  const matches = listSensorTypes()
    .filter((type) => {
      const pattern = SENSORS[type].protocol && SENSORS[type].protocol.frameStartPattern;
      return pattern && new RegExp(pattern, 'i').test(text);
    });
  if (matches.length === 0) return null;
  const pattern = new RegExp(SENSORS[matches[0]].protocol.frameStartPattern, 'gi');
  const hits = text.match(pattern);
  return { candidates: matches, frameCount: hits ? hits.length : 0 };
}

/**
 * 分析一段原始采样。纯函数。
 *
 * @param {Buffer} buffer 采样到的原始字节
 * @param {{windowMs?: number, baudRate?: number}} context
 * @returns {object} 结构化结论，verdict 是给机器看的，reason 是给人看的
 */
function analyzeSample(buffer, context = {}) {
  const windowMs = context.windowMs || DEFAULT_WINDOW_MS;
  const baudRate = context.baudRate || null;
  const byteCount = buffer ? buffer.length : 0;
  const base = { baudRate, windowMs, byteCount, firstBytesHex: '' };

  if (byteCount === 0) {
    return {
      ...base,
      verdict: 'no-data',
      reason: '端口能打开，但采样窗口内一个字节都没收到。常见原因：设备没上电、TX 没接、或者这不是传感器口。',
      candidates: [],
    };
  }

  base.firstBytesHex = buffer.subarray(0, Math.min(16, byteCount)).toString('hex');

  let best = null;
  candidateDelimiters().forEach((delimiter) => {
    const hits = findAllOccurrences(buffer, delimiter.bytes);
    const mode = modeGap(hits);
    if (!mode || mode.hits < MIN_DELIMITER_HITS) return;
    if (!best || mode.hits > best.mode.hits) best = { delimiter, mode, totalHits: hits.length };
  });

  if (best) {
    const stride = best.mode.gap;
    const payloadBytes = stride - best.delimiter.bytes.length;
    const frameCount = best.mode.hits - 1;
    const hz = windowMs > 0 ? Math.round((frameCount * 1000) / windowMs) : null;
    const candidates = narrowByBaudRate(findByFrameLength(payloadBytes), baudRate);
    return {
      ...base,
      verdict: candidates.length > 0 ? 'identified' : 'unknown-frame-length',
      delimiterHex: best.delimiter.bytes.toString('hex'),
      frameStrideBytes: stride,
      payloadBytes,
      frameCount,
      hz,
      candidates,
      reason: candidates.length > 0
        ? `找到帧结构：定界符 ${best.delimiter.bytes.toString('hex')}，帧长 ${stride} 字节，负载 ${payloadBytes} 字节，约 ${hz} Hz。`
        : `找到帧结构（定界符 ${best.delimiter.bytes.toString('hex')}，负载 ${payloadBytes} 字节），但注册表里没有这个负载长度的传感器。要么是新型号，要么波特率不对导致帧长量错了。`,
    };
  }

  const text = detectTextProtocol(buffer);
  if (text) {
    const hz = windowMs > 0 ? Math.round((text.frameCount * 1000) / windowMs) : null;
    return {
      ...base,
      verdict: 'identified',
      protocolKind: 'text',
      frameCount: text.frameCount,
      hz,
      candidates: text.candidates,
      reason: `识别为文本协议，帧头正则命中 ${text.frameCount} 次，约 ${hz} Hz。`,
    };
  }

  return {
    ...base,
    verdict: 'unrecognized',
    candidates: [],
    reason: `收到 ${byteCount} 字节，但认不出任何已知帧结构。前 16 字节：${base.firstBytesHex}。最可能是波特率不对 —— 换一个再试。`,
  };
}

/**
 * 把分析结论渲染成一行人能读的话。
 * 「COM36 ✓ 识别为 hand0205（16x16，921600，74 Hz）」比一个 JSON 有用。
 */
function formatProbeResult(portPath, result) {
  if (!result) return `${portPath}  ？ 未探测`;
  if (result.verdict === 'open-failed') {
    return `${portPath}  ✗ 打不开：${result.reason}`;
  }
  if (result.verdict === 'no-data') {
    return `${portPath}  ✗ 无数据（${result.baudRate} baud）：${result.reason}`;
  }
  if (result.verdict === 'unrecognized' || result.verdict === 'unknown-frame-length') {
    return `${portPath}  ? ${result.reason}`;
  }
  const detail = result.candidates
    .map((type) => {
      const sensor = getSensor(type);
      const m = sensor && sensor.matrix;
      const shape = m ? `${m.width}x${m.height}` : (sensor && sensor.channelMatrix ? '多通道' : '矩阵未知');
      const flag = sensor && sensor.verified ? '' : '（未验证画像）';
      return `${type}[${shape}]${flag}`;
    })
    .join(' 或 ');
  const hz = result.hz == null ? '' : `，${result.hz} Hz`;
  return `${portPath}  ✓ ${detail}，${result.baudRate} baud${hz}`;
}

/**
 * 造一个探针。openPort 可注入，所以测试不需要真串口。
 *
 * @param {{openPort?: Function, windowMs?: number}} deps
 *   openPort(path, baudRate, windowMs) -> Promise<Buffer>，采满窗口后 resolve 原始字节
 */
function createPortProbe(deps = {}) {
  const windowMs = deps.windowMs || DEFAULT_WINDOW_MS;
  const openPort = deps.openPort || defaultOpenPort;

  /**
   * 探一个口。依次试候选波特率，第一个能认出帧结构的就返回。
   * 全都认不出时返回信息量最大的那次（有数据 > 无数据），而不是最后一次。
   */
  async function probePort(portPath, options = {}) {
    const bauds = options.baudRates || candidateBaudRates();
    let fallback = null;
    const rank = { 'open-failed': 0, 'no-data': 1, unrecognized: 2, 'unknown-frame-length': 3 };

    for (const baudRate of bauds) {
      let result;
      try {
        const buffer = await openPort(portPath, baudRate, windowMs);
        result = analyzeSample(buffer, { windowMs, baudRate });
      } catch (error) {
        result = {
          verdict: 'open-failed',
          baudRate,
          windowMs,
          byteCount: 0,
          candidates: [],
          reason: error && error.message ? error.message : String(error),
        };
      }
      if (result.verdict === 'identified') return result;
      if (!fallback || (rank[result.verdict] || 0) > (rank[fallback.verdict] || 0)) {
        fallback = result;
      }
    }
    return fallback;
  }

  return { probePort, analyzeSample, candidateBaudRates, candidateDelimiters };
}

/** 真串口采样。延迟 require，这样不装 serialport 也能跑 analyzeSample 的测试。 */
function defaultOpenPort(portPath, baudRate, windowMs) {
  const { SerialPort } = require('serialport');
  return new Promise((resolve, reject) => {
    const port = new SerialPort({ path: portPath, baudRate, autoOpen: false });
    const chunks = [];
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      port.removeAllListeners('data');
      const done = () => (error ? reject(error) : resolve(Buffer.concat(chunks)));
      if (port.isOpen) port.close(done); else done();
    };
    const timer = setTimeout(() => finish(null), windowMs);
    port.on('error', finish);
    port.on('data', (chunk) => chunks.push(chunk));
    port.open((error) => {
      if (error) finish(error);
    });
  });
}

module.exports = {
  createPortProbe,
  analyzeSample,
  formatProbeResult,
  candidateBaudRates,
  candidateDelimiters,
  DEFAULT_WINDOW_MS,
};
