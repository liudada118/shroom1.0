// vite.config.js
import { defineConfig } from "file:///E:/shroom1/client/node_modules/vite/dist/node/index.js";
import react from "file:///E:/shroom1/client/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
import obfuscatorPlugin from "file:///E:/shroom1/client/node_modules/rollup-plugin-obfuscator/dist/rollup-plugin-obfuscator.js";
var __vite_injected_original_dirname = "E:\\shroom1\\client";
var vite_config_default = defineConfig({
  // 处理大写扩展名的资源文件
  assetsInclude: ["**/*.PNG", "**/*.JPG", "**/*.JPEG", "**/*.GIF", "**/*.SVG"],
  plugins: [
    react({
      // 启用 Fast Refresh（替代原有的 react-hot-loader）
      fastRefresh: true
    })
  ],
  // 路径别名（替代 Webpack 的 resolve.alias）
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "@components": path.resolve(__vite_injected_original_dirname, "./src/components"),
      "@pages": path.resolve(__vite_injected_original_dirname, "./src/pages") || path.resolve(__vite_injected_original_dirname, "./src/page"),
      "@hooks": path.resolve(__vite_injected_original_dirname, "./src/hooks"),
      "@assets": path.resolve(__vite_injected_original_dirname, "./src/assets"),
      "@utils": path.resolve(__vite_injected_original_dirname, "./src/assets/util")
    }
  },
  // 开发服务器配置
  server: {
    port: 3e3,
    host: "0.0.0.0",
    // 代理 WebSocket 连接到后端
    proxy: {
      "/ws": {
        target: "ws://127.0.0.1:19999",
        ws: true
      }
    }
  },
  // 构建配置
  build: {
    outDir: "../build",
    // 输出到上级 build 目录，与 Electron 的加载路径一致
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
          "vendor-echarts": ["echarts"]
        }
      },
      plugins: [
        // 代码混淆插件 - 仅在生产构建时生效
        // 性能策略：关闭影响运行时性能的选项（controlFlowFlattening/deadCodeInjection/numbersToExpressions）
        // 保留不影响性能的静态保护（变量名混淆/字符串数组/字符串拆分）
        obfuscatorPlugin({
          options: {
            compact: true,
            // ✘ 关闭 - 将 if/for/while 转为 switch-case，破坏 V8 JIT 优化，导致 requestAnimationFrame 和 message handler 耗时激增
            controlFlowFlattening: false,
            // ✘ 关闭 - 注入无用代码块，增大代码体积，影响解析和执行速度
            deadCodeInjection: false,
            debugProtection: false,
            disableConsoleOutput: false,
            // ✔ 保留 - 变量名替换为 _0x 前缀，不影响运行时性能
            identifierNamesGenerator: "hexadecimal",
            log: false,
            // ✘ 关闭 - 将数字常量转为表达式，在热循环中增加计算开销
            numbersToExpressions: false,
            renameGlobals: false,
            selfDefending: false,
            simplify: true,
            // ✔ 保留 - 字符串拆分，仅影响初始化，不影响热循环
            splitStrings: true,
            splitStringsChunkLength: 10,
            // ✔ 保留 - 字符串数组化，不使用 base64 编码避免运行时解码开销
            stringArray: true,
            stringArrayCallsTransform: false,
            stringArrayEncoding: [],
            stringArrayIndexShift: true,
            stringArrayRotate: true,
            stringArrayShuffle: true,
            stringArrayWrappersCount: 1,
            stringArrayWrappersChainedCalls: false,
            stringArrayWrappersParametersMaxCount: 2,
            stringArrayWrappersType: "variable",
            stringArrayThreshold: 0.75,
            // ✔ 保留 - 对象键名混淆
            transformObjectKeys: true,
            unicodeEscapeSequence: false
          }
        })
      ]
    },
    // 设置 chunk 大小警告阈值
    chunkSizeWarningLimit: 1e3
  },
  // CSS 配置
  css: {
    preprocessorOptions: {
      scss: {
        // SCSS 全局变量（如果有）
        // additionalData: `@import "@/styles/variables.scss";`
      }
    }
  },
  // 允许 .js 和 .jsx 文件包含 JSX 语法
  // 生产环境自动移除 console.log 和 debugger
  esbuild: {
    include: /\.[jt]sx?$/,
    loader: "jsx",
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : []
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
      "@tweenjs/tween.js"
    ],
    esbuildOptions: {
      loader: {
        ".js": "jsx",
        ".jsx": "jsx"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxzaHJvb20xXFxcXGNsaWVudFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRTpcXFxcc2hyb29tMVxcXFxjbGllbnRcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L3Nocm9vbTEvY2xpZW50L3ZpdGUuY29uZmlnLmpzXCI7LyoqXHJcbiAqIHZpdGUuY29uZmlnLmpzIC0gVml0ZSBcdTY3ODRcdTVFRkFcdTkxNERcdTdGNkVcclxuICpcclxuICogXHU2NkZGXHU0RUUzXHU1MzlGXHU2NzA5XHU3Njg0IFdlYnBhY2sgNCArIHJlYWN0LXNjcmlwdHMgXHU5MTREXHU3RjZFXHJcbiAqIFx1NEYxOFx1NTJCRjpcclxuICogLSBcdTVGMDBcdTUzRDFcdTY3MERcdTUyQTFcdTU2NjhcdTU0MkZcdTUyQThcdTkwMUZcdTVFQTZcdTYzRDBcdTUzNDcgMTAtMTAweFxyXG4gKiAtIFx1NzBFRFx1NjZGNFx1NjVCMCAoSE1SKSBcdTYzQTVcdThGRDFcdTUzNzNcdTY1RjZcclxuICogLSBcdTY3ODRcdTVFRkFcdTkwMUZcdTVFQTZcdTY2M0VcdTg0NTdcdTYzRDBcdTUzNDdcdUZGMDhcdTU3RkFcdTRFOEUgZXNidWlsZCArIFJvbGx1cFx1RkYwOVxyXG4gKiAtIFx1OTE0RFx1N0Y2RVx1NjZGNFx1N0I4MFx1NkQwMVx1NzZGNFx1ODlDMlxyXG4gKi9cclxuXHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IG9iZnVzY2F0b3JQbHVnaW4gZnJvbSBcInJvbGx1cC1wbHVnaW4tb2JmdXNjYXRvclwiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICAvLyBcdTU5MDRcdTc0MDZcdTU5MjdcdTUxOTlcdTYyNjlcdTVDNTVcdTU0MERcdTc2ODRcdThENDRcdTZFOTBcdTY1ODdcdTRFRjZcclxuICBhc3NldHNJbmNsdWRlOiBbJyoqLyouUE5HJywgJyoqLyouSlBHJywgJyoqLyouSlBFRycsICcqKi8qLkdJRicsICcqKi8qLlNWRyddLFxyXG5cclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCh7XHJcbiAgICAgIC8vIFx1NTQyRlx1NzUyOCBGYXN0IFJlZnJlc2hcdUZGMDhcdTY2RkZcdTRFRTNcdTUzOUZcdTY3MDlcdTc2ODQgcmVhY3QtaG90LWxvYWRlclx1RkYwOVxyXG4gICAgICBmYXN0UmVmcmVzaDogdHJ1ZSxcclxuICAgIH0pLFxyXG4gIF0sXHJcblxyXG4gIC8vIFx1OERFRlx1NUY4NFx1NTIyQlx1NTQwRFx1RkYwOFx1NjZGRlx1NEVFMyBXZWJwYWNrIFx1NzY4NCByZXNvbHZlLmFsaWFzXHVGRjA5XHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICAgIFwiQGNvbXBvbmVudHNcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyYy9jb21wb25lbnRzXCIpLFxyXG4gICAgICBcIkBwYWdlc1wiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjL3BhZ2VzXCIpIHx8IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmMvcGFnZVwiKSxcclxuICAgICAgXCJAaG9va3NcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyYy9ob29rc1wiKSxcclxuICAgICAgXCJAYXNzZXRzXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmMvYXNzZXRzXCIpLFxyXG4gICAgICBcIkB1dGlsc1wiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjL2Fzc2V0cy91dGlsXCIpLFxyXG4gICAgfSxcclxuICB9LFxyXG5cclxuICAvLyBcdTVGMDBcdTUzRDFcdTY3MERcdTUyQTFcdTU2NjhcdTkxNERcdTdGNkVcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDMwMDAsXHJcbiAgICBob3N0OiBcIjAuMC4wLjBcIixcclxuICAgIC8vIFx1NEVFM1x1NzQwNiBXZWJTb2NrZXQgXHU4RkRFXHU2M0E1XHU1MjMwXHU1NDBFXHU3QUVGXHJcbiAgICBwcm94eToge1xyXG4gICAgICBcIi93c1wiOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcIndzOi8vMTI3LjAuMC4xOjE5OTk5XCIsXHJcbiAgICAgICAgd3M6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcblxyXG4gIC8vIFx1Njc4NFx1NUVGQVx1OTE0RFx1N0Y2RVxyXG4gIGJ1aWxkOiB7XHJcbiAgICBvdXREaXI6IFwiLi4vYnVpbGRcIiwgIC8vIFx1OEY5M1x1NTFGQVx1NTIzMFx1NEUwQVx1N0VBNyBidWlsZCBcdTc2RUVcdTVGNTVcdUZGMENcdTRFMEUgRWxlY3Ryb24gXHU3Njg0XHU1MkEwXHU4RjdEXHU4REVGXHU1Rjg0XHU0RTAwXHU4MUY0XHJcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcclxuICAgIHNvdXJjZW1hcDogZmFsc2UsXHJcbiAgICAvLyBcdTRGMThcdTUzMTZcdTUyMDZcdTUzMDVcdTdCNTZcdTc1NjVcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAvLyBcdTVDMDZcdTU5MjdcdTU3OEJcdTRGOURcdThENTZcdTUzNTVcdTcyRUNcdTUyMDZcdTUzMDVcdUZGMENcdTYzRDBcdTlBRDhcdTdGMTNcdTVCNThcdTU0N0RcdTRFMkRcdTczODdcclxuICAgICAgICAgIFwidmVuZG9yLXJlYWN0XCI6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCIsIFwicmVhY3Qtcm91dGVyLWRvbVwiXSxcclxuICAgICAgICAgIFwidmVuZG9yLXRocmVlXCI6IFtcInRocmVlXCJdLFxyXG4gICAgICAgICAgXCJ2ZW5kb3ItYW50ZFwiOiBbXCJhbnRkXCJdLFxyXG4gICAgICAgICAgXCJ2ZW5kb3ItZWNoYXJ0c1wiOiBbXCJlY2hhcnRzXCJdLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHBsdWdpbnM6IFtcclxuICAgICAgICAvLyBcdTRFRTNcdTc4MDFcdTZERjdcdTZEQzZcdTYzRDJcdTRFRjYgLSBcdTRFQzVcdTU3MjhcdTc1MUZcdTRFQTdcdTY3ODRcdTVFRkFcdTY1RjZcdTc1MUZcdTY1NDhcclxuICAgICAgICAvLyBcdTYwMjdcdTgwRkRcdTdCNTZcdTc1NjVcdUZGMUFcdTUxNzNcdTk1RURcdTVGNzFcdTU0Q0RcdThGRDBcdTg4NENcdTY1RjZcdTYwMjdcdTgwRkRcdTc2ODRcdTkwMDlcdTk4NzlcdUZGMDhjb250cm9sRmxvd0ZsYXR0ZW5pbmcvZGVhZENvZGVJbmplY3Rpb24vbnVtYmVyc1RvRXhwcmVzc2lvbnNcdUZGMDlcclxuICAgICAgICAvLyBcdTRGRERcdTc1NTlcdTRFMERcdTVGNzFcdTU0Q0RcdTYwMjdcdTgwRkRcdTc2ODRcdTk3NTlcdTYwMDFcdTRGRERcdTYyQTRcdUZGMDhcdTUzRDhcdTkxQ0ZcdTU0MERcdTZERjdcdTZEQzYvXHU1QjU3XHU3QjI2XHU0RTMyXHU2NTcwXHU3RUM0L1x1NUI1N1x1N0IyNlx1NEUzMlx1NjJDNlx1NTIwNlx1RkYwOVxyXG4gICAgICAgIG9iZnVzY2F0b3JQbHVnaW4oe1xyXG4gICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICBjb21wYWN0OiB0cnVlLFxyXG4gICAgICAgICAgICAvLyBcdTI3MTggXHU1MTczXHU5NUVEIC0gXHU1QzA2IGlmL2Zvci93aGlsZSBcdThGNkNcdTRFM0Egc3dpdGNoLWNhc2VcdUZGMENcdTc4MzRcdTU3NEYgVjggSklUIFx1NEYxOFx1NTMxNlx1RkYwQ1x1NUJGQ1x1ODFGNCByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgXHU1NDhDIG1lc3NhZ2UgaGFuZGxlciBcdTgwMTdcdTY1RjZcdTZGQzBcdTU4OUVcclxuICAgICAgICAgICAgY29udHJvbEZsb3dGbGF0dGVuaW5nOiBmYWxzZSxcclxuICAgICAgICAgICAgLy8gXHUyNzE4IFx1NTE3M1x1OTVFRCAtIFx1NkNFOFx1NTE2NVx1NjVFMFx1NzUyOFx1NEVFM1x1NzgwMVx1NTc1N1x1RkYwQ1x1NTg5RVx1NTkyN1x1NEVFM1x1NzgwMVx1NEY1M1x1NzlFRlx1RkYwQ1x1NUY3MVx1NTRDRFx1ODlFM1x1Njc5MFx1NTQ4Q1x1NjI2N1x1ODg0Q1x1OTAxRlx1NUVBNlxyXG4gICAgICAgICAgICBkZWFkQ29kZUluamVjdGlvbjogZmFsc2UsXHJcbiAgICAgICAgICAgIGRlYnVnUHJvdGVjdGlvbjogZmFsc2UsXHJcbiAgICAgICAgICAgIGRpc2FibGVDb25zb2xlT3V0cHV0OiBmYWxzZSxcclxuICAgICAgICAgICAgLy8gXHUyNzE0IFx1NEZERFx1NzU1OSAtIFx1NTNEOFx1OTFDRlx1NTQwRFx1NjZGRlx1NjM2Mlx1NEUzQSBfMHggXHU1MjREXHU3RjAwXHVGRjBDXHU0RTBEXHU1RjcxXHU1NENEXHU4RkQwXHU4ODRDXHU2NUY2XHU2MDI3XHU4MEZEXHJcbiAgICAgICAgICAgIGlkZW50aWZpZXJOYW1lc0dlbmVyYXRvcjogJ2hleGFkZWNpbWFsJyxcclxuICAgICAgICAgICAgbG9nOiBmYWxzZSxcclxuICAgICAgICAgICAgLy8gXHUyNzE4IFx1NTE3M1x1OTVFRCAtIFx1NUMwNlx1NjU3MFx1NUI1N1x1NUUzOFx1OTFDRlx1OEY2Q1x1NEUzQVx1ODg2OFx1OEZCRVx1NUYwRlx1RkYwQ1x1NTcyOFx1NzBFRFx1NUZBQVx1NzNBRlx1NEUyRFx1NTg5RVx1NTJBMFx1OEJBMVx1N0I5N1x1NUYwMFx1OTUwMFxyXG4gICAgICAgICAgICBudW1iZXJzVG9FeHByZXNzaW9uczogZmFsc2UsXHJcbiAgICAgICAgICAgIHJlbmFtZUdsb2JhbHM6IGZhbHNlLFxyXG4gICAgICAgICAgICBzZWxmRGVmZW5kaW5nOiBmYWxzZSxcclxuICAgICAgICAgICAgc2ltcGxpZnk6IHRydWUsXHJcbiAgICAgICAgICAgIC8vIFx1MjcxNCBcdTRGRERcdTc1NTkgLSBcdTVCNTdcdTdCMjZcdTRFMzJcdTYyQzZcdTUyMDZcdUZGMENcdTRFQzVcdTVGNzFcdTU0Q0RcdTUyMURcdTU5Q0JcdTUzMTZcdUZGMENcdTRFMERcdTVGNzFcdTU0Q0RcdTcwRURcdTVGQUFcdTczQUZcclxuICAgICAgICAgICAgc3BsaXRTdHJpbmdzOiB0cnVlLFxyXG4gICAgICAgICAgICBzcGxpdFN0cmluZ3NDaHVua0xlbmd0aDogMTAsXHJcbiAgICAgICAgICAgIC8vIFx1MjcxNCBcdTRGRERcdTc1NTkgLSBcdTVCNTdcdTdCMjZcdTRFMzJcdTY1NzBcdTdFQzRcdTUzMTZcdUZGMENcdTRFMERcdTRGN0ZcdTc1MjggYmFzZTY0IFx1N0YxNlx1NzgwMVx1OTA3Rlx1NTE0RFx1OEZEMFx1ODg0Q1x1NjVGNlx1ODlFM1x1NzgwMVx1NUYwMFx1OTUwMFxyXG4gICAgICAgICAgICBzdHJpbmdBcnJheTogdHJ1ZSxcclxuICAgICAgICAgICAgc3RyaW5nQXJyYXlDYWxsc1RyYW5zZm9ybTogZmFsc2UsXHJcbiAgICAgICAgICAgIHN0cmluZ0FycmF5RW5jb2Rpbmc6IFtdLFxyXG4gICAgICAgICAgICBzdHJpbmdBcnJheUluZGV4U2hpZnQ6IHRydWUsXHJcbiAgICAgICAgICAgIHN0cmluZ0FycmF5Um90YXRlOiB0cnVlLFxyXG4gICAgICAgICAgICBzdHJpbmdBcnJheVNodWZmbGU6IHRydWUsXHJcbiAgICAgICAgICAgIHN0cmluZ0FycmF5V3JhcHBlcnNDb3VudDogMSxcclxuICAgICAgICAgICAgc3RyaW5nQXJyYXlXcmFwcGVyc0NoYWluZWRDYWxsczogZmFsc2UsXHJcbiAgICAgICAgICAgIHN0cmluZ0FycmF5V3JhcHBlcnNQYXJhbWV0ZXJzTWF4Q291bnQ6IDIsXHJcbiAgICAgICAgICAgIHN0cmluZ0FycmF5V3JhcHBlcnNUeXBlOiAndmFyaWFibGUnLFxyXG4gICAgICAgICAgICBzdHJpbmdBcnJheVRocmVzaG9sZDogMC43NSxcclxuICAgICAgICAgICAgLy8gXHUyNzE0IFx1NEZERFx1NzU1OSAtIFx1NUJGOVx1OEM2MVx1OTUyRVx1NTQwRFx1NkRGN1x1NkRDNlxyXG4gICAgICAgICAgICB0cmFuc2Zvcm1PYmplY3RLZXlzOiB0cnVlLFxyXG4gICAgICAgICAgICB1bmljb2RlRXNjYXBlU2VxdWVuY2U6IGZhbHNlLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9KSxcclxuICAgICAgXSxcclxuICAgIH0sXHJcbiAgICAvLyBcdThCQkVcdTdGNkUgY2h1bmsgXHU1OTI3XHU1QzBGXHU4QjY2XHU1NDRBXHU5NjA4XHU1MDNDXHJcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXHJcbiAgfSxcclxuXHJcbiAgLy8gQ1NTIFx1OTE0RFx1N0Y2RVxyXG4gIGNzczoge1xyXG4gICAgcHJlcHJvY2Vzc29yT3B0aW9uczoge1xyXG4gICAgICBzY3NzOiB7XHJcbiAgICAgICAgLy8gU0NTUyBcdTUxNjhcdTVDNDBcdTUzRDhcdTkxQ0ZcdUZGMDhcdTU5ODJcdTY3OUNcdTY3MDlcdUZGMDlcclxuICAgICAgICAvLyBhZGRpdGlvbmFsRGF0YTogYEBpbXBvcnQgXCJAL3N0eWxlcy92YXJpYWJsZXMuc2Nzc1wiO2BcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuXHJcbiAgLy8gXHU1MTQxXHU4QkI4IC5qcyBcdTU0OEMgLmpzeCBcdTY1ODdcdTRFRjZcdTUzMDVcdTU0MkIgSlNYIFx1OEJFRFx1NkNENVxyXG4gIC8vIFx1NzUxRlx1NEVBN1x1NzNBRlx1NTg4M1x1ODFFQVx1NTJBOFx1NzlGQlx1OTY2NCBjb25zb2xlLmxvZyBcdTU0OEMgZGVidWdnZXJcclxuICBlc2J1aWxkOiB7XHJcbiAgICBpbmNsdWRlOiAvXFwuW2p0XXN4PyQvLFxyXG4gICAgbG9hZGVyOiAnanN4JyxcclxuICAgIGRyb3A6IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAncHJvZHVjdGlvbicgPyBbJ2NvbnNvbGUnLCAnZGVidWdnZXInXSA6IFtdLFxyXG4gIH0sXHJcblxyXG4gIC8vIFx1NEYxOFx1NTMxNlx1NEY5RFx1OEQ1Nlx1OTg4NFx1Njc4NFx1NUVGQVxyXG4gIG9wdGltaXplRGVwczoge1xyXG4gICAgaW5jbHVkZTogW1xyXG4gICAgICBcInJlYWN0XCIsXHJcbiAgICAgIFwicmVhY3QtZG9tXCIsXHJcbiAgICAgIFwicmVhY3Qtcm91dGVyLWRvbVwiLFxyXG4gICAgICBcInRocmVlXCIsXHJcbiAgICAgIFwiYW50ZFwiLFxyXG4gICAgICBcImVjaGFydHNcIixcclxuICAgICAgXCJAdHdlZW5qcy90d2Vlbi5qc1wiLFxyXG4gICAgXSxcclxuICAgIGVzYnVpbGRPcHRpb25zOiB7XHJcbiAgICAgIGxvYWRlcjoge1xyXG4gICAgICAgICcuanMnOiAnanN4JyxcclxuICAgICAgICAnLmpzeCc6ICdqc3gnLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQVdBLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsT0FBTyxzQkFBc0I7QUFkN0IsSUFBTSxtQ0FBbUM7QUFnQnpDLElBQU8sc0JBQVEsYUFBYTtBQUFBO0FBQUEsRUFFMUIsZUFBZSxDQUFDLFlBQVksWUFBWSxhQUFhLFlBQVksVUFBVTtBQUFBLEVBRTNFLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQTtBQUFBLE1BRUosYUFBYTtBQUFBLElBQ2YsQ0FBQztBQUFBLEVBQ0g7QUFBQTtBQUFBLEVBR0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFL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
