const path = require('node:path');
const { Worker } = require('node:worker_threads');
// 已选帧相隔超过两个目标间隔时，动作峰值可能已缺失，不组成分类窗口。
const MAX_SELECTED_GAP_FACTOR = 2;

/** 按测试间隔从真实帧选择采样，在独立线程运行与离线相同的特征函数。 */
function createRealtimeClassifier({ classifier }) {
  const worker = new Worker(path.join(__dirname, 'realtimeWorker.js'), { workerData: classifier, resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 } });
  const targetInterval = classifier.sampleIntervalMs;
  let frames = [], candidate = null, lastAccepted = null, nextTarget = null, lastTimestamp = null;
  let pending = null, requestId = 0, failure = null, closed = false;

  /** 清除旧窗口和在飞结果；回复使用请求 ID，恢复后的窗口不会收到旧结果。 */
  function reset(reason = Object.assign(new Error('分类输入已重新同步。'), { code: 'ALGORITHM_REALTIME_RECOVERING' })) {
    frames = []; candidate = null; lastAccepted = null; nextTarget = null;
    if (pending) { const task = pending; pending = null; clearTimeout(task.timer); task.reject(reason); }
  }

  /** 只有计算线程或输入契约发生不可恢复的错误时才停用。 */
  function fail(message) {
    failure = Object.assign(new Error(message), { code: 'ALGORITHM_REALTIME_FAILED' });
    reset(failure); void worker.terminate();
  }

  worker.on('error', () => fail('分类线程异常，请停用后重新启用。'));
  worker.on('exit', () => { if (!closed && !failure) fail('分类线程提前退出，请重新启用。'); });
  worker.on('message', (result) => {
    if (!pending || result.id !== pending.id) return;
    if (result.error) { fail(result.error); return; }
    const task = pending; pending = null; clearTimeout(task.timer); task.resolve(result);
  });

  /** 新时间段仅从当前真实帧开始，不能跨断点拼接一个分类窗口。 */
  function restart(frame, reason) {
    reset(); frames.push(frame); lastAccepted = frame; nextTarget = frame.timestamp + targetInterval;
    return { pending: true, buffered: 1, reason };
  }

  /** 限制已选帧间隔并验证完整窗口，超出时暂停等待新窗口。 */
  function accept(frame) {
    const gap = frame.timestamp - lastAccepted.timestamp;
    if (gap > targetInterval * MAX_SELECTED_GAP_FACTOR) {
      return restart(frame, `当前采样约 ${Math.round(1000 / gap)} Hz，算法参考 ${Math.round(1000 / targetInterval)} Hz；已暂停识别，输入恢复后自动继续。`);
    }
    frames.push(frame); lastAccepted = frame; nextTarget += targetInterval;
    while (nextTarget <= frame.timestamp) nextTarget += targetInterval;
    if (frames.length < classifier.windowFrames) return null;
    const interval = (frames.at(-1).timestamp - frames[0].timestamp) / (frames.length - 1);
    if (interval > targetInterval * 1.5 || interval < targetInterval * .5) {
      return restart(frame, `当前采样约 ${Math.round(1000 / interval)} Hz，算法参考 ${Math.round(1000 / targetInterval)} Hz；已暂停识别，输入恢复后自动继续。`);
    }
    if (pending) { fail('分类计算跟不上数据，已停止此算法；请减小输入规模。'); return Promise.reject(failure); }
    const window = frames; frames = [];
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      pending = { id, resolve, reject, timer: setTimeout(() => fail('分类计算超过 3 秒，已停止此算法。'), 3000) };
      worker.postMessage({ id, frames: window });
    });
  }

  /** 根据目标时间选最近的真实帧；不插值或复制拍打峰值。 */
  function run(values, context) {
    if (closed || failure) return Promise.reject(failure || new Error('分类已停止。'));
    const timestamp = context.timestamp;
    if (!Number.isFinite(timestamp) || !Array.isArray(values) || values.length !== classifier.pointCount || !values.every(Number.isFinite)) {
      fail('分类输入时间戳、点数或数值无效，请检查设备与线序后重新启用。'); return Promise.reject(failure);
    }
    const frame = { values: [...values], timestamp };
    const reason = context.resetReason || (lastTimestamp !== null && timestamp < lastTimestamp ? '数据时间戳倒序，正在重新积累分类窗口。'
      : lastTimestamp !== null && timestamp - lastTimestamp > 5000 ? '数据短时中断，正在重新积累分类窗口。' : '');
    if (reason) { lastTimestamp = timestamp; return Promise.resolve(restart(frame, reason)); }
    if (timestamp === lastTimestamp) return Promise.resolve({ pending: true, buffered: frames.length });
    lastTimestamp = timestamp;
    if (!lastAccepted) return Promise.resolve(restart(frame, ''));
    if (timestamp < nextTarget) { candidate = frame; return Promise.resolve({ pending: true, buffered: frames.length }); }
    let result;
    if (candidate && nextTarget - candidate.timestamp < timestamp - nextTarget) {
      result = accept(candidate); candidate = null;
      if (failure) return Promise.reject(failure);
      if (result?.reason) return Promise.resolve(result);
      if (timestamp < nextTarget) candidate = frame;
      else {
        const next = accept(frame);
        if (next?.reason) return Promise.resolve(next);
        result = result || next;
      }
    } else { candidate = null; result = accept(frame); }
    return result || Promise.resolve({ pending: true, buffered: frames.length });
  }

  /** 停用或切换系统时释放窗口与线程，未完成计算不能回写新实例。 */
  run.dispose = async () => { closed = true; reset(new Error('分类已停止。')); await worker.terminate(); };
  return run;
}

module.exports = { createRealtimeClassifier };
