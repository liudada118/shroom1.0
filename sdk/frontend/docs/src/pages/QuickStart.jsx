/**
 * QuickStart.jsx - 快速开始
 *
 * 这一页的源码**不是抄的**：下面那两个 `?raw` import 指的是 `example/` 里真跑着的
 * 两个文件。`example/` 是 tarball 的验收标准（README 与 ARCHITECTURE.md 都指着它），
 * 所以它必须一直是能跑的 —— 显示它就等于显示一份被持续验证的样例。
 *
 * 跨目录 `?raw` 需要 `vite.config.js` 里的 `server.fs.allow`，理由见那个文件。
 */

import React from 'react';

import exampleMain from '../../../example/src/main.jsx?raw';
import exampleVite from '../../../example/vite.config.js?raw';
import BasicNumMatrix from '../demos/BasicNumMatrix.jsx';
import CodeBlock from '../components/CodeBlock.jsx';
import DemoCard from '../components/DemoCard.jsx';
import demoSource from '../demos/BasicNumMatrix.jsx?raw';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

const MINIMAL = `import { NUM_MATRIX_PRESETS, normalizeNumMatrixParams, numMatrix } from '@shroom/frontend/core';
import { RendererHost, registerBuiltinRenderers } from '@shroom/frontend/react';
import '@shroom/frontend/styles/canvas.css';

registerBuiltinRenderers();                       // ① 注册（幂等，可省——RendererHost 自己会调）

const params = normalizeNumMatrixParams(NUM_MATRIX_PRESETS.fast1024);   // ② 归一化
const grid = numMatrix.deriveGrid(params);        // ③ 网格尺寸从参数反推

<RendererHost                                     // ④ 挂
  rendererId="numMatrix"
  params={params}
  values={frame}                                  // 长度 = grid.gridWidth * grid.gridHeight
  channel="sit"
/>`;

const RUN = `# 仓库根目录
npm run sdk:frontend-example        # 最小 demo，端口 5180
npm run sdk:frontend-docs           # 本站，端口 5181

# 零依赖层的证明：裸 Node、无打包器、无垫片
node sdk/frontend/scripts/smoke-core.mjs`;

export default function QuickStart() {
  return (
    <Prose
      title="快速开始"
      lede="四步：注册 → 归一化参数 → 从参数反推网格尺寸 → 挂 RendererHost。"
    >
      <Section title="最短路径">
        <CodeBlock code={MINIMAL} note="四步的骨架" />
        <Table
          head={['步', '为什么不能跳']}
          rows={[
            ['①', <>其实可省 —— <C>react/RendererHost.jsx</C> 在模块加载时已经调过一次。
              显式写一遍是为了让入口自解释，而不是靠副作用碰巧生效。</>],
            ['②', <>渲染器读的是**归一化后的完整字段**（<C>canvasHeightRatio</C>、
              <C>textureValueMax</C>…）。把预设字面量直接丢进去会缺字段。
              归一化同时把越界值夹回范围，乱填不崩。</>],
            ['③', <>合成 / 采集的帧长度必须等于 <C>gridWidth * gridHeight</C>。
              两处各写死一份数字，迟早出现「只有左上角有数据」。</>],
            ['④', <><C>values</C> 是**声明式**入口，给了它就不订阅帧总线。
              高频数据建议走 <C>frameChannel</C>，见 <a href="#/frame-bus">帧总线</a>。</>],
          ]}
        />
      </Section>

      <Section title="跑起来看">
        <DemoCard
          title="数字矩阵 · fast1024 预设 · 经典蓝红"
          sub="数据是合成的游动高斯斑（30fps），没有硬件也能看到画面"
          path="docs/src/demos/BasicNumMatrix.jsx"
          source={demoSource}
        >
          <BasicNumMatrix presetId="fast1024" colormapId="classic" />
        </DemoCard>
        <Note tone="warn" title="为什么画面是缩小的">
          数字矩阵的旧 3D 后端仍按**视口尺寸**画，点阵热力已经按容器尺寸画
          （<C>sprite3d.js</C> 用 <C>window.innerHeight</C>，
          （<C>PointGridRenderer</C> 通过 <C>ResizeObserver</C> 跟随容器）。
          本站给它一个视口大小的容器让它按自己的规矩画，再用 CSS
          <C>transform: scale()</C> 缩进卡片 —— 所以你看到的**就是**全屏装出来的那一张，
          只是小了。代价是指针坐标对不上，缩放态下交互是关掉的。
          详见 <a href="#/pitfalls">坑与已知缺陷</a>。
        </Note>
      </Section>

      <Section title="仓库自带的最小 demo">
        <p>
          <C>sdk/frontend/example/</C> 是一个独立的 Vite 应用，也是 tarball 的验收标准。
          下面显示的**就是它的两个文件本身**（<C>?raw</C> 引的，不是抄的）：
        </p>
        <CodeBlock
          code={exampleMain}
          path="sdk/frontend/example/src/main.jsx"
          note="292 行，含合成帧 / 连真后端两条数据源"
        />
        <p style={{ marginTop: 18 }}>
          它的 <C>vite.config.js</C> 是**二开者要抄的那段** —— 除了 react 插件，
          只有 <C>resolve.dedupe</C> 一条是必须的：
        </p>
        <CodeBlock code={exampleVite} path="sdk/frontend/example/vite.config.js" />
      </Section>

      <Section title="命令">
        <CodeBlock code={RUN} language="bash" />
      </Section>
    </Prose>
  );
}
