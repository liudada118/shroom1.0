/**
 * Intro.jsx - 这个包是什么
 *
 * 首页要回答的只有三个问题：装什么、有什么、我得先做哪几件事。
 * 「有什么」那张表**从注册表读**（`listRenderers()`），不手抄 —— 以后包里多一个
 * 渲染器，这页自动多一行。
 */

import { COLORMAPS, RENDERER_METHODS, RENDERER_PROPS, listRenderers } from '@shroom/frontend/core';
import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

const INSTALL = `# 仓库内的应用（client / docs / example）用 file: 引
npm i @shroom/frontend@file:../sdk/frontend

# vite.config.js 里这一条**不能省**
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom', 'three'] },
});`;

const ENTRIES = [
  ['@shroom/frontend/core', '零依赖层', '契约、注册表、帧总线、配色、阈值、帧数学、两个渲染器的参数与管线', '无。裸 Node 能直接 import'],
  ['@shroom/frontend/react', 'React + three 层', 'RendererHost、useSceneFrame、registerBuiltinRenderers', 'react >=18、three >=0.127（peer）'],
  ['@shroom/frontend/styles/canvas.css', '样式', '6 行 .canvasNum（100vh + 黑底 + 居中）', '无'],
  ['@shroom/frontend', '根出口', '上面全部 + SensorClient / 帧存储 / 展示系统定义', '⚠️ 见下'],
];

export default function Intro() {
  // 从注册表读，不手抄。`registerBuiltinRenderers()` 在 main.jsx 里已经跑过。
  const renderers = listRenderers();

  return (
    <Prose
      title="@shroom/frontend"
      lede="压力传感前端 SDK。把主应用里 55 个各写一遍的场景组件收敛成可注册的渲染器，
            让新项目能在几十行里把压力矩阵画出来，也让二开者能加自己的渲染方式。"
    >
      <Note title="这个站和两份 README 的区别">
        README 里的参数表、方法清单、预设名全是**手抄**的 —— 改一行源码，README 不会有
        任何报错。这个站的每张表都是从 <C>core/</C> 直接 import 渲染的，
        每段代码都是 <C>?raw</C> 引的**正在跑的那个文件本身**。
        所以它不可能过期，代价是要跑起来才能看。
      </Note>

      <Section title="装">
        <CodeBlock code={INSTALL} language="bash" />
        <p>
          <C>dedupe</C> 不是优化项，是**必须**：包是 symlink 进来的，
          内部那句裸 <C>import * as THREE from &apos;three&apos;</C> 从真实路径向上找
          <C>node_modules</C> 会走到包自己的目录，那里没有 three。两份 React 会让 hooks
          直接崩，两份 three 会让 <C>instanceof THREE.Xxx</C> 全部失效。
          详见 <a href="#/pitfalls">坑与已知缺陷</a>。
        </p>
      </Section>

      <Section title="四个入口">
        <Table
          head={['入口', '是什么', '内容', '依赖']}
          rows={ENTRIES.map(([path, kind, content, deps]) => [
            <C>{path}</C>, kind, content, deps,
          ])}
        />
        <Note tone="bad" title="根出口目前装不进独立项目">
          <C>src/client/commands.js</C> 第 1 行 import 的是
          <C>&apos;../../../../shared/commandSchema.json&apos;</C> —— 四级向上，
          跑出了包根。仓库内用 <C>file:</C> 引没问题（那个文件真的在），
          打成 tarball 装到别处就解析失败。所以本站通篇只教
          <C>/core</C> 与 <C>/react</C>，<C>SensorClient</C> 只在讲「连真后端」时出现，
          并当场标注这条缺陷。
        </Note>
      </Section>

      <Section title="现在有几个渲染器">
        <Table
          head={['id', '名称', '能力', '命令式方法数', '预设']}
          rows={renderers.map((descriptor) => [
            <C>{descriptor.id}</C>,
            descriptor.label,
            descriptor.capabilities.map((capability) => (
              <span key={capability} className="docs-badge">{capability}</span>
            )),
            descriptor.methods.length,
            descriptor.presets ? Object.keys(descriptor.presets).join(' / ') : '—',
          ])}
        />
        <p>
          这张表是 <C>listRenderers()</C> 的返回值。<C>heatBars</C> 没出现在这里是因为
          它由「<a href="#/write-renderer">写自己的渲染器</a>」那页注册，
          你打开那页再回来就会多一行 —— 注册表是运行期的，不是编译期清单。
        </p>
      </Section>

      <Section title="消费者必须自己做的四件事">
        <Table
          head={['#', '做什么', '不做的后果']}
          rows={[
            ['1', <>配 <C>resolve.dedupe: [&apos;react&apos;, &apos;react-dom&apos;, &apos;three&apos;]</C></>,
              '包内裸 import 解析不到，或出现第二份 React / three'],
            ['2', <>装 peer：<C>react &gt;=18</C>、<C>react-dom &gt;=18</C>、<C>three &gt;=0.127</C></>,
              '它们是 optional peer，npm 不会替你装'],
            ['3', <>引 <C>@shroom/frontend/styles/canvas.css</C></>,
              '数字矩阵的根节点 .canvasNum 没有高度，画面塌成 0'],
            ['4', <>打包器要能处理 <C>.png</C> import</>,
              <>点阵渲染器 <C>import circleUrl from &apos;./circle.png&apos;</C>（点精灵贴图）
                会解析失败。Vite 原生支持，webpack 5 走 asset modules</>],
          ]}
        />
        <p>
          第 4 条是 2026-08-05 点阵渲染器进包时新增的。在那之前贴图是硬编码的
          <C>&apos;./circle.png&apos;</C>，靠主应用把图 serve 在站点根目录 ——
          装进别人的项目就是 404，点云全白。
        </p>
      </Section>

      <Section title="契约的规模">
        <p>
          渲染器契约现在是 <strong>{Object.keys(RENDERER_PROPS).length} 个声明式 prop</strong>、
          <strong>{Object.keys(RENDERER_METHODS).length} 个命令式方法</strong>、
          <strong>{COLORMAPS.length} 条配色</strong>。三个数都是当场数出来的
          （<C>Object.keys().length</C>），逐条明细在
          <a href="#/contract"> 渲染器契约</a>。
        </p>
      </Section>
    </Prose>
  );
}
