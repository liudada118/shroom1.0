const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  LICENSE_SENSOR_GROUPS,
  validateLicenseSensorGroups,
} = require('../licenseScopes');
const {
  getLicenseRegistryInfo,
  syncLicenseRegistry,
} = require('../scripts/sync-license-registry.cjs');

test('license registry validation rejects duplicate groups and display systems', () => {
  assert.throws(
    () => validateLicenseSensorGroups([
      { key: 'precision', items: [{ value: 'hand0205' }] },
      { key: 'precision', items: [{ value: 'fast1024' }] },
    ]),
    /duplicate or invalid license group/,
  );
  assert.throws(
    () => validateLicenseSensorGroups([
      { key: 'precision', items: [{ value: 'hand0205' }] },
      { key: 'custom', items: [{ value: 'hand0205' }] },
    ]),
    /duplicate or invalid display system/,
  );
});

test('registry sync writes the same validated category catalog for the issuer service', () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-license-registry-'));
  const target = path.join(tempDirectory, 'licenseSensorGroups.json');
  try {
    const result = syncLicenseRegistry(target);
    const copied = JSON.parse(fs.readFileSync(target, 'utf8'));
    const info = getLicenseRegistryInfo();

    assert.deepEqual(copied, LICENSE_SENSOR_GROUPS);
    assert.equal(result.groupCount, LICENSE_SENSOR_GROUPS.length);
    assert.equal(result.sensorTypeCount, info.sensorTypeCount);
    assert.equal(result.sha256, info.sha256);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});
