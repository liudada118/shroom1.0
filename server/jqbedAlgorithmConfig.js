const fs = require('node:fs');
const path = require('node:path');

const JQBED_ALGORITHM_CONFIG_VERSION = 1;

const DEFAULT_JQBED_ALGORITHM_VALUES = Object.freeze({
  threshold_factor: 0.0,
  continuous_on_bed_duration_minutes: 0.0,
  unlock_sitting_alarm_duration_minutes: 0.0,
  sos_peak_threshold: 0.0,
  points_threshold_in: 0.0,
  sos_disable_area: Object.freeze([6.0, 10.0]),
  min_sos_sequence: 0.0,
  filter_switch: 1.0,
  strel_switch: 1.0,
  leave_bed_disable_area: Object.freeze([0.0, 0.0]),
  small_object_size: Object.freeze([0.0, 0.0]),
  breath_detect_mode: 0.0,
  sitting_area: Object.freeze([0.0, 0.0]),
  body_movement_threshold: 30.0,
  step_leavebed_trigger: 50.0,
  edge_align_ratio: 0.0,
  head_foot_area: Object.freeze([0.0, 0.0]),
  breath_th: 0.0,
});

const FIELD_RULES = Object.freeze({
  threshold_factor: { kind: 'number' },
  continuous_on_bed_duration_minutes: { kind: 'number' },
  unlock_sitting_alarm_duration_minutes: { kind: 'number' },
  sos_peak_threshold: { kind: 'number' },
  points_threshold_in: { kind: 'number' },
  sos_disable_area: { kind: 'pair' },
  min_sos_sequence: { kind: 'integer' },
  filter_switch: { kind: 'switch' },
  strel_switch: { kind: 'switch' },
  leave_bed_disable_area: { kind: 'pair' },
  small_object_size: { kind: 'pair' },
  breath_detect_mode: { kind: 'integer' },
  sitting_area: { kind: 'sittingPair' },
  body_movement_threshold: { kind: 'number' },
  step_leavebed_trigger: { kind: 'number' },
  edge_align_ratio: { kind: 'number' },
  head_foot_area: { kind: 'pair' },
  breath_th: { kind: 'number' },
});

class JqbedAlgorithmConfigValidationError extends Error {
  constructor(errors) {
    super('Invalid jqbed algorithm configuration');
    this.name = 'JqbedAlgorithmConfigValidationError';
    this.errors = errors;
  }
}

function parseNonnegativeNumber(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) {
    return { error: 'number' };
  }
  const number = Number(value);
  if (!Number.isFinite(number)) return { error: 'finite' };
  if (number < 0) return { error: 'nonnegative' };
  return { value: number };
}

function normalizePair(value, kind) {
  if (!Array.isArray(value) || value.length !== 2) return { error: 'pair' };
  const normalized = value.map(parseNonnegativeNumber);
  const invalid = normalized.find((item) => item.error);
  if (invalid) return invalid;
  const pair = normalized.map((item) => item.value);
  const isSittingSentinel = pair[0] === 255 || pair[1] === 255;
  if (kind === 'sittingPair' && isSittingSentinel) {
    return pair[0] === 255 && pair[1] === 255 ? { value: pair } : { error: 'sentinel' };
  }
  if (pair[0] > 32 || pair[1] > 32) return { error: 'range' };
  return { value: pair };
}

function normalizeJqbedAlgorithmValues(values) {
  const errors = Object.create(null);
  const source = values && typeof values === 'object' && !Array.isArray(values) ? values : {};

  for (const key of Object.keys(source)) {
    if (!Object.hasOwn(FIELD_RULES, key)) errors[key] = 'unknown';
  }

  const normalized = {};
  for (const [key, rule] of Object.entries(FIELD_RULES)) {
    if (!Object.hasOwn(source, key)) {
      errors[key] = 'missing';
      continue;
    }
    const result = rule.kind === 'pair' || rule.kind === 'sittingPair'
      ? normalizePair(source[key], rule.kind)
      : parseNonnegativeNumber(source[key]);
    if (result.error) {
      errors[key] = result.error;
      continue;
    }
    if (rule.kind === 'integer' && !Number.isInteger(result.value)) {
      errors[key] = 'integer';
      continue;
    }
    if (rule.kind === 'switch' && result.value !== 0 && result.value !== 1) {
      errors[key] = 'switch';
      continue;
    }
    normalized[key] = result.value;
  }

  if (Object.keys(errors).length > 0) throw new JqbedAlgorithmConfigValidationError(errors);
  return normalized;
}

function cloneEnvelope(envelope) {
  return {
    version: envelope.version,
    values: normalizeJqbedAlgorithmValues(envelope.values),
    savedAt: envelope.savedAt,
  };
}

function defaultEnvelope() {
  return {
    version: JQBED_ALGORITHM_CONFIG_VERSION,
    values: normalizeJqbedAlgorithmValues(DEFAULT_JQBED_ALGORITHM_VALUES),
    savedAt: null,
  };
}

function persistEnvelope(filePath, envelope, fsImpl) {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fsImpl.writeFileSync(tempPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
    fsImpl.renameSync(tempPath, filePath);
  } catch (error) {
    try { fsImpl.unlinkSync(tempPath); } catch (_cleanupError) {}
    throw error;
  }
}

function createJqbedAlgorithmConfigStore({ filePath, fsImpl = fs, now = () => new Date(), logger } = {}) {
  let snapshot = defaultEnvelope();

  function fallBackToDefaults(error) {
    logger?.warn?.(`Unable to load jqbed algorithm configuration: ${error.message}`);
    snapshot = defaultEnvelope();
    return cloneEnvelope(snapshot);
  }

  function load() {
    if (!fsImpl.existsSync(filePath)) {
      snapshot = defaultEnvelope();
      return cloneEnvelope(snapshot);
    }
    try {
      const envelope = JSON.parse(fsImpl.readFileSync(filePath, 'utf8'));
      if (!envelope || envelope.version !== JQBED_ALGORITHM_CONFIG_VERSION || typeof envelope.savedAt !== 'string') {
        throw new Error('incompatible configuration envelope');
      }
      snapshot = {
        version: JQBED_ALGORITHM_CONFIG_VERSION,
        values: normalizeJqbedAlgorithmValues(envelope.values),
        savedAt: envelope.savedAt,
      };
      return cloneEnvelope(snapshot);
    } catch (error) {
      return fallBackToDefaults(error);
    }
  }

  function getSnapshot() {
    return cloneEnvelope(snapshot);
  }

  function save(values) {
    const next = {
      version: JQBED_ALGORITHM_CONFIG_VERSION,
      values: normalizeJqbedAlgorithmValues(values),
      savedAt: now().toISOString(),
    };
    persistEnvelope(filePath, next, fsImpl);
    snapshot = next;
    return cloneEnvelope(snapshot);
  }

  function reset() {
    return save(DEFAULT_JQBED_ALGORITHM_VALUES);
  }

  return { load, getSnapshot, save, reset };
}

module.exports = {
  JQBED_ALGORITHM_CONFIG_VERSION,
  DEFAULT_JQBED_ALGORITHM_VALUES,
  JqbedAlgorithmConfigValidationError,
  normalizeJqbedAlgorithmValues,
  createJqbedAlgorithmConfigStore,
};
