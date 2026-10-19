import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import resources from './resources';
import { japaneseTranslations } from './ja';
import { JQBED_CONFIG_FIELDS, serializeJqbedConfigDraft, validateJqbedConfigDraft } from '../components/title/jqbedAlgorithmConfig';

const require = createRequire(import.meta.url);
const { DEFAULT_JQBED_ALGORITHM_VALUES, normalizeJqbedAlgorithmValues } = require('../../../server/jqbedAlgorithmConfig');

const fieldKeys = [
  'sos_peak_threshold', 'points_threshold_in', 'sos_disable_area', 'min_sos_sequence',
  'isLowBed',
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

  it('labels the latest-frame view as Live Log without history controls', () => {
    expect(resources.zh.translation.jqbedAlgorithmConfig.log.title).toBe('实时 Log');
    expect(resources.en.translation.jqbedAlgorithmConfig.log.title).toBe('Live Log');
    expect(resources.ja.translation.jqbedAlgorithmConfig.log.title).toBe('リアルタイム Log');
    ['zh', 'en', 'ja'].forEach((language) => {
      const log = resources[language].translation.jqbedAlgorithmConfig.log;
      ['pause', 'resume', 'clear', 'follow', 'count', 'scalarSummary'].forEach((key) => expect(log).not.toHaveProperty(key));
    });
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
      expect(Object.keys(copy.bedTypes)).toEqual(['0', '1']);
      expect(copy.fields).not.toHaveProperty('head_foot_area');
      ['title', 'sensitivity', 'bedType', 'unavailable', 'help'].forEach((key) => {
        expect(copy.returnedSettings[key]).toEqual(expect.any(String));
        expect(copy.returnedSettings[key].length).toBeGreaterThan(0);
      });
      ['title', 'fieldCount', 'lastReceived', 'pendingValue', 'help', 'empty', 'waiting', 'receiving',
        'disconnected', 'sendFailed', 'denied', 'stopped', 'arrayValue', 'objectValue', 'rawJson']
        .forEach((key) => {
          expect(copy.log[key]).toEqual(expect.any(String));
          expect(copy.log[key].length).toBeGreaterThan(0);
        });
      [
        'row', 'column', 'pydWaiting', 'pydReady', 'pydError', 'lastSavedAt', 'neverSaved',
        'restoreConfirmation', 'restore', 'cancel', 'saveAndApply', 'saving', 'success',
        'loadFailure',
      ].forEach((key) => expect(copy[key]).toEqual(expect.any(String)));
      ['number', 'finite', 'nonnegative', 'integer', 'switch', 'bedType', 'sensitivityMode', 'pair', 'range', 'sentinel', 'missing', 'unknown']
        .forEach((key) => expect(copy.errors[key]).toEqual(expect.any(String)));
      ['unavailable', 'saveFailed'].forEach((key) => expect(copy.backend[key]).toEqual(expect.any(String)));
    });
  });

  it('uses the provider business names while retaining all canonical field names', () => {
    const labels = {
      threshold_factor: '离床阈值',
      continuous_on_bed_duration_minutes: '离床报警延迟时间（分钟）',
      unlock_sitting_alarm_duration_minutes: '坐床边报警延迟时间（分钟）',
      sos_peak_threshold: 'SOS拍打力度阈值',
      points_threshold_in: 'SOS拍打点数下限',
      min_sos_sequence: 'SOS最小连续拍打次数',
      breath_detect_mode: '呼吸检测模式',
      strel_switch: '在离床散点滤波开关',
      filter_switch: '离床滤波总开关',
      body_movement_threshold: '底层大体动检测阈值',
      step_leavebed_trigger: '离床波动辅助判定开关',
      sos_disable_area: 'SOS屏蔽区域',
      sitting_area: '坐床边臀部宽度',
      leave_bed_disable_area: '边缘滤波区域',
      small_object_size: '小物体滤波',
      edge_align_ratio: '坐床边边缘判定率',
      breath_th: '呼吸监测阈值',
      sensitivity_threshold: '坐床边灵敏度',
      isLowBed: '床型',
    };
    ['zh', 'en', 'ja'].forEach((language) => {
      expect(Object.keys(resources[language].translation.jqbedAlgorithmConfig.fields).sort()).toEqual([...fieldKeys].sort());
    });
    Object.entries(labels).forEach(([key, label]) => {
      const copy = resources.zh.translation.jqbedAlgorithmConfig.fields[key];
      expect(copy.label).toBe(label);
      ['label', 'help'].forEach((part) => {
        expect(japaneseTranslations[`jqbedAlgorithmConfig.fields.${key}.${part}`].zh).toBe(copy[part]);
      });
    });
    expect(JQBED_CONFIG_FIELDS.map(({ key }) => key).sort()).toEqual([...fieldKeys].sort());
    expect(Object.keys(DEFAULT_JQBED_ALGORITHM_VALUES).sort()).toEqual([...fieldKeys].sort());
    ['continuous_on_bed_duration', 'unlock_sitting_alarm_duration', 'filter_swtich', 'sit_mode', 'head_foot_area']
      .forEach((alias) => expect(resources.zh.translation.jqbedAlgorithmConfig.fields).not.toHaveProperty(alias));
  });

  it('identifies provider ranges as reference guidance in all languages', () => {
    const ranges = {
      threshold_factor: '25–255', sos_peak_threshold: '25–255',
      continuous_on_bed_duration_minutes: '0–255', unlock_sitting_alarm_duration_minutes: '0–255',
      breath_detect_mode: '0–1', filter_switch: '0–1', strel_switch: '0–1',
      body_movement_threshold: '0.2–1', step_leavebed_trigger: '0–255',
      edge_align_ratio: '0–255', breath_th: '0–255',
    };
    const prefixes = {
      zh: '算法方参考范围：', en: 'Reference range from the algorithm provider:', ja: 'アルゴリズム提供元の参考範囲：',
    };
    Object.entries(prefixes).forEach(([language, prefix]) => {
      const fields = resources[language].translation.jqbedAlgorithmConfig.fields;
      Object.entries(ranges).forEach(([key, range]) => {
        expect(fields[key].help).toContain(prefix);
        expect(fields[key].help).toContain(range);
      });
      ['sos_disable_area', 'leave_bed_disable_area', 'small_object_size', 'sitting_area']
        .forEach((key) => expect(fields[key].help).toContain('m,n'));
      expect(fields.sensitivity_threshold.help).not.toContain('m,n');
    });
    expect(resources.zh.translation.jqbedAlgorithmConfig.fields.points_threshold_in.help).toContain('算法方说明：最低 3 点');
    expect(resources.en.translation.jqbedAlgorithmConfig.fields.points_threshold_in.help).toContain('Algorithm provider guidance: minimum 3 points');
    expect(resources.ja.translation.jqbedAlgorithmConfig.fields.points_threshold_in.help).toContain('アルゴリズム提供元の説明：最小3点');
    expect(resources.zh.translation.jqbedAlgorithmConfig.fields.min_sos_sequence.help).toContain('算法方说明：最低 6 次');
    expect(resources.en.translation.jqbedAlgorithmConfig.fields.min_sos_sequence.help).toContain('Algorithm provider guidance: minimum 6 pats');
    expect(resources.ja.translation.jqbedAlgorithmConfig.fields.min_sos_sequence.help).toContain('アルゴリズム提供元の説明：最小6回');
  });

  it('keeps the native minute-based prerequisite and unlock meanings beside the provider delay labels', () => {
    const zh = resources.zh.translation.jqbedAlgorithmConfig.fields;
    const en = resources.en.translation.jqbedAlgorithmConfig.fields;
    const ja = resources.ja.translation.jqbedAlgorithmConfig.fields;
    expect(zh.continuous_on_bed_duration_minutes.help).toContain('当前算法接口按分钟设置连续在床前提时长');
    expect(zh.unlock_sitting_alarm_duration_minutes.help).toContain('当前算法接口按分钟设置坐姿报警解锁时长');
    expect(en.continuous_on_bed_duration_minutes.help).toContain('prerequisite continuous in-bed duration in minutes');
    expect(en.unlock_sitting_alarm_duration_minutes.help).toContain('sitting-alarm unlock duration in minutes');
    expect(ja.continuous_on_bed_duration_minutes.help).toContain('前提となる連続在床時間を分単位');
    expect(ja.unlock_sitting_alarm_duration_minutes.help).toContain('座位アラームの解除時間を分単位');
  });

  it('keeps current defaults and accepts existing settings independently of provider reference guidance', () => {
    expect(DEFAULT_JQBED_ALGORITHM_VALUES).toEqual({
      threshold_factor: 0, continuous_on_bed_duration_minutes: 0, unlock_sitting_alarm_duration_minutes: 0,
      sos_peak_threshold: 0, points_threshold_in: 0, sos_disable_area: [6, 10], min_sos_sequence: 0,
      filter_switch: 1, strel_switch: 1, leave_bed_disable_area: [0, 0], small_object_size: [0, 0],
      breath_detect_mode: 0, sitting_area: [0, 0], body_movement_threshold: 30, step_leavebed_trigger: 50,
      edge_align_ratio: 0, sensitivity_threshold: 0, breath_th: 0, isLowBed: 0,
    });
    const currentValues = { ...DEFAULT_JQBED_ALGORITHM_VALUES, threshold_factor: 20, breath_detect_mode: 2 };
    expect(normalizeJqbedAlgorithmValues(currentValues)).toEqual(currentValues);
    expect(validateJqbedConfigDraft(currentValues)).toEqual({ valid: true, errors: {} });
    expect(serializeJqbedConfigDraft(currentValues)).toEqual(currentValues);
    expect(JQBED_CONFIG_FIELDS.find(({ key }) => key === 'step_leavebed_trigger').kind).toBe('number');
    expect(JQBED_CONFIG_FIELDS.find(({ key }) => key === 'sensitivity_threshold').kind).toBe('sensitivityMode');
    expect(validateJqbedConfigDraft({ ...currentValues, sensitivity_threshold: 4 }).valid).toBe(false);
    expect(validateJqbedConfigDraft({ ...currentValues, sitting_area: [60, 60] }).valid).toBe(false);
    expect(validateJqbedConfigDraft({ ...currentValues, sitting_area: [255, 255] }).valid).toBe(true);
  });

  it('explains regional bed-type defaults without changing them when the language changes', () => {
    const zh = resources.zh.translation.jqbedAlgorithmConfig;
    const en = resources.en.translation.jqbedAlgorithmConfig;
    const ja = resources.ja.translation.jqbedAlgorithmConfig;
    expect(zh.bedTypes).toEqual({ 0: '0 高床（正常床）', 1: '1 矮床' });
    expect(en.bedTypes).toEqual({ 0: '0 High (standard) bed', 1: '1 Low bed' });
    expect(ja.bedTypes).toEqual({ 0: '0 高いベッド（標準）', 1: '1 低いベッド' });
    expect(zh.fields.isLowBed.help).toContain('国内版本默认使用 0，日本版本通常使用 1');
    expect(en.fields.isLowBed.help).toContain('Changing the interface language does not change the bed type.');
    expect(ja.fields.isLowBed.help).toContain('表示言語を変更してもベッドの種類は変わりません');
  });

  it('describes returned sensitivity and bed type as reserved bytes 5 and 6 in all languages', () => {
    const zh = resources.zh.translation.jqbedAlgorithmConfig;
    const en = resources.en.translation.jqbedAlgorithmConfig;
    const ja = resources.ja.translation.jqbedAlgorithmConfig;
    expect(zh.fields.sensitivity_threshold.help).toContain('reserved_bytes 第 5 位为灵敏度档位，第 6 位为床型');
    expect(en.fields.sensitivity_threshold.help).toContain('field 5 is the sensitivity level and field 6 is the bed type');
    expect(ja.fields.sensitivity_threshold.help).toContain('reserved_bytes の5番目は感度レベル、6番目はベッドの種類');
    expect(zh.fields.isLowBed.help).toContain('reserved_bytes 第 6 位回传床型');
    expect(en.fields.isLowBed.help).toContain('returns the bed type in field 6 of reserved_bytes');
    expect(ja.fields.isLowBed.help).toContain('reserved_bytes の6番目でベッドの種類を返します');
    [zh, en, ja].forEach((copy) => {
      expect(copy.fields.sensitivity_threshold.help).not.toMatch(/5\s*[～–-]\s*8/);
    });
  });

  it('names the latest valid algorithm output and explains retention separately from editable configuration', () => {
    expect(resources.zh.translation.jqbedAlgorithmConfig.returnedSettings).toEqual({
      title: '算法最近有效返回', sensitivity: '算法返回灵敏度', bedType: '算法返回床型', unavailable: '未返回',
      help: '仅收到有效回传时更新；间歇未返回时保留最近值，页面连接断开或切换系统时清空。',
    });
    expect(resources.en.translation.jqbedAlgorithmConfig.returnedSettings).toEqual({
      title: 'Latest valid algorithm output', sensitivity: 'Returned sensitivity', bedType: 'Returned bed type', unavailable: 'Not returned',
      help: 'Updates only on valid replies; keeps the last values between replies. Cleared when the page disconnects or you switch systems.',
    });
    expect(resources.ja.translation.jqbedAlgorithmConfig.returnedSettings).toEqual({
      title: 'アルゴリズムの直近の有効な返却値', sensitivity: '返却された感度', bedType: '返却されたベッドの種類', unavailable: '未返却',
      help: '有効な返却値を受信したときだけ更新します。未返却の間は直近の値を保持し、ページの接続が切断されたときやシステムを切り替えたときに消去します。',
    });
  });
});
