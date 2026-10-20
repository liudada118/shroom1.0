const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '../../..');
const clientRequire = createRequire(path.join(root, 'client/package.json'));
const { parse } = clientRequire('@babel/parser');
const { transformSync } = clientRequire('esbuild');
const returnedSource = fs.readFileSync(path.join(root, 'client/src/extensions/jqbed/jqbedReturnedSettings.js'), 'utf8');
const logStateSource = fs.readFileSync(path.join(root, 'client/src/extensions/jqbed/jqbedAlgorithmLogState.js'), 'utf8');
const alarmSpeechSource = fs.readFileSync(path.join(root, 'client/src/page/home/jqbedAlarmSpeech.js'), 'utf8');
const files = {
  Home: 'client/src/page/home/Home.jsx',
  Title: 'client/src/components/title/Title.jsx',
};

/** 展开测试渲染树，保留真实组件之间的属性传递。 */
function elements(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}

/** 在无硬件的 VM 中执行实际 Home/Title 方法，仅隔离无关子组件。 */
function createHarness(name = 'Home', props = {}, overrides = {}) {
  const source = fs.readFileSync(path.join(root, files[name]), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const classNode = ast.program.body.find((node) => node.type === 'ClassDeclaration' && node.id.name === name);
  const helpers = ast.program.body.filter((node) => node.start < classNode.start &&
    ['VariableDeclaration', 'FunctionDeclaration', 'ExpressionStatement', 'IfStatement'].includes(node.type))
    .map((node) => source.slice(node.start, node.end)).join('\n');
  const storage = new Map();
  const spoken = [];
  let requestCounter = 0;
  const context = vm.createContext({
    console: { info() {}, log() {}, warn() {}, error() {} },
    React: { lazy: () => null, createContext: () => ({ Provider: 'Provider' }), createElement: (type, attributes, ...children) => ({ type, props: { ...attributes, children } }) },
    Com: 'Com', CanvasCom: 'CanvasCom',
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    Date, JSON, Array, Number, Object, Set, Math, AbortController,
    enUS: {}, jaJP: {}, zhCN: {}, PRESSURE_VEST_MATRIX: 'pressureVest',
    initValue: {}, SMALL_BED_12B_DEFAULT_RENDERER_CONFIG: {},
    Radio: { Group: 'Radio.Group', Button: 'Radio.Button' },
    normalizeLanguage: (value) => value || 'zh',
    getJqbedConfigAccess: ({ matrixName, history }) => ({ visible: matrixName === 'jqbed', disabled: history !== 'now' }),
    readPressureScene: () => 'real', PRESSURE_SCENES: { real: 'real', demo: 'demo' },
    resolveDisplaySwitchZero: () => null,
    crypto: { randomUUID: () => `returned-wiring-request${++requestCounter === 1 ? '' : `-${requestCounter}`}` },
    setTimeout() {}, clearTimeout() {}, WebSocket: { CLOSED: 3 },
    speakLocalizedMessage: (text, language, options) => spoken.push({ text, language, ...options }),
    translateBackendMessage: (value) => value,
    Modal: { error() {}, confirm: () => ({ destroy() {} }) },
    module: { exports: {} },
  });
  vm.runInContext(transformSync(returnedSource, { loader: 'js', format: 'cjs' }).code, context);
  Object.assign(context, context.module.exports);
  vm.runInContext(transformSync(logStateSource, { loader: 'js', format: 'cjs' }).code, context);
  Object.assign(context, context.module.exports);
  vm.runInContext(transformSync(alarmSpeechSource, { loader: 'js', format: 'cjs' }).code, context);
  Object.assign(context, context.module.exports);
  const sensorStatusSource = fs.readFileSync(path.join(root, 'client/src/services/sensorStatus.js'), 'utf8');
  vm.runInContext(transformSync(sensorStatusSource, { loader: 'js', format: 'cjs' }).code, context);
  Object.assign(context, context.module.exports);
  for (const node of ast.program.body.filter((item) => item.type === 'ImportDeclaration')) {
    for (const specifier of node.specifiers) {
      if (!(specifier.local.name in context)) context[specifier.local.name] = specifier.local.name;
    }
  }
  context.getSmallBed12BInitialDisplayState = () => ({});
  context.decodeWebSocketPayload = (payload) => JSON.parse(payload);
  context.getDisplayDefinition = () => ({ source: 'builtin', matrix: { rows:32, cols:32 } });
  context.hasFormulaCharts = () => false;
  context.listFormulaChartTemplateIds = () => [];
  context.readDisplaySelection = () => ({});
  context.isHistoryOnlyLicense = () => false;
  context.clearLastFrame = () => {};
  context.selectedNativeSystemId = (value) => value;
  context.resolveNativeSystemType = (value) => value;
  context.getNativeSystemTemplate = () => null;
  context.buildDisplayProfileModel = () => ({});
  context.resolveDisplayProfile = () => ({ colormap: { id: 'classic' } });
  context.resolveChartAppearance = () => ({ colormap: { id: 'classic' }, overlays: [] });
  context.isClassicColormap = () => true;
  context.initialMatrixName = 'jqbed';
  context.initialMatrixConfig = {};
  context.initialChartCards = [];
  context.readLicenseAccess = () => undefined;
  context.isHistoryOnlyLicense = () => false;
  context.canUseLicenseCapability = () => true;
  context.parseWebSocketEventPayload = (event) => JSON.parse(event.data);
  context.getSensorFrameOutputChannel = () => null;
  context.getSensorFrameChannelValue = () => undefined;
  context.getConfig = () => ({});
  context.getBuiltinSystemOptions = () => [];
  context.resolveManifestSerialSensors = () => [];
  context.serialFeedback = { status() {}, error() {} };
  context.requestJson = () => Promise.resolve({});
  context.storedAllowedTypes = null;
  context.storedSensorTypeList = null;
  vm.runInContext(helpers, context);
  const updates = [];
  const pending = [];
  let batching = false;
  const commands = [];
  let sendResult = true;
  context.sendWebSocketJson = (socket, command) => { commands.push(command); return sendResult; };
  context.commandClient = { executeLegacyControl: (command) => { commands.push(command); return Promise.resolve([]); } };
  context.activeSocket = { readyState: 1, send: (payload) => commands.push(JSON.parse(payload)) };
  vm.runInContext('ws = activeSocket', context);
  const instance = {
    props: { t: (key) => key, i18n: { language: 'zh' }, ...props },
    state: {},
    data: { current: { changeData() {}, initCharts() {} } },
    com: { current: null }, com1: { current: null }, img: { current: null },
    sceneVisibility: { current: true },
    title: { current: { changeNum() {} } }, progress: { current: { resetPlay() {} } },
    setState(update) {
      if (batching) { pending.push(update); return; }
      const values = typeof update === 'function' ? update(this.state, this.props) : update;
      if (values == null) return;
      updates.push(values);
      Object.assign(this.state, values);
    },
    wsSendObj: (command) => { commands.push(command); return true; },
  };
  context.instance = instance; context.props = instance.props;
  const constructor = classNode.body.body.find((node) => node.kind === 'constructor');
  const initialState = constructor.body.body.find((node) => node.type === 'ExpressionStatement' &&
    node.expression.type === 'AssignmentExpression' && node.expression.left.property?.name === 'state');
  instance.state = vm.runInContext(`(${source.slice(initialState.expression.right.start, initialState.expression.right.end)})`, context);
  Object.assign(instance.state, name === 'Home' ? {
    matrixName: 'jqbed', history: 'now', local: false, wsConnected: true, wsConnectionEpoch: 1,
    jqbedAlgorithmStatus: { state: 'ready', error: null },
  } : {}, overrides);
  for (const node of classNode.body.body.filter((item) => item.type === 'ClassProperty' && item.value &&
    source.slice(item.value.start, item.value.end).includes('createJqbedAlarmSpeechState('))) {
    instance[node.key.name] = vm.runInContext(source.slice(node.value.start, node.value.end), context);
  }
  for (const node of classNode.body.body) {
    if (node.key?.name && !(node.key.name in instance)) instance[node.key.name] = () => {};
  }
  instance.getSerialSelectProps = () => ({});
  const methods = name === 'Home'
    ? ['wsData', 'syncJqbedReturnedSettings', 'syncJqbedAlgorithmLog', 'syncJqbedAlarmSpeech', 'componentDidUpdate', 'changeStateData', 'changeLocal', 'changeMatrix', 'applyCurrentSensorType', 'wsSendObj']
    : ['requestJqbedAlgorithmConfig', 'canUseJqbedAlgorithmConfig', 'subscribeJqbedAlgorithmLog', 'saveJqbedAlgorithmConfig', 'resetJqbedAlgorithmConfig', 'closeJqbedAlgorithmConfig'];
  for (const methodName of methods) {
    const node = classNode.body.body.find((item) => item.key?.name === methodName);
    instance[methodName] = node.value
      ? vm.runInContext(`(function () { return ${source.slice(node.value.start, node.value.end)}; }).call(instance)`, context)
      : vm.runInContext(`(function (prevProps, prevState) ${source.slice(node.body.start, node.body.end)})`, context);
  }
  const renderNode = classNode.body.body.find((node) => node.key?.name === 'render');
  const renderCode = transformSync(`function render() ${source.slice(renderNode.body.start, renderNode.body.end)}`, { loader: 'jsx', format: 'cjs' }).code;
  return {
    instance, updates, commands, spoken,
    send: (payload, metadata = {}) => instance.wsData({ ...metadata, data: JSON.stringify(payload) }),
    socket: context.activeSocket,
    setSendResult: (value) => { sendResult = value; },
    requestLog(enabled = true) {
      const requestId = `home-log-${commands.length + 1}`;
      instance.wsSendObj({ subscribeJqbedAlgorithmLog: enabled, requestId });
      return requestId;
    },
    batch(action) {
      batching = true;
      try { action(); } finally { batching = false; }
      while (pending.length) instance.setState(pending.shift());
    },
    render: () => elements(vm.runInContext(`${renderCode}; render.call(instance);`, context)),
    change(patch) {
      const before = { ...instance.state };
      instance.changeStateData(patch);
      instance.componentDidUpdate({}, before);
    },
    connection(event) {
      const mount = classNode.body.body.find((node) => node.key?.name === 'componentDidMount');
      const assignment = mount.body.body.find((node) => node.type === 'ExpressionStatement' &&
        node.expression.type === 'AssignmentExpression' && node.expression.left.object?.name === 'ws' &&
        node.expression.left.property?.name === event).expression;
      return vm.runInContext(`(function () { return ${source.slice(assignment.right.start, assignment.right.end)}; }).call(instance)`, context)({});
    },
  };
}

const diagnostics = (reserved_bytes = [10, 20, 30, 40, 2, 1], sensorType = 'jqbed') => ({
  jqbedAlgorithmDiagnostics: { sensorType, reserved_bytes },
});
const plain = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const alarmDiagnostics = (merged_alarm, sosflag = 0, sensorType = 'jqbed') => ({
  jqbedAlgorithmDiagnostics: { sensorType, merged_alarm, sosflag },
});
const spokenKeys = (harness) => harness.spoken.map((item) => item.alertKey);

test('actual Home announces merged alarms without a rate packet or a log subscription', () => {
  const home = createHarness();
  home.send(alarmDiagnostics(10));
  home.send(alarmDiagnostics(14));
  assert.deepEqual(spokenKeys(home), ['leftBed', 'satUp']);
  assert.deepEqual(home.spoken.map((item) => item.text), [
    'home.alerts.leftBed', 'home.alerts.satUp',
  ]);
  assert.ok(home.spoken.every((item) => item.language === 'zh'));
  assert.equal(home.instance.state.jqbedAlgorithmLogSubscription, null);
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null);
});

test('actual Home suppresses repeated alarms, ignores unknown 11/13 and -1, and rearms only on valid 0', () => {
  const home = createHarness();
  home.send(alarmDiagnostics(10));
  for (const value of [10, -1, undefined, null, '10', false, 11, 12, 13, 10.5]) home.send(alarmDiagnostics(value));
  home.send({ jqbedAlgorithmDiagnostics: { sensorType: 'jqbed' } });
  home.send(alarmDiagnostics(10));
  assert.deepEqual(spokenKeys(home), ['leftBed'], 'missing or invalid codes must not rearm a previous alarm');
  home.send(alarmDiagnostics(0));
  home.send(alarmDiagnostics(10));
  assert.deepEqual(spokenKeys(home), ['leftBed', 'leftBed'], '0 is the only silent valid merged-alarm state that rearms the next alarm');
});

test('actual jqbed speech ignores legacy state/SOS fields and raw logs while rate -1 cannot block diagnostics', () => {
  const home = createHarness();
  for (const stateInBbed of [1, 0, 3, 4]) home.send({ rate: { stateInBbed, sosflag: 1, merged_alarm: 10 } });
  home.send({ merged_alarm: 10, sosflag: 1 });
  home.send({ jqbedAlgorithmLog: { sensorType: 'jqbed', outputs: { merged_alarm: 10, sos_flag: 1 } } });
  assert.deepEqual(spokenKeys(home), [], 'unscoped legacy packets and opt-in log data cannot trigger jqbed speech');
  home.send({ ...alarmDiagnostics(14), rate: { rate: -1, stateInBbed: 0, sosflag: -1 } });
  assert.deepEqual(spokenKeys(home), ['satUp']);
});

test('smallBed retains its existing state-based voice alerts independently of jqbed diagnostics', () => {
  const home = createHarness('Home', {}, { matrixName: 'smallBed' });
  home.send({ rate: { stateInBbed: 1, sosflag: 0 } });
  for (const stateInBbed of [0, 0, 3, 4]) home.send({ rate: { stateInBbed, sosflag: 0 } });
  home.send({ rate: { stateInBbed: 4, sosflag: 1 } });
  home.send(alarmDiagnostics(14, 1));
  assert.deepEqual(spokenKeys(home), ['leftBed', 'fallRisk', 'satUp', 'emergency'],
    'smallBed state transitions and SOS keep working; jqbed-only diagnostics remain ignored');
});

test('actual Home speaks SOS only on a new 1 start, bounds counters at 254, and prioritizes it over a bed alarm', () => {
  const home = createHarness();
  for (const value of [-1, undefined, null, '1', 0.5, -2, 255, 300, 2, 254]) home.send(alarmDiagnostics(-1, value));
  assert.deepEqual(spokenKeys(home), [], 'continuation counters and invalid values cannot start SOS speech');
  home.send(alarmDiagnostics(10, 1));
  home.send(alarmDiagnostics(10, 1));
  home.send(alarmDiagnostics(-1, -1));
  home.send(alarmDiagnostics(10, 1));
  for (const value of [255, 300, -1, null, '2']) home.send(alarmDiagnostics(10, value));
  home.send(alarmDiagnostics(10, 1));
  assert.deepEqual(spokenKeys(home), ['emergency'], 'repeated 1 and missing/invalid counters cannot restart the same sequence');
  home.send(alarmDiagnostics(10, 2));
  home.send(alarmDiagnostics(10, 254));
  home.send(alarmDiagnostics(14, 1));
  assert.deepEqual(spokenKeys(home), ['emergency', 'emergency'], 'a 1 after valid continuation is a new start without requiring a zero');
  home.send(alarmDiagnostics(0, 0));
  home.send(alarmDiagnostics(14, 1));
  assert.deepEqual(spokenKeys(home), ['emergency', 'emergency', 'emergency'], '0 ends the sequence and a new 1 overrides simultaneous bed speech');
});

test('actual Home rejects wrong-source and replaced-socket alarm packets without disturbing the active sequence', () => {
  const home = createHarness();
  home.send(alarmDiagnostics(10, 0, 'petCare'));
  home.send({ jqbedAlgorithmDiagnostics: { merged_alarm: 10, sosflag: 1 } });
  home.send(alarmDiagnostics(10), { target: {} });
  assert.deepEqual(spokenKeys(home), []);
  home.send(alarmDiagnostics(10), { target: home.socket });
  home.send(alarmDiagnostics(0), { target: {} });
  home.send(alarmDiagnostics(10), { target: home.socket });
  assert.deepEqual(spokenKeys(home), ['leftBed'], 'an old socket cannot rearm the current session');
});

test('live speech is suppressed during replay, disconnection, system switching and missing jqbed permission', () => {
  for (const blocked of [{ matrixName: 'petCare' }, { history: 'playback' }, { local: true },
    { wsConnected: false }, { allowedTypes: ['petCare'] }, { allowedTypes: [] }]) {
    const home = createHarness();
    home.send(alarmDiagnostics(10));
    home.change(blocked);
    home.send(alarmDiagnostics(14, 1));
    assert.deepEqual(spokenKeys(home), ['leftBed'], JSON.stringify(blocked));
    home.change({ matrixName: 'jqbed', history: 'now', local: false, wsConnected: true, allowedTypes: ['jqbed'] });
    home.send(alarmDiagnostics(10));
    assert.deepEqual(spokenKeys(home), ['leftBed', 'leftBed'], `new authorized live context rearms: ${JSON.stringify(blocked)}`);
  }
});

test('algorithm waiting/error suppresses same-packet and later alarms until ready and rearms recovered speech', () => {
  for (const unavailable of ['waiting', 'error']) {
    const home = createHarness();
    home.send(alarmDiagnostics(10));
    home.send({ ...alarmDiagnostics(14, 1), jqbedAlgorithmStatus: { state: unavailable, error: 'unavailable' } });
    home.send(alarmDiagnostics(14, 2));
    assert.deepEqual(spokenKeys(home), ['leftBed']);
    home.send({ ...alarmDiagnostics(10), jqbedAlgorithmStatus: { state: 'ready', error: null } });
    assert.deepEqual(spokenKeys(home), ['leftBed', 'leftBed'], unavailable);
  }
});

test('batched status messages suppress later diagnostics immediately and ready restores speech before React commits', () => {
  const home = createHarness();
  home.send(alarmDiagnostics(10));
  home.batch(() => {
    home.send({ jqbedAlgorithmStatus: { state: 'error', error: 'offline' } });
    home.send(alarmDiagnostics(14, 1));
  });
  assert.deepEqual(spokenKeys(home), ['leftBed'], 'an uncommitted error status must block the next packet');
  home.batch(() => {
    home.send({ jqbedAlgorithmStatus: { state: 'ready', error: null } });
    home.send(alarmDiagnostics(10));
  });
  assert.deepEqual(spokenKeys(home), ['leftBed', 'leftBed'], 'the new ready status rearms speech without using stale React state');
});

test('batched source and authorization changes block queued alarms before React commits and permit a fresh jqbed session', () => {
  const home = createHarness();
  home.batch(() => {
    home.send({ file: 'petCare' });
    home.send(alarmDiagnostics(10));
  });
  assert.deepEqual(spokenKeys(home), [], 'an uncommitted backend system change blocks a queued jqbed alarm');
  assert.equal(home.instance.state.matrixName, 'petCare');
  home.change({ matrixName: 'jqbed', allowedTypes: ['jqbed'] });
  home.send(alarmDiagnostics(10));
  assert.deepEqual(spokenKeys(home), ['leftBed'], 'switching back to live jqbed starts a fresh alarm session');
  home.batch(() => {
    home.send({ selectFlag: ['petCare'] });
    home.send(alarmDiagnostics(14));
  });
  assert.deepEqual(spokenKeys(home), ['leftBed'], 'uncommitted authorization revocation blocks the following alarm packet');
  assert.equal(home.instance.state.matrixName, 'petCare');
  home.send({ selectFlag: 'all', activeSensorType: 'jqbed' });
  assert.equal(home.instance.state.matrixName, 'jqbed', 'the actual authorized-selection handler restores the backend active system');
  home.send(alarmDiagnostics(14));
  assert.deepEqual(spokenKeys(home), ['leftBed', 'satUp']);
});

test('license failure blocks speech until a fresh authorized selection and same-packet errors always win', () => {
  for (const invalidation of [{ licenseLocked: true }, { noLicense: true }, { licenseError: 'expired' }]) {
    const home = createHarness();
    home.send(alarmDiagnostics(10));
    home.send({ ...alarmDiagnostics(14, 1), ...invalidation, selectFlag: 'all' });
    home.send(alarmDiagnostics(14, 2));
    assert.deepEqual(spokenKeys(home), ['leftBed'], JSON.stringify(invalidation));
    home.send({ selectFlag: 'all' });
    home.send(alarmDiagnostics(10));
    assert.deepEqual(spokenKeys(home), ['leftBed', 'leftBed'], 'fresh valid authorization rearms the active alarm');
  }
});

test('connection callbacks and connection epochs reset alarm deduplication', () => {
  const home = createHarness();
  home.send(alarmDiagnostics(10));
  home.connection('onclose');
  home.send(alarmDiagnostics(14, 1));
  assert.deepEqual(spokenKeys(home), ['leftBed']);
  home.connection('onopen');
  home.send(alarmDiagnostics(10));
  assert.deepEqual(spokenKeys(home), ['leftBed', 'leftBed']);
  home.change({ wsConnectionEpoch: home.instance.state.wsConnectionEpoch + 1 });
  home.send(alarmDiagnostics(10));
  assert.deepEqual(spokenKeys(home), ['leftBed', 'leftBed', 'leftBed']);
});

test('actual Home only obtains returned settings from source-tagged diagnostics, including zero', () => {
  const harness = createHarness();
  assert.equal(harness.instance.state.jqbedReturnedSettings, null);
  harness.send({ jqbedAlgorithmConfig: { sensitivity_threshold: 3, isLowBed: 1 }, rate: { stateInBbed: 1, sensitivity: 3, bedType: 1 } });
  assert.equal(harness.instance.state.jqbedReturnedSettings, null, 'configured/rate values cannot stand in for algorithm diagnostics');
  harness.send(diagnostics([0, 0, 0, 0, 0, 0]));
  assert.deepEqual(plain(harness.instance.state.jqbedReturnedSettings), { sensitivity: 0, bedType: 0 });
  harness.send({ ...diagnostics(), rate: { stateInBbed: 1 } });
  assert.deepEqual(plain(harness.instance.state.jqbedReturnedSettings), { sensitivity: 2, bedType: 1 });
});

test('actual Home ignores other sensor sources and unsuitable live contexts', () => {
  for (const state of [{ matrixName: 'petCare' }, { history: 'playback' }, { local: true }, { wsConnected: false }]) {
    const harness = createHarness('Home', {}, state);
    harness.send(diagnostics());
    assert.equal(harness.instance.state.jqbedReturnedSettings, null, JSON.stringify(state));
  }
  const harness = createHarness();
  harness.send(diagnostics());
  harness.send(diagnostics([0, 0, 0, 0, 0, 0], 'petCare'));
  harness.send({ jqbedAlgorithmDiagnostics: { reserved_bytes: [0, 0, 0, 0, 0, 0] } });
  assert.deepEqual(plain(harness.instance.state.jqbedReturnedSettings), { sensitivity: 2, bedType: 1 });
});

test('same or absent returned values do not rerender Home or erase the latest valid settings', () => {
  const harness = createHarness();
  harness.send(diagnostics());
  const first = harness.instance.state.jqbedReturnedSettings;
  const updateCount = harness.updates.length;
  for (let i = 0; i < 100; i++) harness.send(diagnostics([i, 0, 0, 0, 2, 1]));
  assert.equal(harness.updates.length, updateCount);
  assert.equal(harness.instance.state.jqbedReturnedSettings, first);
  for (let i = 0; i < 60; i++) harness.send(diagnostics([0, 0, 0, 0, -1, -1]));
  for (const frame of [null, [], [0, 0, 0, 0, null, null], [0, 0, 0, 0, '2', -1]]) harness.send(diagnostics(frame));
  assert.equal(harness.updates.length, updateCount, 'frames without new values must not clear or rerender the readout');
  assert.equal(harness.instance.state.jqbedReturnedSettings, first);
  harness.send(diagnostics([0, 0, 0, 0, 0, 0]));
  assert.deepEqual(plain(harness.instance.state.jqbedReturnedSettings), { sensitivity: 0, bedType: 0 });
  assert.equal(harness.updates.length, updateCount + 1, 'new valid zeroes replace previous nonzero values');
});

test('Home accumulates independently returned fields without configuration defaults', () => {
  const harness = createHarness();
  harness.send({ jqbedAlgorithmConfig: { sensitivity_threshold: 3, isLowBed: 1 } });
  harness.send(diagnostics([0, 0, 0, 0, -1, -1]));
  assert.equal(harness.instance.state.jqbedReturnedSettings, null);
  harness.send(diagnostics([0, 0, 0, 0, 2]));
  assert.deepEqual(plain(harness.instance.state.jqbedReturnedSettings), { sensitivity: 2, bedType: null });
  harness.send(diagnostics([0, 0, 0, 0, -1, 1]));
  assert.deepEqual(plain(harness.instance.state.jqbedReturnedSettings), { sensitivity: 2, bedType: 1 });
  harness.send(diagnostics([0, 0, 0, 0, 0, -1]));
  assert.deepEqual(plain(harness.instance.state.jqbedReturnedSettings), { sensitivity: 0, bedType: 1 });
});

test('system, live/replay and connection changes discard returned values without a lifecycle loop', () => {
  for (const patch of [{ matrixName: 'petCare' }, { history: 'playback' }, { local: true }, { wsConnected: false }, { wsConnectionEpoch: 2 }]) {
    const harness = createHarness();
    harness.send(diagnostics());
    harness.change(patch);
    assert.equal(harness.instance.state.jqbedReturnedSettings, null, JSON.stringify(patch));
    const updates = harness.updates.length;
    harness.instance.componentDidUpdate({}, { ...harness.instance.state });
    assert.equal(harness.updates.length, updates);
    harness.change({ matrixName: 'jqbed', history: 'now', local: false, wsConnected: true });
    harness.send(diagnostics([0, 0, 0, 0, -1, -1]));
    assert.equal(harness.instance.state.jqbedReturnedSettings, null, 'missing values in a new session cannot recover old settings');
  }
});

test('waiting/error statuses invalidate diagnostics even in the same message; disconnect/reconnect starts empty', () => {
  const harness = createHarness();
  for (const state of ['waiting', 'error']) {
    harness.send({ jqbedAlgorithmStatus: { state: 'ready', error: null } });
    harness.send(diagnostics());
    harness.send({ ...diagnostics(), jqbedAlgorithmStatus: { state, error: null } });
    assert.equal(harness.instance.state.jqbedReturnedSettings, null);
    harness.send(diagnostics());
    assert.equal(harness.instance.state.jqbedReturnedSettings, null, 'delayed diagnostics cannot revive unavailable algorithm values');
    harness.send({ jqbedAlgorithmStatus: { state: 'ready', error: null } });
    harness.send(diagnostics([0, 0, 0, 0, -1, -1]));
    assert.equal(harness.instance.state.jqbedReturnedSettings, null, 'recovered algorithm must return valid settings again');
  }
  harness.send({ jqbedAlgorithmStatus: { state: 'ready', error: null } });
  harness.send(diagnostics());
  harness.connection('onclose');
  assert.equal(harness.instance.state.jqbedReturnedSettings, null);
  harness.send(diagnostics());
  assert.equal(harness.instance.state.jqbedReturnedSettings, null);
  const epoch = harness.instance.state.wsConnectionEpoch;
  harness.connection('onopen');
  assert.equal(harness.instance.state.wsConnectionEpoch, epoch + 1);
  assert.equal(harness.instance.state.jqbedReturnedSettings, null);
  harness.send(diagnostics([0, 0, 0, 0, -1, -1]));
  assert.equal(harness.instance.state.jqbedReturnedSettings, null, 'reconnecting does not restore the preceding session values');
  harness.send(diagnostics([0, 0, 0, 0, 3, 0]));
  assert.deepEqual(plain(harness.instance.state.jqbedReturnedSettings), { sensitivity: 3, bedType: 0 });
});

test('batched Home updates apply source/status changes before accepting separate diagnostics', () => {
  const harness = createHarness();
  harness.send(diagnostics());
  harness.batch(() => {
    harness.send({ file: 'petCare' });
    harness.send(diagnostics([0, 0, 0, 0, 3, 0]));
  });
  assert.equal(harness.instance.state.matrixName, 'petCare');
  assert.equal(harness.instance.state.jqbedReturnedSettings, null);
  harness.change({ matrixName: 'jqbed' });
  harness.batch(() => {
    harness.send({ jqbedAlgorithmStatus: { state: 'error', error: 'offline' } });
    harness.send(diagnostics());
  });
  assert.equal(harness.instance.state.jqbedReturnedSettings, null);
  harness.batch(() => {
    harness.send({ jqbedAlgorithmStatus: { state: 'ready', error: null } });
    harness.send(diagnostics());
  });
  assert.deepEqual(plain(harness.instance.state.jqbedReturnedSettings), { sensitivity: 2, bedType: 1 });
});

test('actual Home/Title renders pass returned values separately from saved config and preserve save callbacks', () => {
  const home = createHarness();
  home.send(diagnostics());
  const titleProps = home.render().find((item) => item.type === 'Title').props;
  assert.equal(titleProps.jqbedReturnedSettings, home.instance.state.jqbedReturnedSettings);
  const commands = [];
  const title = createHarness('Title', { ...titleProps, wsSendObj: (command) => { commands.push(command); return true; } });
  const modal = title.render().find((item) => item.type === 'JqbedAlgorithmConfigModal');
  assert.equal(modal.props.returnedSettings, home.instance.state.jqbedReturnedSettings);
  assert.equal(modal.props.envelope, home.instance.state.jqbedAlgorithmConfig);
  const draft = { sensitivity_threshold: 1, isLowBed: 0 };
  assert.equal(modal.props.onSave(draft), 'returned-wiring-request');
  assert.deepEqual(plain(commands.at(-1)), { setJqbedAlgorithmConfig: draft, requestId: 'returned-wiring-request' });
  titleProps.changeStateData({ history: 'playback', local: true });
  assert.equal(home.instance.state.jqbedReturnedSettings, null, 'actual navigation callback clears live diagnostics');
});

const logAck = (requestId, subscribed = true, ok = true) => ({
  jqbedAlgorithmLogSubscription: { ok, subscribed, ...(requestId ? { requestId } : {}) },
});
const logFrame = (sequence = 1, sensorType = 'jqbed', outputs = {
  reserved_bytes: [-1, 2, 3, 4, -1, -1, 77],
  unknownAlgorithmField: { exact: ['keep', null, 3.25], enabled: true },
}) => ({ jqbedAlgorithmLog: { sensorType, sequence,
  receivedAt: new Date(Date.UTC(2026, 9, 16, 1) + sequence * 1000).toISOString(), outputs } });

test('Home stores a single latest field snapshot after a successful subscription', () => {
  const home = createHarness();
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null);
  assert.equal(home.instance.state.jqbedAlgorithmLogSubscription, null);
  home.send(logFrame());
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null, 'unsolicited frames are ignored');
  const requestId = home.requestLog();
  home.send(logAck(requestId));
  home.send(logFrame());
  assert.deepEqual(plain(home.instance.state.jqbedAlgorithmLogFrame), logFrame().jqbedAlgorithmLog);
  const first = home.instance.state.jqbedAlgorithmLogFrame;
  const updates = home.updates.length;
  home.send(logFrame());
  assert.equal(home.updates.length, updates, 'same sequence/timestamp does not rerender');
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame, first);
  home.send(logFrame(2));
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame.sequence, 2);
  assert.notEqual(home.instance.state.jqbedAlgorithmLogFrame, first, 'a new sequence updates the latest frame even when outputs are identical');
  assert.deepEqual(plain(home.instance.state.jqbedAlgorithmLogFrame.outputs), plain(first.outputs));
  assert.equal(home.updates.length, updates + 1);
  assert.equal(home.instance.state.jqbedAlgorithmLogFrames, undefined, 'no packet history is retained');
  home.send(logFrame(3, 'jqbed', null));
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame.sequence, 2, 'a missing native object cannot replace a complete frame');
});

test('one React batch keeps the latest metadata without retaining prior packets', () => {
  const home = createHarness();
  home.send(logAck(home.requestLog()));
  home.batch(() => {
    for (let sequence = 1; sequence <= 3; sequence++) home.send(logFrame(sequence));
  });
  assert.deepEqual(plain(home.instance.state.jqbedAlgorithmLogFrame), logFrame(3).jqbedAlgorithmLog);
  assert.equal(home.instance.state.jqbedAlgorithmLogFrames, undefined);
});

test('latest nonmissing fields retain valid values across -1 while zero, unknown fields and mixed arrays replace whole fields', () => {
  const home = createHarness();
  home.send(logAck(home.requestLog()));
  home.send(logFrame(1, 'jqbed', { reserved_bytes: [1, 2, 3, 4, 3, 1], heart_rate: 70, breath_rate: 14 }));
  const outputs = {
    reserved_bytes: [-1, 0, -1, 0, -1, 0, 77],
    heart_rate: -1,
    breath_rate: 0,
    unknownAlgorithmField: { exact: [-1, 0, 'keep', null, { raw: -1 }], enabled: false },
    newUnknownArray: [-1, 0, 2, [3, -1, null]],
  };
  home.send(logFrame(2, 'jqbed', outputs));
  assert.deepEqual(plain(home.instance.state.jqbedAlgorithmLogFrame.outputs), { ...outputs, heart_rate: 70 },
    '-1 keeps the preceding valid field while zero and complete mixed arrays are accepted as returned');
});

test('Home merges each packet before a React batch can hide valid fields behind later -1 values', () => {
  const home = createHarness();
  home.send(logAck(home.requestLog()));
  home.batch(() => {
    home.send(logFrame(1, 'jqbed', { A: 10, B: -1, initialMissing: -1 }));
    home.send(logFrame(2, 'jqbed', { A: -1, B: 0, newMissing: -1 }));
  });
  assert.deepEqual(plain(home.instance.state.jqbedAlgorithmLogFrame.outputs), {
    A: 10, B: 0, initialMissing: -1, newMissing: -1,
  });
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame.sequence, 2);
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame.receivedAt, logFrame(2).jqbedAlgorithmLog.receivedAt);
  home.send(logFrame(3, 'jqbed', { A: 0, B: -1 }));
  assert.deepEqual(plain(home.instance.state.jqbedAlgorithmLogFrame.outputs), {
    A: 0, B: 0, initialMissing: -1, newMissing: -1,
  });
  assert.equal(home.instance.state.jqbedAlgorithmLogFrames, undefined, 'field accumulation does not create packet history');
});

test('all--1 arrays keep the latest valid matrix while a mixed matrix replaces the complete field', () => {
  const home = createHarness();
  home.send(logAck(home.requestLog()));
  home.send(logFrame(1, 'jqbed', {
    pressure: [[1, 2], [3, 4]], unknown: { exact: ['keep', 0] }, nullable: 2,
  }));
  const initial = home.instance.state.jqbedAlgorithmLogFrame.outputs.pressure;
  home.send(logFrame(2, 'jqbed', { pressure: [[-1, -1], [-1, -1]], nullable: null }));
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame.outputs.pressure, initial, 'a missing matrix does not erase the preceding complete value');
  assert.deepEqual(plain(home.instance.state.jqbedAlgorithmLogFrame.outputs.unknown), { exact: ['keep', 0] });
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame.outputs.nullable, null);
  home.send(logFrame(3, 'jqbed', { pressure: [[-1, 8], [-1, 0]] }));
  assert.deepEqual(plain(home.instance.state.jqbedAlgorithmLogFrame.outputs.pressure), [[-1, 8], [-1, 0]],
    'mixed matrices replace whole values instead of splicing measurements from older frames');
});

test('new live sessions cannot revive preceding non--1 fields from missing initialization values', () => {
  for (const boundary of [{ matrixName: 'petCare' }, { history: 'playback', local: true }, { wsConnectionEpoch: 2 }]) {
    const home = createHarness();
    home.send(logAck(home.requestLog()));
    home.send(logFrame(1, 'jqbed', { A: 10, pressure: [1, 2] }));
    home.change(boundary);
    home.change({ matrixName: 'jqbed', history: 'now', local: false });
    home.send(logAck(home.requestLog()));
    home.send(logFrame(2, 'jqbed', { A: -1, pressure: [-1, -1] }));
    assert.deepEqual(plain(home.instance.state.jqbedAlgorithmLogFrame.outputs), { A: -1, pressure: [-1, -1] },
      JSON.stringify(boundary));
  }
});

test('Home rejects wrong-source, unauthorized, replay and disconnected logs', () => {
  for (const state of [{ matrixName: 'petCare' }, { history: 'playback' }, { local: true },
    { wsConnected: false }, { allowedTypes: ['petCare'] }]) {
    const home = createHarness('Home', {}, state);
    const requestId = home.requestLog();
    home.send(logAck(requestId));
    home.send(logFrame());
    assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null, JSON.stringify(state));
    assert.equal(home.instance.state.jqbedAlgorithmLogSubscription, null, JSON.stringify(state));
  }
  const home = createHarness();
  const requestId = home.requestLog();
  home.send(logAck(requestId, false, false));
  home.send(logFrame());
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null);
  home.send(logAck(requestId));
  home.send(logFrame(1, 'petCare'));
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null);
  home.send(logFrame(1));
  const accepted = home.instance.state.jqbedAlgorithmLogFrame;
  home.send(logFrame(2), { target: {} });
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame, accepted, 'a queued old-socket message is ignored');
  home.send(logFrame(2), { target: home.socket });
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame.sequence, 2);
});

test('log subscription generations reject stale acknowledgements and cancellation preserves valid returned settings', () => {
  const home = createHarness();
  home.send(diagnostics());
  const settings = home.instance.state.jqbedReturnedSettings;
  const firstId = home.requestLog();
  home.send(logAck(firstId));
  home.send(logFrame());
  const cancelId = home.requestLog(false);
  home.send(logFrame(2));
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null, 'cancellation immediately rejects in-flight log frames');
  const nextId = home.requestLog();
  home.send(logAck(firstId));
  home.send(logAck(cancelId, false));
  assert.equal(home.instance.state.jqbedAlgorithmLogSubscription, null, 'old responses cannot change a new subscription');
  home.send(logAck(nextId));
  home.send(logFrame(3));
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame.sequence, 3);
  home.send(logAck(undefined, false, false));
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null, 'server-side revocation without requestId also stops the readout');
  assert.equal(home.instance.state.jqbedReturnedSettings, settings, 'log lifecycle never clears cached effective settings');
});

test('log frames and subscription acknowledgements clear at source, epoch and disconnect boundaries', () => {
  for (const patch of [{ matrixName: 'petCare' }, { history: 'playback' }, { local: true },
    { wsConnected: false }, { wsConnectionEpoch: 2 }]) {
    const home = createHarness();
    home.send(logAck(home.requestLog()));
    home.send(logFrame());
    home.change(patch);
    assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null, JSON.stringify(patch));
    assert.equal(home.instance.state.jqbedAlgorithmLogSubscription, null, JSON.stringify(patch));
    home.change({ matrixName: 'jqbed', history: 'now', local: false, wsConnected: true });
    home.send(logFrame(2));
    assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null, 'a fresh live session needs a fresh subscription');
  }
  const home = createHarness();
  home.send(logAck(home.requestLog()));
  home.send(logFrame());
  home.connection('onclose');
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null);
  assert.equal(home.instance.state.jqbedAlgorithmLogSubscription, null);
  home.connection('onopen');
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null);
  assert.equal(home.instance.state.jqbedAlgorithmLogSubscription, null);
});

test('license invalidation clears log access and old acknowledgements cannot reactivate it', () => {
  const home = createHarness();
  const requestId = home.requestLog();
  home.send(logAck(requestId));
  home.send(logFrame());
  home.instance.syncJqbedAlgorithmLog({ licenseError: 'expired' });
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null);
  assert.equal(home.instance.state.jqbedAlgorithmLogSubscription, null);
  home.send(logAck(requestId));
  home.send(logFrame(2));
  assert.equal(home.instance.state.jqbedAlgorithmLogSubscription, null, 'a new authorized request is required after invalidation');
  assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null);
});

test('algorithm waiting/error clears the latest log but retains the subscription for complete initialization outputs', () => {
  const home = createHarness();
  home.send(logAck(home.requestLog()));
  const subscription = home.instance.state.jqbedAlgorithmLogSubscription;
  for (const state of ['waiting', 'error']) {
    home.send(logFrame());
    home.send({ jqbedAlgorithmStatus: { state, error: null } });
    assert.equal(home.instance.state.jqbedAlgorithmLogFrame, null);
    assert.equal(home.instance.state.jqbedAlgorithmLogSubscription, subscription);
    home.send(logFrame(2));
    assert.deepEqual(plain(home.instance.state.jqbedAlgorithmLogFrame.outputs.reserved_bytes), [-1, 2, 3, 4, -1, -1, 77],
      'raw initialization values remain visible without waiting for algorithm ready');
  }
});

test('actual Home/Title render wires stable log callbacks; cancellation is permitted after leaving live jqbed', () => {
  const home = createHarness();
  home.send(logAck(home.requestLog()));
  home.send(logFrame());
  const titleProps = home.render().find((item) => item.type === 'Title').props;
  const title = createHarness('Title', titleProps);
  const modal = title.render().find((item) => item.type === 'JqbedAlgorithmConfigModal');
  assert.equal(modal.props.algorithmLogFrame, home.instance.state.jqbedAlgorithmLogFrame);
  assert.equal(modal.props.algorithmLogFrames, undefined, 'only a single latest native object is passed to the panel');
  assert.equal(modal.props.logSubscription, home.instance.state.jqbedAlgorithmLogSubscription);
  assert.equal(modal.props.onLogSubscription, title.instance.subscribeJqbedAlgorithmLog);
  assert.equal(title.render().find((item) => item.type === 'JqbedAlgorithmConfigModal').props.onLogSubscription,
    modal.props.onLogSubscription, 'log packets do not change callback identity');
  const enabledId = modal.props.onLogSubscription(true);
  assert.equal(home.commands.at(-1).subscribeJqbedAlgorithmLog, true);
  assert.equal(home.commands.at(-1).requestId, enabledId);
  title.instance.props.history = 'playback';
  title.instance.props.matrixName = 'petCare';
  const count = home.commands.length;
  assert.equal(modal.props.onLogSubscription(true), null, 'inaccessible views cannot enable logs');
  assert.equal(home.commands.length, count);
  const disabledId = modal.props.onLogSubscription(false);
  assert.notEqual(disabledId, enabledId, 'each request has a new generation');
  assert.deepEqual(plain(home.commands.at(-1)), { subscribeJqbedAlgorithmLog: false, requestId: disabledId });
  home.setSendResult(false);
  assert.equal(modal.props.onLogSubscription(false), null, 'failed transports do not report successful subscriptions');
});
