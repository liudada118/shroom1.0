const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../client/src/components/displaySystem/displayProfileRuntime.js'
  );
  const {
    applyVisualizationAlgorithm,
    buildDisplayProfileModel,
    calculatePressureMetrics,
    resolveDisplayProfile,
  } = await import(pathToFileURL(modulePath).href);

  assert.deepStrictEqual(
    applyVisualizationAlgorithm([2, 10, 20], { type: 'threshold', options: { threshold: 10 } }),
    [0, 10, 20]
  );
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

  console.log('displayProfileRuntime.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
