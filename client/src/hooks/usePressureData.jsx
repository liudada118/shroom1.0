/**
 * usePressureData.js
 * 压力数据状态管理 Hook
 *
 * 将 Home.js 中大量分散的压力数据状态（total、mean、max、min、area、point 等）
 * 统一封装为结构化的状态对象，并提供标准化的更新接口。
 *
 * 增强特性：
 *   - 三区域数据管理（sit / back / head）
 *   - 自动计算统计信息
 *   - 归零参考值管理
 *   - 历史峰值追踪
 *
 * 使用示例：
 *   const { sitData, backData, updateSitData, setZeroRef, resetAll } = usePressureData();
 */

import { useState, useCallback, useRef } from 'react';

/**
 * 单个传感器区域的压力数据结构
 */
const DEFAULT_SENSOR_DATA = {
  total: 0,     // 总压力
  mean: 0,      // 平均压力
  max: 0,       // 最大压力
  min: 0,       // 最小压力
  point: 0,     // 有效点数
  area: 0,      // 接触面积
  matrix: [],   // 压力矩阵数组（归零后）
  rawMatrix: [],// 原始矩阵数据（归零前）
};

/**
 * 从矩阵数组计算统计信息
 * @param {number[]} matrix - 压力矩阵
 * @param {number} [threshold=0] - 有效点阈值
 * @returns {object} 统计结果
 */
function computeStats(matrix, threshold = 0) {
  if (!matrix || matrix.length === 0) {
    return { total: 0, mean: 0, max: 0, min: 0, point: 0, area: 0 };
  }
  const active = matrix.filter((v) => v > threshold);
  const point = active.length;
  if (point === 0) {
    return { total: 0, mean: 0, max: 0, min: 0, point: 0, area: 0 };
  }
  const total = active.reduce((a, b) => a + b, 0);
  return {
    total: Math.round(total),
    mean: Math.round(total / point),
    max: Math.max(...active),
    min: Math.min(...active),
    point,
    area: point,
  };
}

/**
 * @returns {{
 *   sitData: object,
 *   backData: object,
 *   headData: object,
 *   updateSitData: function,
 *   updateBackData: function,
 *   updateHeadData: function,
 *   updateFromMatrix: function,
 *   setZeroRef: function,
 *   getZeroRef: function,
 *   resetZero: function,
 *   resetAll: function,
 *   peakSit: object,
 *   peakBack: object,
 * }}
 */
export function usePressureData() {
  const [sitData, setSitData]   = useState({ ...DEFAULT_SENSOR_DATA });
  const [backData, setBackData] = useState({ ...DEFAULT_SENSOR_DATA });
  const [headData, setHeadData] = useState({ ...DEFAULT_SENSOR_DATA });

  // 归零参考值
  const zeroRefSit  = useRef([]);
  const zeroRefBack = useRef([]);
  const zeroRefHead = useRef([]);

  // 历史峰值追踪
  const [peakSit, setPeakSit]   = useState({ max: 0, total: 0 });
  const [peakBack, setPeakBack] = useState({ max: 0, total: 0 });

  /**
   * 更新坐垫数据（部分更新，未指定字段保持不变）
   * @param {Partial<typeof DEFAULT_SENSOR_DATA>} patch
   */
  const updateSitData = useCallback((patch) => {
    setSitData((prev) => ({ ...prev, ...patch }));
  }, []);

  /**
   * 更新靠背数据
   * @param {Partial<typeof DEFAULT_SENSOR_DATA>} patch
   */
  const updateBackData = useCallback((patch) => {
    setBackData((prev) => ({ ...prev, ...patch }));
  }, []);

  /**
   * 更新头枕数据
   * @param {Partial<typeof DEFAULT_SENSOR_DATA>} patch
   */
  const updateHeadData = useCallback((patch) => {
    setHeadData((prev) => ({ ...prev, ...patch }));
  }, []);

  /**
   * 从原始矩阵数据更新指定区域，自动应用归零和统计计算
   * @param {'sit'|'back'|'head'} region - 区域名称
   * @param {number[]} rawMatrix - 原始矩阵数据
   * @param {number} [threshold=0] - 有效点阈值
   */
  const updateFromMatrix = useCallback((region, rawMatrix, threshold = 0) => {
    const zeroRefMap = { sit: zeroRefSit, back: zeroRefBack, head: zeroRefHead };
    const setterMap  = { sit: setSitData, back: setBackData, head: setHeadData };
    const peakMap    = { sit: setPeakSit, back: setPeakBack };

    const zeroRef = zeroRefMap[region]?.current || [];
    const setter  = setterMap[region];
    if (!setter) return;

    // 应用归零
    let matrix = rawMatrix;
    if (zeroRef.length > 0) {
      matrix = rawMatrix.map((val, i) => Math.max(0, val - (zeroRef[i] || 0)));
    }

    // 计算统计
    const stats = computeStats(matrix, threshold);

    // 更新峰值
    const peakSetter = peakMap[region];
    if (peakSetter) {
      peakSetter((prev) => ({
        max: Math.max(prev.max, stats.max),
        total: Math.max(prev.total, stats.total),
      }));
    }

    setter({ ...stats, matrix, rawMatrix });
  }, []);

  /**
   * 设置归零参考值
   * @param {'sit'|'back'|'head'} region - 区域名称
   * @param {number[]} ref - 归零参考数组
   */
  const setZeroRef = useCallback((region, ref) => {
    const map = { sit: zeroRefSit, back: zeroRefBack, head: zeroRefHead };
    if (map[region]) map[region].current = ref;
  }, []);

  /**
   * 获取当前归零参考值
   * @param {'sit'|'back'|'head'} region
   * @returns {number[]}
   */
  const getZeroRef = useCallback((region) => {
    const map = { sit: zeroRefSit, back: zeroRefBack, head: zeroRefHead };
    return map[region]?.current || [];
  }, []);

  /**
   * 重置归零参考值
   * @param {'sit'|'back'|'head'|'all'} region
   */
  const resetZero = useCallback((region = 'all') => {
    if (region === 'all' || region === 'sit')  zeroRefSit.current = [];
    if (region === 'all' || region === 'back') zeroRefBack.current = [];
    if (region === 'all' || region === 'head') zeroRefHead.current = [];
  }, []);

  /**
   * 重置所有传感器数据为初始值
   */
  const resetAll = useCallback(() => {
    setSitData({ ...DEFAULT_SENSOR_DATA });
    setBackData({ ...DEFAULT_SENSOR_DATA });
    setHeadData({ ...DEFAULT_SENSOR_DATA });
    setPeakSit({ max: 0, total: 0 });
    setPeakBack({ max: 0, total: 0 });
    resetZero('all');
  }, [resetZero]);

  return {
    sitData,
    backData,
    headData,
    updateSitData,
    updateBackData,
    updateHeadData,
    updateFromMatrix,
    setZeroRef,
    getZeroRef,
    resetZero,
    resetAll,
    peakSit,
    peakBack,
  };
}
