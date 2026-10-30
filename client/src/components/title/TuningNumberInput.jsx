import React, { useEffect, useState } from 'react';
import { InputNumber } from 'antd';

/** 数值允许暂时清空编辑，在离焦或回车时提交；无效输入恢复已生效的值。 */
export default function TuningNumberInput({ value, min, max, label, onCommit }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  /** 只提交有效整数，不让清空输入时的 null 变成零。 */
  const commit = () => {
    const next = typeof draft === 'number' && Number.isFinite(draft)
      ? Math.max(min, Math.min(max, Math.round(draft))) : value;
    setDraft(next);
    if (next !== value) onCommit(next);
  };
  return <InputNumber aria-label={label} value={draft} min={min} max={max} precision={0}
    onChange={setDraft} onBlur={commit} onPressEnter={event => event.target.blur()}
    style={{ width: 128 }} />;
}
