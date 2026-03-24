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
  MAIN:  19999,  // 统一数据通道（坐垫 + 靠背 + 头枕，通过 sitData/backData/headData 字段区分）
  BACK:  19998,  // [已废弃] 靠背数据已合并到 MAIN
  HEAD:  19997,  // [已废弃] 头枕数据已合并到 MAIN
};

export const WS_URLS = {
  MAIN: `ws://${WS_HOST}:${WS_PORTS.MAIN}`,
  BACK: `ws://${WS_HOST}:${WS_PORTS.MAIN}`,  // 已合并到 MAIN
  HEAD: `ws://${WS_HOST}:${WS_PORTS.MAIN}`,  // 已合并到 MAIN
};

// ─── 传感器类型标识符 ─────────────────────────────────────────────────────────
export const SENSOR_TYPES = {
  // 汽车座椅
  CAR10:       'car10',
  CAR:         'car',
  YANFENG10:   'yanfeng10',
  VOLVO:       'volvo',
  CAR_QX:      'carQX',
  SOFA:        'sofa',
  CAR_Y:       'carY',
  // 手部
  HAND:        'hand',
  HAND_L:      'handL',
  HAND_R:      'handR',
  HAND_0205:   'hand0205',
  HAND_0507:   'hand0507',
  GLOVES:      'gloves',
  GLOVES1:     'gloves1',
  // 足部
  FOOT:        'foot',
  FOOT_L:      'footL',
  FOOT_R:      'footR',
  FOOT_VIDEO:  'footVideo',
  // 床垫
  SMALL_BED:   'smallBed',
  SMALL_BED1:  'smallBed1',
  BIG_BED:     'bigBed',
  // 坐垫
  SIT:         'sit',
  SIT10:       'sit10',
  // 其他
  SMALL_M:     'smallM',
  RECT:        'rect',
  SHORT:       'short',
  MAT_COL:     'matCol',
  EYE:         'eye',
  ROBOT:       'robot',
};

/**
 * 汽车类型传感器列表（需要 sit + back 双串口）
 */
export const CAR_TYPES = [
  'yanfeng10', 'car', 'car10', 'volvo', 'footVideo',
  'hand0507', 'hand0205', 'carQX', 'eye', 'sofa', 'carY',
];

/**
 * 判断是否为汽车类型传感器
 * @param {string} sensorType
 * @returns {boolean}
 */
export function isCar(sensorType) {
  return CAR_TYPES.includes(sensorType);
}

// ─── 传感器矩阵尺寸映射 ─────────────────────────────────────────────────────
export const SENSOR_MATRIX_MAP = {
  car10:      { width: 32, height: 32, total: 1024 },
  yanfeng10:  { width: 32, height: 32, total: 1024 },
  volvo:      { width: 32, height: 32, total: 1024 },
  carQX:      { width: 32, height: 32, total: 1024 },
  sofa:       { width: 32, height: 32, total: 1024 },
  car:        { width: 32, height: 32, total: 1024 },
  smallBed:   { width: 32, height: 32, total: 1024 },
  smallBed1:  { width: 32, height: 32, total: 1024 },
  smallM:     { width: 32, height: 32, total: 1024 },
  hand:       { width: 32, height: 32, total: 1024 },
  sit:        { width: 32, height: 32, total: 1024 },
  sit10:      { width: 32, height: 32, total: 1024 },
  foot:       { width: 32, height: 32, total: 1024 },
  rect:       { width: 32, height: 32, total: 1024 },
  short:      { width: 32, height: 32, total: 1024 },
  handL:      { width: 16, height: 16, total: 256 },
  handR:      { width: 16, height: 16, total: 256 },
  gloves:     { width: 16, height: 16, total: 256 },
  bigBed:     { width: 64, height: 32, total: 2048 },
  carY:       { width: 32, height: 32, total: 1024 },
};

/**
 * 获取传感器矩阵配置
 * @param {string} sensorType
 * @returns {{ width: number, height: number, total: number }}
 */
export function getSensorMatrix(sensorType) {
  return SENSOR_MATRIX_MAP[sensorType] || { width: 32, height: 32, total: 1024 };
}

// ─── 数据刷新频率 ─────────────────────────────────────────────────────────────
/** 目标帧率 12fps，对应间隔约 83ms */
export const FRAME_RATE = 12;
export const FRAME_INTERVAL_MS = Math.round(1000 / FRAME_RATE);

// ─── 压力阈值配置 ─────────────────────────────────────────────────────────────
export const PRESSURE = {
  MIN: 0,
  LOW: 200,
  MID: 600,
  HIGH: 1000,
  MAX: 4095,
  DEFAULT_UP: 1245,    // 默认上限
  DEFAULT_DOWN: 2,     // 默认下限
};

// ─── 默认高斯模糊参数 ─────────────────────────────────────────────────────────
export const DEFAULT_GAUSS_RADIUS = 2;

// ─── 本地存储 Key ─────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  FILE:        'file',
  LANGUAGE:    'shroom_language',
  SENSOR_TYPE: 'shroom_sensor_type',
  LAST_PORT:   'shroom_last_port',
  COLLECTION:  'collection',
  MATRIX_TITLE:'matrixTitle',
};

// ─── 颜色主题 ─────────────────────────────────────────────────────────────────
export const HEATMAP_COLORS = {
  COLD:   '#0000ff',
  COOL:   '#00ffff',
  WARM:   '#ffff00',
  HOT:    '#ff0000',
  BG:     '#1a1a2e',
};

// ─── 3D 渲染配置 ──────────────────────────────────────────────────────────────
export const THREE_CONFIG = {
  BACKGROUND_COLOR: 0x1a1a2e,
  CAMERA_FOV: 45,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 10000,
  DEFAULT_CAMERA_POSITION: [0, 100, 200],
};
