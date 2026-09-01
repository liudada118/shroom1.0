import { describe, expect, it } from 'vitest';
import sensorFrameV1Contract from './sensorFrameV1.cjs';

const baseFrame = {
  type: 'sensor.frame',
  schemaVersion: 1,
  channelId: 'chair:left-hand',
  displaySystemId: 'chair',
  sensorId: 'left-hand',
  outputChannel: 'leftPressure',
  payload: { value: [1, null, 3] },
};

describe('published sensor.frame v1 contract', () => {
  it('accepts finite samples and JSON null samples', () => {
    expect(sensorFrameV1Contract.isDeclaredSensorFrame(baseFrame)).toBe(true);
    expect(sensorFrameV1Contract.isSensorFrameV1Envelope(baseFrame)).toBe(true);
  });

  it.each([
    ['future version', { ...baseFrame, schemaVersion: 2 }],
    ['identity mismatch', { ...baseFrame, displaySystemId: 'other' }],
    [
      'ambiguous identity',
      { ...baseFrame, sensorId: 'left:hand', channelId: 'chair:left:hand' },
    ],
    ['missing value', { ...baseFrame, payload: {} }],
    ['string sample', { ...baseFrame, payload: { value: ['1'] } }],
    ['non-finite sample', { ...baseFrame, payload: { value: [Number.NaN] } }],
  ])('fails closed for %s', (_name, malformed) => {
    expect(sensorFrameV1Contract.isSensorFrameV1Envelope(malformed)).toBe(false);
  });
});
