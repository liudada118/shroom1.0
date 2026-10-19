const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { agentError } = require('../errors');

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 3 * 1024 * 1024;

/** 只定位随软件交付的训练器；安装版缺少资源时不能转用客户电脑的 Python。 */
function trainingTargets({ resourcesPath = process.resourcesPath, packaged = process.env.isPackaged === 'true' || __dirname.includes('app.asar'), projectRoot = path.resolve(__dirname, '../../..') } = {}) {
  if (packaged) {
    const filename = process.platform === 'win32' ? 'onbed_server.exe' : 'onbed_server';
    const roots = [resourcesPath && path.join(resourcesPath, 'python'), resourcesPath && path.join(resourcesPath, 'app.asar.unpacked', 'python')].filter(Boolean);
    const executable = roots.flatMap((root) => [path.join(root, filename), path.join(root, 'onbed_server', filename)]).find((file) => { try { return fs.statSync(file).isFile(); } catch { return false; } });
    if (!executable) throw agentError('CPU_TRAINING_UNAVAILABLE', '安装包缺少 CPU 训练组件，请更新完整软件。');
    return [{ command: executable, args: ['--train-classifier'] }];
  }
  const script = path.join(projectRoot, 'python', 'app', 'cpu_classifier_training.py');
  if (!fs.existsSync(script)) throw agentError('CPU_TRAINING_UNAVAILABLE', '本机训练组件尚未就绪，请更新软件。');
  const candidates = [];
  if (process.env.PYTHON_FOR_RUNTIME) candidates.push({ command: process.env.PYTHON_FOR_RUNTIME, args: [script] });
  const local = path.join(projectRoot, 'python', 'Python311', process.platform === 'win32' ? 'python.exe' : 'bin/python3.11');
  if (fs.existsSync(local)) candidates.push({ command: local, args: [script] });
  candidates.push(process.platform === 'win32' ? { command: 'py', args: ['-3.11', script] } : { command: 'python3.11', args: [script] });
  return candidates;
}

/** 在独立 CPU 子进程执行固定训练入口，取消、超时和输出超限都会终止进程。 */
async function trainCpuClassifier(payload, { signal, timeoutMs = 60000, spawnImpl = spawn, targets = trainingTargets() } = {}) {
  const input = JSON.stringify(payload);
  if (Buffer.byteLength(input) > MAX_INPUT_BYTES) throw agentError('CPU_TRAINING_INPUT_LIMIT', '训练特征超过本次容量，请减少所选数据。');
  if (signal?.aborted) throw agentError('AGENT_CANCELLED', '已停止本机训练。');
  /** 一个候选只启动一次，模型内容不能改变可执行路径或命令参数。 */
  const run = (target) => new Promise((resolve, reject) => {
    let child, ended = false, stdoutSize = 0, stderrSize = 0;
    const chunks = [];
    /** 收拢所有退出路径，避免迟到结果继续保存算法。 */
    const finish = (error, value) => {
      if (ended) return;
      ended = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      child?.stdin?.destroy(); if (error) child?.kill();
      if (error) reject(error); else resolve(value);
    };
    /** 用户停止时关闭本次训练，不影响串口和实时算法进程。 */
    const abort = () => finish(agentError('AGENT_CANCELLED', '已停止本机训练。'));
    const timer = setTimeout(() => finish(agentError('CPU_TRAINING_TIMEOUT', '本机训练超过 60 秒，已停止；请减少所选数据后重试。')), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      child = spawnImpl(target.command, target.args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PYTHONPATH: '', PYTHONHOME: '', PYTHONUTF8: '1', CUDA_VISIBLE_DEVICES: '-1', OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', MKL_NUM_THREADS: '1', NUMEXPR_NUM_THREADS: '1' } });
    } catch (error) { finish(error); return; }
    child.on('error', (error) => finish(error.code === 'ENOENT' ? error : agentError('CPU_TRAINING_UNAVAILABLE', '无法启动 CPU 训练组件，请检查软件安装。')));
    child.stdout.on('data', (chunk) => {
      stdoutSize += chunk.length;
      if (stdoutSize > MAX_OUTPUT_BYTES) { finish(agentError('CPU_TRAINING_OUTPUT_LIMIT', '训练结果超过容量，已停止。')); return; }
      chunks.push(Buffer.from(chunk));
    });
    child.stderr.on('data', (chunk) => { stderrSize += chunk.length; if (stderrSize > 65536) finish(agentError('CPU_TRAINING_FAILED', '训练组件异常，已停止。')); });
    child.stdin.on('error', () => finish(agentError('CPU_TRAINING_FAILED', '训练组件未能接收数据，请重试。')));
    child.on('close', (code) => {
      if (ended) return;
      let result;
      try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { finish(agentError('CPU_TRAINING_FAILED', '训练组件未返回有效结果；开发环境请安装 python/requirements.txt 中的依赖。')); return; }
      if (code !== 0 || result?.ok !== true || !result.result) {
        const allowed = ['CPU_TRAINING_DATA_INVALID', 'CPU_TRAINING_UNAVAILABLE', 'CPU_TRAINING_MODEL_LIMIT'];
        const errorCode = allowed.includes(result?.error?.code) ? result.error.code : 'CPU_TRAINING_FAILED';
        finish(agentError(errorCode, errorCode === 'CPU_TRAINING_UNAVAILABLE' ? 'CPU 训练依赖不可用；请更新完整软件，开发环境需安装 python/requirements.txt。' : '所选数据暂时无法完成训练，请检查类别、连续帧和独立采集数量。')); return;
      }
      finish(null, result.result);
    });
    if (signal?.aborted) { abort(); return; }
    child.stdin.end(input);
  });
  for (const target of targets) {
    try { return await run(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  throw agentError('CPU_TRAINING_UNAVAILABLE', '找不到兼容的 CPU 训练组件，请更新完整软件。');
}

module.exports = { trainCpuClassifier, trainingTargets };
