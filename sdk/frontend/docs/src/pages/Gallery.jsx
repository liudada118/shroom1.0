/**
 * Gallery.jsx - 预设 × 配色一览
 *
 * 这一页是 `Live.jsx` 那套限流的**压力测试**：全展开有 11 块活的 WebGL 画面，
 * 而浏览器同时活着的上下文上限约 8–16 个。滚到底再滚回顶，控制台不该出现
 * `Too many active WebGL contexts` —— 这是站点自己的验收项之一。
 *
 * ## 为什么不画 4 × 7 = 28 格的完整矩阵
 *
 * 因为那 28 格里有 27 格是冗余的：预设决定**几何**（网格尺寸、精灵大小、相机），
 * 配色决定**上色**，两者正交。所以拆成两排看：
 *
 * - 一排固定配色、换预设 —— 看几何差异
 * - 一排固定预设、换配色 —— 看上色差异
 *
 * 28 格除了把上下文预算干爆之外，不会多告诉你任何事。
 *
 * ## 色带条不是自己画的
 *
 * `COLORMAPS` 每条自带 `previewCss`（一条 `linear-gradient`），直接当
 * `background` 用。站点画一遍等于把配色实现抄第二份 —— 改了 core 里的色标
 * 而色带条不跟着变，就是这页最容易出的那种谎。
 */

import { COLORMAPS, NUM_MATRIX_PRESETS, numMatrix, normalizeNumMatrixParams } from '@shroom/frontend/core';
import React from 'react';

import BasicNumMatrix from '../demos/BasicNumMatrix.jsx';
import Live from '../components/Live.jsx';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

const PRESET_IDS = Object.keys(NUM_MATRIX_PRESETS);

/** 换预设那一排统一用它上色，免得几何差异和配色差异混在一起看。 */
const BASELINE_COLORMAP = 'classic';

/** 换配色那一排统一用它的几何。 */
const BASELINE_PRESET = 'fast1024';

/** 缩略图高度。给得小一点，一屏能多塞几块，正好把限流逼出来。 */
const TILE_HEIGHT = 190;

/**
 * 一块缩略图。
 *
 * @param {object} props 组件属性。
 * @param {string} props.presetId 预设 id。
 * @param {string} props.colormapId 配色 id。
 * @param {string} props.cap 左侧标题。
 * @param {React.ReactNode} props.note 右侧小字。
 * @returns {JSX.Element} 缩略图。
 */
function Tile({ presetId, colormapId, cap, note }) {
  return (
    <div className="docs-tile">
      <div className="docs-tile-cap">
        <span>{cap}</span>
        <span>{note}</span>
      </div>
      <Live height={TILE_HEIGHT} hint=" ">
        <BasicNumMatrix presetId={presetId} colormapId={colormapId} />
      </Live>
    </div>
  );
}

export default function Gallery() {
  return (
    <Prose
      title="预设 × 配色一览"
      lede={`${PRESET_IDS.length} 条数字矩阵预设、${COLORMAPS.length} 套配色，
             全部从 core 的常量读出来渲染 —— 加一条预设或一套配色，这页自动多一块。`}
    >
      <Note title="这页同时是 WebGL 限流的压力测试">
        下面有 {PRESET_IDS.length + COLORMAPS.length} 块活画面，但
        <strong>同时最多只挂 4 块</strong>：<C>IntersectionObserver</C> 管进出视口，
        再叠一个全局活跃数上限，按距视口中心的远近排队。没滚到的地方显示
        「滚动到此处即开始渲染」而不是黑屏。
        <br />
        全部一次性挂上会撞 <C>Too many active WebGL contexts</C> ——
        浏览器会强制丢弃最老的那个上下文，表现为**某几块莫名其妙变黑**。
      </Note>

      <Section title={`换预设（配色固定为 ${BASELINE_COLORMAP}）`}>
        <p>
          预设决定的是<strong>几何</strong>：网格尺寸、精灵大小、相机高度比例、
          要不要分压。数据是同一条合成高斯斑，所以能直接看出网格密度的差别。
        </p>
        <div className="docs-grid">
          {PRESET_IDS.map((id) => {
            const grid = numMatrix.deriveGrid(normalizeNumMatrixParams(NUM_MATRIX_PRESETS[id]));
            return (
              <Tile
                key={id}
                presetId={id}
                colormapId={BASELINE_COLORMAP}
                cap={id}
                note={`${grid.gridWidth}×${grid.gridHeight}`}
              />
            );
          })}
        </div>
      </Section>

      <Section title={`换配色（预设固定为 ${BASELINE_PRESET}）`}>
        <p>
          配色走 <C>colormap</C> prop 而不是 <C>params</C>：它是「用户随时可改的视图状态」，
          换配色不该触发场景重建。渲染器只重烘纹理。
        </p>
        <div className="docs-grid">
          {COLORMAPS.map((colormap) => (
            <Tile
              key={colormap.id}
              presetId={BASELINE_PRESET}
              colormapId={colormap.id}
              cap={colormap.label}
              note={colormap.id}
            />
          ))}
        </div>
      </Section>

      <Section title="色带">
        <p>
          下面这些渐变条<strong>不是画出来的</strong>，是每条配色自带的
          <C>previewCss</C> 直接当 <C>background</C> 用（<C>core/colormaps.js</C>）。
          消费者做自己的配色选择器时也应该用它，不要另写一份渐变。
        </p>
        <Table
          head={['id', '名称', '色带', '实现']}
          rows={COLORMAPS.map((colormap) => [
            <C>{colormap.id}</C>,
            colormap.label,
            <div className="docs-ramp" style={{ background: colormap.previewCss }} />,
            colormap.id === 'classic'
              ? '手写的蓝→红分段，全仓老配色'
              : colormap.id === 'jet'
                ? '四段折线公式，不是插值色标'
                : '五点（灰度三点）插值色标',
          ])}
        />
        <Note tone="warn" title="jet 以前选不到">
          <C>jet</C> 是全仓 18 处老配色在用的那条阶梯，但它一直只能通过
          「不选配色」<strong>隐式</strong>命中。登记进 <C>COLORMAPS</C> 之后，
          画布配置器和 manifest 渲染器才第一次能显式选中它。
        </Note>
      </Section>

      <Section title="怎么用">
        <p>
          上面每一块都是同一个组件，只换两个字符串 ——
          源码在 <a href="#/num-matrix">数字矩阵</a> 那页的「显示代码」里：
        </p>
        <Table
          head={['要换什么', '改哪个']}
          rows={[
            ['几何（网格 / 精灵 / 相机）',
              <><C>params</C>（先过 <C>normalizeNumMatrixParams</C>）</>],
            ['上色', <><C>colormap={'{{ id: \'viridis\' }}'}</C></>],
            ['数据', <><C>values</C>（每帧换新数组）或 <C>frameChannel</C> 订总线</>],
          ]}
        />
        <p>
          点阵热力（3D）不在这页 —— 它一块就占一个视口，缩略图看不出东西，
          见 <a href="#/point-grid">点阵热力</a>。
        </p>
      </Section>
    </Prose>
  );
}
