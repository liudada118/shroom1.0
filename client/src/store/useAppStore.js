/**
 * useAppStore.js - Zustand 全局状态管理
 *
 * 替代原有的 useState + useContext 组合，提供更简洁、高性能的状态管理。
 *
 * Zustand 优势:
 * 1. 无 Provider 包裹：不需要在组件树顶部添加 Context Provider
 * 2. 选择性订阅：组件只在其使用的状态变化时重渲染（自动优化）
 * 3. 中间件支持：内置 persist（持久化）、devtools（调试）等
 * 4. 极简 API：比 Redux 减少 80% 的模板代码
 *
 * 用法:
 * ```jsx
 * import { useAppStore } from '@/store/useAppStore';
 *
 * function MyComponent() {
 *   // 只订阅 sensorType，其他状态变化不会触发重渲染
 *   const sensorType = useAppStore(state => state.sensorType);
 *   const setSensorType = useAppStore(state => state.setSensorType);
 * }
 * ```
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

/**
 * 应用全局状态 Store
 */
const useAppStore = create(
  devtools(
    persist(
      (set, get) => ({
        // ============================================================
        // 授权状态
        // ============================================================
        isLicensed: false,
        licenseExpiry: null,

        setLicensed: (status, expiry = null) =>
          set(
            { isLicensed: status, licenseExpiry: expiry },
            false,
            "setLicensed"
          ),

        // ============================================================
        // 传感器状态
        // ============================================================
        sensorType: "press32",
        serialPort: null,
        isSerialOpen: false,
        availablePorts: [],

        setSensorType: (type) =>
          set({ sensorType: type }, false, "setSensorType"),

        setSerialPort: (port) =>
          set({ serialPort: port }, false, "setSerialPort"),

        setSerialOpen: (isOpen) =>
          set({ isSerialOpen: isOpen }, false, "setSerialOpen"),

        setAvailablePorts: (ports) =>
          set({ availablePorts: ports }, false, "setAvailablePorts"),

        // ============================================================
        // 采集状态
        // ============================================================
        isRecording: false,
        recordLabel: "",
        frameCount: 0,

        setRecording: (isRecording, label = "") =>
          set(
            { isRecording, recordLabel: label, frameCount: isRecording ? 0 : get().frameCount },
            false,
            "setRecording"
          ),

        incrementFrame: () =>
          set(
            (state) => ({ frameCount: state.frameCount + 1 }),
            false,
            "incrementFrame"
          ),

        resetFrameCount: () =>
          set({ frameCount: 0 }, false, "resetFrameCount"),

        // ============================================================
        // WebSocket 状态
        // ============================================================
        wsStatus: "disconnected", // 'connecting' | 'connected' | 'disconnected' | 'error'

        setWsStatus: (status) =>
          set({ wsStatus: status }, false, "setWsStatus"),

        // ============================================================
        // UI 状态
        // ============================================================
        sidebarCollapsed: false,
        currentPage: "home",
        language: "zh",
        theme: "light",

        setSidebarCollapsed: (collapsed) =>
          set({ sidebarCollapsed: collapsed }, false, "setSidebarCollapsed"),

        setCurrentPage: (page) =>
          set({ currentPage: page }, false, "setCurrentPage"),

        setLanguage: (lang) =>
          set({ language: lang }, false, "setLanguage"),

        setTheme: (theme) =>
          set({ theme: theme }, false, "setTheme"),

        // ============================================================
        // 数据回放状态
        // ============================================================
        playback: {
          isPlaying: false,
          currentFrame: 0,
          totalFrames: 0,
          speed: 1,
        },

        setPlaybackState: (playbackUpdate) =>
          set(
            (state) => ({
              playback: { ...state.playback, ...playbackUpdate },
            }),
            false,
            "setPlaybackState"
          ),

        // ============================================================
        // 压力数据统计（高频更新，独立管理）
        // ============================================================
        pressureStats: {
          max: 0,
          min: 0,
          avg: 0,
          sum: 0,
          activeCount: 0,
        },

        setPressureStats: (stats) =>
          set({ pressureStats: stats }, false, "setPressureStats"),

        // ============================================================
        // 批量操作
        // ============================================================

        /** 重置所有状态到初始值 */
        resetAll: () =>
          set(
            {
              isRecording: false,
              recordLabel: "",
              frameCount: 0,
              playback: {
                isPlaying: false,
                currentFrame: 0,
                totalFrames: 0,
                speed: 1,
              },
              pressureStats: { max: 0, min: 0, avg: 0, sum: 0, activeCount: 0 },
            },
            false,
            "resetAll"
          ),
      }),
      {
        name: "shroom-app-store",
        // 只持久化部分状态（不持久化运行时状态）
        partialize: (state) => ({
          sensorType: state.sensorType,
          language: state.language,
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
        }),
      }
    ),
    { name: "ShroomAppStore" }
  )
);

export { useAppStore };
export default useAppStore;
