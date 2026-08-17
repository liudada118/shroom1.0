import { describe, expect, it } from 'vitest';
import {
  JQBED_CONFIG_FIELDS,
  JQBED_CONFIG_GROUPS,
  cloneJqbedConfigValues,
  createJqbedConfigModalState,
  getJqbedConfigAccess,
  reduceJqbedConfigModalState,
  validateJqbedConfigDraft,
  serializeJqbedConfigDraft,
} from './jqbedAlgorithmConfig';
import { resources } from '../../i18n/resources';

const validDraft = {
  sos_peak_threshold: '22.5',
  points_threshold_in: '3',
  sos_disable_area: ['6', '10'],
  min_sos_sequence: '2',
  threshold_factor: '1.25',
  continuous_on_bed_duration_minutes: '1',
  unlock_sitting_alarm_duration_minutes: '2',
  filter_switch: true,
  strel_switch: false,
  leave_bed_disable_area: ['0', '32'],
  small_object_size: ['1', '2'],
  breath_detect_mode: '1',
  sitting_area: ['255', '255'],
  body_movement_threshold: '30',
  step_leavebed_trigger: '50',
  edge_align_ratio: '0.25',
  sensitivity_threshold: '3',
  breath_th: '0',
};

describe('jqbed algorithm configuration model', () => {
  it('defines exactly 18 fields in four groups with SOS selected first', () => {
    expect(JQBED_CONFIG_FIELDS).toHaveLength(18);
    expect(JQBED_CONFIG_GROUPS.map((group) => group.key)).toEqual([
      'sos', 'basic', 'filter', 'advanced',
    ]);
  });

  it('assigns the algorithm-defined meaning to every two-value field', () => {
    const pairs = Object.fromEntries(JQBED_CONFIG_FIELDS
      .filter((field) => field.pairElementLabelKeys)
      .map((field) => [field.key, field.pairElementLabelKeys]));

    expect(pairs).toEqual({
      sos_disable_area: ['jqbedAlgorithmConfig.front', 'jqbedAlgorithmConfig.back'],
      leave_bed_disable_area: ['jqbedAlgorithmConfig.front', 'jqbedAlgorithmConfig.back'],
      small_object_size: ['jqbedAlgorithmConfig.row', 'jqbedAlgorithmConfig.column'],
      sitting_area: ['jqbedAlgorithmConfig.minimum', 'jqbedAlgorithmConfig.maximum'],
    });
  });

  it('describes SOS pat points and pair meanings consistently in all three languages', () => {
    const zh = resources.zh.translation.jqbedAlgorithmConfig;
    const en = resources.en.translation.jqbedAlgorithmConfig;
    const ja = resources.ja.translation.jqbedAlgorithmConfig;

    expect(zh.fields.points_threshold_in.label).toBe('SOS 拍打点数');
    expect(en.fields.points_threshold_in.label).toBe('SOS pat point count');
    expect(ja.fields.points_threshold_in.label).toBe('SOS叩打ポイント数');
    expect([zh.front, zh.back, zh.minimum, zh.maximum, zh.head, zh.foot]).toEqual([
      '前', '后', '最小', '最大', '床头', '床尾',
    ]);
    expect([en.front, en.back, en.minimum, en.maximum, en.head, en.foot]).toEqual([
      'Front', 'Back', 'Minimum', 'Maximum', 'Head', 'Foot',
    ]);
    expect([ja.front, ja.back, ja.minimum, ja.maximum, ja.head, ja.foot]).toEqual([
      '前', '後', '最小', '最大', 'ベッド頭側', 'ベッド足側',
    ]);
    expect([
      en.fields.sos_disable_area.help,
      en.fields.leave_bed_disable_area.help,
      en.fields.sitting_area.help,
      en.fields.small_object_size.help,
    ]).toEqual([
      'Front and back boundaries excluded from SOS detection.',
      'Front and back boundaries excluded from bed-exit detection.',
      'Minimum and maximum values for sitting detection; 255,255 disables it.',
      'Defines the row and column size of objects to filter.',
    ]);
    expect(en.fields.sensitivity_threshold.help).toContain('0 Default');
    expect(zh.fields.sensitivity_threshold.help).toContain('实时返回的预留字段第 5～8 位');
    expect(ja.fields.sensitivity_threshold.help).toContain('予約フィールド5～8');
    expect(zh.fields.points_threshold_in.help).toBe('SOS 拍打检测使用的点数阈值。');
    expect(ja.fields.points_threshold_in.help).toBe('SOS叩打検出に使用するポイント数のしきい値です。');
  });

  it('shows only for jqbed and disables playback', () => {
    expect(getJqbedConfigAccess({ matrixName: 'smallBed', history: 'now' }).visible).toBe(false);
    expect(getJqbedConfigAccess({ matrixName: 'jqbed', history: 'now' })).toMatchObject({ visible: true, disabled: false });
    expect(getJqbedConfigAccess({ matrixName: 'jqbed', history: 'playback' })).toMatchObject({ visible: true, disabled: true });
  });

  it('clones all fields without sharing pair references', () => {
    const cloned = cloneJqbedConfigValues(validDraft);

    expect(cloned).toEqual(validDraft);
    expect(cloned.sos_disable_area).not.toBe(validDraft.sos_disable_area);
  });

  it('validates the same scalar and pair bounds as the backend', () => {
    expect(validateJqbedConfigDraft(validDraft)).toEqual({ valid: true, errors: {} });

    const invalid = validateJqbedConfigDraft({
      ...validDraft,
      min_sos_sequence: '1.5',
      filter_switch: '2',
      leave_bed_disable_area: ['33', '0'],
      sitting_area: ['255', '4'],
      sensitivity_threshold: '4',
    });

    expect(invalid).toEqual({
      valid: false,
      errors: {
        min_sos_sequence: 'jqbedAlgorithmConfig.errors.integer',
        filter_switch: 'jqbedAlgorithmConfig.errors.switch',
        leave_bed_disable_area: 'jqbedAlgorithmConfig.errors.range',
        sitting_area: 'jqbedAlgorithmConfig.errors.sentinel',
        sensitivity_threshold: 'jqbedAlgorithmConfig.errors.sensitivityMode',
      },
    });
  });

  it('rejects enumerable own prototype keys as unknown fields', () => {
    ['constructor', 'toString', '__proto__'].forEach((key) => {
      const draft = { ...validDraft };
      if (key === '__proto__') {
        Object.defineProperty(draft, key, { value: 1, enumerable: true });
      } else {
        draft[key] = 1;
      }

      const result = validateJqbedConfigDraft(draft);

      expect(result.valid).toBe(false);
      expect(Object.hasOwn(result.errors, key)).toBe(true);
      expect(result.errors[key]).toBe('jqbedAlgorithmConfig.errors.unknown');
    });
  });

  it('serializes numeric strings and switches while preserving pairs', () => {
    const serialized = serializeJqbedConfigDraft(validDraft);

    expect(Object.keys(serialized)).toHaveLength(18);
    expect(serialized).toMatchObject({
      sos_peak_threshold: 22.5,
      filter_switch: 1,
      strel_switch: 0,
      sitting_area: [255, 255],
    });
    expect(serialized.sos_disable_area).not.toBe(validDraft.sos_disable_area);
    expect(serialized.sos_disable_area).toEqual([6, 10]);
  });

  it('does not let external envelopes overwrite a dirty or pending draft', () => {
    let state = reduceJqbedConfigModalState(createJqbedConfigModalState(), {
      type: 'envelope',
      envelope: { version: 1, values: validDraft, savedAt: null },
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'change', key: 'threshold_factor', value: '9',
    });

    const externalEnvelope = {
      version: 1,
      values: { ...validDraft, threshold_factor: '77' },
      savedAt: '2026-08-14T09:00:00.000Z',
    };
    const dirtyState = reduceJqbedConfigModalState(state, {
      type: 'envelope', envelope: externalEnvelope,
    });
    expect(dirtyState.draft.threshold_factor).toBe('9');
    expect(dirtyState.dirty).toBe(true);

    const pendingState = reduceJqbedConfigModalState(dirtyState, {
      type: 'begin', action: 'save', requestId: 'local-save-1',
    });
    const afterExternal = reduceJqbedConfigModalState(pendingState, {
      type: 'envelope', envelope: externalEnvelope,
    });
    expect(afterExternal.draft.threshold_factor).toBe('9');
    expect(afterExternal.pending).toEqual({ action: 'save', requestId: 'local-save-1' });
  });

  it('only a matching operation result completes pending and applies its deferred envelope', () => {
    let state = reduceJqbedConfigModalState(createJqbedConfigModalState(), {
      type: 'envelope',
      envelope: { version: 1, values: validDraft, savedAt: null },
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'change', key: 'threshold_factor', value: '9',
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'begin', action: 'save', requestId: 'local-save-2',
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'envelope',
      envelope: {
        version: 1,
        values: { ...validDraft, threshold_factor: '4' },
        savedAt: '2026-08-14T10:00:00.000Z',
      },
    });

    const staleResult = { ok: false, action: 'save', requestId: 'older-save' };
    state = reduceJqbedConfigModalState(state, { type: 'result', result: staleResult });
    expect(state.pending).toEqual({ action: 'save', requestId: 'local-save-2' });
    expect(state.displayResult).toBe(null);
    expect(state.draft.threshold_factor).toBe('9');

    const matchingResult = { ok: true, action: 'save', requestId: 'local-save-2' };
    state = reduceJqbedConfigModalState(state, { type: 'result', result: matchingResult });
    expect(state.pending).toBe(null);
    expect(state.displayResult).toBe(matchingResult);
    expect(state.dirty).toBe(false);
    expect(state.draft.threshold_factor).toBe('4');
  });

  it('clears session correlation on close and ignores old results after reopen', () => {
    let state = reduceJqbedConfigModalState(createJqbedConfigModalState(), {
      type: 'begin', action: 'reset', requestId: 'old-reset',
    });
    state = reduceJqbedConfigModalState(state, { type: 'close' });
    state = reduceJqbedConfigModalState(state, { type: 'open' });
    state = reduceJqbedConfigModalState(state, {
      type: 'result',
      result: { ok: false, action: 'reset', requestId: 'old-reset' },
    });

    expect(state).toEqual(createJqbedConfigModalState());
  });

  it('turns a load timeout into a retryable failure and accepts a later reconnect load', () => {
    let state = reduceJqbedConfigModalState(createJqbedConfigModalState(), {
      type: 'beginLoad', requestId: 'load-before-timeout',
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'timeout', action: 'load', requestId: 'load-before-timeout',
    });

    expect(state.loadRequestId).toBe(null);
    expect(state.requestError).toEqual({
      action: 'load', message: 'jqbedAlgorithmConfig.requestTimeout',
    });

    state = reduceJqbedConfigModalState(state, {
      type: 'beginLoad', requestId: 'load-after-reconnect',
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'envelope', envelope: { version: 1, values: validDraft, savedAt: null },
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'result',
      result: { ok: true, action: 'load', requestId: 'load-after-reconnect' },
    });

    expect(state.loadRequestId).toBe(null);
    expect(state.requestError).toBe(null);
    expect(state.draft).toEqual(validDraft);
  });

  it('preserves a dirty draft across mutation timeout, disconnect, and reconnect refresh', () => {
    let state = reduceJqbedConfigModalState(createJqbedConfigModalState(), {
      type: 'envelope', envelope: { version: 1, values: validDraft, savedAt: null },
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'change', key: 'threshold_factor', value: '9',
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'begin', action: 'save', requestId: 'save-before-drop',
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'timeout', action: 'save', requestId: 'save-before-drop',
    });
    expect(state.pending).toBe(null);
    expect(state.draft.threshold_factor).toBe('9');
    expect(state.dirty).toBe(true);

    state = reduceJqbedConfigModalState(state, { type: 'disconnect' });
    state = reduceJqbedConfigModalState(state, {
      type: 'beginLoad', requestId: 'load-after-drop',
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'envelope',
      envelope: { version: 1, values: { ...validDraft, threshold_factor: '77' }, savedAt: null },
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'result', result: { ok: true, action: 'load', requestId: 'load-after-drop' },
    });

    expect(state.draft.threshold_factor).toBe('9');
    expect(state.dirty).toBe(true);
    expect(state.requestError).toBe(null);
  });

  it.each(['save', 'reset'])('fails a timed-out %s without discarding the draft', (action) => {
    let state = reduceJqbedConfigModalState(createJqbedConfigModalState(), {
      type: 'envelope', envelope: { version: 1, values: validDraft, savedAt: null },
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'change', key: 'threshold_factor', value: '9',
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'begin', action, requestId: `${action}-timeout`,
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'timeout', action, requestId: `${action}-timeout`,
    });

    expect(state.pending).toBe(null);
    expect(state.requestError).toEqual({
      action, message: 'jqbedAlgorithmConfig.requestTimeout',
    });
    expect(state.draft.threshold_factor).toBe('9');
    expect(state.dirty).toBe(true);
  });

  it('ignores late results after disconnect has failed the correlated mutation', () => {
    let state = reduceJqbedConfigModalState(createJqbedConfigModalState(), {
      type: 'envelope', envelope: { version: 1, values: validDraft, savedAt: null },
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'change', key: 'threshold_factor', value: '9',
    });
    state = reduceJqbedConfigModalState(state, {
      type: 'begin', action: 'reset', requestId: 'reset-before-drop',
    });
    state = reduceJqbedConfigModalState(state, { type: 'disconnect' });
    state = reduceJqbedConfigModalState(state, {
      type: 'result', result: { ok: true, action: 'reset', requestId: 'reset-before-drop' },
    });

    expect(state.pending).toBe(null);
    expect(state.draft.threshold_factor).toBe('9');
    expect(state.dirty).toBe(true);
    expect(state.requestError.message).toBe('jqbedAlgorithmConfig.disconnected');
  });
});
