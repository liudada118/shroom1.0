// pyWorker.js
// 健康监测 Python 算法桥接模块
// 开发阶段：调用系统 Python + 源文件
// 打包阶段：调用 PyInstaller 生成的可执行文件
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let isPackaged = process.env.isPackaged;
isPackaged = isPackaged === 'true';

/**
 * 获取 Python 可执行文件路径
 * 开发模式：使用项目内的 Python 环境或系统 Python
 * 打包模式：使用 PyInstaller 生成的可执行文件
 */
function pythonBin() {
  const isDev = !isPackaged;

  if (isDev) {
    // 开发模式：优先使用项目内 Python，否则使用系统 Python
    if (process.platform === 'win32') {
      const localPy = path.join(__dirname, 'python', 'Python311', 'python.exe');
      if (fs.existsSync(localPy)) return localPy;
      return 'python'; // 回退到系统 Python
    }
    const localPy = path.join(__dirname, 'python', 'venv', 'bin', 'python');
    if (fs.existsSync(localPy)) return localPy;
    return 'python3'; // 回退到系统 Python
  }

  // 打包模式：使用 PyInstaller 生成的可执行文件
  if (process.platform === 'win32') {
    const pyExe = path.join(process.resourcesPath, 'python', 'onbed_server.exe');
    if (fs.existsSync(pyExe)) return pyExe;
    // 回退到 Python 解释器
    return path.join(process.resourcesPath, 'python', 'Python311', 'python.exe');
  }
  const pyExe = path.join(process.resourcesPath, 'python', 'onbed_server');
  if (fs.existsSync(pyExe)) return pyExe;
  return path.join(process.resourcesPath, 'python', 'venv', 'bin', 'python');
}

/**
 * 获取 Python 脚本路径（仅开发模式或回退时使用）
 */
function serverPy() {
  const isDev = !isPackaged;
  return isDev
    ? path.join(__dirname, 'python', 'app', 'onbed_filter_example.py')
    : path.join(process.resourcesPath, 'python', 'app', 'onbed_filter_example.py');
}

/**
 * 判断是否使用 PyInstaller 打包的可执行文件（无需传脚本参数）
 */
function isPyInstallerExe() {
  if (!isPackaged) return false;
  const exeName = process.platform === 'win32' ? 'onbed_server.exe' : 'onbed_server';
  return fs.existsSync(path.join(process.resourcesPath, 'python', exeName));
}

let child = null;
let buf = '';
const pending = new Map(); // id -> {resolve, reject, timer}
let nextId = 1;
let starting = false;

// 保留 stderr 尾部，便于定位异常
let stderrTail = '';
function pushErr(s) { stderrTail = (stderrTail + s).slice(-4000); }

function startWorker() {
  if (child || starting) return;
  starting = true;

  const py = pythonBin();
  const useExe = isPyInstallerExe();
  const args = useExe ? [] : ['-u', serverPy()];

  console.log('[PY] start:', py, args.join(' '));
  if (!fs.existsSync(py)) console.error('[PY] pythonBin NOT FOUND:', py);
  if (!useExe && !fs.existsSync(serverPy())) console.error('[PY] serverPy NOT FOUND:', serverPy());

  child = spawn(py, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONNOUSERSITE: '1' },
    windowsHide: true
  });
  starting = false;
  buf = '';
  stderrTail = '';

  child.stdout.on('data', (d) => {
    buf += d.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() || ''; // 剩下半行，等待下一次拼接

    for (const line of lines) {
      if (!line.trim()) continue;
      let msg;
      try { msg = JSON.parse(line); }
      catch { console.error('[PY] bad JSON line:', line); continue; }
      const rec = pending.get(msg.id);
      if (!rec) continue;
      clearTimeout(rec.timer);
      pending.delete(msg.id);
      if (msg.ok === false) { /* 错误时不 reject，避免崩溃 */ }
      else rec.resolve(msg.data);
    }
  });

  child.stderr.on('data', (d) => {
    const s = d.toString();
    pushErr(s);
    console.error('[PY:stderr]', s.trim());
  });

  child.on('exit', (code, sig) => {
    console.error(`[PY] worker EXIT code=${code} sig=${sig}\n[PY] stderr tail:\n${stderrTail}`);
    for (const [id, rec] of pending) {
      clearTimeout(rec.timer);
      rec.reject(new Error(`python worker exited (code=${code} sig=${sig})`));
    }
    pending.clear();
    child = null;
    setTimeout(startWorker, 500); // 自动重启
  });

  // 握手：确认常驻 OK
  callPy('ping', {}, { timeoutMs: 10000 })
    .then(() => console.log('[PY] ready'))
    .catch(e => console.error('[PY] handshake failed:', e.message));
}

// 反压写：write 返回 false 就等 'drain'
function writeLine(line) {
  return new Promise((resolve, reject) => {
    if (!child || !child.stdin) return reject(new Error('worker not running'));
    const ok = child.stdin.write(line);
    if (ok) return resolve(true);
    child.stdin.once('drain', resolve);
  });
}

function callPy(fn, args, { timeoutMs = 10000 } = {}) {
  if (!child) startWorker();
  const id = nextId++;
  return new Promise(async (resolve, reject) => {
    const rec = { resolve, reject };
    rec.timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout ${timeoutMs}ms`));
      try { child?.stdin.write(JSON.stringify({ id, fn: '_cancel' }) + '\n'); } catch {}
    }, timeoutMs);
    pending.set(id, rec);
    try {
      await writeLine(JSON.stringify({ id, fn, args }) + '\n');
    } catch (e) {
      clearTimeout(rec.timer);
      pending.delete(id);
      reject(new Error('stdin write failed: ' + e.message));
    }
  });
}

/**
 * 停止 Python worker 进程
 */
function stopWorker() {
  if (child) {
    child.kill();
    child = null;
  }
}

module.exports = { startWorker, callPy, stopWorker };
