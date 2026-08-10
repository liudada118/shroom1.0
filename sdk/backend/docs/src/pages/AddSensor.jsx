/**
 * AddSensor.jsx - 「加一种自己的传感器」页
 *
 * 这页是任务导向的：从「手上有一块新垫子」到「画面出图、能采集能导出」，
 * 中间到底要动几个地方。
 *
 * 13 种值类型那张表从真常量读；「schema 覆盖不到什么」那节的内容来自
 * `protocol/presets/README.md`，那份 README 是这几个缺口的权威描述。
 * 这里不重抄字节表 —— 每种协议的字节级说明都在 `presets/*.md` 里，
 * 本页只负责把流程串起来并指过去。
 */

import { PROTOCOL_VALUE_TYPE_WIDTHS } from '@shroom/backend/protocol/displaySystemProtocol.js';
import { SENSOR_CAPABILITIES } from '@shroom/backend/sensors';
import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import DemoCard from '../components/DemoCard.jsx';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';
import ProtocolAuthor from '../demos/ProtocolAuthor.jsx';
import authorSource from '../demos/ProtocolAuthor.jsx?raw';

const PRESET_JSON = `{
  "id": "my-pad-384",
  "label": "自研 24x16 垫子",
  "summary": "会显示在预设下拉里的一句话",
  "doc": "my-pad-384.md",
  "matrix": { "width": 24, "height": 16, "total": 384 },
  "channels": ["sit"],
  "protocol": {
    "baudRate": 1000000,
    "framing": { "type": "fixedLength", "frameLength": 768 },
    "decoding": { "valueType": "uint16le", "byteOffset": 0, "valueCount": 384 },
    "validation": null
  }
}`;

const REGISTRY = `// sdk/backend/sensors/registry.js
myPad384: {
  matrix: { width: 24, height: 16 },
  channels: ['sit'],
  baudRate: 1000000,
  capabilities: ['realtime', 'playback', 'collection', 'csv'],
},`;

const LINE_ORDER = `// 你的走线顺序，输入是解码出来的一维数组，输出也是
function myPadLine(values) {
  const out = new Array(values.length);
  for (let row = 0; row < 16; row += 1) {
    for (let col = 0; col < 24; col += 1) {
      // 举例：设备是从右下角开始按列扫的
      out[row * 24 + col] = values[(23 - col) * 16 + (15 - row)];
    }
  }
  return out;
}`;

const RUNTIME_DROP = `<runtimeWritableRoot>/serial-protocols/my-pad-384.json`;

export default function AddSensor() {
  const valueTypes = Object.entries(PROTOCOL_VALUE_TYPE_WIDTHS);

  return (
    <Prose
      title="加一种自己的传感器"
      lede="大多数情况下不用写代码：一份 JSON 声明就够。这页说清楚什么时候够、什么时候不够。"
    >
      <Section title="先判断：填配置还是写代码">
        <p>
          分界线很清楚 —— <strong>「分隔符或定长切帧 + 整帧一种数值类型平铺」能表达的，
          填配置就行</strong>；表达不了的，得写处理器。
        </p>
        <Table
          head={['你的设备', '够不够']}
          rows={[
            ['一帧一张完整矩阵，所有值同一种类型', <span className="docs-verdict docs-verdict-true">填配置</span>],
            ['帧头 / 帧尾有固定分隔符或帧长固定', <span className="docs-verdict docs-verdict-true">填配置</span>],
            ['值在帧中间（前面有包头、后面有校验）', <span className="docs-verdict docs-verdict-true">填配置（byteOffset）</span>],
            ['一帧里压力是 uint8、姿态是 float32', <span className="docs-verdict docs-verdict-false">要写代码</span>],
            ['两包拼一帧 / 一张矩阵分两片发', <span className="docs-verdict docs-verdict-false">要写代码</span>],
            ['ASCII 文本协议', <span className="docs-verdict docs-verdict-false">要写代码</span>],
          ]}
        />
        <Note tone="warn" title="后三行是 schema 现在的三个缺口，不是「不推荐」">
          <p>它们各自被什么挡住、要补什么，<C>protocol/presets/README.md</C> 里有一张表：</p>
          <ul>
            <li>
              <C>decoding</C> 只能声明<strong>一种</strong> <C>valueType</C> 整帧平铺 ——
              要补成字段数组 <C>{'[{name, valueType, byteOffset, valueCount}]'}</C>。
              挡住了整包 274（压力 + IMU）、262（压力 + 姿态）、bigBed（数据 + 标志字节）。
            </li>
            <li>
              没有<strong>跨帧组装</strong>的概念，一帧进一帧出 ——
              要补 <C>{'assembly: {key, byteOffset, chunkCount}'}</C> 之类的分片声明。
              挡住了双包手套、bigBed 两片拼一张。
            </li>
            <li>
              只能按字节解，没有<strong>文本协议</strong>入口 ——
              要补 <C>framing.type: "text"</C> + 字段正则映射。挡住了敏枕。
            </li>
          </ul>
          <p>
            在补上之前，这些协议走的是手写处理器，不是配置能表达的。
            所以：<strong>先照下面的流程试配置，走不通再去看那三条。</strong>
          </p>
        </Note>
      </Section>

      <Section title="第一步：写协议声明，当场校出来">
        <p>
          <C>validateProtocolConfig()</C> 返回的是<strong>错误字符串数组</strong>（不抛），
          空数组就是通过。下面这块直接拿它跑，改左边看右边。
        </p>
        <DemoCard
          title="协议声明校验器"
          sub="真 validateProtocolConfig + normalizeProtocolConfig + validateFrame + decodeProtocolValues"
          path="src/demos/ProtocolAuthor.jsx"
          source={authorSource}
          minHeight={470}
        >
          <ProtocolAuthor />
        </DemoCard>
        <Note tone="bad" title="两个校验器都管不到的那类错">
          <C>validateProtocolConfig()</C> 只看声明，<C>validateFrame()</C> 在没声明
          {' '}<C>validation</C> 时<strong>一个字节都不数</strong>（直接返回 true）。
          于是「<C>frameLength</C> 和 <C>valueCount × 字节宽</C> 对不上」这种错
          两边都放行，最后表现为解码<strong>悄悄少给一批值</strong> ——
          画面上是传感器坏了半边，日志里干干净净。
          上面 demo 里选第 ⑥ 条能看到，第 ⑦ 条是补上 checksum 之后的对照。
          细节见<a href="#/protocol">协议与解码</a>那页。
        </Note>
        <h3>{valueTypes.length} 种值类型</h3>
        <Table
          head={['valueType', '字节宽']}
          rows={valueTypes.map(([type, width]) => [
            <C>{type}</C>,
            type === 'bit' ? '1（按位展开，LSB 在前）' : `${width}`,
          ])}
        />
        <p>
          <C>byteOffset</C> <strong>可以是负数</strong>，从帧尾往前数 ——
          尾部带姿态字节的协议靠这个定位。
        </p>
      </Section>

      <Section title="第二步：把声明落成预设">
        <p>
          校验过了就存成一份预设 JSON。<C>protocol</C> 那一段
          <strong>不需要任何转换</strong>就能整段粘进展示系统的
          {' '}<C>display-system.json</C> —— 两边是同一份 schema。
        </p>
        <CodeBlock code={PRESET_JSON} language="json" path="protocol/presets/my-pad-384.json" />
        <p>
          <C>matrix</C> 填 <C>null</C> 表示<strong>协议本身不决定矩阵形状</strong>
          （低密度那两种就是这样），得由使用者填。
        </p>
        <Note title="打包之后不用重新构建也能加">
          往可写目录丢 JSON 就行：
          <CodeBlock code={RUNTIME_DROP} language="text" />
          <p>
            加载器把这个目录和内置目录一起扫，<strong>同 id 时用户目录覆盖内置</strong> ——
            所以可以直接改内置预设的波特率而不动源码。
            校验不通过的文件不会让接口挂掉，它会带着原因出现在响应的 <C>invalid</C> 里。
            看加载结果：<C>GET /api/serial/protocols</C>。
          </p>
        </Note>
      </Section>

      <Section title="第三步：注册传感器类型">
        <p>
          协议说的是「字节怎么变数值」，注册表说的是「这个型号有多大、几个通道、能干什么」。
          往 <C>sensors/registry.js</C> 加一条：
        </p>
        <CodeBlock code={REGISTRY} language="javascript" />
        <p>
          <C>capabilities</C> 从这 {Object.keys(SENSOR_CAPABILITIES).length} 个里挑：
          {Object.values(SENSOR_CAPABILITIES).map((value) => <C key={value}>{value} </C>)}
          。每个标签的含义和已有型号的用法在<a href="#/sensors">传感器注册表</a>那页。
        </p>
        <Note tone="warn" title="波特率现在要写两处">
          注册表里写一份，<C>session/profiles.js</C> 的 <C>DEFAULT_SENSOR_PROFILES</C> 里也有一份。
          两边对不上的表现是「串口能开但一帧都解不出来」，而且不报错。
          有测试守着（<C>backendPackageInvariants.test.js</C>），但加新类型时记得两边都填。
          为什么没合并见<a href="#/pitfalls">坑与已知妥协</a>。
        </Note>
      </Section>

      <Section title="第四步：线序（如果需要）">
        <p>
          解码出来的一维数组是<strong>设备的扫描顺序</strong>，不一定是画面上的行列顺序。
          走线绕一圈的垫子，不过线序就会显示成花的。
        </p>
        <p>
          先去<a href="#/line-orders">线序与矩阵</a>那页把现成的
          试一遍 —— 大多数新垫子能直接复用其中一个。都不对再写：
        </p>
        <CodeBlock code={LINE_ORDER} language="javascript" />
        <p>
          约定只有一条：<strong>输入一维数组、输出等长一维数组</strong>，
          不改长度、不改类型。这样它才能插进
          {' '}<C>ProtocolRegistry.parse → applyLineOrder → ZeroCalibrator</C> 那条链。
        </p>
      </Section>

      <Section title="第五步：跑一遍">
        <CodeBlock
          code={`# 先确认协议声明能解出预期长度的数组
node node_modules/@shroom/backend/examples/quickstart.js --mock

# 有硬件了：接上真串口跑 50 帧
node node_modules/@shroom/backend/examples/serial-chain-demo.js \\
  --port COM3 --sensor myPad384 --max-frames 50`}
          language="bash"
        />
        <Table
          head={['症状', '先看哪里']}
          rows={[
            ['一帧都解不出来', <span>波特率对不上（注册表 / profiles 两处都查），或分帧方式错</span>],
            ['解出来了但数量不对', <span>见上面那条旁注：<C>frameLength</C> 和 <C>valueCount × 字节宽</C></span>],
            ['数量对但图是花的', <span>线序不对，去<a href="#/line-orders">线序与矩阵</a>换一个</span>],
            ['图对但采不进库', <span>三个条件之一没满足，去<a href="#/collection">采集与导出</a>拨开关对照</span>],
            ['值全是 0 或全是满值', <span>清零基准（<C>ZeroCalibrator</C>）没建立，或 <C>byteOffset</C> 偏了</span>],
          ]}
        />
      </Section>
    </Prose>
  );
}
