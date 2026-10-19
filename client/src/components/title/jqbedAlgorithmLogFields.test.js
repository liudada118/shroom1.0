import { describe, expect, it } from 'vitest';
import resources from '../../i18n/resources';
import { japaneseTranslations } from '../../i18n/ja';
import { getJqbedLogFieldInfo, JQBED_LOG_OUTPUT_FIELD_KEYS } from './jqbedAlgorithmLogFields';

const nativeOutputKeys = [
  'body_movement_data', 'rate', 'stroke_risk', 'state_in_bed', 'onbed_ratio', 'runtime',
  'sos_flag', 'merged_alarm', 'current_threshold', 'sitting_alarm_duration_minutes',
  'on_bed_duration_minutes', 'onbed_ratio_minute', 'rate_minute', 'awake_state', 'onbed_state',
  'body_movement_flag', 'version_info', 'alarm_counter', 'matrix_origin', 'matrix_filter',
  'merged_switch', 'filter_param', 'sos_param', 'sitting_area_out', 'reserved_bytes',
  'reserved_bytes20', 'sos_signal_out', 'sos_coord',
];

const translate = (language) => (path) => path.split('.').reduce(
  (value, part) => value?.[part], resources[language].translation,
) ?? path;

describe('jqbed native output descriptions', () => {
  it('describes all 28 measured native fields in Chinese, English, and Japanese', () => {
    expect(JQBED_LOG_OUTPUT_FIELD_KEYS).toEqual(nativeOutputKeys);
    for (const language of ['zh', 'en', 'ja']) {
      const fields = resources[language].translation.jqbedAlgorithmConfig.log.outputFields;
      expect(Object.keys(fields)).toEqual(nativeOutputKeys);
      for (const key of nativeOutputKeys) {
        const info = getJqbedLogFieldInfo(key, translate(language));
        expect(info.label).toBeTypeOf('string');
        expect(info.description).toBeTypeOf('string');
        expect(info.label.length).toBeGreaterThan(0);
        expect(info.description.length).toBeGreaterThan(0);
        expect(info.label).not.toBe(key);
        expect(info.description).not.toContain('jqbedAlgorithmConfig.');
        expect(info.label).not.toBe(translate(language)('jqbedAlgorithmConfig.log.unknownFieldLabel'));
      }
    }
  });

  it('keeps the Chinese reference beside Japanese labels and descriptions synchronized', () => {
    for (const key of nativeOutputKeys) {
      for (const part of ['label', 'description']) {
        const path = `jqbedAlgorithmConfig.log.outputFields.${key}.${part}`;
        expect(japaneseTranslations[path].zh).toBe(translate('zh')(path));
      }
    }
  });

  it('provides a neutral fallback without treating unknown keys as a translation path', () => {
    for (const language of ['zh', 'en', 'ja']) {
      const t = translate(language);
      const fallback = {
        label: t('jqbedAlgorithmConfig.log.unknownFieldLabel'),
        description: t('jqbedAlgorithmConfig.log.unknownFieldDescription'),
      };
      for (const key of ['future_native_flag', 'rate.extra', 'toString', '__proto__', '', null, undefined]) {
        expect(getJqbedLogFieldInfo(key, t)).toEqual(fallback);
      }
      expect(fallback.description).not.toContain('jqbedAlgorithmConfig.');
    }
    expect(getJqbedLogFieldInfo('new_field', translate('zh'))).toEqual({
      label: '未定义字段',
      description: '当前没有该字段的协议说明，保留算法原值，不推测含义。',
    });
  });

  it('can attach descriptions without dropping unknown raw keys, zeros, or array values', () => {
    const matrix = Array.from({ length: 1024 }, (_, index) => index / 4);
    const outputs = {
      rate: 0,
      matrix_origin: matrix,
      reserved_bytes: [12, 34, 0, 1, 3, 0, 77, 88, 99, 111],
      future_native_array: [0, 9, { flag: false }],
    };
    const original = structuredClone(outputs);
    const rows = Object.entries(outputs).map(([key, value]) => ({
      key, value, ...getJqbedLogFieldInfo(key, translate('zh')),
    }));
    expect(rows.map(({ key }) => key)).toEqual(Object.keys(outputs));
    expect(Object.fromEntries(rows.map(({ key, value }) => [key, value]))).toEqual(original);
    expect(rows.find(({ key }) => key === 'matrix_origin').value).toBe(matrix);
    expect(rows.find(({ key }) => key === 'future_native_array').label).toBe('未定义字段');
    expect(outputs).toEqual(original);
  });

  it('identifies rate as breathing and describes risk as the raw algorithm flag', () => {
    expect(getJqbedLogFieldInfo('rate', translate('zh')).label).toBe('实时呼吸率');
    expect(getJqbedLogFieldInfo('rate', translate('en')).description).toContain('breathing-rate');
    expect(getJqbedLogFieldInfo('rate', translate('ja')).description).toContain('呼吸数');
    expect(getJqbedLogFieldInfo('stroke_risk', translate('zh')).description).toContain('保留原始编码');
    expect(getJqbedLogFieldInfo('stroke_risk', translate('en')).description).toContain('raw code');
    expect(getJqbedLogFieldInfo('stroke_risk', translate('ja')).description).toContain('元のコードを保持');
  });

  it('describes returned durations as configuration checks and avoids inventing runtime units or enum codes', () => {
    const zh = translate('zh');
    expect(getJqbedLogFieldInfo('on_bed_duration_minutes', zh).description).toContain('离床报警前提在床时长，单位分钟，用于校验配置');
    expect(getJqbedLogFieldInfo('sitting_alarm_duration_minutes', zh).description).toContain('单位分钟，用于校验配置');
    expect(getJqbedLogFieldInfo('runtime', translate('en')).description).not.toMatch(/milliseconds|seconds|minutes/);
    expect(getJqbedLogFieldInfo('runtime', zh).description).not.toMatch(/毫秒|秒|分钟/);
    for (const key of ['state_in_bed', 'awake_state', 'onbed_state']) {
      const description = getJqbedLogFieldInfo(key, zh).description;
      expect(description).toContain('具体枚举以算法协议为准');
      expect(description).not.toMatch(/\d\s*[:=：]/);
    }
    const merged = getJqbedLogFieldInfo('merged_alarm', zh).description;
    ['0 无报警', '10 离床报警', '14 坐床边报警'].forEach((definition) => expect(merged).toContain(definition));
    expect(merged).not.toMatch(/11|13/);
    const sos = getJqbedLogFieldInfo('sos_flag', zh).description;
    ['0–254', '1 为报警序列起点', 'n>1'].forEach((definition) => expect(sos).toContain(definition));
  });

  it('documents only the confirmed reserved slots and keeps reserved_bytes20 separate', () => {
    const zh = getJqbedLogFieldInfo('reserved_bytes', translate('zh')).description;
    ['平滑SNR（中值+IIR，×10取整）', '呼吸信号最高突出度（×10取整）',
      '第3位为大体动帧上传标志', '第4位为呼吸阈值调整', '第5位为灵敏度档位', '第6位为床型']
      .forEach((meaning) => expect(zh).toContain(meaning));
    expect(getJqbedLogFieldInfo('reserved_bytes', translate('en')).description).toContain('sensitivity level, and bed type');
    expect(getJqbedLogFieldInfo('reserved_bytes', translate('ja')).description).toContain('5番目は感度レベル、6番目はベッドの種類');
    const extension = getJqbedLogFieldInfo('reserved_bytes20', translate('zh'));
    expect(extension.label).toBe('扩展预留数组');
    expect(extension.description).toContain('尚未提供逐项定义');
    expect(extension.description).not.toContain('灵敏度');
    expect(extension.description).not.toContain('床型');
  });
});
