import { describe, expect, it } from 'vitest';
import { readManifestChannelFrames } from './manifestSceneAdapter.js';
import {
  buildManifestWidgetLabel,
  reduceManifestChannelFrames,
} from './manifestChannelState.js';

const displaySystemId = 'body-four-zone';
const sensors = [
  { id: 'left-hand', label: '左手', outputChannel: 'leftPressure' },
  { id: 'right-hand', label: '右手', outputChannel: 'rightPressure' },
  { id: 'backrest', label: '靠背', outputChannel: 'backPressure' },
  { id: 'seat', label: '座椅', outputChannel: 'seatPressure' },
].map((sensor) => ({
  ...sensor,
  sensorId: sensor.id,
  sensorLabel: sensor.label,
  channelId: `${displaySystemId}:${sensor.id}`,
  serial: { role: sensor.id },
}));

function messageFor(sensorId, value, path) {
  const sensor = sensors.find((item) => item.id === sensorId);
  return {
    type: 'sensor.frame',
    schemaVersion: 1,
    channelId: sensor.channelId,
    displaySystemId,
    sensorId: sensor.id,
    sensorLabel: sensor.label,
    outputChannel: sensor.outputChannel,
    serial: { role: sensor.id, path, isOpen: true },
    payload: {
      value: [value],
      stages: { decoded: [value - 2], normalized: [value - 1] },
    },
  };
}

describe('manifest channel state', () => {
  it('四路帧乱序到达仍按 channelId 独立保存，COM 重连不会串路', () => {
    const shuffledMessages = [
      messageFor('backrest', 30, 'COM7'),
      messageFor('left-hand', 10, 'COM3'),
      messageFor('seat', 40, 'COM8'),
      messageFor('right-hand', 20, 'COM4'),
    ];
    const initialState = shuffledMessages.reduce((state, message) => (
      reduceManifestChannelFrames(
        state,
        readManifestChannelFrames(message, [displaySystemId], sensors),
      )
    ), {});

    expect(Object.keys(initialState).sort()).toEqual(sensors.map((sensor) => sensor.channelId).sort());
    expect(initialState['body-four-zone:left-hand']).toMatchObject({
      sensorLabel: '左手',
      renderValues: [10],
      normalizedValues: [9],
      serial: { role: 'left-hand', path: 'COM3' },
    });
    expect(initialState['body-four-zone:right-hand'].serial.path).toBe('COM4');
    expect(initialState['body-four-zone:backrest'].serial.path).toBe('COM7');
    expect(initialState['body-four-zone:seat'].serial.path).toBe('COM8');

    const reconnectedState = reduceManifestChannelFrames(
      initialState,
      readManifestChannelFrames(
        messageFor('right-hand', 25, 'COM11'),
        [displaySystemId],
        sensors,
      ),
    );

    expect(reconnectedState['body-four-zone:right-hand']).toMatchObject({
      sensorLabel: '右手',
      renderValues: [25],
      serial: { role: 'right-hand', path: 'COM11' },
    });
    expect(reconnectedState['body-four-zone:left-hand']).toBe(initialState['body-four-zone:left-hand']);
    expect(reconnectedState['body-four-zone:left-hand'].serial.path).toBe('COM3');
    expect(reconnectedState['body-four-zone:backrest'].serial.path).toBe('COM7');
    expect(reconnectedState['body-four-zone:seat'].serial.path).toBe('COM8');
  });

  it('标题显示业务名和当前 COM，并去掉重复业务名', () => {
    expect(buildManifestWidgetLabel('压力热力图', {
      sensorLabel: '左手',
      serial: { path: 'COM3' },
    })).toBe('压力热力图 · 左手 · COM3');
    expect(buildManifestWidgetLabel('左手', {
      sensorLabel: '左手',
      serial: { path: 'COM3' },
    })).toBe('左手 · COM3');
  });
});
