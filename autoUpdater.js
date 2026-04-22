/**
 * autoUpdater.js - Electron 自动更新模块
 *
 * 基于 electron-updater 实现应用的自动检查、下载和安装更新。
 *
 * 支持的发布渠道:
 * - 自建服务器（generic provider，默认）
 * - GitHub Releases
 * - Amazon S3 / 阿里云 OSS 等
 *
 * 工作流程:
 * 1. 应用启动后自动检查更新
 * 2. 发现新版本后通知用户，用户确认后开始下载
 * 3. 下载过程中实时推送进度到前端
 * 4. 下载完成后弹窗询问用户是否立即安装并重启
 *
 * IPC 通道:
 * - update-command (前端 → 主进程): 更新控制指令
 * - update-status  (主进程 → 前端): 更新状态推送
 *
 * 配置方式:
 * 在 package.json 的 build 字段中添加 publish 配置:
 * {
 *   "build": {
 *     "publish": [{
 *       "provider": "generic",
 *       "url": "http://sensor.bodyta.com/shroom1"
 *     }]
 *   }
 * }
 */

const { autoUpdater } = require("electron-updater");
const { ipcMain, dialog } = require("electron");
const logger = require("./logger");

function getUpdaterErrorMessage(error) {
  return error && error.message ? error.message : String(error || "鏈煡鏇存柊閿欒");
}

function isContentLengthMismatchError(error) {
  return getUpdaterErrorMessage(error).includes("ERR_CONTENT_LENGTH_MISMATCH");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeUpdaterErrorMessage(error) {
  const raw = getUpdaterErrorMessage(error);

  if (raw.includes("ERR_CHECKSUM_MISMATCH") || raw.includes("sha512 checksum mismatch")) {
    return "更新包校验失败：服务器上的 latest-mac.yml 和实际 zip 文件不一致，请重新上传更新包后再试。";
  }

  if (raw.includes("ERR_CONTENT_LENGTH_MISMATCH")) {
    return "更新服务器返回的文件长度与响应头不一致（ERR_CONTENT_LENGTH_MISMATCH）。这通常是服务器、CDN 或代理缓存异常，请重新上传更新文件、清理缓存后再试。";
  }

  if (raw.includes("Code signature at URL") && raw.includes("did not pass validation")) {
    return "更新安装失败：当前电脑里的 Shroom 不是同一条正式签名链，不能直接自动升级。请先手动安装一次最新正式 DMG 到 /Applications，后续版本再走自动更新。";
  }

  return raw;
}

class AppUpdater {
  /**
   * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
   * @param {object} options - 配置选项
   * @param {boolean} options.autoDownload - 是否自动下载（默认 false，让用户确认后再下载）
   * @param {boolean} options.autoInstallOnAppQuit - 退出时自动安装（默认 true）
   * @param {number} options.checkInterval - 自动检查间隔（ms，默认 4 小时）
   * @param {string} options.feedUrl - 自定义更新服务器 URL（可选）
   */
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.checkInterval = options.checkInterval || 4 * 60 * 60 * 1000;
    this._timer = null;
    this._installRequested = false;

    // 配置 autoUpdater
    autoUpdater.autoDownload = options.autoDownload || false;
    autoUpdater.autoInstallOnAppQuit = options.autoInstallOnAppQuit !== false;
    autoUpdater.logger = logger;

    // 如果有自定义更新服务器
    if (options.feedUrl) {
      autoUpdater.setFeedURL({
        provider: "generic",
        url: options.feedUrl,
      });
    }

    this._bindEvents();
    this._bindIPC();
  }

  /**
   * 绑定 autoUpdater 事件
   */
  _bindEvents() {
    // 检查更新出错
    autoUpdater.on("error", (err) => {
      const message = normalizeUpdaterErrorMessage(err);
      logger.error("[Updater] 更新检查失败:", message);
      this._sendStatus({
        type: "update-error",
        message,
      });
    });

    // 正在检查更新
    autoUpdater.on("checking-for-update", () => {
      logger.info("[Updater] 正在检查更新...");
      this._sendStatus({
        type: "checking-for-update",
      });
    });

    // 有可用更新
    autoUpdater.on("update-available", (info) => {
      logger.info(`[Updater] 发现新版本: ${info.version}`);
      this._sendStatus({
        type: "update-available",
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
    });

    // 没有可用更新
    autoUpdater.on("update-not-available", (info) => {
      logger.info(`[Updater] 当前已是最新版本: ${info.version}`);
      this._sendStatus({
        type: "update-not-available",
        version: info.version,
      });
    });

    // 下载进度
    autoUpdater.on("download-progress", (progress) => {
      const logMessage = `下载进度: ${Math.round(progress.percent)}% (${(
        progress.transferred /
        1024 /
        1024
      ).toFixed(1)}MB / ${(progress.total / 1024 / 1024).toFixed(1)}MB)`;
      logger.info(`[Updater] ${logMessage}`);
      this._sendStatus({
        type: "download-progress",
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    });

    // 下载完成
    autoUpdater.on("update-downloaded", (info) => {
      logger.info(`[Updater] 更新已下载: ${info.version}`);
      this._sendStatus({
        type: "update-downloaded",
        version: info.version,
      });

      // 弹出对话框询问用户是否立即安装
      dialog
        .showMessageBox(this.mainWindow, {
          type: "info",
          title: "更新就绪",
          message: `新版本 ${info.version} 已下载完成，是否立即安装并重启？`,
          buttons: ["立即安装", "稍后安装"],
          defaultId: 0,
          cancelId: 1,
        })
        .then(({ response }) => {
          if (response === 0) {
            this.installDownloadedUpdate();
          }
        });
    });
  }

  /**
   * 绑定 IPC 事件（前端手动触发更新）
   * 使用独立的 update-command 通道，避免与 app-command 冲突
   */
  _bindIPC() {
    // 前端请求检查更新
    ipcMain.handle("update-command", async (event, data) => {
      try {
        switch (data?.action) {
          case "checkForUpdate":
            logger.info("[Updater] 收到前端检查更新请求");
            return this.checkForUpdates();
          case "downloadUpdate":
            logger.info("[Updater] 收到前端下载更新请求");
            return autoUpdater.downloadUpdate();
          case "installUpdate":
            logger.info("[Updater] 收到前端安装更新请求");
            this.installDownloadedUpdate();
            return true;
          default:
            return null;
        }
      } catch (err) {
        const message = normalizeUpdaterErrorMessage(err);
        logger.error("[Updater] update-command failed:", message);
        throw new Error(message);
      }
    });
  }

  /**
   * 向渲染进程发送更新状态
   */
  _sendStatus(data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("update-status", data);
    }
  }

  /**
   * 检查更新
   * @returns {Promise}
   */
  async checkForUpdates() {
    try {
      return await autoUpdater.checkForUpdatesAndNotify();
    } catch (err) {
      if (!isContentLengthMismatchError(err)) {
        throw err;
      }

      logger.warn("[Updater] checkForUpdates hit ERR_CONTENT_LENGTH_MISMATCH, retrying once...");
      await sleep(1500);
      return autoUpdater.checkForUpdatesAndNotify();
    }
  }

  installDownloadedUpdate() {
    this._installRequested = true;
    logger.info("[Updater] 调用 quitAndInstall，准备交给 Squirrel.Mac/安装器处理");
    autoUpdater.quitAndInstall(false, true);
  }

  isInstallingUpdate() {
    return this._installRequested;
  }

  _safeCheckForUpdates() {
    return this.checkForUpdates().catch((err) => {
      logger.error("[Updater] checkForUpdates rejected:", normalizeUpdaterErrorMessage(err));
      return null;
    });
  }

  /**
   * 启动定时检查
   */
  startAutoCheck() {
    // 启动后延迟 30 秒检查第一次（避免影响启动速度）
    setTimeout(() => {
      this._safeCheckForUpdates();
    }, 30 * 1000);

    // 之后按间隔定时检查
    this._timer = setInterval(() => {
      this._safeCheckForUpdates();
    }, this.checkInterval);

    logger.info(
      `[Updater] 自动更新检查已启动，间隔: ${this.checkInterval / 1000 / 60} 分钟`
    );
  }

  /**
   * 停止定时检查
   */
  stopAutoCheck() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /**
   * 清理资源
   */
  dispose() {
    this.stopAutoCheck();
    autoUpdater.removeAllListeners();
  }
}

module.exports = { AppUpdater };
