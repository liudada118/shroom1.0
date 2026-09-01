import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import sensorFrameV1Contract, {
  SENSOR_FRAME_SCHEMA_VERSION,
  SENSOR_FRAME_TYPE,
} from '@shroom/frontend/contract/sensorFrameV1';
import multiSensorStableContract from './multiSensorStableContract.json';

const require = createRequire(import.meta.url);
const sensorFrameV1CommonJsContract = require(
  '@shroom/frontend/contract/sensorFrameV1',
);

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
  it('keeps ESM browser exports aligned with the CommonJS contract', () => {
    expect(SENSOR_FRAME_TYPE).toBe(multiSensorStableContract.frame.type);
    expect(SENSOR_FRAME_SCHEMA_VERSION).toBe(multiSensorStableContract.frame.schemaVersion);
    expect(SENSOR_FRAME_TYPE).toBe(sensorFrameV1CommonJsContract.SENSOR_FRAME_TYPE);
    expect(SENSOR_FRAME_SCHEMA_VERSION).toBe(
      sensorFrameV1CommonJsContract.SENSOR_FRAME_SCHEMA_VERSION,
    );
    expect(sensorFrameV1Contract.isSensorFrameV1Envelope(baseFrame)).toBe(
      sensorFrameV1CommonJsContract.isSensorFrameV1Envelope(baseFrame),
    );
  });

  it('accepts finite samples and JSON null samples', () => {
    expect(sensorFrameV1Contract.isDeclaredSensorFrame(baseFrame)).toBe(true);
    expect(sensorFrameV1Contract.isSensorFrameV1Envelope(baseFrame)).toBe(true);
    expect(sensorFrameV1CommonJsContract.isDeclaredSensorFrame(baseFrame)).toBe(true);
    expect(sensorFrameV1CommonJsContract.isSensorFrameV1Envelope(baseFrame)).toBe(true);
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
    expect(sensorFrameV1CommonJsContract.isSensorFrameV1Envelope(malformed)).toBe(false);
  });
});
