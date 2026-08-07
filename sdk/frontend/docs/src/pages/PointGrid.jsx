/**
 * PointGrid.jsx - 点阵热力（3D）
 *
 * 这一页有一块 `mode="actual"` 的预览（不缩放、给到视口高度），因为框选与视角旋转
 * 的坐标换算依赖 `window.innerWidth/Height`，缩放之后就选错点了。
 * 那是 `react/three/pointPick.js` 的既有缺陷（它自己的注释写着「此处应使用画布长和宽」），
 * 本轮不修 —— 改签名要动 35 个 import 方。页面里明写。
 */

import {
  POINT_GRID_PRESETS,
  normalizePointGridParams,
  pointGrid,
} from '@shroom/frontend/core';
import React from 'react';

import DemoCard from '../components/DemoCard.jsx';
import PointGridDemo from '../demos/PointGridDemo.jsx';
import demoSource from '../demos/PointGridDemo.jsx?raw';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

const PRESET_IDS = Object.keys(POINT_GRID_PRESETS);

export default function PointGrid() {
  const [presetId, setPresetId] = React.useState('matCol');

  const params = React.useMemo(
    () => normalizePointGridParams(POINT_GRID_PRESETS[presetId]),
    [presetId],
  );
  const gridSize = pointGrid.deriveGridSize(params.sit);

  const controls = (
    <>
      <label className="docs-field">
        <span>预设</span>
        <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
          {PRESET_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>
      <span className="docs-field">
        <span>输入矩阵</span>
        <span>{params.sit.num2}×{params.sit.num1} = {params.sit.num1 * params.sit.num2} 个数</span>
      </span>
      <span className="docs-field">
        <span>渲染网格</span>
        <span>{gridSize.amountX}×{gridSize.amountY} = {gridSize.total} 个顶点</span>
      </span>
    </>
  );

  return (
    <Prose
      title="点阵热力（pointGrid）"
      lede="压力点阵的三维高度图，支持框选与视角旋转。2026-08-05 从主应用搬进包，
            同时修掉两处只有装进别人项目才会暴露的边界问题。"
    >
      <Note tone="warn" title="喂进去的不是渲染网格，是原始矩阵">
        <C>matCol</C> 要 16×10 = <strong>160</strong> 个数，不是
        <C>deriveGridSize()</C> 算出的 <strong>864</strong>。864 是**顶点数** ——
        插值（<C>interpSmall</C>）、补边（<C>addSide</C>）、高斯模糊（<C>gaussBlur_1</C>）
        由渲染器内部跑。按 864 喂会全错位，而且不报错，只是画面看着"不太对"。
      </Note>

      <Section title="活预览（缩放展示）">
        <DemoCard
          title="换预设看网格差异"
          sub="幅度给到 4000 —— 点阵走的是 12 位量程的老阈值默认值，220 压不出高度"
          path="docs/src/demos/PointGridDemo.jsx"
          source={demoSource}
          controls={controls}
          height={400}
        >
          <PointGridDemo key={presetId} presetId={presetId} />
        </DemoCard>
      </Section>

      <Section title="活预览（实际尺寸，可交互）">
        <p>
          下面这块**不缩放**，所以框选与旋转的坐标是对的。拖拽框选、右键 / 滚轮转视角
          （<C>TrackballControls</C>）。它占一整个视口高度 —— 这就是消费者装进去看到的样子。
        </p>
        <DemoCard
          title="可交互：框选 + 视角旋转"
          sub="拖拽框选点位；TrackballControls 转视角"
          mode="actual"
          hint="实际尺寸 · 可拖拽框选与旋转"
        >
          <PointGridDemo presetId={presetId} />
        </DemoCard>
        <Note tone="bad" title="为什么另一块不能交互">
          框选的坐标换算（<C>react/three/pointPick.js</C>）用的是
          <C>window.innerWidth/Height</C> 而不是画布尺寸 —— 原文件自己的注释就写着
          「此处应使用画布长和宽」。CSS 缩放之后指针坐标与投影坐标对不上，框会选错点。
          本轮没修：改签名要同时动 35 个 import 方。已记进积压。
        </Note>
      </Section>

      <Section title={`${PRESET_IDS.length} 条预设：净差异只有两个数字`}>
        <p>
          <C>matCol.jsx</C> 与 <C>carCol.jsx</C> 共 953 行，忽略空白与注释后的净差异只有
          <C>sit.num1</C>（16 vs 9）和 <C>sit.order</C>（2 vs 4）。所以它们不是两个渲染器，
          是同一个渲染器的两条预设 —— 逐帧一致性见 <C>core/pointGrid/pipeline.test.js</C>
          （那份测试刻意把参照实现"抄"了一遍而不复用管线代码，否则两边共享同一份代码，
          测试就退化成自我验证）。
        </p>
        <Table
          head={['id', 'sit 通道', '渲染网格', '要喂多少个数']}
          rows={PRESET_IDS.map((id) => {
            const normalized = normalizePointGridParams(POINT_GRID_PRESETS[id]);
            const derived = pointGrid.deriveGridSize(normalized.sit);
            return [
              <C>{id}</C>,
              <C>{JSON.stringify(normalized.sit)}</C>,
              `${derived.amountX}×${derived.amountY} = ${derived.total}`,
              normalized.sit.num1 * normalized.sit.num2,
            ];
          })}
        />
        <p>
          网格公式（<C>core/pointGrid/params.js</C> 逐字保留自老场景）：
        </p>
        <Table
          head={['量', '式子']}
          rows={[
            [<C>amountX</C>, <C>num1 * interp + order * 2</C>],
            [<C>amountY</C>, <C>num2 * interp + order * 2</C>],
          ]}
        />
      </Section>

      <Section title="参数范围">
        <Table
          head={['参数', 'min', 'max', `当前 ${presetId}`]}
          rows={Object.entries(pointGrid.PARAM_RANGES).map(([name, range]) => [
            <C>{name}</C>,
            range.min,
            range.max,
            <C>{JSON.stringify(params.sit?.[name] ?? params[name])}</C>,
          ])}
        />
        <p>
          <C>num1</C> / <C>num2</C> / <C>interp</C> / <C>order</C> 是**每通道**的
          （<C>params.sit</C> 与 <C>params.back</C> 各一份），<C>fps</C> 与
          <C>separation</C> 是全局的。上界不是物理限制，是防止
          <C>num1 * interp + order * 2</C> 把顶点数搞爆。
        </p>
      </Section>

      <Section title="搬进包时修掉的两处">
        <Table
          head={['问题', '在主应用里为什么不是 bug', '改成了什么']}
          rows={[
            [
              <>点精灵贴图硬编码成 <C>&apos;./circle.png&apos;</C></>,
              <>主应用把这张 4.7kB 的图 serve 在站点根目录（<C>client/public/</C>）。
                装进别人的项目就是 404 → 点云全白。</>,
              <>图进包（<C>react/three/circle.png</C> —— 2026-08-07 起
                <C>handPoints</C> 也用这张，所以放在两者共用的 <C>three/</C> 下），
                <C>import circleUrl from &apos;../three/circle.png&apos;</C> 让打包器发出资源。
                同时开了 <C>params.pointSprite</C> 允许换图。
                **代价是多一条消费者义务：打包器要能处理 png import。**</>,
            ],
            [
              <><C>TrackballControls</C> 的 import 少了 <C>.js</C></>,
              <>主应用装的 three@0.127.0 **没有 exports map**，靠扩展名猜测能解析。</>,
              <>加上 <C>.js</C>。three ≥0.150 的 exports map 是
                <C>&quot;./examples/jsm/*&quot;</C> 通配，不带扩展名直接解析失败 ——
                而包的 peer 范围写的是 <C>&gt;=0.127</C>，不加这条那个范围就是假的。</>,
            ],
          ]}
        />
        <Note tone="bad" title="还有一处只声明、没修">
          渲染器会调 <C>props.data.current.changeData / handleCharts / handleChartsArea</C>
          —— 宿主注入的命令式 API，但**契约里没写**。调用点是
          <C>host.data?.current?.changeData(…)</C>，可选链只保住 <C>current</C>，
          没保住那三个方法：传了一个 <C>data</C> ref 但没挂这三个方法，就是
          <C>TypeError</C>。明细见 <a href="#/api">RendererHost 入参与方法</a>。
        </Note>
      </Section>
    </Prose>
  );
}
