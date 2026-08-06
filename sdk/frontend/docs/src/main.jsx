/**
 * main.jsx - 文档站入口
 *
 * 只做三件事：注册内置渲染器、引包自带的画布样式、挂 React 根。
 *
 * `registerBuiltinRenderers()` 这一句其实是**冗余**的 —— `react/RendererHost.jsx`
 * 在模块加载时已经调过一次。这里显式再调一遍是为了让入口自解释：读者打开
 * 第一个文件就该看到「渲染器要先注册」这件事，而不是靠副作用碰巧生效。
 * 注册幂等（按 id 覆盖），多调一次没有代价。
 *
 * `@shroom/frontend/styles/canvas.css` 是包里那 6 行 `.canvasNum`
 * （`height:100vh` + 黑底 + 居中）。数字矩阵渲染器的根节点就用这个类名，
 * 不引它画面会塌成 0 高。**这条是消费者义务之一**，Pitfalls 页里有。
 */

import { registerBuiltinRenderers } from '@shroom/frontend/react';
import '@shroom/frontend/styles/canvas.css';
import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import './styles.css';

registerBuiltinRenderers();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
