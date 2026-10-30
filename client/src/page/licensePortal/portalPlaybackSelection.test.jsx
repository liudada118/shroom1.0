import React from 'react';
import { describe, expect, it } from 'vitest';
import {
  filterPlaybackRecords,
  normalizePlaybackRecords,
  playbackLabelText,
  resolvePlaybackSelection,
  selectFilteredDownloads,
  togglePlaybackDownload,
} from './portalPlaybackSelection';

const records = [
  { label: '手部 早间采集', value: 'record-a' },
  { label: '手部 午间采集', value: 'record-b' },
  { label: '床垫 夜间采集', value: 'record-c' },
  { label: '不可用记录', value: 'record-disabled', disabled: true },
];

describe('门户回放与批量下载的独立选择', () => {
  it('保留真实 ID，去除重复和空记录而不接受对象型 ID', () => {
    const actual = normalizePlaybackRecords([
      ...records, records[0], null, {}, { value: '' }, { value: ' ' }, { value: {} },
      { value: NaN }, { value: Infinity }, { value: 0 }, { value: '0' },
    ]);
    expect(actual.map((item) => item.value)).toEqual(['record-a', 'record-b', 'record-c', 'record-disabled', 0, '0']);
    expect(actual.at(-1).key).not.toBe(actual.at(-2).key);
  });

  it('React label 只读取子文本，未知标题回退到记录 ID', () => {
    expect(playbackLabelText(<span>采集 <strong>32×32</strong>{[' ', 123]}</span>)).toBe('采集 32×32 123');
    expect(normalizePlaybackRecords([{ value: 'fallback', label: {} }])[0].label).toBe('fallback');
  });

  it('整数、小数毫秒及秒时间戳显示本地日期，保留操作 ID 和自定义记录名称', () => {
    const milliseconds = new Date(2026, 9, 27, 17, 42, 7, 651).getTime();
    const decimalId = `${milliseconds}.0`;
    const actual = normalizePlaybackRecords([
      { value: decimalId, label: decimalId },
      { value: milliseconds },
      { value: String(milliseconds / 1000) },
      { value: 'named', label: '午间采集' },
      { value: `${milliseconds + 1}.0`, label: '自定义采集名称' },
      { value: '20261027' },
      { value: '99999999999999999999' },
    ]);
    expect(actual.slice(0, 3).map((record) => record.label)).toEqual(Array(3).fill('2026-10-27 17:42:07'));
    expect(actual[0]).toMatchObject({ value: decimalId, detail: '' });
    expect(actual[1]).toMatchObject({ value: milliseconds, detail: '' });
    expect(actual[0].key).not.toBe(actual[1].key);
    expect(actual[3]).toMatchObject({ label: '午间采集', detail: 'named' });
    expect(actual[4]).toMatchObject({ label: '自定义采集名称', detail: '' });
    expect(actual.slice(5).map((record) => record.label)).toEqual(['20261027', '99999999999999999999']);
    expect(normalizePlaybackRecords(actual)).toEqual(actual);
    expect(filterPlaybackRecords(actual, '2026-10-27').map((record) => record.value))
      .toEqual([decimalId, milliseconds, String(milliseconds / 1000)]);
    expect(filterPlaybackRecords(actual, decimalId).map((record) => record.value)).toEqual([decimalId]);
  });

  it('回放单选不会跟随下载多选变化', () => {
    const selected = togglePlaybackDownload(records, ['record-b'], 'record-c', true);
    expect(resolvePlaybackSelection(records, 'record-a', selected)).toEqual({
      playbackValue: 'record-a', downloadValues: ['record-b', 'record-c'],
    });
    expect(togglePlaybackDownload(records, selected, 'record-b', false)).toEqual(['record-c']);
    expect(resolvePlaybackSelection(records, 'record-a', []).playbackValue).toBe('record-a');
  });

  it('筛选匹配名称或 ID，搜索前后不改变原始数组', () => {
    const original = JSON.stringify(records);
    expect(filterPlaybackRecords(records, ' 午间 ').map((item) => item.value)).toEqual(['record-b']);
    expect(filterPlaybackRecords(records, 'RECORD-A').map((item) => item.value)).toEqual(['record-a']);
    expect(filterPlaybackRecords(records, 'missing')).toEqual([]);
    expect(JSON.stringify(records)).toBe(original);
  });

  it('全选筛选结果保留隐藏勾选且不会重复勾选，不含不可用记录', () => {
    expect(selectFilteredDownloads(records, ['record-c', 'record-a'], '手部')).toEqual(['record-c', 'record-a', 'record-b']);
    expect(selectFilteredDownloads(records, [], '')).toEqual(['record-a', 'record-b', 'record-c']);
    expect(selectFilteredDownloads(records, ['record-c'], '不存在')).toEqual(['record-c']);
  });

  it('刷新或系统切换后拒绝已移除记录，空列表不能发起动作', () => {
    expect(resolvePlaybackSelection([records[1]], 'record-a', ['record-a', 'record-b', 'record-b'])).toEqual({
      playbackValue: null, downloadValues: ['record-b'],
    });
    expect(resolvePlaybackSelection([], 'record-a', ['record-b'])).toEqual({ playbackValue: null, downloadValues: [] });
    expect(resolvePlaybackSelection(records, 'record-disabled', ['record-disabled'])).toEqual({ playbackValue: null, downloadValues: [] });
    expect(togglePlaybackDownload(records, [], 'unknown', true)).toEqual([]);
  });

  it('全选不局限于当前页面的 30 条，数值 0 仍是有效 ID', () => {
    const manyRecords = Array.from({ length: 90 }, (_, value) => ({ value, label: `记录 ${value}` }));
    expect(selectFilteredDownloads(manyRecords, [], '记录')).toHaveLength(90);
    expect(resolvePlaybackSelection(manyRecords, 0, [0]).playbackValue).toBe(0);
  });
});
