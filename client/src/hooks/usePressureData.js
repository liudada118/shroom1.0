/**
 * usePressureData.js
 * 压力数据状态管理 Hook
 *
 * 将 Home.js 中大量分散的压力数据状态（total、mean、max、min、area、point 等）
 * 统一封装为结构化的状态对象，并提供标准化的更新接口。
 *
 * 使用示例：
 *   const { sitData, backData, updateSitData, resetAll } = usePressureData();
 */

import { useState, useCallback } from 'react';

/**
 * 单个传感器区域的压力数据结构
 */
const DEFAULT_SENSOR_DATA = {
  total: 0,    // 总压力
  mean: 0,     // 平均压力
  max: 0,      // 最大压力
  min: 0,      // 最小压力
  point: 0,    // 有效点数
  area: 0,     // 接触面积
  matrix: [],  // 压力矩阵数组
};

/**
 * @returns {{
 *   sitData: object,
 *   backData: object,
 *   headData: object,
 *   updateSitData: function,
 *   updateBackData: function,
 *   updateHeadData: function,
 *   resetAll: function,
 * }}
 */
export function usePressureData() {
  const [sitData, setSitData]   = useState({ ...DEFAULT_SENSOR_DATA });
  const [backData, setBackData] = useState({ ...DEFAULT_SENSOR_DATA });
  const [headData, setHeadData] = useState({ ...DEFAULT_SENSOR_DATA });

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
   * 重置所有传感器数据为初始值
   */
  const resetAll = useCallback(() => {
    setSitData({ ...DEFAULT_SENSOR_DATA });
    setBackData({ ...DEFAULT_SENSOR_DATA });
    setHeadData({ ...DEFAULT_SENSOR_DATA });
  }, []);

  return {
    sitData,
    backData,
    headData,
    updateSitData,
    updateBackData,
    updateHeadData,
    resetAll,
  };
}
