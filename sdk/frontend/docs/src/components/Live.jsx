/**
 * Live.jsx - 活预览的舞台
 *
 * 这个组件存在的理由有两条，都不是装饰性的。
 *
 * ## 一、两个内置渲染器都是「按视口尺寸」画的，不是按容器
 *
 * - `react/numMatrix/backends/sprite3d.js:247` —— `resolveCanvasSize(window.innerHeight, ratio)`
 * - `react/pointGrid/PointGridRenderer.jsx:319` —— `setSize(window.innerWidth, window.innerHeight)`
 *
 * 也就是说，把渲染器塞进一个 300px 高的卡片，它照样会画一张接近全屏大小的画布，
 * 然后溢出去。**这是包的既有行为，不是文档站的 bug**，主应用里每个展示形式都是
 * 独占整屏，所以从来没暴露过。
 *
 * 处理办法是：给渲染器一个**真实等于视口大小**的容器让它按自己的规矩画，
 * 再用 CSS `transform: scale()` 把整块画面等比缩进卡片。`transform` 只影响合成，
 * 不改 DOM 尺寸、不触发渲染器的 resize 分支 —— 所以看到的画面**就是**消费者
 * 全屏装出来的那一张，只是小了。
 *
 * 刻意**不**改渲染器去读容器尺寸：那要动到主应用在跑的两个渲染器，
 * 得配一整轮真机回归，不该混在文档站里做。记进积压，Pitfalls 页里明写。
 *
 * ⚠️ 缩放的代价：`pointGrid` 的框选用 `clientX/clientY` 配
 * `window.innerWidth/Height` 做投影（`react/three/pointPick.js`），缩放之后指针
 * 坐标与投影坐标对不上，框会选错点。所以缩放模式默认 `pointer-events: none`，
 * 需要真交互的地方用 `mode="actual"`（不缩放，卡片直接给到视口高度）。
 *
 * ## 二、WebGL 上下文有硬上限
 *
 * 浏览器同时活着的 WebGL 上下文上限约 8–16 个，超了会 `Too many active WebGL
 * contexts`，最老的那个被强制丢弃（画面变黑）。「预设 × 配色一览」那页有十几块，
 * 全挂上必爆。所以这里做两层限流：
 *
 * 1. `IntersectionObserver` —— 滚进视口才挂，滚出去就卸。
 * 2. **全局活跃数上限 4** —— 视口内同时可见超过 4 块时，按距视口中心的远近排序，
 *    只挂最近的 4 个。
 *
 * 两层都需要：只有 (1) 的话，一屏塞得下 6 块就还是超；只有 (2) 的话，
 * 首屏会把整页的卡片全排一遍。
 *
 * ⚠️ **明说的不确定性**：两个渲染器的 dispose 都没调 `forceContextLoss()`
 * （`renderer.dispose()` 不保证立即归还上下文，浏览器可能拖到 GC）。所以上限 4
 * 是经验值而不是保证。如果实测反复滚动仍然累积，要么把上限调到 2，要么去补
 * `forceContextLoss()` —— 后者是包内改动，属于另一轮的事。
 */

import React from 'react';

/** 同时挂载的渲染器上限。理由见文件头第二节。 */
const MAX_ACTIVE = 4;

/** 所有登记在册的舞台。模块级 —— 限流是跨组件的全局预算。 */
const CLAIMANTS = new Set();

/** 元素中心到视口中心的距离，用于排优先级。 */
function distanceToViewportCenter(element) {
  if (!element) return Number.POSITIVE_INFINITY;
  const rect = element.getBoundingClientRect();
  return Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2);
}

/**
 * 重新分配挂载额度。
 *
 * 每次有舞台进出视口都跑一遍：把"想挂"的按距视口中心排序，前 `MAX_ACTIVE` 个挂上，
 * 其余卸掉。幂等 —— 状态没变的不会调 setState。
 */
function reconcile() {
  const wanting = [...CLAIMANTS].filter((claimant) => claimant.wants);
  wanting.sort((a, b) => distanceToViewportCenter(a.element) - distanceToViewportCenter(b.element));

  const keep = new Set(wanting.slice(0, MAX_ACTIVE));
  CLAIMANTS.forEach((claimant) => {
    const should = keep.has(claimant);
    if (claimant.mounted === should) return;
    claimant.mounted = should;
    claimant.setMounted(should);
  });
}

/**
 * 活预览舞台。
 *
 * @param {object} props 组件属性。
 * @param {React.ReactNode} props.children 要挂的渲染器。**只在需要时才求值** ——
 *   传的是 children 而不是元素工厂，所以 React 会先创建元素对象（廉价），
 *   但组件本体只在真正挂进树里时才执行。
 * @param {number} [props.height] 卡片高度（px）。`mode="actual"` 下被忽略。
 * @param {'scaled'|'actual'|'fill'} [props.mode] 三种：
 *   - `scaled`（默认）—— 给渲染器一个视口大小的容器，再等比缩进卡片，交互关闭。
 *     **按视口尺寸画的渲染器只能用这个**（两个内置的都是）。
 *   - `actual` —— 不缩放，卡片直接给到视口高度。框选 / 旋转只在这个模式下坐标正确。
 *   - `fill` —— 容器就是卡片本身，不缩放。给**按容器尺寸画**的渲染器用
 *     （比如文档站那个 Canvas 2D 示例）—— 那才是新写渲染器该有的行为。
 * @param {string} [props.hint] 右下角角标文案。不传则按 mode 给默认文案。
 * @returns {JSX.Element} 舞台。
 */
export default function Live({ children, height = 340, mode = 'scaled', hint }) {
  const stageRef = React.useRef(null);
  const [mounted, setMounted] = React.useState(false);
  const [viewport, setViewport] = React.useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [stageWidth, setStageWidth] = React.useState(0);

  // 登记进全局预算 + 订阅可见性。
  React.useEffect(() => {
    const claimant = { element: stageRef.current, wants: false, mounted: false, setMounted };
    CLAIMANTS.add(claimant);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => { claimant.wants = entry.isIntersecting; });
        reconcile();
      },
      // 提前 200px 开始挂，滚到位时画面已经在跑，不是从黑屏开始。
      { rootMargin: '200px 0px' },
    );
    observer.observe(stageRef.current);

    return () => {
      observer.disconnect();
      CLAIMANTS.delete(claimant);
      // 自己退出后额度腾出来了，让别人补位。
      reconcile();
    };
  }, []);

  // 视口尺寸变了要重算缩放比 —— 渲染器认的画布尺寸就是视口尺寸。
  React.useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 卡片自身宽度（侧栏折叠、窗口变窄都会变）。
  React.useEffect(() => {
    const element = stageRef.current;
    const observer = new ResizeObserver(([entry]) => {
      setStageWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scaled = mode === 'scaled';
  const fill = mode === 'fill';
  const stageHeight = mode === 'actual' ? viewport.height : height;

  // 按宽高两个方向取更严的那一个，保证整块画面都在卡片里。
  const scale = scaled && stageWidth > 0
    ? Math.min(stageWidth / viewport.width, stageHeight / viewport.height)
    : 1;

  const defaultHint = scaled
    ? `已按 ${Math.round(scale * 100)}% 缩放展示 · 交互已关闭`
    : fill ? '按容器尺寸渲染 · 可交互' : '实际尺寸 · 可交互';

  // fill 模式下容器就是卡片本身；另两种模式给渲染器一个视口大小的容器。
  const scalerStyle = fill
    ? { position: 'absolute', inset: 0, left: 0, transform: 'none' }
    : {
      width: viewport.width,
      height: viewport.height,
      transform: `translateX(-50%) scale(${scale})`,
      // 缩放态下指针坐标与渲染器的投影坐标对不上，见文件头 ⚠️。
      pointerEvents: scaled ? 'none' : 'auto',
    };

  return (
    <div className="docs-stage" ref={stageRef} style={{ height: stageHeight }}>
      {mounted ? (
        <div className="docs-stage-scaler" style={scalerStyle}>
          {children}
        </div>
      ) : (
        <div className="docs-stage-idle">滚动到此处即开始渲染（WebGL 上下文限流）</div>
      )}
      <span className="docs-stage-hint">{hint || defaultHint}</span>
    </div>
  );
}
