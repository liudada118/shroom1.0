import { describe, expect, it, vi } from 'vitest';
import { createPortalCompanySync } from './portalCompanySync';

const active = { schemaVersion: 1, state: 'active', canAcquire: true, canReadHistory: true,
  canAnalyzeHistory: true, canExport: true, canConfigure: true, canStop: true };
const expired = { ...active, state: 'expired', canAcquire: false, canExport: false, canConfigure: false };
const input = { key: 'fixture-key', scope: ['company-seat'], connected: true, access: active };

/** 控制状态读取和同步回执的先后顺序，不访问真实授权服务。 */
function setup() {
  const pending = [];
  const request = vi.fn((url, options) => new Promise((resolve, reject) => pending.push({ url, options, resolve, reject })));
  const onAvailable = vi.fn(), onStatus = vi.fn(), onSynced = vi.fn();
  return { sync: createPortalCompanySync({ request, onAvailable, onStatus, onSynced }), pending,
    request, onAvailable, onStatus, onSynced };
}

/** 放行请求与回执微任务。 */
async function flush() { for (let index = 0; index < 8; index++) await Promise.resolve(); }

describe('公司系统目录同步生命周期', () => {
  it('重复授权快照保持同一次同步，结果无需重启即可到达页面', async () => {
    const test = setup();
    test.sync.update(input); await flush();
    test.sync.update({ ...input, scope: [...input.scope], access: { ...active } }); await flush();
    expect(test.request).toHaveBeenCalledTimes(2);
    test.pending[0].resolve({ available: [] });
    test.pending[1].resolve({ available: [{ systemId: 'company-seat' }] }); await flush();
    expect(test.onAvailable).toHaveBeenLastCalledWith(['company-seat']);
    expect(test.onSynced).toHaveBeenCalledTimes(1);
    test.sync.update({ ...input, access: { ...active } }); await flush();
    expect(test.request).toHaveBeenCalledTimes(2);
  });

  it('较早的空状态迟到时不能覆盖同步成功的新目录', async () => {
    const test = setup(); test.sync.update(input); await flush();
    test.pending[1].resolve({ available: [{ systemId: 'company-seat' }] }); await flush();
    test.pending[0].resolve({ available: [] }); await flush();
    expect(test.onAvailable.mock.calls).toEqual([[['company-seat']]]);
  });

  it.each(['key', 'disconnect', 'unmount'])('%s 之后旧请求成功不能恢复原权限', async reason => {
    const test = setup(); test.sync.update(input); await flush();
    if (reason === 'key') test.sync.update({ ...input, key: 'next-fixture-key' });
    else if (reason === 'disconnect') test.sync.update({ ...input, connected: false });
    else test.sync.cancel();
    test.onAvailable.mockClear(); test.onStatus.mockClear();
    test.pending[0].resolve({ available: [{ systemId: 'old-company' }] });
    test.pending[1].resolve({ available: [{ systemId: 'old-company' }] }); await flush();
    expect(test.onAvailable).not.toHaveBeenCalled();
    expect(test.onSynced).not.toHaveBeenCalled();
    expect(test.onStatus.mock.calls.flat().some(value => value.phase === 'synced')).toBe(false);
  });

  it('断线重连同一密钥会重新同步，旧错误不会清除新结果', async () => {
    const test = setup(); test.sync.update(input); await flush();
    test.sync.update({ ...input, connected: false }); test.sync.update(input); await flush();
    expect(test.request).toHaveBeenCalledTimes(4);
    test.pending[3].resolve({ available: [{ systemId: 'company-seat' }] }); await flush();
    test.pending[1].reject({ status: 403, message: 'old request denied' }); await flush();
    expect(test.onAvailable).toHaveBeenLastCalledWith(['company-seat']);
    expect(test.onStatus).toHaveBeenLastCalledWith({ phase: 'synced', result: { available: [{ systemId: 'company-seat' }] } });
  });

  it('网络失败保留本地已签名状态，点击刷新可以重新同步成功', async () => {
    const test = setup(); test.sync.update(input); await flush();
    test.pending[1].reject({ status: 503, message: 'temporary unavailable' }); await flush();
    test.pending[0].resolve({ available: [{ systemId: 'cached-seat' }] }); await flush();
    expect(test.onAvailable).toHaveBeenLastCalledWith(['cached-seat']);
    expect(test.onStatus.mock.calls.at(-1)[0].phase).toBe('error');
    test.sync.update({ ...input, attempt: 1 }); await flush();
    test.pending[3].resolve({ available: [{ systemId: 'company-seat' }] }); await flush();
    expect(test.onAvailable).toHaveBeenLastCalledWith(['company-seat']);
    expect(test.onSynced).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403])('同步明确拒绝 %s 后，迟到旧缓存不能恢复授权', async status => {
    const test = setup(); test.sync.update(input); await flush();
    test.pending[1].reject({ status, message: 'denied' }); await flush();
    test.pending[0].resolve({ available: [{ systemId: 'old-company' }] }); await flush();
    expect(test.onAvailable).toHaveBeenLastCalledWith([]);
    expect(test.onSynced).not.toHaveBeenCalled();
  });

  it('历史只读只取当前宿主的历史清单，不发同步或恢复实时授权', async () => {
    const test = setup(); test.sync.update({ ...input, access: expired }); await flush();
    expect(test.pending.map(value => value.url)).toEqual(['/api/system-packages/status']);
    test.pending[0].resolve({ licenseAccess: expired, historyAvailable: ['company-seat'], available: [{ systemId: 'other' }] }); await flush();
    expect(test.onAvailable).toHaveBeenLastCalledWith(['company-seat']);
    expect(test.onStatus).toHaveBeenLastCalledWith({ phase: 'history' });
    expect(test.onSynced).not.toHaveBeenCalled();
  });

  it.each([undefined, ['hand']])('未验证或无需公司目录的范围 %j 不发同步', async scope => {
    const test = setup(); test.sync.update({ ...input, scope }); await flush();
    expect(test.request).not.toHaveBeenCalled();
    expect(test.onAvailable).toHaveBeenLastCalledWith([]);
  });

  it('清理后相同上下文重新挂载可以重新同步', async () => {
    const test = setup(); test.sync.update(input); await flush(); test.sync.cancel();
    test.sync.update(input); await flush();
    test.pending[3].resolve({ available: [{ systemId: 'company-seat' }] }); await flush();
    expect(test.request).toHaveBeenCalledTimes(4);
    expect(test.onAvailable).toHaveBeenLastCalledWith(['company-seat']);
  });
});
