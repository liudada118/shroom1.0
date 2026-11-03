import { afterEach, describe, expect, it, vi } from 'vitest';
import { commandClient } from './command/commandClient';
import { stopPlaybackBeforeExit } from './playbackExit';

describe('退出监测前暂停回放', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('等待真实暂停 ACK，只清历史播放，不请求实时权限或打开串口', async () => {
    let acknowledge;
    const request = vi.spyOn(commandClient, 'execute').mockImplementation(() => new Promise(resolve => { acknowledge = resolve; }));
    let finished = false;
    const pending = stopPlaybackBeforeExit().then(() => { finished = true; });
    expect(request).toHaveBeenCalledWith('playback.control', { play: false, history: false });
    await Promise.resolve();
    expect(finished).toBe(false);
    acknowledge({ ok: true });
    await pending;
    expect(finished).toBe(true);
    expect(request).toHaveBeenCalledOnce();
  });

  it('命令拒绝保留原始错误，允许再次尝试', async () => {
    const stop = vi.fn().mockRejectedValueOnce(new Error('服务未响应')).mockResolvedValueOnce({ ok: true });
    await expect(stopPlaybackBeforeExit({ stop })).rejects.toThrow('服务未响应');
    await expect(stopPlaybackBeforeExit({ stop })).resolves.toBeUndefined();
  });

  it('请求挂起有期限，超时和取消均清理计时器', async () => {
    vi.useFakeTimers();
    let acknowledge;
    const stop = vi.fn(() => new Promise(resolve => { acknowledge = resolve; }));
    const pending = stopPlaybackBeforeExit({ stop, timeoutMs: 500 });
    const failed = expect(pending).rejects.toThrow('暂停回放未确认');
    await vi.advanceTimersByTimeAsync(500);
    await failed;
    acknowledge({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
    const controller = new AbortController();
    const cancelled = stopPlaybackBeforeExit({ stop, signal: controller.signal });
    const rejected = expect(cancelled).rejects.toThrow('已取消');
    controller.abort(new Error('已取消'));
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
    await expect(stopPlaybackBeforeExit({ stop, signal: controller.signal })).rejects.toThrow('已取消');
    expect(stop).toHaveBeenCalledTimes(2);
  });
});
