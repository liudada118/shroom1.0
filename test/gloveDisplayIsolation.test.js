const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const clientRequire = createRequire(path.join(__dirname, '../client/package.json'));
const { parse } = clientRequire('@babel/parser');
const { transformSync } = clientRequire('esbuild');

const repoRoot = path.join(__dirname, '..');
const homeSource = fs.readFileSync(path.join(repoRoot, 'client/src/page/home/Home.jsx'), 'utf8');
const homeAst = parse(homeSource, { sourceType: 'module', plugins: ['jsx'] });
const homeClass = homeAst.program.body.find((node) => node.type === 'ClassDeclaration' && node.id.name === 'Home');
const helperSource = homeAst.program.body
  .filter((node) => node.start < homeClass.start && ['VariableDeclaration', 'FunctionDeclaration', 'IfStatement'].includes(node.type))
  .map((node) => homeSource.slice(node.start, node.end)).join('\n');
const utilitySource = fs.readFileSync(path.join(repoRoot, 'client/src/page/home/util.js'), 'utf8');
const utilityAst = parse(utilitySource, { sourceType: 'module', plugins: ['jsx'] });
const robotSource = fs.readFileSync(path.join(repoRoot, 'client/src/page/home/robotUtil.js'), 'utf8');
const robotAst = parse(robotSource, { sourceType: 'module' });
const skinFunction = robotAst.program.body.find((node) => node.declaration?.id?.name === 'handSkinChange').declaration;

function utilityGloveHandlers(name) {
  const declaration = utilityAst.program.body.find((node) => node.declaration?.declarations?.some((item) => item.id.name === name));
  const properties = declaration.declaration.declarations.find((item) => item.id.name === name).init.properties;
  return `const ${name} = { ${properties.filter((item) => ['hand0205', 'hand0205Single'].includes(item.key.name))
    .map((item) => utilitySource.slice(item.start, item.end)).join(',')} };`;
}

/** Execute the actual Home message handlers and actual glove utility routing without opening devices. */
function createHarness({ matrixName = 'hand0205Single', mode = 'num', hand = true, calibration = false, local = false } = {}) {
  const storage = new Map();
  const calls = [];
  const stats = [];
  const charts = [];
  const renderer = {};
  for (const method of ['sitData', 'rightData', 'changeWsData256', 'changeWsData147', 'changeWsData147R',
    'changeHandAngle', 'changeRightHandAngle', 'calibration', 'calibrationRight', 'resetHand', 'changeModal', 'handZero']) {
    renderer[method] = (...args) => calls.push({ method, args: structuredClone(args) });
  }
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    Date, JSON, Array, Number, Object, Set, Math,
    enUS: {}, jaJP: {}, zhCN: {},
    PRESSURE_VEST_MATRIX: 'pressureVest',
    initValue: {}, SMALL_BED_12B_DEFAULT_RENDERER_CONFIG: {},
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    setTimeout() {},
    findMax: (values) => values.length ? Math.max(...values) : 0,
    normalizeLanguage: (value) => value || 'zh',
    instance: null,
  });
  vm.runInContext(`${helperSource}\n${utilityGloveHandlers('sitTypeEvent')}\n${utilityGloveHandlers('backTypeEvent')}\n${robotSource.slice(skinFunction.start, skinFunction.end)}`, context);
  const instance = {
    state: { matrixName, numMatrixFlag: mode, hand, calibration, local, dataTime: '', colFlag: true, carState: '', realHz: 0, history: local ? 'playback' : 'now' },
    props: { t: (key) => key, i18n: { language: 'zh' } },
    com: { current: renderer },
    data: { current: {
      changeData: (values) => stats.push(structuredClone(values)),
      handleCharts: (values, max) => charts.push({ type: 'pressure', values: [...values], max }),
      handleChartsArea: (values, max) => charts.push({ type: 'area', values: [...values], max }),
    } },
    title: { current: { changeNum() {} } }, progress: { current: {} },
    setState(values) { Object.assign(this.state, values); },
    syncSmallBed12BMatrixSize() {},
    syncDisplayRendererConfig() {},
  };
  context.instance = instance;
  for (const name of ['parseGloveRawMatrix', 'syncGloveRawPressureStats', 'syncSingleGloveRawPressureStats',
    'getSingleGloveRendererDataRef', 'getSingleGloveFrameSourceKey', 'resetSingleGloveFrameCache',
    'cacheSingleGloveFrame', 'replaySelectedSingleGloveFrame', 'wsData', 'ws1Data']) {
    const node = homeClass.body.body.find((item) => item.key?.name === name);
    instance[name] = vm.runInContext(`(function () { return ${homeSource.slice(node.value.start, node.value.end)}; }).call(instance)`, context);
  }
  const didUpdate = homeClass.body.body.find((node) => node.key?.name === 'componentDidUpdate');
  instance.componentDidUpdate = vm.runInContext(`(function (prevProps, prevState) ${homeSource.slice(didUpdate.body.start, didUpdate.body.end)})`, context);
  return {
    instance, renderer, calls, stats, charts, storage, context,
    send(side, { mapped = new Array(147).fill(3), raw = new Array(256).fill(0), rotate = [0.1, 0.2, 0.3, 0.4], ...extra } = {}) {
      const payload = { [side === 'left' ? 'sitData' : 'backData']: raw, newArr147: mapped, rotate, ...extra };
      const event = { data: JSON.stringify(payload) };
      instance.wsData(event);
      if (side === 'right') instance.ws1Data(event);
    },
    render() {
      const createElement = (type, props, ...children) => ({ type, props: { ...props, children } });
      context.React = { createElement };
      context.Com = 'Com';
      context.CanvasCom = 'CanvasCom';
      for (const node of homeAst.program.body.filter((item) => item.type === 'ImportDeclaration')) {
        for (const specifier of node.specifiers) {
          if (!(specifier.local.name in context)) context[specifier.local.name] = specifier.local.name;
        }
      }
      const constructor = homeClass.body.body.find((node) => node.kind === 'constructor');
      const stateAssignment = constructor.body.body.find((node) => node.type === 'ExpressionStatement' &&
        node.expression.type === 'AssignmentExpression' && node.expression.left.property?.name === 'state');
      context.getSmallBed12BInitialDisplayState = () => ({});
      context.storedAllowedTypes = null;
      context.storedSensorTypeList = null;
      const defaultState = vm.runInContext(`(${homeSource.slice(stateAssignment.expression.right.start, stateAssignment.expression.right.end)})`, context);
      instance.state = { ...defaultState, ...instance.state };
      instance.com1 = { current: null };
      instance.img = { current: null };
      for (const node of homeClass.body.body) {
        if (node.key?.name && !(node.key.name in instance)) instance[node.key.name] = () => {};
      }
      const render = homeClass.body.body.find((node) => node.key?.name === 'render');
      const compiled = transformSync(`function render() ${homeSource.slice(render.body.start, render.body.end)}`, { loader: 'jsx', format: 'cjs' }).code;
      return vm.runInContext(`${compiled}; render.call(instance);`, context);
    },
  };
}

for (const mode of ['normal', 'num', 'numoriginal', 'num3D', 'skin']) {
  for (const hand of [true, false]) {
    test(`restored single glove ${mode} only accepts the selected ${hand ? 'left' : 'right'} hand`, () => {
      const harness = createHarness({ mode, hand });
      const ignored = hand ? 'right' : 'left';
      const selected = hand ? 'left' : 'right';
      const raw = new Array(256).fill(0);
      raw[5] = 40; raw[240] = 120;
      harness.send(ignored, { raw: new Array(256).fill(200) });
      assert.equal(harness.calls.length, 0, 'other hand must not mutate model or matrix');
      assert.equal(harness.stats.length, 0, 'other hand must not replace Aside values');
      harness.send(selected, { raw });
      assert.ok(harness.calls.length > 0, 'selected hand reaches the renderer');
      const lastStats = harness.stats.at(-1);
      assert.deepEqual(lastStats, { meanPres: '80.00', maxPres: 120, point: 2, totalPres: '160' });
      assert.deepEqual(harness.charts.map((item) => item.values), [[160], [2]]);
      if (mode === 'num') {
        assert.deepEqual(harness.calls.filter((item) => item.method === 'changeWsData256').at(-1).args[0], raw);
      } else if (mode === 'numoriginal' || mode === 'num3D') {
        assert.equal(harness.calls.filter((item) => item.method.startsWith('changeWsData147')).at(-1).args[0].length, 147);
      } else if (mode === 'skin') {
        assert.equal(harness.calls.find((item) => item.method === 'sitData').args[0].wsPointData.length, 1024);
      } else {
        assert.deepEqual(harness.calls.find((item) => item.method === 'changeHandAngle').args[0], [-0.1, 0.2, 0.3, 0.4]);
        assert.ok(harness.calls.some((item) => item.method === 'calibration'));
        assert.equal(harness.calls.filter((item) => item.method === 'changeRightHandAngle').length, 0);
      }
    });
  }
}

for (const mode of ['normal', 'num', 'numoriginal']) {
  test(`current glove2 keeps both hands in ${mode}`, () => {
    const harness = createHarness({ matrixName: 'hand0205', mode });
    harness.send('left');
    const leftCount = harness.calls.length;
    harness.send('right');
    assert.ok(harness.calls.length > leftCount, 'right-hand stream continues while left hand is selected');
    if (mode === 'normal') {
      assert.ok(harness.calls.some((item) => item.method === 'changeHandAngle'));
      assert.ok(harness.calls.some((item) => item.method === 'changeRightHandAngle'));
      assert.ok(harness.calls.some((item) => item.method === 'calibrationRight'));
    } else {
      const method = mode === 'num' ? 'changeWsData256' : 'changeWsData147';
      assert.ok(harness.calls.some((item) => item.method === method && item.args[1] === 'right'));
      assert.ok(harness.calls.some((item) => item.args[1] === 'left'));
    }
  });
}

test('single glove calibration uses separate side baselines despite stale backFlag', () => {
  const harness = createHarness({ mode: 'normal', hand: false });
  vm.runInContext("fingerArrL = [[0,0,0,0,0],[10,10,10,10,10]]; fingerArrR = [[0,0,0,0,0],[100,100,100,100,100]]; fingerArr = fingerArrL;", harness.context);
  harness.send('right', { mapped: new Array(147).fill(10), backFlag: false });
  const bend = harness.calls.find((item) => item.method === 'calibration').args[0];
  assert.ok(bend.every((value) => Math.abs(value - 0.1) < 1e-9), 'right baseline 100: three points of 10 and 1/3 smoothing');
});

test('single glove calibration mode fixes pose while retaining raw pressure stats', () => {
  const harness = createHarness({ mode: 'normal', calibration: true });
  harness.send('left', { raw: new Array(256).fill(1) });
  assert.equal(harness.calls.filter((item) => ['changeHandAngle', 'calibration'].includes(item.method)).length, 0);
  assert.equal(harness.stats.at(-1).totalPres, '256');
});

test('mapped renderer statistics cannot overwrite raw pressure values or trends', () => {
  const harness = createHarness({ mode: 'skin' });
  harness.send('left', { raw: new Array(256).fill(1) });
  const ref = harness.instance.getSingleGloveRendererDataRef();
  ref.current.changeData({ meanPres: '999', maxPres: 999, point: 999, totalPres: '999', indexAngle: 90 });
  ref.current.handleCharts([999], 1000);
  ref.current.handleChartsArea([999], 1000);
  assert.deepEqual(harness.stats.at(-1), { indexAngle: 90 });
  assert.equal(harness.stats.filter((item) => item.totalPres === '999').length, 0);
  assert.deepEqual(harness.charts.map((item) => item.values), [[256], [256]]);
});

test('switching selected hand resets pressure trends and playback does not append realtime charts', () => {
  const harness = createHarness();
  harness.send('left', { raw: new Array(256).fill(1) });
  harness.instance.state.hand = false;
  harness.send('right', { raw: new Array(256).fill(2) });
  assert.deepEqual(harness.charts.at(-2).values, [512]);
  harness.instance.state.local = true;
  const chartCount = harness.charts.length;
  harness.send('right', { raw: new Array(256).fill(3) });
  assert.equal(harness.stats.at(-1).totalPres, '768');
  assert.equal(harness.charts.length, chartCount);
});

test('legacy matrix components are restored from the requested commit with only isolated export/key changes', () => {
  const revision = '60ebe4601a7250618327d407c4100b8c49ea9acd';
  for (const [oldName, newName, oldExport, newExport] of [
    ['Num2D.jsx', 'LegacyGloveNum2D.jsx', 'export const Num2D =', 'export const LegacyGloveNum2D ='],
    ['Num2Doriginal.jsx', 'LegacyGloveNum2DOriginal.jsx', 'export const Num2DOriginal =', 'export const LegacyGloveNum2DOriginal ='],
  ]) {
    const historical = execFileSync('git', ['show', `${revision}:client/src/components/num/${oldName}`], { cwd: repoRoot, encoding: 'utf8' });
    const actual = fs.readFileSync(path.join(repoRoot, 'client/src/components/num', newName), 'utf8');
    const normalizeWhitespace = (value) => value.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trimEnd();
    assert.equal(normalizeWhitespace(actual), normalizeWhitespace(historical.replace(oldExport, newExport).replaceAll("'hand0205'", "'hand0205Single'")));
  }
});

for (const local of [true, false]) {
  test(`single glove immediately replays the other cached hand in ${local ? 'paused playback' : 'realtime'} without a new frame`, () => {
    const harness = createHarness({ local });
    const left = new Array(256).fill(1);
    const right = new Array(256).fill(2);
    harness.send('left', { raw: left });
    harness.send('right', { raw: right }); // Cached but not displayed while left is selected.
    assert.equal(harness.stats.at(-1).totalPres, '256');
    const previous = { ...harness.instance.state };
    harness.instance.state.hand = false;
    harness.instance.componentDidUpdate({}, previous);
    assert.equal(harness.stats.at(-1).totalPres, '512');
    assert.deepEqual(harness.calls.filter((item) => item.method === 'changeWsData256').at(-1).args[0], right);
    assert.equal(harness.calls.at(-2).method, 'changeModal');
    const backToLeft = { ...harness.instance.state };
    harness.instance.state.hand = true;
    harness.instance.componentDidUpdate({}, backToLeft);
    assert.equal(harness.stats.at(-1).totalPres, '256');
    assert.deepEqual(harness.calls.filter((item) => item.method === 'changeWsData256').at(-1).args[0], left);
  });
}

test('paused single glove fills an absent hand with zero and clears cached frames on source or collection changes', () => {
  const harness = createHarness({ local: true });
  harness.send('left', { raw: new Array(256).fill(1) });
  let previous = { ...harness.instance.state };
  harness.instance.state.hand = false;
  harness.instance.componentDidUpdate({}, previous);
  assert.equal(harness.stats.at(-1).totalPres, '0');
  assert.ok(harness.calls.filter((item) => item.method === 'changeWsData256').at(-1).args[0].every((value) => value === 0));
  harness.send('right', { raw: new Array(256).fill(2) });
  previous = { ...harness.instance.state };
  harness.instance.state.dataTime = 'another-collection';
  harness.instance.componentDidUpdate({}, previous);
  assert.equal(harness.stats.at(-1).totalPres, '0', 'a different collection must not show cached frames');
  assert.equal(Object.keys(harness.instance.singleGloveFrames).length, 0);
  harness.send('right', { raw: new Array(256).fill(3) });
  previous = { ...harness.instance.state };
  harness.instance.state.colFlag = false;
  harness.instance.componentDidUpdate({}, previous);
  assert.equal(harness.stats.at(-1).totalPres, '0', 'a new capture begins with empty side caches');
  assert.equal(Object.keys(harness.instance.singleGloveFrames).length, 0);
});

test('paused single glove mode changes re-render its cached mapped frame without replacing raw statistics', () => {
  const harness = createHarness({ local: true });
  harness.send('left', { raw: new Array(256).fill(2), mapped: new Array(147).fill(3) });
  const previous = { ...harness.instance.state };
  harness.instance.state.numMatrixFlag = 'skin';
  harness.instance.componentDidUpdate({}, previous);
  assert.equal(harness.calls.at(-1).method, 'sitData');
  assert.equal(harness.calls.at(-1).args[0].wsPointData.length, 1024);
  assert.equal(harness.stats.at(-1).totalPres, '512');
});

function allElements(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(allElements);
  return [tree, ...allElements(tree.props?.children)];
}

test('actual Home render selects the restored single component in all five modes and preserves glove2 renderers', () => {
  for (const [mode, component] of [['normal', 'Hand0205'], ['num', 'LegacyGloveNum2D'],
    ['numoriginal', 'LegacyGloveNum2DOriginal'], ['num3D', 'Num3D'], ['skin', 'HandVideo1']]) {
    const harness = createHarness({ mode, hand: false });
    const elements = allElements(harness.render());
    const restored = elements.filter((element) => element.type === component);
    assert.equal(restored.length, 1, mode);
    assert.equal(restored[0].props.data, harness.instance.getSingleGloveRendererDataRef());
    if (['normal', 'skin'].includes(mode)) assert.equal(restored[0].props.hand, false);
    assert.equal(elements.filter((element) => ['Hand0205Double', 'GloveHandNum2D', 'Num2DOriginal'].includes(element.type)).length, 0);
  }
  for (const [mode, component] of [['normal', 'Hand0205Double'], ['num', 'GloveHandNum2D'], ['numoriginal', 'Num2DOriginal']]) {
    const harness = createHarness({ matrixName: 'hand0205', mode });
    const elements = allElements(harness.render());
    assert.equal(elements.filter((element) => element.type === component).length, 1);
    assert.equal(elements.find((element) => element.type === component).props.data, harness.instance.data);
  }
});

test('actual Title menu, five modes, hand selection and calibration remain connected for the restored glove', () => {
  const titleSource = fs.readFileSync(path.join(repoRoot, 'client/src/components/title/Title.jsx'), 'utf8');
  const ast = parse(titleSource, { sourceType: 'module', plugins: ['jsx'] });
  const titleClass = ast.program.body.find((node) => node.type === 'ClassDeclaration' && node.id.name === 'Title');
  const helpers = ast.program.body.filter((node) => node.start < titleClass.start &&
    ['VariableDeclaration', 'FunctionDeclaration', 'ExpressionStatement'].includes(node.type))
    .map((node) => titleSource.slice(node.start, node.end)).join('\n');
  const changes = [];
  const modelChanges = [];
  const commands = [];
  const capturedCalibration = [];
  const context = vm.createContext({
    React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    getJqbedConfigAccess: () => ({ visible: false }),
    readPressureScene: () => 'real',
    resolveDisplaySwitchZero: () => null,
    PRESSURE_SCENES: { real: 'real', demo: 'demo' },
    PRESSURE_VEST_MATRIX: 'pressureVest',
    Radio: { Group: 'Radio.Group', Button: 'Radio.Button' },
    message: { warning() {} },
    JSON, Object, Array, Number, Math,
  });
  for (const node of ast.program.body.filter((item) => item.type === 'ImportDeclaration')) {
    for (const specifier of node.specifiers) {
      if (!(specifier.local.name in context)) context[specifier.local.name] = specifier.local.name;
    }
  }
  vm.runInContext(helpers, context);
  const instance = {
    props: {
      matrixName: 'hand0205Single', numMatrixFlag: 'normal', hand: true, history: 'now',
      port: [], allowedTypes: [],
      t: (key) => key, i18n: { language: 'zh' },
      com: { current: { changeModal: (hand) => modelChanges.push(hand), handZero() {} } },
      changeStateData: (values) => changes.push(values), wsSendObj: (command) => commands.push(command),
      colFingerData: (index, hand) => capturedCalibration.push({ index, hand }),
      changeCalibration() {},
    },
    state: {},
    setState(values) { Object.assign(this.state, values); },
  };
  context.instance = instance;
  const constructor = titleClass.body.body.find((node) => node.kind === 'constructor');
  const state = constructor.body.body.find((node) => node.type === 'ExpressionStatement' &&
    node.expression.type === 'AssignmentExpression' && node.expression.left.property?.name === 'state');
  instance.state = vm.runInContext(`(${titleSource.slice(state.expression.right.start, state.expression.right.end)})`, context);
  for (const node of titleClass.body.body) {
    if (node.key?.name && !(node.key.name in instance)) instance[node.key.name] = () => null;
  }
  const render = titleClass.body.body.find((node) => node.key?.name === 'render');
  const compiled = transformSync(`function render() ${titleSource.slice(render.body.start, render.body.end)}`, { loader: 'jsx', format: 'cjs' }).code;
  const elements = allElements(vm.runInContext(`${compiled}; render.call(instance);`, context));
  const menu = elements.find((item) => item.type === 'Select' && item.props.value === 'hand0205Single');
  assert.ok(menu.props.options.some((item) => item.value === 'hand0205Single'));
  assert.ok(menu.props.options.some((item) => item.value === 'hand0205'));
  assert.equal(menu.props.options.some((item) => item.value === 'hand0205Double'), false);
  const modeSelector = elements.find((item) => item.type === 'Select' && item.props.value === 'normal');
  assert.deepEqual(Array.from(modeSelector.props.options, (item) => item.value), ['num', 'normal', 'num3D', 'numoriginal', 'skin']);
  for (const mode of ['num', 'normal', 'num3D', 'numoriginal', 'skin']) modeSelector.props.onChange(mode);
  assert.deepEqual(changes.filter((item) => item.numMatrixFlag).map((item) => item.numMatrixFlag), ['num', 'normal', 'num3D', 'numoriginal', 'skin']);
  const handSelector = elements.find((item) => item.type === 'Select' && item.props.value === true);
  handSelector.props.onChange(false);
  assert.equal(changes.at(-1).hand, false);
  assert.equal(modelChanges.at(-1), false);
  const calibrationSelector = elements.find((item) => item.type === 'Select' && item.props.options?.[0]?.value === 'left');
  calibrationSelector.props.onChange('right');
  assert.equal(instance.state.calibHand, 'right');
  assert.equal(changes.at(-1).hand, false);
  assert.equal(modelChanges.at(-1), false);
  instance.props.hand = false;
  instance.state.calibHand = undefined;
  const rightElements = allElements(vm.runInContext('render.call(instance);', context));
  const initialRightCalibration = rightElements.find((item) => item.type === 'Select' && item.props.options?.[0]?.value === 'left');
  assert.equal(initialRightCalibration.props.value, 'right', 'first calibration on the right hand must use its baseline');
  rightElements.find((item) => item.type === 'Button' && item.props.children[0] === 'colData').props.onClick();
  assert.equal(capturedCalibration.at(-1).hand, 'right');
  instance.state.calibHand = 'left';
  rightElements.find((item) => item.type === 'Button' && item.props.children[0] === 'calib').props.onClick();
  assert.equal(instance.state.calibHand, 'right', 'reopening calibration follows the currently selected hand');
  instance.props.com.current = {}; // A mode without changeModal must not make transitions throw.
  modeSelector.props.onChange('num');
});
