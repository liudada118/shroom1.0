// pyWorker.js
// Python algorithm bridge for on-bed processing.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function resolveIsPackaged() {
  if (process.env.isPackaged === 'true') return true;
  if (process.env.isPackaged === 'false') return false;

  if (process.versions.electron) {
    try {
      const { app } = require('electron');
      if (typeof app?.isPackaged === 'boolean') return app.isPackaged;
    } catch {}
  }

  return false;
}

function pickExistingPath(candidates) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const isPackaged = resolveIsPackaged();

function pythonBin() {
  const isDev = !isPackaged;

  if (isDev) {
    if (process.platform === 'win32') {
      const localPy = path.join(__dirname, 'python', 'Python311', 'python.exe');
      if (fs.existsSync(localPy)) return localPy;
      return 'python';
    }

    const localPy = path.join(__dirname, 'python', 'venv', 'bin', 'python');
    if (fs.existsSync(localPy)) return localPy;
    return 'python3';
  }

  if (process.platform === 'win32') {
    const bundledWin = pickExistingPath([
      path.join(process.resourcesPath, 'python', 'onbed_server.exe'),
      path.join(process.resourcesPath, 'python', 'dist', 'onbed_server', 'onbed_server.exe'),
      path.join(process.resourcesPath, 'python', 'Python311', 'python.exe'),
    ]);
    return bundledWin || 'python';
  }

  const bundledUnix = pickExistingPath([
    path.join(process.resourcesPath, 'python', 'onbed_server'),
    path.join(process.resourcesPath, 'python', 'dist', 'onbed_server', 'onbed_server'),
    path.join(process.resourcesPath, 'python', 'venv', 'bin', 'python'),
  ]);
  return bundledUnix || 'python3';
}

function serverPy() {
  const isDev = !isPackaged;
  return isDev
    ? path.join(__dirname, 'python', 'app', 'onbed_filter_example.py')
    : path.join(process.resourcesPath, 'python', 'app', 'onbed_filter_example.py');
}

function isPyInstallerExe() {
  if (!isPackaged) return false;

  const candidates = process.platform === 'win32'
    ? [
        path.join(process.resourcesPath, 'python', 'onbed_server.exe'),
        path.join(process.resourcesPath, 'python', 'dist', 'onbed_server', 'onbed_server.exe'),
      ]
    : [
        path.join(process.resourcesPath, 'python', 'onbed_server'),
        path.join(process.resourcesPath, 'python', 'dist', 'onbed_server', 'onbed_server'),
      ];

  return Boolean(pickExistingPath(candidates));
}

let child = null;
let buf = '';
const pending = new Map();
let nextId = 1;
let starting = false;
let stderrTail = '';

function pushErr(s) {
  stderrTail = (stderrTail + s).slice(-4000);
}

function rejectAllPending(error) {
  for (const [, rec] of pending) {
    clearTimeout(rec.timer);
    rec.reject(error);
  }
  pending.clear();
}

function startWorker() {
  if (child || starting) return;
  starting = true;

  const py = pythonBin();
  const useExe = isPyInstallerExe();
  const args = useExe ? [] : ['-u', serverPy()];

  console.log('[PY] start:', py, args.join(' '));
  if (path.isAbsolute(py) && !fs.existsSync(py)) console.error('[PY] pythonBin NOT FOUND:', py);
  if (!useExe && !fs.existsSync(serverPy())) console.error('[PY] serverPy NOT FOUND:', serverPy());

  child = spawn(py, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONNOUSERSITE: '1' },
    windowsHide: true,
  });
  starting = false;
  buf = '';
  stderrTail = '';

  child.stdout.on('data', (d) => {
    buf += d.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        console.error('[PY] bad JSON line:', line);
        continue;
      }

      const rec = pending.get(msg.id);
      if (!rec) continue;

      clearTimeout(rec.timer);
      pending.delete(msg.id);

      if (msg.ok === false) {
        const detail = msg.trace
          ? `${msg.error || 'python worker error'}\n${msg.trace}`
          : (msg.error || 'python worker error');
        rec.reject(new Error(detail));
      } else {
        rec.resolve(msg.data);
      }
    }
  });

  child.stderr.on('data', (d) => {
    const s = d.toString();
    pushErr(s);
    console.error('[PY:stderr]', s.trim());
  });

  child.on('error', (err) => {
    console.error(`[PY] worker ERROR: ${err.message}`);
    rejectAllPending(err);
    child = null;
  });

  child.on('exit', (code, sig) => {
    console.error(`[PY] worker EXIT code=${code} sig=${sig}\n[PY] stderr tail:\n${stderrTail}`);
    rejectAllPending(new Error(`python worker exited (code=${code} sig=${sig})`));
    child = null;
    setTimeout(startWorker, 500);
  });

  callPy('ping', {}, { timeoutMs: 10000 })
    .then(() => console.log('[PY] ready'))
    .catch((e) => console.error('[PY] handshake failed:', e.message));
}

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
      try {
        child?.stdin.write(JSON.stringify({ id, fn: '_cancel' }) + '\n');
      } catch {}
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

function stopWorker() {
  if (child) {
    child.kill();
    child = null;
  }
}

module.exports = { startWorker, callPy, stopWorker };
