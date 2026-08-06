/**
 * NumMatrix.jsx - 数字矩阵渲染器
 *
 * 页面上的三张表（预设 / 参数范围 / 归一化结果）全部从 `core/numMatrix/params.js`
 * 直接读。改一行源码刷新页面就变 —— 这是本站相对 README 的核心增量。
 */

import {
  COLORMAPS,
  NUM_MATRIX_PRESETS,
  normalizeNumMatrixParams,
  numMatrix,
} from '@shroom/frontend/core';
import React from 'react';

import BasicNumMatrix from '../demos/BasicNumMatrix.jsx';
import DemoCard from '../components/DemoCard.jsx';
import demoSource from '../demos/BasicNumMatrix.jsx?raw';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

const PRESET_IDS = Object.keys(NUM_MATRIX_PRESETS);

/** 每条预设对应主应用里的哪个老场景 —— 这一列是手写的，源码里只有注释。 */
const PRESET_ORIGIN = {
  fast256: 'three/NumThreeColor copy.jsx（Fast256，16×16）',
  fast1024: 'three/NumThreeColor1024.jsx（Fast1024，尺寸由 manifest 决定）',
  fast1024sit: 'three/NumThreeColor1024sit.jsx（23×23，带分压，无相机操作）',
  smallBed12B: '原先靠 matrixName === "smallBed12B" 的字符串分支（12 位，除 10 显示）',
};

export default function NumMatrix() {
  const [presetId, setPresetId] = React.useState('fast1024');
  const [colormapId, setColormapId] = React.useState('classic');

  const params = React.useMemo(
    () => normalizeNumMatrixParams(NUM_MATRIX_PRESETS[presetId]),
    [presetId],
  );
  const grid = numMatrix.deriveGrid(params);

  const controls = (
    <>
      <label className="docs-field">
        <span>预设</span>
        <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
          {PRESET_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>
      <label className="docs-field">
        <span>配色</span>
        <select value={colormapId} onChange={(event) => setColormapId(event.target.value)}>
          {COLORMAPS.map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.label}</option>
          ))}
        </select>
      </label>
      <span className="docs-field">
        <span>网格</span>
        <span>{grid.gridWidth}×{grid.gridHeight} = {grid.count} 格</span>
      </span>
    </>
  );

  return (
    <Prose
      title="数字矩阵（numMatrix）"
      lede="每格显示压力数值，背景按配色着色。一次 draw call 画完整片矩阵 ——
            这是它能在 30–100Hz 下跑 1024 格的原因。"
    >
      <Section title="活预览">
        <DemoCard
          title="换预设 / 换配色，画面立刻变"
          sub="预设变更会触发场景重建；配色变更走 props，不重建"
          path="docs/src/demos/BasicNumMatrix.jsx"
          source={demoSource}
          controls={controls}
          height={380}
        >
          <BasicNumMatrix key={presetId} presetId={presetId} colormapId={colormapId} />
        </DemoCard>
        <Note title="为什么 key 要挂 presetId">
          换预设意味着网格尺寸变了，实例状态（纹理、instanced 缓冲）全部失效。
          靠 <C>key</C> 强制重建比在渲染器内部逐个 diff 参数要可靠得多，
          也是主应用一直在用的做法。换**配色**则不需要 —— 它是纯视图状态。
        </Note>
      </Section>

      <Section title={`${PRESET_IDS.length} 条预设`}>
        <p>
          它们不是 {PRESET_IDS.length} 个渲染器，是同一个渲染器的
          {PRESET_IDS.length} 组参数。三份 <C>NumThreeColor</C> 的布局公式代数等价
          （逐点验算见 <C>core/numMatrix/pipeline.test.js</C>），所以能收敛成一个。
        </p>
        <Table
          head={['id', '网格', '来自哪个老场景', '预设里显式给了什么']}
          rows={PRESET_IDS.map((id) => {
            const normalized = normalizeNumMatrixParams(NUM_MATRIX_PRESETS[id]);
            const derived = numMatrix.deriveGrid(normalized);
            return [
              <C>{id}</C>,
              `${derived.gridWidth}×${derived.gridHeight}`,
              PRESET_ORIGIN[id] || '—',
              <C>{JSON.stringify(NUM_MATRIX_PRESETS[id])}</C>,
            ];
          })}
        />
      </Section>

      <Section title={`${COLORMAPS.length} 条配色`}>
        <p>
          色带不是本站画的 —— 每条配色自带 <C>previewCss</C>
          （<C>core/colormaps.js</C>），直接当 <C>background</C> 用。
          数值通路（<C>sampleColormapRgb</C>）和 CSS 通路取的是同一条色带，
          包里有断言逐字比对，两处不会漂。
        </p>
        <Table
          head={['id', '名称', '色带']}
          rows={COLORMAPS.map((entry) => [
            <C>{entry.id}</C>,
            entry.label,
            <div className="docs-ramp" style={{ background: entry.previewCss }} />,
          ])}
        />
        <Note title="jet 为什么单列">
          另外 6 条是插值色标（<C>createStopColormap</C>），<C>jet</C> 是一条四段折线公式
          —— 全仓 18 处老配色用的那条阶梯。把它登记进 <C>COLORMAPS</C> 之后，
          画布配置器和 manifest 第一次能**显式**选到它；在此之前 jet 只能靠
          「不选配色」隐式命中。
        </Note>
      </Section>

      <Section title="参数范围">
        <p>
          下面这张表是 <C>numMatrix.PARAM_RANGES</C> 本身。归一化会把越界值夹回范围，
          非法值（<C>null</C> / 空串 / <C>NaN</C>）退回默认值而不是夹到 <C>min</C> ——
          这个区别很重要：缺省字段被夹到 min 会让「没填」变成「填了最小值」。
        </p>
        <Table
          head={['参数', 'min', 'max', `当前 ${presetId} 归一化后的值`]}
          rows={Object.entries(numMatrix.PARAM_RANGES).map(([name, range]) => [
            <C>{name}</C>,
            range.min,
            range.max,
            <C>{JSON.stringify(params[name])}</C>,
          ])}
        />
      </Section>

      <Section title="它暴露哪些命令式方法">
        <p>
          <C>sitData</C> / <C>sitValue</C> / <C>changeWsData</C> / <C>changeWsDataRaw</C>。
          用 <C>values</C> 声明式喂数据时不需要碰它们（宿主内部调 <C>sitData</C>）；
          需要在阈值变更后强制重着色之类的场合才用 <C>rendererRef</C>，
          见 <a href="#/api">RendererHost 入参与方法</a>。
        </p>
      </Section>
    </Prose>
  );
}
