const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  JQBED_ALGORITHM_CONFIG_VERSION,
  DEFAULT_JQBED_ALGORITHM_VALUES,
  JqbedAlgorithmConfigValidationError,
  normalizeJqbedAlgorithmValues,
  createJqbedAlgorithmConfigStore,
} = require('../server/jqbedAlgorithmConfig');

test('normalizes all 19 jqbed algorithm values without sharing arrays', () => {
  const normalized = normalizeJqbedAlgorithmValues(DEFAULT_JQBED_ALGORITHM_VALUES);
  assert.equal(Object.keys(normalized).length, 19);
  assert.deepEqual(normalized.sos_disable_area, [6, 10]);
  assert.notEqual(normalized.sos_disable_area, DEFAULT_JQBED_ALGORITHM_VALUES.sos_disable_area);
  assert.equal(normalized.sensitivity_threshold, 0);
  assert.equal(normalized.isLowBed, 0);
  assert.equal(Object.hasOwn(normalized, 'head_foot_area'), false);
});

test('accepts normal and low bed settings and reports bedType for every invalid choice', () => {
  for (const value of [0, 1, '0', '1']) {
    const values = { ...DEFAULT_JQBED_ALGORITHM_VALUES, isLowBed: value };
    assert.equal(normalizeJqbedAlgorithmValues(values).isLowBed, Number(value));
  }
  for (const value of [-1, 2, 0.5, 'low', '', null, true, NaN, Infinity]) {
    assert.throws(
      () => normalizeJqbedAlgorithmValues({ ...DEFAULT_JQBED_ALGORITHM_VALUES, isLowBed: value }),
      (error) => error instanceof JqbedAlgorithmConfigValidationError
        && error.errors.isLowBed === 'bedType',
    );
  }
});

test('requires isLowBed and rejects obsolete head_foot_area in current configuration', () => {
  const values = { ...DEFAULT_JQBED_ALGORITHM_VALUES, head_foot_area: [0, 0] };
  delete values.isLowBed;
  assert.throws(
    () => normalizeJqbedAlgorithmValues(values),
    (error) => error instanceof JqbedAlgorithmConfigValidationError
      && error.errors.isLowBed === 'missing'
      && error.errors.head_foot_area === 'unknown',
  );
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

test('accepts only sensitivity modes 0 through 3', () => {
  for (const value of [0, 1, 2, 3]) {
    const values = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
    values.sensitivity_threshold = value;
    assert.equal(normalizeJqbedAlgorithmValues(values).sensitivity_threshold, value);
  }
  for (const value of [-1, 1.5, 4]) {
    const values = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
    values.sensitivity_threshold = value;
    assert.throws(() => normalizeJqbedAlgorithmValues(values), JqbedAlgorithmConfigValidationError);
  }
});

test('rejects an own enumerable __proto__ key as unknown', () => {
  const payload = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
  Object.defineProperty(payload, '__proto__', {
    value: 1,
    enumerable: true,
    configurable: true,
  });
  assert.throws(
    () => normalizeJqbedAlgorithmValues(payload),
    (error) => error instanceof JqbedAlgorithmConfigValidationError
      && error.errors.__proto__ === 'unknown',
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
    values.isLowBed = 1;
    const saved = store.save(values);
    assert.equal(saved.version, JQBED_ALGORITHM_CONFIG_VERSION);
    assert.equal(saved.savedAt, '2026-08-14T08:00:00.000Z');
    const diskSnapshot = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(diskSnapshot.version, 3);
    assert.equal(diskSnapshot.values.sos_peak_threshold, 18);
    assert.equal(diskSnapshot.values.isLowBed, 1);
    const reloaded = createJqbedAlgorithmConfigStore({ filePath }).load();
    assert.equal(reloaded.values.sos_peak_threshold, 18);
    assert.equal(reloaded.values.isLowBed, 1);
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
    assert.equal(snapshot.version, 3);
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

    fs.writeFileSync(filePath, JSON.stringify({ version: 999, values: DEFAULT_JQBED_ALGORITHM_VALUES, savedAt: 'x' }), 'utf8');
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

test('migrates version 1 in memory preserving existing values and discarding obsolete head_foot_area', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jqbed-config-'));
  const filePath = path.join(directory, 'jqbed-algorithm-config.json');
  try {
    const legacyValues = {
      ...structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES),
      threshold_factor: 7,
      head_foot_area: [3, 4],
    };
    delete legacyValues.sensitivity_threshold;
    delete legacyValues.isLowBed;
    fs.writeFileSync(filePath, JSON.stringify({
      version: 1,
      values: legacyValues,
      savedAt: '2026-08-14T08:00:00.000Z',
    }), 'utf8');

    const originalFile = fs.readFileSync(filePath, 'utf8');
    const store = createJqbedAlgorithmConfigStore({ filePath });
    const migrated = store.load();

    assert.equal(migrated.version, 3);
    assert.equal(migrated.values.threshold_factor, 7);
    assert.equal(migrated.values.sensitivity_threshold, 0);
    assert.equal(migrated.values.isLowBed, 0);
    assert.equal(Object.hasOwn(migrated.values, 'head_foot_area'), false);
    assert.equal(fs.readFileSync(filePath, 'utf8'), originalFile);
    assert.deepEqual(store.getSnapshot(), migrated);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('migrates version 2 without writing until save and preserves all existing settings', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jqbed-config-'));
  const filePath = path.join(directory, 'jqbed-algorithm-config.json');
  try {
    const legacyValues = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
    delete legacyValues.isLowBed;
    legacyValues.sensitivity_threshold = 3;
    legacyValues.sos_disable_area = [5, 9];
    legacyValues.sitting_area = [255, 255];
    const original = JSON.stringify({
      version: 2,
      values: legacyValues,
      savedAt: '2026-08-14T08:00:00.000Z',
    });
    fs.writeFileSync(filePath, original, 'utf8');
    const store = createJqbedAlgorithmConfigStore({
      filePath,
      now: () => new Date('2026-10-15T08:00:00.000Z'),
    });
    const migrated = store.load();
    assert.deepEqual(migrated, {
      version: 3,
      values: { ...legacyValues, isLowBed: 0 },
      savedAt: '2026-08-14T08:00:00.000Z',
    });
    assert.equal(fs.readFileSync(filePath, 'utf8'), original);
    const saved = store.save({ ...migrated.values, isLowBed: 1 });
    assert.equal(saved.savedAt, '2026-10-15T08:00:00.000Z');
    assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), saved);
    assert.equal(createJqbedAlgorithmConfigStore({ filePath }).load().values.isLowBed, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects malformed version 3 as a whole without rewriting the persisted file', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jqbed-config-'));
  const filePath = path.join(directory, 'jqbed-algorithm-config.json');
  const messages = [];
  try {
    for (const mutate of [
      (values) => { delete values.isLowBed; },
      (values) => { values.isLowBed = 2; },
      (values) => { values.head_foot_area = [0, 0]; },
    ]) {
      const values = { ...structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES), threshold_factor: 12 };
      mutate(values);
      const original = JSON.stringify({ version: 3, values, savedAt: '2026-10-15T08:00:00.000Z' });
      fs.writeFileSync(filePath, original, 'utf8');
      const snapshot = createJqbedAlgorithmConfigStore({
        filePath,
        logger: { warn: (message) => messages.push(message) },
      }).load();
      assert.deepEqual(snapshot.values, DEFAULT_JQBED_ALGORITHM_VALUES);
      assert.equal(snapshot.savedAt, null);
      assert.equal(fs.readFileSync(filePath, 'utf8'), original);
    }
    assert.equal(messages.length, 3);
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
    const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(persisted.version, 3);
    assert.deepEqual(persisted.values, DEFAULT_JQBED_ALGORITHM_VALUES);
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
