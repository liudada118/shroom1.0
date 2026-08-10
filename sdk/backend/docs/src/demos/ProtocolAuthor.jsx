/**
 * ProtocolAuthor.jsx - 自己写一份 protocol 声明，当场看它错在哪
 *
 * 跑的是 `@shroom/backend/protocol/displaySystemProtocol.js` 的四个真函数：
 * `validateProtocolConfig`（要求：**返回错误字符串数组**，不抛）、
 * `normalizeProtocolConfig`、`validateFrame`、`decodeProtocolValues`。
 *
 * 和「协议与解码」那页的 demo 分工不同：那边是**挑内置预设**看解码结果，
 * 这边是**写自己的声明**看校验器怎么骂你。二开的人真正要做的是后者。
 *
 * ## 一个容易搞混的点
 *
 * `normalizeProtocolConfig()` 是**宽容**的 —— 喂它 `{}` 也照样返回一份补齐默认值的
 * 配置（`baudRate: null`、`delimiter: []`）。它不是校验器。
 * 真正说「这份声明能不能用」的是 `validateProtocolConfig()`。
 * 只调 normalize 不调 validate 的话，会拿到一份「看起来完整、其实开不了口」的配置。
 */

import {
  PROTOCOL_VALUE_TYPE_WIDTHS,
  computeChecksum,
  decodeProtocolValues,
  normalizeProtocolConfig,
  validateFrame,
  validateProtocolConfig,
} from '@shroom/backend/protocol/displaySystemProtocol.js';
import React from 'react';

import Matrix from '../components/Matrix.jsx';

/** 起始模板：一块 24×16 的新垫子，双字节小端，定长帧。 */
const STARTER = `{
  "baudRate": 1000000,
  "framing": {
    "type": "fixedLength",
    "frameLength": 768
  },
  "decoding": {
    "valueType": "uint16le",
    "byteOffset": 0,
    "valueCount": 384
  },
  "validation": null
}`;

/** 几个一键切换的「常见写错法」，省得手打。 */
const CASES = [
  { label: '① 一份能用的（24×16，uint16le 定长）', json: STARTER },
  {
    label: '② 忘了写 baudRate',
    json: STARTER.replace('"baudRate": 1000000,\n  ', ''),
  },
  {
    label: '③ delimiter 分帧但没给分隔符',
    json: `{
  "baudRate": 921600,
  "framing": { "type": "delimiter" },
  "decoding": { "valueType": "uint8", "byteOffset": 0, "valueCount": 1024 }
}`,
  },
  {
    label: '④ 分隔符写成十六进制串（合法，会被解析成字节）',
    json: `{
  "baudRate": 1000000,
  "framing": { "type": "delimiter", "delimiter": "AA 55 03 99" },
  "decoding": { "valueType": "uint8", "byteOffset": 0, "valueCount": 1024 }
}`,
  },
  {
    label: '⑤ valueType 拼错了',
    json: STARTER.replace('uint16le', 'uint16LE'),
  },
  {
    // 这条是本 demo 最要紧的一格：两个校验器都放行，但解码结果是短的。
    // 见页面上「两个校验器都管不到的那类错」。
    label: '⑥ 帧长填小了（两个校验器都放行，解码悄悄少给值）',
    json: STARTER.replace('"frameLength": 768', '"frameLength": 400'),
  },
  {
    label: '⑦ 同上，但补了 sum8 校验（这下拦得住了）',
    json: `{
  "baudRate": 1000000,
  "framing": { "type": "fixedLength", "frameLength": 769 },
  "decoding": { "valueType": "uint16le", "byteOffset": 0, "valueCount": 384 },
  "validation": { "checksum": { "type": "sum8", "byteOffset": 768, "range": [0, 768] } }
}`,
  },
];

/**
 * 按声明造一帧「设备真会发出来的」假数据。
 *
 * 关键是**严格按声明里写的帧长**造，不按解码需要的字节数造 ——
 * 后者会把「帧长填小了」这个错悄悄补上，那就演示不出问题了。
 * 值是同心波纹，只为让图有形状。
 *
 * @param {object} config 归一化后的配置。
 * @returns {Uint8Array} 帧体。
 */
function synth(config) {
  const { valueType, valueCount, byteOffset } = config.decoding;
  const width = PROTOCOL_VALUE_TYPE_WIDTHS[valueType] || 1;

  // 定长帧就按声明的长度造；分隔符帧的长度由数据决定，按解码需要的算。
  const length = config.framing.type === 'fixedLength' && config.framing.frameLength
    ? config.framing.frameLength
    : byteOffset + (valueCount || 0) * width;

  const body = new Uint8Array(Math.max(0, length));
  const side = Math.round(Math.sqrt(valueCount || 1)) || 1;

  for (let i = 0; i < (valueCount || 0); i += 1) {
    const distance = Math.hypot(Math.floor(i / side) - side / 2, (i % side) - side / 2);
    const at = byteOffset + i * width + (valueType.endsWith('be') ? width - 1 : 0);
    if (at < body.length) body[at] = Math.round(120 + 110 * Math.sin(distance / 2.2));
  }

  // 声明了 checksum 的话，把校验字节填成对的 —— 不然看到的是「校验不通过」，
  // 而那只说明这个 demo 造帧造错了，不说明声明有问题。
  const checksum = config.validation?.checksum;
  if (checksum && Number.isInteger(checksum.byteOffset) && checksum.byteOffset >= 0
      && checksum.byteOffset < body.length && Array.isArray(checksum.range)) {
    const [from, to] = checksum.range;
    body[checksum.byteOffset] = computeChecksum(checksum.type, body, from, to);
  }
  return body;
}

export default function ProtocolAuthor() {
  const [text, setText] = React.useState(STARTER);

  const result = React.useMemo(() => {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      return { jsonError: error.message };
    }

    // 顺序有意义：先问「这份声明合法吗」，再拿去归一化。
    const errors = validateProtocolConfig(raw);
    const config = normalizeProtocolConfig(raw);

    const width = PROTOCOL_VALUE_TYPE_WIDTHS[config.decoding.valueType];
    const needBytes = width
      ? config.decoding.byteOffset + (config.decoding.valueCount || 0) * width
      : null;

    if (errors.length) return { errors, config, needBytes, width };

    const body = synth(config);
    const verdict = validateFrame(body, config);
    const values = verdict.ok ? decodeProtocolValues(body, config) : null;
    const expected = config.decoding.valueCount;

    return {
      errors,
      config,
      needBytes,
      width,
      body,
      verdict,
      values,
      expected,
      short: values != null && expected != null && values.length !== expected,
    };
  }, [text]);

  return (
    <div>
      <div className="docs-card-controls" style={{ border: 0, padding: '0 0 12px' }}>
        <label className="docs-field">
          <span>试几种写法</span>
          <select
            value=""
            onChange={(event) => {
              const found = CASES[Number(event.target.value)];
              if (found) setText(found.json);
            }}
          >
            <option value="">选一个填进左边…</option>
            {CASES.map((item, index) => (
              <option key={item.label} value={index}>{item.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="docs-matrix-pair">
        <div className="docs-matrix-panel">
          <p className="docs-matrix-cap">你的 protocol 声明（直接改）</p>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            rows={14}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 8,
              border: '1px solid var(--line)',
              borderRadius: 6,
              background: 'var(--bg-code)',
              color: 'var(--text)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 12.5,
              lineHeight: 1.6,
              resize: 'vertical',
            }}
          />
        </div>

        <div className="docs-matrix-panel">
          {result.jsonError ? (
            <>
              <p><span className="docs-verdict docs-verdict-false">JSON 没解析出来</span></p>
              <div className="docs-mono-out">{result.jsonError}</div>
            </>
          ) : (
            <>
              <p>
                <span className={result.errors.length ? 'docs-verdict docs-verdict-false' : 'docs-verdict docs-verdict-true'}>
                  validateProtocolConfig() → {result.errors.length ? `${result.errors.length} 条错误` : '通过'}
                </span>
              </p>
              {result.errors.length > 0 && (
                <div className="docs-mono-out">
                  {result.errors.map((message) => `• ${message}`).join('\n')}
                </div>
              )}

              <dl className="docs-kv" style={{ marginTop: 10 }}>
                <dt>单值字节宽</dt>
                <dd>
                  {result.width
                    ? `${result.width} 字节（${result.config.decoding.valueType}）`
                    : `未知类型 ${result.config.decoding.valueType}`}
                </dd>
                <dt>解码至少要</dt>
                <dd>{result.needBytes == null ? '算不出来' : `${result.needBytes} 字节`}</dd>
                {result.body && (
                  <>
                    <dt>按声明造出的帧</dt>
                    <dd>{result.body.length} 字节</dd>
                  </>
                )}
              </dl>

              {result.errors.length === 0 && (
                <>
                  <p style={{ marginTop: 10 }}>
                    <span className={result.verdict.ok ? 'docs-verdict docs-verdict-true' : 'docs-verdict docs-verdict-false'}>
                      validateFrame() → {String(result.verdict.ok)}
                    </span>
                    {result.verdict.reason && (
                      <span className="docs-matrix-cap"> · {result.verdict.reason}</span>
                    )}
                  </p>
                  {result.values ? (
                    <>
                      <p>
                        <span className={result.short ? 'docs-badge docs-badge-warn' : 'docs-badge docs-badge-ok'}>
                          解出 {result.values.length} 个 / 声明要 {String(result.expected)} 个
                        </span>
                      </p>
                      <Matrix data={result.values} caption={`decodeProtocolValues() · ${result.values.length} 个值`} />
                      {result.short && (
                        <p className="docs-status">
                          <strong>两个校验器都放行了，但解码结果是短的。</strong>
                          <code>validateProtocolConfig()</code> 只看声明，
                          <code>validateFrame()</code> 在没声明 <code>validation</code> 时
                          一个字节都不数 —— 于是 <code>frameLength</code> 填小了这种错
                          一路走到画面上才被人看见。
                          选一下第 ⑦ 条，看补了 checksum 之后的区别。
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="docs-status">
                      声明合法，但按它造出来的帧被 <code>validateFrame()</code> 拦了
                      （<code>{result.verdict.reason}</code>）。
                      能拦住说明这份声明写了 <code>validation</code> —— 这是好事。
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
