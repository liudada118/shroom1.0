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
    sensorType: 'smallBed12B',
    outputChannel: 'sit',
    source: 'playback',
    sequence: 12,
    timestamp: 0,
    quality: 'good',
    payload: {
      value: ['1', 2, 3, 4],
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
      sensorType: 'smallBed12B',
      outputChannel: 'sit',
      channel: 'sit',
      source: 'playback',
      sequence: 12,
      timestamp: 0,
      quality: 'good',
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
    expect(frame).not.toHaveProperty('sitData');
    expect(frame).not.toHaveProperty('backData');
    expect(frame).not.toHaveProperty('headData');
  });

  it('derives sensorId from channelId and falls back to the processed stage', () => {
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

    const [frame] = normalizeIncomingMessage(envelope).frames;
    expect(frame.sensorId).toBe('head');
    expect(frame.sensorType).toBe('demo-display');
    expect(frame.channel).toBe('head');
    expect(frame.data).toEqual([5, 6, 7]);
    expect(frame.matrix).toMatchObject({ width: 3, height: 1, data: [5, 6, 7] });
  });

  it('does not claim an unknown schema version as a supported frame', () => {
    const message = createCanonicalFrame({ schemaVersion: 2 });
    const normalized = normalizeIncomingMessage(message);

    expect(isSensorFrameEnvelope(message)).toBe(false);
    expect(normalized.frames).toEqual([]);
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
