import { describe, expect, it } from 'vitest';
import {
  buildManifestSerialPortOptions,
  resolveManifestSerialSensors,
} from './manifestSerialControls';

describe('manifest serial controls', () => {
  it('uses business labels while keeping serial roles as stable command keys', () => {
    expect(resolveManifestSerialSensors({
      source: 'manifest',
      sensors: [
        { id: 'left-hand', label: '左手', serialRole: 'leftHand', baudRate: 921600 },
        { sensorId: 'seat', sensorLabel: '座椅', serial: { role: 'seatPort', baudRate: 115200 } },
      ],
    })).toMatchObject([
      { sensorId: 'left-hand', sensorLabel: '左手', serialRole: 'leftHand', baudRate: 921600 },
      { sensorId: 'seat', sensorLabel: '座椅', serialRole: 'seatPort', baudRate: 115200 },
    ]);
  });

  it('does not treat built-in fixed-port definitions as manifest channels', () => {
    expect(resolveManifestSerialSensors({ source: 'builtin', sensors: [{ id: 'sit' }] })).toEqual([]);
  });

  it('labels each COM option and prevents assigning an occupied path to another role', () => {
    expect(buildManifestSerialPortOptions(
      [{ value: 'COM3', label: 'COM3' }, { value: 'COM4', label: 'COM4' }],
      { leftHand: 'COM3' },
      'rightHand',
      '右手',
    )).toEqual([
      { value: 'COM3', label: '右手 · COM3', disabled: true },
      { value: 'COM4', label: '右手 · COM4', disabled: false },
    ]);
  });
});
