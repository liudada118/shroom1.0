import { commandClient } from './command/commandClient';
import { requestJson } from '../extensions/display-system/api';
import { readCollectionSummary } from './collectionStatus';

/** 等待宿主操作时仍响应退出取消和超时，不把迟到结果当作已确认退出。 */
function abortable(operation, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener('abort', aborted, { once: true });
    Promise.resolve(operation).then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
}

/** 保存期间稍候再核对宿主回执；取消后立即释放等待定时器。 */
function waitForReceipt(delayMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const aborted = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', aborted); resolve(); }, delayMs);
    signal.addEventListener('abort', aborted, { once: true });
  });
}

/** 从当前会话读取阶段，不能用旧的已完成回执覆盖仍在采集的当前会话。 */
function currentReceipt(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('无法确认采集状态，请重试。');
  const source = payload.current ?? payload.collectionSummary ?? (payload.phase ? payload : null);
  const summary = readCollectionSummary(source);
  if (source && !summary) throw new Error('无法确认采集状态，请重试。');
  if (!source && !Object.hasOwn(payload, 'current') && !Object.hasOwn(payload, 'collectionSummary')) {
    throw new Error('无法确认采集状态，请重试。');
  }
  return summary;
}

/** 退出前幂等停采并核对真实收尾回执，保留部分保存结果且允许再次尝试退出。 */
export async function finishCollectionBeforeExit({ signal, onSummary = () => {}, timeoutMs = 35000, pollMs = 150,
  stop = () => commandClient.execute('collection.control', { active: false }),
  readStatus = signal => requestJson('/api/collection/status', { signal }) } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason || new DOMException('退出已取消', 'AbortError'));
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('采集仍在保存或服务未响应，请稍后重试退出。')), timeoutMs);
  try {
    if (controller.signal.aborted) throw controller.signal.reason;
    // ⚠️ 旧宿主可能已发布中断回执但遗留采集开关，仍需明确停采才能解除系统切换锁。
    await abortable(stop(), controller.signal);
    while (true) {
      const payload = await abortable(readStatus(controller.signal), controller.signal);
      if (controller.signal.aborted) throw controller.signal.reason;
      const summary = currentReceipt(payload);
      if (summary) onSummary(summary);
      if (!summary || !['collecting', 'finalizing'].includes(summary.phase)) return summary;
      await waitForReceipt(pollMs, controller.signal);
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.abort();
  }
}
