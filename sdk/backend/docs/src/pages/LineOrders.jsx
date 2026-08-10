/**
 * LineOrders.jsx - 「线序与矩阵」页
 *
 * 页面上的两张表**不是写在这里的**，是 `probeLineOrders()` 在渲染时把
 * `@shroom/backend/processing/lineOrders.js` 的全部导出跑一遍分出来的。
 * 往那个模块里加一个函数，这页自己就会多一行。
 */

import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import DemoCard from '../components/DemoCard.jsx';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';
import LineOrderPlayground, { probeLineOrders } from '../demos/LineOrderPlayground.jsx';
import playgroundSource from '../demos/LineOrderPlayground.jsx?raw';

const USAGE = `const { jqbed, carSitLine, footR } = require('@shroom/backend/processing');

// 串口那侧解出来的一维原始帧（32×32 的传感器就是 1024 个数）
const raw = decodeProtocolValues(frameBuffer, preset);

// 按这块垫子的型号选线序，得到"能直接画"的一维矩阵
const matrix = jqbed(raw);
`;

export default function LineOrders() {
  const { playable, others } = probeLineOrders();

  return (
    <Prose
      title="线序与矩阵"
      lede="传感器扫描出来的数组顺序，和它贴在垫子上的物理排布几乎从来不是一回事。线序函数就是这两者之间的那层翻译。"
    >
      <p>
        一块 32×32 的压力垫，采集板按自己的走线顺序把 1024 个 ADC 值读出来。这个顺序取决于
        <strong>板子怎么焊的</strong>，不取决于点位在垫子上的位置 —— 换一版硬件、换一个厂家、
        甚至同一块垫子换个安装方向，顺序就变了。所以拿到原始帧之后、画之前，必须先过一道重排。
      </p>
      <p>
        <C>@shroom/backend/processing</C> 里囤着这些年攒下来的 {playable.length + others.length} 个导出，
        每一个对应一款实际出过货的垫子（车座、车背、床垫、手套、鞋垫……）。它们是纯函数：
        进一个数组，出一个数组，不碰硬件、不碰文件、不留状态。所以下面这块能直接在浏览器里跑。
      </p>

      <Section title="拨一下看看">
        <p>
          左边是合成的输入帧，右边是选中的线序函数<strong>真跑出来</strong>的结果。
          默认的「角标」图案是刻意做成不对称的 —— 线序干的事大多是翻转、旋转、平移，
          对称图形看不出区别。
        </p>

        <DemoCard
          title="线序变换对照"
          sub={`${playable.length} 个能画成图的导出，全部来自模块本身`}
          path="src/demos/LineOrderPlayground.jsx"
          source={playgroundSource}
          minHeight={360}
        >
          <LineOrderPlayground />
        </DemoCard>

        <Note tone="warn" title="右边那张图的行列，有一半是猜的">
          线序函数返回<strong>一维数组</strong>，包里没有任何地方声明「这 147 个值该排成几行几列」——
          那是消费端渲染器的事。所以输出长度不是完全平方数时（60、147、2048…），
          这里的行列是按因数拆的，只保证能看见分布。真实排布要看你喂给
          <C>@shroom/frontend</C> 的 <C>matrixWidth</C>。
        </Note>
      </Section>

      <Section title="怎么用">
        <p>
          典型链路是「串口收帧 → 解码成一维数组 → 按型号过线序 → 交给渲染器」。
          线序这一步就一行：
        </p>
        <CodeBlock code={USAGE} language="javascript" path="你的项目里" />
        <p>
          从 <C>@shroom/backend/processing</C> 这个入口进来的东西<strong>零原生依赖</strong> ——
          不需要 serialport，也不需要 better-sqlite3。只装包本身就能用。
        </p>
      </Section>

      <Section title="全部导出（从模块真读）">
        <p>
          下面这两张表是把模块的 <C>Object.entries()</C> 挨个喂一帧 32×32 探出来的，
          不是手抄的清单。分成两张，是因为这个模块里的导出形状确实不齐。
        </p>

        <h3>能吃一整帧、返回数组的（{playable.length} 个）</h3>
        <Table
          head={['导出名', '输出长度', '说明']}
          rows={playable.map((item) => [
            <C>{item.name}</C>,
            `${item.length}`,
            item.length === 1024
              ? '整帧进整帧出，直接能画'
              : '抽点：只取传感器上真正有意义的那些位置',
          ])}
        />

        <h3>其余 {others.length} 个</h3>
        <Table
          head={['导出名', '为什么不在上面', '探测到的实际情况']}
          rows={others.map((item) => [<C>{item.name}</C>, item.kind, item.detail])}
        />

        <Note title="这两张表会自己长">
          往 <C>lineOrders.js</C> 里加一个导出，刷新页面它就出现了 —— 落在哪张表里，
          由它<strong>实际返回什么</strong>决定，不由谁记得来改文档决定。
        </Note>
      </Section>
    </Prose>
  );
}
