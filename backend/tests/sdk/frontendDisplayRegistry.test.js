const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const modulePath = path.resolve(__dirname, '../../../sdk/frontend/src/display/DisplayRegistry.js');
  const {
    DisplayRegistry,
    createDisplaySystemFromManifest,
  } = await import(pathToFileURL(modulePath).href);

  const manifest = {
    id: 'custom-seat',
    name: 'Custom Seat',
    sensor: {
      type: 'customSeat',
      matrix: { rows: 2, cols: 3 },
      ports: ['sit'],
    },
    protocol: {
      baudRate: 921600,
      framing: { type: 'fixedLength', frameLength: 6 },
    },
    display: {
      layout: { type: 'grid', columns: 12 },
      views: [
        { id: 'pressure', type: 'heatmap', source: 'data' },
        { id: 'stats', type: 'pressureStats', source: 'metrics' },
      ],
      defaultView: 'pressure',
      renderers: [{ id: 'heat', type: 'heatmap', label: 'Heat' }],
      visualizationAlgorithms: [{ id: 'raw', type: 'identity', label: 'Raw' }],
      profiles: [{
        id: 'overview',
        label: 'Overview',
        renderer: 'heat',
        visualizationAlgorithm: 'raw',
        widgets: ['pressure', 'stats'],
      }],
      defaultProfile: 'overview',
      controls: { serial: true },
      sidebar: {
        source: 'sitData',
        pressure: { visible: true, primaryMetric: 'totalPressure' },
        area: { visible: true, threshold: 5, pointArea: 2.1 },
      },
    },
  };

  const system = createDisplaySystemFromManifest(manifest);
  assert.strictEqual(system.key, 'customSeat');
  assert.strictEqual(system.defaultMode, 'pressure');
  assert.strictEqual(system.renderers.pressure, 'Heatmap');
  assert.strictEqual(system.page.widgets.length, 2);
  assert.strictEqual(system.protocol.baudRate, 921600);
  assert.strictEqual(system.defaultProfile, 'overview');
  assert.strictEqual(system.visualizationAlgorithms[0].type, 'identity');
  assert.strictEqual(system.page.sidebar.area.pointArea, 2.1);

  const registry = new DisplayRegistry();
  registry.registerManifest(manifest);
  assert.strictEqual(registry.get('customSeat').displaySystemId, 'custom-seat');
  assert.deepStrictEqual(registry.getModes('customSeat'), ['pressure', 'stats']);
  assert.strictEqual(registry.getProfiles('customSeat')[0].id, 'overview');
  assert.strictEqual(registry.getProfile('customSeat').renderer, 'heat');

  console.log('frontendDisplayRegistry.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
