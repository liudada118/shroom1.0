import { describe, expect, it } from 'vitest';
import { readLicenseAccess, isHistoryOnlyLicense, canUseLicenseCapability, getLicenseExpiryTimestamp } from './licenseAccess';
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

describe('软件授权到期日期', () => {
  const now = Date.UTC(2026, 9, 27);
  const weekLater = now + 7 * 86400000;
  const threeYearsLater = Date.UTC(2029, 9, 27);
  const active = { ...expired, state: 'active', reason: '', canAcquire: true, canExport: true, canConfigure: true };

  it('使用三年软件授权期限，不把七天凭证期限当作密钥到期', () => {
    expect(getLicenseExpiryTimestamp({ date: weekLater, licenseAccess: {
      ...active, expiresAt: weekLater, licenseExpiresAt: threeYearsLater,
    } })).toBe(threeYearsLater);
  });

  it('保留真实一周内到期的授权日期，并兼容数字字符串', () => {
    expect(getLicenseExpiryTimestamp({ date: threeYearsLater, licenseAccess: {
      ...active, expiresAt: threeYearsLater, licenseExpiresAt: String(weekLater),
    } })).toBe(weekLater);
  });

  it('只有旧宿主没有授权合同时才兼容顶层 date', () => {
    expect(getLicenseExpiryTimestamp({ date: weekLater })).toBe(weekLater);
    expect(getLicenseExpiryTimestamp({ date: String(threeYearsLater) })).toBe(threeYearsLater);
  });

  it('现代合同缺失真实期限或合同无效时不回退顶层日期及凭证期限', () => {
    for (const licenseAccess of [null, {}, { ...active, schemaVersion: 2 },
      { ...active, canStop: false }, { ...active }, { ...active, expiresAt: weekLater }]) {
      expect(getLicenseExpiryTimestamp({ date: weekLater, licenseAccess })).toBeNull();
    }
  });

  it('拒绝不可表示的日期和非正数，现代及旧宿主均适用', () => {
    for (const value of [undefined, null, '', ' ', true, {}, [], 0, -1, NaN, Infinity, 'Infinity',
      'invalid', `${weekLater}broken`, 8640000000000001]) {
      expect(getLicenseExpiryTimestamp({ date: value })).toBeNull();
      expect(getLicenseExpiryTimestamp({ date: weekLater, licenseAccess: {
        ...active, expiresAt: weekLater, licenseExpiresAt: value,
      } })).toBeNull();
    }
    expect(getLicenseExpiryTimestamp()).toBeNull();
  });
});
