import { describe, expect, it } from 'vitest';
import resources from './resources';
import { SENSOR_TYPES, getSensorMatrix, isCar } from '../constants';
import { describeLicenseFile } from '../page/license/licenseScopeDisplay';
import { SOLUTIONS } from '../page/licensePortal/solutionConfig';

describe('single and dual tactile glove metadata', () => {
  it.each([
    ['zh', '触觉手套', '触觉手套2'],
    ['en', 'Tactile Gloves', 'Tactile Gloves 2'],
    ['ja', '触覚手袋', '触覚手袋2'],
  ])('distinguishes both glove names in %s', (language, single, dual) => {
    const labels = resources[language].translation;
    expect(labels.sensorHand0205).toBe(single);
    expect(labels.sensorHand0205Double).toBe(dual);
    expect(labels.sensorHand0205Single).not.toBe(single);
    expect(labels.sensorHand0205Single).not.toBe(dual);
  });

  it('registers both canonical systems and the compatibility key as 16 by 16 two-port systems', () => {
    expect(SENSOR_TYPES.HAND_0205).toBe('hand0205');
    expect(SENSOR_TYPES.HAND_0205_DOUBLE).toBe('hand0205Double');
    expect(SENSOR_TYPES.HAND_0205_SINGLE).toBe('hand0205Single');
    for (const type of ['hand0205', 'hand0205Double', 'hand0205Single']) {
      expect(isCar(type)).toBe(true);
      expect(getSensorMatrix(type)).toEqual({ width: 16, height: 16, total: 256 });
    }
  });

  it('keeps canonical single and dual glove license descriptions separate', () => {
    expect(describeLicenseFile('hand0205').list).toEqual(['hand0205']);
    expect(describeLicenseFile('hand0205Single').list).toEqual(['hand0205']);
    expect(describeLicenseFile('hand0205Double').list).toEqual(['hand0205Double']);
    const category = describeLicenseFile('@group:precision').list;
    expect(category).toContain('hand0205');
    expect(category).not.toContain('hand0205Single');
    expect(category).toContain('hand0205Double');
  });

  it('keeps both variants accessible from the embodied solution portal', () => {
    const modules = SOLUTIONS.find((solution) => solution.key === 'embodied').modules;
    expect(modules.find((module) => module.key === 'hand0205').labelKey).toBe('solutions.embodied.glove.label');
    expect(modules.find((module) => module.key === 'hand0205Double').labelKey).toBe('sensorHand0205Double');
    expect(modules.some((module) => module.key === 'hand0205Single')).toBe(false);
  });
});
