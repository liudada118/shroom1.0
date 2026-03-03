/**
 * index.js - Electron 娑撴槒绻樼粙瀣弳閸?
 *
 * 閼卞矁鐭?
 * 1. 閸掓稑缂撶€瑰鍙忛惃?BrowserWindow閿涘牆鎯庨悽?contextIsolation + sandbox閿?
 * 2. 閸氼垰濮╅崥搴ｎ伂閺堝秴濮熼敍鍦礶bSocket + 娑撴彃褰涢敍?
 * 3. 瀵よ櫣鐝?IPC 闁矮淇婂銉︻暒閿涘牆澧犵粩?閳?閸氬海顏敍?
 * 4. 缁狅紕鎮婃惔鏃傛暏閻㈢喎鎳￠崨銊︽埂
 */

const { app, BrowserWindow, ipcMain } = require("electron");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { openServer, getWsServer, handleCommand } = require("./server");

// ============================================================
// 闁板秶鐤嗙敮鎼佸櫤
// ============================================================
const HOSTNAME = "127.0.0.1";
const PORT = 12321;
const DEV_SERVER_URL = process.env.ELECTRON_START_URL || process.env.FRONTEND_DEV_URL || "";
const IS_DEV = Boolean(DEV_SERVER_URL);

// ============================================================
// 缁愭褰涚粻锛勬倞
// ============================================================
let mainWindow = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    show: false,
    icon: path.join(__dirname, "logo.ico"),
    webPreferences: {
      contextIsolation: true,   // 閸氼垳鏁ゆ稉濠佺瑓閺傚洭娈х粋浼欑礉闂冨弶顒涘〒鍙夌厠鏉╂稓鈻肩拋鍧楁６ Node.js
      sandbox: true,            // 閸氼垳鏁ゅ▽娆戭唸閿涘矁绻樻稉鈧銉╂閸掕埖瑕嗛弻鎾圭箻缁嬪娼堥梽?
      nodeIntegration: false,   // 缁備焦顒涘〒鍙夌厠鏉╂稓鈻兼担璺ㄦ暏 Node.js API
      preload: path.join(__dirname, "preload.js"), // 鐎瑰鍙忓銉︻暒閼存碍婀?
      webSecurity: true,        // 閸氼垳鏁?Web 鐎瑰鍙忕粵鏍殣
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(
      `[Renderer] did-fail-load code=${errorCode} desc=${errorDescription} url=${validatedURL}`
    );
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[Renderer] process gone:", details);
  });

  if (IS_DEV) {
    mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      const source = sourceId || "unknown-source";
      console.log(`[Renderer:${level}] ${message} (${source}:${line})`);
    });
  }

  mainWindow.maximize();

  // 閸氼垰濮╅崥搴ｎ伂閺堝秴濮?
  openServer();

  if (DEV_SERVER_URL) {
    console.log(`[Main] Loading renderer from dev server: ${DEV_SERVER_URL}`);
    mainWindow.loadURL(DEV_SERVER_URL).catch((err) => {
      console.error(
        `[Main] Failed to load dev server (${DEV_SERVER_URL}): ${err.message}. Falling back to static build.`
      );
      startStaticServer({ hostname: HOSTNAME, port: PORT, win: mainWindow });
    });
  } else {
    startStaticServer({ hostname: HOSTNAME, port: PORT, win: mainWindow });
  }
};

// ============================================================
// IPC 闁矮淇婂銉︻暒
// ============================================================

// 婢跺嫮鎮婇崜宥囶伂閸欐垶娼甸惃?WebSocket 濞戝牊浼?
ipcMain.on("ws-send", (event, data) => {
  try {
    if (typeof handleCommand === "function") {
      handleCommand(data);
    }
  } catch (err) {
    console.error("[IPC] ws-send error:", err.message);
    event.sender.send("error", { message: err.message });
  }
});

// 婢跺嫮鎮婃稉鎻掑經閹貉冨煑閹稿洣鎶?
ipcMain.on("serial-command", (event, data) => {
  try {
    if (typeof handleCommand === "function") {
      handleCommand({ type: "serial", ...data });
    }
  } catch (err) {
    console.error("[IPC] serial-command error:", err.message);
    event.sender.send("error", { message: err.message });
  }
});

// 婢跺嫮鎮婃惔鏃傛暏缁狙勫瘹娴犮倧绱欓崣灞芥倻闁矮淇婇敍?
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

// 婢跺嫮鎮婇幒鍫熸綀妤犲矁鐦夌拠閿嬬湴
ipcMain.on("license-check", (event) => {
  try {
    if (typeof handleCommand === "function") {
      handleCommand({ type: "license-check" });
    }
  } catch (err) {
    event.sender.send("error", { message: err.message });
  }
});

// 婢跺嫮鎮婇弬鍥︽鐎电鐦藉鍡氼嚞濮?
ipcMain.handle("file-dialog", async (event, options) => {
  const { dialog } = require("electron");
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// 婢跺嫮鎮?CSV 鐎电厧鍤拠閿嬬湴
ipcMain.on("export-csv", (event, data) => {
  try {
    if (typeof handleCommand === "function") {
      handleCommand({ type: "export-csv", ...data });
    }
  } catch (err) {
    event.sender.send("error", { message: err.message });
  }
});

// 婢跺嫮鎮婇弫鐗堝祦鎼存挻鐓＄拠銏ｎ嚞濮?
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
 * 閸氭垶瑕嗛弻鎾圭箻缁嬪褰傞柅浣圭Х閹垳娈戝銉ュ徔閸戣姤鏆?
 * 娓?server.js 缁涘膩閸ф鐨熼悽顭掔礉鐏忓棗鎮楃粩顖涙殶閹诡喗甯归柅浣稿煂閸撳秶顏?
 */
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// 鐎电厧鍤笟?server.js 娴ｈ法鏁?
module.exports = { sendToRenderer };

// ============================================================
// 闂堟瑦鈧焦鏋冩禒鑸垫箛閸斺€虫珤
// ============================================================
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

  const server = http.createServer((req, res) => {
    let basePath = __dirname;
    if (app.isPackaged) {
      if (os.platform() !== "darwin") {
        basePath = "resources";
      }
    }

    const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    const isRootRequest = req.url === "/" || req.url === "/index.html";
    const filePath = path.join(basePath, "build", urlPath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // SPA fallback: 鐎甸€涚艾闂堢偤娼ら幀浣界カ濠ф劘顕Ч鍌︾礉鏉╂柨娲?index.html
        if (isRootRequest || path.extname(urlPath) === "") {
          const indexPath = path.join(basePath, "build", "index.html");
          fs.readFile(indexPath, (err2, indexData) => {
            if (err2) {
              res.writeHead(500, { "Content-Type": "text/plain" });
              res.end(`Frontend build missing: ${indexPath}. Run client build or use dev mode.`);
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

  server.listen(port, hostname, () => {
    console.log(`[Main] Static server running at http://${hostname}:${port}/`);
    win.loadURL(`http://${hostname}:${port}`);
  });
}

// ============================================================
// 鎼存梻鏁ら悽鐔锋嚒閸涖劍婀?
// ============================================================
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// 娴兼﹢娉ら柅鈧崙鐚寸窗濞撳懐鎮婄挧鍕爱
app.on("before-quit", () => {
  console.log("[Main] Application is quitting, cleaning up...");
});
