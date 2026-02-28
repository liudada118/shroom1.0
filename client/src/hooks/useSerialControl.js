/**
 * useSerialControl.js
 * 串口控制 Hook
 *
 * 封装前端通过 WebSocket 向后端发送串口控制指令的逻辑，
 * 包括：打开/关闭串口、切换传感器类型、设置采集标签等。
 *
 * 使用示例：
 *   const { openPort, closePort, switchSensor, startRecord } = useSerialControl(sendMessage);
 */

import { useCallback } from 'react';

/**
 * @param {function} sendMessage - 来自 useWebSocket 的发送函数
 * @returns {object} 串口控制方法集合
 */
export function useSerialControl(sendMessage) {

  /**
   * 打开指定串口
   * @param {string} portPath - 串口路径，如 'COM3'
   */
  const openPort = useCallback((portPath) => {
    sendMessage({ port: portPath });
  }, [sendMessage]);

  /**
   * 关闭当前串口
   */
  const closePort = useCallback(() => {
    sendMessage({ closePort: true });
  }, [sendMessage]);

  /**
   * 切换传感器类型
   * @param {string} sensorType - 传感器类型标识符（参见 constants.js SENSOR_TYPES）
   */
  const switchSensor = useCallback((sensorType) => {
    sendMessage({ file: sensorType });
  }, [sendMessage]);

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

  /**
   * 触发归零操作
   * @param {boolean} reset - true 为设置零点，false 为清除零点
   */
  const setZero = useCallback((reset) => {
    sendMessage({ resetZero: reset });
  }, [sendMessage]);

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
   * 设置高斯模糊半径
   * @param {number} radius - 模糊半径（0 表示关闭）
   */
  const setGaussBlur = useCallback((radius) => {
    sendMessage({ gauss: radius });
  }, [sendMessage]);

  return {
    openPort,
    closePort,
    switchSensor,
    startRecord,
    stopRecord,
    setPlayback,
    seekToFrame,
    switchHistory,
    setZero,
    downloadCsv,
    deleteRecord,
    setGaussBlur,
  };
}
