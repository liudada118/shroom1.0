/**
 * Live.jsx - 活预览的舞台
 *
 * ## 为什么这份比前端站的短了 130 行
 *
 * 前端站的 `Live.jsx`（`sdk/frontend/docs/src/components/Live.jsx`）有两套机制：
 * 视口等比缩放，和 WebGL 上下文的全局限流。两者都是被**渲染器的既有行为**逼出来的
 * —— 那两个内置渲染器是按 `window.innerWidth/Height` 画的，而且浏览器同时活着的
 * WebGL 上下文有 8–16 个的硬上限。
 *
 * 后端包这侧**一块 WebGL 都没有**。活预览是表格、按钮、和用 CSS grid 画的矩阵热力图
 * —— 全都按容器尺寸走，随便挂多少块都不会撞上限。所以这里不抄那两套机制：
 * 抄过来就是一份永远不会被触发的分支，读者还得先弄明白它为什么在那儿。
 *
 * 于是这个组件只剩它本来该干的事：给活预览一块有边框、有角标、和正文区分得开的地方。
 */

import React from 'react';

/**
 * 活预览舞台。
 *
 * @param {object} props 组件属性。
 * @param {React.ReactNode} props.children 要跑的内容。
 * @param {number} [props.minHeight] 最小高度（px）。内容更高时自然撑开 ——
 *   后端这侧的演示（57 行的表格、1024 点的矩阵）高度差得很远，写死反而要处处覆盖。
 * @param {string} [props.hint] 右下角角标。默认那句是本站的核心声明，别轻易换掉。
 * @returns {JSX.Element} 舞台。
 */
export default function Live({ children, minHeight = 120, hint }) {
  return (
    <div className="docs-stage docs-stage-flow" style={{ minHeight }}>
      <div className="docs-stage-body">{children}</div>
      <span className="docs-stage-hint">{hint || '跑的是包里的真实现，不是抄的结果'}</span>
    </div>
  );
}
