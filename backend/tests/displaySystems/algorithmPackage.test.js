const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildDisplaySystemBuilderCatalog,
  createDisplaySystemFrameAggregator,
  createDisplaySystemFrameProcessor,
  createPythonAlgorithmRunner,
  discoverBuiltinAlgorithmPackages,
  loadAlgorithmPackageManifest,
  loadDisplaySystemDirectory,
  validateAlgorithmPackageManifest,
} = require('../../extension-host');

(async () => {
  const packageManifest = {
    schemaVersion: 1,
    id: 'seat-balance',
    name: 'Seat Balance',
    version: '1.0.0',
    apiVersion: 2,
    language: 'python',
    entry: 'algorithm.py',
    runtime: { python: '3.11', profile: 'science-v1' },
    input: {
      mode: 'multi-sensor',
      sensors: ['seat', 'back'],
      triggerSensor: 'seat',
      sync: { strategy: 'strict', maxSkewMs: 20, maxAgeMs: 200 },
    },
    parameters: { threshold: 10 },
    resources: { model: 'models/model.bin' },
    output: { metrics: ['balance', 'state'] },
  };

  const validated = validateAlgorithmPackageManifest(packageManifest, { source: 'package' });
  assert.strictEqual(validated.ok, true, validated.errors.join('; '));
  assert.strictEqual(validated.value.input.triggerSensor, 'seat');
  assert.deepStrictEqual(validated.value.output.metrics, ['balance', 'state']);

  const builtinCatalog = discoverBuiltinAlgorithmPackages({
    roots: [path.resolve(__dirname, '../../../agent-resources/algorithm-packages')],
  });
  assert.deepStrictEqual(builtinCatalog.invalid, []);
  assert.deepStrictEqual(
    builtinCatalog.packages.map((item) => item.id).sort(),
    ['foot-pressure-realtime', 'mattress-vitals', 'pet-care', 'pet-care-mini'],
  );
  const mattressVitals = builtinCatalog.packages.find((item) => item.id === 'mattress-vitals');
  assert.strictEqual(mattressVitals.packageManifest.apiVersion, 2);
  assert.deepStrictEqual(mattressVitals.compatibility.matrixTotals, [1024]);
  assert.ok(mattressVitals.metricDefinitions.some((item) => item.id === 'respirationRate'));
  assert.match(mattressVitals.algorithmSource, /def process\(request\):/);

  const catalogWithPackages = buildDisplaySystemBuilderCatalog({
    algorithmPackages: builtinCatalog.packages,
  });
  assert.deepStrictEqual(
    catalogWithPackages.algorithmPackages.map((item) => item.id).sort(),
    ['foot-pressure-realtime', 'mattress-vitals', 'pet-care', 'pet-care-mini'],
  );

  const invalid = validateAlgorithmPackageManifest({
    ...packageManifest,
    apiVersion: 1,
    input: { ...packageManifest.input, triggerSensor: 'missing' },
  }, { source: 'invalid' });
  assert.strictEqual(invalid.ok, false);
  assert.ok(invalid.errors.includes('invalid: multi-sensor input requires apiVersion 2'));
  assert.ok(invalid.errors.includes('invalid: input.triggerSensor must reference input.sensors'));

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-algorithm-package-'));
  try {
    fs.mkdirSync(path.join(temporaryRoot, 'models'));
    fs.writeFileSync(path.join(temporaryRoot, 'algorithm.py'), 'def process(request):\n    return request["normalized_data"]\n');
    fs.writeFileSync(path.join(temporaryRoot, 'models', 'model.bin'), 'model');
    const manifestPath = path.join(temporaryRoot, 'algorithm-package.json');
    fs.writeFileSync(manifestPath, JSON.stringify(packageManifest));
    const loaded = loadAlgorithmPackageManifest(manifestPath);
    assert.strictEqual(loaded.ok, true, loaded.errors.join('; '));
    assert.strictEqual(loaded.value.resolvedEntry, path.join(temporaryRoot, 'algorithm.py'));
    assert.strictEqual(loaded.value.resolvedResources.model, path.join(temporaryRoot, 'models', 'model.bin'));

    const lineOrder = JSON.stringify({ order: [1, 2] });
    const pointOrder = JSON.stringify({ matrix: { rows: 1, cols: 2 }, points: [[0, 0], [0, 1]] });
    fs.writeFileSync(path.join(temporaryRoot, 'seat-line.json'), lineOrder);
    fs.writeFileSync(path.join(temporaryRoot, 'seat-points.json'), pointOrder);
    fs.writeFileSync(path.join(temporaryRoot, 'back-line.json'), lineOrder);
    fs.writeFileSync(path.join(temporaryRoot, 'back-points.json'), pointOrder);
    fs.writeFileSync(path.join(temporaryRoot, 'display-system.json'), JSON.stringify({
      schemaVersion: 3,
      id: 'fusion-demo',
      name: 'Fusion Demo',
      sensors: [
        {
          id: 'seat',
          type: 'seat',
          matrix: { rows: 1, cols: 2 },
          files: { lineOrder: 'seat-line.json', pointOrder: 'seat-points.json' },
          protocol: {
            baudRate: 115200,
            framing: { type: 'fixedLength', frameLength: 2 },
            decoding: { valueType: 'uint8', valueCount: 2 },
          },
          algorithm: { type: 'python', packageManifest: 'algorithm-package.json' },
        },
        {
          id: 'back',
          type: 'back',
          matrix: { rows: 1, cols: 2 },
          files: { lineOrder: 'back-line.json', pointOrder: 'back-points.json' },
          protocol: {
            baudRate: 115200,
            framing: { type: 'fixedLength', frameLength: 2 },
            decoding: { valueType: 'uint8', valueCount: 2 },
          },
        },
      ],
    }));
    const loadedSystem = loadDisplaySystemDirectory(temporaryRoot, { validateFiles: true });
    assert.strictEqual(loadedSystem.ok, true, loadedSystem.errors.join('; '));
    assert.strictEqual(loadedSystem.config.sensors[0].algorithm.apiVersion, 2);
    assert.strictEqual(loadedSystem.config.sensors[0].algorithm.package.id, 'seat-balance');
    assert.strictEqual(loadedSystem.config.sensors[0].resolvedFiles.algorithmEntry, path.join(temporaryRoot, 'algorithm.py'));
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }

  const calls = [];
  const runner = createPythonAlgorithmRunner({
    entry: '/algorithm.py',
    timeoutMs: 123,
    algorithmPackage: validated.value,
    callPython: async (fn, args, options) => {
      calls.push({ fn, args, options });
      return { data: args.context?.normalized_data || [], metrics: { ok: true } };
    },
  });
  await runner([1, 2], {
    normalizedData: [2, 1],
    frames: { seat: { normalizedData: [2, 1] } },
    timestamp: 100,
    identity: { sensorId: 'seat' },
  });
  await runner.reset('playback-seek');
  await runner.dispose();
  assert.deepStrictEqual(calls.map((call) => call.fn), [
    'run_display_system_algorithm',
    'reset_display_system_algorithm',
    'shutdown_display_system_algorithm',
  ]);
  assert.strictEqual(calls[0].args.api_version, 2);
  assert.deepStrictEqual(calls[0].args.context.frames.seat.normalizedData, [2, 1]);
  assert.strictEqual(calls[1].args.reason, 'playback-seek');
  await assert.rejects(() => runner([3]), { code: 'DISPLAY_ALGORITHM_DISPOSED' });

  const aggregator = createDisplaySystemFrameAggregator();
  aggregator.update({ displaySystemId: 'demo', sensorId: 'seat', timestamp: 100, normalizedData: [1] });
  assert.strictEqual(aggregator.buildSnapshot('demo', validated.value.input, 100).ready, false);
  aggregator.update({ displaySystemId: 'demo', sensorId: 'back', timestamp: 110, normalizedData: [2] });
  const aggregate = aggregator.buildSnapshot('demo', validated.value.input, 110);
  assert.strictEqual(aggregate.ready, true);
  assert.strictEqual(aggregate.skewMs, 10);
  assert.deepStrictEqual(aggregate.frames.seat.normalizedData, [1]);
  assert.strictEqual(aggregator.buildSnapshot('demo', validated.value.input, 500).reason, 'stale-sensors');

  const frameAggregator = createDisplaySystemFrameAggregator();
  const common = {
    displaySystemId: 'fusion-demo',
    protocol: null,
    display: { matrix: { rows: 1, cols: 2 } },
  };
  let receivedFrames = null;
  const seatProcessor = createDisplaySystemFrameProcessor({
    runtimeChannel: {
      ...common,
      id: 'fusion-demo:seat',
      serialRole: 'seat',
      outputChannel: 'seat',
      label: '座椅',
      sensor: { id: 'seat', type: 'seat', matrix: { rows: 1, cols: 2 } },
      processing: {
        lineOrder: { source: null },
        pointOrder: { source: null },
        algorithm: {
          type: 'python',
          entry: '/algorithm.py',
          enabled: true,
          package: validated.value,
        },
      },
    },
    frameAggregator,
    algorithmRunners: {
      python: async (rawData, context) => {
        receivedFrames = context.frames;
        return { data: context.normalizedData, metrics: { balance: 0.9 } };
      },
    },
  });
  const backProcessor = createDisplaySystemFrameProcessor({
    runtimeChannel: {
      ...common,
      id: 'fusion-demo:back',
      serialRole: 'back',
      outputChannel: 'back',
      label: '靠背',
      sensor: { id: 'back', type: 'back', matrix: { rows: 1, cols: 2 } },
      processing: {
        lineOrder: { source: null },
        pointOrder: { source: null },
        algorithm: { type: 'none', enabled: false },
      },
    },
    frameAggregator,
  });

  const waitingFrame = await seatProcessor.processFrame([1, 2], { timestamp: 100 });
  assert.strictEqual(waitingFrame.algorithm.inputStatus.ready, false);
  assert.strictEqual(receivedFrames, null);
  backProcessor.processFrame([3, 4], { timestamp: 105 });
  const fusedFrame = await seatProcessor.processFrame([5, 6], { timestamp: 110 });
  assert.strictEqual(fusedFrame.algorithm.inputStatus.ready, true);
  assert.deepStrictEqual(Object.keys(receivedFrames), ['seat', 'back']);
  assert.deepStrictEqual(fusedFrame.algorithmMetrics, { balance: 0.9 });

  console.log('algorithmPackage.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
