/**
 * useDeferredPressure.js - React 19 并发特性应用
 *
 * 利用 React 19 的 useDeferredValue 和 useTransition 来优化
 * 高频压力数据更新时的 UI 响应性。
 *
 * 核心思路:
 * - 原始数据（rawMatrix）以最高优先级更新（用于数值显示和数据记录）
 * - 渲染数据（deferredMatrix）以低优先级更新（用于热力图和 3D 渲染）
 * - 当数据更新频率超过渲染帧率时，React 会自动跳过中间帧的渲染，
 *   保持 UI 交互（如按钮点击、滚动）的流畅性
 */

import { useDeferredValue, useTransition, useState, useCallback } from "react";

/**
 * 使用 React 19 并发特性优化压力数据渲染
 *
 * @returns {{
 *   rawMatrix: number[][],
 *   deferredMatrix: number[][],
 *   isPending: boolean,
 *   updateMatrix: (matrix: number[][]) => void,
 *   stats: { max: number, min: number, avg: number, sum: number }
 * }}
 */
export function useDeferredPressure() {
  const [rawMatrix, setRawMatrix] = useState([]);
  const [stats, setStats] = useState({ max: 0, min: 0, avg: 0, sum: 0 });
  const [isPending, startTransition] = useTransition();

  // deferredMatrix 是 rawMatrix 的延迟版本
  // React 19 会在浏览器空闲时才更新它，不会阻塞用户交互
  const deferredMatrix = useDeferredValue(rawMatrix);

  /**
   * 更新压力矩阵数据
   * - 统计值立即更新（高优先级）
   * - 矩阵数据通过 transition 更新（可中断）
   */
  const updateMatrix = useCallback((matrix) => {
    // 高优先级：立即计算统计值（用于状态栏显示）
    const flat = matrix.flat();
    const nonZero = flat.filter((v) => v > 0);
    const newStats = {
      max: nonZero.length > 0 ? Math.max(...nonZero) : 0,
      min: nonZero.length > 0 ? Math.min(...nonZero) : 0,
      avg:
        nonZero.length > 0
          ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length)
          : 0,
      sum: flat.reduce((a, b) => a + b, 0),
    };
    setStats(newStats);

    // 低优先级：通过 transition 更新矩阵（热力图和 3D 渲染可以延迟）
    startTransition(() => {
      setRawMatrix(matrix);
    });
  }, []);

  return {
    rawMatrix,
    deferredMatrix,  // 用于热力图和 3D 渲染
    isPending,       // true 表示渲染数据正在追赶最新数据
    updateMatrix,
    stats,           // 始终是最新的统计值
  };
}

export default useDeferredPressure;
