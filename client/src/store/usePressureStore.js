/**
 * usePressureStore.js - 压力数据专用 Zustand Store
 *
 * 将高频更新的压力数据从主 Store 中分离，避免高频 setState 导致
 * 不相关组件的重渲染。
 *
 * 设计原则:
 * - 压力矩阵数据以 30-100Hz 的频率更新
 * - 只有热力图、3D 视图、数值面板等组件需要订阅此 Store
 * - 侧边栏、标题栏等组件不会因为压力数据更新而重渲染
 */

import { create } from "zustand";

const usePressureStore = create((set, get) => ({
  // 当前帧的压力矩阵
  matrix: [],

  // 归零基准矩阵
  zeroMatrix: null,

  // 统计数据
  stats: {
    max: 0,
    min: 0,
    avg: 0,
    sum: 0,
    activeCount: 0,
  },

  // 历史峰值（用于颜色映射）
  peakValue: 0,

  // 帧率统计
  fps: 0,
  _frameTimestamps: [],

  /**
   * 更新压力矩阵（核心方法，高频调用）
   * @param {number[][]} newMatrix - 新的压力矩阵
   */
  updateMatrix: (newMatrix) => {
    const state = get();
    let matrix = newMatrix;

    // 如果有归零基准，则减去基准值
    if (state.zeroMatrix) {
      matrix = newMatrix.map((row, i) =>
        row.map((val, j) => {
          const zero = state.zeroMatrix[i]?.[j] || 0;
          return Math.max(0, val - zero);
        })
      );
    }

    // 计算统计值
    const flat = matrix.flat();
    const nonZero = flat.filter((v) => v > 0);
    const stats = {
      max: nonZero.length > 0 ? Math.max(...nonZero) : 0,
      min: nonZero.length > 0 ? Math.min(...nonZero) : 0,
      avg:
        nonZero.length > 0
          ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length)
          : 0,
      sum: flat.reduce((a, b) => a + b, 0),
      activeCount: nonZero.length,
    };

    // 更新峰值
    const peakValue = Math.max(state.peakValue, stats.max);

    // 计算帧率
    const now = performance.now();
    const timestamps = [...state._frameTimestamps, now].filter(
      (t) => now - t < 1000
    );
    const fps = timestamps.length;

    set({ matrix, stats, peakValue, fps, _frameTimestamps: timestamps });
  },

  /**
   * 设置归零基准（将当前帧作为零点）
   */
  setZero: () => {
    const { matrix } = get();
    if (matrix.length > 0) {
      set({ zeroMatrix: matrix.map((row) => [...row]) });
    }
  },

  /**
   * 清除归零基准
   */
  clearZero: () => {
    set({ zeroMatrix: null });
  },

  /**
   * 重置峰值
   */
  resetPeak: () => {
    set({ peakValue: 0 });
  },

  /**
   * 完全重置
   */
  reset: () => {
    set({
      matrix: [],
      zeroMatrix: null,
      stats: { max: 0, min: 0, avg: 0, sum: 0, activeCount: 0 },
      peakValue: 0,
      fps: 0,
      _frameTimestamps: [],
    });
  },
}));

export { usePressureStore };
export default usePressureStore;
