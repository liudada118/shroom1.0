/**
 * CommandBuilder.jsx - 拼一条命令信封，看它过不过校验
 *
 * 跑的是 `@shroom/backend/contract` 里的真 `createCommand` / `validateCommandEnvelope`
 * / `toLegacyCommand` / `createCommandAck`，命令清单是真 `commandSchema.json`。
 *
 * ## 两个容易记错的签名
 *
 * - `createCommand(type, payload, requestId?)` 是**位置参数**，不是选项对象。
 *   写成 `createCommand({ type, payload })` 不会报错，只会造出一条
 *   `type` 为 undefined 的信封，然后在校验那步才炸 —— 所以这里照真签名调。
 * - `validateCommandEnvelope(envelope)` **成功返回信封、失败抛 `CommandProtocolError`**，
 *   不是返回 `{ok, reason}`。所以下面是 try/catch，不是 if。
 *   错误对象上带 `code` / `httpStatus` / `requestId` / `commandType`，
 *   HTTP 层直接拿来回响应就行。
 */

import {
  commandSchema,
  createCommand,
  createCommandAck,
  toLegacyCommand,
  validateCommandEnvelope,
} from '@shroom/backend/contract';
import React from 'react';

const COMMANDS = Object.entries(commandSchema.commands)
  .map(([type, spec]) => ({ type, required: spec.required || [] }))
  .sort((a, b) => a.type.localeCompare(b.type));

/** 每个必填字段给一个像样的示例值，好让默认状态就是「能过」的。 */
const SAMPLE = {
  role: 'sit',
  path: 'COM3',
  sensorType: 'hand0205',
  local: true,
  date: '2026-08-07',
  active: true,
  enabled: true,
  key: 'XXXX-XXXX-XXXX',
};

/** 按 schema 的 required 造一份骨架 payload。 */
function skeleton(required) {
  const payload = {};
  required.forEach((field) => {
    payload[field] = SAMPLE[field] ?? `<${field}>`;
  });
  return payload;
}

export default function CommandBuilder() {
  const [type, setType] = React.useState('serial.open');
  const spec = COMMANDS.find((item) => item.type === type) || COMMANDS[0];
  const [text, setText] = React.useState(() => JSON.stringify(skeleton(spec.required), null, 2));

  const pick = (nextType) => {
    setType(nextType);
    const next = COMMANDS.find((item) => item.type === nextType);
    setText(JSON.stringify(skeleton(next?.required || []), null, 2));
  };

  const result = React.useMemo(() => {
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      return { stage: 'json', message: error.message };
    }

    // requestId 固定住：不固定的话每次输入都换一个 UUID，看不出别的字段有没有变。
    const envelope = createCommand(type, payload, 'req-docs-demo');

    try {
      validateCommandEnvelope(envelope);
    } catch (error) {
      return {
        stage: 'validate',
        envelope,
        error,
        ack: createCommandAck({
          requestId: error.requestId || envelope.requestId,
          commandType: error.commandType || envelope.type,
          ok: false,
          code: error.code,
          message: error.message,
        }),
      };
    }

    return {
      stage: 'ok',
      envelope,
      legacy: toLegacyCommand(envelope),
      ack: createCommandAck({
        requestId: envelope.requestId,
        commandType: envelope.type,
        ok: true,
      }),
    };
  }, [type, text]);

  return (
    <div>
      <div className="docs-card-controls" style={{ border: 0, padding: '0 0 12px' }}>
        <label className="docs-field">
          <span>命令（{COMMANDS.length} 条，来自 commandSchema.json）</span>
          <select value={type} onChange={(event) => pick(event.target.value)}>
            {COMMANDS.map((item) => (
              <option key={item.type} value={item.type}>
                {item.type}
                {item.required.length ? `（必填：${item.required.join('、')}）` : '（无必填）'}
              </option>
            ))}
          </select>
        </label>
        <span className="docs-badge">
          试试删掉一个必填字段
        </span>
      </div>

      <div className="docs-matrix-pair">
        <div className="docs-matrix-panel">
          <p className="docs-matrix-cap">payload（直接改，下面实时跟着变）</p>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            rows={9}
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
          {result.stage === 'json' && (
            <>
              <p>
                <span className="docs-verdict docs-verdict-false">JSON 都没解析出来</span>
              </p>
              <div className="docs-mono-out">{result.message}</div>
              <p className="docs-matrix-cap" style={{ marginTop: 8 }}>
                这一步还没进包，是本页自己的 <code>JSON.parse</code> 挂了。
              </p>
            </>
          )}

          {result.stage === 'validate' && (
            <>
              <p>
                <span className="docs-verdict docs-verdict-false">
                  validateCommandEnvelope() 抛了 CommandProtocolError
                </span>
              </p>
              <dl className="docs-kv">
                <dt>code</dt><dd><code>{result.error.code}</code></dd>
                <dt>httpStatus</dt><dd>{result.error.httpStatus}</dd>
                <dt>commandType</dt><dd><code>{String(result.error.commandType)}</code></dd>
              </dl>
              <div className="docs-mono-out">{result.error.message}</div>
              <p className="docs-matrix-cap" style={{ marginTop: 10 }}>
                createCommandAck() 拿它拼出来的拒绝回执
              </p>
              <div className="docs-mono-out">{JSON.stringify(result.ack, null, 2)}</div>
            </>
          )}

          {result.stage === 'ok' && (
            <>
              <p>
                <span className="docs-verdict docs-verdict-true">校验通过</span>
              </p>
              <p className="docs-matrix-cap">createCommand() 造出来的信封</p>
              <div className="docs-mono-out">{JSON.stringify(result.envelope, null, 2)}</div>
              <p className="docs-matrix-cap" style={{ marginTop: 10 }}>
                toLegacyCommand() —— 老 WebSocket 路径吃的形状
              </p>
              <div className="docs-mono-out">{JSON.stringify(result.legacy, null, 2)}</div>
              <p className="docs-matrix-cap" style={{ marginTop: 10 }}>createCommandAck() 的成功回执</p>
              <div className="docs-mono-out">{JSON.stringify(result.ack, null, 2)}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
