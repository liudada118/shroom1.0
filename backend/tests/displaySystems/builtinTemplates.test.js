const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { parse } = createRequire(path.resolve(__dirname, '../../../client/package.json'))('espree');
const { initDb: nativeInitDb } = require('../../kernel/storage/dbManager');
const { createServerHistoryLoader } = require('../fixtures/serverHistoryLoader.cjs');
const { createAppRuntime } = require('../../extension-host/appRuntimeFactory');
const { BUILTIN_TEMPLATES } = require('../../extension-host/workspace/builtinSystemTemplates');
const { registerSerialControlHandlers } = require('../../kernel/serial/serialControlService');
const { createZeroChannelIdentityResolver } = require('../../kernel/platform/runtime/zeroChannelIdentityResolver');

/** 在隔离目录组装真实发现与写入服务，不触及应用数据。 */
function fixture(realResources = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-native-templates-'));
  const options = { runtimeResourceRoot: realResources ? path.resolve(__dirname, '../../..') : path.join(root, 'resources'), runtimeWritableRoot: path.join(root, 'writable') };
  const runtime = createAppRuntime(options);
  return { root, options, runtime,
    close() { assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(root, { recursive: true, force: true }); } };
}

test('all 28 builtin templates create, read back and survive runtime reload', () => {
  const f = fixture();
  try {
    assert.equal(BUILTIN_TEMPLATES.length, 28);
    for (const source of BUILTIN_TEMPLATES) {
      const builtinTemplate = { id: `copy-${source.id}`, name: `${source.name}副本`, sourceType: source.id };
      const result = f.runtime.displaySystems.save({ builtinTemplate });
      assert.deepEqual(result.displaySystem.builtinTemplate, builtinTemplate);
      assert.deepEqual(f.runtime.displaySystems.getEditorById(source.id).builtinTemplate.sourceType, source.id);
      assert.deepEqual(f.runtime.displaySystems.getEditorById(result.id).builtinTemplate, builtinTemplate);
    }
    const restored = createAppRuntime(f.options);
    const status = restored.displaySystems.getStatus();
    assert.equal(status.count, 28);
    assert.equal(status.runtimeDefinitions.length, 28);
    assert.equal(status.systems.length, 28);
    assert.equal(restored.displaySystems.getBuilderCatalog().builtinTemplates.length, 28);
    assert.equal(restored.displaySystems.getEditorById('copy-hand').builtinTemplate.sourceType, 'hand');
  } finally { f.close(); }
});

test('rejects traversal, unknown sources, duplicate IDs and manifest overwrite', () => {
  const f = fixture();
  try {
    const valid = { id: 'copy-hand', name: '新手部', sourceType: 'hand' };
    for (const patch of [{ id: '../escape' }, { id: 'hand' }, { id: 'a:b' }, { sourceType: 'unknown' }, { name: ' ' }, { code: 'evil' }]) {
      assert.throws(() => f.runtime.displaySystems.save({ builtinTemplate: { ...valid, ...patch } }), { code: 'DISPLAY_SYSTEM_INVALID' });
    }
    f.runtime.displaySystems.save({ builtinTemplate: valid });
    assert.throws(() => f.runtime.displaySystems.save({ builtinTemplate: valid }), { code: 'DISPLAY_SYSTEM_EXISTS' });
    assert.throws(() => f.runtime.displaySystems.save({ manifest: { id: valid.id }, overwrite: true }), { code: 'DISPLAY_SYSTEM_EXISTS' });
    assert.equal(f.runtime.displaySystems.getEditorById(valid.id).builtinTemplate.name, valid.name);
  } finally { f.close(); }
});

test('old copies become editable and algorithms/charts persist independently with revision guards', () => {
  const f = fixture(true);
  try {
    const directory = path.join(f.options.runtimeWritableRoot, 'builtin-system-copies');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'old-hand.json'), JSON.stringify({ id: 'old-hand', name: '旧版副本', sourceType: 'hand' }));
    f.runtime.displaySystems.reload();
    const old = f.runtime.builtinTemplates.editor('old-hand');
    assert.equal(old.writable, true);
    assert.deepEqual(old.configuration, { algorithms: [], charts: [], showPressure: true, showArea: true });
    const configuration = { ...old.configuration, algorithms: [{ packageId: 'mattress-vitals', sensorId: 'sit', enabled: true }],
      charts: [{ id: 'breath', name: '呼吸率趋势', packageId: 'mattress-vitals', metricId: 'respirationRate', decimals: 1, color: '#20B486' }] };
    const saved = f.runtime.builtinTemplates.update('old-hand', { name: '可编辑副本', configuration, expectedRevision: old.revision });
    assert.notEqual(saved.editor.revision, old.revision);
    assert.deepEqual(createAppRuntime(f.options).builtinTemplates.editor('old-hand').configuration, configuration);
    assert.equal(f.runtime.builtinTemplates.editor('hand').configuration.charts.length, 0);
    assert.throws(() => f.runtime.builtinTemplates.update('old-hand', { name: '覆盖旧版', configuration, expectedRevision: old.revision }), { code: 'DISPLAY_SYSTEM_REVISION_CONFLICT' });
    for (const invalid of [
      { ...configuration, charts: [{ ...configuration.charts[0], metricId: 'fakeBreathing' }] },
      { ...configuration, algorithms: [] },
      { ...configuration, algorithms: [{ ...configuration.algorithms[0], sensorId: 'back' }] },
      { ...configuration, algorithms: [{ packageId: 'foot-pressure-realtime', sensorId: 'sit', enabled: true }], charts: [] },
    ]) assert.throws(() => f.runtime.builtinTemplates.update('old-hand', { name: '无效', configuration: invalid, expectedRevision: saved.editor.revision }), { code: 'DISPLAY_SYSTEM_INVALID' });
    const stored = path.join(directory, 'old-hand.json');
    const bytes = fs.readFileSync(stored, 'utf8');
    f.runtime.builtinTemplates.activate(f.runtime.builtinTemplates.resolve('old-hand', 'all'));
    assert.throws(() => f.runtime.builtinTemplates.remove('old-hand', saved.editor.revision), { code: 'DISPLAY_SYSTEM_ACTIVE' });
    assert.equal(fs.readFileSync(stored, 'utf8'), bytes);
    f.runtime.builtinTemplates.activate({ id: 'hand', sourceType: 'hand', template: false });
    const marker = path.join(f.options.runtimeWritableRoot, 'keep-recording.db'); fs.writeFileSync(marker, 'existing recording');
    const removed = f.runtime.builtinTemplates.remove('old-hand', saved.editor.revision);
    assert.equal(removed.dataRetained, true);
    assert.equal(f.runtime.builtinTemplates.editor('old-hand'), null);
    assert.equal(fs.readFileSync(marker, 'utf8'), 'existing recording');
    assert.equal(fs.readFileSync(path.join(directory, '.trash', fs.readdirSync(path.join(directory, '.trash'))[0]), 'utf8'), bytes);
    assert.throws(() => f.runtime.builtinTemplates.create({ id: 'old-hand', name: '复用 ID', sourceType: 'hand' }), { code: 'DISPLAY_SYSTEM_EXISTS' });
  } finally { f.close(); }
});

test('switching every copy uses the original protocol type and a separate database identity', () => {
  const f = fixture();
  try {
    const handlers = [];
    let state = { file: 'normal', nowDate: 1, endDate: 2 }, scope = 'all';
    const databases = [], events = [], baudTypes = [];
    registerSerialControlHandlers({ register: (handler) => handlers.push(handler) }, {
      getRuntime: () => state, setRuntime: (patch) => { state = { ...state, ...patch }; },
      resolveSystemSelection: (id) => f.runtime.builtinTemplates.resolve(id, scope),
      activateSystemSelection: f.runtime.builtinTemplates.activate,
      closeAllManagedSerialPorts: () => {}, closeMinzhenSensorPort: () => {},
      initDb: (type, id) => { databases.push([type, id]); return { db: `db:${id || type}` }; },
      getSensorBaudRate: (type) => { baudTypes.push(type); return 1000000; },
      petCareRuntimeService: { resetAll() {} }, stopPlaybackTimer: () => {},
      publishSystemEvent: (value) => events.push(value),
    });
    const switchSystem = handlers.find((handler) => handler.name === 'sensor-file-switch').handle;
    const identity = createZeroChannelIdentityResolver({ getActiveSensorType: () => f.runtime.builtinTemplates.currentId(state.file), listSerialChannels: () => [] });
    for (const source of BUILTIN_TEMPLATES) {
      const id = `copy-${source.id}`;
      f.runtime.displaySystems.save({ builtinTemplate: { id, name: source.name, sourceType: source.id } });
      switchSystem({ file: id });
      assert.equal(state.file, source.id);
      assert.equal(state.db, `db:${id}`);
      assert.deepEqual(databases.at(-1), [source.id, id]);
      assert.equal(baudTypes.at(-1), source.id);
      assert.equal(events.at(-1).currentSensorType, id);
      for (const channel of ['sit', 'back', 'head', 'sensor']) {
        assert.equal(identity.resolveChannelIdentity(channel).channelId, `${id}:${channel}`);
      }
    }
    scope = ['normal'];
    const before = { ...state };
    assert.throws(() => switchSystem({ file: 'copy-hand' }), { code: 'LICENSE_SCOPE_REQUIRED' });
    assert.deepEqual(state, before);
    switchSystem({ file: 'normal' });
    assert.equal(f.runtime.builtinTemplates.currentId('normal'), 'normal');
    assert.deepEqual(databases.at(-1), ['normal', undefined]);
  } finally { f.close(); }
});

test('production database selection isolates original and copies and preserves native playback layout', () => {
  const f = fixture(), opened = [];
  try {
    const filePath = path.join(f.root, 'db');
    fs.mkdirSync(filePath);
    const source = fs.readFileSync(path.resolve(__dirname, '../../kernel/platform/server.js'), 'utf8');
    const declaration = parse(source, { ecmaVersion: 'latest', range: true }).body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'initDb');
    const context = vm.createContext({ fs, path, filePath, runtimeResourceRoot: path.resolve(__dirname, '../../..'), _initDbFromModule: nativeInitDb });
    vm.runInContext(source.slice(...declaration.range), context);
    const original = context.initDb('hand'); opened.push(original.db);
    const first = context.initDb('hand', 'first-hand'); opened.push(first.db);
    const second = context.initDb('hand', 'second-hand'); opened.push(second.db);
    first.db._db.prepare('INSERT INTO matrix(data,timestamp,date) VALUES (?,?,?)').run(JSON.stringify(Array(1024).fill(8)), 1000, 'copy-session');
    assert.equal(original.db._db.prepare('SELECT COUNT(*) AS count FROM matrix').get().count, 0);
    assert.equal(second.db._db.prepare('SELECT COUNT(*) AS count FROM matrix').get().count, 0);
    const playback = createServerHistoryLoader({ sit: first.db }, 'hand');
    assert.equal(playback.load('copy-session').length, 1);
    assert.equal(playback.errors.length, 0);
    const chair = context.initDb('wholeChair', 'my-chair'); opened.push(chair.db, chair.db1, chair.db2);
    assert.ok(chair.db && chair.db1 && chair.db2, '整椅副本仍有三通道数据库');
    for (const suffix of ['sit', 'back', 'head']) assert.ok(fs.existsSync(path.join(filePath, 'builtin-system-copies', 'my-chair', `wholeChair${suffix}.db`)));
  } finally { for (const db of opened) db._db.close(); f.close(); }
});
