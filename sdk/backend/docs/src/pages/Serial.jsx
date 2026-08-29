/**
 * Serial.jsx - 「串口与会话」页
 *
 * ## 这页为什么没有活预览
 *
 * `@shroom/backend/serial` 硬依赖 `serialport`（原生模块），`@shroom/backend/session`
 * 又在它上面。浏览器里两者都不存在，所以这页**不 import 它们** ——
 * import 一下整个站就白屏了。
 *
 * 但「不能跑」不等于「只能手抄」。这页的 API 表是构建期从**真源码文本**里正则抠出来的：
 * `import.meta.glob(..., { query: '?raw' })` 拿到每个文件的原文，
 * 再从 `module.exports = { … }` 那一段读导出名。
 * 有人加一个导出，这张表自己就多一行；有人删一个，表跟着少 ——
 * 和别的页「从真代码读」是同一条约定，只是读的是文本而不是值。
 *
 * 路径是相对的（`../../../serial/`），因为 `import.meta.glob` 不吃裸包名。
 * 能这么写是因为 `docs/` 就在包目录里。
 */

import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

/** 串口层四个文件的原文（构建期读进来的）。 */
const SERIAL_SOURCES = import.meta.glob('../../../serial/*.js', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** `examples/serial-chain-demo.js` 的原文。 */
const CHAIN_DEMO = Object.values(import.meta.glob('../../../examples/serial-chain-demo.js', {
  query: '?raw',
  import: 'default',
  eager: true,
}))[0];

/**
 * 从源码文本里抠出 `module.exports = { a, b, c }` 的导出名。
 *
 * 只认这一种写法 —— 包里四个串口文件全是这个形状。哪天有人改成
 * `module.exports.foo = …`，这里会返回空数组，表格空掉，
 * 那是**看得见的**失败，比悄悄少一行强。
 *
 * @param {string} source 文件原文。
 * @returns {string[]} 导出的标识符名。
 */
function exportedNames(source) {
  const match = source.match(/module\.exports\s*=\s*\{([\s\S]*?)\}/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
}

/** 文件名 → 这个文件管什么。表里的行是真扫出来的，这里只补一句人话。 */
const FILE_NOTES = {
  'serialHelper.js': '单个串口的开 / 关 / 写，以及端口枚举',
  'serialManager.js': '多路串口（sit / back / head / sensor）的生命周期与断线重连',
  'serialParserManager.js': '命名 parser 通道；把一份 protocol 声明直接变成切帧器',
  'serialPortFilterService.js': '按平台和厂商 ID 滤掉不是传感器的端口',
  'index.js': '入口，把上面四个摊平',
};

const OPEN = `const { createSerialManager, createParserFromProtocol } = require('@shroom/backend/serial');
const { getSerialProtocolPreset } = require('@shroom/backend/protocol');

const manager = createSerialManager({
  logger: console,
  // createSerialPort 也能替换 —— 测试里塞个假的就不需要真硬件
});

const preset = getSerialProtocolPreset('matrix-256');
const parser = createParserFromProtocol(preset.protocol);

await manager.open('sit', { path: 'COM3', baudRate: preset.protocol.baudRate });
manager.pipe('sit', parser);
parser.on('data', (frame) => { /* 一帧完整的帧体 */ });`;

const SESSION = `const { ShroomSensorSDK } = require('@shroom/backend/session');

const sdk = new ShroomSensorSDK({ dbDir: './db', exportDir: './out' });
const session = await sdk.open({ sensorType: 'hand0205', channels: { sit: 'COM3' } });

session.on('frame', (frame) => {
  // 已经解码、过线序、减完清零基准了
  console.log(frame.channel, frame.pressureData.length);
});`;

export default function Serial() {
  const files = Object.entries(SERIAL_SOURCES)
    .map(([path, source]) => ({
      file: path.split('/').pop(),
      source,
      names: exportedNames(source),
      lines: source.split('\n').length,
    }))
    .sort((a, b) => a.file.localeCompare(b.file));

  const total = files.reduce((sum, item) => sum + item.names.length, 0);

  return (
    <Prose
      title="串口与会话"
      lede="唯一硬依赖原生模块的一层。浏览器里跑不了，所以这页只讲链路、摊真源码。"
    >
      <Note tone="warn" title="这页没有活预览，而且不可能有">
        <C>@shroom/backend/serial</C> 要 <C>serialport</C>，<C>@shroom/backend/session</C>
        {' '}在它之上还要 <C>better-sqlite3</C>。浏览器里没有串口也没有原生模块 ——
        本页连 <C>import</C> 都不做，import 一下整个文档站就白屏了。
        下面的表是构建期从<strong>真源码文本</strong>里抠出来的，代码块是<strong>真文件</strong>。
      </Note>

      <Section title="一帧数据要过几道手">
        <p>从电平到能画的矩阵，中间是这么几层，每层都能单独换掉：</p>
        <div className="docs-stage-flow">
          <div className="docs-stage-body">
            <C>SerialPort</C> → <C>DelimiterParser</C>（或定长）→ <C>ProtocolRegistry.parse</C>
            {' '}→ <C>applyLineOrder</C> → <C>ZeroCalibrator</C> → <C>frame</C> 事件
            → <C>CaptureStore</C> → <C>CsvExporter</C>
          </div>
        </div>
        <Table
          head={['这一步', '在哪个包入口', '要装什么']}
          rows={[
            ['开口子、断线重连', <C>/serial</C>, <span><C>serialport</C></span>],
            ['切帧', <C>/serial</C>, <span><C>@serialport/parser-delimiter</C></span>],
            ['解字节 → 数值', <C>/protocol</C>, <span style={{ color: 'var(--text-dim)' }}>无</span>],
            ['线序、插值、压力换算', <C>/processing</C>, <span style={{ color: 'var(--text-dim)' }}>无</span>],
            ['清零、会话编排', <C>/session</C>, <span><C>serialport</C> + 上面各项</span>],
            ['落库', <C>/storage</C>, <span><C>better-sqlite3</C></span>],
            ['导出', <C>/export</C>, <span><C>csv-writer</C></span>],
          ]}
        />
        <p>
          中间那两层<strong>不碰硬件也不碰磁盘</strong>，所以拿一段字节数组就能单测 ——
          这也是<a href="#/protocol">协议与解码</a>和<a href="#/line-orders">线序与矩阵</a>
          那两页能在浏览器里真跑的原因。
        </p>
      </Section>

      <Section title="自己管口子">
        <CodeBlock code={OPEN} language="javascript" />
        <p>
          <C>createSerialManager()</C> 和 <C>createSerialParserManager()</C> 都是依赖注入的工厂，
          <C>logger</C> 和 <C>createSerialPort</C> 都能替换 —— 所以测试里不需要真串口。
        </p>
      </Section>

      <Section title="让 session 层管">
        <p>不想自己拼链路的话，<C>ShroomSensorSDK</C> 把整条链包好了：</p>
        <CodeBlock code={SESSION} language="javascript" />
        <p>
          代价是它把 <C>/serial</C> + <C>/storage</C> + <C>/export</C> 全拉进来了，
          peer 依赖要装齐。只想要算法的话别走这个入口，见
          <a href="#/intro">这个包是什么</a>那张分层表。
        </p>
      </Section>

      <Section title={`串口层导出了什么（${total} 个）`}>
        <p>
          下面这张表是构建期扫 <C>serial/*.js</C> 的 <C>module.exports</C> 得到的，
          不是手抄的。
        </p>
        <Table
          head={['文件', '行数', '管什么', '导出']}
          rows={files.map((item) => [
            <C>{item.file}</C>,
            `${item.lines}`,
            FILE_NOTES[item.file] || <em>（未登记）</em>,
            item.names.length
              ? item.names.map((name) => <C key={name}>{name} </C>)
              : <span style={{ color: 'var(--text-dim)' }}>—（不是 module.exports = {'{}'} 的写法）</span>,
          ])}
        />
      </Section>

      <Section title="serial-chain-demo.js 全文">
        <p>
          包里 <C>examples/serial-chain-demo.js</C> 的<strong>真文件</strong>。
          它把「开口 → 切帧 → 解码 → 入库」跑了一遍，
          带 <C>--mock</C> 就用造出来的假帧代替真串口，没硬件也能看完整流程：
        </p>
        <CodeBlock code="node node_modules/@shroom/backend/examples/serial-chain-demo.js --mock" language="bash" />
        <CodeBlock
          code={CHAIN_DEMO}
          language="javascript"
          path="sdk/backend/examples/serial-chain-demo.js"
          note="包里那个文件本身，不是抄的"
        />
      </Section>
    </Prose>
  );
}
