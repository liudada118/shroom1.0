/**
 * Sensors.jsx - 「传感器注册表」页
 *
 * 页面上的数字（多少个类型、每种能力多少个）全部是渲染时数出来的。
 * 往 `sensors/registry.js` 加一条定义，这页的每个计数都会变。
 */

import {
  SENSOR_CAPABILITIES,
  SENSOR_DEFINITIONS,
  hasCapability,
} from '@shroom/backend/sensors';
import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import DemoCard from '../components/DemoCard.jsx';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';
import SensorBrowser from '../demos/SensorBrowser.jsx';
import browserSource from '../demos/SensorBrowser.jsx?raw';

const USE = `const {
  getSensorMatrix, getSensorChannels, getSensorBaudRate, hasCapability,
} = require('@shroom/backend/sensors');

const { width, height, total } = getSensorMatrix('hand0205');   // 16 × 16 = 256
const channels = getSensorChannels('hand0205');                 // ['sit', 'back']
const baudRate = getSensorBaudRate('hand0205');                 // 921600

if (hasCapability('hand0205', 'csv')) {
  // 这个型号支持导出 CSV
}`;

const BAD = `// 别这么写：注册表里已经有的知识，散到业务代码里就再也收不回来了
if (type === 'hand0205' || type === 'hand0205Double' || type.startsWith('hand')) {
  width = 16;
}`;

const CAPABILITY_MEANING = {
  realtime: '实时出图',
  playback: '历史回放',
  collection: '采集入库',
  csv: '导出 CSV',
  zeroFrame: '存零点帧（清零基准跟着数据一起落库）',
  threePort: '三口设备（sit / back / head 各占一个串口）',
  handStorage: '手部专用存储结构',
  smallBedMatrix: '小床矩阵存储结构',
};

export default function Sensors() {
  const types = Object.keys(SENSOR_DEFINITIONS);
  const capabilities = Object.entries(SENSOR_CAPABILITIES);
  const withPlugin = types.filter((type) => SENSOR_DEFINITIONS[type].plugin);
  const withOwnBaud = types.filter((type) => SENSOR_DEFINITIONS[type].baudRate != null);

  return (
    <Prose
      title="传感器注册表"
      lede={`${types.length} 种传感器型号，每种的矩阵尺寸、通道、波特率、能力标签都在一张表里。业务代码里不该再出现 if (type === 'xxx')。`}
    >
      <p>
        这些年出过的垫子型号有 {types.length} 种：车座、车背、床垫、手套、鞋垫、办公椅……
        它们的差别是<strong>数据</strong>层面的（矩阵多大、走几个通道、波特率多少、支不支持清零帧），
        不是<strong>逻辑</strong>层面的。所以全部收进一张注册表，业务代码只问不判。
      </p>
      <CodeBlock code={USE} language="javascript" />
      <Note tone="bad" title="注册表存在的意义就是消灭这种代码">
        <CodeBlock code={BAD} language="javascript" />
        写成这样的话，加一种型号要改 N 处，而且改漏了不会报错 —— 只会在某个通道上悄悄画错。
      </Note>

      <Section title="翻一翻">
        <p>
          左边是 {types.length} 条真定义，点任意一行看详情。上面的筛选走的是包里的
          <C>hasCapability()</C>，不是这个页面自己实现的判定。
        </p>
        <DemoCard
          title="注册表浏览器"
          sub={`${types.length} 个型号 · ${capabilities.length} 种能力标签 · 全部来自 SENSOR_DEFINITIONS`}
          path="src/demos/SensorBrowser.jsx"
          source={browserSource}
          minHeight={460}
        >
          <SensorBrowser />
        </DemoCard>
      </Section>

      <Section title={`${capabilities.length} 种能力标签`}>
        <p>
          能力不是「这个型号高级不高级」，是<strong>调用方需要分支的地方</strong> ——
          每一个标签都对应主应用里某一处曾经是 <C>if (type === …)</C> 的代码。
        </p>
        <Table
          head={['SENSOR_CAPABILITIES', '值', '含义', '有几种型号']}
          rows={capabilities.map(([name, value]) => [
            <C>{name}</C>,
            <C>{value}</C>,
            CAPABILITY_MEANING[value] || <em>（未登记含义）</em>,
            `${types.filter((type) => hasCapability(type, value)).length} / ${types.length}`,
          ])}
        />
      </Section>

      <Section title="两个容易踩的点">
        <h3>波特率：定义里没写不等于没有</h3>
        <p>
          {types.length} 种里只有 {withOwnBaud.length} 种在定义里显式写了 <C>baudRate</C>。
          其余的走 <C>getSensorBaudRate()</C> 的默认规则 ——
          所以<strong>要读波特率一律调函数，别直接读字段</strong>。
          上面浏览器的表格列故意读的是字段（显示「默认」），右边详情读的是函数，两者对照着看就明白了。
        </p>

        <h3>有 {withPlugin.length} 种带协议插件</h3>
        <p>
          {withPlugin.map((type) => <C key={type}>{type}</C>).reduce((acc, item, index) => (
            index === 0 ? [item] : [...acc, '、', item]
          ), [])}
          {' '}的分帧规则写死在包里（<C>plugin</C> 字段），
          不走<a href="#/protocol">协议与解码</a>那套通用声明。
          原因是它们的帧结构不是「分隔符 + 定长数值」能表达的
          —— 比如 <C>hand0205Double</C> 是两个不同长度的包交替发。
        </p>
        <Note tone="warn" title="注册表不是唯一的传感器元数据">
          <C>session/profiles.js</C> 里还有一份（分帧 / 解码偏移 / 波特率）。
          两边共有的类型波特率必须一致，有测试守着。为什么没合并、合并的风险是什么，
          见<a href="#/pitfalls">坑与已知妥协</a>。
        </Note>
      </Section>
    </Prose>
  );
}
