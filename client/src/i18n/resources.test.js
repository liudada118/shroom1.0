import { describe, expect, it } from 'vitest';
import resources from './resources';

const getTranslation = (language, path) => (
  path.split('.').reduce(
    (value, key) => value?.[key],
    resources[language]?.translation,
  )
);

describe('merged application translations', () => {
  it.each(['zh', 'en', 'ja'])(
    'provides the new display and JQBed labels in %s',
    (language) => {
      expect(getTranslation(language, 'sensorHumanBodyOptimized')).toBeTruthy();
      expect(getTranslation(language, 'humanBodyRaw.peak')).toBeTruthy();
      expect(getTranslation(language, 'jqbedAlgorithmConfig.title')).toBeTruthy();
    },
  );

  it('never exposes an untranslated key as the Chinese human-body label', () => {
    expect(getTranslation('zh', 'humanBodyRaw.peak')).not.toBe('humanBodyRaw.peak');
  });
});
