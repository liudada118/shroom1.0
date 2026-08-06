/**
 * Contract.jsx - 渲染器契约
 *
 * **整页没有一个手抄的条目。** 三张表全部从 `core/contract.js` 的三个常量渲染，
 * 校验器那一节的错误信息也是当场调 `validateRendererDescriptor()` 得到的。
 *
 * 这是本站的验收标准之一：改一行 `core/contract.js`，刷新页面表格跟着变。
 * 做不到这一点，这页就退化成又一份会过期的 README。
 */

import {
  RENDERER_CAPABILITIES,
  RENDERER_METHODS,
  RENDERER_PROPS,
  listRenderers,
  validateRendererDescriptor,
} from '@shroom/frontend/core';
import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

/**
 * 几个故意写错的描述符。
 *
 * `source` 那一列是给人看的文本，`value` 是真拿去校验的对象 —— 两者必须自己对齐，
 * 这是本页唯一一处「手抄」。刻意**不**用 `eval` 把文本变成对象（那样能保证两列
 * 一致，但在文档站里引入一个 eval 是不划算的买卖）。表格里的 errors 列仍然是
 * 当场调 `validateRendererDescriptor()` 算出来的，不是抄的。
 */
const BAD_DESCRIPTORS = [
  { label: '不是对象', source: 'null', value: null },
  { label: '缺 id 与 load', source: '{}', value: {} },
  {
    label: '能力标记拼错',
    source: "{ id: 'x', load: () => {}, capabilities: ['rotate3d'] }",
    value: { id: 'x', load: () => {}, capabilities: ['rotate3d'] },
  },
  {
    label: '方法名不在契约里',
    source: "{ id: 'x', load: () => {}, methods: ['drawEverything'] }",
    value: { id: 'x', load: () => {}, methods: ['drawEverything'] },
  },
  {
    label: 'normalizeParams 不是函数',
    source: "{ id: 'x', load: () => {}, normalizeParams: {} }",
    value: { id: 'x', load: () => {}, normalizeParams: {} },
  },
];

export default function Contract() {
  const renderers = listRenderers();

  // 哪些方法真的被某个已注册渲染器声明了 —— 用来给下面那张长表加一列。
  const claimedBy = new Map();
  renderers.forEach((descriptor) => {
    descriptor.methods.forEach((name) => {
      if (!claimedBy.has(name)) claimedBy.set(name, []);
      claimedBy.get(name).push(descriptor.id);
    });
  });

  const propNames = Object.keys(RENDERER_PROPS);
  const methodEntries = Object.entries(RENDERER_METHODS)
    .sort(([, a], [, b]) => b - a);
  const capabilityEntries = Object.entries(RENDERER_CAPABILITIES);

  return (
    <Prose
      title="渲染器契约"
      lede={`${propNames.length} 个声明式 prop、${methodEntries.length} 个命令式方法、
             ${capabilityEntries.length} 项能力。整页从 core/contract.js 直接读，不是手抄的。`}
    >
      <Note title="契约不是设计出来的，是统计出来的">
        它把 <C>Home.jsx</C> 里 55 个场景组件**已经在用**的事实约定形式化下来。
        所以增删条目的判据是「现实里是不是这么用的」，不是「设计上应该有什么」。
        <C>colormap</C> 与 <C>coordinateMap</C> 就是后来补进去的 ——
        它们一直在被读，只是漏在契约外。
      </Note>

      <Section title="两条硬要求">
        <Table
          head={['#', '要求', '违反了会怎样']}
          rows={[
            ['1', '实现下面 props / 方法的一个子集，不引入契约外的 prop（额外输入走 params 通道）',
              '宿主不认识多出来的 prop，不会转发；渲染器读到 undefined'],
            ['2', <strong>不持有模块级可变状态</strong>,
              <>单实例时一切正常，同页挂两块开始互相覆盖，现象是「其中一块偶尔闪一下
                别人的数据」，极难定位。所有运行期状态必须在实例作用域内
                （<C>useRef</C>），否则也无法在切换时安全释放。</>],
          ]}
        />
      </Section>

      <Section title={`声明式 props（${propNames.length} 个）`}>
        <Table
          head={['prop', '用途']}
          rows={propNames.map((name) => [<C>{name}</C>, RENDERER_PROPS[name]])}
        />
      </Section>

      <Section title={`命令式方法（${methodEntries.length} 个）`}>
        <p>
          数字是该方法在 <C>Home.jsx</C> 里经 ref 调用的次数，用来判断迁移优先级。
          <strong>读作「至少这么多次」</strong> —— 统计只扫了 <C>Home.jsx</C>，
          漏了 <C>page/home/util.js</C> 那 5,564 行（<C>changeWsDataRaw</C> 因此
          一度被误判为契约外方法，它有 11 个真实调用点；补这一项时没有回头重算其余各项）。
        </p>
        <p>
          <strong>0 不代表可以删</strong>：契约取的是「暴露面的并集」而非
          「当前调用点的集合」，否则换一个宿主就会误判。
        </p>
        <Table
          head={['方法', 'Home.jsx 调用次数', '哪个已注册渲染器声明了它']}
          rows={methodEntries.map(([name, count]) => [
            <C>{name}</C>,
            count === 0 ? <span className="docs-badge docs-badge-warn">0</span> : count,
            (claimedBy.get(name) || []).map((id) => (
              <span key={id} className="docs-badge">{id}</span>
            )),
          ])}
        />
      </Section>

      <Section title={`能力标记（${capabilityEntries.length} 项）`}>
        <p>
          供注册表与 Builder 过滤：manifest 声明所需能力后，只有同时具备这些能力的
          渲染器才会出现在可选列表里（<C>listRenderers({'{'} capabilities: [...] {'}'})</C>）。
        </p>
        <Table
          head={['常量', '值', '现在谁有']}
          rows={capabilityEntries.map(([key, value]) => [
            <C>RENDERER_CAPABILITIES.{key}</C>,
            <C>{value}</C>,
            renderers
              .filter((descriptor) => descriptor.capabilities.includes(value))
              .map((descriptor) => (
                <span key={descriptor.id} className="docs-badge">{descriptor.id}</span>
              )),
          ])}
        />
      </Section>

      <Section title="校验器会挡下什么">
        <p>
          <C>registerRenderer()</C> 内部调 <C>validateRendererDescriptor()</C>。
          校验失败**不抛错**，只记录原因并返回 <C>false</C> ——
          一个坏插件不该让整个应用起不来。代价是不看返回值的话失败是静默的，
          用 <C>listRegistrationFailures()</C> 能把原因取出来。
        </p>
        <p>下面的错误信息是打开这一页时**当场跑出来的**，不是抄的：</p>
        <Table
          head={['写错成什么', '描述符', 'errors']}
          rows={BAD_DESCRIPTORS.map(({ label, source, value }) => {
            const { errors } = validateRendererDescriptor(value);
            return [
              label,
              <C>{source}</C>,
              errors.length
                ? <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {errors.map((error) => <li key={error}>{error}</li>)}
                </ul>
                : <span className="docs-badge docs-badge-ok">通过</span>,
            ];
          })}
        />
      </Section>

      <Section title="挂载时还会再审一次">
        <p>
          <C>RendererHost</C> 拿到实例后跑 <C>auditRendererContract()</C>，
          比对 <C>descriptor.methods</C> 与实例真实的暴露面：
        </p>
        <Table
          head={['情况', '后果', '为什么这么设计']}
          rows={[
            ['声明了却没实现', <C>console.error</C>,
              <>这是真 bug 源：宿主的调用全写成 <C>ref.current?.xxx()</C>，
                方法名打错会**静默 no-op**，现象是「这个展示形式没数据」。</>],
            ['实现了却没声明', <C>console.warn</C>,
              '说明契约在漂移，该补声明 —— 否则能力过滤与 UI 按钮显示都看不到它。'],
            ['未声明的方法被调用', '照常调用，不挡',
              <>挡掉会引入一个**新的**静默失败模式（描述符漏写一行，功能就没了），
                比现在更难查。<strong>只报不挡。</strong></>],
          ]}
        />
        <CodeBlock
          language="javascript"
          code={`// 每个渲染器只报一次，避免每次挂载都刷一遍控制台。
// 测试里要重复验证时用 resetContractAudit() 清掉记录。
import { auditRendererContract, resetContractAudit } from '@shroom/frontend/react';`}
        />
      </Section>

      <Note tone="warn" title="前端契约没有版本号">
        后端有 <C>SDK_CONTRACT_VERSION = &apos;2026-07-14&apos;</C>，前端一个都没有。
        <C>RENDERER_PROPS</C> / <C>RENDERER_METHODS</C> 是**公开面**，改它是
        breaking change —— 但**没有任何机制拦得住**。定版本策略是另一件事。
      </Note>
    </Prose>
  );
}
