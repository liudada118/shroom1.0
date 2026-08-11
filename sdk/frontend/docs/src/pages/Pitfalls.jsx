/**
 * Pitfalls.jsx - 坑与已知缺陷
 *
 * 这一页的价值在于**它承认的东西**。前九页讲的是「这个包能做什么」，
 * 这一页讲「它现在做不好什么、以及为什么本轮没修」。
 *
 * 纪律：每一条都要写清楚三件事 —— 现象、根因（带文件路径）、本轮为什么不修。
 * 只写「有个已知问题」而不写为什么不修，读的人下次还会踩，而且会以为是自己配错了。
 *
 * 其它页面里的 `<a href="#/pitfalls">` 都指到这里，删条目前先搜一遍。
 */

import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

const DEDUPE = `// vite.config.js —— 消费者项目里
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom', 'three'] },
});`;

const OBFUSCATOR = `// 混淆器要把整个包排掉。注意匹配的是 symlink **解析之后**的真实路径，
// 只写 'node_modules/**' 挡不住 file: 引进来的包。
obfuscatorPlugin({
  exclude: ['node_modules/**', '**/src/renderers/**', '**/sdk/frontend/**'],
  options: { /* … */ },
});`;

export default function Pitfalls() {
  return (
    <Prose
      title="坑与已知缺陷"
      lede="前九页讲这个包能做什么，这一页讲它现在做不好什么 ——
            以及每一条为什么本轮没修。"
    >
      <Section title="装配阶段：四条会让你起不来的">
        <Table
          head={['现象', '根因', '怎么办']}
          rows={[
            [
              <><C>Invalid hook call</C> / hooks 报「只能在函数组件里调」</>,
              '两份 React。包是 symlink 进来的，包内的 `import React` 从真实路径向上找 node_modules，找到的可能不是你项目那份',
              <><C>resolve.dedupe</C> 加 <C>react</C> 与 <C>react-dom</C></>,
            ],
            [
              <>点云 / 精灵图不出来，<C>instanceof</C> 判断莫名其妙为 false</>,
              '两份 three。同一个类在两份副本里是两个不同的构造函数',
              <><C>dedupe</C> 加 <C>three</C></>,
            ],
            [
              <>启动就 <C>Failed to resolve import &quot;three&quot;</C></>,
              <>three 是 <strong>optional peer</strong>，npm 不会替你装</>,
              <>自己 <C>npm i three</C>。react / react-dom 同理</>,
            ],
            [
              <>画面高度塌成 0，DOM 里 <C>.canvasNum</C> 在但没内容</>,
              <>没引 <C>@shroom/frontend/styles/canvas.css</C>（就 6 行：100vh + 黑底 + 居中）</>,
              <>在入口引一次</>,
            ],
          ]}
        />
        <CodeBlock code={DEDUPE} />
        <Note tone="warn" title="dedupe 不是「优化项」">
          很多包把 dedupe 当性能建议。这里它是<strong>正确性前提</strong> ——
          没有它，包内那句裸 <C>import * as THREE from &apos;three&apos;</C>
          从 symlink 的真实路径向上找，会走到
          <C>sdk/frontend/node_modules</C>，而那里根本没有 three。
        </Note>
      </Section>

      <Section title="第四条消费者义务：打包器要能处理 png">
        <p>
          点阵渲染器有一句 <C>import circleUrl from &apos;./circle.png&apos;</C>
          （点精灵贴图，4.7kB）。Vite 原生支持，webpack 5 走 asset modules，
          <strong>裸 tsc / 裸 esbuild 不配 loader 会直接解析失败</strong>。
        </p>
        <p>
          这条是 2026-08-05 点阵渲染器进包时<strong>新增</strong>的义务。在那之前
          贴图是硬编码的运行期相对 URL <C>&apos;./circle.png&apos;</C>，靠主应用把图
          serve 在站点根目录（<C>client/public/</C>）—— 装进别人的项目就是 404，
          点云全白，而且**不报错**。换成打包资源之后至少是构建期就崩，看得见。
        </p>
      </Section>

      <Section title="用了代码混淆器的话">
        <CodeBlock code={OBFUSCATOR} />
        <p>
          渲染器走 <C>load: () =&gt; import(&apos;./xxx.jsx&apos;)</C> 懒加载。混淆器的
          <C>stringArray</C> / <C>splitStrings</C> 会把那个路径字面量改写成运行期表达式，
          <strong>Rollup 随即无法静态分析，懒加载 chunk 拆不出来、被内联回主包</strong>。
          现象不是报错，是「包怎么突然大了 500KB」。
        </p>
      </Section>

      <Section title="⚠️ 根出口装不进独立项目">
        <Note tone="bad" title="tarball 缺陷，本轮仍不修">
          <C>sdk/frontend/src/client/commands.js</C> 第 1 行 import 的是
          <C>&apos;../../../../shared/commandSchema.json&apos;</C> —— 四级向上，
          <strong>跑出了包根</strong>。仓库内用 <C>file:</C> 引没问题（那个文件真的在），
          <C>npm pack</C> 之后装到别处就解析失败。
          <br />
          <br />
          不修的原因：那份 schema 有 5 个消费者，归后端还是归 SDK 是个**归属决定**，
          不是一次移动文件。本站因此通篇只教 <C>/core</C> 与 <C>/react</C>，
          <C>SensorClient</C> 只在讲「连真后端」时出现。
        </Note>
      </Section>

      <Section title="数字矩阵旧后端仍按视口尺寸画">
        <Table
          head={['文件', '写的是什么']}
          rows={[
            [<C>react/numMatrix/backends/sprite3d.js:247</C>,
              <C>resolveCanvasSize(window.innerHeight, canvasHeightRatio)</C>],
            [<C>react/pointGrid/PointGridRenderer.jsx</C>,
              <C>ResizeObserver + container.clientWidth/clientHeight</C>],
          ]}
        />
        <p>
          点阵热力已经能直接放进任意尺寸的配置预览；数字矩阵旧后端放进 300px 高的
          卡片时仍会按视口尺寸画。文档站继续用「给一个视口大小的容器 + CSS
          <C>transform: scale()</C> 缩进卡片」兼容它（<C>components/Live.jsx</C>）。
        </p>
        <Note tone="warn" title="缩放的代价：交互坐标错位">
          <C>react/three/pointPick.js</C> 用 <C>clientX/clientY</C> 配
          <C>window.innerWidth/Height</C> 做投影 —— 原文件自己的注释就写着
          「此处应使用画布长和宽」。CSS 缩放之后指针坐标与投影坐标对不上，
          框选会选错点。所以缩放模式默认 <C>pointer-events: none</C>，
          <a href="#/point-grid">点阵那页</a>另给了一块不缩放的可交互预览。
          <br />
          <br />
          <strong>本轮不修</strong>：改 <C>getPointCoordinate</C> 的签名要同时动 35 个
          import 方，得配一整轮真机回归。<strong>新写渲染器的话，按容器画（
          <C>ResizeObserver</C>）才是对的</strong> ——
          <a href="#/write-renderer">那页</a>的示例就是这么写的。
        </Note>
      </Section>

      <Section title="WebGL 上下文预算">
        <p>
          浏览器同时活着的 WebGL 上下文上限约 8–16 个。超了会报
          <C>Too many active WebGL contexts</C>，最老的那个被强制丢弃 ——
          现象是<strong>某几块画面莫名其妙变黑</strong>，而且不一定是你刚打开的那块。
        </p>
        <Table
          head={['谁', '有没有 dispose', '有没有 forceContextLoss()']}
          rows={[
            [<C>numMatrix</C>, <span className="docs-badge docs-badge-ok">有</span>,
              <span className="docs-badge docs-badge-warn">没有</span>],
            [<C>pointGrid</C>,
              <><span className="docs-badge docs-badge-ok">有</span>，还清了 5 类监听器</>,
              <span className="docs-badge docs-badge-warn">没有</span>],
          ]}
        />
        <Note tone="warn" title="dispose() 不保证立即归还上下文">
          <C>renderer.dispose()</C> 释放的是 GL 资源，<strong>上下文本身可能拖到 GC
          才归还</strong>。补 <C>forceContextLoss()</C> 会动到主应用在跑的两个渲染器，
          要配真机回归，所以本轮**先用限流绕开**：文档站
          <C>components/Live.jsx</C> 做 <C>IntersectionObserver</C> 懒挂载 +
          全局活跃数上限 4。<a href="#/gallery">一览那页</a>就是这套限流的压力测试。
          <br />
          <br />
          消费者项目里如果要同页挂多块，得自己做同样的事。已记进积压。
        </Note>
      </Section>

      <Section title="⚠️ data.current 上那三个方法没有声明">
        <p>
          点阵渲染器每 <C>1/fps</C> 秒会调
          <C>props.data.current.changeData / handleCharts / handleChartsArea</C>。
          <C>RENDERER_PROPS</C> 里有 <C>data</C>，但**它的 <C>current</C> 上要有哪三个方法，
          源码之外没有任何地方写过**。
        </p>
        <p>
          调用点是 <C>host.data?.current?.changeData(…)</C> ——
          可选链只保住 <C>current</C>，<strong>没保住方法本身</strong>。
          传了一个 <C>data</C> ref 但没挂齐这三个，就是 <C>TypeError</C>。
          明细见 <a href="#/api">RendererHost 入参与方法</a>。
        </p>
        <Note title="为什么不顺手改成 ?.changeData?.()">
          那会把「宿主漏挂方法」从一个响亮的 <C>TypeError</C> 变成<strong>静默
          no-op</strong> —— 现象退化成「侧栏读数怎么不动」，比现在难查得多。
          本轮的处置是<strong>只补声明、不改代码</strong>。
        </Note>
      </Section>

      <Section title="做不到：装机之后加渲染器">
        <Note tone="bad" title="load 是构建期解析的">
          <C>load: () =&gt; import(&apos;./X.jsx&apos;)</C> 里那个路径由打包器在**构建时**
          静态分析并切 chunk。所以本站讲的「二开」是
          <strong>新项目消费这个包</strong>，<strong>不是</strong>
          已经装好的客户端在运行期加载新渲染器。
          <br />
          <br />
          后者需要一条运行期插件通道（远程 ESM + 沙箱 + 版本协商），是另一件事。
          <strong>那才是「装机二开」那条路的核心问题</strong>，已记进积压。
        </Note>
      </Section>

      <Section title="前端契约没有版本号">
        <p>
          后端有 <C>SDK_CONTRACT_VERSION = &apos;2026-07-14&apos;</C>，前端一个都没有。
          <C>RENDERER_PROPS</C> / <C>RENDERER_METHODS</C> 是**公开面**，
          改它是 breaking change —— 但<strong>没有任何机制拦得住</strong>。
          本站的 <a href="#/contract">契约页</a>是直接从源码渲染的，
          所以至少「改了什么」是看得见的，但那不是版本策略。
        </p>
      </Section>

      <Section title="写 core/ 里的代码时要守的两条">
        <p>
          这两条只对<strong>往包里提代码</strong>的人有效，消费者不用管。
          <C>npm run smoke</C>（<C>scripts/smoke-core.mjs</C>）就是守这两条的 ——
          它用<strong>裸 Node</strong> import 整个 <C>core/</C>，
          没有打包器、没有 localStorage 垫片、没有 vitest。
        </p>
        <Table
          head={['规矩', '为什么单元测试抓不到']}
          rows={[
            [<>相对 import <strong>必须写全 <C>.js</C> 扩展名</strong></>,
              'vitest 底下是 Vite 的解析器，会替你补扩展名。Node ESM 不补'],
            [<>模块顶层<strong>不许读 <C>localStorage</C></strong></>,
              <>测试环境有 <C>vi.stubGlobal</C> 垫片，浏览器里也有 —— 只有裸 Node 没有。
                要读就用 <C>globalThis.localStorage?.</C> 并放进函数体里</>],
            [<>不许引入 react / three</>,
              'peer 依赖装着的时候 import 成功，装不着才崩 —— 而消费者那边不一定装'],
          ]}
        />
        <p>
          这三类错的共同表现是「在 client 里跑得好，装到新项目里就崩」——
          正是拆包要防的那件事。
        </p>
      </Section>
    </Prose>
  );
}
