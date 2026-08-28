import { describe, expect, it } from 'vitest';
import resources from './resources';

describe('Japanese vital-sign alerts', () => {
  it('uses 端座位 for both displayed and spoken alert keys', () => {
    const ja = resources.ja.translation;

    expect(ja.fallBed).toBe('端座位');
    expect(ja.sitUp).toBe('端座位');
    expect(ja.home.alerts.fallRisk).toBe('端座位');
    expect(ja.home.alerts.satUp).toBe('端座位');
  });

  it('keeps the Chinese and English spoken alert text unchanged', () => {
    expect(resources.zh.translation.home.alerts.fallRisk).toBe('坠床风险');
    expect(resources.zh.translation.home.alerts.satUp).toBe('已坐起');
    expect(resources.en.translation.home.alerts.fallRisk).toBe('Risk of falling from bed');
    expect(resources.en.translation.home.alerts.satUp).toBe('Sat up');
  });
});
