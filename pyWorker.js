// pyWorker.js
// Python algorithm bridge for on-bed processing.
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

let electronApp = null;
try {
  ({ app: electronApp } = require('electron'));
} catch {}

function isPackagedApp() {
  if (process.env.isPackaged === 'true') return true;
  if (process.env.isPackaged === 'false') return false;

  if (electronApp && typeof electronApp.isPackaged === 'boolean') {
    return electronApp.isPackaged;
  }

  return false;
}

function existingFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function existingDir(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function packagedPythonRoots() {
  if (!isPackagedApp()) return [];

  return unique([
    process.resourcesPath ? path.join(process.resourcesPath, 'python') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'python') : null,
  ]);
}

function devPythonRoot() {
  return path.join(__dirname, 'python');
}

function executableName() {
  return process.platform === 'win32' ? 'onbed_server.exe' : 'onbed_server';
}

function resolvePackagedExe() {
  const exeName = executableName();
  const candidates = [];

  for (const root of packagedPythonRoots()) {
    candidates.push(path.join(root, exeName));
    candidates.push(path.join(root, 'onbed_server', exeName));
    candidates.push(path.join(root, 'dist', 'onbed_server', exeName));
  }

  return candidates.find(existingFile) || null;
}

function latestMtime(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return stat.mtimeMs;
  }

  let latest = stat.mtimeMs;
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    latest = Math.max(latest, latestMtime(path.join(targetPath, entry.name)));
  }
  return latest;
}

function resolveFreshDevExe() {
  if (isPackagedApp()) return null;

  const runtimeDir = path.join(devPythonRoot(), 'dist', 'onbed_server');
  const runtimeExe = path.join(runtimeDir, executableName());
  if (!existingFile(runtimeExe)) {
    return null;
  }

  const sourceStamp = Math.max(
    latestMtime(path.join(devPythonRoot(), 'app')),
    latestMtime(path.join(devPythonRoot(), 'build_exe.py')),
    latestMtime(path.join(devPythonRoot(), 'requirements.txt'))
  );

  return latestMtime(runtimeDir) >= sourceStamp ? runtimeExe : null;
}

function resolveServerPy() {
  const candidates = isPackagedApp()
    ? packagedPythonRoots().map((root) => path.join(root, 'app', 'onbed_filter_example.py'))
    : [path.join(devPythonRoot(), 'app', 'onbed_filter_example.py')];

  return candidates.find(existingFile) || null;
}

function serverPy() {
  return resolveServerPy();
}

function pathCommandCandidates(command) {
  if (process.platform === 'win32') return [];

  const result = spawnSync('which', ['-a', command], {
    encoding: 'utf8',
  });

  if (result.error || result.status !== 0) {
    return [];
  }

  return unique((result.stdout || '').split(/\r?\n/));
}

function condaPython311Candidates() {
  if (process.platform === 'win32') return [];

  const home = os.homedir();
  const candidates = [];
  const baseRoots = unique([
    process.env.CONDA_PREFIX || null,
    '/opt/miniconda3',
    path.join(home, 'miniconda3'),
    '/opt/anaconda3',
    path.join(home, 'anaconda3'),
  ]);
  const envRoots = unique([
    process.env.CONDA_PREFIX ? path.join(process.env.CONDA_PREFIX, '..') : null,
    '/opt/miniconda3/envs',
    path.join(home, 'miniconda3', 'envs'),
    '/opt/anaconda3/envs',
    path.join(home, 'anaconda3', 'envs'),
  ]);

  for (const root of baseRoots) {
    if (existingDir(root)) {
      candidates.push(path.join(root, 'bin', 'python3.11'));
    }
  }

  for (const envRoot of envRoots) {
    if (!existingDir(envRoot)) continue;
    try {
      for (const entry of fs.readdirSync(envRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        candidates.push(path.join(envRoot, entry.name, 'bin', 'python3.11'));
      }
    } catch {}
  }

  return unique(candidates.filter(existingFile));
}

function pythonInterpreterCandidates() {
  const candidates = [];

  if (process.env.PYTHON_FOR_RUNTIME) {
    candidates.push({
      command: process.env.PYTHON_FOR_RUNTIME,
      args: [],
      label: process.env.PYTHON_FOR_RUNTIME,
    });
  }

  if (!isPackagedApp()) {
    if (process.platform === 'win32') {
      const localPy = path.join(devPythonRoot(), 'Python311', 'python.exe');
      candidates.push(
        { command: localPy, args: [], label: localPy },
        { command: 'py', args: ['-3.11'], label: 'py -3.11' },
        { command: 'python', args: [], label: 'python' }
      );
      return candidates;
    }

    const localPyCandidates = [
      path.join(devPythonRoot(), 'venv', 'bin', 'python3.11'),
      path.join(devPythonRoot(), 'venv', 'bin', 'python3'),
      path.join(devPythonRoot(), 'venv', 'bin', 'python'),
      ...pathCommandCandidates('python3.11'),
      ...condaPython311Candidates(),
      'python3.11',
      'python3',
      'python',
    ];

    for (const candidate of unique(localPyCandidates)) {
      candidates.push({ command: candidate, args: [], label: candidate });
    }
    return candidates;
  }

  for (const root of packagedPythonRoots()) {
    if (process.platform === 'win32') {
      candidates.push(
        { command: path.join(root, 'Python311', 'python.exe'), args: [], label: path.join(root, 'Python311', 'python.exe') },
        { command: path.join(root, 'venv', 'Scripts', 'python.exe'), args: [], label: path.join(root, 'venv', 'Scripts', 'python.exe') }
      );
      continue;
    }

    const pyExeCandidates = [
      path.join(root, 'venv', 'bin', 'python3.11'),
      path.join(root, 'venv', 'bin', 'python3'),
      path.join(root, 'venv', 'bin', 'python'),
    ];

    for (const candidate of pyExeCandidates) {
      candidates.push({ command: candidate, args: [], label: candidate });
    }
  }

  return candidates;
}

function probePythonInterpreter(candidate, serverScript) {
  const probeCode = [
    'import sys',
    "assert sys.version_info[:2] == (3, 11), f'Expected Python 3.11, got {sys.version.split()[0]}'",
    'import numpy',
    serverScript ? `sys.path.insert(0, ${JSON.stringify(path.dirname(serverScript))})` : '',
    serverScript ? 'import onbed_filter_example' : '',
    'print(sys.executable)',
  ].filter(Boolean).join('; ');

  const result = spawnSync(
    candidate.command,
    [...candidate.args, '-c', probeCode],
    {
      cwd: serverScript ? path.dirname(serverScript) : process.cwd(),
      env: pythonRuntimeEnv(),
      encoding: 'utf8',
    }
  );

  if (result.error) {
    return { ok: false, reason: result.error.message };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      reason: (result.stderr || result.stdout || `exit ${result.status}`).trim(),
    };
  }

  return {
    ok: true,
    executable: (result.stdout || '').trim().split(/\r?\n/).pop(),
  };
}

let resolvedLaunchTarget = null;

function resolvePythonLaunchTarget() {
  const serverScript = serverPy();

  if (!isPackagedApp()) {
    const devExe = resolveFreshDevExe();
    if (devExe) {
      return {
        command: devExe,
        args: [],
        label: devExe,
        serverScript: null,
        useExe: true,
      };
    }
  }

  const packagedExe = resolvePackagedExe();
  if (packagedExe) {
    return {
      command: packagedExe,
      args: [],
      label: packagedExe,
      serverScript: null,
      useExe: true,
    };
  }

  if (!serverScript) {
    return null;
  }

  const failures = [];
  for (const candidate of pythonInterpreterCandidates()) {
    const probe = probePythonInterpreter(candidate, serverScript);
    if (probe.ok) {
      return {
        command: candidate.command,
        args: candidate.args,
        label: candidate.label,
        resolvedExecutable: probe.executable,
        serverScript,
        useExe: false,
      };
    }
    failures.push(`${candidate.label}: ${probe.reason}`);
  }

  throw new Error(
    [
      '[PY] no usable Python 3.11 runtime found',
      ...failures.map((failure) => `- ${failure}`),
    ].join('\n')
  );
}

function pythonLaunchTarget() {
  if (!resolvedLaunchTarget) {
    resolvedLaunchTarget = resolvePythonLaunchTarget();
  }
  return resolvedLaunchTarget;
}

function pythonArgs(serverScript, useExe) {
  if (useExe) return [];

  const args = [];
  if (process.platform === 'win32') {
    args.push('-X', 'utf8');
  }
  args.push('-u', serverScript);
  return args;
}

function pythonRuntimeEnv() {
  const mplConfigDir = path.join(os.tmpdir(), 'shroom-mplconfig');
  try {
    fs.mkdirSync(mplConfigDir, { recursive: true });
  } catch {}

  return {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    PYTHONNOUSERSITE: '1',
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    MPLCONFIGDIR: mplConfigDir,
  };
}

let child = null;
let buf = '';
const pending = new Map();
let nextId = 1;
let starting = false;
let manualStop = false;
let stderrTail = '';
let footWarmupPromise = null;

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

function warmFootAnalysis() {
  if (footWarmupPromise) {
    return footWarmupPromise;
  }

  footWarmupPromise = callPy('warm_foot_analysis', {}, { timeoutMs: 300000 })
    .then(() => true)
    .catch((error) => {
      footWarmupPromise = null;
      throw error;
    });

  return footWarmupPromise;
}

function missingPackagedRuntimeError() {
  const roots = packagedPythonRoots();
  const searched = roots.length > 0 ? roots.join(", ") : (process.resourcesPath || "<unknown>");

  return new Error(
    `[PY] packaged runtime missing: expected bundled onbed_server or embedded Python under ${searched}`
  );
}

function startWorker() {
  if (child || starting) return;
  starting = true;
  manualStop = false;

  try {
    const target = pythonLaunchTarget();
    const py = target?.command;
    const useExe = Boolean(target?.useExe);
    const serverScript = target?.serverScript;

    if (isPackagedApp() && !py) {
      throw missingPackagedRuntimeError();
    }

    if (!useExe && !serverScript) {
      throw new Error('[PY] start aborted: no python runtime script found');
    }

    const args = [...(target?.args || []), ...pythonArgs(serverScript, useExe)];
    const cwd = useExe ? path.dirname(py) : (serverScript ? path.dirname(serverScript) : process.cwd());

    console.log('[PY] start:', py, args.join(' '), 'cwd=', cwd, 'packaged=', isPackagedApp(), 'useExe=', useExe);
    if (target?.resolvedExecutable && target.resolvedExecutable !== py) {
      console.log('[PY] resolved executable:', target.resolvedExecutable);
    }
    if (py && py.includes(path.sep) && !fs.existsSync(py)) console.error('[PY] pythonBin NOT FOUND:', py);
    if (!useExe && (!serverScript || !fs.existsSync(serverScript))) console.error('[PY] serverPy NOT FOUND:', serverScript);

    child = spawn(py, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: pythonRuntimeEnv(),
      windowsHide: true,
      cwd,
    });
    buf = '';
    stderrTail = '';
  } catch (error) {
    console.error(error.message);
    throw error;
  } finally {
    starting = false;
  }

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
    pushErr(String(err.stack || err));
    console.error(`[PY] worker ERROR: ${err.message}`);
    rejectAllPending(err);
    child = null;
  });

  child.on('exit', (code, sig) => {
    console.error(`[PY] worker EXIT code=${code} sig=${sig}\n[PY] stderr tail:\n${stderrTail}`);
    rejectAllPending(new Error(`python worker exited (code=${code} sig=${sig})`));
    child = null;
    footWarmupPromise = null;

    if (!manualStop) {
      setTimeout(startWorker, 500);
    }
  });

  callPy('ping', {}, { timeoutMs: 30000 })
    .then(() => {
      console.log('[PY] ready');
    })
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
  if (!child) {
    try {
      startWorker();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  if (!child) {
    return Promise.reject(new Error('python worker not running'));
  }

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
  manualStop = true;
  if (child) {
    child.kill();
    child = null;
  }
}

module.exports = { startWorker, callPy, stopWorker, warmFootAnalysis };
