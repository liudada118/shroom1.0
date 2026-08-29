import { describe, expect, it } from 'vitest';
import {
  adaptSensorFrameForLegacyPage,
  decodeWebSocketPayload,
  isSensorFrameEnvelope,
} from './sensorFrameDecoder';

const frame = {
  type: 'sensor.frame',
  schemaVersion: 1,
  channelId: 'multi-demo:armLeft',
  displaySystemId: 'multi-demo',
  sensorId: 'armLeft',
  outputChannel: 'armLeft',
  sensorType: 'arm',
  source: 'realtime',
  sequence: 12,
  timestamp: 1234,
  quality: 'good',
  payload: {
    value: [30, 40],
    stages: {
      decoded: [1, 2],
      normalized: [10, 20],
      calibrated: [11, 22],
      processed: [30, 40],
      mapped: [21, 12],
    },
    orientation: [1, 2, 3, 4],
    status: { primaryConnected: true, secondaryConnected: false, rateHz: 12 },
    temperature: {
      raw: [100],
      values: [36.5],
      average: 36.5,
      coefficient: 0.1,
      threshold: 8,
    },
    protocol: { frameIndex: 9, handSide: 'left' },
    history: { index: 7, recordedAt: 999 },
    matrix: { rows: 1, cols: 2, total: 2 },
    metrics: { totalPressure: 70 },
    algorithmMetrics: { score: 90 },
  },
};

describe('sensorFrameDecoder', () => {
  it('将自定义通道 envelope 适配为现有 manifest 页面对象', () => {
    const decoded = decodeWebSocketPayload(JSON.stringify(frame));

    expect(decoded.outputChannel).toBe('armLeft');
    expect(decoded.data).toEqual([30, 40]);
    expect(decoded.armLeftData).toEqual([30, 40]);
    expect(decoded.rawData).toEqual([1, 2]);
    expect(decoded.realArr).toEqual([1, 2]);
    expect(decoded.normalizedData).toEqual([10, 20]);
    expect(decoded.rawPressureData).toEqual([11, 22]);
    expect(decoded.newArr147).toEqual([21, 12]);
    expect(decoded.mappedArr195).toEqual([21, 12]);
    expect(decoded.rotate).toEqual([1, 2, 3, 4]);
    expect(decoded.sitFlag).toBe(true);
    expect(decoded.backFlag).toBe(false);
    expect(decoded.hz).toBe(12);
    expect(decoded.temperatureData).toEqual([36.5]);
    expect(decoded.frameIndex).toBe(9);
    expect(decoded.index).toBe(7);
    expect(decoded.time).toBe(999);
    expect(decoded.matrixWidth).toBe(2);
    expect(decoded.matrixHeight).toBe(1);
  });

  it('将内置通道 value 放回对应页面字段', () => {
    const decoded = adaptSensorFrameForLegacyPage({
      ...frame,
      channelId: 'car:sit',
      displaySystemId: 'car',
      sensorId: 'sit',
      outputChannel: 'sit',
    });

    expect(decoded.sitData).toEqual([30, 40]);
    expect(decoded.data).toBeUndefined();
  });

  it('不伪造缺失的数据阶段，并原样保留系统事件', () => {
    const sparse = adaptSensorFrameForLegacyPage({
      ...frame,
      payload: { value: [1], stages: { decoded: null, normalized: null } },
    });
    expect(sparse.rawData).toBeUndefined();
    expect(sparse.normalizedData).toBeUndefined();

    const systemEvent = { licenseChecking: true };
    expect(decodeWebSocketPayload(systemEvent)).toBe(systemEvent);
    expect(decodeWebSocketPayload('not-json')).toBe('not-json');
    expect(isSensorFrameEnvelope(systemEvent)).toBe(false);
  });
});
