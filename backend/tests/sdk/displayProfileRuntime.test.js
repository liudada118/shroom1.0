const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../client/src/extensions/display-system/displayProfileRuntime.js'
  );
  const {
    applyVisualizationAlgorithm,
    buildDisplayProfileModel,
    calculatePressureMetrics,
    resolveChartAppearance,
    resolveDisplayProfile,
  } = await import(pathToFileURL(modulePath).href);
  const coordinateLayoutModulePath = path.resolve(
    __dirname,
    '../../../client/src/extensions/display-system/coordinatePointLayout.js'
  );
  const {
    buildCoordinatePointLayout,
    buildCoordinateWorldLayout,
  } = await import(pathToFileURL(coordinateLayoutModulePath).href);
  const matrixTransformModulePath = path.resolve(
    __dirname,
    '../../../client/src/displays/matrixTransform.js'
  );
  const {
    applyMatrixTransform,
    deriveTransformedMatrix,
    transformCoordinateMap,
  } = await import(pathToFileURL(matrixTransformModulePath).href);
  const manifestSceneAdapterPath = path.resolve(
    __dirname,
    '../../../client/src/extensions/display-system/manifestSceneAdapter.js'
  );
  const {
    buildManifestSceneFrame,
    getManifestSourceChannel,
    isManifestFrameForDefinition,
    readManifestChannelFrame,
    readManifestChannelFrames,
  } = await import(pathToFileURL(manifestSceneAdapterPath).href);

  assert.deepStrictEqual(
    applyVisualizationAlgorithm([2, 10, 20], { type: 'threshold', options: { threshold: 10 } }),
    [0, 10, 20]
  );

  const coordinateLayout = buildCoordinatePointLayout([
    [[10, 30], [20, 30]],
    [[12, 10], [18, 10]],
  ]);
  assert.strictEqual(coordinateLayout.rows, 2);
  assert.strictEqual(coordinateLayout.cols, 2);
  assert.strictEqual(coordinateLayout.pointCount, 4);
  assert.deepStrictEqual(coordinateLayout.bounds, {
    minX: 10,
    maxX: 20,
    minY: 10,
    maxY: 30,
    width: 10,
    height: 20,
  });
  assert.ok(coordinateLayout.points[0].displayY < coordinateLayout.points[2].displayY);
  assert.strictEqual(buildCoordinatePointLayout([[[0, 0]]]), null);
  assert.deepStrictEqual(
    deriveTransformedMatrix(
      { rows: 2, cols: 2 },
      { type: 'interpolate', factor: 2 },
    ),
    { rows: 4, cols: 4, width: 4, height: 4, total: 16 },
  );
  const interpolated = applyMatrixTransform(
    [0, 10, 20, 30],
    { rows: 2, cols: 2 },
    { type: 'interpolate', factor: 2 },
  );
  assert.strictEqual(interpolated.values.length, 16);
  assert.strictEqual(interpolated.values[0], 0);
  assert.strictEqual(interpolated.values[15], 30);
  const downsampled = applyMatrixTransform(
    Array.from({ length: 16 }, (_, index) => index),
    { rows: 4, cols: 4 },
    { type: 'downsample', factor: 0.5 },
  );
  assert.deepStrictEqual(downsampled.values, [2.5, 4.5, 10.5, 12.5]);
  const transformedCoordinates = transformCoordinateMap([
    [[0, 1], [1, 1]],
    [[0, 0], [1, 0]],
  ], { type: 'interpolate', factor: 2 });
  assert.strictEqual(transformedCoordinates.length, 4);
  assert.strictEqual(transformedCoordinates[0].length, 4);
  const worldLayout = buildCoordinateWorldLayout([
    [[10, 30], [20, 30]],
    [[12, 10], [18, 10]],
  ]);
  assert.strictEqual(worldLayout.pointCount, 4);
  assert.strictEqual(worldLayout.points[0].index, 0);
  assert.strictEqual(worldLayout.points[3].index, 3);
  const worldHeight = Math.max(...worldLayout.points.map((point) => point.worldY))
    - Math.min(...worldLayout.points.map((point) => point.worldY));
  assert.ok(Math.abs(worldHeight - 1.8) < 1e-9);

  const manifestDefinition = {
    source: 'manifest',
    displaySystemId: 'custom-seat',
    page: {
      sidebar: {
        source: 'sitData',
        area: { threshold: 5, pointArea: 2.5 },
      },
    },
  };
  const manifestWireFrame = {
    type: 'sensor.frame',
    schemaVersion: 1,
    channelId: 'custom-seat:sit',
    displaySystemId: 'custom-seat',
    sensorId: 'sit',
    outputChannel: 'sit',
    payload: {
      value: [0, 30, 60],
      stages: {
        decoded: [9, 8, 7],
        normalized: [0, 10, 20],
      },
      algorithmMetrics: { score: 90 },
    },
  };
  const manifestFrame = buildManifestSceneFrame(manifestWireFrame, manifestDefinition);
  assert.deepStrictEqual(manifestFrame.renderValues, [0, 30, 60]);
  assert.deepStrictEqual(manifestFrame.rawValues, [9, 8, 7]);
  assert.deepStrictEqual(manifestFrame.normalizedValues, [0, 10, 20]);
  assert.deepStrictEqual(manifestFrame.metrics, {
    totalPressure: 30,
    maxPressure: 20,
    averagePressure: 15,
    activePoints: 2,
    area: 5,
  });
  assert.deepStrictEqual(manifestFrame.algorithmMetrics, { score: 90 });
  assert.strictEqual(getManifestSourceChannel('armLeftData', [
    { id: 'left-arm', outputChannel: 'armLeft' },
  ]), 'armLeft');
  assert.strictEqual(readManifestChannelFrame({
    ...manifestWireFrame,
    displaySystemId: 'other-system',
  }, 'custom-seat'), null);
  const legacyManifestFrame = readManifestChannelFrame({
    sitData: '[1,2]',
    normalizedData: [3, 4],
  }, 'custom-seat');
  assert.strictEqual(legacyManifestFrame.channel, 'sit');
  assert.deepStrictEqual(legacyManifestFrame.renderValues, [1, 2]);
  assert.deepStrictEqual(legacyManifestFrame.normalizedValues, [3, 4]);
  const combinedLegacyFrames = readManifestChannelFrames({
    sitData: [],
    backData: [2],
  }, 'custom-seat');
  assert.deepStrictEqual(
    combinedLegacyFrames.map(({ channel, renderValues }) => ({ channel, renderValues })),
    [
      { channel: 'sit', renderValues: [] },
      { channel: 'back', renderValues: [2] },
    ],
  );
  assert.strictEqual(isManifestFrameForDefinition({
    displaySystemId: 'other-system',
  }, manifestDefinition), false);
  assert.strictEqual(buildManifestSceneFrame({
    ...manifestWireFrame,
    displaySystemId: 'other-system',
  }, manifestDefinition), null);
  assert.deepStrictEqual(
    applyVisualizationAlgorithm([0, 5, 10], { type: 'normalize', options: { max: 100 } }),
    [0, 50, 100]
  );
  assert.deepStrictEqual(
    applyVisualizationAlgorithm([1, 2, 3, 4], { type: 'smooth', options: { radius: 1 } }, { cols: 2, rows: 2 }),
    [2.5, 2.5, 2.5, 2.5]
  );
  assert.deepStrictEqual(
    calculatePressureMetrics([0, 5, 10, 20], {
      area: { threshold: 5, pointArea: 2.5 },
    }),
    {
      totalPressure: 35,
      maxPressure: 20,
      averagePressure: 17.5,
      activePoints: 2,
      area: 5,
    }
  );

  const model = buildDisplayProfileModel({
    widgets: [
      { id: 'pressure', type: 'heatmap' },
      { id: 'stats', type: 'pressureStats' },
    ],
    renderers: [
      { id: 'heat', type: 'heatmap', label: 'Heat' },
      { id: 'numbers', type: 'matrix', label: 'Numbers' },
    ],
    visualizationAlgorithms: [
      { id: 'raw', type: 'identity', label: 'Raw' },
      { id: 'filtered', type: 'threshold', label: 'Filtered', options: { threshold: 5 } },
    ],
    profiles: [{
      id: 'analysis',
      label: 'Analysis',
      renderer: 'numbers',
      visualizationAlgorithm: 'filtered',
      widgets: ['pressure'],
    }],
    defaultProfile: 'analysis',
  });
  const selection = resolveDisplayProfile(model);
  assert.strictEqual(selection.profileId, 'analysis');
  assert.strictEqual(selection.renderer.type, 'matrix');
  assert.strictEqual(selection.algorithm.type, 'threshold');
  assert.deepStrictEqual([...selection.visibleWidgetIds], ['pressure']);

  // display.canvas 缺省时按顶层 widgets 反推，配色回落 classic、叠加层为空，
  // 也就是引入画布配置之前的行为。
  assert.deepStrictEqual(selection.colormap, { id: 'classic', reverse: false });
  assert.deepStrictEqual([...selection.overlays], []);
  assert.deepStrictEqual(
    selection.canvasWidgets.map((widget) => widget.id),
    ['pressure', 'stats'],
  );

  // 三层覆盖：manifest 顶层 < profile < 用户偏好。
  const canvasModel = buildDisplayProfileModel({
    widgets: [{ id: 'pressure', type: 'heatmap' }],
    renderers: [{ id: 'heat', type: 'heatmap', label: 'Heat' }],
    visualizationAlgorithms: [{ id: 'raw', type: 'identity', label: 'Raw' }],
    canvas: {
      colormap: { id: 'thermal' },
      overlays: ['legend', 'nope', 'legend'],
      widgets: [{ id: 'pressure', type: 'heatmap' }],
    },
    profiles: [{
      id: 'analysis',
      label: 'Analysis',
      renderer: 'heat',
      visualizationAlgorithm: 'raw',
      canvas: { colormap: { id: 'viridis', reverse: true } },
    }],
    defaultProfile: 'analysis',
  });
  // 未知 overlay 名在归一时被丢弃，重复项去重。
  assert.deepStrictEqual(canvasModel.canvas.overlays, ['legend']);
  assert.strictEqual(canvasModel.canvas.colormap.id, 'thermal');

  const profileCanvas = resolveDisplayProfile(canvasModel);
  // profile 只覆盖了配色，叠加层仍取 manifest 顶层。
  assert.deepStrictEqual(profileCanvas.colormap, { id: 'viridis', reverse: true });
  assert.deepStrictEqual([...profileCanvas.overlays], ['legend']);

  const userCanvas = resolveDisplayProfile(canvasModel, {
    profileId: 'analysis',
    canvas: {
      colormap: { id: 'grayscale' },
      overlays: ['gridLines'],
      widgets: [
        { id: 'pressure', type: 'heatmap' },
        { id: 'stats', type: 'pressureStats' },
      ],
    },
  });
  assert.strictEqual(userCanvas.colormap.id, 'grayscale');
  assert.deepStrictEqual([...userCanvas.overlays], ['gridLines']);
  // 用户自己拖进来的 widget 不在 profile.widgets 里，但必须照样可见，
  // 否则拖上去的卡片会被可见性过滤悄悄吃掉。
  assert.deepStrictEqual([...userCanvas.visibleWidgetIds].sort(), ['pressure', 'stats']);

  // 坏偏好只该退回默认外观，不该把展示系统卡死。
  const brokenCanvas = resolveDisplayProfile(canvasModel, {
    profileId: 'analysis',
    canvas: { colormap: { id: 'no-such-colormap' }, overlays: ['bogus'] },
  });
  assert.strictEqual(brokenCanvas.colormap.id, 'classic');
  assert.deepStrictEqual([...brokenCanvas.overlays], []);

  // 图表外观是独立表面：没存过就是"改动前的样子"，
  // 换画布配色也不该把曲线一起带走。
  const emptyChart = resolveChartAppearance(canvasModel);
  assert.strictEqual(emptyChart.colormap.id, 'classic');
  assert.deepStrictEqual(emptyChart.overlays, []);
  const isolatedChart = resolveChartAppearance(canvasModel, {
    canvas: { colormap: { id: 'viridis' }, overlays: ['legend'] },
  });
  assert.strictEqual(isolatedChart.colormap.id, 'classic');
  assert.deepStrictEqual(isolatedChart.overlays, []);
  const savedChart = resolveChartAppearance(canvasModel, {
    charts: { colormap: { id: 'inferno', reverse: true }, overlays: ['gridLines', 'peakMarker'] },
  });
  assert.strictEqual(savedChart.colormap.id, 'inferno');
  assert.strictEqual(savedChart.colormap.reverse, true);
  assert.deepStrictEqual(savedChart.overlays, ['gridLines', 'peakMarker']);
  // 坏偏好同样归一丢弃，一个过期的键值不能让侧栏画不出来。
  // `legend` 在图表这块表面上就是非法的 —— 300x150 的画布放不下色带。
  const brokenChart = resolveChartAppearance(canvasModel, {
    charts: { colormap: 'no-such-colormap', overlays: ['bogus', 'legend', 'axes', 'axes'] },
  });
  assert.strictEqual(brokenChart.colormap.id, 'classic');
  assert.deepStrictEqual(brokenChart.overlays, ['axes']);

  // manifest 可以声明图表默认外观，用户偏好盖在它上面、逐字段合并。
  const chartBaseModel = buildDisplayProfileModel({
    widgets: [{ id: 'pressure', type: 'heatmap' }],
    chartAppearance: { colormap: 'viridis', overlays: ['gridLines', 'legend'] },
  });
  const manifestChart = resolveChartAppearance(chartBaseModel);
  assert.strictEqual(manifestChart.colormap.id, 'viridis');
  // 声明里的 legend 在归一时就被丢掉了，不会漏到运行时。
  assert.deepStrictEqual(manifestChart.overlays, ['gridLines']);
  // 只换配色时，manifest 声明的叠加层仍然生效 —— 和 canvas 那层同一套语义。
  const mergedChart = resolveChartAppearance(chartBaseModel, {
    charts: { colormap: 'inferno' },
  });
  assert.strictEqual(mergedChart.colormap.id, 'inferno');
  assert.deepStrictEqual(mergedChart.overlays, ['gridLines']);

  console.log('displayProfileRuntime.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
