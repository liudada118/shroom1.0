import { describe, expect, it } from 'vitest';
import { registerRuntimeDisplayDefinition } from './registry';

describe('runtime display registry', () => {
  it('按 serialRole 关联 sensors 与 runtimeChannels，并保留通道和串口定义', () => {
    const leftParser = { id: 'glove-test:left-hand', role: 'left-hand' };
    const rightParser = { id: 'glove-test:right-hand', role: 'right-hand' };
    const definition = registerRuntimeDisplayDefinition({
      displayMetadata: {
        id: 'glove-test',
        name: '双手套',
        sensorType: 'runtime-registry-multichannel-test',
        sensors: [
          {
            id: 'left-hand',
            label: '左手',
            outputChannel: 'leftPressure',
            matrix: { rows: 1, cols: 2, total: 2 },
          },
          {
            id: 'right-hand',
            label: '右手',
            outputChannel: 'rightPressure',
            matrix: { rows: 1, cols: 3, total: 3 },
          },
        ],
      },
      sensorDefinition: { type: 'runtime-registry-multichannel-test' },
      // 故意逆序，证明关联不依赖数组下标。
      runtimeChannels: [
        {
          id: 'glove-test:right-hand',
          serialRole: 'right-hand',
          label: '右手',
          outputChannel: 'rightPressure',
          baudRate: 460800,
          parserChannel: rightParser,
        },
        {
          id: 'glove-test:left-hand',
          serialRole: 'left-hand',
          label: '左手',
          outputChannel: 'leftPressure',
          protocol: { baudRate: 115200 },
          parserChannel: leftParser,
          serial: { path: 'COM3', status: 'open' },
        },
      ],
    });

    expect(definition.channels).toEqual(['leftPressure', 'rightPressure']);
    expect(definition.sensors).toHaveLength(2);
    expect(definition.sensors[0]).toMatchObject({
      sensorId: 'left-hand',
      sensorLabel: '左手',
      channelId: 'glove-test:left-hand',
      outputChannel: 'leftPressure',
      serialRole: 'left-hand',
      baudRate: 115200,
      parser: leftParser,
      matrix: { rows: 1, cols: 2, total: 2 },
      serial: {
        role: 'left-hand',
        path: 'COM3',
        status: 'open',
        baudRate: 115200,
        parser: leftParser,
      },
    });
    expect(definition.sensors[1]).toMatchObject({
      sensorId: 'right-hand',
      sensorLabel: '右手',
      channelId: 'glove-test:right-hand',
      outputChannel: 'rightPressure',
      baudRate: 460800,
      parser: rightParser,
    });
  });
});
