const { spawn } = require('child_process');
const http = require('http');

const DEV_SERVER_URL = process.env.FRONTEND_DEV_URL || 'http://127.0.0.1:3000';
const START_TIMEOUT_MS = 30000;   // Vite 很快，30 秒足够
const CHECK_INTERVAL_MS = 300;    // 检查间隔缩短

let clientProcess = null;
let electronProcess = null;
let shuttingDown = false;

function runCommand(command, args, options = {}) {
  return spawn(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
    ...options,
  });
}

function runNpm(args, options = {}) {
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const cmdline = `npm ${args.join(' ')}`;
    return runCommand(comspec, ['/d', '/s', '/c', cmdline], options);
  }
  return runCommand('npm', args, options);
}

function pingUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForDevServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await pingUrl(url);
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL_MS));
  }
  throw new Error(`Frontend dev server did not become ready in ${timeoutMs}ms: ${url}`);
}

function killProcess(child) {
  if (!child || child.killed) return;
  child.kill();
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  killProcess(electronProcess);
  killProcess(clientProcess);
  setTimeout(() => process.exit(code), 50);
}

async function start() {
  console.log('[dev] Starting Vite dev server + Electron...');

  const frontendReady = await pingUrl(DEV_SERVER_URL);
  if (!frontendReady) {
    // 启动 Vite dev server
    clientProcess = runNpm(['--prefix', 'client', 'run', 'dev'], {
      env: { ...process.env, BROWSER: 'none' },
    });

    clientProcess.on('exit', (code) => {
      if (!shuttingDown) {
        if (!electronProcess) return;
        console.error(`[dev] Vite dev server exited unexpectedly (code: ${code ?? 'null'})`);
        shutdown(code || 1);
      }
    });

    try {
      console.log('[dev] Waiting for Vite dev server...');
      await waitForDevServer(DEV_SERVER_URL, START_TIMEOUT_MS);
      console.log('[dev] Vite dev server is ready!');
    } catch (error) {
      console.error(error.message);
      shutdown(1);
      return;
    }
  } else {
    console.log(`[dev] Frontend already running at ${DEV_SERVER_URL}`);
  }

  electronProcess = runNpm(['run', 'start:electron'], {
    env: { ...process.env, ELECTRON_START_URL: DEV_SERVER_URL },
  });

  electronProcess.on('exit', (code) => {
    shutdown(code || 0);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

start();
