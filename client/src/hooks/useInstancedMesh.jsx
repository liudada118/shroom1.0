/**
 * useInstancedMesh.js - InstancedMesh 渲染 Hook
 *
 * 将 InstancedMeshRenderer 封装为 React Hook，
 * 自动管理 Three.js 场景中的实例化网格生命周期。
 *
 * 用法:
 * ```jsx
 * function PressureView({ matrix }) {
 *   const { sceneRef, rendererRef } = useInstancedMesh({
 *     rows: 32, cols: 32, maxValue: 4095
 *   });
 *
 *   useEffect(() => {
 *     rendererRef.current?.update(matrix);
 *   }, [matrix]);
 *
 *   return <canvas ref={canvasRef} />;
 * }
 * ```
 */

import { useRef, useEffect, useCallback } from "react";
import InstancedMeshRenderer from "../components/three/InstancedMeshRenderer";

/**
 * @param {object} options
 * @param {THREE.Scene} options.scene - Three.js 场景实例
 * @param {number} options.rows - 矩阵行数
 * @param {number} options.cols - 矩阵列数
 * @param {number} options.maxValue - 压力最大值
 * @param {number} options.maxHeight - 3D 柱体最大高度
 * @param {string} options.geometry - 几何体类型
 */
export function useInstancedMesh(options = {}) {
  const rendererRef = useRef(null);
  const sceneRef = useRef(options.scene || null);

  // 初始化 InstancedMeshRenderer
  useEffect(() => {
    if (!sceneRef.current) return;

    rendererRef.current = new InstancedMeshRenderer(sceneRef.current, {
      rows: options.rows || 32,
      cols: options.cols || 32,
      maxValue: options.maxValue || 4095,
      maxHeight: options.maxHeight || 5,
      geometry: options.geometry || "box",
    });

    // 清理函数：组件卸载时释放 GPU 资源
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [sceneRef.current, options.rows, options.cols]);

  // 更新数据的回调
  const updateData = useCallback((matrix) => {
    if (rendererRef.current) {
      rendererRef.current.update(matrix);
    }
  }, []);

  // 调整尺寸的回调
  const resize = useCallback((rows, cols) => {
    if (rendererRef.current) {
      rendererRef.current.resize(rows, cols);
    }
  }, []);

  // 重置的回调
  const reset = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.reset();
    }
  }, []);

  return {
    rendererRef,
    sceneRef,
    updateData,
    resize,
    reset,
  };
}

export default useInstancedMesh;
