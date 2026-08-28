const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  DEFAULT_JQBED_ALGORITHM_VALUES,
  JqbedAlgorithmConfigValidationError,
  createJqbedAlgorithmConfigStore,
  normalizeJqbedAlgorithmValues,
} = require('../../server/modules/jqbedAlgorithmConfig');

function withTemporaryConfig(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-jqbed-config-'));
  const filePath = path.join(directory, 'jqbed-algorithm-config.json');
  try {
    return run(filePath);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('normalizes the complete jqbed configuration without sharing pair arrays', () => {
  const normalized = normalizeJqbedAlgorithmValues(DEFAULT_JQBED_ALGORITHM_VALUES);

  assert.equal(Object.keys(normalized).length, 18);
  assert.deepEqual(normalized.sos_disable_area, [6, 10]);
  assert.notEqual(normalized.sos_disable_area, DEFAULT_JQBED_ALGORITHM_VALUES.sos_disable_area);
});

test('accepts documented sentinels and rejects an invalid payload as one unit', () => {
  const supported = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
  supported.sitting_area = [255, 255];
  assert.deepEqual(normalizeJqbedAlgorithmValues(supported).sitting_area, [255, 255]);

  const invalid = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
  delete invalid.breath_th;
  invalid.extra = 1;
  invalid.body_movement_threshold = Number.NaN;
  invalid.sitting_area = [255, 4];

  assert.throws(
    () => normalizeJqbedAlgorithmValues(invalid),
    (error) => error instanceof JqbedAlgorithmConfigValidationError
      && error.errors.breath_th === 'missing'
      && error.errors.extra === 'unknown'
      && error.errors.body_movement_threshold === 'finite'
      && error.errors.sitting_area === 'sentinel',
  );
});

test('atomically persists, reloads and protects the authoritative snapshot', () => {
  withTemporaryConfig((filePath) => {
    const store = createJqbedAlgorithmConfigStore({
      filePath,
      now: () => new Date('2026-08-14T08:00:00.000Z'),
    });
    const values = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
    values.threshold_factor = 2.5;

    const saved = store.save(values);
    assert.equal(saved.savedAt, '2026-08-14T08:00:00.000Z');
    assert.deepEqual(fs.readdirSync(path.dirname(filePath)), ['jqbed-algorithm-config.json']);
    assert.equal(createJqbedAlgorithmConfigStore({ filePath }).load().values.threshold_factor, 2.5);

    saved.values.threshold_factor = 99;
    saved.values.sos_disable_area[0] = 99;
    assert.equal(store.getSnapshot().values.threshold_factor, 2.5);
    assert.deepEqual(store.getSnapshot().values.sos_disable_area, [6, 10]);

    values.threshold_factor = 3.5;
    store.save(values);
    assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).values.threshold_factor, 3.5);
    assert.deepEqual(fs.readdirSync(path.dirname(filePath)), ['jqbed-algorithm-config.json']);
  });
});

test('keeps the previous snapshot when persistence fails', () => {
  const store = createJqbedAlgorithmConfigStore({
    filePath: 'ignored.json',
    fsImpl: {
      existsSync: () => false,
      mkdirSync: () => {},
      writeFileSync: () => { throw new Error('disk full'); },
      renameSync: () => {},
      unlinkSync: () => {},
    },
  });
  const before = store.getSnapshot();
  const values = structuredClone(before.values);
  values.threshold_factor = 9;

  assert.throws(() => store.save(values), /disk full/);
  assert.deepEqual(store.getSnapshot(), before);
});

test('loads defaults instead of exposing corrupt persisted data', () => {
  withTemporaryConfig((filePath) => {
    const warnings = [];
    fs.writeFileSync(filePath, '{not json', 'utf8');

    const snapshot = createJqbedAlgorithmConfigStore({
      filePath,
      logger: { warn: (message) => warnings.push(message) },
    }).load();

    assert.deepEqual(snapshot.values, DEFAULT_JQBED_ALGORITHM_VALUES);
    assert.equal(snapshot.savedAt, null);
    assert.equal(warnings.length, 1);
  });
});
