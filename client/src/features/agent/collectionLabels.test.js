import { describe, expect, it } from 'vitest';
import { collectionBaseName, collectionLabel } from './collectionLabels';

/** 构造与采集入口相同的名称，日期和毫秒均保留非补零形式。 */
function saved(name) { return `${name}_2026-9-21-19-23-54-42 1789989834042`; }

describe('采集标签复用', () => {
  it('去掉采集名称和时间后，直接复用截图中的抚摸/拍打标签', () => {
    expect(collectionLabel(saved('达_抚摸'))).toBe('抚摸');
    expect(collectionLabel('达_拍打_2026-9-21-19-24-03-899 1789989843899')).toBe('拍打');
    expect(collectionLabel(saved('抚摸'))).toBe('抚摸');
    expect(collectionBaseName(saved('达_抚摸'))).toBe('达_抚摸');
  });

  it('保留 CSV 标签的名称和编号，避免不同动作都被归到同一个数字类别', () => {
    expect(collectionLabel(saved('床垫_平躺_2'))).toBe('平躺_2');
    expect(collectionLabel(saved('床垫_侧躺_2'))).toBe('侧躺_2');
  });

  it('含下划线的多段标签可统一换提取规则，不逐条重写', () => {
    expect(collectionLabel(saved('达_轻_抚摸'), 'after-first')).toBe('轻_抚摸');
    expect(collectionLabel(saved('达_轻_抚摸'), 'whole')).toBe('达_轻_抚摸');
    expect(collectionLabel(saved('抚摸'), 'after-first')).toBe('抚摸');
    expect(collectionLabel(saved('达_抚摸'), 'unknown')).toBe('');
  });

  it('时间戳、无约定格式、空值不被猜成类别', () => {
    for (const value of [null, 1789989834042, '1789989834042', '', 'a-stroke', '达_拍打', '2026-9-21-19-23-54-42 1789989834042', '达_拍打_2026-13-21-19-23-54-42 1789989834042']) {
      expect(collectionLabel(value)).toBe('');
    }
  });

  it('不静默截断长标签，也不把标签中的日期片段当成采集时间', () => {
    const label = '长'.repeat(41);
    expect(collectionLabel(saved(`达_${label}`))).toBe(label);
    expect(collectionLabel(saved('实验_2026-09-21'), 'whole')).toBe('实验_2026-09-21');
  });
});
