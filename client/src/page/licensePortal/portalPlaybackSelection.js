import { isValidElement } from 'react';

/** 提取记录标题的可读文本，不执行 label 内的 React 组件。 */
export function playbackLabelText(label) {
  if (typeof label === 'string' || typeof label === 'number') return String(label);
  if (Array.isArray(label)) return label.map(playbackLabelText).join('');
  if (isValidElement(label)) return playbackLabelText(label.props.children);
  return '';
}

/** 保留记录的原始 ID，剔除空 ID 和重复条目以免选错采集批次。 */
export function normalizePlaybackRecords(records) {
  const seen = new Set();
  return (Array.isArray(records) ? records : []).flatMap((record) => {
    const value = record?.value;
    if (typeof value !== 'string' && typeof value !== 'number') return [];
    if (typeof value === 'number' && !Number.isFinite(value)) return [];
    if (typeof value === 'string' && !value.trim()) return [];
    const key = `${typeof value}:${value}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const label = playbackLabelText(record.label).trim() || String(value);
    return [{ ...record, value, key, label, disabled: Boolean(record.disabled) }];
  });
}

/** 按名称或原始记录 ID 筛选，不改变未显示条目的下载勾选。 */
export function filterPlaybackRecords(records, query = '') {
  const search = String(query).trim().toLocaleLowerCase();
  return normalizePlaybackRecords(records).filter((record) => !search
    || `${record.label} ${record.value}`.toLocaleLowerCase().includes(search));
}

/** 分别校验回放单选和下载多选，已失效或不可用的记录不得提交。 */
export function resolvePlaybackSelection(records, playbackValue, downloadValues) {
  const available = new Set(normalizePlaybackRecords(records)
    .filter((record) => !record.disabled).map((record) => record.value));
  return {
    playbackValue: available.has(playbackValue) ? playbackValue : null,
    downloadValues: [...new Set(Array.isArray(downloadValues) ? downloadValues : [])]
      .filter((value) => available.has(value)),
  };
}

/** 单条下载勾选只更新下载集合，不借用回放选中值。 */
export function togglePlaybackDownload(records, downloadValues, value, checked) {
  const selected = resolvePlaybackSelection(records, null, downloadValues).downloadValues;
  const next = checked ? [...selected, value] : selected.filter((item) => item !== value);
  return resolvePlaybackSelection(records, null, next).downloadValues;
}

/** 全选当前搜索结果并保留其他勾选，范围包含筛选结果的全部分页。 */
export function selectFilteredDownloads(records, downloadValues, query = '') {
  const filteredValues = filterPlaybackRecords(records, query).map((record) => record.value);
  return resolvePlaybackSelection(records, null, [
    ...(Array.isArray(downloadValues) ? downloadValues : []), ...filteredValues,
  ]).downloadValues;
}
