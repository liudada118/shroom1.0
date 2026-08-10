/**
 * ProtocolDecoder.jsx - 造一帧、校验它、解码它
 *
 * 跑的是 `@shroom/backend/protocol/displaySystemProtocol.js` 里的
 * `normalizeProtocolConfig` / `validateFrame` / `decodeProtocolValues` 三个真函数。
 * 预设也是包里那些 `.json` 真文件。
 *
 * ## 预设为什么用 `import.meta.glob` 而不是 `getSerialProtocolPreset()`
 *
 * 包里那个 `protocol/presets/index.js` 是**扫目录**的（`fs.readdirSync`），
 * 在浏览器里没有文件系统 —— 文档站给 `fs` 配的是抛错桩（见 `docs/shims/fs.js`），
 * 走到那儿会直接炸，这是故意的：静默返回「0 份预设」比一条明确的错难查得多。
 *
 * 所以这里换成 Vite 的 `import.meta.glob` 在**构建期**扫同一个目录。
 * 拿到的是同一批 JSON 文件，而且新增一份预设这里自己就会多一项 —— 和包里那个
 * `readdirSync` 的语义一致，只是扫描发生在构建期而不是运行期。
 *
 * 路径是相对的（`../../../protocol/presets/`）而不是包名，因为 `import.meta.glob`
 * 不支持裸包名。能这么写是因为 `docs/` 本来就在包目录里面。
 *
 * ## 「砍掉帧尾」那个开关在演示一件反直觉的事
 *
 * 直觉上 `validateFrame()` 应该拦住截断的帧。**它不拦。**
 * 看它的实现（`displaySystemProtocol.js:292`）：`validation` 为空就直接
 * `return { ok: true }`，一个字节都不数。而 6 份内置预设**全都没写 validation**。
 *
 * 于是截断帧的真实结局是：校验通过 → `decodeProtocolValues()` 悄悄少解出一批值
 * （1024 点的帧砍到 614 字节，解出来就是 614 个值，不报错）。
 * 画面上表现为「传感器坏了一半」，日志里干干净净。
 *
 * 所以这个 demo 并排给两个开关：砍帧尾 + 补一段 sum8 校验声明。
 * 只有补上 validation 之后，`validateFrame()` 才会返回 false。
 * 这是本页最值得记住的一条，也是文档站按「真跑」而不是「照着 JSDoc 抄」
 * 写才发现的 —— 原本这里写的是「validateFrame 会挡掉短帧」，是错的。
 */

import {
  computeChecksum,
  decodeProtocolValues,
  normalizeProtocolConfig,
  validateFrame,
} from '@shroom/backend/protocol/displaySystemProtocol.js';
import React from 'react';

import Matrix from '../components/Matrix.jsx';

/** 构建期扫出来的全部内置预设。加一份 json，这里自己就多一项。 */
const PRESET_MODULES = import.meta.glob('../../../protocol/presets/*.json', { eager: true });

export const PRESETS = Object.entries(PRESET_MODULES)
  .map(([path, mod]) => ({ file: path.split('/').pop(), ...(mod.default || mod) }))
  .sort((a, b) => a.id.localeCompare(b.id));

/**
 * 按预设造一帧**假的但格式正确**的数据。
 *
 * 值是一圈一圈的同心波纹，纯粹为了让解码出来的图有形状 ——
 * 全 0 的话校验一样过，但看不出解码到底对不对。
 *
 * @param {object} config 归一化后的 protocol 配置。
 * @returns {Uint8Array} 帧体（不含分隔符）。
 */
function synthBody(config) {
  const { valueType, valueCount, byteOffset } = config.decoding;
  const width = { uint8: 1, int8: 1, uint16le: 2, uint16be: 2, int16le: 2, int16be: 2 }[valueType] || 1;
  const body = new Uint8Array(byteOffset + valueCount * width);
  const side = Math.round(Math.sqrt(valueCount)) || 1;

  for (let i = 0; i < valueCount; i += 1) {
    const row = Math.floor(i / side);
    const col = i % side;
    const distance = Math.hypot(row - side / 2, col - side / 2);
    const value = Math.round(120 + 110 * Math.sin(distance / 2.2));
    // 只写低位字节：uint8 就是全部，多字节类型就是个小值 —— 图仍然有形状。
    body[byteOffset + i * width + (valueType.endsWith('be') ? width - 1 : 0)] = value;
  }
  return body;
}

/** 把字节数组显示成十六进制。 */
function hex(bytes, limit = 48) {
  return [...bytes.slice(0, limit)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ') + (bytes.length > limit ? ` …（共 ${bytes.length} 字节）` : '');
}

export default function ProtocolDecoder() {
  const [presetId, setPresetId] = React.useState(PRESETS[0]?.id);
  const [corrupt, setCorrupt] = React.useState(false);
  const [guarded, setGuarded] = React.useState(false);

  const result = React.useMemo(() => {
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset) return { error: `没有预设 ${presetId}` };

    try {
      let source = preset.protocol;
      let body = synthBody(normalizeProtocolConfig(source));
      const intact = body.length;

      if (guarded) {
        // 给这份预设补一段 sum8 校验：帧尾多一个字节，范围是整个帧体。
        // 偏移写成**绝对值**，所以帧一短，偏移就落到帧外面 —— 这才是能拦住截断的原因。
        const withTail = new Uint8Array(intact + 1);
        withTail.set(body);
        withTail[intact] = computeChecksum('sum8', withTail, 0, intact);
        body = withTail;
        source = {
          ...source,
          validation: { checksum: { type: 'sum8', byteOffset: intact, range: [0, intact] } },
        };
      }

      const config = normalizeProtocolConfig(source);
      // 「砍掉尾巴」模拟最常见的一类现场故障：线松了、波特率错了、分隔符撞上数据了。
      if (corrupt) body = body.slice(0, Math.floor(body.length * 0.6));

      const verdict = validateFrame(body, config);
      // 故意在 ok 之后仍然解码 —— 这就是生产代码会做的事，
      // 也正是「没写 validation 时截断帧悄悄少解一批值」这件事看得见的地方。
      const values = verdict.ok ? decodeProtocolValues(body, config) : null;
      const expected = config.decoding.valueCount;
      return { preset, config, body, verdict, values, expected, guarded };
    } catch (error) {
      return { error: error.message };
    }
  }, [presetId, corrupt, guarded]);

  if (result.error) {
    return <p className="docs-status docs-status-error">{result.error}</p>;
  }

  const { preset, config, body, verdict, values, expected } = result;
  const shortDecode = values != null && expected != null && values.length !== expected;

  return (
    <div>
      <div className="docs-card-controls" style={{ border: 0, padding: '0 0 12px' }}>
        <label className="docs-field">
          <span>预设</span>
          <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
            {PRESETS.map((item) => (
              <option key={item.id} value={item.id}>{item.id} —— {item.label}</option>
            ))}
          </select>
        </label>
        <label className="docs-field">
          <input type="checkbox" checked={corrupt} onChange={(event) => setCorrupt(event.target.checked)} />
          <span>砍掉 40% 帧尾（模拟丢包）</span>
        </label>
        <label className="docs-field">
          <input type="checkbox" checked={guarded} onChange={(event) => setGuarded(event.target.checked)} />
          <span>给它补一段 sum8 校验声明</span>
        </label>
      </div>

      <div className="docs-matrix-pair">
        <div className="docs-matrix-panel">
          <dl className="docs-kv">
            <dt>波特率</dt><dd>{config.baudRate}</dd>
            <dt>分帧</dt>
            <dd>
              {config.framing.type === 'delimiter'
                ? <>分隔符 <code>{config.framing.delimiter.map((b) => b.toString(16).padStart(2, '0')).join(' ')}</code></>
                : <>定长 {config.framing.frameLength} 字节</>}
            </dd>
            <dt>值类型</dt><dd><code>{config.decoding.valueType}</code></dd>
            <dt>偏移 / 个数</dt><dd>{config.decoding.byteOffset} / {config.decoding.valueCount}</dd>
            <dt>校验</dt><dd>{config.validation ? config.validation.type : '（无）'}</dd>
          </dl>

          <p className="docs-matrix-cap" style={{ marginTop: 10 }}>喂进去的帧体</p>
          <div className="docs-mono-out">{hex(body)}</div>

          <p style={{ marginTop: 12 }}>
            <span className={verdict.ok ? 'docs-verdict docs-verdict-true' : 'docs-verdict docs-verdict-false'}>
              validateFrame() → {String(verdict.ok)}
            </span>
            {verdict.reason && <span className="docs-matrix-cap"> · {verdict.reason}</span>}
          </p>
          {verdict.ok && !config.validation && (
            <p className="docs-matrix-cap">
              这份预设没写 <code>validation</code>，所以 <code>validateFrame()</code>
              {' '}一个字节都没数就返回了 true。
            </p>
          )}
        </div>

        <div className="docs-matrix-panel">
          {values ? (
            <>
              <p>
                <span className={shortDecode ? 'docs-badge docs-badge-warn' : 'docs-badge docs-badge-ok'}>
                  解出 {values.length} 个值 / 声明要 {expected} 个
                </span>
              </p>
              <Matrix data={values} cols={preset.matrix?.width} caption={`decodeProtocolValues() · ${preset.id}`} />
              {shortDecode && (
                <p className="docs-status">
                  校验说没问题，解码却<strong>少给了 {expected - values.length} 个值</strong>，
                  而且没抛错、没警告。画面上就是「传感器坏了半边」，日志里干干净净 ——
                  这是这一层最难查的一类故障。
                  勾上「补一段 sum8 校验声明」再看一次。
                </p>
              )}
            </>
          ) : (
            <p className="docs-status">
              帧被 <code>validateFrame()</code> 拦下来了（<code>{verdict.reason}</code>），
              <code>decodeProtocolValues()</code> 没被调用。
              <strong>只有声明了 validation 才会走到这条路径</strong> ——
              校验偏移写的是绝对值，帧一短就落到帧外面，于是被拦住。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
