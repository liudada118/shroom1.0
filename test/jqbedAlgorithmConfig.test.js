const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  DEFAULT_JQBED_ALGORITHM_VALUES,
  JqbedAlgorithmConfigValidationError,
  normalizeJqbedAlgorithmValues,
  createJqbedAlgorithmConfigStore,
} = require('../server/jqbedAlgorithmConfig');

test('normalizes all 18 jqbed algorithm values without sharing arrays', () => {
  const normalized = normalizeJqbedAlgorithmValues(DEFAULT_JQBED_ALGORITHM_VALUES);
  assert.equal(Object.keys(normalized).length, 18);
  assert.deepEqual(normalized.sos_disable_area, [6, 10]);
  assert.notEqual(normalized.sos_disable_area, DEFAULT_JQBED_ALGORITHM_VALUES.sos_disable_area);
});

test('preserves supported 0,0 and 255,255 sentinel pairs', () => {
  const values = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
  values.leave_bed_disable_area = [0, 0];
  values.sitting_area = [255, 255];
  const normalized = normalizeJqbedAlgorithmValues(values);
  assert.deepEqual(normalized.leave_bed_disable_area, [0, 0]);
  assert.deepEqual(normalized.sitting_area, [255, 255]);
});

test('rejects the whole payload for unknown, missing, non-finite or invalid fields', () => {
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

test('atomically saves and reloads a complete snapshot', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jqbed-config-'));
  const filePath = path.join(directory, 'jqbed-algorithm-config.json');
  try {
    const store = createJqbedAlgorithmConfigStore({
      filePath,
      now: () => new Date('2026-08-14T08:00:00.000Z'),
    });
    const values = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
    values.sos_peak_threshold = 18;
    const saved = store.save(values);
    assert.equal(saved.savedAt, '2026-08-14T08:00:00.000Z');
    assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).values.sos_peak_threshold, 18);
    assert.equal(createJqbedAlgorithmConfigStore({ filePath }).load().values.sos_peak_threshold, 18);
    assert.deepEqual(fs.readdirSync(directory), ['jqbed-algorithm-config.json']);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
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

test('loads defaults when the file is missing', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jqbed-config-'));
  const filePath = path.join(directory, 'missing.json');
  try {
    const snapshot = createJqbedAlgorithmConfigStore({ filePath }).load();
    assert.equal(snapshot.version, 1);
    assert.deepEqual(snapshot.values, DEFAULT_JQBED_ALGORITHM_VALUES);
    assert.equal(snapshot.savedAt, null);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('logs and falls back for corrupt or incompatible persisted data', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jqbed-config-'));
  const filePath = path.join(directory, 'jqbed-algorithm-config.json');
  const messages = [];
  try {
    fs.writeFileSync(filePath, '{not json', 'utf8');
    const corrupt = createJqbedAlgorithmConfigStore({
      filePath,
      logger: { warn: (message) => messages.push(message) },
    }).load();
    assert.deepEqual(corrupt.values, DEFAULT_JQBED_ALGORITHM_VALUES);

    fs.writeFileSync(filePath, JSON.stringify({ version: 2, values: DEFAULT_JQBED_ALGORITHM_VALUES, savedAt: 'x' }), 'utf8');
    const incompatible = createJqbedAlgorithmConfigStore({
      filePath,
      logger: { warn: (message) => messages.push(message) },
    }).load();
    assert.deepEqual(incompatible.values, DEFAULT_JQBED_ALGORITHM_VALUES);
    assert.equal(messages.length, 2);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('reset persists default values', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jqbed-config-'));
  const filePath = path.join(directory, 'jqbed-algorithm-config.json');
  try {
    const store = createJqbedAlgorithmConfigStore({
      filePath,
      now: () => new Date('2026-08-14T08:00:00.000Z'),
    });
    const reset = store.reset();
    assert.deepEqual(reset.values, DEFAULT_JQBED_ALGORITHM_VALUES);
    assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')).values, DEFAULT_JQBED_ALGORITHM_VALUES);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('returned snapshots cannot mutate store state', () => {
  const store = createJqbedAlgorithmConfigStore({ filePath: 'ignored.json' });
  const snapshot = store.getSnapshot();
  snapshot.values.sos_disable_area[0] = 99;
  snapshot.values.threshold_factor = 99;
  assert.deepEqual(store.getSnapshot().values.sos_disable_area, [6, 10]);
  assert.equal(store.getSnapshot().values.threshold_factor, 0);
});
