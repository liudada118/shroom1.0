import { describe, expect, it } from 'vitest';
import { readLicenseAccess, isHistoryOnlyLicense, canUseLicenseCapability } from './licenseAccess';
import { hasValidLicenseDate, isExpiredLicenseMessage } from './ws/messages';

const expired = { schemaVersion: 1, state: 'expired', reason: 'LICENSE_EXPIRED', canAcquire: false,
  canReadHistory: true, canAnalyzeHistory: true, canExport: false, canConfigure: false, canStop: true };

describe('授权能力合同兼容', () => {
  it('仅明确的正常到期合同保留历史，不把缺字段当作现代授权成功', () => {
    const access = readLicenseAccess({ licenseAccess: expired });
    expect(isHistoryOnlyLicense(access)).toBe(true);
    expect(canUseLicenseCapability(access, 'canExport')).toBe(false);
    expect(canUseLicenseCapability(access, 'canReadHistory')).toBe(true);
    expect(canUseLicenseCapability(access, 'canAnalyzeHistory')).toBe(true);
    expect(canUseLicenseCapability(access, 'canStop')).toBe(true);
    for (const invalid of [null, { ...expired, canStop: false }, { ...expired, canAcquire: true }, { ...expired, schemaVersion: 2 }]) {
      expect(isHistoryOnlyLicense(readLicenseAccess({ licenseAccess: invalid }))).toBe(false);
      expect(canUseLicenseCapability(readLicenseAccess({ licenseAccess: invalid }), 'canExport')).toBe(false);
    }
  });

  it('旧宿主缺少合同继续使用旧日期和授权规则', () => {
    expect(readLicenseAccess({ date: 123 })).toBeUndefined();
    expect(canUseLicenseCapability(undefined, 'canAcquire')).toBe(true);
    expect(hasValidLicenseDate({ date: 123, valid: false })).toBe(false);
  });

  it('现代到期日期虽然不是有效实时授权，仍是可验证的历史授权', () => {
    const payload = { date: Date.now() - 1000, valid: false, licenseAccess: expired };
    expect(hasValidLicenseDate(payload)).toBe(true);
    expect(isExpiredLicenseMessage(payload)).toBe(true);
    expect(hasValidLicenseDate({ ...payload, licenseAccess: { ...expired, state: 'restricted', canReadHistory: false } })).toBe(false);
  });
});
