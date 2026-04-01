/**
 * index.js - Electron 主进程入口
 *
 * 职责:
 * 1. 创建安全的 BrowserWindow（启用 contextIsolation + sandbox）
 * 2. 启动后端服务（WebSocket + 串口）
 * 3. 建立 IPC 通信桥梁（前端 ↔ 后端）
 * 4. 管理应用生命周期
 * 5. 集成自动更新（electron-updater）
 * 6. 开发模式自动启动 Vite 开发服务器，实现前端热更新
 */

const { app, BrowserWindow, ipcMain, powerSaveBlocker } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { openServer, shutdownServer, getWsServer, handleCommand } = require("./server");
const { AppUpdater } = require("./autoUpdater");
const logger = require('./logger');

// ============================================================
// 配置常量
// ============================================================
const HOSTNAME = "127.0.0.1";
const PORT = 12321;
const VITE_DEV_PORT = 3000;
const DEV_SERVER_READY_TIMEOUT_MS = 60 * 1000;
const DEV_SERVER_RETRY_INTERVAL_MS = 1000;
const EXPECTED_DEV_APP_TITLE = "Shroom - Pressure Sensor System";

// ============================================================
// 窗口管理
// ============================================================
let mainWindow = null;
let appUpdater = null;
let viteProcess = null;  // Vite 子进程引用，用于退出时清理
let staticServer = null; // 生产环境静态资源 HTTP 服务

const createWindow = () => {
  mainWindow = new BrowserWindow({
    show: false,
    icon: path.join(__dirname, "logo.ico"),
    webPreferences: {
      contextIsolation: true,   // 启用上下文隔离，防止渲染进程访问 Node.js
      sandbox: true,            // 启用沙箋，进一步限制渲染进程权限
      nodeIntegration: false,   // 禁止渲染进程使用 Node.js API
      preload: path.join(__dirname, "preload.js"), // 安全桥梁脚本
      webSecurity: true,        // 启用 Web 安全策略
      backgroundThrottling: false, // 禁止息屏后节流 JS，保持 WebSocket 消息发送能力
    },
  });

  mainWindow.maximize();

  // 启动后端服务
  openServer();

  // 加载前端页面
  // 判断开发模式：检查 client 目录和 Vite 是否存在
  const clientDir = path.join(__dirname, "client");
  const hasVite = fs.existsSync(path.join(clientDir, "node_modules", ".bin"));
  const canDevMode = !app.isPackaged && fs.existsSync(clientDir) && hasVite;

  logger.info(`[Main] app.isPackaged=${app.isPackaged}, clientDir exists=${fs.existsSync(clientDir)}, hasVite=${hasVite}, canDevMode=${canDevMode}`);

  if (canDevMode) {
    // 开发模式：自动启动 Vite 开发服务器，支持前端热更新
    startViteAndLoad(mainWindow);
  } else {
    // 生产模式（打包后）：启动静态文件服务
    startStaticServer({ hostname: HOSTNAME, port: PORT, win: mainWindow });
  }

  // ============================================================
  // 初始化自动更新（仅在打包后生效）
  // ============================================================
  if (app.isPackaged) {
    appUpdater = new AppUpdater(mainWindow, {
      autoDownload: false,           // 不自动下载，让用户确认后再下载
      autoInstallOnAppQuit: true,    // 退出时自动安装已下载的更新
      checkInterval: 4 * 60 * 60 * 1000, // 每 4 小时自动检查一次
    });
    appUpdater.startAutoCheck();
  }
};

// ============================================================
// IPC 通信桥梁
// ============================================================

// 处理前端发来的 WebSocket 消息
ipcMain.on("ws-send", (event, data) => {
  try {
    if (typeof handleCommand === "function") {
      handleCommand(data);
    }
  } catch (err) {
    logger.error("[IPC] ws-send error:", err.message);
    event.sender.send("error", { message: err.message });
  }
});

// 处理串口控制指令
ipcMain.on("serial-command", (event, data) => {
  try {
    if (typeof handleCommand === "function") {
      handleCommand({ type: "serial", ...data });
    }
  } catch (err) {
    logger.error("[IPC] serial-command error:", err.message);
    event.sender.send("error", { message: err.message });
  }
});

// 处理应用级指令（双向通信）
ipcMain.handle("app-command", async (event, data) => {
  switch (data?.action) {
    case "getVersion":
      return app.getVersion();
    case "getPlatform":
      return process.platform;
    case "getAppPath":
      return app.getAppPath();
    default:
      return null;
  }
});

// 处理授权验证请求
ipcMain.on("license-check", (event) => {
  try {
    if (typeof handleCommand === "function") {
      handleCommand({ type: "license-check" });
    }
  } catch (err) {
    event.sender.send("error", { message: err.message });
  }
});

// 处理文件对话框请求
ipcMain.handle("file-dialog", async (event, options) => {
  const { dialog } = require("electron");
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// 处理 CSV 导出请求
ipcMain.on("export-csv", (event, data) => {
  try {
    if (typeof handleCommand === "function") {
      handleCommand({ type: "export-csv", ...data });
    }
  } catch (err) {
    event.sender.send("error", { message: err.message });
  }
});

// 处理数据库查询请求
ipcMain.handle("db-query", async (event, data) => {
  try {
    if (typeof handleCommand === "function") {
      return handleCommand({ type: "db-query", ...data });
    }
  } catch (err) {
    event.sender.send("error", { message: err.message });
    return null;
  }
});

/**
 * 向渲染进程发送消息的工具函数
 * 供 server.js 等模块调用，将后端数据推送到前端
 */
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// 导出供 server.js 使用
module.exports = { sendToRenderer };

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
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

  const hasTitle = html.includes(EXPECTED_DEV_APP_TITLE);
  const hasRoot = html.includes('id="root"');
  const hasEntry =
    html.includes("/@vite/client") ||
    html.includes("/src/main.jsx") ||
    /assets\/index-[\w-]+\.js/.test(html);

  return hasTitle && hasRoot && hasEntry;
}

function extractLocalViteUrl(output) {
  const match = stripAnsi(output).match(/https?:\/\/(?:127\.0\.0\.1|localhost):\d+/i);
  return match ? match[0] : null;
}

function waitForExpectedFrontend(url, maxRetries = DEV_SERVER_READY_TIMEOUT_MS / DEV_SERVER_RETRY_INTERVAL_MS) {
  return new Promise((resolve, reject) => {
    let retries = 0;

    const tryLoad = async () => {
      try {
        const expected = await isExpectedFrontend(url);
        if (expected) {
          resolve();
          return;
        }
      } catch (err) {
        logger.warn(`[Main] Checking dev server failed: ${err.message}`);
      }

      retries += 1;
      if (retries < maxRetries) {
        if (retries % 5 === 0) {
          logger.info(`[Main] Waiting for Vite dev server... (${retries}s)`);
        }
        setTimeout(tryLoad, DEV_SERVER_RETRY_INTERVAL_MS);
        return;
      }

      reject(new Error(`Vite dev server did not expose the expected frontend after ${maxRetries}s: ${url}`));
    };

    tryLoad();
  });
}

// ============================================================
// 开发模式：自动启动 Vite 开发服务器并连接
// ============================================================
function startViteAndLoad(win) {
  const clientDir = path.join(__dirname, "client");

  // 检查 client/node_modules 是否存在
  const nodeModulesPath = path.join(clientDir, "node_modules");
  if (!fs.existsSync(nodeModulesPath)) {
    logger.error("[Main] client/node_modules not found! Please run 'cd client && npm install' first.");
    logger.info("[Main] Falling back to static server...");
    startStaticServer({ hostname: HOSTNAME, port: PORT, win });
    return;
  }

  const isWin = process.platform === "win32";

  // 直接使用 client/node_modules/.bin/vite 绝对路径，避免 npx 在 electron-forge 环境下找不到命令
  const viteBin = path.join(clientDir, "node_modules", ".bin", isWin ? "vite.cmd" : "vite");

  if (!fs.existsSync(viteBin)) {
    logger.error(`[Main] Vite binary not found at: ${viteBin}`);
    logger.error("[Main] Please run 'cd client && npm install' to install dependencies.");
    logger.info("[Main] Falling back to static server...");
    startStaticServer({ hostname: HOSTNAME, port: PORT, win });
    return;
  }

  logger.info(`[Main] Dev mode: starting Vite from ${viteBin}`);

  // 标记 Vite 是否已失败，避免重复回退
  let viteFailed = false;
  let viteLoaded = false;
  let viteUrl = null;
  let detectingUrl = true;
  let detectUrlTimer = null;

  function fallbackToStatic() {
    if (viteFailed) return;  // 防止重复触发
    viteFailed = true;
    if (detectUrlTimer) {
      clearTimeout(detectUrlTimer);
      detectUrlTimer = null;
    }
    logger.info("[Main] Falling back to static server...");
    killVite();
    startStaticServer({ hostname: HOSTNAME, port: PORT, win });
  }

  function clearDetectUrlTimer() {
    if (detectUrlTimer) {
      clearTimeout(detectUrlTimer);
      detectUrlTimer = null;
    }
  }

  function loadDetectedViteUrl(nextUrl) {
    if (viteFailed || viteLoaded || !nextUrl) return;
    if (viteUrl && viteUrl === nextUrl) return;

    viteUrl = nextUrl;
    detectingUrl = false;
    clearDetectUrlTimer();

    waitForExpectedFrontend(nextUrl)
      .then(() => {
        if (viteFailed || viteLoaded) return;
        viteLoaded = true;
        logger.info(`[Main] Vite dev server is ready, loading ${nextUrl}`);
        win.loadURL(nextUrl);
      })
      .catch((err) => {
        logger.error(`[Main] ${err.message}`);
        fallbackToStatic();
      });
  }

  function handleViteOutput(data, logMethod) {
    const msg = data.toString().trim();
    if (!msg) return;

    logMethod(`[Vite] ${msg}`);

    if (viteUrl || viteFailed) return;

    const detectedUrl = extractLocalViteUrl(msg);
    if (detectedUrl) {
      loadDetectedViteUrl(detectedUrl);
    }
  }

  // 使用绝对路径启动 Vite 开发服务器
  viteProcess = spawn(viteBin, ["--host", "--port", String(VITE_DEV_PORT)], {
    cwd: clientDir,
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWin,  // Windows 下需要 shell
    env: { ...process.env, BROWSER: "none" },  // 阻止 Vite 自动打开浏览器
  });
  viteProcess.stdout.on("data", (data) => {
    handleViteOutput(data, logger.info);
  });

  viteProcess.stderr.on("data", (data) => {
    handleViteOutput(data, logger.warn);
  });

  viteProcess.on("error", (err) => {
    logger.error(`[Main] Failed to start Vite: ${err.message}`);
    fallbackToStatic();
  });

  // Vite 进程异常退出时立即回退，不再傻等
  viteProcess.on("exit", (code) => {
    logger.info(`[Vite] Process exited with code ${code}`);
    viteProcess = null;
    if (!viteLoaded && code !== 0) {
      logger.error(`[Main] Vite exited unexpectedly (code ${code}). Check if 'cd client && npm install' has been run.`);
      fallbackToStatic();
    }
  });

  detectUrlTimer = setTimeout(() => {
    if (!viteLoaded && detectingUrl) {
      logger.error(`[Main] Unable to detect a local Vite dev server URL after ${DEV_SERVER_READY_TIMEOUT_MS / 1000}s`);
      fallbackToStatic();
    }
  }, DEV_SERVER_READY_TIMEOUT_MS);
}

/**
 * 终止 Vite 子进程
 */
function killVite() {
  if (viteProcess && !viteProcess.killed) {
    logger.info("[Main] Killing Vite dev server...");
    // Windows 下需要 taskkill 来杀掉进程树
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(viteProcess.pid), "/f", "/t"], { shell: true });
    } else {
      viteProcess.kill("SIGTERM");
    }
    viteProcess = null;
  }
}

function closeStaticServer() {
  if (!staticServer) return;

  logger.info("[Main] Closing static server...");
  staticServer.close((err) => {
    if (err) {
      logger.warn("[Main] Static server close failed:", err.message);
      return;
    }

    logger.info("[Main] Static server closed");
  });
  staticServer = null;
}

// ============================================================
// 静态文件服务器
// ============================================================
function resolveBuildRoot() {
  const candidates = app.isPackaged
    ? [
        // electron-forge 产物通常会把 build 放在 resources/build
        path.join(process.resourcesPath, "build"),
        // electron-builder 默认会把 build 放在 app.asar/build
        path.join(app.getAppPath(), "build"),
      ]
    : [path.join(__dirname, "build"), path.join(process.cwd(), "build")];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  // 保底返回第一个候选路径，便于输出可排查的错误日志
  return candidates[0];
}

function startStaticServer({ hostname, port, win }) {
  const MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".map": "application/json",
  };

  const buildRoot = resolveBuildRoot();
  logger.info(`[Main] Static build root: ${buildRoot}`);

  closeStaticServer();

  staticServer = http.createServer((req, res) => {
    const urlPath = req.url === "/" ? "index.html" : req.url.split("?")[0].replace(/^\/+/, "");
    const filePath = path.join(buildRoot, urlPath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // SPA fallback: 对于非静态资源请求，返回 index.html
        if (urlPath.indexOf(".") === -1) {
          const indexPath = path.join(buildRoot, "index.html");
          fs.readFile(indexPath, (err2, indexData) => {
            if (err2) {
              res.writeHead(500, { "Content-Type": "text/plain" });
              res.end("Internal Server Error");
            } else {
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(indexData);
            }
          });
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
        }
      } else {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
      }
    });
  });

  staticServer.listen(port, hostname, () => {
    logger.info(`[Main] Static server running at http://${hostname}:${port}/`);
    win.loadURL(`http://${hostname}:${port}`);
  });
}

// ============================================================
// 应用生命周期
// ============================================================
app.whenReady().then(() => {
  // 防止息屏后系统暂停应用，保持 WebSocket 数据通道持续工作
  const psBlockerId = powerSaveBlocker.start('prevent-app-suspension');
  logger.info(`[Main] powerSaveBlocker started, id=${psBlockerId}, active=${powerSaveBlocker.isStarted(psBlockerId)}`);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// 优雅退出：清理资源
app.on("before-quit", () => {
  logger.info("[Main] Application is quitting, cleaning up...");
  killVite();
  closeStaticServer();
  if (typeof shutdownServer === "function") {
    shutdownServer();
  }
  if (appUpdater) {
    if (typeof appUpdater.isInstallingUpdate === "function" && appUpdater.isInstallingUpdate()) {
      logger.info("[Main] Skip updater dispose because update installation is in progress");
    } else {
      appUpdater.dispose();
    }
  }
});

