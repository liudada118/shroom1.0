const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const { PassThrough, Writable } = require('stream');

const filename = path.resolve(__dirname, '../../kernel/algorithm-channel/pythonWorker.js');
const source = fs.readFileSync(filename, 'utf8');

/** 让真实 Writable 的异步写回调、error 和 Promise 回调执行完。 */
async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

/** 用真实 Node 流注入断管故障，不启动 Python 或操作设备。 */
function createHarness() {
  const workers = [], timers = new Map(), logs = [];
  let nextTimer = 0;
  const module = { exports: {} };

  /** 伪进程只替代 spawn；数据流及错误派发使用 Node Writable。 */
  function spawnWorker() {
    const worker = new EventEmitter();
    worker.stdout = new PassThrough();
    worker.stderr = new PassThrough();
    worker.mode = 'normal';
    worker.lines = [];
    worker.killCount = 0;
    worker.kill = () => { worker.killed = true; worker.killCount += 1; };
    worker.stdin = new Writable({
      highWaterMark: 1,
      write(chunk, encoding, callback) {
        const request = JSON.parse(chunk.toString());
        worker.lines.push(request);
        if (worker.mode === 'hold' && request.fn !== 'ping') return;
        setImmediate(() => {
          if (worker.mode === 'epipe' || (worker.mode === 'cancel-error' && request.fn === '_cancel')) {
            callback(Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));
            return;
          }
          callback();
          if (request.fn === 'ping' || request.fn === 'echo') {
            worker.stdout.write(JSON.stringify({ id: request.id, ok: true, data: request.args }) + '\n');
          }
        });
      },
    });
    workers.push(worker);
    return worker;
  }

  vm.runInNewContext(source + `
    pythonLaunchTarget = () => ({ command: 'test-worker', useExe: true, args: [] });
    pythonRuntimeEnv = () => ({});
    isPackagedApp = () => false;
    module.exports.inspect = () => ({ child, pending: pending.size, writes: pendingWrites.size, manualStop });
  `, {
    module, __dirname: path.dirname(filename), process,
    require: (name) => {
      if (name === 'child_process') return { spawn: spawnWorker };
      if (name === 'electron') return {};
      return require(name);
    },
    console: { log: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
  }, { filename });

  return {
    api: module.exports, workers, timers, logs,
    fire(delay) {
      for (const [id, timer] of [...timers]) {
        if (timer.delay === delay) { timers.delete(id); timer.callback(); }
      }
    },
  };
}

/** 覆盖断管、停止、超时取消以及旧进程事件与重启的竞态。 */
async function run() {
  const broken = createHarness();
  broken.api.startWorker();
  await flush();
  broken.workers[0].mode = 'epipe';
  const failure = broken.api.callPy('calculate', {}).catch((error) => error);
  await flush();
  assert.match((await failure).message, /EPIPE/);
  assert.strictEqual(broken.api.inspect().pending, 0);
  assert.strictEqual(broken.api.inspect().writes, 0);
  assert(broken.logs.some((line) => String(line[0]).includes('stdin ERROR: EPIPE')));
  const queuedRestart = [...broken.timers.values()].find((timer) => timer.delay === 500);
  assert(queuedRestart);
  broken.api.stopWorker();
  queuedRestart.callback(); // 模拟 clearTimeout 前已经开始派发的回调。
  assert.strictEqual(broken.workers.length, 1);
  await assert.rejects(broken.api.callPy('echo', {}), /worker stopped/);
  assert.strictEqual(broken.timers.size, 0);

  const stopped = createHarness();
  stopped.api.startWorker();
  await flush();
  const old = stopped.workers[0];
  old.mode = 'hold';
  const inflight = stopped.api.callPy('calculate', {}, { timeoutMs: 10 }).catch((error) => error);
  stopped.api.stopWorker();
  stopped.api.stopWorker();
  assert.match((await inflight).message, /worker stopped/);
  assert.strictEqual(old.killCount, 1);
  assert.strictEqual(stopped.api.inspect().pending, 0);
  assert.strictEqual(stopped.api.inspect().writes, 0);
  assert.strictEqual(old.stdin.listenerCount('drain'), 0);
  stopped.fire(10);
  assert(!old.lines.some((line) => line.fn === '_cancel'));
  assert.doesNotThrow(() => old.stdin.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' })));

  stopped.api.startWorker(); // 显式恢复允许；旧 exit 不能清掉新 child。
  const current = stopped.workers[1];
  const result = stopped.api.callPy('echo', { alive: true });
  old.emit('exit', 1, 'SIGTERM');
  old.emit('error', new Error('late old process error'));
  await flush();
  assert.strictEqual(JSON.stringify(await result), JSON.stringify({ alive: true }));
  assert.strictEqual(stopped.api.inspect().child, current);
  assert.strictEqual(stopped.api.inspect().pending, 0);
  stopped.api.stopWorker();

  const timeout = createHarness();
  timeout.api.startWorker();
  await flush();
  timeout.workers[0].mode = 'cancel-error';
  const expired = timeout.api.callPy('slow', {}, { timeoutMs: 10 }).catch((error) => error);
  await flush();
  timeout.fire(10);
  assert.match((await expired).message, /Timeout 10ms/);
  await flush();
  assert(timeout.workers[0].lines.some((line) => line.fn === '_cancel'));
  assert.strictEqual(timeout.api.inspect().pending, 0);
  assert.strictEqual(timeout.api.inspect().writes, 0);
  timeout.api.stopWorker();

  const closed = createHarness();
  closed.api.startWorker();
  await flush();
  closed.workers[0].mode = 'hold';
  const waiting = closed.api.callPy('slow', {}).catch((error) => error);
  closed.workers[0].stdin.destroy(); // 无 error 的 close 也必须结束请求。
  await flush();
  assert.match((await waiting).message, /stdin closed/);
  assert.strictEqual(closed.api.inspect().writes, 0);
  closed.api.stopWorker();
  console.log('pythonWorkerLifecycle.test.js passed');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
