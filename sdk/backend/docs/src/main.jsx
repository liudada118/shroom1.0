/**
 * main.jsx - 文档站入口
 *
 * 只做两件事：把 `Buffer` 和 `process` 挂到全局，然后挂 React 根。
 *
 * 这两个都是**全局标识符**而不是 import，所以 `vite.config.js` 里那四个 alias 管不了
 * 它们 —— alias 只能改写 import / require。只能在这里塞进 `globalThis`。
 *
 * ## 那句 `globalThis.Buffer` 是干什么的
 *
 * `@shroom/backend` 是给 Node 写的，包里有几处直接用了全局 `Buffer`
 * （`protocol/displaySystemProtocol.js` 的 `decodeProtocolValues` / `validateFrame` /
 * `computeChecksum` 里的 `Buffer.from(...)`）。**它们没有 `require('buffer')`** ——
 * 在 Node 里 `Buffer` 本来就是全局的，写 require 反而多余。
 *
 * **这是文档站的代价，不是包的要求。** 在 Node 里用这个 SDK 不需要装 `buffer`。
 * 站上「坑与已知妥协」那页会把这几处垫片一起讲清楚。
 *
 * ## 那句 `globalThis.process` 更要紧：它是在**模块加载时**就被碰的
 *
 * 包里有两处顶层读环境变量，都在 `const` 初始化的那一行：
 *
 * - `logger.js:27,30` —— `process.env.LOG_LEVEL` / `process.env.LOG_FILE`
 * - `processing/lineOrders.js:35` —— `process.env.TEMP_FULL_BED_TEMPERATURE_K`
 *
 * 和 `Buffer` 不同（那个只在函数被调用时才碰），这两行在 `import` 一落地就执行。
 * 所以少了这个垫片不是「某个功能坏了」，而是**整页白屏**：
 * `ReferenceError: process is not defined`，页面连渲染都开始不了。
 *
 * 补上之后三个值都落到各自的默认分支（`info` 级别、不写日志文件、温度系数 1），
 * 也就是「没配环境变量」时在 Node 里的同一份行为。
 *
 * ⚠️ 这个坑 `vite build` 和 SSR 检查**都抓不到**：build 只管打包不管执行，
 * SSR 跑在 Node 里而 Node 有 `process`。它是拿浏览器真点一遍才露出来的 ——
 * 这条记在「坑与已知妥协」那页。
 */

import { Buffer } from 'buffer';
import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import './styles.css';

// 这两句必须在任何 `@shroom/backend` 子模块被**加载**之前跑完。
// import 会被提升，但各 page 是 `routes.js` 里的动态 import，真正加载发生在
// 用户切页的时候 —— 也就是这两句之后。
globalThis.Buffer = globalThis.Buffer || Buffer;
globalThis.process = globalThis.process || { env: {} };

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
