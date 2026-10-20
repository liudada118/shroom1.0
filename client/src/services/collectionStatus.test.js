import { describe, expect, it } from 'vitest';
import { describeCollectionSummary, readCollectionSummary } from './collectionStatus';

describe('采集收尾回执', () => {
  it('停止接收和数据库已保存是两种状态，只有明确结果能显示完成', () => {
    const finalizing = readCollectionSummary({ phase: 'finalizing', result: 'pending', channels: { a: { queued: 10, committed: 8, pending: 2, failed: 0 } } });
    expect(describeCollectionSummary(finalizing)).toContain('正在保存尾部数据');
    expect(describeCollectionSummary(finalizing)).toContain('已提交 8 帧，待提交 2 帧');
    expect(describeCollectionSummary(finalizing)).not.toContain('保存完成');
    expect(describeCollectionSummary({ ...finalizing, phase: 'completed', result: 'saved' })).toContain('采集保存完成');
  });

  it('部分保存、异常中断与未知计数不能冒充完整保存或补出零值', () => {
    const partial = readCollectionSummary({ phase: 'save_error', result: 'partial', channels: { a: { committed: 3, failed: 1 }, b: {} } });
    expect(describeCollectionSummary(partial)).toContain('仅部分保存');
    expect(describeCollectionSummary(partial)).not.toContain('已提交');
    expect(describeCollectionSummary(readCollectionSummary({ phase: 'interrupted', result: 'unknown', channels: {} }))).toContain('保存结果需核对');
    expect(readCollectionSummary([1, 2, 3])).toBeNull();
    expect(readCollectionSummary({ phase: 'completed', result: 'saved', channels: { a: { committed: -1 } } })).toBeNull();
  });
});
