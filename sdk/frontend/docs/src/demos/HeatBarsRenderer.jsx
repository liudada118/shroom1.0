/**
 * HeatBarsRenderer.jsx - 一个第三方渲染器的完整实现（Canvas 2D）
 *
 * 这是「写自己的渲染器」那一页的主角。它**不是**包的一部分，是「二开者会写出来的
 * 那个文件」的样子。刻意用 Canvas 2D 而不是 three：
 *
 * - 不占 WebGL 上下文（浏览器上限约 8–16 个，文档站一页能挂十几块）；
 * - 证明**契约与 three 无关** —— 渲染器只要能吃 `params` + `sitData()`，
 *   用什么画都行（Canvas 2D / SVG / DOM / WebGPU）。
 *
 * ## 契约要求的三件事，逐条对上
 *
 * | 要求 | 这里怎么满足 |
 * | :--- | :--- |
 * | 实现 `RENDERER_PROPS` 的一个子集 | 读 `params` 与 `colormap`，其余不读 |
 * | 用 `useImperativeHandle` 暴露方法 | `sitData` / `sitValue` / `reset` |
 * | **不持有模块级可变状态** | 所有状态在 `useRef` 里，多实例互不干扰 |
 *
 * 第三条是最容易违的一条：把 `let latestFrame = []` 写在模块顶层，单实例时一切
 * 正常，同页挂两块就开始互相覆盖，而且现象是「其中一块偶尔闪一下别人的数据」，
 * 极难定位。契约把它写成硬要求就是因为这个。
 *
 * ## 暴露面必须与描述符的 `methods` **完全一致**
 *
 * `RendererHost` 挂载时会跑 `auditRendererContract`：
 * - 声明了没实现 → `console.error`
 * - 实现了没声明 → `console.warn`
 *
 * 所以下面 `useImperativeHandle` 里三个方法，和 `CustomRenderer.jsx` 里
 * `methods: ['sitData', 'sitValue', 'reset']` 是逐字对应的。多写一个方法就会在
 * 控制台留一条 warn —— 这也是文档站验收标准之一（「控制台无契约审计告警」）。
 *
 * 另外：`methods` 里的名字必须是 `core/contract.js` 的 `RENDERER_METHODS` 的键。
 * 写一个契约外的名字，`registerRenderer` 会直接拒绝注册（返回 false 并打错误），
 * 不会等到渲染时才崩。
 *
 * ## 它顺手示范了内置渲染器**没有**做的一件事
 *
 * 下面用 `ResizeObserver` 按**容器**尺寸画。点阵渲染器现在也遵守这个规则，
 * 数字矩阵的旧 3D 后端仍按**视口**尺寸画
 * （`sprite3d.js` 用 `window.innerHeight`、`PointGridRenderer` 用
 * `window.innerWidth/Height`），因为主应用里每个展示形式都独占整屏，
 * 这个区别从来没暴露过。新写渲染器的话，按容器画才是对的。
 *
 * ## 参数归一化不在这个文件里
 *
 * 它在 `heatBarsParams.js`。**这不是洁癖，是懒加载能不能切开的前提** ——
 * 注册文件和宿主文件都要用归一化函数，从这里 import 就是一条静态边，
 * 会把 `load: () => import('./HeatBarsRenderer.jsx')` 那句动态 import 废掉。
 * 原委写在那个文件的头部。
 */

import { sampleColormapRgb } from '@shroom/frontend/core';
import React from 'react';

import { normalizeHeatBarsParams } from './heatBarsParams.js';

/**
 * 热力格渲染器。
 *
 * @param {object} props 组件属性（契约的子集）。
 * @param {object} props.params 归一化后的参数。
 * @param {{id: string, reverse?: boolean}} [props.colormap] 配色。
 * @param {React.Ref} ref 命令式句柄。
 * @returns {JSX.Element} 画布。
 */
const HeatBarsRenderer = React.forwardRef(function HeatBarsRenderer({ params, colormap }, ref) {
  const canvasRef = React.useRef(null);
  // 全部运行期状态都在实例作用域里 —— 契约第 2 条。
  const stateRef = React.useRef({ frame: [], peak: 0 });

  const config = params || normalizeHeatBarsParams();
  const colormapId = colormap?.id || 'classic';
  const reverse = Boolean(colormap?.reverse);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const { rows, cols, valueMax, gap } = config;
    const frame = stateRef.current.frame;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    const cellW = width / cols;
    const cellH = height / rows;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const value = frame[row * cols + col] || 0;
        const [r, g, b] = sampleColormapRgb(colormapId, value / valueMax, { reverse });
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(col * cellW + gap / 2, row * cellH + gap / 2, cellW - gap, cellH - gap);
      }
    }
  }, [config, colormapId, reverse]);

  // 按容器尺寸设画布像素，并在尺寸变化时重画。
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // devicePixelRatio 不乘：这一步是画质取舍，跟契约无关，示例里省掉更好读。
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      draw();
    });
    observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, [draw]);

  React.useEffect(draw, [draw]);

  // 暴露面：三个，与描述符的 methods 逐字对应。
  React.useImperativeHandle(ref, () => ({
    /** 收一帧。宿主的 `values` 通路调的就是这个（`{ wsPointData }`）。 */
    sitData(prop) {
      const frame = prop?.wsPointData || [];
      stateRef.current.frame = frame;
      stateRef.current.peak = frame.length ? Math.max(...frame) : 0;
      draw();
    },
    /** 阈值 / 量程变更。这里只有"重画一次"这一件事要做。 */
    sitValue() {
      draw();
    },
    /** 复位。清帧并重画成全黑。 */
    reset() {
      stateRef.current = { frame: [], peak: 0 };
      draw();
    },
  }), [draw]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
});

export default HeatBarsRenderer;
