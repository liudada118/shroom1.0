/**
 * WriteRenderer.jsx - 写自己的渲染器
 *
 * 这一页是整个文档站真正的产出。全仓在此之前关于「怎么写自己的渲染器」只有一句
 * 「用 `validateRendererDescriptor` 自查」，唯一可抄的描述符样例在
 * `react/builtins.js` 的源码里，不在文档里。
 *
 * 三个 `?raw` 引的都是真跑着的文件。这一页同时是**回归测试**：如果哪天改
 * `RENDERER_PROPS` / `RendererHost` 破坏了第三方渲染器，下面那块画面会白屏，
 * 或者在控制台留下契约审计告警。
 */

import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import CustomRenderer from '../demos/CustomRenderer.jsx';
import DemoCard from '../components/DemoCard.jsx';
import hostSource from '../demos/CustomRenderer.jsx?raw';
import paramsSource from '../demos/heatBarsParams.js?raw';
import rendererSource from '../demos/HeatBarsRenderer.jsx?raw';
import registerSource from '../demos/registerHeatBars.js?raw';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

const SKELETON = `const MyRenderer = React.forwardRef(function MyRenderer({ params, colormap }, ref) {
  // ① 全部运行期状态在实例作用域内 —— 契约的第 2 条硬要求
  const stateRef = React.useRef({ frame: [] });

  // ② 暴露面必须与描述符的 methods **逐字一致**
  React.useImperativeHandle(ref, () => ({
    sitData(prop) { stateRef.current.frame = prop?.wsPointData || []; draw(); },
    sitValue() { draw(); },
    reset() { stateRef.current = { frame: [] }; draw(); },
  }), [draw]);

  return <canvas ref={canvasRef} />;
});`;

export default function WriteRenderer() {
  return (
    <Prose
      title="写自己的渲染器"
      lede="换一种画法（Canvas 2D / SVG / DOM / WebGPU）而不动包 —— 这是「装完包能二开」那条路的核心。
            下面这个渲染器不属于 @shroom/frontend，是文档站自己写的。"
    >
      <Section title="先看结果">
        <DemoCard
          title="热力格：一个约 140 行的 Canvas 2D 渲染器"
          sub="用法和内置渲染器完全一样 —— 只有 rendererId 这个字符串不同"
          path="docs/src/demos/CustomRenderer.jsx"
          source={hostSource}
          mode="fill"
          height={320}
          hint="按容器尺寸渲染 · 不占 WebGL 上下文"
        >
          <CustomRenderer colormapId="viridis" />
        </DemoCard>
        <Note title="它顺手示范了内置渲染器没做的一件事">
          这块画面是按**容器**尺寸画的（<C>ResizeObserver</C>），所以塞进 320px 的卡片
          就老老实实画 320px。数字矩阵的旧 3D 后端仍按**视口**尺寸画
          —— 主应用里每个展示形式都独占整屏，这个区别从没暴露过。
          <strong>新写渲染器的话，按容器画才是对的。</strong>
        </Note>
      </Section>

      <Section title="四个文件">
        <Table
          head={['步', '做什么', '在哪个文件', '这一层有没有 React']}
          rows={[
            ['⓪', <>参数范围 + <C>normalizeXxxParams</C></>,
              <C>heatBarsParams.js</C>, '没有（纯函数）'],
            ['①', <><C>forwardRef</C> + <C>useImperativeHandle</C> 暴露方法</>,
              <C>HeatBarsRenderer.jsx</C>, '有（还有 canvas）'],
            ['②③', <><C>registerRenderer({'{ id, load, … }'})</C> + 检查返回值</>,
              <C>registerHeatBars.js</C>, '没有'],
            ['④', <><C>&lt;RendererHost rendererId=&quot;heatBars&quot; …/&gt;</C></>,
              <C>CustomRenderer.jsx</C>, '有'],
          ]}
        />
        <Note tone="warn" title="⓪ 单独成文件是懒加载能不能切开的前提">
          <C>load: () =&gt; import(&apos;./HeatBarsRenderer.jsx&apos;)</C> 那句动态 import
          是打包器切 chunk 的依据 —— 但**只要有任何一个首屏模块静态 import 了渲染器
          本体，这条切分就作废**。归一化函数偏偏是三个地方都要用的
          （描述符、宿主、渲染器自己），写在渲染器文件里，注册文件和宿主文件就都得
          静态引它。
          <br />
          <br />
          本站第一版就是这么写的，Rollup 当场告警：
          <C>dynamic import will not move module into another chunk</C>。
          现象不是报错，是**懒加载 chunk 塌回主包**。
          <br />
          <br />
          分界线和包自己的一样：<strong>有没有 React / three / DOM</strong>。
          <C>core/numMatrix/params.js</C> 与 <C>react/numMatrix/</C> 就是这么分的。
        </Note>
      </Section>

      <Section title="⓪ 参数层">
        <CodeBlock code={paramsSource} path="docs/src/demos/heatBarsParams.js" />
      </Section>

      <Section title="① 渲染器本体：三条必须遵守的">
        <CodeBlock code={SKELETON} note="骨架" />
        <Table
          head={['#', '要求', '违反了会怎样']}
          rows={[
            ['1', <>只读契约里那 7 个 prop，额外输入走 <C>params</C></>,
              '宿主不认识多出来的 prop，不会转发，渲染器读到 undefined'],
            ['2', <strong>不持有模块级可变状态</strong>,
              <>单实例正常，同页两块开始互相覆盖。现象是「其中一块偶尔闪一下别人的数据」，
                极难定位。<C>useRef</C> 是标准解法。</>],
            ['3', <>暴露面与 <C>methods</C> 逐字一致</>,
              <>少了 → <C>console.error</C>；多了 → <C>console.warn</C>。
                挂载时 <C>auditRendererContract</C> 会审。</>],
          ]}
        />
        <CodeBlock
          code={rendererSource}
          path="docs/src/demos/HeatBarsRenderer.jsx"
          note="这就是上面那块画面正在跑的渲染器本体"
        />
      </Section>

      <Section title="②③ 注册与自查">
        <p>
          <C>methods</C> 里的名字必须是 <C>core/contract.js</C> 的
          <C>RENDERER_METHODS</C> 的键。写个不存在的名字，<C>registerRenderer</C>
          会**直接拒绝注册**（返回 <C>false</C> 并打错误），不会等到渲染时才崩。
        </p>
        <CodeBlock code={registerSource} path="docs/src/demos/registerHeatBars.js" />
        <Note tone="warn" title="不看返回值的话，注册失败是静默的">
          <C>registerRenderer</C> 校验失败**不抛错** —— 一个坏插件不该让整个应用起不来。
          代价是现象只有「这个渲染器怎么不在列表里」。
          生产项目里应该像上面那样检查返回值，或者在设置页调
          <C>listRegistrationFailures()</C> 把原因显示出来。
        </Note>
      </Section>

      <Section title="④ 用它">
        <p>
          和内置渲染器**一行都不差**。宿主不需要认识你的渲染器叫什么方法、用什么画、
          是不是包里自带的 —— 那就是契约要证明的全部。源码在上面那张卡片的
          「显示代码」里。
        </p>
      </Section>

      <Section title="做不到的事：装机之后加渲染器">
        <Note tone="bad" title="load 是构建期解析的">
          <C>load: () =&gt; import(&apos;./X.jsx&apos;)</C> 里那个路径由打包器在**构建时**
          静态分析并切出 chunk。也就是说：本页讲的「二开」是
          <strong>新项目消费这个包</strong>，不是
          <strong>已经装好的客户端在运行期加载新渲染器</strong>。后者需要一条运行期
          插件通道（远程 ESM + 沙箱 + 版本协商），是另一件事，已记进积压。
        </Note>
      </Section>
    </Prose>
  );
}
