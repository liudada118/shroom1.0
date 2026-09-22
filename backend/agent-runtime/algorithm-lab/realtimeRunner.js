const path = require('node:path');
const { Worker } = require('node:worker_threads');

/** 连续收集与离线相同的不重叠窗口，在独立线程执行分类；采集和页面线程不等待计算。 */
function createRealtimeClassifier({ classifier }) {
  const worker = new Worker(path.join(__dirname, 'realtimeWorker.js'), { workerData: classifier, resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 } });
  let frames = [], lastTimestamp = null, lastSample = null, pending = null, failure = null, closed = false;
  /** 故障后拒绝后续帧并丢弃窗口，避免跨断点拼接出看似可信的分类。 */
  function fail(message) {
    failure = Object.assign(new Error(message), { code: 'ALGORITHM_REALTIME_FAILED' }); frames = [];
    if (pending) { clearTimeout(pending.timer); pending.reject(failure); pending = null; }
    void worker.terminate();
  }
  worker.on('error', () => fail('分类线程异常，请停用后重新启用。'));
  worker.on('exit', () => { if (!closed && !failure) fail('分类线程提前退出，请重新启用。'); });
  worker.on('message', (result) => {
    if (!pending) return;
    if (result.error) { fail(result.error); return; }
    const task = pending; pending = null; clearTimeout(task.timer); task.resolve(result);
  });
  /** 依据采集时平均帧间隔取样；完整窗口仍使用真实时间戳计算速率，不补帧。 */
  function run(values, context) {
    if (closed || failure) return Promise.reject(failure || new Error('分类已停止。'));
    const timestamp = context.timestamp;
    if (!Number.isFinite(timestamp) || (lastTimestamp !== null && (timestamp <= lastTimestamp || timestamp - lastTimestamp > 5000))
      || !Array.isArray(values) || values.length !== classifier.pointCount || !values.every(Number.isFinite)) {
      fail('分类输入不连续或点数发生变化，请重新启用。'); return Promise.reject(failure);
    }
    lastTimestamp = timestamp;
    if (lastSample !== null && timestamp - lastSample < classifier.sampleIntervalMs * .8) return Promise.resolve({ pending: true, buffered: frames.length });
    lastSample = timestamp;
    frames.push({ values: [...values], timestamp });
    if (frames.length < classifier.windowFrames) return Promise.resolve({ pending: true, buffered: frames.length });
    const interval = (frames.at(-1).timestamp - frames[0].timestamp) / (frames.length - 1);
    if (interval > classifier.sampleIntervalMs * 1.5 || interval < classifier.sampleIntervalMs * .5) {
      fail('实时采样频率与测试数据不匹配，请按当前频率重新测试算法。'); return Promise.reject(failure);
    }
    if (pending) { fail('分类计算跟不上数据，已停止此算法；请减小输入规模。'); return Promise.reject(failure); }
    const window = frames; frames = [];
    return new Promise((resolve, reject) => {
      pending = { resolve, reject, timer: setTimeout(() => fail('分类计算超过 3 秒，已停止此算法。'), 3000) };
      worker.postMessage(window);
    });
  }
  /** 停用或切换系统时释放窗口与线程，未完成计算不能回写新实例。 */
  run.dispose = async () => { closed = true; frames = []; if (pending) { clearTimeout(pending.timer); pending.reject(new Error('分类已停止。')); pending = null; } await worker.terminate(); };
  return run;
}

module.exports = { createRealtimeClassifier };
