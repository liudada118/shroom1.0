import React, { useEffect, useId, useState } from 'react';
import { commitMobileViewParameter, createMobileViewDrafts, getMobileViewFields,
  normalizeMobileViewParameters } from './mobileViewParameters.js';
import './MobileViewControls.css';

const MODE_LABELS = { points: '三维点图', heatmap: '热力图', numbers: '原始数字' };

/** 调整当前画布参数；回调只返回参数，不切换画布或操作USB。 */
export default function MobileViewControls({ mode, values, onChange, onReset }) {
  const prefix = useId();
  const fields = getMobileViewFields(mode);
  const current = normalizeMobileViewParameters(mode, values);
  const appliedKey = JSON.stringify(current);
  const [drafts, setDrafts] = useState(() => createMobileViewDrafts(mode, values));

  useEffect(() => {
    setDrafts(createMobileViewDrafts(mode, JSON.parse(appliedKey)));
  }, [mode, appliedKey]);

  /** 完成文本输入或移动滑块时应用参数，输入中的小数不提前截断。 */
  function changeParameter(key, raw) {
    const next = commitMobileViewParameter(mode, current, key, raw);
    setDrafts(createMobileViewDrafts(mode, next));
    onChange(next);
  }

  /** 即使默认值与已应用值相同，也清除未提交的输入草稿。 */
  function resetParameters() {
    setDrafts(createMobileViewDrafts(mode));
    onReset();
  }

  /** 回车移开焦点并由失焦事件提交完整数值。 */
  function finishEditing(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.currentTarget.blur();
  }

  if (!fields.length) return null;
  return <section className="mobile-view-controls" aria-label={`${MODE_LABELS[mode]}参数`}>
    <header><strong>{MODE_LABELS[mode]}参数</strong><button type="button" onClick={resetParameters}>恢复默认参数</button></header>
    <p>{mode === 'numbers' ? '仅调整颜色映射，数字保留原始读数。' : '参数立即应用到当前画面，不改变已接收的原始读数。'}</p>
    {fields.map((field) => {
      const id = `${prefix}-${field.key}`;
      return <div className="mobile-view-parameter" key={field.key}>
        <label htmlFor={id}>{field.label}</label>
        <input className="mobile-view-parameter-number" type="text" aria-label={`${field.label}数值`}
          value={drafts[field.key] ?? String(current[field.key])} inputMode={field.step < 1 ? 'decimal' : 'numeric'}
          onChange={(event) => setDrafts((previous) => ({ ...previous, [field.key]: event.target.value }))}
          onBlur={(event) => changeParameter(field.key, event.target.value)} onKeyDown={finishEditing} />
        <input id={id} type="range" min={field.min} max={field.max} step={field.step}
          value={current[field.key]} aria-describedby={`${id}-help`} onChange={(event) => changeParameter(field.key, event.target.value)} />
        <small id={`${id}-help`}>{field.help}</small>
      </div>;
    })}
  </section>;
}
