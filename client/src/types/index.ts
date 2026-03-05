/**
 * types/index.ts - 前端 TypeScript 类型定义
 *
 * 为前端组件和 Hook 提供类型安全。
 * 即使组件仍为 .js 文件，也可以通过 JSDoc 引用这些类型。
 */

// ============================================================
// 传感器相关
// ============================================================

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

export interface SensorConfig {
  type: SensorType;
  rows: number;
  cols: number;
  maxValue: number;
  label: string;
}

// ============================================================
// 压力数据
// ============================================================

export interface PressureFrame {
  frameIndex: number;
  timestamp: number;
  matrix: number[][];
}

export interface PressureStats {
  max: number;
  min: number;
  avg: number;
  sum: number;
  activeCount: number;
  centerOfPressure?: { x: number; y: number };
}

// ============================================================
// WebSocket
// ============================================================

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface WebSocketOptions {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  onMessage?: (data: any) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
}

// ============================================================
// 回放控制
// ============================================================

export interface PlaybackState {
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  speed: number;
  frames: PressureFrame[];
}

// ============================================================
// 应用状态 (Zustand Store)
// ============================================================

export interface AppState {
  // 授权状态
  isLicensed: boolean;
  licenseExpiry: string | null;

  // 传感器状态
  sensorType: SensorType;
  serialPort: string | null;
  isSerialOpen: boolean;

  // 采集状态
  isRecording: boolean;
  recordLabel: string;
  frameCount: number;

  // WebSocket 状态
  wsStatus: ConnectionStatus;

  // 操作方法
  setLicensed: (status: boolean, expiry?: string) => void;
  setSensorType: (type: SensorType) => void;
  setSerialPort: (port: string | null) => void;
  setSerialOpen: (isOpen: boolean) => void;
  setRecording: (isRecording: boolean, label?: string) => void;
  incrementFrame: () => void;
  resetFrameCount: () => void;
  setWsStatus: (status: ConnectionStatus) => void;
}

// ============================================================
// 3D 渲染
// ============================================================

export interface ThreeSceneOptions {
  containerRef: React.RefObject<HTMLDivElement>;
  cameraPosition?: [number, number, number];
  enableOrbitControls?: boolean;
  backgroundColor?: number;
  ambientLightIntensity?: number;
}

export interface InstancedMeshOptions {
  rows: number;
  cols: number;
  cellSize?: number;
  gap?: number;
  maxHeight?: number;
  maxValue?: number;
  geometry?: "box" | "cylinder";
}

// ============================================================
// Electron API (从 preload.js 暴露)
// ============================================================

export interface ElectronAPI {
  send(channel: string, data: any): void;
  on(channel: string, callback: (...args: any[]) => void): () => void;
  once(channel: string, callback: (...args: any[]) => void): void;
  invoke(channel: string, data?: any): Promise<any>;
  platform: string;
  getVersion(): Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
