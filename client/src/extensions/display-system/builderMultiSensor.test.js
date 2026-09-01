import { describe, expect, it } from 'vitest';
import {
  buildBuilderPortViews,
  buildBuilderSensorFilePath,
  buildBuilderSensorDrafts,
  buildBuilderSensorPlan,
  buildBuilderSensors,
  ensureBuilderPortWidgets,
  getInvalidBuilderSensorIds,
  normalizeBuilderSensorIds,
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

  it('normalizes custom tag ids, deduplicates them, and reports unsafe ids', () => {
    expect(normalizeBuilderSensorIds([
      ' left-hand ',
      'right_hand',
      'left-hand',
      'seat.2',
      '../escape',
      '中文',
      '',
    ], { fallback: false })).toEqual(['left-hand', 'right_hand', 'seat.2']);
    expect(getInvalidBuilderSensorIds(['left-hand', '../escape', '中文', '../escape']))
      .toEqual(['../escape', '中文']);
    expect(buildBuilderSensorFilePath('left-hand', 'point-order.json', { multiple: true }))
      .toBe('left-hand/point-order.json');
    expect(buildBuilderSensorFilePath('left-hand', 'point-order.json')).toBe('point-order.json');
  });

  it('treats outputChannel aliases as covered widget sources', () => {
    const plan = buildBuilderSensorPlan({
      ports: ['left', 'seat'],
      sensors: [
        { id: 'left', outputChannel: 'leftPressure' },
        { id: 'seat', outputChannel: 'seatPressure' },
      ],
    });
    const widgets = ensureBuilderPortWidgets({
      sensorPlan: plan,
      widgets: [{ id: 'seat-card', type: 'heatmap', source: 'seatPressure' }],
    });
    expect(widgets.find((widget) => widget.id === 'seat-card')?.source).toBe('seatPressure');
    expect(widgets.filter((widget) => widget.type !== 'pressureStats')).toHaveLength(2);
  });

  it('round-trips heterogeneous v3 sensor fields without projecting the first sensor over the rest', () => {
    const editor = {
      manifest: {
        schemaVersion: 3,
        id: 'heterogeneous',
        sensors: [
          {
            id: 'left-hand',
            label: '左手',
            outputChannel: 'leftPressure',
            type: 'glove',
            matrix: { rows: 2, cols: 2 },
            files: { lineOrder: 'left/line.json', pointOrder: 'left/points.json' },
            protocol: {
              baudRate: 921600,
              framing: { type: 'fixedLength', frameLength: 4 },
              decoding: { valueType: 'uint8', valueCount: 4 },
            },
            algorithm: { type: 'none' },
            stored: true,
          },
          {
            id: 'seat',
            label: '座椅',
            outputChannel: 'seatPressure',
            type: 'seat',
            matrix: { rows: 1, cols: 3 },
            files: { lineOrder: 'seat/line.json', pointOrder: 'seat/points.json' },
            protocol: {
              baudRate: 115200,
              framing: { type: 'delimiter', delimiter: [170, 85] },
              decoding: { valueType: 'uint16le', byteOffset: 2, valueCount: 3 },
            },
            algorithm: { type: 'json', dataFile: 'seat/algorithm.json', timeoutMs: 250 },
            stored: false,
          },
        ],
      },
      definitions: {
        lineOrder: { order: [1, 2, 3, 4] },
        sensors: {
          'left-hand': {
            lineOrder: { order: [1, 2, 3, 4] },
            pointOrder: { matrix: { rows: 2, cols: 2 }, points: [[0, 0], [0, 1], [1, 0], [1, 1]] },
          },
          seat: {
            lineOrder: { order: [3, 2, 1] },
            pointOrder: { matrix: { rows: 1, cols: 3 }, points: [[0, 0], [0, 1], [0, 2]] },
            algorithmData: { scale: 2 },
          },
        },
      },
    };
    const drafts = buildBuilderSensorDrafts(editor);
    const sensors = buildBuilderSensors({
      displaySystemId: editor.manifest.id,
      ports: drafts.map((draft) => draft.id),
      portLabels: Object.fromEntries(drafts.map((draft) => [draft.id, draft.sensor.label])),
      sensorDrafts: drafts,
    });

    expect(sensors).toEqual(editor.manifest.sensors);
    expect(drafts[1].definitions).toEqual(editor.definitions.sensors.seat);
    expect(buildBuilderSensorPlan({
      displaySystemId: editor.manifest.id,
      ports: drafts.map((draft) => draft.id),
      sensors,
    }).map(({ outputChannel, source }) => ({ outputChannel, source }))).toEqual([
      { outputChannel: 'leftPressure', source: 'leftPressureData' },
      { outputChannel: 'seatPressure', source: 'seatPressureData' },
    ]);
  });
});
