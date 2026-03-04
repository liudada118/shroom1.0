/**
 * vite.config.js - Vite 构建配置
 *
 * 替代原有的 Webpack 4 + react-scripts 配置
 * 优势:
 * - 开发服务器启动速度提升 10-100x
 * - 热更新 (HMR) 接近即时
 * - 构建速度显著提升（基于 esbuild + Rollup）
 * - 配置更简洁直观
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // 处理大写扩展名的资源文件
  assetsInclude: ['**/*.PNG', '**/*.JPG', '**/*.JPEG', '**/*.GIF', '**/*.SVG'],

  plugins: [
    react({
      // 启用 Fast Refresh（替代原有的 react-hot-loader）
      fastRefresh: true,
    }),
  ],

  // 路径别名（替代 Webpack 的 resolve.alias）
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@pages": path.resolve(__dirname, "./src/pages") || path.resolve(__dirname, "./src/page"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@assets": path.resolve(__dirname, "./src/assets"),
      "@utils": path.resolve(__dirname, "./src/assets/util"),
    },
  },

  // 开发服务器配置
  server: {
    port: 3000,
    host: "0.0.0.0",
    // 代理 WebSocket 连接到后端
    proxy: {
      "/ws": {
        target: "ws://127.0.0.1:19999",
        ws: true,
      },
    },
  },

  // 构建配置
  build: {
    outDir: "../build",  // 输出到上级 build 目录，与 Electron 的加载路径一致
    emptyOutDir: true,
    sourcemap: false,
    // 优化分包策略
    rollupOptions: {
      output: {
        manualChunks: {
          // 将大型依赖单独分包，提高缓存命中率
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-three": ["three"],
          "vendor-antd": ["antd"],
          "vendor-echarts": ["echarts"],
        },
      },
    },
    // 设置 chunk 大小警告阈值
    chunkSizeWarningLimit: 1000,
  },

  // CSS 配置
  css: {
    preprocessorOptions: {
      scss: {
        // SCSS 全局变量（如果有）
        // additionalData: `@import "@/styles/variables.scss";`
      },
    },
  },

  // 允许 .js 和 .jsx 文件包含 JSX 语法
  esbuild: {
    include: /\.[jt]sx?$/,
    loader: 'jsx',
  },

  // 优化依赖预构建
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "three",
      "antd",
      "echarts",
      "@tweenjs/tween.js",
    ],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
        '.jsx': 'jsx',
      },
    },
  },
});
