const { spawn } = require("child_process");
const http = require("http");

const DEV_SERVER_URL = process.env.FRONTEND_DEV_URL || "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 180000;
const CHECK_INTERVAL_MS = 1000;
const EXPECTED_APP_TITLE = "Shroom - Pressure Sensor System";

let clientProcess = null;
let electronProcess = null;
let shuttingDown = false;

function runCommand(command, args, options = {}) {
  return spawn(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
    ...options,
  });
}

function runNpm(args, options = {}) {
  if (process.platform === "win32") {
    const comspec = process.env.ComSpec || "cmd.exe";
    const cmdline = `npm ${args.join(" ")}`;
    return runCommand(comspec, ["/d", "/s", "/c", cmdline], options);
  }
  return runCommand("npm", args, options);
}

function pingUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function fetchText(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve(body);
      });
    });
    req.on("error", () => resolve(""));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve("");
    });
  });
}

async function isExpectedFrontend(url) {
  const html = await fetchText(url);
  if (!html) return false;

  const hasTitle = html.includes(EXPECTED_APP_TITLE);
  const hasRoot = html.includes('id="root"');
  const hasEntry =
    html.includes("/@vite/client") ||
    html.includes("/src/main.jsx") ||
    /assets\/index-[\w-]+\.js/.test(html);

  return hasTitle && hasRoot && hasEntry;
}

async function waitForDevServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await pingUrl(url);
    if (ready) {
      const expected = await isExpectedFrontend(url);
      if (expected) return;
    }
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
  const alreadyReady = await pingUrl(DEV_SERVER_URL);
  if (!alreadyReady) {
    clientProcess = runNpm(["--prefix", "client", "run", "dev"]);
    clientProcess.on("exit", (code) => {
      if (!shuttingDown) {
        // During initial startup, waitForDevServer decides pass/fail.
        if (!electronProcess) return;
        console.error(`frontend exited unexpectedly (code: ${code ?? "null"})`);
        shutdown(code || 1);
      }
    });

    try {
      await waitForDevServer(DEV_SERVER_URL, START_TIMEOUT_MS);
    } catch (error) {
      console.error(error.message);
      shutdown(1);
      return;
    }
  } else {
    const expected = await isExpectedFrontend(DEV_SERVER_URL);
    if (!expected) {
      console.error(
        `[dev] ${DEV_SERVER_URL} is occupied by a non-Shroom frontend. Stop the process on this port and restart.`
      );
      shutdown(1);
      return;
    }
    console.log(`Frontend already running at ${DEV_SERVER_URL}`);
  }

  electronProcess = runNpm(["run", "start:electron:only"], {
    env: { ...process.env, ELECTRON_START_URL: DEV_SERVER_URL },
  });

  electronProcess.on("exit", (code) => {
    shutdown(code || 0);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start();
