const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { trainCpuClassifier, trainingTargets } = require('../../agent-runtime/algorithm-lab/cpuTrainingProcess');

/** 模拟固定训练进程的流和退出事件，检查宿主资源与取消边界。 */
function fixture(onInput) {
  let child, invocation, killed = 0;
  return {
    spawn(command, args, options) {
      invocation = { command, args, options };
      child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill() { killed++; } });
      child.stdin.on('finish', () => setImmediate(() => onInput?.(child)));
      return child;
    },
    get child() { return child; }, get invocation() { return invocation; }, get killed() { return killed; },
  };
}

/** 训练不接受模型提供的执行路径，错误与取消不会泄露 stderr 或继续保存结果。 */
async function main() {
  const targets = [{ command: 'trusted-runtime', args: ['--train-classifier'] }];
  const success = fixture((child) => { child.stdout.write(JSON.stringify({ ok: true, result: { model: { schemaVersion: 1 } } })); child.emit('close', 0); });
  const result = await trainCpuClassifier({ schemaVersion: 1 }, { targets, spawnImpl: success.spawn });
  assert.equal(result.model.schemaVersion, 1);
  assert.equal(success.invocation.options.windowsHide, true);
  assert.equal(success.invocation.options.env.OMP_NUM_THREADS, '1');
  assert.equal(success.invocation.options.env.CUDA_VISIBLE_DEVICES, '-1');
  assert.deepEqual(success.invocation.args, ['--train-classifier']);
  assert.throws(() => trainingTargets({ packaged: true, resourcesPath: 'missing-runtime-fixture' }), { code: 'CPU_TRAINING_UNAVAILABLE' });
  const invalid = fixture((child) => { child.stderr.write('private/file/api-key'); child.stdout.write('<!doctype html>'); child.emit('close', 1); });
  await assert.rejects(trainCpuClassifier({}, { targets, spawnImpl: invalid.spawn }), (error) => error.code === 'CPU_TRAINING_FAILED' && !error.message.includes('private'));
  const oversized = fixture((child) => { child.stdout.write(Buffer.alloc(3 * 1024 * 1024 + 1)); child.emit('close', 0); });
  await assert.rejects(trainCpuClassifier({}, { targets, spawnImpl: oversized.spawn }), { code: 'CPU_TRAINING_OUTPUT_LIMIT' });
  assert.equal(oversized.killed, 1);
  await assert.rejects(trainCpuClassifier({ large: 'x'.repeat(8 * 1024 * 1024) }, { targets, spawnImpl: success.spawn }), { code: 'CPU_TRAINING_INPUT_LIMIT' });
  const controller = new AbortController(), waiting = fixture();
  const pending = trainCpuClassifier({}, { signal: controller.signal, targets, spawnImpl: waiting.spawn });
  controller.abort();
  await assert.rejects(pending, { code: 'AGENT_CANCELLED' });
  assert.equal(waiting.killed, 1);
  waiting.child.stdout.write(JSON.stringify({ ok: true, result: { unexpected: true } })); waiting.child.emit('close', 0);
  const timeout = fixture();
  await assert.rejects(trainCpuClassifier({}, { targets, spawnImpl: timeout.spawn, timeoutMs: 10 }), { code: 'CPU_TRAINING_TIMEOUT' });
  assert.equal(timeout.killed, 1);
  console.log('PASS CPU training process: fixed entry, CPU limits, bounded IO, cancellation, timeout and packaged fallback');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
