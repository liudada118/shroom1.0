/**
 * SensorBrowser.jsx - 传感器注册表浏览器
 *
 * 表格里的每一行都是 `@shroom/backend/sensors` 的 `SENSOR_DEFINITIONS` 里的真定义，
 * 筛选用的也是包里那几个真判定函数（`hasCapability` / `getSensorMatrix` /
 * `getSensorChannels` / `getSensorBaudRate`），不是在这里重新实现一遍。
 *
 * 这一条很要紧：注册表的价值不在「有一张表」，而在**判定逻辑只有一处**。
 * 文档站要是自己写一遍 `def.capabilities.includes(cap)`，那它展示的就是文档站的判定，
 * 不是包的判定 —— 包里哪天改成继承 / 别名，这页照样显示得好好的，然后就骗人了。
 */

import {
  SENSOR_CAPABILITIES,
  SENSOR_DEFINITIONS,
  getSensorBaudRate,
  getSensorChannels,
  getSensorDefinition,
  getSensorMatrix,
  hasCapability,
} from '@shroom/backend/sensors';
import React from 'react';

const TYPES = Object.keys(SENSOR_DEFINITIONS).sort();
const CAPABILITIES = Object.entries(SENSOR_CAPABILITIES);

export default function SensorBrowser() {
  const [capability, setCapability] = React.useState('');
  const [keyword, setKeyword] = React.useState('');
  const [selected, setSelected] = React.useState(TYPES[0]);

  const rows = React.useMemo(() => TYPES.filter((type) => {
    if (capability && !hasCapability(type, capability)) return false;
    if (keyword && !type.toLowerCase().includes(keyword.toLowerCase())) return false;
    return true;
  }), [capability, keyword]);

  const detail = getSensorDefinition(selected);
  const matrix = getSensorMatrix(selected);
  const channels = getSensorChannels(selected);

  return (
    <div>
      <div className="docs-card-controls" style={{ border: 0, padding: '0 0 12px' }}>
        <label className="docs-field">
          <span>按能力筛</span>
          <select value={capability} onChange={(event) => setCapability(event.target.value)}>
            <option value="">全部（{TYPES.length}）</option>
            {CAPABILITIES.map(([name, value]) => (
              <option key={value} value={value}>
                {value}（{TYPES.filter((type) => hasCapability(type, value)).length}）
              </option>
            ))}
          </select>
        </label>
        <label className="docs-field">
          <span>搜类型名</span>
          <input
            type="text"
            value={keyword}
            placeholder="hand / bed / car…"
            onChange={(event) => setKeyword(event.target.value)}
            style={{
              padding: '3px 6px',
              border: '1px solid var(--line)',
              borderRadius: 5,
              background: 'var(--bg-code)',
              color: 'var(--text)',
              font: 'inherit',
              fontSize: 12.5,
            }}
          />
        </label>
        <span className="docs-badge">{rows.length} / {TYPES.length} 条</span>
      </div>

      <div className="docs-matrix-pair">
        <div className="docs-matrix-panel" style={{ flex: '2 1 340px' }}>
          <div className="docs-scroll">
            <table className="docs-datatable">
              <thead>
                <tr><th>类型</th><th>矩阵</th><th>通道</th><th>波特率</th></tr>
              </thead>
              <tbody>
                {rows.map((type) => {
                  const def = SENSOR_DEFINITIONS[type];
                  return (
                    <tr
                      key={type}
                      className={type === selected ? 'is-active' : undefined}
                      onClick={() => setSelected(type)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><code>{type}</code></td>
                      <td>{def.matrix ? `${def.matrix.width}×${def.matrix.height}` : '—'}</td>
                      <td>{(def.channels || []).join(' / ')}</td>
                      <td>{def.baudRate ?? <span style={{ color: 'var(--text-dim)' }}>默认</span>}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={4}>没有匹配的类型</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="docs-matrix-panel">
          <p className="docs-matrix-cap"><strong>{selected}</strong> · 点左边任意一行切换</p>
          {detail ? (
            <>
              <dl className="docs-kv">
                <dt>矩阵</dt>
                <dd>{matrix ? `${matrix.width} × ${matrix.height} = ${matrix.total} 点` : '注册表里没写'}</dd>
                <dt>通道</dt>
                <dd>{channels.length ? channels.join('、') : '—'}</dd>
                <dt>波特率</dt>
                <dd>{getSensorBaudRate(selected) ?? '（走 session/profiles 的默认规则）'}</dd>
              </dl>

              <p className="docs-matrix-cap" style={{ marginTop: 12 }}>能力</p>
              <div>
                {CAPABILITIES.map(([, value]) => (
                  <span
                    key={value}
                    className={hasCapability(selected, value) ? 'docs-badge docs-badge-ok' : 'docs-badge'}
                    style={hasCapability(selected, value) ? undefined : { opacity: 0.35 }}
                  >
                    {value}
                  </span>
                ))}
              </div>

              {detail.plugin && (
                <>
                  <p className="docs-matrix-cap" style={{ marginTop: 12 }}>
                    协议插件（这个类型的分帧规则写在包里，不走通用 protocol 声明）
                  </p>
                  <div className="docs-mono-out">{JSON.stringify(detail.plugin, null, 2)}</div>
                </>
              )}
            </>
          ) : (
            <p className="docs-status">注册表里没有 {selected}</p>
          )}
        </div>
      </div>
    </div>
  );
}
