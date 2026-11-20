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
 *       "url": "https://images.jq-industries.com/shroom/software/"
 *     }]
 *   }
 * }
 *
 * 更新源分流:
 * 打包配置只决定下载缓存目录；每次检查实际访问哪个地址由 UPDATE_SOURCES 与系统时区决定
 * （中国大陆时区先走 images，其余先走 shroom），首选地址连不上时自动改用另一个。
 */

const { autoUpdater } = require("electron-updater");
const { ipcMain, dialog } = require("electron");
const logger = require("../../backend/common/logger");
const { recordBusinessEvent } = require('../../backend/common/businessEvents');
const { describeUpdaterError, createUpdaterLogger } = require('./updaterErrors');

/**
 * 安装包更新源。
 * ⚠️ 两处必须由发布流程保持文件完全一致；只发了一处时，另一地区的客户会一直停在旧版本且不报错。
 */
const UPDATE_SOURCES = Object.freeze({
  domestic: "https://images.jq-industries.com/shroom/software/",
  overseas: "https://shroom.jq-industries.com/shroom1",
});

/** 视为中国大陆的系统时区；港澳台时区不在内，按海外处理。 */
const MAINLAND_CHINA_TIME_ZONES = new Set([
  "Asia/Shanghai", "Asia/Chongqing", "Asia/Chungking", "Asia/Harbin", "Asia/Urumqi", "Asia/Kashgar", "PRC",
]);

/** 读取系统时区；读不到时返回空字符串，由调用方按海外处理。 */
function readSystemTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

/**
 * 按时区排出更新源的访问顺序：第一个是首选，第二个只在首选连不上时使用。
 * 时区只是地区的近似判断，判断错了由换源兜底，不会导致更新失败。
 * @param {string} timeZone - IANA 时区名，例如 Asia/Shanghai
 * @returns {string[]} 两个更新源地址
 */
function orderUpdateSources(timeZone) {
  return MAINLAND_CHINA_TIME_ZONES.has(timeZone)
    ? [UPDATE_SOURCES.domestic, UPDATE_SOURCES.overseas]
    : [UPDATE_SOURCES.overseas, UPDATE_SOURCES.domestic];
}

/**
 * 判断一次失败是否值得换另一个地址重试：连不上、超时、域名解析失败，或服务端 5xx（如 CDN 回源 502）。
 * 404、403、校验失败属于发布问题，换地址只会掩盖它，所以不算。
 * @param {{code: string, httpStatus?: number}} failure - describeUpdaterError 的结果
 * @returns {boolean}
 */
function isSourceUnavailable(failure) {
  return failure.code === "UPDATE_NETWORK_UNAVAILABLE" || failure.httpStatus >= 500;
}

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
   * @param {string} options.feedUrl - 自定义更新服务器 URL（可选）；传入后只用这一个地址，不再按地区分流
   * @param {string} options.timeZone - 用于地区判断的时区，默认读取系统时区
   * @param {string} options.platform - 运行平台，默认使用 process.platform
   */
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.platform = options.platform || process.platform;
    this.checkInterval = options.checkInterval || 4 * 60 * 60 * 1000;
    this._timer = null;
    this._status = null;
    this._releaseInfo = null;
    this._installRequested = false;
    this._beforeInstall = typeof options.beforeInstall === "function" ? options.beforeInstall : null;
    this._onInstallRequested = options.onInstallRequested;
    this._downloadedVersion = null;

    // 配置 autoUpdater
    autoUpdater.autoDownload = options.autoDownload || false;
    autoUpdater.autoInstallOnAppQuit = options.autoInstallOnAppQuit !== false;
    this._sources = options.feedUrl
      ? [options.feedUrl]
      : orderUpdateSources(options.timeZone === undefined ? readSystemTimeZone() : options.timeZone);
    this._workingSource = null;
    this._fallbackPending = 0;
    this._retryingSource = false;

    // 备用地址还没试之前，引擎自己记录的失败只算告警，避免换源成功仍被当成一次更新故障。
    const engineLogger = createUpdaterLogger(logger, this.platform);
    autoUpdater.logger = {
      ...engineLogger,
      error: (...args) => (this._fallbackPending > 0 ? engineLogger.warn : engineLogger.error)(...args),
    };

    this._useSource(this._sources[0]);

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
      // 还有备用地址可试时先不提示；备用地址也失败才由最后一次检查统一上报。
      if (this._fallbackPending > 0 && isSourceUnavailable(failure)) return;
      logger.error("[Updater] 安装包更新失败:", failure);
      this._sendStatus({
        type: "update-error",
        ...failure,
      });
    });

    // 正在检查更新
    autoUpdater.on("checking-for-update", () => {
      // 换源重查属于同一次检查，不重复推送状态和计数。
      if (this._retryingSource) return;
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
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
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
          case "getStatus":
            return this.getStatus();
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
    if (data.type === 'update-available' || data.type === 'update-downloaded') {
      const previous = this._releaseInfo?.version === data.version ? this._releaseInfo : null;
      this._releaseInfo = {
        ...previous,
        ...Object.fromEntries(['version', 'releaseDate', 'releaseNotes']
          .filter(key => data[key] !== undefined).map(key => [key, data[key]])),
      };
    } else if (data.type === 'update-not-available') this._releaseInfo = null;
    const status = {
      ...(['download-progress', 'update-downloaded', 'installing-update'].includes(data.type) ? this._releaseInfo : null),
      ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
    };
    // ⚠️ 首次检查可早于页面订阅，缓存公开状态才能在页面就绪后恢复更新提示。
    this._status = JSON.parse(JSON.stringify(status));
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
      this.mainWindow.webContents.send("update-status", this.getStatus());
    }
  }

  /** Read the latest public state without starting a check or recording another event. */
  getStatus() {
    return this._status === null ? null : JSON.parse(JSON.stringify(this._status));
  }

  /**
   * 让更新引擎改用指定地址检查和下载。
   * ⚠️ 下载沿用最近一次检查成功时的地址，所以只在检查前切换，不要在下载过程中调用。
   * @param {string} url - 更新源地址
   */
  _useSource(url) {
    autoUpdater.setFeedURL({ provider: "generic", url });
  }

  /** 本次检查的访问顺序：上次连得上的地址优先，省得每 4 小时都先等首选地址超时。 */
  _orderedSources() {
    if (!this._workingSource || this._sources[0] === this._workingSource) return this._sources;
    return [this._workingSource, ...this._sources.filter((url) => url !== this._workingSource)];
  }

  /** 对当前地址检查一次；只有响应被截断时原地重试一次。 */
  async _checkCurrentSource() {
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

  /**
   * 检查更新：先访问首选地址，连不上时改用另一个地址再查一次。
   * 只有地址本身不可用（见 isSourceUnavailable）才换源；404、校验失败等发布问题直接抛出。
   * @returns {Promise} 引擎的检查结果；所有地址都失败时抛出最后一次的错误
   */
  async checkForUpdates() {
    const sources = this._orderedSources();
    for (let index = 0; index < sources.length; index++) {
      const hasFallback = index < sources.length - 1;
      this._useSource(sources[index]);
      this._retryingSource = index > 0;
      if (hasFallback) this._fallbackPending++;
      try {
        const result = await this._checkCurrentSource();
        this._workingSource = sources[index];
        return result;
      } catch (err) {
        if (!hasFallback || !isSourceUnavailable(describeUpdaterError(err, this.platform))) throw err;
        logger.warn("[Updater] 首选更新地址暂不可用，改用备用地址重新检查");
      } finally {
        if (hasFallback) this._fallbackPending--;
        this._retryingSource = false;
      }
    }
    return null;
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

  /** Report automatic-check failures even when the engine only rejects its promise. */
  _safeCheckForUpdates() {
    return this.checkForUpdates().catch((err) => {
      const failure = describeUpdaterError(err, this.platform);
      logger.error("[Updater] checkForUpdates rejected:", failure);
      this._sendStatus({ type: 'update-error', ...failure });
      return null;
    });
  }

  /**
   * 启动定时检查
   */
  startAutoCheck() {
    if (this._timer !== null) {
      return;
    }

    // 先登记周期任务，防止首次检查同步发出的事件重复启动检查。
    this._timer = setInterval(() => {
      void this._safeCheckForUpdates();
    }, this.checkInterval);
    void this._safeCheckForUpdates();

    logger.info(
      `[Updater] 自动更新检查已启动，间隔: ${this.checkInterval / 1000 / 60} 分钟`
    );
  }

  /**
   * 停止定时检查
   */
  stopAutoCheck() {
    if (this._timer !== null) {
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
