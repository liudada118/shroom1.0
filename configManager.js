/**
 * configManager.js
 * 统一配置管理模块
 *
 * 将 server.js 和前端中散落的硬编码配置项（端口号、波特率、
 * 矩阵尺寸、传感器类型映射等）统一收拢到此模块。
 *
 * 使用方式：
 *   const config = require('./configManager');
 *   console.log(config.ws.MAIN_PORT); // 19999
 *   console.log(config.getSensorConfig('car10')); // { type: 'car', ... }
 */

const path = require('path');
const { app } = require('electron');

// ─── 路径配置 ─────────────────────────────────────────────────────────────────

/** 应用数据目录（打包后使用 userData，开发时使用项目目录） */
const APP_DATA_DIR = app ? app.getPath('userData') : __dirname;

/** 数据库文件目录 */
const DB_DIR = path.join(__dirname, 'db');

/** CSV 数据导出目录 */
const DATA_DIR = path.join(__dirname, 'data');

// ─── WebSocket 配置 ──────────────────────────────────────────────────────────

const ws = {
  MAIN_PORT: 19999,   // 主数据通道（坐垫 / 单传感器）
  BACK_PORT: 19998,   // 靠背数据通道
  HEAD_PORT: 19997,   // 头枕数据通道
};

// ─── 串口配置 ─────────────────────────────────────────────────────────────────

const serial = {
  BAUD_RATE: 1000000,
  FRAME_SIZE: 1024,      // 标准帧长度（字节）
  FRAME_SIZE_EXT: 1025,  // 扩展帧长度（bigBed 等）
  REFRESH_RATE: 12,      // 目标帧率 (fps)
  get FRAME_INTERVAL() { return Math.round(1000 / this.REFRESH_RATE); },
};

// ─── 传感器类型配置 ──────────────────────────────────────────────────────────

/**
 * 汽车类型传感器列表（需要 sit + back 双串口）
 */
const CAR_TYPES = ['yanfeng10', 'car', 'car10', 'volvo', 'footVideo', 'hand0507', 'hand0205', 'carQX', 'eye', 'sofa', 'carY'];

/**
 * 三串口类型（sit + back + head）
 */
const THREE_PORT_TYPES = ['volvo'];

/**
 * 判断传感器类型是否为汽车类型
 * @param {string} sensorType
 * @returns {boolean}
 */
function isCar(sensorType) {
  return CAR_TYPES.includes(sensorType);
}

/**
 * 判断传感器类型是否需要三个串口
 * @param {string} sensorType
 * @returns {boolean}
 */
function isThreePort(sensorType) {
  return THREE_PORT_TYPES.includes(sensorType);
}

/**
 * 传感器类型与矩阵尺寸映射
 */
const SENSOR_MATRIX_MAP = {
  car10:      { width: 32, height: 32, total: 1024 },
  yanfeng10:  { width: 32, height: 32, total: 1024 },
  volvo:      { width: 32, height: 32, total: 1024 },
  carQX:      { width: 32, height: 32, total: 1024 },
  sofa:       { width: 32, height: 32, total: 1024 },
  smallBed:   { width: 32, height: 32, total: 1024 },
  smallBed1:  { width: 32, height: 32, total: 1024 },
  smallM:     { width: 32, height: 32, total: 1024 },
  hand:       { width: 32, height: 32, total: 1024 },
  sit:        { width: 32, height: 32, total: 1024 },
  foot:       { width: 32, height: 32, total: 1024 },
  rect:       { width: 32, height: 32, total: 1024 },
  short:      { width: 32, height: 32, total: 1024 },
  handL:      { width: 16, height: 16, total: 256 },
  handR:      { width: 16, height: 16, total: 256 },
  footL:      { width: 32, height: 32, total: 1024 },
  footR:      { width: 32, height: 32, total: 1024 },
  gloves:     { width: 16, height: 16, total: 256 },
  bigBed:     { width: 64, height: 32, total: 2048 },
  matCol:     { width: 32, height: 32, total: 1024 },
  endiSit:    { width: 32, height: 32, total: 1024 },
  carY:       { width: 32, height: 32, total: 1024 },
};

/**
 * 获取传感器的矩阵配置
 * @param {string} sensorType
 * @returns {{ width: number, height: number, total: number }}
 */
function getSensorMatrix(sensorType) {
  return SENSOR_MATRIX_MAP[sensorType] || { width: 32, height: 32, total: 1024 };
}

// ─── 压力阈值配置 ─────────────────────────────────────────────────────────────

const pressure = {
  DEFAULT_UP: 1245,    // 默认上限阈值
  DEFAULT_DOWN: 2,     // 默认下限阈值
  MAX_ADC: 4095,       // ADC 最大值
};

module.exports = {
  APP_DATA_DIR,
  DB_DIR,
  DATA_DIR,
  ws,
  serial,
  CAR_TYPES,
  THREE_PORT_TYPES,
  isCar,
  isThreePort,
  SENSOR_MATRIX_MAP,
  getSensorMatrix,
  pressure,
};
