const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { loadDisplaySystemDirectory } = require('../../extension-host/manifest/displaySystemConfigLoader');
const { exportManifestPackage, exportNativePackage, installManifestPackage, installNativePackage } = require('../../extension-host/workspace/systemPackageService');
const { createRealtimeAlgorithmCatalog } = require('../../agent-runtime/algorithm-lab/realtimeCatalog');
const { createManifestAlgorithmBindings } = require('../../extension-host/workspace/manifestAlgorithmBindings');
const { createBuiltinSystemTemplates } = require('../../extension-host/workspace/builtinSystemTemplates');
const { createAppRuntime } = require('../../extension-host/appRuntimeFactory');
const { realtimePackage } = require('../../agent-runtime/algorithm-lab/realtimeCatalog');

/** 读取真实 1024 输入、529 展示的坐垫配置以覆盖发布前后的线序契约。 */
function sampleSystem() {
  const directory = path.resolve(__dirname, '../../../display-systems/seatpad2');
  const loaded = loadDisplaySystemDirectory(directory);
  assert.equal(loaded.ok, true);
  return { ...loaded.config, editable: true };
}

/** 重算测试包摘要，证明即使重新计算摘要也不能越过路径检查。 */
function digest(input) {
  const { sha256, ...payload } = input;
  return { ...payload, sha256: createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
}

test('a managed package preserves raw 1024 input and 529-point display mapping', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-system-package-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const original = sampleSystem();
  const exported = exportManifestPackage(original);
  assert.equal(exported.systemId, 'seatpad2');
  assert.equal(exported.files.some((file) => file.path === 'sit/line-order.json'), true);
  const installed = installManifestPackage(exported, { managedRoot: root });
  const loaded = loadDisplaySystemDirectory(installed.directory);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.config.sensors[0].protocol.decoding.valueCount, 1024);
  assert.equal(loaded.config.sensors[0].matrix.rows * loaded.config.sensors[0].matrix.cols, 529);
  assert.equal(fs.readFileSync(path.join(installed.directory, 'sit/line-order.json'), 'utf8'),
    fs.readFileSync(path.join(path.dirname(original.manifestPath), 'sit/line-order.json'), 'utf8'));
});

test('corrupt content, traversal and local ID collisions leave the installed version intact', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-system-package-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = exportManifestPackage(sampleSystem());
  installManifestPackage(input, { managedRoot: root });
  const original = fs.readFileSync(path.join(root, 'seatpad2/display-system.json'), 'utf8');
  const corrupt = structuredClone(input);
  corrupt.files[0].contentBase64 = Buffer.from('bad').toString('base64');
  assert.throws(() => installManifestPackage(corrupt, { managedRoot: root }), { code: 'SYSTEM_PACKAGE_INTEGRITY' });
  const traversal = structuredClone(input);
  traversal.files[0].path = '../outside.json';
  assert.throws(() => installManifestPackage(digest(traversal), { managedRoot: root }), { code: 'SYSTEM_PACKAGE_PATH_INVALID' });
  assert.throws(() => installManifestPackage(input, { managedRoot: root, isOccupied: () => true }), { code: 'SYSTEM_PACKAGE_CONFLICT' });
  assert.equal(fs.readFileSync(path.join(root, 'seatpad2/display-system.json'), 'utf8'), original);
  assert.equal(fs.existsSync(path.join(root, 'outside.json')), false);
});

test('a saved restricted classifier and chart remain bound after managed installation', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-system-algorithm-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const installedAlgorithmRoot = path.join(root, 'agent/algorithm-lab/installed');
  fs.mkdirSync(installedAlgorithmRoot, { recursive: true });
  const source = 'def predict(f):\n    return 0';
  const draft = { id: 'gesture', systemId: 'seatpad2', name: '动作识别', language: 'restricted-python-v1',
    source, labels: ['抚摸', '拍打'], windowFrames: 16,
    report: { inputContract: { stage: 'data', pointCount: 529, sampleIntervalMs: 20 },
      sourceDigest: createHash('sha256').update(JSON.stringify(source)).digest('hex') } };
  fs.writeFileSync(path.join(installedAlgorithmRoot, 'gesture.json'), JSON.stringify(draft));
  const configuration = { algorithms: [{ packageId: 'user-gesture', sensorId: 'sit', enabled: true }],
    charts: [{ id: 'gesture', name: '动作识别', packageId: 'user-gesture', metricId: 'classIndex', color: '#20B486', decimals: 0 }] };
  const input = exportManifestPackage(sampleSystem(), { bindings: { configuration }, installedAlgorithmRoot });
  const managedRoot = path.join(root, 'managed-display-systems');
  installManifestPackage(input, { managedRoot });
  const catalog = createRealtimeAlgorithmCatalog(path.join(root, 'customer-agent'), { managedRoot });
  assert.equal(catalog.list()[0].id, 'user-gesture');
  const system = { ...loadDisplaySystemDirectory(path.join(managedRoot, 'seatpad2')).config, managed: true, editable: false };
  const bindings = createManifestAlgorithmBindings({ root: path.join(root, 'user-bindings'), managedRoot,
    getSystem: () => system,
    getEditor: () => ({ manifest: JSON.parse(fs.readFileSync(system.manifestPath, 'utf8')),
      definitions: { sensors: { sit: { lineOrder: JSON.parse(fs.readFileSync(path.join(managedRoot, 'seatpad2/sit/line-order.json'), 'utf8')) } } } }),
    listPackages: () => catalog.list() });
  assert.deepEqual(bindings.read('seatpad2').configuration, configuration);
  assert.throws(() => bindings.update('seatpad2', { expectedRevision: bindings.read('seatpad2').revision, configuration }), { code: 'DISPLAY_SYSTEM_READ_ONLY' });
});

test('the author can receive a published system without replacing their saved classifier', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-author-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const authorRoot = path.join(root, 'author-algorithms');
  fs.mkdirSync(authorRoot, { recursive: true });
  const source = 'def predict(f):\n    return 0';
  const draft = { id: 'gesture', systemId: 'seatpad2', name: '动作识别', language: 'restricted-python-v1',
    source, labels: ['抚摸', '拍打'], windowFrames: 16,
    report: { inputContract: { stage: 'data', pointCount: 529, sampleIntervalMs: 20 },
      sourceDigest: createHash('sha256').update(JSON.stringify(source)).digest('hex') } };
  fs.writeFileSync(path.join(authorRoot, 'gesture.json'), JSON.stringify(draft));
  const input = exportManifestPackage(sampleSystem(), { installedAlgorithmRoot: authorRoot,
    bindings: { configuration: { algorithms: [{ packageId: 'user-gesture', sensorId: 'sit', enabled: false }], charts: [] } } });
  const agentRoot = path.join(root, 'client-agent');
  const installedRoot = path.join(agentRoot, 'algorithm-lab', 'installed');
  fs.mkdirSync(installedRoot, { recursive: true });
  const localSource = 'def predict(f):\n    return 1';
  const localDraft = { ...draft, source: localSource, report: { ...draft.report,
    sourceDigest: createHash('sha256').update(JSON.stringify(localSource)).digest('hex') } };
  const localFile = path.join(installedRoot, 'gesture.json');
  fs.writeFileSync(localFile, JSON.stringify(localDraft));
  const runtime = createAppRuntime({ logger: { warn() {} }, runtimeResourceRoot: path.join(root, 'resources'),
    runtimeWritableRoot: path.join(root, 'client'), agentRoot });
  runtime.displaySystems.installPackage(input, 1);
  assert.equal(runtime.displaySystems.getById('seatpad2').managed, true);
  assert.equal(runtime.getUserAlgorithmPackages().find((item) => item.id === 'user-gesture').revision,
    realtimePackage(draft).revision);
  assert.equal(JSON.parse(fs.readFileSync(localFile, 'utf8')).source, localSource);

  const anotherManagedAlgorithm = path.join(root, 'client', 'managed-display-systems', 'another-system', 'package-algorithms');
  fs.mkdirSync(anotherManagedAlgorithm, { recursive: true });
  fs.writeFileSync(path.join(anotherManagedAlgorithm, 'gesture.json'),
    JSON.stringify({ ...draft, systemId: 'another-system' }));
  assert.throws(() => runtime.displaySystems.installPackage(input, 2), { code: 'SYSTEM_PACKAGE_ALGORITHM_INVALID' });

  const otherAgentRoot = path.join(root, 'other-agent');
  const otherInstalled = path.join(otherAgentRoot, 'algorithm-lab', 'installed');
  fs.mkdirSync(otherInstalled, { recursive: true });
  fs.writeFileSync(path.join(otherInstalled, 'gesture.json'), JSON.stringify({ ...draft, systemId: 'another-system' }));
  const otherRuntime = createAppRuntime({ logger: { warn() {} }, runtimeResourceRoot: path.join(root, 'resources'),
    runtimeWritableRoot: path.join(root, 'other-client'), agentRoot: otherAgentRoot });
  assert.throws(() => otherRuntime.displaySystems.installPackage(input, 1), { code: 'SYSTEM_PACKAGE_ALGORITHM_INVALID' });
});

test('a native hand-template copy installs read-only and retains its original source', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-native-package-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const userRoot = path.join(root, 'user-native'), managedRoot = path.join(root, 'managed-native-systems');
  const user = createBuiltinSystemTemplates({ root: userRoot });
  user.create({ id: 'hand_copy', name: '客户手部系统', sourceType: 'hand' });
  const input = exportNativePackage(user.get('hand_copy'));
  assert.equal(input.kind, 'native-template');
  installNativePackage(input, { managedRoot, version: 7 });
  const customer = createBuiltinSystemTemplates({ root: path.join(root, 'customer-native'), managedRoot });
  assert.equal(customer.get('hand_copy').managed, true);
  assert.equal(customer.get('hand_copy').editable, false);
  assert.throws(() => customer.resolve('hand_copy', ['hand']), { code: 'LICENSE_SCOPE_REQUIRED' });
  assert.equal(customer.resolve('hand_copy', ['hand_copy']).sourceType, 'hand');
  assert.equal(customer.editor('hand_copy').writable, false);
  assert.throws(() => customer.update('hand_copy', {}), { code: 'DISPLAY_SYSTEM_READ_ONLY' });
  assert.equal(JSON.parse(fs.readFileSync(path.join(managedRoot, 'hand_copy.json'), 'utf8')).managedPackage.version, 7);
});

test('a native template package carries its bound restricted classifier', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-native-algorithm-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = 'def predict(f):\n    return 0';
  const draft = { id: 'nativegesture', systemId: 'hand_copy', name: '手部动作', language: 'restricted-python-v1',
    source, labels: ['抚摸', '拍打'], windowFrames: 16,
    report: { inputContract: { stage: 'data', pointCount: 1024, sampleIntervalMs: 20 },
      sourceDigest: createHash('sha256').update(JSON.stringify(source)).digest('hex') } };
  const installedAlgorithmRoot = path.join(root, 'algorithms');
  fs.mkdirSync(installedAlgorithmRoot);
  fs.writeFileSync(path.join(installedAlgorithmRoot, 'nativegesture.json'), JSON.stringify(draft));
  const { nativeInputs } = require('../../extension-host/workspace/builtinSystemConfiguration');
  const configuration = { algorithms: [{ packageId: 'user-nativegesture', sensorId: nativeInputs('hand').channels[0], enabled: true }], charts: [], showPressure: true, showArea: true };
  const system = { kind: 'builtin-template', editable: true, builtinTemplate: { id: 'hand_copy', name: '手部副本', sourceType: 'hand' }, configuration };
  const input = exportNativePackage(system, { installedAlgorithmRoot });
  const managedRoot = path.join(root, 'managed-native-systems');
  installNativePackage(input, { managedRoot });
  const catalog = createRealtimeAlgorithmCatalog(path.join(root, 'customer-agent'), { managedNativeRoot: managedRoot });
  assert.equal(catalog.list()[0].id, 'user-nativegesture');
  const customer = createBuiltinSystemTemplates({ root: path.join(root, 'customer-native'), managedRoot });
  assert.equal(customer.get('hand_copy').configuration.algorithms[0].packageId, 'user-nativegesture');
});

test('an Agent renderer dependency is rejected instead of publishing a broken system', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-package-dependency-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = sampleSystem();
  const manifest = JSON.parse(fs.readFileSync(source.manifestPath, 'utf8'));
  manifest.display = { ...manifest.display, defaultView: 'agent:custom-scene' };
  const filename = path.join(root, 'display-system.json');
  fs.writeFileSync(filename, JSON.stringify(manifest));
  assert.throws(() => exportManifestPackage({ ...source, manifestPath: filename }), { code: 'SYSTEM_PACKAGE_UNSUPPORTED_DEPENDENCY' });
});
