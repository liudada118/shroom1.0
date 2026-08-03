import { describe, expect, it } from 'vitest';

import {
  buildAccessibleSensorOptions,
  getCurrentSensorTypeFromStatus,
} from './sensorStatus';

describe('getCurrentSensorTypeFromStatus', () => {
  it('keeps current runtime type separate from license scope', () => {
    expect(getCurrentSensorTypeFromStatus({
      currentSensorType: 'custom-pressure-map',
      file: ['hand0205', 'jqbed'],
      selectFlag: ['hand0205', 'jqbed'],
    })).toBe('custom-pressure-map');
  });

  it('supports legacy scalar switch events without treating license arrays as a selection', () => {
    expect(getCurrentSensorTypeFromStatus({ file: 'custom-pressure-map' })).toBe('custom-pressure-map');
    expect(getCurrentSensorTypeFromStatus({ file: ['hand0205', 'jqbed'] })).toBeNull();
    expect(getCurrentSensorTypeFromStatus({ file: 'hand0205', selectFlag: ['hand0205'] })).toBeNull();
  });
});

describe('buildAccessibleSensorOptions', () => {
  it('shows licensed built-ins together with locally installed display systems', () => {
    const options = buildAccessibleSensorOptions({
      builtInSensors: [
        { label: 'Hand', value: 'hand0205' },
        { label: 'Bed', value: 'jqbed' },
        { label: 'Foot', value: 'footVideo' },
      ],
      dynamicSensors: [
        { label: 'Custom map', value: 'custom-pressure-map' },
        { label: 'Built-in override', value: 'footVideo' },
      ],
      allowedTypes: ['hand0205', 'jqbed'],
    });

    expect(options.map((option) => option.value)).toEqual([
      'hand0205',
      'jqbed',
      'custom-pressure-map',
    ]);
  });
});
