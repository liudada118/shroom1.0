/**
 * NumMatrixRenderer.jsx - 参数化数字矩阵渲染器
 *
 * 替代 `components/three/` 下三份 NumThreeColor（Fast256 / Fast1024 /
 * Fast1024sit，共 1568 行）。三份逐行比对后的结论是**它们是同一个渲染器**：
 * 布局公式代数等价（证明见 `pipeline.test.js`），帧运算一字不差，真实差异
 * 只有五个开关，全部收进 `params.js`。
 *
 * 分三层，为的是后面接另两个后端时这一层不用重写：
 *
 * ```
 * NumMatrixRenderer.jsx   阈值来源、侧栏统计、命令式接口   ← 与画法无关
 * backends/sprite3d.js    three.js 精灵图 InstancedMesh    ← 只管画
 * pipeline.js             纯帧运算                          ← 可测
 * ```
 *
 * 照 `PointGridRenderer.jsx` 立的三步配方办：**写死常量参数化 → 模块级状态
 * 收进 `stateRef` → 补真正的卸载清理**。
 *
 * ## 两处从 props 改成参数的判断
 *
 * 原实现有两个按 `matrixName` 字符串写死的分支，二开的人加一个矩阵名就得回来
 * 改这个文件，所以都改成了声明式参数：
 *
 * | 原写法 | 现在 |
 * | :--- | :--- |
 * | `getDecimalScale(matrixName)`：`smallBed12B` → 10 | `decimalScale` 参数 |
 * | `getPressureChartPadding(matrixName)`：`smallBed12B` → 5 | `chartPadding` 参数 |
 * | `matrixName === 'smallBed12B' ? max : press` | `totalMetric` 参数 |
 * | `props.matrixName !== 'minzhen'` 才回写侧栏 | `manageSidebar` 参数 |
 *
 * 四者的取值都在 `LEGACY_PRESETS` 里，行为与原来逐字相同。
 *
 * 只有 `colormap` 与 `coordinateMap` 仍走 props 而不是 params —— 前者是用户
 * 在画布配置器里的实时选择，后者是坐标表数据，都由外层透传。两者已补进
 * `contract.js` 的 `RENDERER_PROPS`。
 */

import React, { useEffect, useImperativeHandle, useMemo, useRef } from 'react';

import '../../styles/canvas.css';
import { bed4096numParams } from '../../core/bed4096numParams.js';
import { buildCoordinateWorldLayout } from '../../core/coordinatePointLayout.js';
import { DUAL_CHANNEL_DEFAULTS, createThresholdState } from '../../core/displayThresholds.js';
import { findMax } from '../../core/frameMath.js';
import { deriveGrid, normalizeNumMatrixParams } from '../../core/numMatrix/params.js';
import { applyFloorFilter, computeFrameStats, createRollingWindow } from '../../core/numMatrix/pipeline.js';
import { createSpriteMatrixBackend } from './backends/sprite3d.js';

/**
 * 后端分派表。
 *
 * 只有一个条目不是过度设计 —— 它标的是扩展点：`canvas2d` 与 `webgl` 两个后端
 * 搬过来时只往这里加一行，本文件其余部分不动。
 */
const BACKEND_FACTORIES = {
  sprite3d: createSpriteMatrixBackend,
};

/**
 * 可共享的调参对象。
 *
 * `bed4096` 这一份是 `assets/util/bed4096numParams.js` 的模块级单例，
 * Bed4096 与 Fast256 共用它，为的是「在这两个展示形式之间切换时调参不重置」。
 * 声明式地写成 `sharedTuningKey: 'bed4096'`，而不是让外层传对象进来 ——
 * 后者没法在 manifest 里表达。
 */
const SHARED_TUNING = {
  bed4096: bed4096numParams,
};

/** 正点数曲线的 Y 轴留白。三份原实现都写死 100。 */
const POINT_CHART_PADDING = 100;

/**
 * 建一份调参状态。
 *
 * `valuep` / `valueprop` 不在 `displayThresholds` 的六个阈值里 —— 它们是
 * 分压重分配的两个参数，原实现是模块级 `var valuep = 0, valueprop = 1`
 * （所以两个实例会互相踩）。这里挂到同一个对象上，一起变成每实例。
 *
 * @param {string|null} sharedKey 共享调参对象的键；为空则建实例私有的。
 * @returns {object} 调参状态。
 */
function createTuningState(sharedKey) {
  const base = (sharedKey && SHARED_TUNING[sharedKey]) || createThresholdState(DUAL_CHANNEL_DEFAULTS);
  if (base.valuep === undefined) base.valuep = 0;
  if (base.valueprop === undefined) base.valueprop = 1;
  return base;
}

const NumMatrixRenderer = React.forwardRef((props, refs) => {
  // 按参数"内容"而非引用做记忆化。调用方常常传内联对象字面量，
  // 若依赖引用，每次父组件渲染都会重建整个 WebGL 场景。
  const paramsKey = JSON.stringify(normalizeNumMatrixParams(props.params));
  const config = useMemo(() => JSON.parse(paramsKey), [paramsKey]);

  const containerRef = useRef(null);
  const peakRef = useRef(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  // 全部运行期可变状态集中在此，替代原文件的模块级 `ndata1` /
  // `animationRequestId` / `materialRef` / `totalArr` / `totalPointArr`。
  const stateRef = useRef(null);
  if (stateRef.current === null) {
    stateRef.current = {
      tuning: createTuningState(config.sharedTuningKey),
      totalWindow: createRollingWindow(config.chartWindow),
      pointWindow: createRollingWindow(config.chartWindow),
      backend: null,
      api: null,
    };
  }

  // 坐标表决定实例数与布局，内容变了要重建场景，所以按内容记忆化。
  const coordinateKey = JSON.stringify(props.coordinateMap || null);
  const coordinateLayout = useMemo(
    () => buildCoordinateWorldLayout(JSON.parse(coordinateKey)),
    [coordinateKey],
  );

  // 配色换了由外层的 variantKey 整场重建，但这里仍按内容取值，
  // 免得命令式入口读到旧配色。
  const colormapKey = JSON.stringify(props.colormap || null);

  useEffect(() => {
    const state = stateRef.current;
    const container = containerRef.current;
    if (!container) return undefined;

    const grid = deriveGrid(config);
    const createBackend = BACKEND_FACTORIES[config.backend] || createSpriteMatrixBackend;

    state.totalWindow = createRollingWindow(config.chartWindow);
    state.pointWindow = createRollingWindow(config.chartWindow);

    state.backend = createBackend({
      container,
      config,
      grid,
      coordinateLayout,
      colormap: JSON.parse(colormapKey) || {},
      tuning: state.tuning,
      onPeak: (index) => {
        // 原实现是 `document.querySelector('.maxNum').innerHTML = index + 1`。
        // 走 ref 而不是全局选择器，两个实例才不会写到同一个 div；
        // 仍然直接改 DOM 而不进 state —— 这是 60Hz 的读数。
        if (peakRef.current) peakRef.current.textContent = String(index);
      },
    });

    /**
     * 收一帧数据并回写侧栏统计。
     *
     * 逐字对应 `NumThreeColor1024.jsx:98-202`。注意**下限过滤做两遍**：
     * 这里一遍（不取整，统计走浮点），后端画之前再一遍（取整）。
     * 两遍是幂等的，原实现就是这样，照抄。
     *
     * @param {object} prop 帧数据，`wsPointData` 是压力数组。
     * @param {boolean} local 回放模式；为真时不驱动侧栏曲线。
     */
    function sitData(prop, local) {
      const t = state.tuning;
      const dataArr = applyFloorFilter(prop?.wsPointData, t.valuef1);
      state.backend?.setFrame(dataArr);

      if (!config.manageSidebar) return;

      const { max, point, total, mean } = computeFrameStats(dataArr);
      const displayPress = config.totalMetric === 'max' ? max : total;
      const host = propsRef.current;

      host.data?.current?.changeData({
        meanPres: mean.toFixed(2),
        maxPres: max,
        point,
        totalPres: displayPress,
      });

      const totalArr = state.totalWindow.push(displayPress);
      if (!local) {
        host.data?.current?.handleCharts(totalArr, findMax(totalArr) + config.chartPadding);
      }

      const pointArr = state.pointWindow.push(point);
      if (!local) {
        host.data?.current?.handleChartsArea(pointArr, findMax(pointArr) + POINT_CHART_PADDING);
      }
    }

    /**
     * 应用调参变化。
     *
     * 守卫用 `!== undefined` 而不是 `if (valuej)`，抄的是 `NumThreeColor1024`
     * 那份 —— 另两份的真值守卫会把 0 当成"没传"忽略掉。滑块能不能出 0 没验，
     * 但接受 0 是这两种写法里更不会出错的一边。
     *
     * @param {object} configValue 六个阈值 + 分压两参数。
     */
    function sitValue(configValue = {}) {
      const t = state.tuning;
      const { valuej, valueg, value, valuel, valuef, valuelInit, press, prop } = configValue;
      if (valuej !== undefined) {
        t.valuej1 = valuej;
        state.backend?.retint();
      }
      if (valueg !== undefined) t.valueg1 = valueg;
      if (value !== undefined) t.value1 = value;
      if (valuel !== undefined) t.valuel1 = valuel;
      if (valuef !== undefined) t.valuef1 = valuef;
      if (valuelInit !== undefined) t.valuelInit1 = valuelInit;
      if (typeof press === 'number') t.valuep = press;
      if (typeof prop === 'number') t.valueprop = prop;
    }

    state.api = {
      sitData,
      sitValue,
      changeWsData: (wsPointData) => sitData({ wsPointData }, propsRef.current.local),
      changeWsDataRaw: (wsPointData) => sitData({ wsPointData }, propsRef.current.local),
    };

    state.backend.start();

    return () => {
      state.api = null;
      state.backend?.dispose();
      state.backend = null;
    };
    // 参数、坐标表、配色任一变化都要重建场景：它们决定实例数、
    // 顶点缓冲区大小与精灵图内容。
  }, [config, coordinateLayout, colormapKey]);

  // 命令式接口走 state.api 中转而非直接闭包，这样参数变化重建场景后，
  // 外部持有的 ref 仍然指向新场景，不会调到已释放的 three.js 对象。
  useImperativeHandle(refs, () => ({
    sitData: (...args) => stateRef.current.api?.sitData(...args),
    sitValue: (...args) => stateRef.current.api?.sitValue(...args),
    changeWsData: (...args) => stateRef.current.api?.changeWsData(...args),
    changeWsDataRaw: (...args) => stateRef.current.api?.changeWsDataRaw(...args),
  }), []);

  return (
    <>
      <div className="canvasNum" ref={containerRef} />
      <div
        className="maxNum"
        ref={peakRef}
        style={{ position: 'fixed', left: '5%', bottom: '5%', color: '#fff' }}
      />
    </>
  );
});

NumMatrixRenderer.displayName = 'NumMatrixRenderer';

export default NumMatrixRenderer;
