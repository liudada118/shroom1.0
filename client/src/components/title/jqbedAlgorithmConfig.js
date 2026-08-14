export const JQBED_CONFIG_GROUPS = Object.freeze([
  { key: 'sos', labelKey: 'jqbedAlgorithmConfig.groups.sos' },
  { key: 'basic', labelKey: 'jqbedAlgorithmConfig.groups.basic' },
  { key: 'filter', labelKey: 'jqbedAlgorithmConfig.groups.filter' },
  { key: 'advanced', labelKey: 'jqbedAlgorithmConfig.groups.advanced' },
]);

const pairElementLabelKeys = Object.freeze({
  sos_disable_area: Object.freeze([
    'jqbedAlgorithmConfig.front',
    'jqbedAlgorithmConfig.back',
  ]),
  leave_bed_disable_area: Object.freeze([
    'jqbedAlgorithmConfig.front',
    'jqbedAlgorithmConfig.back',
  ]),
  small_object_size: Object.freeze([
    'jqbedAlgorithmConfig.row',
    'jqbedAlgorithmConfig.column',
  ]),
  sitting_area: Object.freeze([
    'jqbedAlgorithmConfig.minimum',
    'jqbedAlgorithmConfig.maximum',
  ]),
  head_foot_area: Object.freeze([
    'jqbedAlgorithmConfig.head',
    'jqbedAlgorithmConfig.foot',
  ]),
});

export const JQBED_CONFIG_FIELDS = Object.freeze([
  { key: 'sos_peak_threshold', group: 'sos', kind: 'number' },
  { key: 'points_threshold_in', group: 'sos', kind: 'number' },
  { key: 'sos_disable_area', group: 'sos', kind: 'pair' },
  { key: 'min_sos_sequence', group: 'sos', kind: 'integer' },
  { key: 'threshold_factor', group: 'basic', kind: 'number' },
  { key: 'continuous_on_bed_duration_minutes', group: 'basic', kind: 'number' },
  { key: 'unlock_sitting_alarm_duration_minutes', group: 'basic', kind: 'number' },
  { key: 'filter_switch', group: 'filter', kind: 'switch' },
  { key: 'strel_switch', group: 'filter', kind: 'switch' },
  { key: 'leave_bed_disable_area', group: 'filter', kind: 'pair' },
  { key: 'small_object_size', group: 'filter', kind: 'pair' },
  { key: 'breath_detect_mode', group: 'advanced', kind: 'integer' },
  { key: 'sitting_area', group: 'advanced', kind: 'sittingPair' },
  { key: 'body_movement_threshold', group: 'advanced', kind: 'number' },
  { key: 'step_leavebed_trigger', group: 'advanced', kind: 'number' },
  { key: 'edge_align_ratio', group: 'advanced', kind: 'number' },
  { key: 'head_foot_area', group: 'advanced', kind: 'pair' },
  { key: 'breath_th', group: 'advanced', kind: 'number' },
].map((field) => Object.freeze({
  ...field,
  labelKey: `jqbedAlgorithmConfig.fields.${field.key}.label`,
  helpKey: `jqbedAlgorithmConfig.fields.${field.key}.help`,
  ...(field.kind === 'pair' || field.kind === 'sittingPair'
    ? { pairElementLabelKeys: pairElementLabelKeys[field.key] }
    : {}),
})));

const FIELD_BY_KEY = Object.freeze(Object.fromEntries(
  JQBED_CONFIG_FIELDS.map((field) => [field.key, field]),
));

const errorKey = (code) => `jqbedAlgorithmConfig.errors.${code}`;

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
  const hasSittingSentinel = pair[0] === 255 || pair[1] === 255;
  if (kind === 'sittingPair' && hasSittingSentinel) {
    return pair[0] === 255 && pair[1] === 255 ? { value: pair } : { error: 'sentinel' };
  }
  if (pair[0] > 32 || pair[1] > 32) return { error: 'range' };
  return { value: pair };
}

function normalizeFieldValue(field, value) {
  if (field.kind === 'switch' && typeof value === 'boolean') {
    return { value: value ? 1 : 0 };
  }
  const result = field.kind === 'pair' || field.kind === 'sittingPair'
    ? normalizePair(value, field.kind)
    : parseNonnegativeNumber(value);
  if (result.error) return result;
  if (field.kind === 'integer' && !Number.isInteger(result.value)) return { error: 'integer' };
  if (field.kind === 'switch' && result.value !== 0 && result.value !== 1) return { error: 'switch' };
  return result;
}

export function cloneJqbedConfigValues(values = {}) {
  return Object.fromEntries(JQBED_CONFIG_FIELDS.map(({ key }) => {
    const value = values[key];
    return [key, Array.isArray(value) ? [...value] : value];
  }));
}

export const createJqbedConfigModalState = () => ({
  draft: null,
  dirty: false,
  loadRequestId: null,
  pending: null,
  deferredEnvelope: null,
  awaitingEnvelope: false,
  displayResult: null,
  requestError: null,
});

const applyJqbedConfigEnvelope = (state, envelope) => ({
  ...state,
  draft: cloneJqbedConfigValues(envelope.values),
  dirty: false,
  deferredEnvelope: null,
  awaitingEnvelope: false,
});

export function reduceJqbedConfigModalState(state, event) {
  switch (event.type) {
    case 'open':
    case 'close':
      return createJqbedConfigModalState();
    case 'change':
      if (!state.draft) return state;
      return {
        ...state,
        draft: {
          ...state.draft,
          [event.key]: Array.isArray(event.value) ? [...event.value] : event.value,
        },
        dirty: true,
        displayResult: null,
      };
    case 'beginLoad':
      if (!event.requestId) return state;
      return {
        ...state,
        loadRequestId: event.requestId,
        requestError: null,
      };
    case 'begin':
      if (!event.requestId) return state;
      return {
        ...state,
        pending: { action: event.action, requestId: event.requestId },
        deferredEnvelope: null,
        awaitingEnvelope: false,
        displayResult: null,
        requestError: null,
      };
    case 'envelope':
      if (!event.envelope?.values) return state;
      if (state.pending) {
        return { ...state, deferredEnvelope: event.envelope };
      }
      if (state.awaitingEnvelope) {
        return applyJqbedConfigEnvelope(state, event.envelope);
      }
      if (state.dirty) return state;
      return applyJqbedConfigEnvelope(state, event.envelope);
    case 'result': {
      const result = event.result;
      if (result?.action === 'load') {
        if (!state.loadRequestId || result.requestId !== state.loadRequestId) return state;
        return {
          ...state,
          loadRequestId: null,
          requestError: result.ok ? null : {
            action: 'load',
            message: result.message || 'jqbedAlgorithmConfig.loadFailure',
          },
        };
      }
      const matchesPending = result
        && state.pending
        && result.action === state.pending.action
        && result.requestId === state.pending.requestId;
      if (!matchesPending) return state;
      if (result.ok && state.deferredEnvelope?.values) {
        return applyJqbedConfigEnvelope({
          ...state,
          pending: null,
          displayResult: result,
          requestError: null,
        }, state.deferredEnvelope);
      }
      return {
        ...state,
        pending: null,
        deferredEnvelope: null,
        awaitingEnvelope: Boolean(result.ok),
        displayResult: result,
        requestError: null,
      };
    }
    case 'timeout':
      if (event.action === 'load') {
        if (!state.loadRequestId || event.requestId !== state.loadRequestId) return state;
        return {
          ...state,
          loadRequestId: null,
          requestError: {
            action: 'load',
            message: 'jqbedAlgorithmConfig.requestTimeout',
          },
        };
      }
      if (!state.pending
        || event.action !== state.pending.action
        || event.requestId !== state.pending.requestId) return state;
      return {
        ...state,
        pending: null,
        deferredEnvelope: null,
        awaitingEnvelope: false,
        requestError: {
          action: event.action,
          message: 'jqbedAlgorithmConfig.requestTimeout',
        },
      };
    case 'requestFailure':
      return {
        ...state,
        loadRequestId: event.action === 'load' ? null : state.loadRequestId,
        pending: event.action === 'load' ? state.pending : null,
        deferredEnvelope: event.action === 'load' ? state.deferredEnvelope : null,
        awaitingEnvelope: event.action === 'load' ? state.awaitingEnvelope : false,
        requestError: {
          action: event.action,
          message: event.message || 'jqbedAlgorithmConfig.sendFailed',
        },
      };
    case 'disconnect':
      return {
        ...state,
        loadRequestId: null,
        pending: null,
        deferredEnvelope: null,
        awaitingEnvelope: false,
        requestError: {
          action: state.pending?.action || 'load',
          message: 'jqbedAlgorithmConfig.disconnected',
        },
      };
    default:
      return state;
  }
}

export function validateJqbedConfigDraft(values) {
  const errors = Object.create(null);
  const source = values && typeof values === 'object' && !Array.isArray(values) ? values : {};

  Object.keys(source).forEach((key) => {
    if (!Object.hasOwn(FIELD_BY_KEY, key)) errors[key] = errorKey('unknown');
  });
  JQBED_CONFIG_FIELDS.forEach((field) => {
    if (!Object.hasOwn(source, field.key)) {
      errors[field.key] = errorKey('missing');
      return;
    }
    const result = normalizeFieldValue(field, source[field.key]);
    if (result.error) errors[field.key] = errorKey(result.error);
  });

  return { valid: Object.keys(errors).length === 0, errors };
}

export function serializeJqbedConfigDraft(values = {}) {
  return Object.fromEntries(JQBED_CONFIG_FIELDS.map((field) => {
    const result = normalizeFieldValue(field, values[field.key]);
    const value = result.value;
    return [field.key, Array.isArray(value) ? [...value] : value];
  }));
}

export const getJqbedConfigAccess = ({ matrixName, history }) => ({
  visible: matrixName === 'jqbed',
  disabled: matrixName === 'jqbed' && history !== 'now',
  tooltipKey: history === 'now'
    ? 'jqbedAlgorithmConfig.open'
    : 'jqbedAlgorithmConfig.realtimeOnly',
});
