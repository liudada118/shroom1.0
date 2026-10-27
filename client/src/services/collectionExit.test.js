import { afterEach, describe, expect, it, vi } from 'vitest';
import { finishCollectionBeforeExit } from './collectionExit';

/** 构造一条有限宿主回执，不制造任何真实串口或采集写入。 */
function receipt(phase, result = 'pending', id = 'capture-a') {
  return { id, phase, result, reason: '', channels: { sit: { committed: 20, pending: phase === 'finalizing' ? 1 : 0 } } };
}

describe('退出监测前停采和保存收尾', () => {
  afterEach(() => vi.useRealTimers());

  it('先明确停止，再等待真实 current 保存完成，忽略旧的已完成摘要', async () => {
    vi.useFakeTimers();
    const order = [], onSummary = vi.fn();
    const stop = vi.fn(async () => { order.push('stop'); });
    const readStatus = vi.fn()
      .mockImplementationOnce(async () => { order.push('read'); return {
        current: receipt('finalizing'), collectionSummary: receipt('completed', 'saved', 'old-capture'),
      }; })
      .mockResolvedValueOnce({ current: receipt('completed', 'saved') });
    let finished = false;
    const pending = finishCollectionBeforeExit({ stop, readStatus, onSummary }).then(value => { finished = true; return value; });
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(['stop', 'read']);
    expect(finished).toBe(false);
    expect(onSummary.mock.lastCall[0]).toMatchObject({ id: 'capture-a', phase: 'finalizing' });
    await vi.advanceTimersByTimeAsync(150);
    expect(await pending).toMatchObject({ id: 'capture-a', phase: 'completed', result: 'saved' });
    expect(stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('中断或部分保存的终态仍幂等停采，保留真实结果并允许退出', async () => {
    for (const [phase, result] of [['interrupted', 'saved'], ['save_error', 'partial'], ['interrupted', 'unknown']]) {
      const stop = vi.fn().mockResolvedValue({ ok: true });
      const onSummary = vi.fn();
      const terminal = receipt(phase, result);
      expect(await finishCollectionBeforeExit({ stop, onSummary,
        readStatus: async () => ({ collectionSummary: terminal, current: terminal }),
      })).toEqual(terminal);
      expect(stop).toHaveBeenCalledOnce();
      expect(onSummary).toHaveBeenCalledWith(terminal);
    }
  });

  it('未采集也核对空宿主状态，不用UI遗留开关推断完成', async () => {
    const stop = vi.fn().mockResolvedValue({ ok: true });
    expect(await finishCollectionBeforeExit({ stop, readStatus: async () => ({ current: null, collectionSummary: null }) })).toBeNull();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('命令或状态请求失败时退出失败且可再次尝试', async () => {
    const readStatus = vi.fn().mockResolvedValue({ current: receipt('completed', 'saved') });
    const stop = vi.fn().mockRejectedValueOnce(new Error('服务不可用')).mockResolvedValueOnce({ ok: true });
    await expect(finishCollectionBeforeExit({ stop, readStatus })).rejects.toThrow('服务不可用');
    expect(readStatus).not.toHaveBeenCalled();
    await expect(finishCollectionBeforeExit({ stop, readStatus })).resolves.toMatchObject({ result: 'saved' });
    await expect(finishCollectionBeforeExit({ stop, readStatus: async () => ({}) })).rejects.toThrow('无法确认采集状态');
  });

  it('无法停止的宿主和悬挂请求有期限，取消后不应用迟到回执', async () => {
    vi.useFakeTimers();
    const readStatus = vi.fn().mockResolvedValue({ current: receipt('collecting') });
    const pending = finishCollectionBeforeExit({ stop: async () => {}, readStatus, timeoutMs: 500 });
    const failed = expect(pending).rejects.toThrow('请稍后重试退出');
    await vi.advanceTimersByTimeAsync(500);
    await failed;
    expect(vi.getTimerCount()).toBe(0);

    const controller = new AbortController(), onSummary = vi.fn();
    let settle;
    const hanging = finishCollectionBeforeExit({ signal: controller.signal, stop: async () => {}, onSummary,
      readStatus: () => new Promise(resolve => { settle = resolve; }) });
    const cancelled = expect(hanging).rejects.toThrow('已取消');
    await vi.advanceTimersByTimeAsync(0);
    controller.abort(new Error('已取消'));
    await cancelled;
    settle({ current: receipt('completed', 'saved') });
    await vi.advanceTimersByTimeAsync(0);
    expect(onSummary).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
