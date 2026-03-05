/**
 * types.d.ts - Shroom1.0 后端核心类型定义
 *
 * 为渐进式 TypeScript 迁移提供类型基础。
 * 即使后端暂时保持 .js 文件，IDE 也能通过此文件提供类型提示。
 *
 * 使用方式:
 * 在 .js 文件顶部添加 JSDoc 注释即可获得类型检查：
 * @example
 * /** @type {import('./types').SensorType} *\/
 * const sensorType = 'press32';
 */

// ============================================================
// 传感器类型
// ============================================================

/** 所有支持的传感器类型标识符 */
export type SensorType =
  | "press32"
  | "press16"
  | "press64"
  | "press128"
  | "press256"
  | "car"
  | "carFoot"
  | "carSeat"
  | "volvo"
  | "bed"
  | "shoe"
  | "insole"
  | "robot"
  | "glove";

/** 传感器矩阵尺寸配置 */
export interface SensorConfig {
  type: SensorType;
  rows: number;
  cols: number;
  maxValue: number;
  baudRate: number;
  label: string;
}

// ============================================================
// 压力数据
// ============================================================

/** 单帧压力数据 */
export interface PressureFrame {
  /** 帧序号 */
  frameIndex: number;
  /** 时间戳 (ms) */
  timestamp: number;
  /** 二维压力矩阵 [rows][cols] */
  matrix: number[][];
  /** 采集标签 */
  date?: string;
}

/** 压力统计数据 */
export interface PressureStats {
  max: number;
  min: number;
  avg: number;
  sum: number;
  /** 非零点数量 */
  activeCount: number;
  /** 重心坐标 */
  centerOfPressure?: { x: number; y: number };
}

// ============================================================
// WebSocket 消息
// ============================================================

/** WebSocket 消息基础结构 */
export interface WsMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

/** 从后端发送到前端的消息类型 */
export interface WsServerMessage extends WsMessage {
  type:
    | "pressure-data"
    | "serial-status"
    | "license-status"
    | "record-status"
    | "playback-data"
    | "config-update"
    | "error";
}

/** 从前端发送到后端的消息类型 */
export interface WsClientMessage extends WsMessage {
  type:
    | "start-record"
    | "stop-record"
    | "start-playback"
    | "stop-playback"
    | "switch-sensor"
    | "open-serial"
    | "close-serial"
    | "set-zero"
    | "export-csv"
    | "query-dates"
    | "delete-date";
}

// ============================================================
// 数据库
// ============================================================

/** 数据库中存储的帧记录 */
export interface DbFrameRecord {
  id: number;
  data: string; // JSON 字符串
  timestamp: number;
  date: string;
}

/** 数据库管理器接口 */
export interface IDatabaseManager {
  run(sql: string, params?: any[]): { lastID: number; changes: number };
  all(sql: string, params?: any[]): any[];
  get(sql: string, params?: any[]): any;
  exec(sql: string): void;
  insertBatch(sql: string, paramsList: any[][]): number;
  close(): void;
}

// ============================================================
// 串口
// ============================================================

/** 串口连接状态 */
export interface SerialPortStatus {
  path: string;
  isOpen: boolean;
  baudRate: number;
  error?: string;
}

/** 串口管理器配置 */
export interface SerialConfig {
  path: string;
  baudRate: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 1.5 | 2;
  parity?: "none" | "even" | "odd" | "mark" | "space";
  autoOpen?: boolean;
}

// ============================================================
// 授权
// ============================================================

/** 授权信息 */
export interface LicenseInfo {
  isValid: boolean;
  expiresAt?: string;
  machineId?: string;
  features?: string[];
}

// ============================================================
// 配置管理
// ============================================================

/** 应用全局配置 */
export interface AppConfig {
  /** WebSocket 服务端口 */
  wsPort: number;
  /** HTTP 静态文件服务端口 */
  httpPort: number;
  /** 串口波特率 */
  baudRate: number;
  /** 当前传感器类型 */
  sensorType: SensorType;
  /** 数据库目录 */
  dbDir: string;
  /** CSV 导出目录 */
  csvDir: string;
  /** 日志目录 */
  logDir: string;
}

// ============================================================
// Electron IPC
// ============================================================

/** Electron preload 暴露的 API */
export interface ElectronAPI {
  send(channel: string, data: any): void;
  on(channel: string, callback: (...args: any[]) => void): () => void;
  once(channel: string, callback: (...args: any[]) => void): void;
  invoke(channel: string, data?: any): Promise<any>;
  platform: string;
  getVersion(): Promise<string>;
}

// 扩展 Window 接口
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
