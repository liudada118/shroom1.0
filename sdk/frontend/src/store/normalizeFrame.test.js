import { describe, expect, it } from 'vitest';
import {
  SENSOR_FRAME_SCHEMA_VERSION,
  SENSOR_FRAME_TYPE,
  isSensorFrameEnvelope,
  normalizeIncomingMessage,
} from './normalizeFrame.js';

function createCanonicalFrame(overrides = {}) {
  return {
    type: SENSOR_FRAME_TYPE,
    schemaVersion: SENSOR_FRAME_SCHEMA_VERSION,
    channelId: 'small-bed-12b:sit',
    displaySystemId: 'small-bed-12b',
    sensorId: 'sit',
    sensorLabel: '座椅',
    sensorType: 'smallBed12B',
    outputChannel: 'sit',
    source: 'playback',
    sequence: 12,
    timestamp: 0,
    quality: 'good',
    serial: { role: 'seat', path: 'COM3', baudRate: 115200 },
    payload: {
      value: [1, 2, 3, 4],
      stages: {
        decoded: [9, 8, 7, 6],
        normalized: [0.1, 0.2, 0.3, 0.4],
        calibrated: [1, 2, 3, 4],
        processed: [1, 2, 3, 4],
        mapped: [4, 3, 2, 1],
      },
      metrics: {
        maxPressure: 4,
        totalPressure: 10,
        averagePressure: 2.5,
        activePoints: 4,
      },
      algorithmMetrics: { centerX: 0.5, centerY: 0.25 },
      matrix: { rows: 2, cols: 2, total: 4 },
      orientation: [0, 0, 0, 1],
      status: { primaryConnected: true, rateHz: 30 },
      temperature: { average: 28.5 },
      protocol: { frameIndex: 7 },
      history: { index: 42, recordedAt: 1234 },
    },
    ...overrides,
  };
}

describe('canonical sensor.frame normalization', () => {
  it('normalizes identity, payload stages, matrix metadata, and metrics without legacy aliases', () => {
    const envelope = createCanonicalFrame({
      // A canonical message must never fall back to top-level legacy data, even
      // if a mixed-version producer accidentally attaches it.
      sitData: [999],
      headData: [888],
    });
    const normalized = normalizeIncomingMessage(envelope);

    expect(isSensorFrameEnvelope(envelope)).toBe(true);
    expect(normalized.type).toBe(SENSOR_FRAME_TYPE);
    expect(normalized.frames).toHaveLength(1);
    expect(normalized.payload).toBe(envelope.payload);

    const [frame] = normalized.frames;
    expect(frame).toMatchObject({
      type: SENSOR_FRAME_TYPE,
      schemaVersion: 1,
      channelId: 'small-bed-12b:sit',
      displaySystemId: 'small-bed-12b',
      sensorId: 'sit',
      sensorLabel: '座椅',
      sensorType: 'smallBed12B',
      outputChannel: 'sit',
      channel: 'sit',
      source: 'playback',
      sequence: 12,
      timestamp: 0,
      quality: 'good',
      serial: { role: 'seat', path: 'COM3', baudRate: 115200 },
      data: [1, 2, 3, 4],
      matrix: {
        rows: 2,
        cols: 2,
        total: 4,
        width: 2,
        height: 2,
        data: [1, 2, 3, 4],
      },
      raw: {
        data: [9, 8, 7, 6],
        rotate: [0, 0, 0, 1],
        zeroFrame: [],
      },
      stages: {
        decoded: [9, 8, 7, 6],
        normalized: [0.1, 0.2, 0.3, 0.4],
        calibrated: [1, 2, 3, 4],
        processed: [1, 2, 3, 4],
        mapped: [4, 3, 2, 1],
      },
      stats: {
        max: 4,
        total: 10,
        mean: 2.5,
        point: 4,
        maxPressure: 4,
      },
      extra: {
        status: { primaryConnected: true, rateHz: 30 },
        temperature: { average: 28.5 },
        protocol: { frameIndex: 7 },
        history: { index: 42, recordedAt: 1234 },
      },
    });
    expect(frame.algorithmMetrics).toEqual({ centerX: 0.5, centerY: 0.25 });
    expect(frame.extra.serial).toEqual(envelope.serial);
    expect(frame).not.toHaveProperty('sitData');
    expect(frame).not.toHaveProperty('backData');
    expect(frame).not.toHaveProperty('headData');
  });

  it('rejects a declared canonical frame with incomplete identity instead of guessing', () => {
    const envelope = createCanonicalFrame({
      channelId: 'demo-display:head',
      displaySystemId: 'demo-display',
      sensorId: '',
      sensorType: '',
      outputChannel: '',
      payload: {
        stages: { processed: '[5, 6, 7]' },
        matrix: { rows: 1, cols: 3 },
      },
    });

    expect(isSensorFrameEnvelope(envelope)).toBe(false);
    expect(normalizeIncomingMessage(envelope).frames).toEqual([]);
  });

  it('does not claim an unknown schema version as a supported frame', () => {
    const message = createCanonicalFrame({ schemaVersion: 2, sitData: [99] });
    const normalized = normalizeIncomingMessage(message);

    expect(isSensorFrameEnvelope(message)).toBe(false);
    expect(normalized.frames).toEqual([]);
  });

  it('accepts null wire samples but rejects missing, coerced, or non-finite values', () => {
    expect(isSensorFrameEnvelope(createCanonicalFrame({
      payload: { value: [1, null, 3] },
    }))).toBe(true);

    const invalidPayloads = [
      {},
      { value: '[1,2]' },
      { value: [1, '2'] },
      { value: [1, Number.NaN] },
      { value: [1, Number.POSITIVE_INFINITY] },
    ];
    invalidPayloads.forEach((payload) => {
      expect(isSensorFrameEnvelope(createCanonicalFrame({ payload }))).toBe(false);
    });
  });

  it('requires an exact v1 version and unambiguous matching identity', () => {
    expect(isSensorFrameEnvelope(createCanonicalFrame({ schemaVersion: '1' }))).toBe(false);
    expect(isSensorFrameEnvelope(createCanonicalFrame({
      schemaVersion: undefined,
      version: 1,
    }))).toBe(false);

    [
      { displaySystemId: ' small-bed-12b ' },
      { sensorId: 'sit:extra', channelId: 'small-bed-12b:sit:extra' },
      { channelId: 'other:sit' },
      { outputChannel: ' sit ' },
    ].forEach((identityPatch) => {
      expect(isSensorFrameEnvelope(createCanonicalFrame(identityPatch))).toBe(false);
    });
  });

  it('never downgrades a malformed declared frame through legacy aliases', () => {
    const malformed = createCanonicalFrame({
      payload: { stages: { processed: [1, 2] } },
      sitData: [7, 8],
      value: [9, 10],
    });

    const normalized = normalizeIncomingMessage(malformed);
    expect(isSensorFrameEnvelope(malformed)).toBe(false);
    expect(normalized.type).toBe(SENSOR_FRAME_TYPE);
    expect(normalized.frames).toEqual([]);
    expect(normalized.raw).toBe(malformed);
  });
});

describe('pre-canonical compatibility', () => {
  it('keeps the old type=frame payload working, including timestamp zero', () => {
    const normalized = normalizeIncomingMessage({
      type: 'frame',
      payload: {
        sensorType: 'legacy-chair',
        channel: 'back',
        timestamp: 0,
        matrix: { width: 2, height: 1, data: [3, 4] },
      },
    });

    expect(normalized.frames[0]).toMatchObject({
      sensorType: 'legacy-chair',
      channel: 'back',
      timestamp: 0,
      data: [3, 4],
      matrix: { width: 2, height: 1, data: [3, 4] },
    });
  });

  it('keeps top-level sitData/backData/headData as an input-only compatibility boundary', () => {
    const normalized = normalizeIncomingMessage({
      sensorType: 'legacy-car',
      sitData: [1, 2],
      backData: [3, 4],
      headData: [5, 6],
      time: 99,
    });

    expect(normalized.frames.map(({ channel, data }) => ({ channel, data }))).toEqual([
      { channel: 'sit', data: [1, 2] },
      { channel: 'back', data: [3, 4] },
      { channel: 'head', data: [5, 6] },
    ]);
    expect(normalized.frames.every((frame) => frame.timestamp === 99)).toBe(true);
  });

  it('keeps the former SDK pressure telemetry shape working', () => {
    const normalized = normalizeIncomingMessage({
      channelId: 'legacy_car_sit.pressure',
      deviceId: 'legacy_car_sit',
      portId: 'sit',
      metric: 'pressure',
      value: [1, 2, 3, 4],
      unit: 'raw',
      timestamp: 10,
      quality: 'good',
      metadata: {
        sensorType: 'legacy-car',
        legacyChannel: 'sit',
        matrixWidth: 2,
        matrixHeight: 2,
      },
    });

    expect(normalized.frames[0]).toMatchObject({
      channelId: 'legacy_car_sit.pressure',
      sensorId: 'sit',
      sensorType: 'legacy-car',
      channel: 'sit',
      data: [1, 2, 3, 4],
      matrix: { width: 2, height: 2, data: [1, 2, 3, 4] },
    });
  });

  it('does not turn ordinary system events into sensor frames', () => {
    const normalized = normalizeIncomingMessage({
      type: 'serial.status',
      payload: { connected: true },
    });

    expect(normalized.type).toBe('serial.status');
    expect(normalized.frames).toEqual([]);
  });
});
