import { describe, expect, it } from 'vitest';
import {
  buildBuilderPortViews,
  buildBuilderSensorPlan,
  buildBuilderSensors,
  ensureBuilderPortWidgets,
} from './builderMultiSensor.js';

describe('display system builder multi-sensor mapping', () => {
  const ports = ['leftHand', 'rightHand', 'backrest', 'seat'];
  const portLabels = {
    leftHand: '左手',
    rightHand: '右手',
    backrest: '靠背',
    seat: '座椅',
  };

  it('derives four stable labels, sources and canonical channel ids', () => {
    const plan = buildBuilderSensorPlan({
      displaySystemId: 'four-zone',
      ports,
      portLabels,
    });

    expect(plan.map((sensor) => sensor.label)).toEqual(['左手', '右手', '靠背', '座椅']);
    expect(plan.map((sensor) => sensor.source)).toEqual([
      'leftHandData',
      'rightHandData',
      'backrestData',
      'seatData',
    ]);
    expect(plan.map((sensor) => sensor.channelId)).toEqual([
      'four-zone:leftHand',
      'four-zone:rightHand',
      'four-zone:backrest',
      'four-zone:seat',
    ]);
  });

  it('creates a complete schema-v3 sensor entry for every selected port', () => {
    const sensors = buildBuilderSensors({
      displaySystemId: 'four-zone',
      ports,
      portLabels,
      type: 'pressure-matrix',
      matrix: { rows: 2, cols: 3 },
      files: { lineOrder: 'line-order.json', pointOrder: 'point-order.json' },
      protocol: {
        baudRate: 921600,
        framing: { type: 'fixedLength', frameLength: 6 },
        decoding: { valueType: 'uint8', valueCount: 6 },
      },
      algorithm: { type: 'none' },
    });

    expect(sensors).toHaveLength(4);
    expect(sensors.map(({ id, label, outputChannel, stored }) => ({
      id,
      label,
      outputChannel,
      stored,
    }))).toEqual([
      { id: 'leftHand', label: '左手', outputChannel: 'leftHand', stored: true },
      { id: 'rightHand', label: '右手', outputChannel: 'rightHand', stored: true },
      { id: 'backrest', label: '靠背', outputChannel: 'backrest', stored: true },
      { id: 'seat', label: '座椅', outputChannel: 'seat', stored: true },
    ]);
    expect(sensors.every((sensor) => sensor.files.pointOrder === 'point-order.json')).toBe(true);
  });

  it('preserves valid explicit sources and adds one independent data widget per port', () => {
    const plan = buildBuilderSensorPlan({ ports, portLabels });
    const widgets = ensureBuilderPortWidgets({
      sensorPlan: plan,
      rendererId: 'heatmap',
      widgets: [
        { id: 'main', type: 'heatmap', source: 'rightHandData', label: '右手图' },
        { id: 'stats', type: 'pressureStats', source: 'seatData', label: '座椅统计' },
        { id: 'legacy', type: 'matrix', source: 'missingData', label: '旧数据' },
      ],
    });

    expect(widgets.find((widget) => widget.id === 'main')?.source).toBe('rightHandData');
    expect(widgets.find((widget) => widget.id === 'stats')?.source).toBe('seatData');
    expect(widgets.find((widget) => widget.id === 'legacy')?.source).toBe('leftHandData');
    const dataSources = new Set(
      widgets.filter((widget) => widget.type !== 'pressureStats').map((widget) => widget.source),
    );
    expect([...dataSources].sort()).toEqual([
      'backrestData',
      'leftHandData',
      'rightHandData',
      'seatData',
    ]);
  });

  it('generates a view for every renderer and every port while retaining the primary id', () => {
    const plan = buildBuilderSensorPlan({ ports, portLabels });
    const views = buildBuilderPortViews([
      { id: 'heatmap', type: 'heatmap', label: '热力图' },
    ], plan);

    expect(views.map((view) => view.id)).toEqual([
      'heatmap',
      'heatmap-rightHand',
      'heatmap-backrest',
      'heatmap-seat',
    ]);
    expect(views.map((view) => view.source)).toEqual(plan.map((sensor) => sensor.source));
  });
});
