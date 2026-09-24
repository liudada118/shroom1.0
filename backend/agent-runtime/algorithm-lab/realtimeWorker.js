const { parentPort, workerData } = require('node:worker_threads');
const { compile, predict } = require('./restrictedPython');
const { windowFeatures } = require('./evaluate');
const program = compile(workerData.source);
// 每个完整窗口使用离线测试的同一特征函数和受限解释器。
parentPort.on('message', ({ id, frames }) => {
  try { parentPort.postMessage({ id, metrics: { classIndex: predict(program, windowFeatures(frames), workerData.labels.length) } }); }
  catch { parentPort.postMessage({ id, error: '分类计算失败，请检查已保存算法与输入数据。' }); }
});
