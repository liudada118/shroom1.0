const assert = require('assert');

const {
  createServerShutdownOrchestrator,
} = require('../../kernel/platform/bootstrap/serverShutdownOrchestrator');

let closeAllCount = 0;
let reconnectStopCount = 0;
let wsCloseCount = 0;
let playbackStopCount = 0;
let workerStopCount = 0;
const runtime = {
  server: {
    clients: new Set(),
    /**
     * 假的 WebSocket server 关闭：计数后**立刻同步回调**。
     *
     * 真实的 `close` 是异步的，这里同步回调是为了让关闭流程一次跑完、无需等待。
     * `wsCloseCount` 用来断言只关一次 —— 重复关闭真实实现会报
     * 「server is not running」，把关闭流程整体带成失败。
     *
     * @param {Function} callback 关闭完成回调。
     */
    close(callback) {
      wsCloseCount += 1;
      callback();
    },
  },
  serverOpened: true,
  serverShutdownPromise: null,
  serverShutdownRequested: false,
};

const orchestrator = createServerShutdownOrchestrator({
  getRuntime: () => runtime,
  logger: {
    info: () => {},
    warn: () => {},
  },
  serialManager: {
    closeAll: async () => { closeAllCount += 1; },
    stopReconnectLoop: () => { reconnectStopCount += 1; },
  },
  setRuntime: (patch) => Object.assign(runtime, patch),
  stopPlaybackTimer: () => { playbackStopCount += 1; },
  stopWorker: () => { workerStopCount += 1; },
});

(async () => {
  const firstShutdown = orchestrator.shutdownServer();
  const secondShutdown = orchestrator.shutdownServer();
  assert.strictEqual(firstShutdown, secondShutdown);
  await firstShutdown;

  assert.strictEqual(wsCloseCount, 1);
  assert.strictEqual(closeAllCount, 1);
  assert.strictEqual(reconnectStopCount, 1);
  assert.strictEqual(playbackStopCount, 1);
  assert.strictEqual(workerStopCount, 1);
  assert.strictEqual(runtime.serverOpened, false);

  console.log('serverShutdownOrchestrator.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
