/**
 * autoUpdater.js - Electron 自动更新模块
 *
 * 基于 electron-updater 实现应用的自动检查、下载和安装更新。
 *
 * 支持的发布渠道:
 * - GitHub Releases（默认）
 * - 自定义服务器（通过 generic provider）
 *
 * 工作流程:
 * 1. 应用启动后自动检查更新
 * 2. 发现新版本后在后台静默下载
 * 3. 下载完成后通知用户
 * 4. 用户确认后安装并重启
 *
 * 配置方式:
 * 在 package.json 的 build 字段中添加 publish 配置:
 * {
 *   "build": {
 *     "publish": [{
 *       "provider": "github",
 *       "owner": "your-username",
 *       "repo": "shroom1.0"
 *     }]
 *   }
 * }
 */

const { autoUpdater } = require("electron-updater");
const { ipcMain, dialog } = require("electron");
const logger = require("./logger");

class AppUpdater {
  /**
   * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
   * @param {object} options - 配置选项
   * @param {boolean} options.autoDownload - 是否自动下载（默认 true）
   * @param {boolean} options.autoInstallOnAppQuit - 退出时自动安装（默认 true）
   * @param {number} options.checkInterval - 自动检查间隔（ms，默认 4 小时）
   * @param {string} options.feedUrl - 自定义更新服务器 URL（可选）
   */
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.checkInterval = options.checkInterval || 4 * 60 * 60 * 1000;
    this._timer = null;

    // 配置 autoUpdater
    autoUpdater.autoDownload = options.autoDownload !== false;
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
      logger.error("[Updater] 更新检查失败:", err.message);
      this._sendToRenderer("app-status", {
        type: "update-error",
        message: err.message,
      });
    });

    // 正在检查更新
    autoUpdater.on("checking-for-update", () => {
      logger.info("[Updater] 正在检查更新...");
      this._sendToRenderer("app-status", {
        type: "checking-for-update",
      });
    });

    // 有可用更新
    autoUpdater.on("update-available", (info) => {
      logger.info(`[Updater] 发现新版本: ${info.version}`);
      this._sendToRenderer("app-status", {
        type: "update-available",
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
    });

    // 没有可用更新
    autoUpdater.on("update-not-available", (info) => {
      logger.info(`[Updater] 当前已是最新版本: ${info.version}`);
      this._sendToRenderer("app-status", {
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
      this._sendToRenderer("app-status", {
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
      this._sendToRenderer("app-status", {
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
            autoUpdater.quitAndInstall(false, true);
          }
        });
    });
  }

  /**
   * 绑定 IPC 事件（前端手动触发更新）
   */
  _bindIPC() {
    // 前端请求检查更新
    ipcMain.on("app-command", (event, data) => {
      if (data?.action === "checkForUpdate") {
        this.checkForUpdates();
      } else if (data?.action === "installUpdate") {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  }

  /**
   * 向渲染进程发送消息
   */
  _sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * 检查更新
   * @returns {Promise}
   */
  checkForUpdates() {
    return autoUpdater.checkForUpdatesAndNotify();
  }

  /**
   * 启动定时检查
   */
  startAutoCheck() {
    // 启动后延迟 30 秒检查第一次（避免影响启动速度）
    setTimeout(() => {
      this.checkForUpdates();
    }, 30 * 1000);

    // 之后按间隔定时检查
    this._timer = setInterval(() => {
      this.checkForUpdates();
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
