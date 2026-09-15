import { describe, expect, it, vi } from 'vitest';
import { capturePortalOperation, executePortalLegacyControl } from './portalOperationGuard';

/** 控制单条命令何时确认，验证等待期间离开界面的行为。 */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** 创建仅包含作用域与系统身份的组件替身。 */
function createOwner() {
  return { _portalScope: 1, _portalUnmounted: false, props: { matrixName: 'A' } };
}

describe('门户异步操作作用域', () => {
  it('系统、作用域和挂载状态全部匹配时才有效', () => {
    const owner = createOwner();
    const isCurrent = capturePortalOperation(owner);
    expect(isCurrent()).toBe(true);
    owner.props = { matrixName: 'B' };
    expect(isCurrent()).toBe(false);
    owner.props = { matrixName: 'A' };
    expect(isCurrent()).toBe(true);
    owner._portalUnmounted = true;
    expect(isCurrent()).toBe(false);
  });

  it('A → B → A 即使系统名恢复，旧作用域也不复活', () => {
    const owner = createOwner();
    const previous = capturePortalOperation(owner);
    owner._portalScope += 1;
    owner.props.matrixName = 'B';
    owner._portalScope += 1;
    owner.props.matrixName = 'A';
    expect(previous()).toBe(false);
    expect(capturePortalOperation(owner)()).toBe(true);
  });

  it('真实 getTime/index/displayOptions 映射保留三条命令和输入内容', async () => {
    const owner = createOwner();
    const client = { executeEnvelope: vi.fn().mockResolvedValue({ ok: true }) };
    const displayOptions = { matrixMode: '16x16', samplePoint: 'topLeft' };
    const current = await executePortalLegacyControl(client, {
      getTime: '2026-09-11 10:00:00', index: 0, smallBed12BDisplayOptions: displayOptions,
    }, capturePortalOperation(owner));
    expect(current).toBe(true);
    const commands = client.executeEnvelope.mock.calls.map(([command]) => command);
    expect(commands.map(({ type, payload }) => ({ type, payload }))).toEqual([
      { type: 'history.load', payload: { date: '2026-09-11 10:00:00', index: 0, displayOptions } },
      { type: 'playback.control', payload: { index: 0 } },
      { type: 'runtime.configure', payload: { displayOptions } },
    ]);
    expect(commands.every((command) => typeof command.requestId === 'string' && command.requestId)).toBe(true);
  });

  it.each(['scope', 'system', 'unmount'])('第一条 await 期间 %s 失效，不再发后续命令', async (reason) => {
    const owner = createOwner();
    const pending = deferred();
    const client = { executeEnvelope: vi.fn().mockReturnValue(pending.promise) };
    const result = executePortalLegacyControl(client, { getTime: 'history-a', index: 0 }, capturePortalOperation(owner));
    expect(client.executeEnvelope).toHaveBeenCalledTimes(1);
    if (reason === 'scope') owner._portalScope += 1;
    if (reason === 'system') owner.props.matrixName = 'B';
    if (reason === 'unmount') owner._portalUnmounted = true;
    pending.resolve({ ok: true });
    expect(await result).toBe(false);
    expect(client.executeEnvelope).toHaveBeenCalledTimes(1);
  });

  it('最后一条 ACK 后也重新检查，不能向已卸载的界面提交结果', async () => {
    const owner = createOwner();
    const pending = deferred();
    const client = { executeEnvelope: vi.fn().mockReturnValue(pending.promise) };
    const result = executePortalLegacyControl(client, { play: false }, capturePortalOperation(owner));
    owner._portalUnmounted = true;
    pending.resolve({ ok: true });
    expect(await result).toBe(false);
  });

  it('单条删除同样受保护：有效时准确发目标日期，已失效时不发送', async () => {
    const owner = createOwner();
    const client = { executeEnvelope: vi.fn().mockResolvedValue({ ok: true }) };
    const isCurrent = capturePortalOperation(owner);
    expect(await executePortalLegacyControl(client, { delete: 'only-selected-date' }, isCurrent)).toBe(true);
    expect(client.executeEnvelope).toHaveBeenCalledWith(expect.objectContaining({
      type: 'history.delete', payload: { date: 'only-selected-date' },
    }));
    owner._portalScope += 1;
    expect(await executePortalLegacyControl(client, { delete: 'do-not-delete' }, isCurrent)).toBe(false);
    expect(client.executeEnvelope).toHaveBeenCalledTimes(1);
  });

  it('命令拒绝保留原始错误且不继续后续命令', async () => {
    const owner = createOwner();
    const failure = new Error('history load rejected');
    const client = { executeEnvelope: vi.fn().mockRejectedValue(failure) };
    await expect(executePortalLegacyControl(client, { getTime: 'history-a', index: 0 },
      capturePortalOperation(owner))).rejects.toBe(failure);
    expect(client.executeEnvelope).toHaveBeenCalledTimes(1);
  });
});
