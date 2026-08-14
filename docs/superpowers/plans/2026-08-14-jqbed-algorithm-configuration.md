# 小床监测算法参数配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `jqbed` 小床监测增加后端持久化的 18 项算法参数配置弹窗，使配置在保存后的下一实时帧生效，并在软件重启后保留。

**Architecture:** 新建独立 CommonJS 配置存储和 WebSocket 协议模块，由 `server.js` 在许可证、系统类型和实时状态边界内调用；`jqbed` 帧携带不可变配置快照进入 Python，Python 防御性转换后调用 `onbed_filter.pyd`。前端由 Home 接收后端事实状态，Title 只提供入口，新弹窗组件管理未保存草稿并通过现有 WebSocket 提交完整配置。

**Tech Stack:** Electron 31、Node.js CommonJS、`ws`、React 19、Ant Design 5、i18next、Vitest 2、Python 3.11、NumPy、PyInstaller、Node `node:test`、Python `unittest`。

## Global Constraints

- 只影响 `jqbed`；`smallBed`、`smallBedNoAlg`、`smallBed12B` 和其他系统不得接收该配置。
- `python/app/serial_monitor_updated2.0(1).py` 只作参考，必须保持未跟踪、未修改，且不得进入运行时或安装包。
- 后端配置文件固定为 `jqbed-algorithm-config.json`：打包时位于 Electron `userData`，开发时位于项目运行目录。
- 后端是默认值、校验、当前快照和持久化的唯一事实来源；前端不能只写 `localStorage`。
- 保存必须整份校验、临时文件写入和同目录原子替换；写盘失败不得替换当前内存快照。
- 保存成功后，从下一次 `jqbed` 定时帧调用开始生效，不重新初始化 PYD。
- SOS 最终判定继续只使用 PYD 返回的 `sosflag`，不得在前端增加第二套判定。
- 回放时入口可见但禁用；原始矩阵、采集、回放、CSV 和历史结果不得改变。
- UI 使用已确认的深色大模态弹窗：约 `920px`、最大 `80vh`、表单区滚动、底栏固定，调节图标位于设置齿轮左侧。
- 所有新增文案提供中文、英文和日文。
- 不增加新的前端运行时依赖或 DOM 测试依赖。
- 代码变更完成后必须使用 `update-tech-doc` 技能更新 `ARCHITECTURE.md`。
- 设计依据：`docs/superpowers/specs/2026-08-14-jqbed-algorithm-configuration-design.md`。

## File Structure

- Create `server/jqbedAlgorithmConfig.js`: 18 项 schema、默认值、标准化、不可变快照、加载及原子保存。
- Create `server/jqbedAlgorithmProtocol.js`: WebSocket 请求识别、权限/实时边界、单客户端结果及全客户端配置广播。
- Modify `server.js`: 初始化配置存储和协议，处理 WebSocket 消息，维护算法状态，并仅向 `jqbed` Python 调用附加配置。
- Create `test/jqbedAlgorithmConfig.test.js`: Node 配置模型与持久化测试。
- Create `test/jqbedAlgorithmProtocol.test.js`: WebSocket 协议、系统隔离和 Python 参数构造测试。
- Modify `python/app/onbed_filter_example.py`: 增加配置覆盖、防御性转换和兼容的 `getData(data, config=None)`。
- Create `python/tests/test_onbed_filter_config.py`: 使用假 PYD 验证默认、覆盖、dtype、错误和返回契约。
- Create `client/src/components/title/jqbedAlgorithmConfig.js`: 前端字段元数据、分组、草稿校验、序列化及入口可见性纯函数。
- Create `client/src/components/title/jqbedAlgorithmConfig.test.js`: 前端纯函数测试。
- Create `client/src/components/title/JqbedAlgorithmConfigModal.jsx`: 深色参数弹窗及草稿交互。
- Create `client/src/components/title/jqbedAlgorithmConfig.scss`: 弹窗、导航、字段、状态和固定底栏样式。
- Create `client/src/components/title/JqbedAlgorithmConfigModal.test.js`: 无 DOM 的源码契约测试。
- Modify `client/src/components/title/Title.jsx`: 在齿轮左侧挂载入口与弹窗。
- Modify `client/src/page/home/Home.jsx`: 接收配置、保存结果和算法状态并传给 Title。
- Modify `client/src/i18n/resources.js`: 中文和英文配置文案。
- Modify `client/src/i18n/ja.js`: 日文配置文案映射。
- Create `client/src/i18n/jqbedAlgorithmConfig.test.js`: 三语关键文案测试。
- Modify `ARCHITECTURE.md`: 记录正式链路、持久化、边界、打包和验证结果。
- Regenerate `build/index.html` and the generated entry bundle under `build/assets/`: 同步前端生产构建。

---

### Task 1: 后端参数 schema 与持久化存储

**Files:**
- Create: `server/jqbedAlgorithmConfig.js`
- Create: `test/jqbedAlgorithmConfig.test.js`

**Interfaces:**
- Produces: `JQBED_ALGORITHM_CONFIG_VERSION`, `DEFAULT_JQBED_ALGORITHM_VALUES`, `JqbedAlgorithmConfigValidationError`, `normalizeJqbedAlgorithmValues(values)`, `createJqbedAlgorithmConfigStore({ filePath, fsImpl, now, logger })`。
- Store produces: `load(): envelope`, `getSnapshot(): envelope`, `save(values): envelope`, `reset(): envelope`，其中 envelope 为 `{ version: 1, values, savedAt }`。

- [ ] **Step 1: 写 schema、深复制和校验的失败测试**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_JQBED_ALGORITHM_VALUES,
  JqbedAlgorithmConfigValidationError,
  normalizeJqbedAlgorithmValues,
} = require('../server/jqbedAlgorithmConfig');

test('normalizes all 18 jqbed algorithm values without sharing arrays', () => {
  const normalized = normalizeJqbedAlgorithmValues(DEFAULT_JQBED_ALGORITHM_VALUES);
  assert.equal(Object.keys(normalized).length, 18);
  assert.deepEqual(normalized.sos_disable_area, [6, 10]);
  assert.notEqual(normalized.sos_disable_area, DEFAULT_JQBED_ALGORITHM_VALUES.sos_disable_area);
});

test('preserves supported 0,0 and 255,255 sentinel pairs', () => {
  const values = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
  values.leave_bed_disable_area = [0, 0];
  values.sitting_area = [255, 255];
  const normalized = normalizeJqbedAlgorithmValues(values);
  assert.deepEqual(normalized.leave_bed_disable_area, [0, 0]);
  assert.deepEqual(normalized.sitting_area, [255, 255]);
});

test('rejects the whole payload for unknown, missing, non-finite or invalid fields', () => {
  const invalid = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
  delete invalid.breath_th;
  invalid.extra = 1;
  invalid.body_movement_threshold = Number.NaN;
  invalid.sitting_area = [255, 4];
  assert.throws(
    () => normalizeJqbedAlgorithmValues(invalid),
    (error) => error instanceof JqbedAlgorithmConfigValidationError
      && error.errors.breath_th === 'missing'
      && error.errors.extra === 'unknown'
      && error.errors.body_movement_threshold === 'finite'
      && error.errors.sitting_area === 'sentinel',
  );
});
```

- [ ] **Step 2: 运行测试确认因模块不存在而失败**

Run: `node --test test/jqbedAlgorithmConfig.test.js`

Expected: FAIL，错误包含 `Cannot find module '../server/jqbedAlgorithmConfig'`。

- [ ] **Step 3: 实现精确的 18 项 schema 和校验**

```js
const DEFAULT_JQBED_ALGORITHM_VALUES = Object.freeze({
  threshold_factor: 0.0,
  continuous_on_bed_duration_minutes: 0.0,
  unlock_sitting_alarm_duration_minutes: 0.0,
  sos_peak_threshold: 0.0,
  points_threshold_in: 0.0,
  sos_disable_area: Object.freeze([6.0, 10.0]),
  min_sos_sequence: 0.0,
  filter_switch: 1.0,
  strel_switch: 1.0,
  leave_bed_disable_area: Object.freeze([0.0, 0.0]),
  small_object_size: Object.freeze([0.0, 0.0]),
  breath_detect_mode: 0.0,
  sitting_area: Object.freeze([0.0, 0.0]),
  body_movement_threshold: 30.0,
  step_leavebed_trigger: 50.0,
  edge_align_ratio: 0.0,
  head_foot_area: Object.freeze([0.0, 0.0]),
  breath_th: 0.0,
});

const FIELD_RULES = Object.freeze({
  threshold_factor: { kind: 'number' },
  continuous_on_bed_duration_minutes: { kind: 'number' },
  unlock_sitting_alarm_duration_minutes: { kind: 'number' },
  sos_peak_threshold: { kind: 'number' },
  points_threshold_in: { kind: 'number' },
  sos_disable_area: { kind: 'pair' },
  min_sos_sequence: { kind: 'integer' },
  filter_switch: { kind: 'switch' },
  strel_switch: { kind: 'switch' },
  leave_bed_disable_area: { kind: 'pair' },
  small_object_size: { kind: 'pair' },
  breath_detect_mode: { kind: 'integer' },
  sitting_area: { kind: 'sittingPair' },
  body_movement_threshold: { kind: 'number' },
  step_leavebed_trigger: { kind: 'number' },
  edge_align_ratio: { kind: 'number' },
  head_foot_area: { kind: 'pair' },
  breath_th: { kind: 'number' },
});

class JqbedAlgorithmConfigValidationError extends Error {
  constructor(errors) {
    super('Invalid jqbed algorithm configuration');
    this.name = 'JqbedAlgorithmConfigValidationError';
    this.errors = errors;
  }
}
```

Implement `normalizeJqbedAlgorithmValues()` so it requires exactly the 18 keys, converts accepted numeric values to numbers, enforces nonnegative finite scalars, integer/switch rules, `0..32` pairs, and only `[0,0]`, a normal pair, or `[255,255]` for `sitting_area`.

- [ ] **Step 4: 扩展失败测试覆盖加载、损坏回退、原子保存和写盘失败**

```js
test('atomically saves and reloads a complete snapshot', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jqbed-config-'));
  const filePath = path.join(directory, 'jqbed-algorithm-config.json');
  try {
    const store = createJqbedAlgorithmConfigStore({
      filePath,
      now: () => new Date('2026-08-14T08:00:00.000Z'),
    });
    const values = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
    values.sos_peak_threshold = 18;
    const saved = store.save(values);
    assert.equal(saved.savedAt, '2026-08-14T08:00:00.000Z');
    assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).values.sos_peak_threshold, 18);
    assert.equal(createJqbedAlgorithmConfigStore({ filePath }).load().values.sos_peak_threshold, 18);
    assert.deepEqual(fs.readdirSync(directory), ['jqbed-algorithm-config.json']);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps the previous snapshot when persistence fails', () => {
  const store = createJqbedAlgorithmConfigStore({
    filePath: 'ignored.json',
    fsImpl: {
      existsSync: () => false,
      mkdirSync: () => {},
      writeFileSync: () => { throw new Error('disk full'); },
      renameSync: () => {},
      unlinkSync: () => {},
    },
  });
  const before = store.getSnapshot();
  const values = structuredClone(before.values);
  values.threshold_factor = 9;
  assert.throws(() => store.save(values), /disk full/);
  assert.deepEqual(store.getSnapshot(), before);
});
```

Also test missing file uses defaults, corrupt/incompatible JSON logs and falls back, `reset()` persists defaults, and returned snapshots cannot mutate store state.

- [ ] **Step 5: 实现 store 并通过测试**

```js
function persistEnvelope(filePath, envelope, fsImpl) {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fsImpl.writeFileSync(tempPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
    fsImpl.renameSync(tempPath, filePath);
  } catch (error) {
    try { fsImpl.unlinkSync(tempPath); } catch (_cleanupError) {}
    throw error;
  }
}
```

Run: `node --test test/jqbedAlgorithmConfig.test.js`

Expected: PASS，且测试临时目录中没有遗留 `.tmp` 文件。

- [ ] **Step 6: 提交后端配置存储**

```bash
git add server/jqbedAlgorithmConfig.js test/jqbedAlgorithmConfig.test.js
git commit -m "新增小床监测算法配置存储"
```

---

### Task 2: WebSocket 配置协议与 jqbed 实时帧接入

**Files:**
- Create: `server/jqbedAlgorithmProtocol.js`
- Create: `test/jqbedAlgorithmProtocol.test.js`
- Modify: `server.js:1-110`
- Modify: `server.js:1530-1565`
- Modify: `server.js:3370-3820`
- Modify: `server.js:8397-8440`

**Interfaces:**
- Consumes: Task 1 store methods and envelope shape。
- Produces: `createJqbedAlgorithmProtocol({ store, sendJson, broadcastJson, getAlgorithmStatus })` with `handle(message, context): boolean`。
- Produces: `buildJqbedGetDataArgs(data, activeFile, configEnvelope): { data, config? }`。
- Protocol messages: `getJqbedAlgorithmConfig`, `setJqbedAlgorithmConfig`, `resetJqbedAlgorithmConfig`, `jqbedAlgorithmConfig`, `jqbedAlgorithmConfigResult`, `jqbedAlgorithmStatus`。

- [ ] **Step 1: 写协议和系统隔离的失败测试**

```js
test('returns the backend snapshot for an authorized realtime jqbed request', () => {
  const sent = [];
  const protocol = createJqbedAlgorithmProtocol({
    store: fakeStore,
    sendJson: (_client, payload) => sent.push(payload),
    broadcastJson: () => {},
    getAlgorithmStatus: () => ({ state: 'ready', error: null }),
  });
  const handled = protocol.handle(
    { getJqbedAlgorithmConfig: true },
    { client: {}, licenseValid: true, activeFile: 'jqbed', realtime: true },
  );
  assert.equal(handled, true);
  assert.deepEqual(sent[0].jqbedAlgorithmConfig, fakeStore.getSnapshot());
  assert.equal(sent[0].jqbedAlgorithmStatus.state, 'ready');
});

test('rejects save outside licensed realtime jqbed without mutating the store', () => {
  for (const context of [
    { licenseValid: false, activeFile: 'jqbed', realtime: true },
    { licenseValid: true, activeFile: 'smallBed', realtime: true },
    { licenseValid: true, activeFile: 'jqbed', realtime: false },
  ]) {
    const result = runSave(context);
    assert.equal(result.sent.at(-1).jqbedAlgorithmConfigResult.ok, false);
    assert.equal(result.saveCalls, 0);
  }
});
```

Add tests proving successful save/reset broadcast the new snapshot, validation errors return field codes only to the requester, write errors do not broadcast, unrelated WebSocket messages return `false`, and only `jqbed` Python args include `config`.

- [ ] **Step 2: 运行测试确认模块缺失**

Run: `node --test test/jqbedAlgorithmProtocol.test.js`

Expected: FAIL，错误包含 `Cannot find module '../server/jqbedAlgorithmProtocol'`。

- [ ] **Step 3: 实现协议控制器和 Python 参数构造器**

```js
function buildJqbedGetDataArgs(data, activeFile, configEnvelope) {
  return activeFile === 'jqbed'
    ? { data, config: configEnvelope.values }
    : { data };
}

function isConfigMessage(message) {
  return Boolean(
    message?.getJqbedAlgorithmConfig
    || message?.setJqbedAlgorithmConfig
    || message?.resetJqbedAlgorithmConfig,
  );
}
```

`handle()` must first recognize the message, then require `licenseValid`, `activeFile === 'jqbed'`, and `realtime`; read sends only to the requester, save/reset call the store and broadcast the authoritative envelope, and every mutation sends `{ jqbedAlgorithmConfigResult: { ok, action, errors, message } }` to the requester.

- [ ] **Step 4: 在 server.js 初始化并接入协议**

After `runtimeWritableRoot` is known, initialize:

```js
const jqbedAlgorithmConfigStore = createJqbedAlgorithmConfigStore({
  filePath: path.join(runtimeWritableRoot, 'jqbed-algorithm-config.json'),
  logger,
});
jqbedAlgorithmConfigStore.load();

let jqbedAlgorithmStatus = { state: 'waiting', error: null };
```

Create `sendJson`/`broadcastJson` adapters that check `WebSocket.OPEN`. In the main socket message handler, call the protocol once with the already parsed `getMessage`:

```js
if (jqbedAlgorithmProtocol.handle(getMessage, {
  client: ws,
  licenseValid: licenseManager.isLicenseValid(),
  activeFile: file,
  realtime: !localFlag,
})) {
  return;
}
```

In `jqbedTimer`, replace the call arguments only:

```js
const rawData = await callPy(
  'getData',
  buildJqbedGetDataArgs(
    newArr,
    file,
    jqbedAlgorithmConfigStore.getSnapshot(),
  ),
);
```

Update status through one helper so an open modal receives state changes without polling:

```js
function setJqbedAlgorithmStatus(nextStatus) {
  const serialized = JSON.stringify(nextStatus);
  if (serialized === JSON.stringify(jqbedAlgorithmStatus)) return;
  jqbedAlgorithmStatus = nextStatus;
  broadcastJson({ jqbedAlgorithmStatus });
}
```

Set status to `{ state: 'ready', error: null }` after a successful `jqbed` call and to `{ state: 'error', error: safeMessage, errorAt: new Date().toISOString() }` in the existing catch block. Do not change the rate payload or the timer branch for `smallBed`。

- [ ] **Step 5: 运行 Node 测试和静态边界检查**

Run: `node --test test/jqbedAlgorithmConfig.test.js test/jqbedAlgorithmProtocol.test.js`

Expected: PASS。

Run: `rg -n "buildJqbedGetDataArgs|jqbedAlgorithmConfigStore|resetJqbedAlgorithmConfig" server.js server/jqbedAlgorithmProtocol.js`

Expected: one store initialization, one WebSocket dispatch site, and one timer argument construction site; no `smallBed` configuration injection。

- [ ] **Step 6: 提交 WebSocket 和实时接入**

```bash
git add server.js server/jqbedAlgorithmProtocol.js test/jqbedAlgorithmProtocol.test.js
git commit -m "接入小床监测算法配置协议"
```

---

### Task 3: Python 参数覆盖与 PYD 契约

**Files:**
- Modify: `python/app/onbed_filter_example.py:591-667`
- Create: `python/tests/test_onbed_filter_config.py`

**Interfaces:**
- Consumes: JSON-compatible `config` object containing the 18 validated values。
- Produces: `build_step_inputs(data, config=None): dict` and compatible `getData(data, config=None): dict`。
- Preserves: existing result keys including `rate`, `heart_rate`, `stateInBbed`, `sosflag`, `merged_alarm`, `matrix_origin`, and `matrix_filter`。

- [ ] **Step 1: 写默认与覆盖输入的失败测试**

```python
import importlib.util
import pathlib
import unittest
import numpy as np

MODULE_PATH = pathlib.Path(__file__).parents[1] / "app" / "onbed_filter_example.py"
SPEC = importlib.util.spec_from_file_location("onbed_filter_example_test", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

class JqbedAlgorithmConfigTests(unittest.TestCase):
    def test_build_step_inputs_keeps_defaults_without_config(self):
        inputs = MODULE.build_step_inputs([1, 2, 3], None)
        self.assertEqual(inputs["threshold_factor"], 0.0)
        self.assertEqual(inputs["filter_switch"], 1.0)
        np.testing.assert_array_equal(inputs["sos_disable_area"], [6.0, 10.0])
        self.assertEqual(inputs["frame_data"].dtype, np.float32)

    def test_build_step_inputs_overrides_pairs_as_float32(self):
        config = {"sos_disable_area": [2, 9], "threshold_factor": 7}
        inputs = MODULE.build_step_inputs([1, 2], config)
        self.assertEqual(inputs["threshold_factor"], 7.0)
        self.assertEqual(inputs["sos_disable_area"].dtype, np.float32)
        np.testing.assert_array_equal(inputs["sos_disable_area"], [2.0, 9.0])
```

Add cases for all supported keys, `0,0`, `255,255`, non-finite scalar, wrong pair length, invalid integer/switch/range, and unknown keys being ignored rather than sent into PYD.

- [ ] **Step 2: 运行测试确认缺少 build_step_inputs**

Run: `python -m unittest discover -s python/tests -p "test_onbed_filter_config.py" -v`

Expected: FAIL with `AttributeError: module ... has no attribute 'build_step_inputs'`。

- [ ] **Step 3: 实现 Python 防御性转换**

```python
ALGORITHM_PAIR_KEYS = {
    'sos_disable_area',
    'sitting_area',
    'leave_bed_disable_area',
    'small_object_size',
    'head_foot_area',
}
ALGORITHM_INTEGER_KEYS = {'min_sos_sequence', 'breath_detect_mode'}
ALGORITHM_SWITCH_KEYS = {'filter_switch', 'strel_switch'}

def _normalize_algorithm_value(key, value):
    if key in ALGORITHM_PAIR_KEYS:
        pair = np.asarray(value, dtype=np.float32)
        if pair.shape != (2,) or not np.isfinite(pair).all():
            raise ValueError(f'invalid pair: {key}')
        first, second = (float(pair[0]), float(pair[1]))
        if key == 'sitting_area':
            sentinel = first == 255.0 and second == 255.0
            normal = 0.0 <= first <= 32.0 and 0.0 <= second <= 32.0
            if not sentinel and not normal:
                raise ValueError(f'invalid sitting_area: {value}')
        elif not (0.0 <= first <= 32.0 and 0.0 <= second <= 32.0):
            raise ValueError(f'pair out of range: {key}')
        return pair

    number = float(value)
    if not np.isfinite(number) or number < 0.0:
        raise ValueError(f'invalid number: {key}')
    if key in ALGORITHM_INTEGER_KEYS and not number.is_integer():
        raise ValueError(f'invalid integer: {key}')
    if key in ALGORITHM_SWITCH_KEYS and number not in (0.0, 1.0):
        raise ValueError(f'invalid switch: {key}')
    return number

def build_step_inputs(data, config=None):
    inputs = create_default_inputs()
    if config is not None:
        if not isinstance(config, dict):
            raise ValueError('config must be an object')
        for key, value in config.items():
            if key not in inputs:
                continue
            inputs[key] = _normalize_algorithm_value(key, value)
    inputs['frame_data'] = np.asarray(data, dtype=np.float32)
    return inputs
```

Change `getData` to `def getData(data, config=None):` and call `ncz.step(build_step_inputs(data, config))` without reinitializing `ncz`。

- [ ] **Step 4: 用假 PYD 验证最终调用和返回结构**

```python
def test_get_data_passes_config_to_step_and_preserves_sosflag(self):
    class FakeNcz:
        captured = None
        @classmethod
        def step(cls, inputs):
            cls.captured = inputs
            return {"sosflag": 1, "rate": 12, "matrix_origin": [], "matrix_filter": []}

    original = MODULE.ncz
    try:
        MODULE.ncz = FakeNcz
        result = MODULE.getData([0] * 1024, {"sos_peak_threshold": 22})
        self.assertEqual(FakeNcz.captured["sos_peak_threshold"], 22.0)
        self.assertEqual(result["sosflag"], 1.0)
        self.assertIn("merged_alarm", result)
    finally:
        MODULE.ncz = original
```

- [ ] **Step 5: 运行 Python 专项测试**

Run: `python -m unittest discover -s python/tests -p "test_onbed_filter_config.py" -v`

Expected: PASS without requiring serial hardware or a working `onbed_filter.pyd`。

- [ ] **Step 6: 提交 Python 接口**

```bash
git add python/app/onbed_filter_example.py python/tests/test_onbed_filter_config.py
git commit -m "支持小床算法动态参数"
```

---

### Task 4: 前端字段模型、校验和三语文案

**Files:**
- Create: `client/src/components/title/jqbedAlgorithmConfig.js`
- Create: `client/src/components/title/jqbedAlgorithmConfig.test.js`
- Modify: `client/src/i18n/resources.js`
- Modify: `client/src/i18n/ja.js`
- Create: `client/src/i18n/jqbedAlgorithmConfig.test.js`

**Interfaces:**
- Produces: `JQBED_CONFIG_GROUPS`, `JQBED_CONFIG_FIELDS`, `cloneJqbedConfigValues(values)`, `validateJqbedConfigDraft(values)`, `serializeJqbedConfigDraft(values)`, `getJqbedConfigAccess({ matrixName, history })`。
- Field metadata includes `key`, `group`, `kind`, `labelKey`, `helpKey`, and pair element labels where applicable。
- `validateJqbedConfigDraft` returns `{ valid: boolean, errors: Record<string,string> }`。

- [ ] **Step 1: 写字段数量、分组和入口状态失败测试**

```js
import { describe, expect, it } from 'vitest';
import {
  JQBED_CONFIG_FIELDS,
  JQBED_CONFIG_GROUPS,
  getJqbedConfigAccess,
  validateJqbedConfigDraft,
  serializeJqbedConfigDraft,
} from './jqbedAlgorithmConfig';

describe('jqbed algorithm configuration model', () => {
  it('defines exactly 18 fields in four groups with SOS selected first', () => {
    expect(JQBED_CONFIG_FIELDS).toHaveLength(18);
    expect(JQBED_CONFIG_GROUPS.map((group) => group.key)).toEqual([
      'sos', 'basic', 'filter', 'advanced',
    ]);
  });

  it('shows only for jqbed and disables playback', () => {
    expect(getJqbedConfigAccess({ matrixName: 'smallBed', history: 'now' }).visible).toBe(false);
    expect(getJqbedConfigAccess({ matrixName: 'jqbed', history: 'now' })).toMatchObject({ visible: true, disabled: false });
    expect(getJqbedConfigAccess({ matrixName: 'jqbed', history: 'playback' })).toMatchObject({ visible: true, disabled: true });
  });
});
```

Add validation cases mirroring the backend, numeric string serialization, switches becoming `0/1`, pair preservation, and `255,4` rejection.

- [ ] **Step 2: 运行 Vitest 确认模块缺失**

Run: `npm --prefix client test -- --run src/components/title/jqbedAlgorithmConfig.test.js`

Expected: FAIL because `./jqbedAlgorithmConfig` does not exist。

- [ ] **Step 3: 实现字段元数据和纯函数**

```js
export const JQBED_CONFIG_GROUPS = Object.freeze([
  { key: 'sos', labelKey: 'jqbedAlgorithmConfig.groups.sos' },
  { key: 'basic', labelKey: 'jqbedAlgorithmConfig.groups.basic' },
  { key: 'filter', labelKey: 'jqbedAlgorithmConfig.groups.filter' },
  { key: 'advanced', labelKey: 'jqbedAlgorithmConfig.groups.advanced' },
]);

export const JQBED_CONFIG_FIELDS = Object.freeze([
  { key: 'sos_peak_threshold', group: 'sos', kind: 'number' },
  { key: 'points_threshold_in', group: 'sos', kind: 'number' },
  { key: 'sos_disable_area', group: 'sos', kind: 'pair' },
  { key: 'min_sos_sequence', group: 'sos', kind: 'integer' },
  { key: 'threshold_factor', group: 'basic', kind: 'number' },
  { key: 'continuous_on_bed_duration_minutes', group: 'basic', kind: 'number' },
  { key: 'unlock_sitting_alarm_duration_minutes', group: 'basic', kind: 'number' },
  { key: 'filter_switch', group: 'filter', kind: 'switch' },
  { key: 'strel_switch', group: 'filter', kind: 'switch' },
  { key: 'leave_bed_disable_area', group: 'filter', kind: 'pair' },
  { key: 'small_object_size', group: 'filter', kind: 'pair' },
  { key: 'breath_detect_mode', group: 'advanced', kind: 'integer' },
  { key: 'sitting_area', group: 'advanced', kind: 'sittingPair' },
  { key: 'body_movement_threshold', group: 'advanced', kind: 'number' },
  { key: 'step_leavebed_trigger', group: 'advanced', kind: 'number' },
  { key: 'edge_align_ratio', group: 'advanced', kind: 'number' },
  { key: 'head_foot_area', group: 'advanced', kind: 'pair' },
  { key: 'breath_th', group: 'advanced', kind: 'number' },
].map((field) => Object.freeze({
  ...field,
  labelKey: `jqbedAlgorithmConfig.fields.${field.key}.label`,
  helpKey: `jqbedAlgorithmConfig.fields.${field.key}.help`,
})));

export const getJqbedConfigAccess = ({ matrixName, history }) => ({
  visible: matrixName === 'jqbed',
  disabled: matrixName === 'jqbed' && history !== 'now',
  tooltipKey: history === 'now'
    ? 'jqbedAlgorithmConfig.open'
    : 'jqbedAlgorithmConfig.realtimeOnly',
});
```

Implement `validateJqbedConfigDraft` with the same numeric rules encoded by each `kind`, a dedicated `[255,255]` exception only for `sittingPair`, and per-field translation error codes. `serializeJqbedConfigDraft` must return all 18 numeric values, turn switches into `0/1`, and clone pairs. Do not add localStorage read/write functions。

- [ ] **Step 4: 添加中英日关键文案测试和资源**

```js
import { describe, expect, it } from 'vitest';
import resources from './resources';

it('provides jqbed algorithm configuration copy in all languages', () => {
  expect(resources.zh.translation.jqbedAlgorithmConfig.title).toBe('小床监测算法配置');
  expect(resources.en.translation.jqbedAlgorithmConfig.saveAndApply).toBe('Save and apply now');
  expect(resources.ja.translation.jqbedAlgorithmConfig.realtimeOnly).toBe('アルゴリズム設定はリアルタイム監視でのみ有効です');
});
```

Add translation keys for title, open tooltip, realtime-only tooltip, four group labels, all 18 labels/help strings, row/column, PYD waiting/ready/error, last saved time, never saved, restore confirmation, restore/cancel/save, saving, success, load failure, validation messages, and backend rejection codes. Follow the existing `text(zh, en)` and `compare(zh, ja)` structures.

- [ ] **Step 5: 运行前端模型和翻译测试**

Run: `npm --prefix client test -- --run src/components/title/jqbedAlgorithmConfig.test.js src/i18n/jqbedAlgorithmConfig.test.js`

Expected: PASS。

- [ ] **Step 6: 提交前端领域模型和文案**

```bash
git add client/src/components/title/jqbedAlgorithmConfig.js client/src/components/title/jqbedAlgorithmConfig.test.js client/src/i18n/resources.js client/src/i18n/ja.js client/src/i18n/jqbedAlgorithmConfig.test.js
git commit -m "定义小床算法配置表单模型"
```

---

### Task 5: 深色配置弹窗与 Title/Home 接线

**Files:**
- Create: `client/src/components/title/JqbedAlgorithmConfigModal.jsx`
- Create: `client/src/components/title/jqbedAlgorithmConfig.scss`
- Create: `client/src/components/title/JqbedAlgorithmConfigModal.test.js`
- Modify: `client/src/components/title/Title.jsx:1-20`
- Modify: `client/src/components/title/Title.jsx:271-390`
- Modify: `client/src/components/title/Title.jsx:1568-1665`
- Modify: `client/src/components/title/Title.jsx:2295-2345`
- Modify: `client/src/page/home/Home.jsx:740-840`
- Modify: `client/src/page/home/Home.jsx:1378-1900`
- Modify: `client/src/page/home/Home.jsx:5000-5090`

**Interfaces:**
- Consumes: Task 4 field helpers and `Home` props `jqbedAlgorithmConfig`, `jqbedAlgorithmConfigResult`, `jqbedAlgorithmStatus`。
- Produces component props: `{ open, envelope, operationResult, algorithmStatus, onRequest, onSave, onReset, onClose }`。
- Sends existing WebSocket payloads `{ getJqbedAlgorithmConfig: true }`, `{ setJqbedAlgorithmConfig: values }`, and `{ resetJqbedAlgorithmConfig: true }`。

- [ ] **Step 1: 写无 DOM 的 UI 源码契约失败测试**

```js
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const modalSource = fs.readFileSync(
  fileURLToPath(new URL('./JqbedAlgorithmConfigModal.jsx', import.meta.url)),
  'utf8',
);
const titleSource = fs.readFileSync(
  fileURLToPath(new URL('./Title.jsx', import.meta.url)),
  'utf8',
);

describe('jqbed algorithm configuration UI contract', () => {
  it('uses a modal with scrollable form and fixed action footer', () => {
    expect(modalSource).toContain('width={920}');
    expect(modalSource).toContain('jqbedAlgorithmConfig__formScroll');
    expect(modalSource).toContain('jqbedAlgorithmConfig__footer');
  });

  it('sends backend-owned read, save and reset requests', () => {
    expect(titleSource).toContain('getJqbedAlgorithmConfig: true');
    expect(titleSource).toContain('setJqbedAlgorithmConfig: values');
    expect(titleSource).toContain('resetJqbedAlgorithmConfig: true');
    expect(titleSource).not.toContain("localStorage.setItem('jqbedAlgorithmConfig'");
  });

  it('places SlidersOutlined before the existing option image', () => {
    expect(titleSource.indexOf('SlidersOutlined')).toBeLessThan(titleSource.indexOf("className='optionImg'"));
  });
});
```

- [ ] **Step 2: 运行测试确认组件不存在**

Run: `npm --prefix client test -- --run src/components/title/JqbedAlgorithmConfigModal.test.js`

Expected: FAIL reading `JqbedAlgorithmConfigModal.jsx`。

- [ ] **Step 3: 实现弹窗草稿状态和表单渲染**

```jsx
export default function JqbedAlgorithmConfigModal({
  open,
  envelope,
  operationResult,
  algorithmStatus,
  onRequest,
  onSave,
  onReset,
  onClose,
}) {
  const [activeGroup, setActiveGroup] = useState('sos');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const validation = draft
    ? validateJqbedConfigDraft(draft)
    : { valid: false, errors: {} };

  useEffect(() => {
    if (open) onRequest();
  }, [open, onRequest]);

  useEffect(() => {
    if (envelope?.values) {
      setDraft(cloneJqbedConfigValues(envelope.values));
      setSaving(false);
    }
  }, [envelope]);
```

Render the active group from metadata; use `InputNumber` for numeric fields, `Switch` for switches, and two inputs for pairs:

```jsx
const renderField = (field) => {
  const value = draft[field.key];
  const setValue = (nextValue) => setDraft((current) => ({
    ...current,
    [field.key]: nextValue,
  }));

  if (field.kind === 'switch') {
    return <Switch checked={Number(value) === 1} onChange={(checked) => setValue(checked ? 1 : 0)} />;
  }
  if (field.kind === 'pair' || field.kind === 'sittingPair') {
    return (
      <Space.Compact block>
        {[0, 1].map((index) => (
          <InputNumber
            key={index}
            value={value?.[index]}
            onChange={(number) => {
              const pair = Array.isArray(value) ? [...value] : [0, 0];
              pair[index] = number;
              setValue(pair);
            }}
          />
        ))}
      </Space.Compact>
    );
  }
  return <InputNumber value={value} onChange={setValue} />;
};

const activeFields = JQBED_CONFIG_FIELDS.filter((field) => field.group === activeGroup);
```

Map `activeFields` to labeled rows with help text and `validation.errors[field.key]`; display a status badge, localized `savedAt`, and a loading state until the backend envelope arrives. Disable save while loading, invalid or saving. Use `Modal.confirm` or `Popconfirm` before calling `onReset`。

- [ ] **Step 4: 实现已确认的深色样式**

```scss
.jqbedAlgorithmConfig {
  .ant-modal-content,
  .ant-modal-header {
    background: #191932;
  }

  .ant-modal-content {
    max-height: 80vh;
    border: 1px solid #5A5A89;
  }

  &__formScroll {
    overflow-y: auto;
    max-height: calc(80vh - 176px);
  }

  &__footer {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: flex-end;
    background: #191932;
    border-top: 1px solid rgba(90, 90, 137, 0.65);
  }
}
```

Use black input surfaces, `#55aaff` focus/highlight, `#5A5A89` borders, and a modal mask that dims but does not replace the monitor view.

- [ ] **Step 5: 在 Home 接收后端事实状态**

Add initial state:

```js
jqbedAlgorithmConfig: null,
jqbedAlgorithmConfigResult: null,
jqbedAlgorithmStatus: { state: 'waiting', error: null },
```

At the top-level `wsData` message handling, independently merge fields so a payload may include config and status together:

```js
if (jsonObject.jqbedAlgorithmConfig) {
  this.setState({ jqbedAlgorithmConfig: jsonObject.jqbedAlgorithmConfig });
}
if (jsonObject.jqbedAlgorithmConfigResult) {
  this.setState({ jqbedAlgorithmConfigResult: jsonObject.jqbedAlgorithmConfigResult });
}
if (jsonObject.jqbedAlgorithmStatus) {
  this.setState({ jqbedAlgorithmStatus: jsonObject.jqbedAlgorithmStatus });
}
```

Pass these three values to `<Title />`; do not send them to SmallBed rendering components or store them in localStorage.

- [ ] **Step 6: 在 Title 的设置齿轮左侧挂载入口与弹窗**

Import `SlidersOutlined`, `Tooltip`, the modal component, and `getJqbedConfigAccess`. Add only modal open state to Title. Compute access from `matrixName` and `history`, render the icon immediately before the existing option image container, retain the disabled icon during playback, and do not render it for another system.

```jsx
{jqbedConfigAccess.visible ? (
  <Tooltip title={t(jqbedConfigAccess.tooltipKey)}>
    <button
      type="button"
      className="jqbedAlgorithmConfigTrigger"
      disabled={jqbedConfigAccess.disabled}
      onClick={() => this.setState({ jqbedAlgorithmConfigOpen: true })}
      aria-label={t('jqbedAlgorithmConfig.open')}
    >
      <SlidersOutlined />
    </button>
  </Tooltip>
) : null}
```

Wire callbacks to `this.props.wsSendObj(...)`. When `operationResult.ok === false`, keep the modal and draft open; on successful save/reset, use the broadcast envelope to replace the saved draft and show the localized result message.

- [ ] **Step 7: 运行前端专项测试和构建**

Run: `npm --prefix client test -- --run src/components/title/jqbedAlgorithmConfig.test.js src/components/title/JqbedAlgorithmConfigModal.test.js src/i18n/jqbedAlgorithmConfig.test.js`

Expected: PASS。

Run: `npm --prefix client run build`

Expected: exit 0; existing project warnings may remain, but there must be no new JSX, import, translation or Sass error。

- [ ] **Step 8: 提交前端弹窗与接线**

```bash
git add client/src/components/title/JqbedAlgorithmConfigModal.jsx client/src/components/title/jqbedAlgorithmConfig.scss client/src/components/title/JqbedAlgorithmConfigModal.test.js client/src/components/title/Title.jsx client/src/page/home/Home.jsx
git commit -m "新增小床算法配置弹窗"
```

Do not stage `build/` in this task; the final fresh production build is staged in Task 6。

---

### Task 6: 架构文档、正式运行时与端到端验收

**Files:**
- Modify: `ARCHITECTURE.md`
- Regenerate: `build/index.html`
- Regenerate: generated entry bundle under `build/assets/`
- Verify only, do not commit: `python/dist/onbed_server/`, `pack-resources/python/`

**Interfaces:**
- Consumes: all Task 1–5 interfaces。
- Produces: synchronized architecture documentation and production client/Python runtime evidence。

- [ ] **Step 1: 使用 update-tech-doc 技能更新架构文档**

Add a dated changelog row and a focused “Jqbed Algorithm Configuration” section documenting:

```text
Title icon/modal → Home WebSocket → jqbedAlgorithmProtocol
→ jqbedAlgorithmConfig store → server jqbedTimer
→ pyWorker → getData(data, config=None) → onbed_filter.pyd
```

Document the 18 fields and four groups, `userData`/development paths, temp-write-and-rename semantics, next-frame snapshot behavior, `smallBed` isolation, playback disablement, SOS `sosflag` boundary, Python runtime packaging, and the fact that `serial_monitor_updated2.0(1).py` remains a non-runtime untracked reference.

- [ ] **Step 2: 运行完整专项回归**

Run:

```bash
node --test test/jqbedAlgorithmConfig.test.js test/jqbedAlgorithmProtocol.test.js
python -m unittest discover -s python/tests -p "test_onbed_filter_config.py" -v
npm --prefix client test -- --run src/components/title/jqbedAlgorithmConfig.test.js src/components/title/JqbedAlgorithmConfigModal.test.js src/i18n/jqbedAlgorithmConfig.test.js
```

Expected: all three commands exit 0 with all scoped tests passing。

- [ ] **Step 3: 运行邻近回归测试**

Run:

```bash
node --test test/smallBed12B.test.js
npm --prefix client test -- --run src/i18n/japaneseAlerts.test.js src/page/home/speechSynthesis.test.js src/page/home/smallBed12BDisplay.test.js
```

Expected: PASS; jqbed configuration work does not regress 12B display/calibration or alert translations/playback。

- [ ] **Step 4: 新鲜构建前端并检查产物**

Run: `npm --prefix client run build`

Expected: exit 0 and `build/index.html` references the newly generated entry bundle under `build/assets/`。

Run: `git status --short build`

Expected: only the tracked old entry bundle deletion, new entry bundle addition, and `build/index.html` update caused by this fresh build。

- [ ] **Step 5: 构建并同步正式 Python runtime**

Run: `npm run prepare-pack-resources`

Expected: exit 0; `python/dist/onbed_server/onbed_server.exe` and `pack-resources/python/onbed_server/onbed_server.exe` are refreshed on Windows, and the executable responds to the JSON-lines `ping` RPC。

Verify the packaged runtime contract with a single request:

```powershell
'{"id":1,"fn":"ping","args":{}}' | .\pack-resources\python\onbed_server\onbed_server.exe
```

Expected stdout contains one JSON result with `"id": 1`, `"ok": true`, and `"pong": true`; diagnostic text, if any, remains on stderr。

- [ ] **Step 6: 手工验收正式软件交互**

Use a valid `jqbed` license and realtime data, then verify in order:

1. 调节图标只在“小床监测”出现，位于齿轮左侧。
2. 回放时图标置灰，提示“算法参数仅对实时监测生效”。
3. 弹窗约 920px、最大 80vh，SOS 默认选中，表单独立滚动，底栏固定。
4. 后端配置加载后显示全部 18 项、PYD 状态和最后保存时间。
5. 非法输入显示行内错误且保存按钮禁用；绕过前端发送非法 payload 时后端仍拒绝且不改文件。
6. 保存合法值后，磁盘 JSON 和弹窗均显示后端返回值；下一帧 PYD 输入使用新配置。
7. 软件重启后仍加载最后保存值。
8. 恢复默认经过确认、立即生效、写盘，重启后仍为默认值。
9. SOS 参数变化只通过 PYD 返回的 `sosflag` 影响现有告警。
10. 切换到 `smallBed`、`smallBedNoAlg`、`smallBed12B` 后 Python 请求不携带 jqbed 配置。
11. 原始矩阵、采集、回放、CSV 和历史结果保持原行为。
12. 同时打开两个软件窗口时，一处保存后另一处收到后端广播并同步新快照。

- [ ] **Step 7: 检查范围、格式和未跟踪参考文件**

Run:

```bash
git diff --check
git status --short --untracked-files=all
git diff --name-only HEAD~5
```

Expected: no whitespace errors; `python/app/serial_monitor_updated2.0(1).py` remains exactly untracked; no generated Python runtime, temp JSON, local config, database, log, screenshot, or mock server file is staged。

- [ ] **Step 8: 暂存最终文档和生产前端构建并提交**

```bash
git add ARCHITECTURE.md
git add -A build
git diff --cached --check
git commit -m "完成小床监测算法配置功能"
```

Expected: final commit contains only `ARCHITECTURE.md` and the fresh tracked frontend build changes; ignored Python runtime remains outside Git。

- [ ] **Step 9: 最终提交后核验**

Run:

```bash
git status --short --branch
git log --oneline -6
```

Expected: branch contains the six focused implementation commits plus the prior design/plan commits; the only remaining status entry is the intentionally untracked `python/app/serial_monitor_updated2.0(1).py`。
