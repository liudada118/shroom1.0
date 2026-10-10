import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestJson } from './api.js';
import { readStaffReleases } from './CompanySystemRevisions.jsx';

vi.mock('./api.js', () => ({ requestJson: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

describe('员工版本目录与客户使用分离', () => {
  it.each([{ configured: false }, {}])('未配置员工令牌时不请求员工目录：%j', async (status) => {
    requestJson.mockResolvedValueOnce(status);
    await expect(readStaffReleases()).resolves.toEqual({ releases: [], staffConfigured: false });
    expect(requestJson.mock.calls).toEqual([['/api/system-packages/staff-credential']]);
  });

  it('已配置员工令牌才读取发布版本', async () => {
    const releases = [{ systemId: 'company-seat', version: 2 }];
    requestJson.mockResolvedValueOnce({ configured: true }).mockResolvedValueOnce({ releases });
    await expect(readStaffReleases()).resolves.toEqual({ releases, staffConfigured: true });
    expect(requestJson.mock.calls).toEqual([['/api/system-packages/staff-credential'], ['/api/system-packages/staff/releases']]);
  });

  it('有员工令牌但服务拒绝时仍保留真实错误', async () => {
    const failure = new Error('员工提交令牌已失效');
    requestJson.mockResolvedValueOnce({ configured: true }).mockRejectedValueOnce(failure);
    await expect(readStaffReleases()).rejects.toBe(failure);
  });
});
