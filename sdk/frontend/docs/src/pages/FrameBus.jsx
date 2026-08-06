/**
 * FrameBus.jsx - 帧总线与 useSceneFrame
 *
 * `SCENE_CHANNELS` 那张表从 `core/sceneFrame.js` 直接读，不手抄 ——
 * 加一条通道，这页自动多一行。
 *
 * 页面里那块活的示例是全仓 `useSceneFrame` 的**第一个消费者**。
 */

import { SCENE_CHANNELS } from '@shroom/frontend/core';
import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import DemoCard from '../components/DemoCard.jsx';
import FrameBusDemo from '../demos/FrameBusDemo.jsx';
import demoSource from '../demos/FrameBusDemo.jsx?raw';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

/** 通道说明。键从 `SCENE_CHANNELS` 读，只有「装什么」这一列是写在这里的。 */
const CHANNEL_NOTES = {
  sit: '映射之后的主数据。旧代码里的 147 点 / newArr。绝大多数渲染器只吃这一条',
  back: '背部',
  raw: '原始未映射矩阵（旧代码里的 256 点）。长度不足 256 时回落到 sit，不画空白',
  left: '双手套的左手',
  right: '双手套的右手',
  palm: '手掌。与 finger 同源，都是 padThumbGap 补零后的数组',
  finger: '手指。与 palm 共用同一份数组，不重复分配',
  head: '头部',
};

const PUBLISH = `import { buildSceneFrame, publishFrame } from '@shroom/frontend/core';

// 接真后端时：让 buildSceneFrame 拼帧，别手拼。
// 它带着老协议的补位规则（拇指位补三个 0、raw 不足 256 回落），
// 那些规则是从 Home.jsx 那 900 行 if 阶梯里收出来的，重写一遍必然漏。
socket.onmessage = (event) => {
  const payload = JSON.parse(event.data);
  publishFrame(buildSceneFrame({
    values: payload.mapped,      // → channels.sit
    rawPayload: payload.raw,     // → channels.raw（可以是数组，也可以是 JSON 字符串）
    showType: 'palm',            // → channels.palm（补零后）
    width: 16,
    meta: { matrixName: payload.name },
  }));
};`;

const SUBSCRIBE = `import { useSceneFrame } from '@shroom/frontend/react';

function MyRenderer() {
  const canvasRef = React.useRef(null);

  // 回调里**直接画**，不 setState。整条总线存在的理由就是这一句。
  useSceneFrame((frame) => {
    const values = frame?.channels?.sit;
    if (!Array.isArray(values)) return;
    drawTo(canvasRef.current, values);
  });

  return <canvas ref={canvasRef} />;
}`;

export default function FrameBus() {
  const channelEntries = Object.entries(SCENE_CHANNELS);

  return (
    <Prose
      title="帧总线与 useSceneFrame"
      lede="30–100Hz 的数据不该走 props。总线让数据流和渲染流彻底分开：
            发布方不认识渲染器，渲染器自己订自己那条通道。"
    >
      <Note title="为什么不是 props">
        主应用的 <C>CanvasCom.shouldComponentUpdate</C> 是一堵**故意砌的墙** ——
        它只放行 5 个稳定字符串键，其余 prop 一律挡住，为的就是别让高频数据去调和
        <C>Home.jsx</C> 那棵 5000 多行的渲染树。把帧数据改成 prop 会正面撞上这堵墙。
        所以总线<strong>不进 React state</strong>：<C>publishFrame</C> 同步调订阅者，
        一帧都不触发重渲染。
      </Note>

      <Section title="活的：一发一收">
        <p>
          左边是一个 <C>useSceneFrame</C> 订阅者（它 <C>setState</C> 了，因为它要显示文字，
          而且节流到 5Hz）；右边是 <C>RendererHost</C> 用 <C>frameChannel=&quot;sit&quot;</C>
          订同一条总线。两者之间**没有任何 props 往来** —— 发布方也不认识它们。
        </p>
        <DemoCard
          title="publishFrame → 两个互不相识的订阅者"
          sub="右边那块是「写自己的渲染器」那页造的第三方渲染器，按容器尺寸画"
          path="docs/src/demos/FrameBusDemo.jsx"
          source={demoSource}
          mode="fill"
          height={280}
          hint="30fps · 合成帧"
        >
          <FrameBusDemo />
        </DemoCard>
      </Section>

      <Section title="发布侧">
        <CodeBlock code={PUBLISH} />
        <Table
          head={['函数', '干什么', '返回']}
          rows={[
            [<C>publishFrame(frame)</C>, '同步调用全部订阅者，并记下这一帧',
              <>收到的订阅者数量。<strong>某个订阅者抛异常不会带塌其余</strong> ——
                一个渲染器画崩了，侧栏统计还得照常走</>],
            [<C>buildSceneFrame(input)</C>, '把原始数据拼成规范帧',
              <C>{'{ values, raw, width, meta, channels }'}</C>],
            [<C>getLastFrame()</C>, '读最近一帧',
              '给不方便订阅的调用方用（比如点一次按钮才需要当前值的命令）'],
            [<C>clearLastFrame()</C>, '丢弃最近一帧', <>—</>],
            [<C>resetFrameBus()</C>, <>清空订阅者<strong>和</strong>最近帧</>,
              <>—。<strong>仅供测试</strong>，业务代码里调它等于把别人的订阅也踢了</>],
          ]}
        />
        <Note tone="warn" title="切换展示形式时必须 clearLastFrame()">
          新订阅者挂上来时，总线会把 <C>lastFrame</C> <strong>同步补发一次</strong>。
          这一条是必需的（渲染器懒加载，挂载完成时数据流早就在跑了，不补发就要空到下一帧），
          但代价是：不清的话，切到下一个设备时会先画一帧<strong>上一个矩阵的数据</strong>，
          形状还对不上。
        </Note>
      </Section>

      <Section title={`${channelEntries.length} 条通道`}>
        <p>
          帧不是裸数组，是 <C>{'{ channels, raw, values, width, meta }'}</C>。
          渲染器声明自己吃哪条，宿主按声明喂 —— 加一条通道不用改宿主。
          <strong>通道按需生成</strong>：没给 <C>showType</C> 就不算 palm/finger，
          100Hz 下不会为用不上的通道每帧多分配数组。
        </p>
        <Table
          head={['常量', '值', '装什么']}
          rows={channelEntries.map(([key, value]) => [
            <C>SCENE_CHANNELS.{key}</C>,
            <C>{value}</C>,
            CHANNEL_NOTES[value] || '—',
          ])}
        />
      </Section>

      <Section title="订阅侧">
        <CodeBlock code={SUBSCRIBE} />
        <Table
          head={['细节', '为什么']}
          rows={[
            [<>handler 存在 ref 里，<strong>不进依赖数组</strong></>,
              <>帧回调多半是内联箭头函数，每次渲染都是新引用。直接进依赖就变成
                「每渲染一次退订重订一次」。存 ref 之后订阅只在挂载时建一次。</>],
            [<>叫 <C>useSceneFrame</C> 而不是 <C>useFrame</C></>,
              <>react-three-fiber 有个同名 API。重名会让以后读代码的人认错。</>],
            [<>第二个参数 <C>enabled</C></>,
              <>传 <C>false</C> 就不订阅（依赖数组里只有它）。用于「这块暂时不需要数据」。</>],
            [<>回调里别 <C>setState</C></>,
              <>能 setState 的话就没必要用总线了 —— 直接传 props 更简单。
                本页那个读数面板是例外：它要显示文字，而且节流到了每 6 帧一次。</>],
          ]}
        />
      </Section>

      <Section title="用 RendererHost 的话更短">
        <CodeBlock
          code={`// 宿主替你订阅、取通道、调渲染器的 sitData / backData。
// 注意：给了 frameChannel 就不要再给 values，两条通路互斥。
<RendererHost rendererId="numMatrix" params={params} frameChannel="sit" />`}
        />
        <p>
          宿主内部只认 <C>sit</C> 与 <C>back</C> 两个名字（决定调
          <C>sitData</C> 还是 <C>backData</C>），其余通道名一律走 <C>sitData</C>。
          明细见 <a href="#/api">RendererHost 入参与方法</a>。
        </p>
      </Section>
    </Prose>
  );
}
