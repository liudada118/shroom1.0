import { describe, expect, it } from 'vitest';
import {
  buildManifestSceneFrame,
  getManifestSourceChannel,
  getManifestSourceChannelId,
  getManifestSourceSensor,
  readManifestChannelFrames,
} from './manifestSceneAdapter';

const sensors = [
  {
    id: 'seat-pad',
    sensorId: 'seat-pad',
    label: '座椅',
    sensorLabel: '座椅',
    channelId: 'chair:seat-pad',
    outputChannel: 'seatPressure',
    serial: { role: 'seat-pad', baudRate: 921600 },
  },
  {
    id: 'back-pad',
    sensorId: 'back-pad',
    label: '靠背',
    sensorLabel: '靠背',
    channelId: 'chair:back-pad',
    outputChannel: 'backPressure',
    serial: { role: 'back-pad', baudRate: 115200 },
  },
];

describe('manifestSceneAdapter', () => {
  it('source 先解析 sensor，再得到完整 channelId，并保留 outputChannel 回退', () => {
    expect(getManifestSourceSensor('chair:back-pad', sensors)).toBe(sensors[1]);
    expect(getManifestSourceSensor('backPressure.metrics', sensors)).toBe(sensors[1]);
    expect(getManifestSourceChannel('back-pad', sensors)).toBe('backPressure');
    expect(getManifestSourceChannelId('backPressure', sensors, 'chair')).toBe('chair:back-pad');
  });

  it('canonical 帧只读取声明通道，并原样优先返回 channelId 与实时串口', () => {
    const frames = readManifestChannelFrames({
      type: 'sensor.frame',
      schemaVersion: 1,
      channelId: 'chair:back-pad',
      displaySystemId: 'chair',
      sensorId: 'back-pad',
      sensorLabel: '靠背',
      outputChannel: 'backPressure',
      serial: { role: 'back-pad', path: 'COM5', baudRate: 115200 },
      payload: {
        value: [30, 40],
        stages: { decoded: [1, 2], normalized: [10, 20] },
      },
      // canonical 不得因为这些兼容字段再拆出额外通道。
      sitData: [999],
    }, ['chair'], sensors);

    expect(frames).toEqual([expect.objectContaining({
      channelId: 'chair:back-pad',
      displaySystemId: 'chair',
      sensorId: 'back-pad',
      sensorLabel: '靠背',
      outputChannel: 'backPressure',
      renderValues: [30, 40],
      rawValues: [1, 2],
      normalizedValues: [10, 20],
      serial: expect.objectContaining({ path: 'COM5', role: 'back-pad' }),
    })]);
  });

  it('legacy 合并消息仅在兼容分支拆通道，并补成各自 channelId 与标签', () => {
    const legacySensors = [
      { ...sensors[0], outputChannel: 'sit' },
      { ...sensors[1], outputChannel: 'back' },
    ];
    const frames = readManifestChannelFrames({
      sitData: [1, 2],
      backData: [3, 4],
    }, ['chair'], legacySensors);

    expect(frames.map((frame) => ({
      channelId: frame.channelId,
      sensorLabel: frame.sensorLabel,
      outputChannel: frame.outputChannel,
      renderValues: frame.renderValues,
    }))).toEqual([
      {
        channelId: 'chair:seat-pad',
        sensorLabel: '座椅',
        outputChannel: 'sit',
        renderValues: [1, 2],
      },
      {
        channelId: 'chair:back-pad',
        sensorLabel: '靠背',
        outputChannel: 'back',
        renderValues: [3, 4],
      },
    ]);
  });

  it('场景帧携带侧栏所选通道的完整身份', () => {
    const frame = buildManifestSceneFrame({
      type: 'sensor.frame',
      schemaVersion: 1,
      channelId: 'chair:seat-pad',
      displaySystemId: 'chair',
      sensorId: 'seat-pad',
      sensorLabel: '座椅',
      outputChannel: 'seatPressure',
      serial: { path: 'COM4' },
      payload: { value: [8, 9], stages: { normalized: [8, 9] } },
    }, {
      source: 'manifest',
      displaySystemId: 'chair',
      type: 'chair-test',
      sensors,
      matrix: { rows: 1, cols: 2, total: 2 },
      page: { sidebar: { source: 'seat-pad' } },
    });

    expect(frame).toMatchObject({
      channelId: 'chair:seat-pad',
      sensorId: 'seat-pad',
      sensorLabel: '座椅',
      outputChannel: 'seatPressure',
      serial: { path: 'COM4' },
    });
  });
});
