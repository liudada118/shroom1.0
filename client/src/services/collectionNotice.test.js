import { describe, expect, it } from 'vitest';
import { COLLECTION_NOTICE_DURATION_MS, createCollectionNoticeTracker, getCollectionNoticeKey } from './collectionNotice';

/** 构造含真实保存计数的终态回执。 */
function saved(overrides = {}) {
  return { id: 'capture-a', phase: 'interrupted', result: 'saved', reason: 'SERIAL_DISCONNECTED',
    channels: { sit: { committed: 30732, pending: 0, failed: 0 } }, ...overrides };
}

/** 提供独立的标签页缓存，模拟组件重挂与整个页面刷新。 */
function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
}

describe('采集回执提示寿命', () => {
  it('旧保存结果不再显示，新结果只显示六秒且重复广播不会续期', () => {
    let time = 1793085727651;
    const tracker = createCollectionNoticeTracker({ storage: null, now: () => time });
    expect(tracker.remaining(saved({ id: 'old', completedAt: time - 86400000 }))).toBe(0);
    const current = saved({ id: 'new', completedAt: time });
    expect(tracker.remaining(current)).toBe(COLLECTION_NOTICE_DURATION_MS);
    time += 5000;
    expect(tracker.remaining({ ...current })).toBe(1000);
    time += 1000;
    expect(tracker.remaining({ ...current })).toBe(0);
  });

  it('缺少时间的旧宿主从首次展示计时，刷新与重进不重置期限', () => {
    let time = 100000;
    const storage = memoryStorage();
    const tracker = createCollectionNoticeTracker({ storage, now: () => time });
    expect(tracker.remaining(saved())).toBe(6000);
    time += 4000;
    const reloaded = createCollectionNoticeTracker({ storage, now: () => time });
    expect(reloaded.remaining(saved())).toBe(2000);
    time += 2000;
    expect(reloaded.remaining(saved())).toBe(0);
  });

  it('关闭后重挂、刷新、字段重新排序都不重弹，新回执正常展示', () => {
    const storage = memoryStorage();
    const tracker = createCollectionNoticeTracker({ storage, now: () => 100000 });
    const receipt = saved({ channels: { a: { committed: 12, pending: 0 }, b: { committed: 5, pending: 0 } } });
    tracker.remaining(receipt);
    tracker.dismiss(getCollectionNoticeKey(receipt));
    const reordered = { ...receipt, channels: { b: { pending: 0, committed: 5 }, a: { pending: 0, committed: 12 } }, revision: 20 };
    expect(tracker.remaining(reordered)).toBe(0);
    const reloaded = createCollectionNoticeTracker({ storage, now: () => 100000 });
    expect(reloaded.remaining(reordered)).toBe(0);
    expect(reloaded.remaining(saved({ id: 'new-capture' }))).toBe(6000);
  });

  it('保存中、部分保存、失败、未知结果不自动隐藏，结果修订重新提示', () => {
    let time = 100000;
    const tracker = createCollectionNoticeTracker({ storage: null, now: () => time });
    for (const changes of [
      { phase: 'finalizing', result: 'pending' }, { phase: 'save_error', result: 'partial' },
      { result: 'unknown' }, { channels: { a: { pending: 2 } } }, { channels: { a: { failed: 1 } } },
    ]) expect(tracker.remaining(saved({ completedAt: 1000, ...changes }))).toBe(Infinity);
    const partial = saved({ result: 'partial' });
    tracker.dismiss(getCollectionNoticeKey(partial));
    expect(tracker.remaining(partial)).toBe(0);
    expect(tracker.remaining(saved())).toBe(6000);
    const timeout = saved({ id: 'late-sql', result: 'unknown', completedAt: time });
    tracker.dismiss(getCollectionNoticeKey(timeout));
    time += 20000;
    // 宿主 reconcileSettled 在 SQL 收尾确认后刷新 completedAt。
    expect(tracker.remaining({ ...timeout, result: 'saved', completedAt: time })).toBe(6000);
  });

  it('缓存读写失败仍去重，未来完成时间不能无限延长提示', () => {
    const storage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
    const tracker = createCollectionNoticeTracker({ storage, now: () => 100000 });
    const receipt = saved({ completedAt: 200000 });
    expect(tracker.remaining(receipt)).toBe(6000);
    tracker.dismiss(getCollectionNoticeKey(receipt));
    expect(tracker.remaining(receipt)).toBe(0);
    expect(tracker.remaining(null)).toBe(0);
    expect(tracker.remaining(saved({ phase: 'collecting' }))).toBe(0);
  });

  it('最多保留一百个回执，不随长期使用无限增长', () => {
    const storage = memoryStorage();
    const tracker = createCollectionNoticeTracker({ storage, now: () => 100000 });
    for (let index = 0; index < 110; index++) tracker.remaining(saved({ id: `capture-${index}` }));
    expect(JSON.parse(storage.getItem('shroom.collection-notices.v1'))).toHaveLength(100);
  });
});
