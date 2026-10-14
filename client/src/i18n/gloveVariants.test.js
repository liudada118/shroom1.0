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
    expect(labels.sensorHand0205Single).toBe(single);
    expect(labels.sensorHand0205).toBe(dual);
    expect(labels.sensorHand0205Double.replaceAll(' ', '')).toBe(dual.replaceAll(' ', ''));
  });

  it('registers the restored glove as a distinct 16 by 16 two-port system', () => {
    expect(SENSOR_TYPES.HAND_0205_SINGLE).toBe('hand0205Single');
    expect(isCar('hand0205Single')).toBe(true);
    expect(getSensorMatrix('hand0205Single')).toEqual({ width: 16, height: 16, total: 256 });
  });

  it('does not add the restored glove to an existing explicit dual glove license', () => {
    expect(describeLicenseFile('hand0205').list).toEqual(['hand0205']);
    expect(describeLicenseFile('hand0205Single').list).toEqual(['hand0205Single']);
    const category = describeLicenseFile('@group:precision').list;
    expect(category).toContain('hand0205');
    expect(category).toContain('hand0205Single');
  });

  it('keeps both variants accessible from the embodied solution portal', () => {
    const modules = SOLUTIONS.find((solution) => solution.key === 'embodied').modules;
    expect(modules.find((module) => module.key === 'hand0205Single').labelKey).toBe('solutions.embodied.glove.label');
    expect(modules.find((module) => module.key === 'hand0205').labelKey).toBe('sensorHand0205');
  });
});
