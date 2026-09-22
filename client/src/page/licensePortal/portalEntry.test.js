import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPortalEntry } from './portalEntry';

const system = { value: 'hand0205', source: 'builtin' };
/** 模拟服务端的有效授权消息，不使用真实密钥或授权服务。 */
const valid = (selectFlag = 'all') => ({ date: Date.now() + 60000, nowDate: Date.now(), valid: true, selectFlag });
/** HTTP 命令客户端剥除外层 HttpResult 后返回的真实回执结构。 */
const activationAck = (payload = valid()) => ({ ok: true, data: { results: [{ name: 'license-activation', activationCode: 'OK', payload }] } });
/** 测试入口事务，所有外部动作都替换为可检查的桩。 */
function setup(overrides = {}) {
  const callbacks = { activate: vi.fn(async () => activationAck()), switchSystem: vi.fn(async () => ({ ok: true })), onPhase: vi.fn(), onError: vi.fn(), onEntered: vi.fn(), onValidated: vi.fn(), onInvalidated: vi.fn(), ...overrides };
  const entry = createPortalEntry(callbacks);
  return { entry, ...callbacks };
}
/** 放行授权与切换两个异步阶段。 */
async function flush() { for (let i = 0; i < 8; i += 1) await Promise.resolve(); }
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('首页选择系统事务', () => {
  it('旧后端只有激活成功标记时提示完整重启，不误报密钥无效或复用广播范围', async () => {
    const test = setup({ activate: vi.fn(async () => ({ ok: true, data: { results: [{ name: 'license-activation', activationCode: 'OK' }] } })) });
    test.entry.begin({ system, key: 'test-key', connected: true });
    test.entry.receive(valid()); await flush();
    expect(test.onError).toHaveBeenLastCalledWith('授权服务版本较旧，请完全退出并重新启动 Shroom 后重试');
    expect(test.onInvalidated).toHaveBeenCalled();
    expect(test.onValidated).not.toHaveBeenCalled();
    expect(test.switchSystem).not.toHaveBeenCalled();
  });
  it('后台授权刷新不会自动进入', async () => {
    const test = setup(); test.entry.receive(valid()); await flush();
    expect(test.activate).not.toHaveBeenCalled(); expect(test.switchSystem).not.toHaveBeenCalled();
  });
  it('锁定所选系统，只使用本次 HTTP 授权回执，重复点击只提交一次', async () => {
    let resolveActivation;
    const test = setup({ activate: vi.fn(() => new Promise((resolve) => { resolveActivation = resolve; })) });
    test.entry.begin({ system, key: ' test-key ', connected: true });
    test.entry.begin({ system: { value: 'other' }, key: 'another', connected: true });
    await flush(); test.entry.receive(valid()); await flush();
    expect(test.switchSystem).not.toHaveBeenCalled();
    resolveActivation(activationAck()); await flush();
    expect(test.activate.mock.calls).toEqual([['test-key']]);
    expect(test.switchSystem.mock.calls).toEqual([['hand0205']]);
    expect(test.onEntered.mock.calls).toEqual([[system]]);
    test.entry.receive(valid()); await flush(); expect(test.switchSystem).toHaveBeenCalledTimes(1);
  });
  it.each([
    [{ licenseError: '错误密钥' }, '错误密钥'],
    [{ valid: false, date: Date.now() + 60000 }, '有效授权'],
    [{ licenseLocked: true, reason: '已锁定' }, '已锁定'],
    [{ ...valid(), date: Date.now() - 1000 }, '密钥已过期'],
    [valid(['wholeChair']), '未授权'],
  ])('错误、过期及范围不匹配时不切换 %j', async (response, error) => {
    const test = setup({ activate: vi.fn(async () => {
      if (response.licenseError || response.licenseLocked) throw new Error(response.licenseError || response.reason);
      return activationAck(response);
    }) }); test.entry.begin({ system, key: 'test', connected: true });
    await flush();
    expect(test.switchSystem).not.toHaveBeenCalled(); expect(test.onEntered).not.toHaveBeenCalled();
    expect(test.onError.mock.calls.at(-1)[0]).toContain(error);
  });
  it('不复用上一次密钥的 all 范围', async () => {
    const message = valid(); delete message.selectFlag;
    const test = setup({ activate: vi.fn(async () => activationAck(message)) }); test.entry.receive(valid());
    test.entry.begin({ system, key: 'changed-key', connected: true });
    test.entry.receive(valid()); await flush();
    expect(test.switchSystem).not.toHaveBeenCalled();
    expect(test.onInvalidated).toHaveBeenCalled();
  });
  it('外部系统独立可选，但仍须有效密钥', async () => {
    const test = setup({ activate: vi.fn(async () => activationAck(valid(['wholeChair']))) }); const custom = { value: 'agent-pressure', source: 'manifest' };
    test.entry.begin({ system: custom, key: 'test', connected: true }); test.entry.receive(valid(['wholeChair'])); await flush();
    expect(test.switchSystem.mock.calls).toEqual([['agent-pressure']]);
  });
  it.each(['disconnect', 'unmount'])('%s 取消后迟到的成功不能跳转', async () => {
    const test = setup(); test.entry.begin({ system, key: 'test', connected: true });
    test.entry.cancel(); test.entry.receive(valid()); await flush(); expect(test.onEntered).not.toHaveBeenCalled(); expect(test.switchSystem).not.toHaveBeenCalled();
  });
  it('切换失败不进入，可重试', async () => {
    const test = setup({ switchSystem: vi.fn().mockRejectedValueOnce(new Error('系统已移除')).mockResolvedValue({ ok: true }) });
    test.entry.begin({ system, key: 'test', connected: true }); test.entry.receive(valid()); await flush();
    expect(test.onEntered).not.toHaveBeenCalled(); expect(test.onError).toHaveBeenLastCalledWith('系统已移除');
    test.entry.begin({ system, key: 'test', connected: true }); test.entry.receive(valid()); await flush();
    expect(test.onEntered).toHaveBeenCalledTimes(1);
  });
  it('超时不进入，后续消息不会复活已结束的请求', async () => {
    vi.useFakeTimers(); const test = setup({ activate: vi.fn(() => new Promise(() => {})) }); test.entry.begin({ system, key: 'test', connected: true });
    await vi.advanceTimersByTimeAsync(20001); test.entry.receive(valid()); await flush();
    expect(test.switchSystem).not.toHaveBeenCalled(); expect(test.onError.mock.calls.at(-1)[0]).toContain('超时');
  });
  it.each([{ key: '', connected: true, system }, { key: 'test', connected: false, system }, { key: 'test', connected: true }])('未满足条件不能提交 %j', async (options) => {
    const test = setup(); test.entry.begin(options); await flush(); expect(test.activate).not.toHaveBeenCalled();
  });
  it('验证列表只返回授权范围，不发送 sensor.switch 或跳转', async () => {
    const test = setup({ activate: vi.fn(async () => activationAck(valid(['wholeChair']))) });
    test.entry.validate({ key: ' chair-key ', connected: true }); await flush();
    expect(test.onValidated).toHaveBeenCalledWith(['wholeChair'], 'chair-key');
    expect(test.switchSystem).not.toHaveBeenCalled();
    expect(test.onEntered).not.toHaveBeenCalled();
    expect(test.onPhase).toHaveBeenLastCalledWith('idle');
  });
  it('改密钥并取消后，迟到的旧密钥成功不能覆盖新范围', async () => {
    let finishOld;
    const test = setup({ activate: vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
      .mockResolvedValueOnce(activationAck(valid(['wholeChair']))) });
    test.entry.validate({ key: 'old-key', connected: true });
    test.entry.cancel();
    test.entry.validate({ key: 'new-key', connected: true }); await flush();
    finishOld(activationAck()); await flush();
    expect(test.onValidated.mock.calls).toEqual([[['wholeChair'], 'new-key']]);
  });
  it('全授权广播不能替代当前受限密钥的回执', async () => {
    const test = setup({ activate: vi.fn(async () => activationAck(valid(['wholeChair']))) });
    test.entry.begin({ system, key: 'chair-key', connected: true }); test.entry.receive(valid()); await flush();
    expect(test.switchSystem).not.toHaveBeenCalled();
    expect(test.onValidated).toHaveBeenCalledWith(['wholeChair'], 'chair-key');
  });
});
