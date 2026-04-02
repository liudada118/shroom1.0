/**
 * preload.js - Electron 安全桥梁脚本
 *
 * 此脚本在渲染进程加载前执行，通过 contextBridge 安全地暴露
 * 有限的 API 给前端，避免渲染进程直接访问 Node.js API。
 *
 * 安全原则:
 * 1. 只暴露必要的、白名单内的方法
 * 2. 所有通信通过 IPC 通道进行
 * 3. 对传入参数进行校验
 */

const { contextBridge, ipcRenderer } = require("electron");

function warn(message) {
  try {
    console.warn(message);
  } catch {
    // Ignore preload logging failures.
  }
}

// 允许的 IPC 通道白名单
const VALID_SEND_CHANNELS = [
  "ws-send",           // 发送 WebSocket 消息到后端
  "serial-command",    // 发送串口控制指令
  "app-command",       // 发送应用级指令（如最小化、关闭）
  "license-check",     // 请求授权验证
  "file-dialog",       // 请求文件对话框
  "export-csv",        // 请求导出 CSV
  "db-query",          // 数据库查询请求
  "update-command",    // 更新控制指令（检查更新、下载、安装）
];

const VALID_RECEIVE_CHANNELS = [
  "ws-message",        // 接收 WebSocket 消息
  "serial-status",     // 接收串口状态变更
  "license-status",    // 接收授权状态
  "app-status",        // 接收应用状态
  "export-progress",   // 接收导出进度
  "db-result",         // 接收数据库查询结果
  "error",             // 接收错误信息
  "update-status",     // 接收更新状态（检查中、有更新、下载进度、下载完成等）
  "power-suspend",     // 系统息屏/锁屏通知
  "power-resume",      // 系统唤醒/解锁通知
];

contextBridge.exposeInMainWorld("electronAPI", {
  /**
   * 向主进程发送消息
   * @param {string} channel - IPC 通道名称
   * @param {any} data - 要发送的数据
   */
  send: (channel, data) => {
    if (VALID_SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      warn(`[preload] Blocked send to invalid channel: ${channel}`);
    }
  },

  /**
   * 监听主进程消息
   * @param {string} channel - IPC 通道名称
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消监听的函数
   */
  on: (channel, callback) => {
    if (VALID_RECEIVE_CHANNELS.includes(channel)) {
      const subscription = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      // 返回取消监听函数，防止内存泄漏
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    } else {
      warn(`[preload] Blocked listen on invalid channel: ${channel}`);
      return () => {};
    }
  },

  /**
   * 一次性监听主进程消息
   * @param {string} channel - IPC 通道名称
   * @param {Function} callback - 回调函数
   */
  once: (channel, callback) => {
    if (VALID_RECEIVE_CHANNELS.includes(channel)) {
      ipcRenderer.once(channel, (_event, ...args) => callback(...args));
    }
  },

  /**
   * 向主进程发送请求并等待响应（双向通信）
   * @param {string} channel - IPC 通道名称
   * @param {any} data - 要发送的数据
   * @returns {Promise<any>} 主进程的响应
   */
  invoke: (channel, data) => {
    if (VALID_SEND_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    } else {
      return Promise.reject(
        new Error(`Blocked invoke to invalid channel: ${channel}`)
      );
    }
  },

  /**
   * 获取平台信息（安全暴露，不直接暴露 process 对象）
   */
  platform: process.platform,

  /**
   * 获取应用版本
   */
  getVersion: () => ipcRenderer.invoke("app-command", { action: "getVersion" }),
});
