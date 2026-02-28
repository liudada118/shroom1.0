/**
 * constants.js
 * 全局常量配置
 *
 * 将 Home.js 和其他组件中散落的硬编码字符串、端口号、
 * 魔法数字统一收拢到此文件，便于统一修改和维护。
 */

// ─── WebSocket 端口配置 ───────────────────────────────────────────────────────
export const WS_HOST = '127.0.0.1';
export const WS_PORTS = {
  MAIN:  19999,  // 主数据通道（坐垫）
  BACK:  19998,  // 靠背数据通道
  HEAD:  19997,  // 头枕数据通道
};

export const WS_URLS = {
  MAIN: `ws://${WS_HOST}:${WS_PORTS.MAIN}`,
  BACK: `ws://${WS_HOST}:${WS_PORTS.BACK}`,
  HEAD: `ws://${WS_HOST}:${WS_PORTS.HEAD}`,
};

// ─── 传感器矩阵尺寸 ───────────────────────────────────────────────────────────
export const MATRIX_SIZE = {
  SIT:  { rows: 64, cols: 64 },   // 坐垫：64×64 = 4096 点
  BACK: { rows: 64, cols: 64 },   // 靠背：64×64 = 4096 点
  HAND: { rows: 16, cols: 16 },   // 手套：16×16 = 256 点
  FOOT: { rows: 32, cols: 32 },   // 足底：32×32 = 1024 点
};

// ─── 数据刷新频率 ─────────────────────────────────────────────────────────────
/** 目标帧率 12fps，对应间隔约 83ms */
export const FRAME_INTERVAL_MS = Math.round(1000 / 12);

// ─── 颜色映射阈值 ─────────────────────────────────────────────────────────────
export const PRESSURE_THRESHOLDS = {
  MIN: 0,
  LOW: 200,
  MID: 600,
  HIGH: 1000,
  MAX: 4095,
};

// ─── 传感器类型标识符 ─────────────────────────────────────────────────────────
export const SENSOR_TYPES = {
  CAR_SIT:    'car10',
  CAR_BACK:   'car10back',
  SMALL_BED:  'smallBed',
  HAND_LEFT:  'handL',
  HAND_RIGHT: 'handR',
  FOOT_LEFT:  'footL',
  FOOT_RIGHT: 'footR',
  GLOVES:     'gloves',
  MAT_COL:    'matCol',
};

// ─── 默认高斯模糊参数 ─────────────────────────────────────────────────────────
export const DEFAULT_GAUSS_RADIUS = 2;

// ─── 本地存储 Key ─────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  LANGUAGE:    'shroom_language',
  SENSOR_TYPE: 'shroom_sensor_type',
  LAST_PORT:   'shroom_last_port',
};
