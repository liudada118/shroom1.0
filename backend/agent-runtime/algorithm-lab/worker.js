const { parentPort, workerData } = require('node:worker_threads');
const { prepareWindows, summarize, evaluate } = require('./evaluate');
try {
  const prepared = prepareWindows(workerData.records, workerData.windowFrames);
  const result = workerData.source ? evaluate(prepared, workerData.source, workerData.labels, workerData.split) : summarize(prepared);
  parentPort.postMessage({ ok: true, result });
} catch (error) { parentPort.postMessage({ ok: false, message: String(error.message).slice(0, 500) }); }
