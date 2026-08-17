import { describe, expect, it } from 'vitest';
import resources from './resources';

const fieldKeys = [
  'sos_peak_threshold', 'points_threshold_in', 'sos_disable_area', 'min_sos_sequence',
  'threshold_factor', 'continuous_on_bed_duration_minutes', 'unlock_sitting_alarm_duration_minutes',
  'filter_switch', 'strel_switch', 'leave_bed_disable_area', 'small_object_size',
  'breath_detect_mode', 'sitting_area', 'body_movement_threshold', 'step_leavebed_trigger',
  'edge_align_ratio', 'sensitivity_threshold', 'breath_th',
];

describe('jqbed algorithm configuration translations', () => {
  it('provides jqbed algorithm configuration copy in all languages', () => {
    expect(resources.zh.translation.jqbedAlgorithmConfig.title).toBe('小床监测算法配置');
    expect(resources.en.translation.jqbedAlgorithmConfig.saveAndApply).toBe('Save and apply now');
    expect(resources.ja.translation.jqbedAlgorithmConfig.realtimeOnly).toBe('アルゴリズム設定はリアルタイム監視でのみ有効です');
  });

  it('provides every required field label and help text in all languages', () => {
    ['zh', 'en', 'ja'].forEach((language) => {
      const copy = resources[language].translation.jqbedAlgorithmConfig;
      expect(Object.keys(copy.groups)).toEqual(['sos', 'basic', 'filter', 'advanced']);
      fieldKeys.forEach((key) => {
        expect(copy.fields[key].label).toEqual(expect.any(String));
        expect(copy.fields[key].help).toEqual(expect.any(String));
      });
      expect(Object.keys(copy.sensitivityModes)).toEqual(['0', '1', '2', '3']);
      [
        'row', 'column', 'pydWaiting', 'pydReady', 'pydError', 'lastSavedAt', 'neverSaved',
        'restoreConfirmation', 'restore', 'cancel', 'saveAndApply', 'saving', 'success',
        'loadFailure',
      ].forEach((key) => expect(copy[key]).toEqual(expect.any(String)));
      ['number', 'finite', 'nonnegative', 'integer', 'switch', 'sensitivityMode', 'pair', 'range', 'sentinel', 'missing', 'unknown']
        .forEach((key) => expect(copy.errors[key]).toEqual(expect.any(String)));
      ['unavailable', 'saveFailed'].forEach((key) => expect(copy.backend[key]).toEqual(expect.any(String)));
    });
  });
});
