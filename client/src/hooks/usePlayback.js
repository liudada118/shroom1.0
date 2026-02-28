/**
 * usePlayback.js
 * 历史数据回放控制 Hook
 *
 * 将 Home.js 中分散的回放相关状态（playflag、index、length、local 等）
 * 和回放控制逻辑统一封装。
 *
 * 使用示例：
 *   const playback = usePlayback(sendMessage);
 *   playback.play();
 *   playback.seekTo(100);
 *   playback.setSpeed(2);
 */

import { useState, useCallback, useRef } from 'react';

/**
 * @param {function} sendMessage - WebSocket 发送函数
 * @returns {{
 *   isPlaying: boolean,
 *   currentIndex: number,
 *   totalFrames: number,
 *   speed: number,
 *   isLocal: boolean,
 *   currentLabel: string,
 *   play: function,
 *   pause: function,
 *   toggle: function,
 *   seekTo: function,
 *   stepForward: function,
 *   stepBackward: function,
 *   setSpeed: function,
 *   loadHistory: function,
 *   setTotalFrames: function,
 *   setCurrentIndex: function,
 *   setIsLocal: function,
 * }}
 */
export function usePlayback(sendMessage) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [speed, setSpeedState] = useState(1);
  const [isLocal, setIsLocal] = useState(false);
  const [currentLabel, setCurrentLabel] = useState('');

  const speedRef = useRef(speed);
  speedRef.current = speed;

  /**
   * 开始回放
   */
  const play = useCallback(() => {
    setIsPlaying(true);
    sendMessage({ play: true });
  }, [sendMessage]);

  /**
   * 暂停回放
   */
  const pause = useCallback(() => {
    setIsPlaying(false);
    sendMessage({ play: false });
  }, [sendMessage]);

  /**
   * 切换播放/暂停
   */
  const toggle = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      sendMessage({ play: next });
      return next;
    });
  }, [sendMessage]);

  /**
   * 跳转到指定帧
   * @param {number} index - 目标帧索引
   */
  const seekTo = useCallback((index) => {
    const clampedIndex = Math.max(0, Math.min(index, totalFrames - 1));
    setCurrentIndex(clampedIndex);
    sendMessage({ index: clampedIndex });
  }, [sendMessage, totalFrames]);

  /**
   * 前进一帧
   */
  const stepForward = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = Math.min(prev + 1, totalFrames - 1);
      sendMessage({ index: next });
      return next;
    });
  }, [sendMessage, totalFrames]);

  /**
   * 后退一帧
   */
  const stepBackward = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = Math.max(prev - 1, 0);
      sendMessage({ index: next });
      return next;
    });
  }, [sendMessage]);

  /**
   * 设置回放速度
   * @param {number} newSpeed - 回放倍速（0.5, 1, 2, 4 等）
   */
  const setSpeed = useCallback((newSpeed) => {
    setSpeedState(newSpeed);
    sendMessage({ speed: newSpeed });
  }, [sendMessage]);

  /**
   * 加载历史数据
   * @param {string} dateLabel - 采集标签
   */
  const loadHistory = useCallback((dateLabel) => {
    setCurrentLabel(dateLabel);
    setCurrentIndex(0);
    setIsPlaying(false);
    sendMessage({ history: dateLabel });
  }, [sendMessage]);

  return {
    isPlaying,
    currentIndex,
    totalFrames,
    speed,
    isLocal,
    currentLabel,
    play,
    pause,
    toggle,
    seekTo,
    stepForward,
    stepBackward,
    setSpeed,
    loadHistory,
    setTotalFrames,
    setCurrentIndex,
    setIsLocal,
  };
}
