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
import obfuscatorPlugin from "rollup-plugin-obfuscator";

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
    // `@shroom/frontend` 是 `file:../sdk/frontend` 装进来的 symlink。它的真实路径
    // 在 client/ 之外，Node/Vite 从那里向上找 node_modules 会走到 E:/shroom1/
    // 而不是 client/node_modules —— 那上面既没有 react 也没有 three。
    //
    // dedupe 在这里干两件事，**都不能少**：
    // 1. 让包内的裸 `react` / `three` import **能解析到**（指到 client 这一份）；
    // 2. 保证全应用只有一份 —— 两份 React 会让 hooks 直接崩，两份 three 会让
    //    `instanceof THREE.Xxx` 全部失效（渲染器里到处在用）。
    dedupe: ["react", "react-dom", "three"],
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
      plugins: [
        // 代码混淆插件 - 仅在生产构建时生效
        // 性能策略：关闭影响运行时性能的选项（controlFlowFlattening/deadCodeInjection/numbersToExpressions）
        // 保留不影响性能的静态保护（变量名混淆/字符串数组/字符串拆分）
        obfuscatorPlugin({
          // 渲染器注册表必须排除在混淆之外。插件是 transform 阶段工作的，
          // stringArray/splitStrings 会把 import('./xxx') 的路径字面量改写成
          // 运行时表达式，Rollup 随即无法静态分析，懒加载 chunk 拆不出来、
          // 被内联回主包——正好抵消掉插件化拆包的收益。
          // 这里只是注册表样板代码，没有需要保护的算法。
          //
          // `**/sdk/frontend/**` 是拆包后必须补的一条：渲染器本体已经搬进
          // `@shroom/frontend`，而它是 symlink，真实路径解析成
          // `E:/shroom1/sdk/frontend/...`，**匹配不上** `node_modules/**`。
          // 漏掉这条，包里那句 `import('./numMatrix/NumMatrixRenderer.jsx')`
          // 就会被 stringArray/splitStrings 改写，懒加载 chunk 塌回主包 ——
          // 正是上面这段注释警告的那个后果。
          exclude: ['node_modules/**', '**/src/renderers/**', '**/sdk/frontend/**'],
          options: {
            compact: true,
            // ✘ 关闭 - 将 if/for/while 转为 switch-case，破坏 V8 JIT 优化，导致 requestAnimationFrame 和 message handler 耗时激增
            controlFlowFlattening: false,
            // ✘ 关闭 - 注入无用代码块，增大代码体积，影响解析和执行速度
            deadCodeInjection: false,
            debugProtection: false,
            disableConsoleOutput: false,
            // ✔ 保留 - 变量名替换为 _0x 前缀，不影响运行时性能
            identifierNamesGenerator: 'hexadecimal',
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
            stringArrayWrappersType: 'variable',
            stringArrayThreshold: 0.75,
            // ✔ 保留 - 对象键名混淆
            transformObjectKeys: true,
            unicodeEscapeSequence: false,
          },
        }),
      ],
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

  // 测试配置
  // 写在 vite.config.js 而不是单独的 vitest.config.js，是为了让测试复用
  // 上面的 alias 与 esbuild jsx loader —— 单独配置文件会整个取代本文件。
  test: {
    environment: "node",
    // util.js 在模块顶层读取 localStorage，需要在导入前注入垫片
    setupFiles: ["./vitest.setup.js"],
    include: ["src/**/*.{test,spec}.{js,jsx}"],
  },

  // 允许 .js 和 .jsx 文件包含 JSX 语法
  // 生产环境自动移除 console.log 和 debugger
  esbuild: {
    include: /\.[jt]sx?$/,
    loader: 'jsx',
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
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
