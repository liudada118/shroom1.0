const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  LICENSE_SENSOR_GROUPS,
  createGroupScopeToken,
  expandLicenseFile,
} = require('../licenseScopes');
const {
  decodeLicenseKey,
  generateLicenseKey,
  verifyOfflineLicense,
} = require('../crypto-lib.cjs');

test('every configured license category expands to all systems in registry order', () => {
  for (const group of LICENSE_SENSOR_GROUPS) {
    const expanded = expandLicenseFile(createGroupScopeToken(group.key));
    assert.deepEqual(expanded.groupKeys, [group.key]);
    assert.deepEqual(expanded.sensorTypes, group.items.map((item) => item.value));
  }
});

test('precision-all includes both human-body systems and all current precision systems', () => {
  const precision = LICENSE_SENSOR_GROUPS.find((group) => group.key === 'precision');
  const expanded = expandLicenseFile('@group:precision');

  assert.deepEqual(expanded.sensorTypes, precision.items.map((item) => item.value));
  assert.ok(expanded.sensorTypes.includes('humanBody'));
  assert.ok(expanded.sensorTypes.includes('humanBodyOptimized'));
});

test('lab-all and custom-all include their alternate display systems', () => {
  assert.ok(expandLicenseFile('@group:lab').sensorTypes.includes('bed4096num'));
  assert.ok(expandLicenseFile('@group:custom').sensorTypes.includes('matCol'));
});

test('category scopes can be combined with explicit systems and are de-duplicated', () => {
  const expanded = expandLicenseFile([
    'jqbed',
    '@group:care',
    'humanBodyOptimized',
    '@group:precision',
  ]);

  assert.deepEqual(expanded.groupKeys, ['care', 'precision']);
  assert.equal(expanded.sensorTypes.filter((value) => value === 'jqbed').length, 1);
  assert.equal(expanded.sensorTypes.filter((value) => value === 'humanBodyOptimized').length, 1);
  assert.equal(expanded.sensorTypes[0], 'jqbed');
});

test('all remains unrestricted and unknown category scopes fail closed', () => {
  assert.deepEqual(expandLicenseFile('all', { allSensorTypes: ['a', 'b', 'a'] }), {
    isAllTypes: true,
    groupKeys: [],
    sensorTypes: ['a', 'b'],
  });
  assert.throws(() => expandLicenseFile('@group:missing'), /unknown license group/);
  assert.throws(() => expandLicenseFile([]), /does not contain any display system/);
});

test('online key generation stores a category token and decoding expands it', () => {
  const key = generateLicenseKey('@group:precision', 30, 'production');
  const decoded = decodeLicenseKey(key, Date.now());
  const precision = LICENSE_SENSOR_GROUPS.find((group) => group.key === 'precision');

  assert.equal(decoded.valid, true);
  assert.equal(decoded.version, 3);
  assert.deepEqual(decoded.groupKeys, ['precision']);
  assert.deepEqual(decoded.sensorTypes, precision.items.map((item) => item.value));
  assert.equal(decoded.licenseFile, '@group:precision');
});

test('offline category license verifies its signature and expands the category', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const payload = Buffer.from(JSON.stringify({
    expireDate: Date.now() + 30 * 86400000,
    sensorTypes: '@group:care',
    version: 3,
  })).toString('base64');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(payload);
  signer.end();
  const activationCode = Buffer.from(JSON.stringify({
    payload,
    signature: signer.sign(privateKey, 'base64'),
  })).toString('base64');

  const verified = verifyOfflineLicense(activationCode, {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    nowMs: Date.now(),
  });
  const care = LICENSE_SENSOR_GROUPS.find((group) => group.key === 'care');
  assert.equal(verified.valid, true);
  assert.deepEqual(verified.groupKeys, ['care']);
  assert.deepEqual(verified.sensorTypes, care.items.map((item) => item.value));
  assert.equal(verified.licenseFile, '@group:care');
});

test('legacy single-system and fixed-list keys keep their original behavior', () => {
  const single = decodeLicenseKey(generateLicenseKey('hand0205', 30), Date.now());
  const multiple = decodeLicenseKey(generateLicenseKey(['hand0205', 'jqbed'], 30), Date.now());

  assert.deepEqual(single.sensorTypes, ['hand0205']);
  assert.deepEqual(single.groupKeys, []);
  assert.equal(single.version, 2);
  assert.deepEqual(multiple.sensorTypes, ['hand0205', 'jqbed']);
  assert.deepEqual(multiple.groupKeys, []);
  assert.equal(multiple.version, 2);
});
