/** 去掉采集入口追加的日期及毫秒时间戳，只处理软件已知的命名格式。 */
export function collectionBaseName(date) {
  if (typeof date !== 'string') return '';
  const match = date.trim().match(/^(.+)_\d{4}-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\d|3[01])-(?:[01]?\d|2[0-3])-[0-5]?\d-[0-5]?\d-\d{1,3} \d{13}$/);
  return match?.[1].trim() || '';
}

/** 按用户选择的规则复用旧采集名；名称和特征未分列存储，不能据此推断动作含义。 */
export function collectionLabel(date, rule = 'last') {
  const base = collectionBaseName(date);
  if (!base) return '';
  const parts = base.split('_');
  let label = base;
  if (rule === 'last') {
    // ⚠️ 特征标签 2 的“名称_数字”是完整标签，只取末段会把“平躺_2”误当成“2”。
    label = parts.length > 1 && /^\d+$/.test(parts.at(-1)) ? parts.slice(-2).join('_') : parts.at(-1);
  } else if (rule === 'after-first') label = parts.length > 1 ? parts.slice(1).join('_') : base;
  else if (rule !== 'whole') return '';
  return label.trim();
}
