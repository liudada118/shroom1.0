const SOURCES = new Set(['usb', 'demo']);
export const MATRIX_SIZE = 32;
export const FRAME_VALUES = MATRIX_SIZE * MATRIX_SIZE;
export const STALE_AFTER_MS = 2000;

/** 解开宿主消息并拒绝过大的字符串，避免错误输入占满 WebView。 */
function parseMessage(message) {
  if (typeof message === 'string') {
    if (message.length > 65536) throw new Error('数据消息过大');
    try { return JSON.parse(message); } catch { throw new Error('数据消息不是有效 JSON'); }
  }
  return message;
}

/** 验证移动桥的 32×32 压力帧；不在网页中重复解码 USB 字节协议。 */
export function validatePressureMessage(message) {
  const frame = parseMessage(message);
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) {
    throw new Error('数据消息必须是对象');
  }
  if (frame.version !== 1) throw new Error('不支持的数据桥版本');
  if (frame.type === 'stream.reset') {
    if (frame.source !== null && !SOURCES.has(frame.source)) throw new Error('重置消息来源无效');
    return { type: 'stream.reset', version: 1, source: frame.source };
  }
  if (frame.type !== 'pressure.frame') throw new Error('不支持的数据消息类型');
  if (!SOURCES.has(frame.source)) throw new Error('数据来源必须是 USB 或演示');
  if (!Number.isSafeInteger(frame.sequence) || frame.sequence < 0) throw new Error('数据帧序号无效');
  if (!Number.isSafeInteger(frame.timestamp) || frame.timestamp < 0) throw new Error('数据帧时间无效');
  if (frame.rows !== MATRIX_SIZE || frame.columns !== MATRIX_SIZE) throw new Error('需要 32×32 压力矩阵');
  if (!Array.isArray(frame.values) || frame.values.length !== FRAME_VALUES) {
    throw new Error('压力帧必须包含 1024 个数值');
  }
  for (let index = 0; index < FRAME_VALUES; index += 1) {
    const value = frame.values[index];
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error(`第 ${index + 1} 个压力值不是 0–255 范围内的整数`);
    }
  }
  return { type: frame.type, version: 1, source: frame.source,
    sequence: frame.sequence, timestamp: frame.timestamp, rows: MATRIX_SIZE,
    columns: MATRIX_SIZE, values: frame.values.slice() };
}

/** 汇总原始读数；未做标定，数值不冒充力或压强单位。 */
function summarizeValues(values) {
  let peak = 0;
  let active = 0;
  for (const value of values) {
    if (value > peak) peak = value;
    if (value > 0) active += 1;
  }
  return { peak, active };
}

/** 管理当前数据流；重连/切源需显式 reset，错误帧不会覆盖合法画面。 */
export function createPressureBridge({ onFrame = () => {}, onReset = () => {},
  postMessage = () => {}, now = () => Date.now() } = {}) {
  let source = null;
  let sequence = null;
  let latestFrame = null;
  let acceptedFrames = 0;
  let rejectedFrames = 0;
  let lastReceivedAt = null;
  let error = null;
  let stats = { peak: 0, active: 0 };
  let recentFrames = [];

  /** 返回低频界面状态；断流显示暂停而不是继续标记实时。 */
  function snapshot() {
    const current = now();
    recentFrames = recentFrames.filter((time) => time > current - 1000);
    const stale = lastReceivedAt !== null && current - lastReceivedAt >= STALE_AFTER_MS;
    return { source, sequence, latestFrame, acceptedFrames, rejectedFrames,
      lastReceivedAt, error, ...stats, fps: recentFrames.length,
      status: lastReceivedAt === null ? 'waiting' : stale ? 'stale' : 'receiving' };
  }

  /** 接收对象或 JSON 字符串，成功帧向宿主回报序号。 */
  function receive(message) {
    try {
      const frame = validatePressureMessage(message);
      if (frame.type === 'stream.reset') {
        source = frame.source;
        sequence = null;
        latestFrame = null;
        acceptedFrames = 0;
        rejectedFrames = 0;
        lastReceivedAt = null;
        error = null;
        stats = { peak: 0, active: 0 };
        recentFrames = [];
        onReset(snapshot());
        return true;
      }
      if (source !== null && frame.source !== source) throw new Error('切换数据来源前需要重置数据流');
      if (sequence !== null && frame.sequence <= sequence) throw new Error('收到重复或乱序的数据帧');
      source = frame.source;
      sequence = frame.sequence;
      latestFrame = frame;
      acceptedFrames += 1;
      lastReceivedAt = now();
      recentFrames.push(lastReceivedAt);
      stats = summarizeValues(frame.values);
      error = null;
      onFrame(frame);
      postMessage({ type: 'web.frame', sequence });
      return true;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '数据帧校验失败';
      rejectedFrames += 1;
      postMessage({ type: 'web.error', message: error });
      return false;
    }
  }

  return { receive, snapshot };
}

/** 安装供 RN 注入的唯一入口，卸载时恢复旧入口，初始化后通知宿主。 */
export function installPressureBridge(target, bridge) {
  const previous = target.ShroomMobile;
  const installed = { receive: bridge.receive };
  target.ShroomMobile = installed;
  target.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'web.ready', version: 1 }));
  return () => {
    if (target.ShroomMobile !== installed) return;
    if (previous === undefined) delete target.ShroomMobile;
    else target.ShroomMobile = previous;
  };
}
