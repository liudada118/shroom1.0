/**
 * Protocol.jsx - 「协议与解码」页
 *
 * 预设一览和常量表都从包里真读：预设走 `import.meta.glob`（见 demo 文件的说明），
 * 值类型 / 校验算法 / 分帧方式三张表直接摊开 `displaySystemProtocol.js` 导出的常量。
 */

import {
  PROTOCOL_CHECKSUM_TYPES,
  PROTOCOL_FRAMING_TYPES,
  PROTOCOL_VALUE_TYPE_WIDTHS,
} from '@shroom/backend/protocol/displaySystemProtocol.js';
import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import DemoCard from '../components/DemoCard.jsx';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';
import ProtocolDecoder, { PRESETS } from '../demos/ProtocolDecoder.jsx';
import decoderSource from '../demos/ProtocolDecoder.jsx?raw';

const DECLARE = `{
  "baudRate": 921600,
  "framing": { "type": "delimiter", "delimiter": [170, 85, 3, 153] },
  "decoding": { "valueType": "uint8", "byteOffset": 0, "valueCount": 256 }
}`;

const USE = `const {
  normalizeProtocolConfig, validateFrame, decodeProtocolValues,
} = require('@shroom/backend/protocol');

const config = normalizeProtocolConfig(myProtocolJson);   // 补默认值、统一形状

// 串口切帧器给你一段帧体
parser.on('data', (frame) => {
  const verdict = validateFrame(frame, config);
  if (!verdict.ok) return console.warn('丢帧:', verdict.reason);

  const values = decodeProtocolValues(frame, config);      // 一维数值数组
});`;

export default function Protocol() {
  return (
    <Prose
      title="协议与解码"
      lede="一份协议就是一段 JSON：怎么切帧、怎么读数、要不要校验。包里不写 if，写声明。"
    >
      <p>
        每家厂的采集板串口格式都不一样 —— 分隔符不同、值是一字节还是两字节、
        大端还是小端、前面有没有包头。传统做法是为每种板子写一个 <C>parseXxxFrame()</C>，
        写到第八种的时候就没人敢动了。
      </p>
      <p>
        这里换成<strong>数据</strong>：协议声明是一段 JSON，schema 只有
        <C>protocol/displaySystemProtocol.js</C> 这一份。
        <C>createParserFromProtocol()</C> 直接把它变成切帧器。
      </p>
      <CodeBlock code={DECLARE} language="json" path="一份协议声明的最小形状" />

      <Section title="拨一下看看">
        <p>
          下面这块跑的是包里的 <C>normalizeProtocolConfig</C> → <C>validateFrame</C> →
          <C>decodeProtocolValues</C> 三个真函数。换预设，右边的图和左边的字节都会跟着变。
        </p>
        <p>
          下面那两个开关是一对，请连着试：先只勾「砍掉帧尾」，
          再把「补一段 sum8 校验声明」也勾上。结论反直觉，卡片下面那条旁注专门说它。
        </p>

        <DemoCard
          title="造帧 → 校验 → 解码"
          sub={`${PRESETS.length} 份内置预设，全部从 protocol/presets/*.json 读`}
          path="src/demos/ProtocolDecoder.jsx"
          source={decoderSource}
          minHeight={420}
        >
          <ProtocolDecoder />
        </DemoCard>

        <Note tone="bad" title="validateFrame() 不检查帧长。截断的帧会被静默地少解一批值。">
          <p>
            看实现（<C>displaySystemProtocol.js:292</C>）：<C>validation</C> 为空就直接
            <C>{'return { ok: true, reason: null }'}</C>，一个字节都不数。
            而<strong>{PRESETS.length} 份内置预设全都没写 <C>validation</C></strong>。
          </p>
          <p>
            所以一帧 1024 点的数据被砍到 614 字节时，真实结局是：
            <C>validateFrame()</C> 返回 true，<C>decodeProtocolValues()</C> 返回
            <strong>614 个值</strong>，不抛错、不警告。
            画面上是「传感器坏了半边」，日志里干干净净 —— 这一层最难查的就是这类故障。
          </p>
          <p>
            两个办法，二选一：
          </p>
          <ul>
            <li>
              给协议声明 <C>validation.checksum</C>，且 <C>byteOffset</C> 用<strong>绝对偏移</strong>
              （不是负数）。帧一短，偏移就落到帧外面，<C>validateFrame()</C> 才会返回
              <C>{'{ ok: false, reason: \'length\' }'}</C>。
            </li>
            <li>
              调用方自己比 <C>values.length</C> 和 <C>config.decoding.valueCount</C>。
              没写 validation 的预设只能靠这条。
            </li>
          </ul>
        </Note>
      </Section>

      <Section title={`${PRESETS.length} 份内置预设`}>
        <p>
          这张表是构建期扫 <C>protocol/presets/*.json</C> 得到的，
          往那个目录丢一份 JSON，表格自己就多一行。
        </p>
        <Table
          head={['id', '矩阵', '通道', '波特率', '值类型', '说明']}
          rows={PRESETS.map((preset) => [
            <C>{preset.id}</C>,
            preset.matrix ? `${preset.matrix.width}×${preset.matrix.height}` : '不定',
            (preset.channels || []).join(' / ') || '—',
            preset.protocol?.baudRate ?? '—',
            <C>{preset.protocol?.decoding?.valueType}</C>,
            preset.summary,
          ])}
        />
        <Note title="运行时还能再加">
          主应用打包后，用户往 <C>&lt;runtimeWritableRoot&gt;/serial-protocols/</C> 丢 JSON 就能加协议，
          同 id 覆盖内置，不用重新构建。那条路径走的是包里的
          <C>loadSerialProtocolPresets()</C>（<C>fs.readdirSync</C>），
          本页在浏览器里跑不了它，所以换成了构建期扫目录 —— 扫的是同一批文件。
        </Note>
      </Section>

      <Section title="schema 里都有什么">
        <h3>值类型（{Object.keys(PROTOCOL_VALUE_TYPE_WIDTHS).length} 种）</h3>
        <Table
          head={['valueType', '字节宽度']}
          rows={Object.entries(PROTOCOL_VALUE_TYPE_WIDTHS).map(([type, width]) => [<C>{type}</C>, `${width}`])}
        />

        <h3>分帧方式</h3>
        <Table
          head={['framing.type', '要配什么']}
          rows={[
            [<C>{PROTOCOL_FRAMING_TYPES.DELIMITER}</C>, <span><C>delimiter</C>（字节数组）+ 可选 <C>includeDelimiter</C></span>],
            [<C>{PROTOCOL_FRAMING_TYPES.FIXED_LENGTH}</C>, <span><C>frameLength</C>（字节数）</span>],
          ]}
        />

        <h3>校验算法</h3>
        <Table
          head={['validation.type', '']}
          rows={PROTOCOL_CHECKSUM_TYPES.map((type) => [
            <C>{type}</C>,
            type === 'crc16-modbus' ? '两字节，工业设备最常见' : '一字节',
          ])}
        />
        <p>
          <C>validation</C> 整段可以不写，{PRESETS.length} 份内置预设目前全都没写 ——
          那时 <C>validateFrame()</C> <strong>什么都不查，直接返回 true</strong>。
          后果见上面那条旁注。
        </p>
      </Section>

      <Section title="接到自己的串口上">
        <CodeBlock code={USE} language="javascript" />
        <p>
          这一层<strong>不碰硬件</strong>，所以零依赖：<C>@shroom/backend/protocol</C> 只用到
          <C>fs</C>（node 内置，扫预设目录用）。真要开串口是
          <a href="#/serial">串口与会话</a>那页的事。
        </p>
        <p>
          同一段 JSON 也能整段粘进展示系统 manifest 的 <C>protocol</C> 字段 ——
          <strong>不是两套格式</strong>。想加一种自己的传感器，走
          <a href="#/add-sensor">加一种自己的传感器</a>。
        </p>
      </Section>
    </Prose>
  );
}
