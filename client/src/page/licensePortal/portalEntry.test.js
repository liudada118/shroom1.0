import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPortalEntry } from './portalEntry';

const system = { value: 'hand0205', source: 'builtin' };
/** 模拟服务端的有效授权消息，不使用真实密钥或授权服务。 */
const valid = (selectFlag = 'all') => ({ date: Date.now() + 60000, nowDate: Date.now(), valid: true, selectFlag });
/** HTTP 命令客户端剥除外层 HttpResult 后返回的真实回执结构。 */
const activationAck = (payload = valid()) => ({ ok: true, data: { results: [{ name: 'license-activation', activationCode: 'OK', payload }] } });
/** 测试入口事务，所有外部动作都替换为可检查的桩。 */
function setup(overrides = {}) {
  const callbacks = { activate: vi.fn(async () => activationAck()), switchSystem: vi.fn(async () => ({ ok: true })), getManagedIds: vi.fn(async () => []), onPhase: vi.fn(), onError: vi.fn(), onEntered: vi.fn(), onValidated: vi.fn(), onInvalidated: vi.fn(), ...overrides };
  const entry = createPortalEntry(callbacks);
  return { entry, ...callbacks };
}
/** 放行授权与切换两个异步阶段。 */
async function flush() { for (let i = 0; i < 8; i += 1) await Promise.resolve(); }
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('首页选择系统事务', () => {
  it('列表验证一次后进入及返回重进不再请求授权，仍逐次切换系统', async () => {
    const test = setup();
    test.entry.validate({ key: 'same-key', connected: true }); await flush();
    test.onPhase.mockClear();
    for (let index = 0; index < 2; index++) {
      test.entry.begin({ system, key: ' same-key ', connected: true }); await flush();
    }
    expect(test.activate).toHaveBeenCalledTimes(1);
    expect(test.switchSystem).toHaveBeenCalledTimes(2);
    expect(test.onEntered).toHaveBeenCalledTimes(2);
    expect(test.onValidated).toHaveBeenCalledTimes(1);
    expect(test.onPhase.mock.calls.flat()).not.toContain('validating');
  });

  it('宿主启动快照可直接进入，普通成功广播不能冒充绑定身份的快照', async () => {
    const test = setup();
    expect(test.entry.restore({ key: 'saved-key', payload: valid(['hand0205']) })).toBe(true);
    test.entry.receive(valid(['hand0205']));
    test.entry.begin({ system, key: 'saved-key', connected: true }); await flush();
    expect(test.activate).not.toHaveBeenCalled();
    expect(test.switchSystem).toHaveBeenCalledWith('hand0205');
    const unbound = setup();
    unbound.entry.receive(valid());
    unbound.entry.begin({ system, key: 'unverified-key', connected: true }); await flush();
    expect(unbound.activate).toHaveBeenCalledTimes(1);
    expect(unbound.entry.restore({ key: '', payload: valid() })).toBe(false);
    expect(unbound.entry.restore({ key: 'bad', payload: { valid: false } })).toBe(false);
  });

  it('复用同一密钥时仍拒绝范围外系统，不能把前次成功当作全部授权', async () => {
    const test = setup({ activate: vi.fn(async () => activationAck(valid(['wholeChair']))) });
    test.entry.validate({ key: 'chair-key', connected: true }); await flush();
    test.entry.begin({ system, key: 'chair-key', connected: true }); await flush();
    expect(test.activate).toHaveBeenCalledTimes(1);
    expect(test.switchSystem).not.toHaveBeenCalled();
    expect(test.onError).toHaveBeenLastCalledWith('当前密钥未授权此系统，请选择可用系统或更换密钥');
  });

  it('更换密钥不能复用旧范围，显式验证仍会刷新同一密钥', async () => {
    const test = setup({ activate: vi.fn().mockResolvedValueOnce(activationAck())
      .mockResolvedValue(activationAck(valid(['wholeChair']))) });
    test.entry.validate({ key: 'old-key', connected: true }); await flush();
    test.entry.begin({ system, key: 'new-key', connected: true }); await flush();
    expect(test.activate.mock.calls).toEqual([['old-key'], ['new-key']]);
    expect(test.switchSystem).not.toHaveBeenCalled();
    test.entry.validate({ key: 'new-key', connected: true }); await flush();
    expect(test.activate).toHaveBeenCalledTimes(3);
  });

  it.each(['invalidate', 'disconnect'])('改密钥或断线后的 %s 不保留可复用结果', async mode => {
    const test = setup();
    test.entry.validate({ key: 'same-key', connected: true }); await flush();
    if (mode === 'invalidate') test.entry.invalidate();
    else test.entry.begin({ system, key: 'same-key', connected: false });
    test.entry.begin({ system, key: 'same-key', connected: true }); await flush();
    expect(test.activate).toHaveBeenCalledTimes(2);
  });

  it.each([{ licenseLocked: true }, { licenseError: '撤销' }, { valid: false },
    { licenseKey: 'other-key' }, { selectFlag: ['wholeChair'] }])('闲置时收到身份或权限变化不复用旧结果：%j', async message => {
    const test = setup();
    test.entry.validate({ key: 'same-key', connected: true }); await flush();
    test.entry.receive(message);
    test.entry.begin({ system, key: 'same-key', connected: true }); await flush();
    expect(test.activate).toHaveBeenCalledTimes(2);
  });

  it.each(['license', 'lease'])('%s 到期后不继续复用过期结果', async deadline => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T08:00:00Z'));
    const licenseAccess = { schemaVersion: 1, state: 'active', canAcquire: true, canReadHistory: true,
      canAnalyzeHistory: true, canExport: true, canConfigure: true, canStop: true,
      expiresAt: Date.now() + 1000, licenseExpiresAt: Date.now() + 60000 };
    const payload = deadline === 'lease' ? { ...valid(), licenseAccess } : { ...valid(), date: Date.now() + 1000 };
    const test = setup();
    test.entry.restore({ key: 'timed-key', payload });
    await vi.advanceTimersByTimeAsync(1001);
    test.entry.begin({ system, key: 'timed-key', connected: true }); await flush();
    expect(test.activate).toHaveBeenCalledTimes(1);
  });

  it('只读历史快照重复广播后仍能复用，不能恢复实时采集能力', async () => {
    const licenseAccess = { schemaVersion: 1, state: 'expired', canAcquire: false, canReadHistory: true,
      canAnalyzeHistory: true, canExport: false, canConfigure: false, canStop: true };
    const payload = { ...valid(['hand0205']), date: Date.now() - 1000, valid: false, licenseAccess };
    const test = setup();
    expect(test.entry.restore({ key: 'history-key', payload })).toBe(true);
    test.entry.receive(payload);
    test.entry.begin({ system, key: 'history-key', connected: true }); await flush();
    expect(test.activate).not.toHaveBeenCalled();
    expect(test.onEntered).toHaveBeenCalledWith(system);
    expect(payload.licenseAccess.canAcquire).toBe(false);
  });

  it('复用授权仍每次读取公司目录，已移除系统不能再次进入', async () => {
    const managed = { value: 'company-sensor', systemId: 'company-system', managed: true, source: 'manifest' };
    const test = setup({ activate: vi.fn(async () => activationAck(valid(['company-system']))),
      getManagedIds: vi.fn().mockResolvedValueOnce(['company-system']).mockResolvedValueOnce([]) });
    test.entry.validate({ key: 'company-key', connected: true }); await flush();
    test.entry.begin({ system: managed, key: 'company-key', connected: true }); await flush();
    test.entry.begin({ system: managed, key: 'company-key', connected: true }); await flush();
    expect(test.activate).toHaveBeenCalledTimes(1);
    expect(test.getManagedIds).toHaveBeenCalledTimes(2);
    expect(test.switchSystem).toHaveBeenCalledTimes(1);
    expect(test.onError).toHaveBeenLastCalledWith('当前密钥未授权此系统，请选择可用系统或更换密钥');
  });

  it('复用结果的切换仍等待宿主确认，断线后迟到成功不能进入', async () => {
    let finishSwitch;
    const test = setup({ switchSystem: vi.fn(() => new Promise(resolve => { finishSwitch = resolve; })) });
    test.entry.restore({ key: 'saved-key', payload: valid() });
    test.entry.begin({ system, key: 'saved-key', connected: true }); await flush();
    expect(test.onEntered).not.toHaveBeenCalled();
    test.entry.invalidate();
    finishSwitch({ ok: true }); await flush();
    expect(test.onEntered).not.toHaveBeenCalled();
    expect(test.activate).not.toHaveBeenCalled();
  });

  it('正常到期只读合同仍可进入本轮授权的历史系统', async () => {
    const licenseAccess = { schemaVersion: 1, state: 'expired', canAcquire: false, canReadHistory: true,
      canAnalyzeHistory: true, canExport: false, canConfigure: false, canStop: true };
    const payload = { ...valid(['hand0205']), date: Date.now() - 1000, valid: false, licenseAccess };
    const test = setup({ activate: vi.fn(async () => activationAck(payload)) });
    test.entry.begin({ system, key: 'expired-key', connected: true });
    test.entry.receive(payload); await flush();
    expect(test.switchSystem).toHaveBeenCalledWith('hand0205');
    expect(test.onEntered).toHaveBeenCalledWith(system);
    expect(test.onValidated).toHaveBeenCalledWith(['hand0205'], 'expired-key', expect.objectContaining({ state: 'expired', canExport: false }));
  });

  it('公司历史入口仍要求当前密钥系统范围及已安装历史列表', async () => {
    const licenseAccess = { schemaVersion: 1, state: 'expired', canAcquire: false, canReadHistory: true,
      canAnalyzeHistory: true, canExport: false, canConfigure: false, canStop: true };
    const payload = { ...valid(['company-seat']), date: Date.now() - 1000, valid: false, licenseAccess };
    const managed = { value: 'company-sit', systemId: 'company-seat', managed: true, source: 'manifest' };
    const test = setup({ activate: vi.fn(async () => activationAck(payload)), getManagedIds: vi.fn(async () => ['company-seat']) });
    test.entry.begin({ system: managed, key: 'expired-key', connected: true }); await flush();
    expect(test.getManagedIds).toHaveBeenCalledWith(payload);
    expect(test.switchSystem).toHaveBeenCalledWith('company-sit');
    const denied = setup({ activate: vi.fn(async () => activationAck({ ...payload, selectFlag: ['other-system'] })), getManagedIds: vi.fn(async () => ['company-seat']) });
    denied.entry.begin({ system: managed, key: 'expired-key', connected: true }); await flush();
    expect(denied.switchSystem).not.toHaveBeenCalled();
  });
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
    expect(test.getManagedIds).not.toHaveBeenCalled();
  });
  it.each([{ scope: ['company-seat'] }, { scope: 'all' }])('公司系统进入同时使用本轮密钥范围 $scope 和激活后读取的签名目录', async ({ scope }) => {
    const managed = { value: 'company-seat-sensor', systemId: 'company-seat', source: 'manifest', managed: true };
    let finishActivation;
    const test = setup({
      activate: vi.fn(() => new Promise((resolve) => { finishActivation = resolve; })),
      getManagedIds: vi.fn(async () => ['company-seat']),
    });
    test.entry.begin({ system: managed, key: 'company-key', connected: true });
    await flush();
    expect(test.getManagedIds).not.toHaveBeenCalled();
    finishActivation(activationAck(valid(scope))); await flush();
    expect(test.getManagedIds).toHaveBeenCalledTimes(1);
    expect(test.switchSystem.mock.calls).toEqual([['company-seat-sensor']]);
    expect(test.onEntered).toHaveBeenCalledWith(managed);
    expect(test.onError).toHaveBeenLastCalledWith('');
  });
  it.each([
    [['other-system'], ['company-seat']],
    [['company-seat'], []],
    ['all', []],
    [['company-seat'], ['other-system']],
  ])('公司系统缺少密钥范围或签名目录授权时仍拒绝：%j / %j', async (scope, managedIds) => {
    const test = setup({ activate: vi.fn(async () => activationAck(valid(scope))), getManagedIds: vi.fn(async () => managedIds) });
    test.entry.begin({ system: { value: 'company-seat-sensor', systemId: 'company-seat', source: 'manifest', managed: true }, key: 'company-key', connected: true });
    await flush();
    expect(test.switchSystem).not.toHaveBeenCalled();
    expect(test.onEntered).not.toHaveBeenCalled();
    expect(test.onError).toHaveBeenLastCalledWith('当前密钥未授权此系统，请选择可用系统或更换密钥');
  });
  it('公司授权目录读取失败时保留失败原因且不进入', async () => {
    const test = setup({ getManagedIds: vi.fn(async () => { throw new Error('公司系统授权目录读取失败'); }) });
    test.entry.begin({ system: { value: 'company-seat', systemId: 'company-seat', managed: true }, key: 'company-key', connected: true });
    await flush();
    expect(test.switchSystem).not.toHaveBeenCalled();
    expect(test.onError).toHaveBeenLastCalledWith('公司系统授权目录读取失败');
    expect(test.onInvalidated).not.toHaveBeenCalled();
  });
  it('换密钥取消后，迟到的公司目录不能进入旧系统', async () => {
    let finishCatalog;
    const test = setup({ getManagedIds: vi.fn(() => new Promise((resolve) => { finishCatalog = resolve; })) });
    test.entry.begin({ system: { value: 'company-seat', systemId: 'company-seat', managed: true }, key: 'old-key', connected: true });
    await flush();
    expect(test.getManagedIds).toHaveBeenCalledTimes(1);
    test.entry.cancel();
    test.entry.validate({ key: 'new-key', connected: true }); await flush();
    finishCatalog(['company-seat']); await flush();
    expect(test.switchSystem).not.toHaveBeenCalled();
    expect(test.onEntered).not.toHaveBeenCalled();
    expect(test.onValidated.mock.calls).toEqual([[null, 'old-key'], [null, 'new-key']]);
  });
  it('未接入公司目录读取器时仍默认拒绝公司系统', async () => {
    const test = setup({ getManagedIds: undefined });
    test.entry.begin({ system: { value: 'company-seat', systemId: 'company-seat', managed: true }, key: 'company-key', connected: true });
    await flush();
    expect(test.switchSystem).not.toHaveBeenCalled();
    expect(test.onError).toHaveBeenLastCalledWith('当前密钥未授权此系统，请选择可用系统或更换密钥');
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
