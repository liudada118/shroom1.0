/**
 * canvas2d.js - 数字矩阵的 Canvas 2D 后端（CSS 透视伪 3D）
 *
 * 由 `client/src/components/num/NumWs.jsx`（517 行，导出名 `Num3D`）机械变换
 * 而来。**这个后端里没有一行 WebGL** —— 名字里的 3D 来自两处纯 CSS 的错觉：
 *
 * 1. 每个数字按自身数值往上偏 `val * textHeight` 像素，形成柱状高度感；
 * 2. 外层 div 挂 `perspective: 500px` + `rotateX/rotateZ`，整片矩阵斜着看。
 *
 * 所以下拉框里「3D数据」走的是 canvas 2D，「原始数据」走的才是真 three.js
 * 精灵图（`sprite3d.js`）—— 这个对应关系反直觉，`core/numMatrix/params.js`
 * 顶部的表格也记了一笔。
 *
 * ## 与 sprite3d 的三处结构差异
 *
 * | | `sprite3d` | 本后端 |
 * | :--- | :--- | :--- |
 * | 帧循环 | `requestAnimationFrame` 常驻空转 | **有数据才排一次 RAF** |
 * | 尺寸 | 按视口（`window.innerHeight`） | 按格数 × 格尺寸，CSS 再夹到 85vw/85vh |
 * | 命令面 | 4 个（走 shell） | 4 个 + `commands` 里另外 8 个 |
 *
 * `commands` 那 8 个是这个后端存在的主要理由：`changeWsData147` /
 * `changeWsData256` / `changeWsDatafinger` / `changeWsDatapalm` **每次调用都换
 * 网格尺寸**（36×36 / 16×16 / 32×32），而 `sprite3d` 的实例数在建场景时就由
 * `deriveGrid(config)` 定死了，做不到。canvas 2D 改 `canvas.width` 就行，所以
 * 这几条留在这一层，shell 只负责原样转发（见 `commandNames`）。
 *
 * ## 搬过来时删掉的三样死码
 *
 * - `insertInterpFlat`（原文件 15-51 行，37 行）—— 全文无调用点。计划里原本
 *   写的是「它是纯函数，提进 `pipeline.js` 并补逐点测试」，实测是死码，
 *   所以是删，不是搬。
 * - `import hand from 'hand(1).png'`（314 KB）、`pressData`、`interp`、
 *   `rotate90` —— 四个 import 全文再无引用。
 * - `typeRef` —— `changeType(str)` 写它，没有任何地方读。方法本身保留
 *   （契约取暴露面的并集），但状态收进实例作用域。
 *
 * ## 两处必改（都不改画面）
 *
 * 1. 原文件的 `let totalArr = [], totalPointArr = []` 和解构出来的
 *    `valuej1 … valuelInit1` 都是**模块级可变状态**，违反契约第 2 条：同页
 *    挂两块会互相踩。前者搬到 shell 的 `createRollingWindow`，后者搬到
 *    shell 的 `tuning` 对象。
 * 2. `boxesForGauss` / `gaussBlur_2` / `boxBlur_2` 原来定义在
 *    `React.forwardRef` 的**函数体内**（每次渲染重新定义一遍），现在用
 *    `core/frameMath.js` 里那一份。
 */

import { isClassicColormap, sampleColormapRgb } from '../../../core/colormaps.js';
import { addSide, gaussBlur_2, jetRound, rotate90CW } from '../../../core/frameMath.js';

/**
 * `changeWsData147` 用的 150 点位表：手套 147 个采样点在 32×32 网格里的落点。
 *
 * 逐字搬自 `NumWs.jsx:206`。**原实现把它写在函数体内，每次调用重建一遍数组，
 * 然后就地改它**（下面那两个 `pointArr[index][1] += n` 的循环）—— 因为每次
 * 重建，就地改的副作用每帧都被抹掉，所以看不出问题。这里提到模块级之后必须
 * 改成不就地写，否则偏移会逐帧累加。做法见 `applyGlove147Layout`。
 */
const GLOVE_147_POINTS = [
  [16, 30], [16, 29], [16, 28], [2, 18], [2, 17], [2, 16], [1, 13], [1, 12], [1, 11],
  [2, 8], [2, 7], [2, 6], [5, 4], [5, 3], [5, 2],
  [17, 30], [17, 29], [17, 28], [3, 18], [3, 17], [3, 16], [2, 13], [2, 12], [2, 11],
  [3, 8], [3, 7], [3, 6], [6, 4], [6, 3], [6, 2],
  [18, 29], [18, 28], [18, 27], [4, 18], [4, 17], [4, 16], [3, 13], [3, 12], [3, 11],
  [4, 8], [4, 7], [4, 6], [7, 4], [7, 3], [7, 2],
  [19, 29], [19, 28], [19, 27], [5, 18], [5, 17], [5, 16], [4, 13], [4, 12], [4, 11],
  [5, 8], [5, 7], [5, 6], [8, 4], [8, 3], [8, 2],
  [22, 28], [22, 27], [22, 26], [8, 17], [8, 16], [8, 15], [7, 13], [7, 12], [7, 11],
  [8, 9], [8, 8], [8, 7], [11, 5], [11, 4], [11, 3],
  [19, 15], [19, 14], [19, 13], [19, 12], [19, 11], [19, 10], [19, 9], [19, 8], [19, 7],
  [19, 6], [19, 5], [19, 4],
  [21, 18], [21, 17], [21, 16], [21, 15], [21, 14], [21, 13], [21, 12], [21, 11], [21, 10],
  [21, 9], [21, 8], [21, 7], [21, 6], [21, 5], [21, 4],
  [23, 18], [23, 17], [23, 16], [23, 15], [23, 14], [23, 13], [23, 12], [23, 11], [23, 10],
  [23, 9], [23, 8], [23, 7], [23, 6], [23, 5], [23, 4],
  [25, 18], [25, 17], [25, 16], [25, 15], [25, 14], [25, 13], [25, 12], [25, 11], [25, 10],
  [25, 9], [25, 8], [25, 7], [25, 6], [25, 5], [25, 4],
  [27, 18], [27, 17], [27, 16], [27, 15], [27, 14], [27, 13], [27, 12], [27, 11], [27, 10],
  [27, 9], [27, 8], [27, 7], [27, 6], [27, 5], [27, 4],
];

/** 手套 147 的目标网格：32×32 补边 2 圈后是 36×36。抄自 `NumWs.jsx:250-251`。 */
const GLOVE_147_BASE = 32;
const GLOVE_147_PADDED = 36;
const GLOVE_147_BLUR = 1.2;

/** 手套原始 256 数据的矩阵尺寸。抄自 `NumWs.jsx:261`。 */
const GLOVE_256_ROWS = 16;
const GLOVE_256_COLS = 16;

/**
 * 把 147 点位铺进 32×32。
 *
 * 逐字对应 `NumWs.jsx:211-248`，只有一处改动：原实现直接改
 * `pointArr[i][0/1]`，靠「每次调用都重建这张表」把副作用抹掉。表提到模块级
 * 之后必须算到局部变量里，否则偏移会逐帧累加。
 *
 * 三段逻辑照抄，包括看起来可疑但确实是原行为的两处：
 * - 第一个循环按 `k` 落在哪个三点组里给列加 `+4 / +2 / +0 / -2`；
 * - 第二个循环里 `i >= 4*15` 那一支往下盖 3 行，其余只盖 1 行；
 *   **那一支还多写了一次 `newArr[index]`**（写两遍同一个值）。
 *
 * @param {number[]} wsPointData 手套原始帧，取前 150 个。
 * @returns {number[]} 长度 1024 的 32×32 帧。
 */
function applyGlove147Layout(wsPointData) {
  const newArr = new Array(GLOVE_147_BASE * GLOVE_147_BASE).fill(0);

  for (let i = 0; i < GLOVE_147_POINTS.length; i++) {
    const [baseRow, baseCol] = GLOVE_147_POINTS[i];
    const k = i % 15;

    let col = baseCol;
    if (k >= 3 && k < 6) col += 4;
    else if (k >= 6 && k < 9) col += 2;
    else if (k >= 9 && k < 12) col += 0;
    else if (k >= 12 && k < 15) col -= 2;

    let row = baseRow;
    if (i >= 15 && i < 4 * 15) row += Math.floor(i / 15);

    const index = row * GLOVE_147_BASE + col;
    newArr[index] = wsPointData[i];

    if (i >= 4 * 15 && i < 5 * 15) {
      for (let j = 1; j < 4; j++) {
        newArr[(row + j) * GLOVE_147_BASE + col] = wsPointData[i];
      }
    } else {
      newArr[(row + 1) * GLOVE_147_BASE + col] = wsPointData[i];
    }
  }

  return newArr;
}

/**
 * 把手套的一块子矩阵盖进 32×32 的指定位置。
 *
 * `changeWsDatafinger`（`NumWs.jsx:295-316`）与 `changeWsDatapalm`
 * （`318-339`）除了取哪几列、盖到哪几行之外一字不差，合成一个。
 *
 * @param {number[]} wsPointData 手套原始帧，按 15 列排布。
 * @param {{rows: number[], cols: number[], atRow: number, atCol: number}} region 取哪块、盖到哪。
 * @returns {number[]} 长度 1024 的 32×32 帧。
 */
function placeGloveRegion(wsPointData, region) {
  const values = [];
  for (let i = region.rows[0]; i < region.rows[1]; i++) {
    for (let j = region.cols[0]; j < region.cols[1]; j++) {
      values.push(wsPointData[i * 15 + j]);
    }
  }

  const newArr = new Array(GLOVE_147_BASE * GLOVE_147_BASE).fill(0);
  const width = region.cols[1] - region.cols[0];
  for (let k = 0; k < values.length; k++) {
    const row = region.atRow + Math.floor(k / width);
    const col = region.atCol + (k % width);
    newArr[row * GLOVE_147_BASE + col] = values[k];
  }
  return newArr;
}

/**
 * 创建 Canvas 2D 后端。
 *
 * 接口与 `sprite3d.js` 相同（`setFrame` / `retint` / `start` / `dispose`），
 * 另外返回两件 `sprite3d` 没有的东西：
 *
 * - `applyTuning()` —— shell 在 `sitValue` 末尾调，把 `value1` / `valuej1`
 *   拉进本后端的字高与色标上限。`sprite3d` 不实现它（shell 用可选链调）。
 * - `commands` —— 本后端特有的 8 个命令式方法，shell 原样转发到 ref 上。
 *
 * `coordinateLayout` 与 `onPeak` 收下但不用：原实现既不读物理坐标表，也不写
 * 峰值读数（那个 `.maxNum` div 在这个展示形式下是空的）。
 *
 * @param {object} options 创建参数。
 * @param {HTMLElement} options.container 挂 canvas 的容器（`.canvasNum`）。
 * @param {object} options.config 归一化后的渲染器参数。
 * @param {{gridWidth: number, gridHeight: number}} options.grid 网格尺寸。
 * @param {object} options.colormap 当前配色。
 * @param {object} options.tuning 实例私有的阈值对象。
 * @param {(frame: number[]) => void} [options.reportStats] 回写侧栏统计，由 shell 提供。
 * @returns {object} 后端实例。
 */
export function createCanvas2dMatrixBackend({
  container,
  config,
  grid,
  colormap,
  tuning,
  reportStats,
}) {
  const opts = config.canvas2d;

  // ---- DOM：外层黑底居中 → perspective 舞台 → 可旋转的 tilt 层 → canvas ----
  // 原实现是组件自己渲染一个 100vw/100vh 的 div；这里在 `.canvasNum` 内部
  // 重建同一层结构，样式逐条对应 `NumWs.jsx:474-513`。
  const stage = document.createElement('div');
  stage.style.cssText = 'width:100%;height:100%;display:flex;'
    + 'justify-content:center;align-items:center;background-color:#000;overflow:hidden;';

  const perspective = document.createElement('div');
  perspective.className = 'threeBoxF';
  perspective.style.cssText = 'transform-style:preserve-3d;perspective:500px;';

  const tilt = document.createElement('div');
  tilt.style.cssText = 'max-width:85vw;max-height:85vh;';

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;max-width:85vw;max-height:85vh;object-fit:contain;';

  tilt.appendChild(canvas);
  perspective.appendChild(tilt);
  stage.appendChild(perspective);
  container.replaceChildren(stage);

  // ---- 实例状态（原实现的 8 个 ref + 2 个 React state + 2 个模块级数组）----
  let ctx = null;
  let texW = grid.gridWidth;
  let texH = grid.gridHeight;
  let pending = null;
  let rafId = null;
  let started = false;
  let disposed = false;

  // 原实现是 `useRef(3)` / `useRef(30)` 的初值，**不是**阈值默认值 ——
  // 首帧到 Home 第一次推阈值之间用的就是这两个数。之后由 applyTuning 覆盖。
  let textHeight = opts.textHeight;
  let textColorMax = opts.textColorMax;

  // `changeType(str)` 的落点。全仓没有任何地方读它，保留是因为契约取的是
  // 暴露面的并集（见 core/contract.js）。
  let matrixType = 'hand';

  let rotateX = opts.baseTiltDeg;
  let rotateZ = 0;

  const scale = (globalThis.document?.documentElement?.clientWidth || 1920) / 1920;
  const useClassic = isClassicColormap(colormap);

  function applyTransform() {
    tilt.style.transform = `rotateX(${rotateX}deg) rotateZ(${rotateZ}deg)`;
  }
  applyTransform();

  /**
   * 按 canvas 尺寸重建 2d 上下文。尺寸没变就复用 —— 给 `canvas.width` 赋值
   * 会清空画布，逐帧赋值会闪。抄自 `NumWs.jsx:147-155`。
   *
   * @param {number} w 网格列数。
   * @param {number} h 网格行数。
   */
  function resize(w, h) {
    if (texW === w && texH === h && ctx) return;
    texW = w;
    texH = h;
    canvas.width = w * opts.cellWidth;
    canvas.height = h * opts.cellHeight + opts.extraTop;
    ctx = canvas.getContext('2d');
  }

  /**
   * 取一格的颜色。
   *
   * classic 走 `jetRound(0, textColorMax, val * colorValueScale)` —— 与原实现
   * 逐字相同（原文件 `import { jetRound as jet }`，容易看成走的是 `jet`）。
   * 显式选了别的配色才换成色标采样，这是搬进包顺带获得的能力，老展示系统
   * 走不到这条分支。
   *
   * @param {number} value 该格数值。
   * @returns {number[]} 0-255 的 rgb 三元组。
   */
  function cellRgb(value) {
    const x = value * opts.colorValueScale;
    if (useClassic) return jetRound(0, textColorMax, x);
    return sampleColormapRgb(colormap.id, textColorMax > 0 ? x / textColorMax : 0, colormap);
  }

  /**
   * 画一帧。逐字对应 `NumWs.jsx:59-89` 的 `render3DCanvas` 加 `158-185` 的
   * RAF 回调，包括那两处看起来多余、实际决定观感的操作：
   *
   * 1. `ctx.translate(0, extraTop)` 之后才 `clearRect(0, 0, W, H)` —— 所以
   *    **顶部那条 `extraTop` 高的带子不会被清掉**，上一帧升到带子里的数字会留住；
   * 2. 于是 `restore()` 之后再拿黑色填一次那条带子。净效果是：数字往上升出
   *    矩阵区就被切掉。这是现在的画面，别"顺手修正"成不切。
   *
   * @param {number[]} flatData 该帧数据。
   * @param {number} w 列数。
   * @param {number} h 行数。
   */
  function paint(flatData, w, h) {
    ctx.save();
    ctx.translate(0, opts.extraTop);

    const canvasW = canvas.width;
    const canvasH = canvas.height;
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const fontSize = Math.max(8, Math.round(scale * opts.fontScale));
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        const val = flatData[i * w + j];
        const [r, g, b] = cellRgb(val);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillText(
          Math.round(val).toString(),
          j * opts.cellWidth + opts.cellWidth / 2,
          i * opts.cellHeight + opts.cellHeight / 2 - val * textHeight,
        );
      }
    }

    ctx.restore();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w * opts.cellWidth, opts.extraTop);
  }

  /** 排一次 RAF。已经排了就不重复排 —— 高频推帧时只画最后一帧。 */
  function schedule() {
    if (rafId !== null || disposed) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (!started || disposed || pending === null) return;
      const { data, w, h } = pending;
      pending = null;
      if (ctx) paint(data, w, h);
    });
  }

  /**
   * 交一帧给渲染。
   *
   * @param {number[]} data 已按目标网格排好的帧。
   * @param {number} w 列数。
   * @param {number} h 行数。
   */
  function submit(data, w, h) {
    resize(w, h);
    pending = { data, w, h };
    schedule();
  }

  return {
    /**
     * 常规通道：shell 已经按 `valuef1` 过滤过，这里补上旋转、总量守卫和模糊。
     *
     * 顺序与原实现（`NumWs.jsx:187-203`）等价：原实现先旋转再过滤，过滤是
     * 逐元素的、旋转是置换，两者可交换。
     *
     * ⚠️ **`rotate90CW` 的尺寸是写死的 32×32，与 `grid` 无关** —— 原实现如此。
     * `carCol` 预设的网格是 10×9（90 个点），按 32×32 旋转会得到一个长 1024、
     * 大部分是 `undefined` 的数组，于是 `total` 是 `NaN`、总量守卫恒不触发。
     * 这是 `num3D` 形式下 `carCol` 现在的行为，照搬；要改是单独一件事。
     *
     * @param {number[]} nextFrame 已过滤的帧。
     */
    setFrame(nextFrame) {
      if (!Array.isArray(nextFrame)) return;
      const rotated = rotate90CW(nextFrame, opts.rotateHeight, opts.rotateWidth);

      let data = rotated;
      const total = rotated.reduce((a, b) => a + b, 0);
      if (total < tuning.valuelInit1) {
        data = new Array(grid.gridWidth * grid.gridHeight).fill(0);
      }

      submit(
        gaussBlur_2(data, grid.gridWidth, grid.gridHeight, opts.blurSigma),
        grid.gridWidth,
        grid.gridHeight,
      );
    },

    /** 配色/色标上限变了重画一帧。没有纹理要重烘，所以只是排一次 RAF。 */
    retint() {
      if (disposed) return;
      textColorMax = tuning.valuej1;
      schedule();
    },

    /**
     * 吸收阈值变化。对应原实现 `sitValue` 里那两句
     * `textHeightRef.current = value` / `textColorRef.current = valuej`。
     *
     * **守卫是真值判断而不是 `!== undefined`** —— 原实现写的是 `if (value)`，
     * 所以 0 会被当成"没传"忽略掉。shell 那一层用的是 `!== undefined`
     * （抄的 `NumThreeColor1024`），两者对 0 的处理不同，这里保原实现的。
     *
     * @param {object} changed `sitValue` 收到的那个对象。
     */
    applyTuning(changed = {}) {
      if (changed.value) textHeight = changed.value;
      if (changed.valuej) textColorMax = changed.valuej;
    },

    /** 启动。没有常驻帧循环 —— 有数据才画，所以这里只是开闸。 */
    start() {
      if (disposed) return;
      started = true;
      if (pending !== null) schedule();
    },

    /** 释放。没有 GPU 资源，只要停掉在途的 RAF 并清空容器。 */
    dispose() {
      if (disposed) return;
      disposed = true;
      started = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      pending = null;
      ctx = null;
      container.replaceChildren();
    },

    /**
     * 本后端特有的命令式方法。shell 原样转发到 ref 上，名字见 `commandNames`。
     *
     * 前四个之所以不能走 `setFrame`：**它们每次调用都换网格尺寸**
     * （36×36 / 16×16 / 32×32），而 `setFrame` 走的是 `deriveGrid(config)`
     * 定死的那一个。
     */
    commands: {
      /** 手套 147 点位：铺进 32×32 → 补边成 36×36 → 模糊。`NumWs.jsx:205-257`。 */
      changeWsData147(wsPointData) {
        if (!Array.isArray(wsPointData)) return;
        reportStats?.(wsPointData.slice());
        const laid = applyGlove147Layout(wsPointData);
        const padded = addSide(laid, GLOVE_147_BASE, GLOVE_147_BASE, 2, 2, 0);
        submit(
          gaussBlur_2(padded, GLOVE_147_PADDED, GLOVE_147_PADDED, GLOVE_147_BLUR),
          GLOVE_147_PADDED,
          GLOVE_147_PADDED,
        );
      },

      /**
       * 手套原始 256 数据：直接当 16×16 画，**不模糊**。`NumWs.jsx:260-277`。
       * 这一条自己做下限过滤与总量守卫（它绕开了 shell 的 `sitData`）。
       */
      changeWsData256(wsPointData) {
        if (!Array.isArray(wsPointData)) return;
        const size = GLOVE_256_ROWS * GLOVE_256_COLS;
        const flat = new Array(size).fill(0);
        for (let i = 0; i < Math.min(wsPointData.length, size); i++) flat[i] = wsPointData[i];
        reportStats?.(flat);

        let data = flat.map((a) => (a - tuning.valuef1 < 0 ? 0 : a));
        if (data.reduce((a, b) => a + b, 0) < tuning.valuelInit1) {
          data = new Array(size).fill(0);
        }
        submit(data, GLOVE_256_COLS, GLOVE_256_ROWS);
      },

      /** 只画手指那 3×4 块，盖在 32×32 的第 13-16 行、第 14-16 列。`NumWs.jsx:295-316`。 */
      changeWsDatafinger(wsPointData) {
        if (!Array.isArray(wsPointData)) return;
        const laid = placeGloveRegion(wsPointData, {
          rows: [0, 4], cols: [6, 9], atRow: 13, atCol: 14,
        });
        submit(
          gaussBlur_2(laid, GLOVE_147_BASE, GLOVE_147_BASE, opts.blurSigma),
          GLOVE_147_BASE,
          GLOVE_147_BASE,
        );
      },

      /** 只画手掌那 15×5 块，盖在 32×32 的第 13-17 行、第 7-21 列。`NumWs.jsx:318-339`。 */
      changeWsDatapalm(wsPointData) {
        if (!Array.isArray(wsPointData)) return;
        const laid = placeGloveRegion(wsPointData, {
          rows: [0, 5], cols: [0, 15], atRow: 13, atCol: 7,
        });
        submit(
          gaussBlur_2(laid, GLOVE_147_BASE, GLOVE_147_BASE, opts.blurSigma),
          GLOVE_147_BASE,
          GLOVE_147_BASE,
        );
      },

      /** 原实现就是空函数体。保留是因为 `components/foot/Car.jsx:380` 在调它。 */
      drawContent() {},

      /** 写一个没人读的字符串。见文件头「删掉的三样死码」。 */
      changeType(str) {
        matrixType = str;
        return matrixType;
      },

      /**
       * 单轴视角。`value` 是 `rotationPresets` 的下标，越界当 0。
       * x 轴在 `baseTiltDeg` 的基础上叠加，z 轴不叠 —— 原实现如此。
       */
      changePointRotation({ direction, value } = {}) {
        const deg = (opts.rotationPresets[value] || 0) * (180 / Math.PI);
        if (direction === 'x') rotateX = opts.baseTiltDeg + deg;
        else if (direction === 'z') rotateZ = deg;
        applyTransform();
      },

      /** 双轴视角，语义同上。`NumWs.jsx:392-401`。 */
      changeGroupRotate({ x, z } = {}) {
        if (x !== undefined) rotateX = opts.baseTiltDeg + (opts.rotationPresets[x] || 0) * (180 / Math.PI);
        if (z !== undefined) rotateZ = (opts.rotationPresets[z] || 0) * (180 / Math.PI);
        applyTransform();
      },

      /** 回到默认俯角。 */
      reset() {
        rotateX = opts.baseTiltDeg;
        rotateZ = 0;
        applyTransform();
      },

      /** 完全正对屏幕。 */
      setFrontView() {
        rotateX = 0;
        rotateZ = 0;
        applyTransform();
      },
    },
  };
}

/**
 * 本后端往 ref 上多挂的方法名。
 *
 * 挂在工厂函数上而不是 `NumMatrixRenderer.jsx` 里再写一张表 —— 两张平行的表
 * 一定会漂移。shell 读这个数组构造 `useImperativeHandle`。
 *
 * 这 10 个名字必须全部在 `core/contract.js` 的 `RENDERER_METHODS` 里，
 * 否则 `registerRenderer` 会**静默拒绝注册**（返回 false，不抛错），现象是白屏。
 */
createCanvas2dMatrixBackend.commandNames = [
  'changeWsData147',
  'changeWsData256',
  'changeWsDatafinger',
  'changeWsDatapalm',
  'drawContent',
  'changeType',
  'changePointRotation',
  'changeGroupRotate',
  'reset',
  'setFrontView',
];

export default createCanvas2dMatrixBackend;
