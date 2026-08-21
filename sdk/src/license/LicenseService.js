const { expandLicenseFile } = require('../../../licenseScopes');

class LicenseService {
  constructor(options = {}) {
    this.decrypt = options.decrypt || null;
  }

  parseKey(encryptedKey) {
    if (!encryptedKey) {
      return {
        ok: false,
        error: 'license key is empty',
      };
    }

    if (!this.decrypt) {
      return {
        ok: false,
        error: 'license decrypt function is not configured',
      };
    }

    try {
      const decrypted = this.decrypt(encryptedKey);
      const payload = JSON.parse(decrypted);
      return {
        ok: true,
        payload,
        expiresAt: Number(payload.date),
        file: payload.file || null,
        moduleConfig: payload.moduleConfig || null,
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
      };
    }
  }

  getSelectFlag(licenseFile) {
    if (!licenseFile) return null;
    const expanded = expandLicenseFile(licenseFile);
    if (expanded.isAllTypes) return 'all';
    if (!Array.isArray(licenseFile) && expanded.groupKeys.length === 0) {
      return expanded.sensorTypes[0] || null;
    }
    return expanded.sensorTypes;
  }

  getDefaultFile(licenseFile, fallback = 'hand0205') {
    if (!licenseFile || licenseFile === 'all') return fallback;
    const expanded = expandLicenseFile(licenseFile);
    return expanded.sensorTypes[0] || fallback;
  }

  isExpired(expiresAt, now = Date.now()) {
    return Number(expiresAt) <= Number(now);
  }
}

module.exports = {
  LicenseService,
};
