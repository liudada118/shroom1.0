export const SERIAL_DETECTION_BAUD_RATES = Object.freeze([921600, 1000000, 1500000, 3000000, 6000000]);

/** 默认连接无有效数据后读取协议证据；宿主只释放所指定的原连接，取消可终止探测。 */
export async function detectSerialConnection({ path, sensorType, role, connectionId, signal }) {
  const base = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:19245';
  const response = await fetch(`${base}/api/serial/protocol-detect`, {
    method: 'POST', signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, connection: { sensorType, role, ...(connectionId != null ? { connectionId } : {}) } }),
  });
  const payload = await response.json();
  if (!response.ok || (payload.code != null && Number(payload.code) !== 0)) {
    const error = new Error(payload.msg || payload.message || `HTTP ${response.status}`);
    error.code = payload.errorCode || 'SERIAL_PROTOCOL_DETECT_FAILED';
    throw error;
  }
  return payload.data || payload.result || payload;
}

/** 短暂等待下一次状态读取，取消时同步清除定时器。 */
function waitForDataPoll(delay, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const cancel = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, delay);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

/** 读取宿主按物理连接统计的有效帧状态，不用端口打开或原始字节冒充读取成功。 */
async function readSerialDataStatus(signal) {
  const base = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:19245';
  const response = await fetch(`${base}/api/collection/status`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** 默认连接至少读取两秒；仅当前连接明确无数据才允许识别，旧宿主或查询失败保留连接。 */
export async function waitForSerialConnectionData({ path, role, connectionId, systemId, signal,
  timeoutMs = 2000, pollMs = 200, readStatus = readSerialDataStatus }) {
  if (signal?.aborted) throw signal.reason;
  if (connectionId == null) return 'unavailable';
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  const deadline = Date.now() + timeoutMs;
  const timer = setTimeout(() => controller.abort(new Error('serial data status timeout')), timeoutMs + 1000);
  try {
    while (true) {
      const payload = await readStatus(controller.signal);
      if (controller.signal.aborted) throw controller.signal.reason;
      if (!Array.isArray(payload?.serialDataStatus)) return 'unavailable';
      if (payload.collectionSourceStatus?.systemId !== systemId) return 'changed';
      const status = payload.serialDataStatus.find(item => item.role === role);
      if (!status || status.path !== path || status.connectionId !== connectionId || status.isOpen !== true) return 'changed';
      if (status.ready === true) return 'ready';
      if (status.detectionSupported !== true) return 'unsupported';
      if (status.ready !== false) return 'unavailable';
      if (Date.now() >= deadline) return 'no-data';
      await waitForDataPoll(Math.min(pollMs, deadline - Date.now()), controller.signal);
    }
  } catch (error) {
    if (signal?.aborted) throw signal.reason || error;
    return 'unavailable';
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.abort();
  }
}

/** 只有唯一、兼容且使用允许波特率的识别结果才可用于连接。 */
export function serialDetectionAction(result) {
  if (result?.status === 'unsupported') return 'default';
  const baudRate = Number(result?.match?.protocol?.baudRate);
  if (result?.status !== 'matched' || result.compatible !== true || !SERIAL_DETECTION_BAUD_RATES.includes(baudRate)) return 'notice';
  return baudRate === Number(result.defaultBaudRate) ? 'connect' : 'confirm';
}
