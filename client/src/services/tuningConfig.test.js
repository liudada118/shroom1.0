import { beforeEach, describe, expect, it } from 'vitest';
import { registerNativeSystemTemplate } from '../displays/nativeSystemTemplates';
import { readTuningConfig, writeTuningConfig, hasExplicitTuningValue, resolveColorSliderMax, normalizeDisplayTuning } from './tuningConfig';

describe('调节参数的系统与模式缓存', () => {
  beforeEach(() => localStorage.clear());

  it('保留两个系统的独立参数和零阈值，重新读取时不映射成共用bed键', () => {
    writeTuningConfig({ sensorType: 'smallBed', mode: 'normal', valueType: 'valuej1', value: 310 });
    writeTuningConfig({ sensorType: 'smallBedNoAlg', mode: 'normal', valueType: 'valuej1', value: 620 });
    writeTuningConfig({ sensorType: 'smallBed', mode: 'normal', valueType: 'valuelInit1', value: 0 });
    expect(readTuningConfig({ sensorType: 'smallBed', legacyType: 'bed', mode: 'normal' })).toEqual({ valuej1: 310, valuelInit1: 0 });
    expect(readTuningConfig({ sensorType: 'smallBedNoAlg', legacyType: 'bed', mode: 'normal' })).toEqual({ valuej1: 620 });
  });

  it('兼容旧bed与型号缓存，明确的系统模式覆盖旧通用参数', () => {
    localStorage.setItem('valueConfig', JSON.stringify({ bed: { valueg1: 2, valuej1: 1205 }, bed__normal: { valuef1: 9 },
      smallBed: { valuej1: 888 }, smallBed__normal: { valuej1: 444 } }));
    expect(readTuningConfig({ sensorType: 'smallBed', legacyType: 'bed', mode: 'normal' })).toEqual({ valueg1: 2, valuej1: 444, valuef1: 9 });
    expect(hasExplicitTuningValue({ sensorType: 'smallBed', mode: 'normal' }, 'valuej1')).toBe(false);
    writeTuningConfig({ sensorType: 'smallBed', mode: 'normal', valueType: 'valuej1', value: 1205 });
    expect(hasExplicitTuningValue({ sensorType: 'smallBed', mode: 'normal' }, 'valuej1')).toBe(true);
  });

  it('显示模式不互相覆盖，并按实际原生副本ID隔离', () => {
    registerNativeSystemTemplate({ id: 'tuning-copy-a', sourceType: 'hand' });
    registerNativeSystemTemplate({ id: 'tuning-copy-b', sourceType: 'hand' });
    localStorage.setItem('file', 'tuning-copy-a');
    writeTuningConfig({ sensorType: 'hand', mode: 'normal', valueType: 'valuelInit1', value: 1000 });
    writeTuningConfig({ sensorType: 'hand', systemId: 'tuning-copy-b', mode: 'normal', valueType: 'valuelInit1', value: 2000 });
    writeTuningConfig({ sensorType: 'hand', mode: 'numoriginal', valueType: 'valuej1', value: 300 });
    expect(readTuningConfig({ sensorType: 'hand', mode: 'normal' })).toEqual({ valuelInit1: 1000 });
    expect(readTuningConfig({ sensorType: 'hand', systemId: 'tuning-copy-b', mode: 'normal' })).toEqual({ valuelInit1: 2000 });
    expect(readTuningConfig({ sensorType: 'hand', mode: 'numoriginal' })).toEqual({ valuej1: 300 });
    expect(readTuningConfig({ sensorType: 'hand', systemId: 'hand', mode: 'normal' })).toEqual({});
  });

  it('坏JSON和非数字设置不会阻止进入，写入时保留其他本地键', () => {
    localStorage.setItem('unrelated', 'keep');
    localStorage.setItem('valueConfig', '{broken');
    expect(readTuningConfig({ sensorType: 'hand', mode: 'normal' })).toEqual({});
    expect(writeTuningConfig({ sensorType: 'hand', mode: 'normal', valueType: 'valuelInit1', value: 0 })).toBe(true);
    expect(localStorage.getItem('unrelated')).toBe('keep');
    localStorage.setItem('valueConfig', JSON.stringify({ hand__normal: { value1: null, valueg1: 'bad', valuef1: 0, valuel1: '3' } }));
    expect(readTuningConfig({ sensorType: 'hand', mode: 'normal' })).toEqual({ valuef1: 0, valuel1: 3 });
  });

  it('颜色上限与缓冲宽度验证范围，坏缓存不会进入渲染器，0宽度可保存', () => {
    const options = { sensorType: 'smallBed', mode: 'normal' };
    for (const [valueType, value] of [['colorSliderMax', 0], ['colorSliderMax', 65536], ['edgeBuffer1', -1], ['edgeBuffer1', 1.5], ['edgeBuffer1', 17]]) {
      expect(writeTuningConfig({ ...options, valueType, value })).toBe(false);
    }
    localStorage.setItem('valueConfig', JSON.stringify({ smallBed__normal: { colorSliderMax: -4, edgeBuffer1: 200 } }));
    expect(readTuningConfig(options)).toEqual({});
    writeTuningConfig({ ...options, valueType: 'colorSliderMax', value: 65535 });
    writeTuningConfig({ ...options, valueType: 'edgeBuffer1', value: 0 });
    expect(readTuningConfig(options)).toEqual({ colorSliderMax: 65535, edgeBuffer1: 0 });
    expect(resolveColorSliderMax(undefined, 1205)).toBe(1205);
    expect(resolveColorSliderMax(300, 1205)).toBe(300);
    expect(normalizeDisplayTuning({ valuej1: 1205, colorSliderMax: 300 })).toMatchObject({ valuej1: 300, colorSliderMax: 300, edgeBuffer1: undefined });
    expect(normalizeDisplayTuning({ valuej1: 25 })).toMatchObject({ valuej1: 25, colorSliderMax: undefined, edgeBuffer1: undefined });
  });
});
