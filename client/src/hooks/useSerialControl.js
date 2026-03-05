/**
 * useSerialControl.js
 * 串口控制 Hook
 *
 * 封装前端通过 WebSocket 向后端发送串口控制指令的逻辑，
 * 包括：打开/关闭串口、切换传感器类型、数据采集、回放控制等。
 *
 * 增强特性：
 *   - 完整的串口生命周期控制
 *   - 多串口管理（sit/back/head）
 *   - 数据采集与回放
 *   - 压力补偿与校准
 *   - 批量操作支持
 *
 * 使用示例：
 *   const controls = useSerialControl(sendMessage);
 *   controls.openPort('COM3');
 *   controls.switchSensor('car10');
 *   controls.startRecord('2026-03-01');
 */

import { useCallback } from 'react';

/**
 * @param {function} sendMessage - 来自 useWebSocket 的发送函数
 * @returns {object} 串口控制方法集合
 */
export function useSerialControl(sendMessage) {

  // ─── 串口管理 ──────────────────────────────────────────────────────────────

  /**
   * 打开主串口（坐垫/单传感器）
   * @param {string} portPath - 串口路径，如 'COM3'
   */
  const openPort = useCallback((portPath) => {
    sendMessage({ port: portPath });
  }, [sendMessage]);

  /**
   * 打开靠背串口
   * @param {string} portPath - 串口路径
   */
  const openBackPort = useCallback((portPath) => {
    sendMessage({ portBack: portPath });
  }, [sendMessage]);

  /**
   * 打开头枕串口
   * @param {string} portPath - 串口路径
   */
  const openHeadPort = useCallback((portPath) => {
    sendMessage({ portHead: portPath });
  }, [sendMessage]);

  /**
   * 关闭当前串口
   */
  const closePort = useCallback(() => {
    sendMessage({ closePort: true });
  }, [sendMessage]);

  /**
   * 重置串口连接
   */
  const resetSerial = useCallback(() => {
    sendMessage({ serialReset: true });
  }, [sendMessage]);

  // ─── 传感器控制 ────────────────────────────────────────────────────────────

  /**
   * 切换传感器类型
   * @param {string} sensorType - 传感器类型标识符
   */
  const switchSensor = useCallback((sensorType) => {
    sendMessage({ file: sensorType });
  }, [sendMessage]);

  /**
   * 设置坐垫/靠背数据通道开关
   * @param {boolean} sitClose - 是否关闭坐垫通道
   * @param {boolean} backClose - 是否关闭靠背通道
   */
  const setChannels = useCallback((sitClose, backClose) => {
    sendMessage({ sitClose, backClose });
  }, [sendMessage]);

  // ─── 数据采集 ──────────────────────────────────────────────────────────────

  /**
   * 开始数据采集（写入数据库）
   * @param {string} label - 采集标签（通常为时间戳字符串）
   */
  const startRecord = useCallback((label) => {
    sendMessage({ date: { date: label } });
  }, [sendMessage]);

  /**
   * 停止数据采集
   */
  const stopRecord = useCallback(() => {
    sendMessage({ date: null });
  }, [sendMessage]);

  // ─── 历史回放 ──────────────────────────────────────────────────────────────

  /**
   * 开始/暂停历史数据回放
   * @param {boolean} playing - true 为播放，false 为暂停
   */
  const setPlayback = useCallback((playing) => {
    sendMessage({ play: playing });
  }, [sendMessage]);

  /**
   * 跳转到指定回放帧
   * @param {number} index - 帧索引
   */
  const seekToFrame = useCallback((index) => {
    sendMessage({ index });
  }, [sendMessage]);

  /**
   * 切换历史数据标签
   * @param {string} dateLabel - 采集标签
   */
  const switchHistory = useCallback((dateLabel) => {
    sendMessage({ history: dateLabel });
  }, [sendMessage]);

  // ─── 校准与补偿 ────────────────────────────────────────────────────────────

  /**
   * 触发归零操作
   * @param {boolean} reset - true 为设置零点，false 为清除零点
   */
  const setZero = useCallback((reset) => {
    sendMessage({ resetZero: reset });
  }, [sendMessage]);

  /**
   * 设置压力补偿值
   * @param {number} value - 补偿值
   */
  const setCompensation = useCallback((value) => {
    sendMessage({ compen: value });
  }, [sendMessage]);

  /**
   * 设置高斯模糊半径
   * @param {number} radius - 模糊半径（0 表示关闭）
   */
  const setGaussBlur = useCallback((radius) => {
    sendMessage({ gauss: radius });
  }, [sendMessage]);

  /**
   * 设置压力上限阈值
   * @param {number} value - 上限值
   */
  const setUpperThreshold = useCallback((value) => {
    sendMessage({ up: value });
  }, [sendMessage]);

  /**
   * 设置压力下限阈值
   * @param {number} value - 下限值
   */
  const setLowerThreshold = useCallback((value) => {
    sendMessage({ down: value });
  }, [sendMessage]);

  // ─── 数据导出 ──────────────────────────────────────────────────────────────

  /**
   * 下载指定标签的 CSV 数据
   * @param {string} dateLabel - 采集标签
   */
  const downloadCsv = useCallback((dateLabel) => {
    sendMessage({ download: dateLabel });
  }, [sendMessage]);

  /**
   * 删除指定标签的数据
   * @param {string} dateLabel - 采集标签
   */
  const deleteRecord = useCallback((dateLabel) => {
    sendMessage({ delete: dateLabel });
  }, [sendMessage]);

  /**
   * 交换矩阵行列
   */
  const exchangeMatrix = useCallback(() => {
    sendMessage({ exchange: true });
  }, [sendMessage]);

  return {
    // 串口管理
    openPort,
    openBackPort,
    openHeadPort,
    closePort,
    resetSerial,
    // 传感器控制
    switchSensor,
    setChannels,
    // 数据采集
    startRecord,
    stopRecord,
    // 历史回放
    setPlayback,
    seekToFrame,
    switchHistory,
    // 校准与补偿
    setZero,
    setCompensation,
    setGaussBlur,
    setUpperThreshold,
    setLowerThreshold,
    // 数据导出
    downloadCsv,
    deleteRecord,
    exchangeMatrix,
  };
}
