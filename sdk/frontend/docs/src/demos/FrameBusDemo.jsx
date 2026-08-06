/**
 * FrameBusDemo.jsx - 帧总线：`publishFrame` → `useSceneFrame`
 *
 * 这是本包 `useSceneFrame` 的**第一个消费者**。在此之前它只有实现和测试，
 * 没有任何示例 —— 一个「二开者消费帧的正式入口」却没人示范过怎么用。
 *
 * ## 为什么要有帧总线（而不是一路 props 传下去）
 *
 * 帧率 30–100Hz。走 props / setState 的话每帧都要重渲染整棵子树，
 * 主应用那边还要穿过 `CanvasCom` 故意砌的 `shouldComponentUpdate` 墙。
 * 总线让**数据流和渲染流解耦**：
 *
 * ```
 * 数据源 ──publishFrame()──▶ frameBus ──▶ subscribeFrames / useSceneFrame
 *                                          （回调里直接改 canvas / three，不 setState）
 * ```
 *
 * ## 三条通道，各走各的
 *
 * | 通道 | 用什么 | 会不会触发重渲染 |
 * | :--- | :--- | :--- |
 * | 每帧数据 | `frameChannel` 订阅总线，或 `values` 声明式喂 | 总线不会；`values` 会 |
 * | 视图状态 | props（`params` / `colormap` / …） | 会（本来就该会） |
 * | 真命令 | `rendererRef.current.xxx()` | 不会 |
 *
 * 这个 demo 同时示范两侧：
 * - **左边**是一个 `useSceneFrame` 的订阅者，把帧的统计信息显示出来 ——
 *   注意它 `setState` 了，那是因为它要显示文字。真渲染器在回调里直接画，不 setState。
 * - **右边**是 `RendererHost` 用 `frameChannel="sit"` 订阅同一条总线。**没有
 *   `values` prop** —— 这两条通路是互斥的，给了 `values` 就不该再给 `frameChannel`。
 *
 * ## `buildSceneFrame` 是干什么的
 *
 * 总线上跑的不是裸数组，是一个 `{ channels: { sit, back, … }, raw }` 结构。
 * `buildSceneFrame` 负责从原始数据拼出这个结构（含 `padThumbGap` / `toRaw256`
 * 这类老协议的补位规则）。这里数据是合成的、只有 sit 一条，所以直接手拼对象 ——
 * 真接后端时应该走 `buildSceneFrame`。
 */

import {
  clearLastFrame,
  publishFrame,
  NUM_MATRIX_PRESETS,
  normalizeNumMatrixParams,
  numMatrix,
} from '@shroom/frontend/core';
import { RendererHost, useSceneFrame } from '@shroom/frontend/react';
import React from 'react';

// 右边那块用的是「写自己的渲染器」那页造的第三方渲染器。引它是为了触发注册
// （模块级副作用），同时拿到 id —— 有 named import 在，这句不会被当成
// 无用 import 删掉。
import { HEAT_BARS_ID } from './registerHeatBars.js';
import { FRAME_INTERVAL_MS, syntheticFrame } from '../lib/syntheticFrame.js';

/**
 * 订阅侧：把总线上的帧摘出几个数显示。
 *
 * @returns {JSX.Element} 读数面板。
 */
function FrameReadout() {
  const [stats, setStats] = React.useState(null);
  // 计数放 ref：它每帧都变，进 state 就等于每帧重渲染，那就把总线的意义抵消了。
  const countRef = React.useRef(0);

  useSceneFrame((frame) => {
    countRef.current += 1;
    const values = frame?.channels?.sit;
    if (!Array.isArray(values) || !values.length) return;
    // 节流到 5Hz 再进 state —— 文字读数不需要 30fps。
    if (countRef.current % 6 !== 0) return;
    setStats({
      length: values.length,
      max: Math.max(...values),
      sum: values.reduce((acc, value) => acc + value, 0),
      frames: countRef.current,
    });
  });

  return (
    <div style={{ padding: '12px 14px', fontSize: 13, lineHeight: 2 }}>
      <div style={{ opacity: 0.6, marginBottom: 4 }}>useSceneFrame 订阅者</div>
      {stats ? (
        <>
          <div>已收帧数：{stats.frames}</div>
          <div>本帧点数：{stats.length}</div>
          <div>峰值：{stats.max}</div>
          <div>合力：{stats.sum}</div>
        </>
      ) : (
        <div style={{ opacity: 0.6 }}>等待第一帧…</div>
      )}
    </div>
  );
}

const PARAMS = normalizeNumMatrixParams(NUM_MATRIX_PRESETS.fast1024);
const GRID = numMatrix.deriveGrid(PARAMS);

/**
 * @returns {JSX.Element} 帧总线示例。
 */
export default function FrameBusDemo() {
  // 发布侧。卸载时调 `clearLastFrame()` —— 总线是**模块级单例**，它会把最后一帧
  // 留着，下一个订阅者一挂上就**同步收到这帧旧数据**。切走文档站这一页之后，
  // 别的页面的渲染器会先画一帧这里的合成数据再开始画自己的。
  //
  // 不用 `resetFrameBus()`：那个会把**全局所有订阅者**一起踢掉，是给测试用的。
  React.useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const values = syntheticFrame(
        (Date.now() - startedAt) / 1000,
        GRID.gridWidth,
        GRID.gridHeight,
      );
      // 总线上的帧是 { channels, raw } 结构，不是裸数组。
      publishFrame({ channels: { sit: values }, raw: null });
    }, FRAME_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      clearLastFrame();
    };
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', height: '100%' }}>
      <div style={{ borderRight: '1px solid #262b36', background: '#12141a' }}>
        <FrameReadout />
      </div>
      <div style={{ overflow: 'hidden', background: '#000' }}>
        {/* frameChannel 而不是 values —— 两条通路互斥，见文件头。 */}
        <RendererHost
          rendererId={HEAT_BARS_ID}
          label="热力格"
          params={{ rows: GRID.gridHeight, cols: GRID.gridWidth, valueMax: 255, gap: 1 }}
          frameChannel="sit"
          colormap={{ id: 'thermal' }}
        />
      </div>
    </div>
  );
}
