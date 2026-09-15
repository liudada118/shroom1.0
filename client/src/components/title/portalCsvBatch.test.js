import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPortalCsvBatch } from './portalCsvBatch';

/** 按测试需要控制 HTTP ACK 到达顺序。 */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** 建立一个默认两条记录的串行导出测试实例。 */
function createBatch(options = {}) {
  const exportOne = options.exportOne || vi.fn().mockResolvedValue({ accepted: true });
  const onStatus = vi.fn();
  const onState = vi.fn();
  const batch = createPortalCsvBatch({ dates: ['first', 'second'], exportOne, onStatus, onState, ...options });
  return { batch, exportOne, onStatus, onState };
}

describe('门户 CSV 串行批量导出', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('空集合不发命令，重复 start 不会重复导出', () => {
    const empty = createBatch({ dates: [] });
    expect(empty.batch.start()).toBe(false);
    expect(empty.exportOne).not.toHaveBeenCalled();
    expect(empty.onStatus).not.toHaveBeenCalled();
    const active = createBatch({ dates: ['first', 'first', '', null, {}] });
    expect(active.batch.start()).toBe(true);
    expect(active.batch.start()).toBe(false);
    expect(active.exportOne).toHaveBeenCalledTimes(1);
    active.batch.dispose();
  });

  it('只收到 HTTP 接受不能推进下一条，WS 终态后按任务轮次串行调度', async () => {
    const { batch, exportOne, onStatus } = createBatch();
    batch.start();
    await Promise.resolve();
    expect(exportOne).toHaveBeenCalledTimes(1);
    batch.handleStatus({ download: 'export csv success', downloadFiles: ['a.csv'] });
    expect(exportOne).toHaveBeenCalledTimes(1);
    expect(onStatus.mock.lastCall[0].csvDownloadProgress.percent).toBe(50);
    expect(onStatus.mock.lastCall[0].download).toBeUndefined();
    await vi.advanceTimersByTimeAsync(0);
    expect(exportOne.mock.calls).toEqual([['first'], ['second']]);
    batch.handleStatus({ download: 'export csv success', downloadFiles: ['b.csv'] });
    expect(onStatus.mock.lastCall[0].download).toBe('export csv success');
    expect(onStatus.mock.lastCall[0].downloadFiles).toEqual(['a.csv', 'b.csv']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('终态先于 ACK 到达时也等待 ACK，重复终态只能推进一次', async () => {
    const ack = deferred();
    const exportOne = vi.fn().mockReturnValueOnce(ack.promise).mockResolvedValue({});
    const { batch, onState } = createBatch({ exportOne });
    batch.start();
    const terminal = { download: 'export csv success' };
    batch.handleStatus(terminal);
    batch.handleStatus(terminal);
    await vi.advanceTimersByTimeAsync(0);
    expect(exportOne).toHaveBeenCalledTimes(1);
    expect(onState.mock.lastCall[0].completed).toBe(0);
    ack.resolve({});
    await Promise.resolve();
    batch.handleStatus(terminal);
    expect(onState.mock.lastCall[0].completed).toBe(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(exportOne).toHaveBeenCalledTimes(2);
    batch.dispose();
  });

  it('进度按整个批次折算且不回退，不匹配 date 的进度被忽略', async () => {
    const { batch, onStatus } = createBatch();
    batch.start();
    await Promise.resolve();
    expect(batch.handleStatus({ csvDownloadProgress: { date: 'other', percent: 95 } })).toBe(false);
    expect(onStatus).not.toHaveBeenCalled();
    batch.handleStatus({ csvDownloadProgress: { date: 'first', percent: 60 } });
    expect(onStatus.mock.lastCall[0].csvDownloadProgress.percent).toBe(30);
    batch.handleStatus({ csvDownloadProgress: { date: 'first', percent: 20 } });
    expect(onStatus.mock.lastCall[0].csvDownloadProgress.percent).toBe(30);
    batch.handleStatus({ download: 'export csv success' });
    await vi.advanceTimersByTimeAsync(0);
    batch.handleStatus({ csvDownloadProgress: { date: 'second', percent: 60 } });
    expect(onStatus.mock.lastCall[0].csvDownloadProgress.percent).toBe(80);
    batch.dispose();
  });

  it('明确失败保留失败日期并继续，最终汇总失败和已经写出的产物', async () => {
    const { batch, exportOne, onStatus, onState } = createBatch();
    batch.start();
    await Promise.resolve();
    batch.handleStatus({ download: 'export csv failed', downloadError: '某通道失败', downloadFiles: ['partial.csv'],
      downloadArtifacts: [{ channelId: 'a', filePath: 'partial.csv' }], downloadSkippedChannels: ['b'], downloadDir: 'D:/exports' });
    await vi.advanceTimersByTimeAsync(0);
    expect(exportOne).toHaveBeenCalledTimes(2);
    batch.handleStatus({ download: 'export csv success', downloadFiles: ['next.csv'] });
    expect(onState.mock.lastCall[0]).toMatchObject({ phase: 'completed', completed: 2, total: 2,
      failures: [{ date: 'first', error: '某通道失败', uncertain: false }] });
    expect(onStatus.mock.lastCall[0]).toMatchObject({ download: 'export csv failed', downloadFiles: ['partial.csv', 'next.csv'],
      downloadDir: 'D:/exports', downloadSkippedChannels: ['b'] });
    expect(onStatus.mock.lastCall[0].downloadError).toContain('first：某通道失败');
    expect(onStatus.mock.lastCall[0].csvDownloadProgress).toBeUndefined();
  });

  it('HTTP 拒绝属于不确定结果，停止剩余且不会自动重试', async () => {
    const exportOne = vi.fn().mockRejectedValue(new Error('连接断开'));
    const { batch, onState, onStatus } = createBatch({ exportOne });
    batch.start();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(150000);
    expect(exportOne).toHaveBeenCalledTimes(1);
    expect(onState.mock.lastCall[0]).toMatchObject({ phase: 'stopped', completed: 0,
      failures: [{ date: 'first', error: '连接断开', uncertain: true }] });
    expect(onStatus.mock.lastCall[0].downloadError).toContain('服务端可能仍在写入');
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['ack-only', 'terminal-only'])('等待 %s 超时停止，不把另一半当作已成功', async (mode) => {
    const ack = deferred();
    const exportOne = vi.fn().mockReturnValue(ack.promise);
    const { batch, onState } = createBatch({ exportOne, timeoutMs: 1000 });
    batch.start();
    if (mode === 'ack-only') ack.resolve({});
    else batch.handleStatus({ download: 'export csv success' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(onState.mock.lastCall[0].phase).toBe('stopped');
    expect(onState.mock.lastCall[0].completed).toBe(0);
    ack.resolve({});
    await vi.advanceTimersByTimeAsync(1000);
    expect(exportOne).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('大文件持续报告匹配进度可跨过 120 秒，之后静默 120 秒才停止', async () => {
    const { batch, exportOne, onState } = createBatch();
    batch.start();
    await Promise.resolve();
    for (const percent of [10, 30, 60, 90]) {
      await vi.advanceTimersByTimeAsync(90000);
      expect(onState.mock.lastCall[0].phase).toBe('running');
      batch.handleStatus({ csvDownloadProgress: { date: 'first', percent } });
      expect(vi.getTimerCount()).toBe(1);
    }
    await vi.advanceTimersByTimeAsync(119999);
    expect(onState.mock.lastCall[0].phase).toBe('running');
    await vi.advanceTimersByTimeAsync(1);
    expect(onState.mock.lastCall[0].phase).toBe('stopped');
    expect(exportOne).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    batch.handleStatus({ csvDownloadProgress: { date: 'first', percent: 99 } });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('迟到但未超时的 ACK 续期，其他日期或无身份进度不能延长当前请求', async () => {
    const ack = deferred();
    const { batch, onState } = createBatch({ exportOne: vi.fn().mockReturnValue(ack.promise) });
    batch.start();
    await vi.advanceTimersByTimeAsync(90000);
    ack.resolve({});
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(90000);
    expect(onState.mock.lastCall[0].phase).toBe('running');
    expect(batch.handleStatus({ csvDownloadProgress: { date: 'other', percent: 50 } })).toBe(false);
    batch.handleStatus({ csvDownloadProgress: { percent: 50 } });
    await vi.advanceTimersByTimeAsync(30000);
    expect(onState.mock.lastCall[0].phase).toBe('stopped');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('dispose 清理等待和待调度任务，迟到响应不再触发回调', async () => {
    const ack = deferred();
    const { batch, exportOne, onState, onStatus } = createBatch({ exportOne: vi.fn().mockReturnValue(ack.promise) });
    batch.start();
    const callCount = onState.mock.calls.length;
    batch.dispose();
    ack.resolve({});
    batch.handleStatus({ download: 'export csv success' });
    await vi.advanceTimersByTimeAsync(150000);
    expect(onState).toHaveBeenCalledTimes(callCount);
    expect(onStatus).not.toHaveBeenCalled();
    expect(exportOne).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    const pendingNext = createBatch();
    pendingNext.batch.start();
    await Promise.resolve();
    pendingNext.batch.handleStatus({ download: 'export csv success' });
    pendingNext.batch.dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(pendingNext.exportOne).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('exportOne 同步抛错也停止，终态完成之后的重复事件不再上报', async () => {
    const synchronous = createBatch({ exportOne: vi.fn(() => { throw new Error('无执行器'); }) });
    synchronous.batch.start();
    expect(synchronous.onState.mock.lastCall[0].phase).toBe('stopped');
    const finished = createBatch({ dates: ['first'] });
    finished.batch.start();
    await Promise.resolve();
    finished.batch.handleStatus({ download: 'export csv success' });
    const count = finished.onStatus.mock.calls.length;
    expect(finished.batch.handleStatus({ download: 'export csv success' })).toBe(false);
    expect(finished.onStatus).toHaveBeenCalledTimes(count);
    expect(vi.getTimerCount()).toBe(0);
  });
});
