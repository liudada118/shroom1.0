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
 *       "url": "https://shroom.jq-industries.com/shroom1"
 *     }]
 *   }
 * }
 */

const { autoUpdater } = require("electron-updater");
const { ipcMain, dialog } = require("electron");
const logger = require("../../backend/common/logger");
const { recordBusinessEvent } = require('../../backend/common/businessEvents');
const { describeUpdaterError, createUpdaterLogger } = require('./updaterErrors');

/** Read the transport error only for the bounded retry decision. */
function getUpdaterErrorMessage(error) {
  return error && error.message ? error.message : String(error || '未知更新错误');
}

/** Only retry the known truncated-response failure once. */
function isContentLengthMismatchError(error) {
  return getUpdaterErrorMessage(error).includes("ERR_CONTENT_LENGTH_MISMATCH");
}

/** Delay the single retry without blocking Electron's event loop. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class AppUpdater {
  /**
   * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
   * @param {object} options - 配置选项
   * @param {boolean} options.autoDownload - 是否自动下载（默认 false，让用户确认后再下载）
   * @param {boolean} options.autoInstallOnAppQuit - 退出时自动安装（默认 true）
   * @param {number} options.checkInterval - 自动检查间隔（ms，默认 4 小时）
   * @param {string} options.feedUrl - 自定义更新服务器 URL（可选）
   * @param {string} options.platform - 运行平台，默认使用 process.platform
   */
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.platform = options.platform || process.platform;
    this.checkInterval = options.checkInterval || 4 * 60 * 60 * 1000;
    this._timer = null;
    this._startupCheckTimer = null;
    this._installRequested = false;
    this._beforeInstall = typeof options.beforeInstall === "function" ? options.beforeInstall : null;
    this._onInstallRequested = options.onInstallRequested;
    this._downloadedVersion = null;

    // 配置 autoUpdater
    autoUpdater.autoDownload = options.autoDownload || false;
    autoUpdater.autoInstallOnAppQuit = options.autoInstallOnAppQuit !== false;
    autoUpdater.logger = createUpdaterLogger(logger, this.platform);

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

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * 绑定 autoUpdater 事件
   */
  _bindEvents() {
    // 检查更新出错
    autoUpdater.on("error", (err) => {
      const failure = describeUpdaterError(err, this.platform);
      logger.error("[Updater] 安装包更新失败:", failure);
      this._sendStatus({
        type: "update-error",
        ...failure,
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
            this.installDownloadedUpdate().catch((err) => {
              logger.error("[Updater] installDownloadedUpdate failed:", describeUpdaterError(err, this.platform));
            });
          }
        });
    });
  }

  /**
   * 绑定 IPC 事件（前端手动触发更新）
   * 使用独立的 update-command 通道，避免与 app-command 冲突
   */
  _bindIPC() {
    ipcMain.removeHandler("update-command");

    // 前端请求检查更新
    ipcMain.handle("update-command", async (event, data) => {
      try {
        switch (data?.action) {
          case "checkForUpdate":
            logger.info("[Updater] 收到前端检查更新请求");
            return await this.checkForUpdates();
          case "downloadUpdate":
            logger.info("[Updater] 收到前端下载更新请求");
            return await autoUpdater.downloadUpdate();
          case "installUpdate":
            logger.info("[Updater] 收到前端安装更新请求");
            return await this.installDownloadedUpdate();
          default:
            return null;
        }
      } catch (err) {
        const failure = describeUpdaterError(err, this.platform);
        logger.error("[Updater] update-command failed:", failure);
        const { message } = failure;
        this._sendStatus({ type: 'update-error', ...failure });
        throw new Error(message);
      }
    });
  }

  /**
   * 向渲染进程发送更新状态
   */
  _sendStatus(data) {
    if (data.type === 'update-error') {
      const fingerprint = `${data.code}:${data.httpStatus || ''}`;
      if (this._lastError?.fingerprint === fingerprint && Date.now() - this._lastError.at < 1000) return;
      this._lastError = { fingerprint, at: Date.now() };
    } else if (data.type === 'checking-for-update') this._lastError = null;
    if (data.type === 'update-downloaded') this._downloadedVersion = data.version;
    const observed = {
      'checking-for-update': ['check', 'unknown'], 'update-available': ['update_available', 'success'],
      'update-not-available': ['check_current', 'success'], 'update-downloaded': ['download_ready', 'success'],
      'installing-update': ['installer_handoff', 'unknown'], 'update-error': ['update_failed', 'failure'],
    }[data.type];
    if (observed) recordBusinessEvent(data.type === 'checking-for-update' ? 'feature_attempted' : 'usage_session_summary', {
      featureId: 'software_update', action: observed[0], result: observed[1],
      ...(data.type === 'update-error' ? { errorCode: data.code || 'SOFTWARE_UPDATE_FAILED' } : {}) });
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

  async installDownloadedUpdate() {
    if (this._installRequested) {
      logger.warn("[Updater] installDownloadedUpdate ignored because installation is already requested");
      return false;
    }

    this._installRequested = true;
    try { this._onInstallRequested?.(this._downloadedVersion); } catch { /* Diagnostics cannot block installation. */ }
    this.stopAutoCheck();
    this._sendStatus({ type: "installing-update" });

    try {
      if (this._beforeInstall) {
        logger.info("[Updater] Preparing application shutdown before launching installer...");
        await this._beforeInstall();
      }
    } catch (err) {
      const failure = describeUpdaterError(err, this.platform);
      this._installRequested = false;
      logger.error("[Updater] Failed to prepare application shutdown:", failure);
      this._sendStatus({
        type: "update-error",
        ...failure,
      });
      throw err;
    }

    logger.info("[Updater] 调用 quitAndInstall，准备交给 Squirrel.Mac/安装器处理");
    autoUpdater.quitAndInstall(false, true);
    return true;
  }

  isInstallingUpdate() {
    return this._installRequested;
  }

  _safeCheckForUpdates() {
    return this.checkForUpdates().catch((err) => {
      logger.error("[Updater] checkForUpdates rejected:", describeUpdaterError(err, this.platform));
      return null;
    });
  }

  /**
   * 启动定时检查
   */
  startAutoCheck() {
    if (this._timer || this._startupCheckTimer) {
      return;
    }

    // 启动后延迟 30 秒检查第一次（避免影响启动速度）
    this._startupCheckTimer = setTimeout(() => {
      this._startupCheckTimer = null;
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
    if (this._startupCheckTimer) {
      clearTimeout(this._startupCheckTimer);
      this._startupCheckTimer = null;
    }

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
    ipcMain.removeHandler("update-command");
    autoUpdater.removeAllListeners();
    this.mainWindow = null;
  }
}

module.exports = { AppUpdater };
