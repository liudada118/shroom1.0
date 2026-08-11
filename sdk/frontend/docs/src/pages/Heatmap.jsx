/**
 * Heatmap.jsx - 两条斑点热力
 *
 * 一页放两个渲染器是有意的：它们画的是同一种东西（每个数据点一个圆，叠起来上色），
 * 实现却完全不同 —— 一条走 GPU 两趟着色器，一条走 Canvas 2D 的 `globalAlpha` 分桶。
 * 摆在一起读者才看得出「为什么不是同一个渲染器的两个后端」。
 *
 * 表格全部从 `core` 读（预设、参数范围、色标）。
 */

import {
  BLOB_HEATMAP_PRESETS,
  HEAT_BLOB_STOPS,
  WEBGL_HEATMAP_PRESETS,
  blobHeatmap,
  createBuiltinMatrixRendererParams,
  getColormap,
  normalizeBlobHeatmapParams,
  normalizeWebglHeatmapParams,
  webglHeatmap,
} from '@shroom/frontend/core';
import React from 'react';

import BlobHeatmapDemo from '../demos/BlobHeatmapDemo.jsx';
import blobSource from '../demos/BlobHeatmapDemo.jsx?raw';
import DemoCard from '../components/DemoCard.jsx';
import WebglHeatmapDemo from '../demos/WebglHeatmapDemo.jsx';
import webglSource from '../demos/WebglHeatmapDemo.jsx?raw';
import { createDefaultMatrixSample } from '../lib/matrixConfigurator.js';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

const WEBGL_PRESET_IDS = Object.keys(WEBGL_HEATMAP_PRESETS);
const BLOB_PRESET_IDS = Object.keys(BLOB_HEATMAP_PRESETS);
const DEFAULT_MATRIX_SAMPLE = createDefaultMatrixSample();

export default function Heatmap() {
  const [webglPresetId, setWebglPresetId] = React.useState('defaultMatrix');
  const [blobPresetId, setBlobPresetId] = React.useState('defaultMatrix');
  const usesDefaultWebglMatrix = webglPresetId === 'defaultMatrix';
  const usesDefaultBlobMatrix = blobPresetId === 'defaultMatrix';

  const webglParams = React.useMemo(
    () => (usesDefaultWebglMatrix
      ? createBuiltinMatrixRendererParams('webglHeatmap', {
        matrix: DEFAULT_MATRIX_SAMPLE,
        coordinateMap: DEFAULT_MATRIX_SAMPLE.coordinateMap,
        valueMax: DEFAULT_MATRIX_SAMPLE.valueMax,
      })
      : normalizeWebglHeatmapParams(WEBGL_HEATMAP_PRESETS[webglPresetId])),
    [usesDefaultWebglMatrix, webglPresetId],
  );
  const blobParams = React.useMemo(
    () => (usesDefaultBlobMatrix
      ? createBuiltinMatrixRendererParams('blobHeatmap', {
        matrix: DEFAULT_MATRIX_SAMPLE,
        coordinateMap: DEFAULT_MATRIX_SAMPLE.coordinateMap,
        valueMax: DEFAULT_MATRIX_SAMPLE.valueMax,
      })
      : normalizeBlobHeatmapParams(BLOB_HEATMAP_PRESETS[blobPresetId])),
    [blobPresetId, usesDefaultBlobMatrix],
  );

  const heatBlobsCss = getColormap('heatBlobs').previewCss;

  const webglControls = (
    <>
      <label className="docs-field">
        <span>预设</span>
        <select value={webglPresetId} onChange={(event) => setWebglPresetId(event.target.value)}>
          <option value="defaultMatrix">统一默认矩阵（8 × 8 / 1..64）</option>
          {WEBGL_PRESET_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>
      <span className="docs-field">
        <span>输入矩阵</span>
        <span>
          {webglParams.dataWidth}×{webglParams.dataHeight}
          {' = '}
          {webglParams.dataWidth * webglParams.dataHeight} 个数
        </span>
      </span>
      <span className="docs-field">
        <span>帧长门槛</span>
        <span>{webglParams.minFrameLength}</span>
      </span>
    </>
  );

  const blobControls = (
    <>
      <label className="docs-field">
        <span>预设</span>
        <select value={blobPresetId} onChange={(event) => setBlobPresetId(event.target.value)}>
          <option value="defaultMatrix">统一默认矩阵（8 × 8 / 1..64）</option>
          {BLOB_PRESET_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>
      <span className="docs-field">
        <span>输入矩阵</span>
        <span>
          {blobParams.dataWidth}×{blobParams.dataHeight}
          {' = '}
          {blobParams.dataWidth * blobParams.dataHeight} 个数
        </span>
      </span>
      <span className="docs-field">
        <span>圆半径</span>
        <span>{blobParams.radius}px（连阴影 ×1.5）</span>
      </span>
    </>
  );

  return (
    <Prose
      title="两条斑点热力（webglHeatmap / blobHeatmap）"
      lede="都是「每个数据点画一个圆、叠起来上色」，实现完全不同：一条走 GPU 两趟着色器，
            一条走 Canvas 2D 的 globalAlpha 分桶。2026-08-10 从主应用共 1600 行搬进包，
            至此五条渲染通路全部在包里。"
    >
      <Section title="先说清：为什么是两个渲染器，不是一个渲染器的两个后端">
        <p>
          <C>numMatrix</C> 有三个后端（<C>sprite3d</C> / <C>canvas2d</C> /
          <C>webgl</C>），因为它们**吃同一份参数、画同一个东西**，只是画法不同 ——
          换后端不用改任何调用代码。这两条热力不是那个关系：参数不重合、方法不重合、
          连"一帧多长才算有效"这种基本约定都不同。硬合成一个渲染器等于造一个
          「一半字段在这条通路上是死的」的参数表。
        </p>
        <Table
          head={['', 'webglHeatmap', 'blobHeatmap']}
          rows={[
            ['原实现', <C>webgl/Canvas4096WebGL.jsx</C>, <C>heatmap/canvas.jsx</C>],
            ['行数', '187 + 953（绘制核）', '460'],
            ['画法', 'GPU 两趟：斑点强度 → 色带合成', <>Canvas 2D：按 <C>globalAlpha</C> 分桶叠圆 → 查表上色</>],
            ['配色', <>8 段 + sRGB gamma（<C>heatBlobs</C>）</>, '6 段线性渐变，1024 格调色板'],
            ['占 WebGL 上下文', '占（浏览器上限约 8–16 个）', <strong>不占</strong>],
            ['对外方法', <C>sitData / sitValue / changeColor / bthClickHandle</C>, <C>sitData / sitValue / bthClickHandle</C>],
            ['帧长门槛', <><C>minFrameLength</C>，<C>bed4096</C> 是 4096</>, '无（非空即画）'],
            ['主应用用在哪', <><C>bed4096</C> 床垫（两个渲染点）</>, <>各种 <C>heatmap</C> 展示形式</>],
          ]}
        />
      </Section>

      <Section title="活预览一：webglHeatmap">
        <Note tone="bad" title="最容易踩的一脚：帧短于门槛就整帧丢弃，静默无画面">
          <C>bed4096</C> 的 <C>minFrameLength</C> 是 <strong>4096</strong> —— 那块床垫
          正好 64×64。喂 32×32 的帧**什么都不会发生，也不报错**。这是原实现
          （<C>Canvas4096WebGL</C>）的行为，参数化了但默认没动。想喂小矩阵就挑
          <C> plain</C> 预设（门槛 1），或者自己把 <C>minFrameLength</C> 调下来。
        </Note>
        <DemoCard
          title="换预设看尺寸与门槛"
          sub="bed4096 是唯一的迁移预设（逐字等于主应用现在的行为）；plain 是给二开的起点"
          path="docs/src/demos/WebglHeatmapDemo.jsx"
          source={webglSource}
          controls={webglControls}
          height={420}
        >
          <WebglHeatmapDemo
            key={webglPresetId}
            presetId={usesDefaultWebglMatrix ? 'plain' : webglPresetId}
            params={webglParams}
            values={usesDefaultWebglMatrix ? DEFAULT_MATRIX_SAMPLE.values : undefined}
          />
        </DemoCard>
        <Table
          head={['id', '矩阵', '画布', 'radius', 'valueScale', 'edgeClear', 'mirrorX']}
          rows={WEBGL_PRESET_IDS.map((id) => {
            const p = normalizeWebglHeatmapParams(WEBGL_HEATMAP_PRESETS[id]);
            return [
              <C>{id}</C>,
              `${p.dataWidth}×${p.dataHeight}`,
              `${p.canvasWidth}×${p.canvasHeight}`,
              p.radius,
              p.valueScale,
              <C>{JSON.stringify(p.edgeClear)}</C>,
              String(p.mirrorX),
            ];
          })}
        />
        <Note tone="warn" title="edgeClear 的默认窗口不对称，那是现在屏幕上的样子">
          <C>{'{ keepFrom: 6, keepTo: 58 }'}</C> 对 64 来说上切 6 行、下切 5 行。
          原件写死的就是这个 <C>i &lt; 6 || i &gt; 58</C>，照搬。传
          <C> edgeClear: null</C> 关掉整段。
        </Note>
      </Section>

      <Section title="活预览二：blobHeatmap">
        <DemoCard
          title="换预设看铺点密度"
          sub="default 是 32×32 / max 600；carCol 是 10×9 / max 300 —— 原件那个 matrixName 分支的两条边"
          path="docs/src/demos/BlobHeatmapDemo.jsx"
          source={blobSource}
          controls={blobControls}
          height={420}
        >
          <BlobHeatmapDemo
            key={blobPresetId}
            presetId={usesDefaultBlobMatrix ? 'default' : blobPresetId}
            params={blobParams}
            values={usesDefaultBlobMatrix ? DEFAULT_MATRIX_SAMPLE.values : undefined}
          />
        </DemoCard>
        <Note tone="info" title="这一个不占 WebGL 上下文额度">
          全包五个渲染器里唯一不碰 three、也不碰 WebGL 的一个。同页想挂多少块都行 ——
          本站舞台那套「同时最多 4 块」的限流对它是多余的（限流是按舞台算的，不区分
          渲染器，所以它也一样被限，只是没必要）。
        </Note>
        <Table
          head={['id', '矩阵', 'radius', 'max', 'alphaFloor', 'canvasScale']}
          rows={BLOB_PRESET_IDS.map((id) => {
            const p = normalizeBlobHeatmapParams(BLOB_HEATMAP_PRESETS[id]);
            return [
              <C>{id}</C>,
              `${p.dataWidth}×${p.dataHeight}`,
              p.radius,
              p.max,
              p.alphaFloor,
              p.canvasScale,
            ];
          })}
        />
        <Note tone="bad" title="两个默认值解释了「这张图为什么看着发糊」">
          <C>max</C> 默认 <strong>600</strong>，全仓唯一（别处同名的满值阈值都是 200）；
          <C>alphaFloor</C> 默认 <strong>0.7</strong>，把所有落进色带的像素 alpha 都抬到
          0.7 以上，于是整张图没有真正的淡色区。两个都参数化了，**默认值一个没动** ——
          调它们是一次看得见的画面变化。
        </Note>
        <Note tone="warn" title="铺点坐标那条公式是错位的，照抄">
          <C>buildBlobPoints</C> 里 <strong>行下标配画布宽、列下标配画布高</strong>
          （<C>core/blobHeatmap/pipeline.js</C>）。方阵看不出来，
          <C>carCol</C>（10×9）就是一张转置过的图。原件如此，改它同样是可见变化。
        </Note>
      </Section>

      <Section title="第 8 条配色 heatBlobs：GLSL 里的色带第一次有了 JS 侧的对应物">
        <p>
          这条 8 段色带原先**只以 GLSL 的形式存在**，躺在
          <C> WebGL.HeatMap copy 2.js</C> 的模板字符串里 —— 所以之前 18 处配色合并时
          扫不到它，画布配置器的配色下拉里也选不到。现在它是
          <C> core/colormaps.js</C> 的第 8 条，色卡、数值采样、着色器发码同一个出处。
        </p>
        <div style={{
          height: 28, borderRadius: 6, margin: '12px 0', background: heatBlobsCss,
        }}
        />
        <Table
          head={['位置', 'RGB', '十六进制']}
          rows={HEAT_BLOB_STOPS.map((stop) => [
            stop.at.toFixed(2),
            <C>{stop.rgb.join(', ')}</C>,
            <C>
              {`#${stop.rgb.map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`}
            </C>,
          ])}
        />
        <Note tone="warn" title="gamma 必须在 JS 侧也跑一遍">
          着色器最后那句 <C>pow(c * 1.5, 1/2.2)</C> 如果只留在 GLSL 里，色卡与实际出图
          就是两个颜色 —— 这一页上面那条色带会当场露馅。所以
          <C> sampleHeatBlobsRgb</C> 复现了同一道 gamma，包括 GL 的输出夹取
          （<C>Math.min(1, …)</C>）。
        </Note>
        <Note tone="bad" title="最后 16% 是一段恒定色">
          原件写的是 <C>vec3 c7 = vec3(1.0, 0.0, 0.0); /* 1.00 -&gt; #FF1E42 */</C> ——
          注释说 <C>#FF1E42</C>（偏粉的红），代码是纯红，和 <C>c6</C> 一模一样。
          也就是 <C>mix(c6, c7, t)</C> 是个空插值。**照代码搬**，所以上表最后两行同色。
          改成注释里那个颜色是一次看得见的画面变化，另议。
        </Note>
      </Section>

      <Section title="搬进包时清掉的重复与死码">
        <Table
          head={['在哪', '是什么', '处理']}
          rows={[
            [
              <C>WebGL.HeatMap copy 2.js</C>,
              <>私有的**第二份** <C>addSide</C> / <C>interp</C> /
                <C> interpSmall</C>（帧运算）与 <C>create_shader</C> /
                <C> create_program</C>（GL 样板）</>,
              <>前三个改用 <C>core/frameMath.js</C>，后两个改用
                <C> react/webgl/glUtil.js</C>（<C>numMatrix</C> 的 webgl 后端也用它）。</>,
            ],
            [
              <C>WebGL.HeatMap copy 2.js</C>,
              <>模块级可变状态 <C>var tplCanvas = document.createElement(…)</C> 与
                <C> var map = {}</C></>,
              <>违反契约第 2 条（渲染器不得持有模块级可变状态）。提进实例作用域。
                <C> glUtil.js</C> 的 <C>prewarmedSources</C> 是有意保留的例外，
                README 记着。</>,
            ],
            [
              <C>Canvas4096WebGL.jsx</C>,
              'rAF 循环无条件每帧重画，哪怕一帧数据都没来过',
              <>加了一个 <C>dirty</C> 标志：数据或参数变过才重画。静态画面下像素完全相同，
                差别只在不再空烧 GPU。</>,
            ],
            [
              <C>heatmap/canvas.jsx</C>,
              <>每帧算一整套插值 + 补边 + 高斯模糊（<C>bigArr</C> → <C>bigArrs</C> →
                <C> bigArrg</C>），**结果从没被读过** —— 取数循环读的是原始
                <C> arr</C></>,
              <>整段删掉，逐像素相同。代价是 <C>sitValue</C> 六个键里那四个
                （<C>valueg</C> / <C>valuel</C> / <C>valuef</C> / <C>valuelInit</C>）
                本来就只喂这段死运算 —— 它们从来没改过画面。</>,
            ],
            [
              <C>heatmap/canvas.jsx</C>,
              <>模块级 <C>var canvas, context, data, options, isShadow</C> +
                <C> document.getElementById(&apos;heatmapcanvas&apos;)</C></>,
              <>同页挂两块会互相覆盖，而且 <C>carCol</C> 分支改的是**模块级**
                <C> options</C> —— 挂过一次之后同一会话里所有实例都变成 max 300。
                改成 <C>useRef</C> + 每实例参数。**这是本轮唯一一处不是逐像素等同的
                行为差异，而且它修的是 bug。**</>,
            ],
            [
              <C>heatmap/canvas.jsx</C>,
              <>一句无参空调用 <C>const value = jet()</C>；写死的
                <C> new Array(1024).fill(0)</C>（与 <C>carCol</C> 的 10×9 = 90 对不上）</>,
              '前者删掉，后者按实际尺寸算。',
            ],
            [
              <C>assets/util/heatmapRect.js</C>,
              '76 行，零引用',
              '删掉。',
            ],
          ]}
        />
        <Note tone="info" title="调色板从每帧重建改成建一次">
          <C>blobHeatmap</C> 的 1024 格调色板原来在 <C>forwardRef</C> 函数体里定义、
          每次渲染重建一遍。现在按参数记忆化建一次 —— 查出来的像素完全相同，
          见 <C>core/blobHeatmap/intensity.test.js</C> 里那条断言（created / fills /
          reads 都必须是 1）。
        </Note>
      </Section>

      <Section title="参数范围">
        <p><strong>webglHeatmap</strong></p>
        <Table
          head={['参数', 'min', 'max', `当前 ${webglPresetId}`]}
          rows={Object.entries(webglHeatmap.PARAM_RANGES).map(([name, range]) => [
            <C>{name}</C>, range.min, range.max, <C>{JSON.stringify(webglParams[name])}</C>,
          ])}
        />
        <p><strong>blobHeatmap</strong></p>
        <Table
          head={['参数', 'min', 'max', `当前 ${blobPresetId}`]}
          rows={Object.entries(blobHeatmap.PARAM_RANGES).map(([name, range]) => [
            <C>{name}</C>, range.min, range.max, <C>{JSON.stringify(blobParams[name])}</C>,
          ])}
        />
        <Note tone="bad" title="侧栏读数走的还是那三个未声明方法">
          两个渲染器都调 <C>props.data.current.changeData / handleCharts /
          handleChartsArea</C>（<C>blobHeatmap</C> 只调第一个）—— 宿主注入的命令式 API，
          **契约里没写**。传了 <C>data</C> ref 但没挂方法就是 <C>TypeError</C>。
          明细见 <a href="#/api">RendererHost 入参与方法</a>。
        </Note>
      </Section>
    </Prose>
  );
}
