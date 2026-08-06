/**
 * Api.jsx - RendererHost 的入参与命令式方法
 *
 * 这一页要回答的是「我作为宿主，能给渲染器什么、能问它什么」。
 * 契约那页讲的是渲染器一侧的义务，这页讲宿主一侧的用法。
 *
 * 最重要的一节是最后那个 `data.current` —— 它是本包目前**唯一一处未声明的公开面**，
 * README 和契约都没写，只有点阵渲染器的源码里在调。写在这里是本轮唯一的"修"法
 * （不改代码，只补声明）。
 */

import { RENDERER_PROPS } from '@shroom/frontend/core';
import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

const HOST_PROPS = [
  ['rendererId', 'string', '必填', '按它去注册表查描述符。查不到渲染「当前客户端未注册渲染器」，不崩。'],
  ['params', 'object', '—', '渲染器参数。**必须是归一化过的** —— 渲染器读的是完整字段。'],
  ['label', 'string', 'rendererId', '加载中 / 出错时显示的名字。'],
  ['rendererRef', 'ref | fn', '—', '转发给渲染器的命令式句柄。宿主自己内部也持一份，两者不冲突。'],
  ['values', 'number[]', '—', '声明式数据源。给了它就**不**订阅帧总线。数组身份变化才推送。'],
  ['channel', "'sit' | 'back'", "'sit'", '`values` 推给哪条通道 —— 决定内部调 `sitData` 还是 `backData`。'],
  ['frameChannel', 'string', '—', '订阅帧总线并取这条通道。不给就不订阅。与 `values` 互斥。'],
];

const IMPERATIVE = `import { RendererHost } from '@shroom/frontend/react';
import React from 'react';

function Host() {
  const rendererRef = React.useRef(null);

  // 真命令走 ref，不触发重渲染。方法名必须在 descriptor.methods 里声明过，
  // 否则挂载时 auditRendererContract 会报 console.error / warn。
  const onReset = () => rendererRef.current?.reset();

  return (
    <>
      <button onClick={onReset}>复位视角</button>
      <RendererHost rendererId="pointGrid" params={params} rendererRef={rendererRef} />
    </>
  );
}`;

const DATA_REF = `// ⚠️ 点阵渲染器会调这三个方法，但契约里没有它们的声明。
// 调用点是 host.data?.current?.changeData({...}) —— 可选链只保住 current，
// 没保住方法本身。传了 data 但没挂齐这三个，就是 TypeError。
const dataRef = React.useRef({
  changeData({ meanPres, maxPres, point, totalPres }) {
    // 侧栏读数：均压 / 峰值 / 有效点数 / 合力
  },
  handleCharts(totalArr, yMax) {
    // 合力曲线。totalArr 是长度 20 的滑窗，yMax = max + 1000
  },
  handleChartsArea(totalPointArr, yMax) {
    // 有效点数曲线。同样是长度 20 的滑窗，yMax = max + 100
  },
});

<RendererHost rendererId="pointGrid" params={params} data={dataRef} local={false} />

// 不想要读数回调？两条路：
//   1. 干脆不传 data —— 可选链在 current 那一层就短路了，最安全。
//   2. 传 local={true} —— 只挡掉两个 handleCharts*，changeData 照调。`;

export default function Api() {
  return (
    <Prose
      title="RendererHost 入参与命令式方法"
      lede="三条通道各走各的：每帧数据走总线 / values，视图状态走 props，真命令走 ref。"
    >
      <Section title="三条通道">
        <Table
          head={['通道', '用什么', '会不会触发 React 重渲染', '为什么这么分']}
          rows={[
            ['每帧数据（30–100Hz）', <><C>frameChannel</C> 订阅总线</>, '不会',
              '进 setState 就要每帧重渲染整棵子树，主应用那边还要穿过 CanvasCom 故意砌的 shouldComponentUpdate 墙。'],
            ['每帧数据（低频 / demo）', <C>values</C>, '会',
              '声明式，写起来最短。宿主内部把数组转成 sitData({ wsPointData }) 推下去，所以不用认识渲染器的命令式接口。'],
            ['视图状态', <>props（<C>params</C> / <C>colormap</C> / …）</>, '会（本来就该会）',
              '它们本来就是"变了要重画"的东西。'],
            ['真命令', <C>rendererRef.current.xxx()</C>, '不会',
              '暴露面由 descriptor.methods 声明并在挂载时校验。'],
          ]}
        />
        <Note tone="warn" title="values 与 frameChannel 互斥">
          两个都给不会报错，但会**两条通路同时往渲染器里推数据**，
          后到的覆盖先到的，表现为画面抖动或掉帧。选一条。
        </Note>
      </Section>

      <Section title="RendererHost 自己的 props">
        <Table
          head={['prop', '类型', '默认', '说明']}
          rows={HOST_PROPS.map(([name, type, fallback, note]) => [
            <C>{name}</C>, <C>{type}</C>, <C>{fallback}</C>, note,
          ])}
        />
        <p>
          除上面这些之外的 props 会被**原样转发**给渲染器
          （源码里是 <C>...contractProps</C>）。转发的那些应当是
          <a href="#/contract">契约</a> 里那 {Object.keys(RENDERER_PROPS).length} 个之一。
        </p>
      </Section>

      <Section title="宿主帮你挡掉的三件事">
        <Table
          head={['情况', 'RendererHost 的行为']}
          rows={[
            ['rendererId 没注册', '渲染「当前客户端未注册渲染器：xxx」，不崩'],
            ['动态 import 失败（网络 / 路径错）', '渲染「渲染器加载失败：<message>」，并 console.error。缓存被清掉，下次可重试'],
            ['渲染器自身抛异常', <>错误边界圈在这一块里，主界面不白屏。
              <strong>但捕获不到事件处理器和 <C>requestAnimationFrame</C> 回调里的异常</strong>
              —— 3D 渲染循环恰好在 rAF 里，那部分只能靠渲染器自己的防御性判断。</>],
          ]}
        />
      </Section>

      <Section title="命令式方法怎么调">
        <CodeBlock code={IMPERATIVE} />
      </Section>

      <Section title="⚠️ data.current 上那三个未声明的方法">
        <Note tone="bad" title="这是本包目前唯一一处未声明的公开面">
          <C>RENDERER_PROPS</C> 里有 <C>data</C>，但**它的 <C>current</C> 上要有哪三个方法，
          源码之外没有任何地方写过**。点阵渲染器在动画循环里每
          <C>1/fps</C> 秒调一次。本轮只补声明、不改代码 ——
          改成 <C>?.changeData?.()</C> 会把「宿主漏挂方法」从一个响亮的 TypeError
          变成静默 no-op，那比现在更难查。
        </Note>
        <CodeBlock code={DATA_REF} path="宿主侧写法" />
        <Table
          head={['方法', '什么时候调', '参数']}
          rows={[
            [<C>changeData</C>, <>每 <C>1/fps</C> 秒一次，无条件</>,
              <C>{'{ meanPres, maxPres, point, totalPres }'}</C>],
            [<C>handleCharts</C>, <>同上，但 <C>local</C> 为真时跳过</>,
              <C>(totalArr, findMax(totalArr) + 1000)</C>],
            [<C>handleChartsArea</C>, <>同上，<C>local</C> 为真时跳过</>,
              <C>(totalPointArr, findMax(totalPointArr) + 100)</C>],
          ]}
        />
        <p>
          <C>meanPres</C> 是 <C>toFixed(2)</C> 之后的**字符串**，另外三个是数值 ——
          这是原实现的既有行为，搬包时逐字保留。
        </p>
      </Section>

      <Section title="注册表 API">
        <Table
          head={['函数', '干什么']}
          rows={[
            [<C>registerRenderer(descriptor)</C>, '注册。校验失败返回 false 并 console.error，不抛。幂等，按 id 覆盖'],
            [<C>listRenderers({'{ capabilities }'})</C>, '列出全部（可按能力过滤）。Builder 的下拉框用它'],
            [<C>getRendererDescriptor(id)</C>, '取描述符，未注册返回 null'],
            [<C>loadRenderer(id)</C>, '懒加载组件。并发请求共享同一个 Promise；失败会清缓存以便重试'],
            [<C>normalizeRendererParams(id, params)</C>, '交给描述符的 normalizeParams。没有就原样返回'],
            [<C>listRegistrationFailures()</C>, '取注册失败清单。不看它的话失败是静默的'],
            [<C>resolveRendererFromDefinition(def, profileId)</C>, '从展示系统定义解析出 { rendererId, params }。解析不到返回 null，调用方回落旧路径'],
            [<C>resetRendererRegistry()</C>, '清空。仅供测试'],
          ]}
        />
      </Section>
    </Prose>
  );
}
