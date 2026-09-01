import { beforeEach, describe, expect, it } from 'vitest';
import {
  adaptSensorFrameForClient,
  decodeWebSocketPayload,
  getSensorFrameChannelValue,
  getSensorFrameOutputChannel,
  getSensorFrameStageValue,
  isSensorFrameForActiveDisplay,
  isSensorFrameForDisplay,
  isSensorFrameEnvelope,
} from './sensorFrameDecoder';

const frame = {
  type: 'sensor.frame',
  schemaVersion: 1,
  channelId: 'multi-demo:armLeft',
  displaySystemId: 'multi-demo',
  sensorId: 'armLeft',
  sensorLabel: '左手',
  outputChannel: 'armLeft',
  sensorType: 'arm',
  source: 'realtime',
  sequence: 12,
  timestamp: 1234,
  quality: 'good',
  serial: {
    role: 'leftHand',
    path: 'COM7',
    baudRate: 921600,
    parserChannel: 'multi-demo:armLeft',
  },
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
  beforeEach(() => {
    globalThis.localStorage?.removeItem?.('file');
  });

  it('从 canonical payload 读取自定义通道及数据阶段', () => {
    const decoded = decodeWebSocketPayload(JSON.stringify(frame));

    expect(getSensorFrameOutputChannel(decoded)).toBe('armLeft');
    expect(getSensorFrameChannelValue(decoded, 'armLeft')).toEqual([30, 40]);
    expect(getSensorFrameChannelValue(decoded, 'sit')).toBeNull();
    expect(getSensorFrameStageValue(decoded, 'decoded')).toEqual([1, 2]);
    expect(getSensorFrameStageValue(decoded, 'normalized')).toEqual([10, 20]);
    expect(decoded).not.toHaveProperty('data');
    expect(decoded.rawData).toEqual([1, 2]);
    expect(decoded.newArr147).toEqual([21, 12]);
    expect(decoded.rotate).toEqual([1, 2, 3, 4]);
    expect(decoded.sitFlag).toBe(true);
    expect(decoded.backFlag).toBe(false);
    expect(decoded.temperatureData).toEqual([36.5]);
    expect(decoded.frameIndex).toBe(9);
    expect(decoded.sensorLabel).toBe('左手');
    expect(decoded.serial).toEqual(frame.serial);
  });

  it.each(['sit', 'back', 'head'])('不重建 %s 通道的顶层旧字段', (channel) => {
    const decoded = adaptSensorFrameForClient({
      ...frame,
      channelId: `car:${channel}`,
      displaySystemId: 'car',
      sensorId: channel,
      outputChannel: channel,
    });

    expect(getSensorFrameChannelValue(decoded, channel)).toEqual([30, 40]);
    expect(decoded).not.toHaveProperty(`${channel}Data`);
  });

  it('wildcard 订阅按展示系统身份隔离同名通道', () => {
    const decoded = decodeWebSocketPayload({
      ...frame,
      channelId: 'other-system:sit',
      displaySystemId: 'other-system',
      sensorId: 'sit',
      outputChannel: 'sit',
      sensorType: 'active-system',
    });

    expect(isSensorFrameForDisplay(decoded, ['active-system'])).toBe(false);
    expect(isSensorFrameForDisplay(decoded, ['other-system'])).toBe(true);
    expect(isSensorFrameForDisplay({ licenseChecking: true }, ['active-system'])).toBe(true);
    expect(isSensorFrameForDisplay({ sitData: [1, 2] }, ['active-system'])).toBe(true);
    expect(isSensorFrameForActiveDisplay(decoded, ['active-system'])).toBe(false);
    expect(isSensorFrameForActiveDisplay(decoded, ['other-system'])).toBe(true);
    expect(isSensorFrameForActiveDisplay(decoded)).toBe(false);
    globalThis.localStorage?.setItem?.('file', 'other-system');
    expect(isSensorFrameForActiveDisplay(decoded)).toBe(true);
    expect(isSensorFrameForActiveDisplay(decoded, ['active-system'])).toBe(false);
  });

  it('只在兼容边界读取旧服务端的顶层通道字段', () => {
    const legacy = { sitData: '[1,2]', backData: [3, 4] };

    expect(getSensorFrameChannelValue(legacy, 'sit')).toEqual([1, 2]);
    expect(getSensorFrameChannelValue(legacy, 'back')).toEqual([3, 4]);
    expect(getSensorFrameChannelValue({ sitData: { command: true } }, 'sit')).toBeNull();
  });

  it('mapped-only 帧仍以 payload.value 作为主渲染值', () => {
    const mappedOnly = {
      ...frame,
      payload: {
        value: [8, 9],
        stages: { processed: null, mapped: [8, 9] },
      },
    };

    expect(getSensorFrameChannelValue(mappedOnly, 'armLeft')).toEqual([8, 9]);
  });

  it('不伪造缺失阶段，并原样保留系统事件和版本不匹配消息', () => {
    const sparse = adaptSensorFrameForClient({
      ...frame,
      payload: { value: [1], stages: { decoded: null, normalized: null } },
    });
    expect(sparse.rawData).toBeUndefined();
    expect(sparse.normalizedData).toBeUndefined();

    const systemEvent = { licenseChecking: true };
    expect(decodeWebSocketPayload(systemEvent)).toBe(systemEvent);
    expect(decodeWebSocketPayload('not-json')).toBe('not-json');
    expect(isSensorFrameEnvelope(systemEvent)).toBe(false);

    const futureFrame = {
      ...frame,
      schemaVersion: 2,
      sitData: [99],
      rawData: [98],
    };
    expect(decodeWebSocketPayload(futureFrame)).toBe(futureFrame);
    expect(getSensorFrameOutputChannel(futureFrame)).toBe('');
    expect(getSensorFrameChannelValue(futureFrame, 'sit')).toBeNull();
    expect(getSensorFrameStageValue(futureFrame, 'decoded')).toBeNull();
    expect(isSensorFrameForDisplay(futureFrame, ['multi-demo'])).toBe(false);
  });

  it('复用 SDK v1 校验器约束版本、payload.value 和身份', () => {
    expect(isSensorFrameEnvelope({
      ...frame,
      payload: { ...frame.payload, value: [30, null, 40] },
    })).toBe(true);

    [
      { ...frame, schemaVersion: '1' },
      { ...frame, schemaVersion: undefined, version: 1 },
      { ...frame, payload: { ...frame.payload, value: '[30,40]' } },
      { ...frame, payload: { ...frame.payload, value: [30, '40'] } },
      { ...frame, payload: { ...frame.payload, value: [30, Number.NaN] } },
      { ...frame, payload: { ...frame.payload, value: [30, Number.POSITIVE_INFINITY] } },
      { ...frame, payload: { stages: { processed: [30, 40] } } },
      { ...frame, displaySystemId: ' multi-demo ' },
      { ...frame, sensorId: 'arm:Left', channelId: 'multi-demo:arm:Left' },
      { ...frame, channelId: 'other:armLeft' },
    ].forEach((malformed) => {
      expect(isSensorFrameEnvelope(malformed)).toBe(false);
    });
  });

  it('protocol 附加信息不能覆盖 canonical 路由身份', () => {
    const decoded = adaptSensorFrameForClient({
      ...frame,
      payload: {
        ...frame.payload,
        protocol: {
          frameIndex: 18,
          displaySystemId: 'forged-system',
          outputChannel: 'back',
          type: 'forged.type',
          payload: { value: [999] },
        },
      },
    });

    expect(decoded.frameIndex).toBe(18);
    expect(decoded.displaySystemId).toBe('multi-demo');
    expect(decoded.outputChannel).toBe('armLeft');
    expect(decoded.type).toBe('sensor.frame');
    expect(decoded.payload.value).toEqual([30, 40]);
  });

  it.each([
    { displaySystemId: '', channelId: 'multi-demo:armLeft' },
    { sensorId: '', channelId: 'multi-demo:armLeft' },
    { outputChannel: '' },
    { channelId: 'other-system:armLeft' },
  ])('canonical 身份缺失或冲突时 fail closed：%o', (identityPatch) => {
    const malformed = { ...frame, ...identityPatch };
    expect(isSensorFrameEnvelope(malformed)).toBe(false);
    expect(isSensorFrameForDisplay(malformed, ['multi-demo'])).toBe(false);
  });
});
