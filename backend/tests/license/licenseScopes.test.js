const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  LICENSE_SENSOR_GROUPS,
  createGroupScopeToken,
  expandLicenseFile,
  validateLicenseSensorGroups,
} = require('../../../licenseScopes');
const {
  decodeLicenseKey,
  generateLicenseKey,
  verifyOfflineLicense,
} = require('../../../crypto-lib.cjs');
const {
  buildLicenseRuntimeState,
  validateLicenseKey,
} = require('../../kernel/platform/license/licenseValidationService');

test('license category registry is unique and covers all 28 visible built-in systems', () => {
  assert.deepEqual(validateLicenseSensorGroups(), {
    groupCount: 5,
    sensorTypeCount: 28,
  });
  assert.equal(
    LICENSE_SENSOR_GROUPS.some((group) => group.items.some((item) => item.value === 'humanBody')),
    false,
  );
  assert.equal(
    LICENSE_SENSOR_GROUPS.some((group) => group.items.some((item) => item.value === 'humanBodyOptimized')),
    true,
  );
});

test('every category token expands in registry order', () => {
  for (const group of LICENSE_SENSOR_GROUPS) {
    const expanded = expandLicenseFile(createGroupScopeToken(group.key));
    assert.deepEqual(expanded.groupKeys, [group.key]);
    assert.deepEqual(expanded.sensorTypes, group.items.map((item) => item.value));
  }
});

test('category tokens mix with explicit systems, deduplicate, and reject unknown groups', () => {
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
  assert.throws(() => expandLicenseFile('@group:missing'), /unknown license group/);
  assert.throws(() => expandLicenseFile([]), /does not contain any display system/);
});

test('online category licenses preserve the stable token and expose expanded systems', () => {
  const key = generateLicenseKey('@group:precision', 30, 'production');
  const decoded = decodeLicenseKey(key, Date.now());
  const precision = LICENSE_SENSOR_GROUPS.find((group) => group.key === 'precision');

  assert.equal(decoded.valid, true);
  assert.equal(decoded.version, 3);
  assert.deepEqual(decoded.groupKeys, ['precision']);
  assert.deepEqual(decoded.sensorTypes, precision.items.map((item) => item.value));
  assert.equal(decoded.licenseFile, '@group:precision');
});

test('offline category licenses verify and preserve their stable scope token', () => {
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

test('backend runtime expands category scopes before selecting a display system', () => {
  const care = LICENSE_SENSOR_GROUPS.find((group) => group.key === 'care');
  const runtime = buildLicenseRuntimeState({
    date: Date.now() + 86400000,
    file: '@group:care',
  });

  assert.deepEqual(runtime.selectFlag, care.items.map((item) => item.value));
  assert.equal(runtime.nextFile, care.items[0].value);
});

test('backend authorization rejects an unknown category without mutating runtime state', () => {
  const validation = validateLicenseKey('encrypted', {
    decryptStr: () => JSON.stringify({
      date: Date.now() + 86400000,
      file: '@group:missing',
    }),
    fallbackFile: 'hand0205',
  });

  assert.deepEqual(validation, {
    ok: false,
    code: 'LICENSE_SCOPE_INVALID',
    message: '密钥授权范围无效，请联系厂商重新签发',
  });
});

test('legacy all, single, and fixed-list licenses keep their behavior', () => {
  const single = decodeLicenseKey(generateLicenseKey('hand0205', 30), Date.now());
  const multiple = decodeLicenseKey(generateLicenseKey(['hand0205', 'jqbed'], 30), Date.now());

  assert.deepEqual(single.sensorTypes, ['hand0205']);
  assert.deepEqual(single.groupKeys, []);
  assert.equal(single.version, 2);
  assert.deepEqual(multiple.sensorTypes, ['hand0205', 'jqbed']);
  assert.deepEqual(multiple.groupKeys, []);
  assert.equal(multiple.version, 2);
});
