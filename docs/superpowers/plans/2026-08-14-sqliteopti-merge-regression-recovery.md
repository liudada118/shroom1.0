# sqliteOpti 合并回退业务功能恢复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留当前在线/离线授权体系的前提下，恢复小床监测12B完整kPa数据链、采集批量写入、历史时间元数据、CSV BOM和 `matCol` 原始数据显示。

**Architecture:** 将12B协议/压强处理、采集写入队列和CSV编码分别提取为可独立测试的 CommonJS 小模块，`server.js` 只负责串口、WebSocket和数据库入口编排。前端新增纯配置模块统一12B显示选项，`Home.jsx` 恢复状态、消息和渲染接线，不修改当前 `licenseManager` 授权路径。

**Tech Stack:** Node.js CommonJS、Node `node:test`、Electron/SerialPort/WebSocket、SQLite兼容层、React 19、Vitest、Vite。

## Global Constraints

- 当前工作分支为 `sqliteOpti`；不得整体还原 `deb42c3` 文件或撤销 `b56a854` 的授权体系。
- 所有数据入口继续使用 `licenseManager.isLicenseValid()`；禁止恢复 `nowDate < endDate`、旧时间服务器和旧 `persistLicenseKey()`。
- 12B协议保持1500000波特率、2048字节payload、1024个 `uint16LE` 点、现有 `jqbed` 线序和现有清零行为。
- V2.7.54参数固定为 `P_MAX=25`、`K=0.010637`、`MID=438.05`、`HUMAN_FACTOR=2`、`FILTER_THRESHOLD=30`。
- 12B标定结果统一保留1位小数；新存储帧带 `pressureUnit: "kPa"`，旧无单位帧按ADC标定一次。
- 不改变数据库表结构；批量写入默认200行或250ms刷新。
- 左侧统计只能使用协议解析、线序归一化和压强标定后的原始矩阵，不使用3D插值、高斯或渲染数组。
- 不新增第三方依赖。
- 代码修改完成后必须增量更新 `ARCHITECTURE.md`，不删除既有进度和日志。

---

### Task 1: 建立可测试的12B协议与压强模块

**Files:**
- Create: `server/smallBed12B.js`
- Create: `test/smallBed12B.test.js`
- Read-only dependency: `util/pressureCalibration_V2.7.54.js`

**Interfaces:**
- Consumes: `estimatePointPressure(adcAvg, adcPoint)`、标定阈值、可选线序函数、清零函数、转置函数。
- Produces: `readAdcFrame`、`applyPressureCalibration`、`normalizePressureData`、`normalizeDisplayOptions`、`buildRealtimeFrame`、`buildRealtimeFrameFromBuffer`、`buildCollectionStorageData`、`isPressureStoredData`。

- [ ] **Step 1: 写协议读取与压强标定失败测试**

```js
// test/smallBed12B.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const smallBed12B = require('../server/smallBed12B');

test('12B使用阈值以上点求平均并把每点压强保留1位', () => {
  const calls = [];
  const result = smallBed12B.applyPressureCalibration([0, 30, 40, 60], {
    filterThreshold: 30,
    estimatePointPressure(adcAvg, adcPoint) {
      calls.push([adcAvg, adcPoint]);
      return adcPoint / 3;
    },
  });
  assert.equal(calls[0][0], 50);
  assert.deepEqual(result, [0, 0, 13.3, 20]);
});

test('没有有效ADC点时返回等长全零矩阵', () => {
  assert.deepEqual(smallBed12B.applyPressureCalibration([NaN, -1, 30], {
    filterThreshold: 30,
    estimatePointPressure() { throw new Error('不应调用'); },
  }), [0, 0, 0]);
});

test('2048字节帧按uint16LE读取1024点', () => {
  const buffer = Buffer.alloc(2048);
  buffer.writeUInt16LE(513, 0);
  buffer.writeUInt16LE(4095, 2046);
  const frame = smallBed12B.readAdcFrame(buffer);
  assert.equal(frame.length, 1024);
  assert.equal(frame[0], 513);
  assert.equal(frame[1023], 4095);
  assert.equal(smallBed12B.readAdcFrame(Buffer.alloc(2047)), null);
});
```

- [ ] **Step 2: 运行测试确认RED**

Run: `node --test test/smallBed12B.test.js`

Expected: FAIL，原因是 `../server/smallBed12B` 尚不存在。

- [ ] **Step 3: 实现数值规整、协议读取和一次标定**

```js
// server/smallBed12B.js
const TYPE = 'smallBed12B';
const PAYLOAD_LENGTH = 2048;
const VALID_SAMPLE_POINTS = new Set(['topLeft', 'topRight', 'bottomLeft', 'bottomRight']);

const toFiniteNonNegative = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
};
const roundPressureValue = (value) => Number(toFiniteNonNegative(value).toFixed(1));

function readAdcFrame(buffer) {
  const source = Buffer.from(buffer || []);
  if (source.length !== PAYLOAD_LENGTH) return null;
  return Array.from({ length: 1024 }, (_, index) => source.readUInt16LE(index * 2));
}

function applyPressureCalibration(data, { estimatePointPressure, filterThreshold = 30 } = {}) {
  const adcData = Array.isArray(data) ? data.map(toFiniteNonNegative) : [];
  const valid = adcData.filter((value) => value > filterThreshold);
  if (!valid.length) return adcData.map(() => 0);
  const adcAvg = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  return adcData.map((value) => value > filterThreshold
    ? roundPressureValue(estimatePointPressure(adcAvg, value))
    : 0);
}
```

- [ ] **Step 4: 写历史单位、32/16显示和整帧处理失败测试**

```js
test('带kPa单位的历史帧不会重复标定', () => {
  const stored = { pressureUnit: 'kPa', sitData: [1.24, 2.26] };
  assert.deepEqual(smallBed12B.normalizePressureData(stored.sitData, stored, {
    estimatePointPressure() { throw new Error('不应重复标定'); },
    filterThreshold: 30,
  }), [1.2, 2.3]);
});

test('16x16实时帧携带尺寸方向单位和256点', () => {
  const pressure = Array.from({ length: 1024 }, (_, index) => index);
  const frame = smallBed12B.buildRealtimeFrame(pressure, {
    displayOptions: { matrixMode: '16x16', samplePoint: 'bottomRight' },
    hz: 12,
    transposeSquareMatrix: (data) => data,
  });
  assert.equal(frame.sitData.length, 256);
  assert.equal(frame.matrixWidth, 16);
  assert.equal(frame.matrixHeight, 16);
  assert.equal(frame.pressureUnit, 'kPa');
  assert.equal(frame.matrixOrientation, 'transposed');
  assert.equal(frame.matrixDownsample.samplePoint, 'bottomRight');
});

test('整帧处理依次执行线序、清零和压强标定', () => {
  const buffer = Buffer.alloc(2048);
  buffer.writeUInt16LE(50, 0);
  const result = smallBed12B.buildRealtimeFrameFromBuffer(buffer, {
    lineOrder: (data) => data,
    zeroFrame: [10],
    subtractZero: (value) => Math.max(0, value),
    calibration: { filterThreshold: 30, estimatePointPressure: (_, value) => value / 10 },
    displayOptions: { matrixMode: '32x32' },
    hz: 12,
    transposeSquareMatrix: (data) => data,
  });
  assert.equal(result.zeroedFrame[0], 40);
  assert.equal(result.pressureData[0], 4);
  assert.equal(result.realtimeFrame.sitData[0], 4);
});
```

- [ ] **Step 5: 实现历史、显示和存储接口**

```js
function isPressureStoredData(frame) {
  return Boolean(frame && !Array.isArray(frame) &&
    [frame.pressureUnit, frame.dataUnit, frame.unit].includes('kPa'));
}

function normalizePressureData(data, frame, calibration) {
  const normalized = Array.isArray(data) ? data.map(toFiniteNonNegative) : [];
  return isPressureStoredData(frame)
    ? normalized.map(roundPressureValue)
    : applyPressureCalibration(normalized, calibration);
}

function normalizeDisplayOptions(options = {}) {
  return {
    matrixMode: options.matrixMode === '16x16' ? '16x16' : '32x32',
    samplePoint: VALID_SAMPLE_POINTS.has(options.samplePoint) ? options.samplePoint : 'topLeft',
  };
}

function getDownsampleOffset(samplePoint) {
  return {
    topLeft: [0, 0], topRight: [0, 1],
    bottomLeft: [1, 0], bottomRight: [1, 1],
  }[normalizeDisplayOptions({ samplePoint }).samplePoint];
}

function downsampleMatrixByPoint(data, samplePoint) {
  const [rowOffset, colOffset] = getDownsampleOffset(samplePoint);
  return Array.from({ length: 16 }, (_, row) =>
    Array.from({ length: 16 }, (_, col) =>
      data[(row * 2 + rowOffset) * 32 + col * 2 + colOffset] || 0,
    ),
  ).flat();
}

function buildRealtimeFrame(pressureData, { displayOptions, hz, transposeSquareMatrix }) {
  const options = normalizeDisplayOptions(displayOptions);
  if (options.matrixMode === '32x32') {
    return {
      sitData: pressureData, rawSitData: pressureData, pressureData,
      matrixWidth: 32, matrixHeight: 32, pressureUnit: 'kPa', hz,
    };
  }
  const transposed = transposeSquareMatrix(pressureData, 32);
  const downsampled = downsampleMatrixByPoint(transposed, options.samplePoint);
  return {
    sitData: downsampled, rawSitData: downsampled, pressureData: downsampled,
    matrixWidth: 16, matrixHeight: 16,
    sourceMatrixWidth: 32, sourceMatrixHeight: 32,
    matrixOrientation: 'transposed', pressureUnit: 'kPa', hz,
    matrixDownsample: {
      enabled: true, samplePoint: options.samplePoint,
      displaySamplePoint: options.samplePoint, blockWidth: 2, blockHeight: 2,
    },
  };
}

function buildRealtimeFrameFromBuffer(buffer, options = {}) {
  const adcFrame = readAdcFrame(buffer);
  if (!adcFrame) return null;
  const orderedFrame = typeof options.lineOrder === 'function' ? options.lineOrder(adcFrame) : adcFrame;
  const zeroedFrame = options.zeroFrame?.length
    ? orderedFrame.map((value, index) => options.subtractZero(value - (options.zeroFrame[index] || 0)))
    : [...orderedFrame];
  const pressureData = applyPressureCalibration(zeroedFrame, options.calibration);
  return {
    adcFrame, orderedFrame, zeroedFrame, pressureData,
    realtimeFrame: buildRealtimeFrame(pressureData, options),
  };
}

function buildCollectionStorageData(frame, { collectOptions = {}, transposeSquareMatrix } = {}) {
  const source = Array.isArray(frame?.sitData) ? frame.sitData : [];
  const shouldDownsample = collectOptions.matrixDownsample?.enabled === true && source.length === 1024;
  const samplePoint = normalizeDisplayOptions({
    samplePoint: collectOptions.matrixDownsample?.samplePoint,
  }).samplePoint;
  const data = shouldDownsample
    ? downsampleMatrixByPoint(transposeSquareMatrix(source, 32), samplePoint)
    : source;
  const width = shouldDownsample ? 16 : (Number(frame?.matrixWidth) || 32);
  const height = shouldDownsample ? 16 : (Number(frame?.matrixHeight) || 32);
  return JSON.stringify({
    sitData: data, pressureData: data,
    matrixWidth: width, matrixHeight: height,
    sourceMatrixWidth: frame?.sourceMatrixWidth,
    sourceMatrixHeight: frame?.sourceMatrixHeight,
    matrixOrientation: shouldDownsample ? 'transposed' : frame?.matrixOrientation,
    pressureUnit: 'kPa',
    matrixDownsample: shouldDownsample ? {
      enabled: true, samplePoint, displaySamplePoint: samplePoint,
      blockWidth: 2, blockHeight: 2,
    } : frame?.matrixDownsample,
  });
}

module.exports = {
  TYPE, PAYLOAD_LENGTH, readAdcFrame, applyPressureCalibration,
  isPressureStoredData, normalizePressureData, normalizeDisplayOptions,
  buildRealtimeFrame, buildRealtimeFrameFromBuffer, buildCollectionStorageData,
  roundPressureValue,
};
```

- [ ] **Step 6: 运行GREEN与公式烟测**

Run: `node --test test/smallBed12B.test.js`

Run: `node -e "const c=require('./util/pressureCalibration_V2.7.54'); const s=require('./server/smallBed12B'); console.log(s.applyPressureCalibration([438], {estimatePointPressure:c.estimatePointPressure, filterThreshold:c.FILTER_THRESHOLD}))"`

Expected: 测试全部PASS；烟测输出一个1位小数kPa数组。

- [ ] **Step 7: 提交Task 1**

```powershell
git add -- server/smallBed12B.js test/smallBed12B.test.js
git commit -m "恢复小床12B压强处理模块"
```

---

### Task 2: 将12B模块接回实时、采集、回放和统计

**Files:**
- Modify: `server.js:80-90,601-610,660-830,1958-2088,3300-3400,7493-7513`
- Modify: `test/smallBed12B.test.js`

**Interfaces:**
- Consumes: Task 1 导出的12B模块；`estimatePointPressure`、`FILTER_THRESHOLD`、`jqbed`、`numLessZeroToZero`、`transposeSquareMatrix`。
- Produces: `smallBed12BCalibration`、`smallBed12BDisplayOptions`，以及实时/采集/回放/CSV统一的kPa帧。

- [ ] **Step 1: 增加存储与旧历史兼容失败测试**

```js
test('新采集帧始终保存kPa单位和矩阵元数据', () => {
  const saved = JSON.parse(smallBed12B.buildCollectionStorageData({
    sitData: [1.2, 3.4], matrixWidth: 16, matrixHeight: 16,
    matrixOrientation: 'transposed', matrixDownsample: { enabled: true },
  }, { collectOptions: { matrixDownsample: { enabled: true } } }));
  assert.equal(saved.pressureUnit, 'kPa');
  assert.equal(saved.matrixWidth, 16);
  assert.deepEqual(saved.pressureData, [1.2, 3.4]);
});

test('旧ADC历史帧转换一次而新kPa历史帧只舍入', () => {
  const calibration = { filterThreshold: 30, estimatePointPressure: (_, value) => value / 10 };
  assert.deepEqual(smallBed12B.normalizePressureData([40], [40], calibration), [4]);
  assert.deepEqual(smallBed12B.normalizePressureData([4.04], { pressureUnit: 'kPa' }, calibration), [4]);
});
```

- [ ] **Step 2: 运行测试确认RED**

Run: `node --test test/smallBed12B.test.js`

Expected: FAIL，存储接口尚未完整保留单位/尺寸或旧历史兼容断言不通过。

- [ ] **Step 3: 在 `server.js` 保留授权判断并接入12B运行时**

```js
const smallBed12B = require('./server/smallBed12B');
const {
  estimatePointPressure,
  FILTER_THRESHOLD: PRESSURE_CALIBRATION_FILTER_THRESHOLD,
} = require('./util/pressureCalibration_V2.7.54');

const smallBed12BCalibration = {
  estimatePointPressure,
  filterThreshold: PRESSURE_CALIBRATION_FILTER_THRESHOLD,
};
let smallBed12BDisplayOptions = { matrixMode: '32x32', samplePoint: 'topLeft' };
```

在所有WebSocket消息入口解析一次配置：

```js
if (getMessage.smallBed12BDisplayOptions != null) {
  smallBed12BDisplayOptions = smallBed12B.normalizeDisplayOptions(
    getMessage.smallBed12BDisplayOptions,
  );
}
```

替换12B串口处理主体，但保留现有授权条件：

```js
if (licenseManager.isLicenseValid() && file === SMALL_BED_12B_TYPE) {
  const frame = smallBed12B.buildRealtimeFrameFromBuffer(buffer, {
    lineOrder: jqbed,
    zeroFrame: pointArr1zero,
    subtractZero: numLessZeroToZero,
    calibration: smallBed12BCalibration,
    displayOptions: smallBed12BDisplayOptions,
    hz: colHZ,
    transposeSquareMatrix,
  });
  if (!frame) return;
  pointArr1zeroData = [...frame.orderedFrame];
  pointArr = frame.pressureData;
  newData = [...frame.pressureData];
  colOrSendData(JSON.stringify(frame.realtimeFrame));
}
```

- [ ] **Step 4: 统一历史、采集和统计入口**

```js
function normalizeHistoryPressureData(row, targetFile = '') {
  const storedData = parseStoredFrameData(row);
  const data = getHistoryPressureData(row);
  if (targetFile === SMALL_BED_12B_TYPE) {
    return smallBed12B.normalizePressureData(data, storedData, smallBed12BCalibration);
  }
  // 保留现有手套裁剪和温度全床阈值逻辑。
}
```

`buildSmallBed12BCollectionStorageData()` 委托 `smallBed12B.buildCollectionStorageData()`；`buildSmallBedPlaybackPayload()` 对旧帧调用 `normalizeHistoryPressureData()`，对16×16帧保持16×16及元数据；`getHistorySeries()` 对12B总值使用 `formatMatrixTotalForFile()`，不调用 `totalToN()`。

- [ ] **Step 5: 恢复历史时间与12B零帧元数据**

```js
function buildZeroPlaybackPayload() {
  if (file !== SMALL_BED_12B_TYPE) return { sitData: buildZeroPlaybackFrame() };
  const size = smallBed12BDisplayOptions.matrixMode === '16x16' ? 16 : 32;
  return {
    sitData: new Array(size * size).fill(0),
    matrixWidth: size,
    matrixHeight: size,
    pressureUnit: 'kPa',
  };
}
```

在历史选择广播中加入：

```js
historyTimeArr: historySeries.time,
...buildZeroPlaybackPayload(),
```

- [ ] **Step 6: 运行模块测试和服务器语法检查**

Run: `node --test test/smallBed12B.test.js`

Run: `node --check server.js`

Expected: 全部PASS，`server.js` 无语法错误。

- [ ] **Step 7: 提交Task 2**

```powershell
git add -- server.js test/smallBed12B.test.js
git commit -m "接回小床12B实时采集回放链路"
```

---

### Task 3: 恢复前端12B显示设置、历史时间和matCol原始数据

**Files:**
- Create: `client/src/page/home/smallBed12BDisplay.js`
- Create: `client/src/page/home/smallBed12BDisplay.test.js`
- Modify: `client/src/page/home/Home.jsx:400-700,780-850,1342-1363,2330-2360,3000-3041,3980-4020,4093-4110,4910-4922`

**Interfaces:**
- Consumes: `localStorage`中 `smallBed12BRealtimeMatrixMode`、`smallBed12BRealtimeSamplePoint`；Title现有 `changeStateData` 和 `wsSendObj`。
- Produces: `normalizeMatrixMode`、`normalizeSamplePoint`、`getMatrixSize`、`getDisplayOptions`、`getInitialDisplayState`。

- [ ] **Step 1: 写12B配置失败测试**

```js
// client/src/page/home/smallBed12BDisplay.test.js
import { describe, expect, it } from 'vitest';
import {
  getDisplayOptions, getInitialDisplayState, getMatrixSize,
  normalizeMatrixMode, normalizeSamplePoint, normalizeRendererConfig,
} from './smallBed12BDisplay';

describe('smallBed12B display options', () => {
  it('只接受32x32或16x16', () => {
    expect(normalizeMatrixMode('16x16')).toBe('16x16');
    expect(normalizeMatrixMode('8x8')).toBe('32x32');
  });
  it('无效采样点回退topLeft', () => {
    expect(normalizeSamplePoint('bottomRight')).toBe('bottomRight');
    expect(normalizeSamplePoint('center')).toBe('topLeft');
  });
  it('16x16返回匹配尺寸与WS配置', () => {
    expect(getMatrixSize('16x16')).toEqual({ width: 16, height: 16 });
    expect(getDisplayOptions('16x16', 'topRight')).toEqual({
      matrixMode: '16x16', samplePoint: 'topRight',
    });
  });
  it('从缓存恢复设置', () => {
    const storage = { getItem: (key) => key.includes('MatrixMode') ? '16x16' : 'bottomLeft' };
    expect(getInitialDisplayState(storage)).toMatchObject({
      smallBed12BRealtimeMatrixMode: '16x16',
      smallBed12BRealtimeSamplePoint: 'bottomLeft',
      smallBedMatrixWidth: 16,
      smallBedMatrixHeight: 16,
    });
  });
  it('把旧ADC色阶缓存迁移回kPa默认值', () => {
    expect(normalizeRendererConfig({
      valueg1: 2, valuej1: 2205, valuel1: 5,
      valuef1: 6, value1: 0.1, valuelInit1: 500,
    })).toEqual({
      valueg1: 2, valuej1: 25, valuel1: 2,
      valuef1: 0, value1: 0.1, valuelInit1: 0,
    });
  });
});
```

- [ ] **Step 2: 运行测试确认RED**

Run: `npm --prefix client test -- --run src/page/home/smallBed12BDisplay.test.js`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现纯配置模块**

```js
const VALID_SAMPLE_POINTS = new Set(['topLeft', 'topRight', 'bottomLeft', 'bottomRight']);
export const normalizeMatrixMode = (value) => value === '16x16' ? '16x16' : '32x32';
export const normalizeSamplePoint = (value) => VALID_SAMPLE_POINTS.has(value) ? value : 'topLeft';
export const getMatrixSize = (mode) => {
  const size = normalizeMatrixMode(mode) === '16x16' ? 16 : 32;
  return { width: size, height: size };
};
export const getDisplayOptions = (mode, samplePoint) => ({
  matrixMode: normalizeMatrixMode(mode),
  samplePoint: normalizeSamplePoint(samplePoint),
});
export const DEFAULT_RENDERER_CONFIG = {
  valueg1: 2, valuej1: 25, valuel1: 2,
  valuef1: 0, value1: 0.1, valuelInit1: 0,
};
export function normalizeRendererConfig(config = {}) {
  const next = { ...DEFAULT_RENDERER_CONFIG, ...config };
  if (Number(next.valuej1) > 30 || [30, 80, 2205, 4000].includes(Number(next.valuej1))) next.valuej1 = 25;
  if ([5].includes(Number(next.valuel1))) next.valuel1 = 2;
  if ([6].includes(Number(next.valuef1))) next.valuef1 = 0;
  if ([500].includes(Number(next.valuelInit1))) next.valuelInit1 = 0;
  return next;
}
export function getInitialDisplayState(storage = globalThis.localStorage) {
  const matrixMode = normalizeMatrixMode(storage?.getItem('smallBed12BRealtimeMatrixMode'));
  const samplePoint = normalizeSamplePoint(storage?.getItem('smallBed12BRealtimeSamplePoint'));
  const { width, height } = getMatrixSize(matrixMode);
  return {
    smallBed12BRealtimeMatrixMode: matrixMode,
    smallBed12BRealtimeSamplePoint: samplePoint,
    smallBedMatrixWidth: width,
    smallBedMatrixHeight: height,
  };
}
```

- [ ] **Step 4: 在Home恢复接线**

构造函数合并 `...getInitialDisplayState()`；切换系统时给12B发送：

```js
const smallBed12BDisplayOptions = getDisplayOptions(
  this.state.smallBed12BRealtimeMatrixMode,
  this.state.smallBed12BRealtimeSamplePoint,
);
this.wsSendObj(nextMatrixName === SMALL_BED_12B_MATRIX
  ? { file: nextMatrixName, smallBed12BDisplayOptions }
  : { file: nextMatrixName });
```

`initConfig.smallBed12B` 使用 `DEFAULT_RENDERER_CONFIG`，`getConfig()` 对12B调用 `normalizeRendererConfig()`；`getDefaultModeForMatrix()` 对12B固定返回 `numoriginal`，对 `matCol` 保留 `normal/numoriginal`。向 `Title` 传入两个设置prop；收到 `historyTimeArr` 时存入state；向 `ProgressCom` 传入 `timeArr` 与 `historyTimeArr`。

将 `matCol` 纳入 `displayRendererConfigMatrixArr` 和 `numoriginal` 的 `Fast1024` 分支，并固定：

```jsx
matrixWidth={this.state.matrixName === 'matCol'
  ? 16
  : this.state.matrixName === SMALL_BED_12B_MATRIX ? this.state.smallBedMatrixWidth : undefined}
matrixHeight={this.state.matrixName === 'matCol'
  ? 10
  : this.state.matrixName === SMALL_BED_12B_MATRIX ? this.state.smallBedMatrixHeight : undefined}
```

- [ ] **Step 5: 运行前端专项测试和构建**

Run: `npm --prefix client test -- --run src/page/home/smallBed12BDisplay.test.js`

Run: `npm --prefix client run build`

Expected: 专项测试PASS；Vite构建成功。允许既有Sass legacy、duplicate key和大chunk警告，但不得新增目标文件语法警告。

- [ ] **Step 6: 提交Task 3**

```powershell
git add -- client/src/page/home/smallBed12BDisplay.js client/src/page/home/smallBed12BDisplay.test.js client/src/page/home/Home.jsx build
git commit -m "恢复12B显示配置与历史时间接线"
```

---

### Task 4: 恢复SQLite采集批量写入

**Files:**
- Create: `server/collectionInsertQueue.js`
- Create: `test/collectionInsertQueue.test.js`
- Modify: `server.js:110-125,1650-1750,7516-7600,7600-8350`

**Interfaces:**
- Consumes: 数据库包装对象的 `run(sql, params, callback)`，可选原生 `_db/db.prepare()` 与 `transaction()`。
- Produces: `createCollectionInsertQueue({ sql, batchSize, flushIntervalMs, onError })`，返回 `enqueue`、`flushAll`、`close`。

- [ ] **Step 1: 写阈值、定时、错误失败测试**

```js
// test/collectionInsertQueue.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCollectionInsertQueue } = require('../server/collectionInsertQueue');

test('达到批量阈值立即写入', () => {
  const rows = [];
  const db = { run: (_sql, params, cb) => { rows.push(params); cb?.(null); } };
  const queue = createCollectionInsertQueue({ sql: 'INSERT', batchSize: 2, flushIntervalMs: 60000 });
  queue.enqueue(db, [1], 'sit');
  assert.equal(rows.length, 0);
  queue.enqueue(db, [2], 'sit');
  assert.deepEqual(rows, [[1], [2]]);
  queue.close();
});

test('flushAll写入未满批次并把错误交给onError', () => {
  const errors = [];
  const db = { run: (_sql, _params, cb) => cb(new Error('disk full')) };
  const queue = createCollectionInsertQueue({ sql: 'INSERT', onError: (error, channel) => errors.push([error.message, channel]) });
  queue.enqueue(db, [1], 'back');
  queue.flushAll();
  assert.deepEqual(errors, [['disk full', 'back']]);
  queue.close();
});
```

- [ ] **Step 2: 运行测试确认RED**

Run: `node --test test/collectionInsertQueue.test.js`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现队列服务**

```js
function createCollectionInsertQueue({ sql, batchSize = 200, flushIntervalMs = 250, onError } = {}) {
  const queues = new Set();
  const queueByDb = new WeakMap();
  let timer = null;

  function getQueue(dbRef, channel) {
    if (!dbRef) return null;
    let queue = queueByDb.get(dbRef);
    if (!queue) {
      queue = { dbRef, channel, rows: [], flushing: false, stmt: null, tx: null };
      queueByDb.set(dbRef, queue);
      queues.add(queue);
    }
    queue.channel = channel || queue.channel;
    return queue;
  }

  function report(error, channel) {
    if (error && typeof onError === 'function') onError(error, channel);
  }

  function flushQueue(queue) {
    if (!queue || queue.flushing || !queue.rows.length) return;
    const rows = queue.rows.splice(0);
    queue.flushing = true;
    try {
      const nativeDb = queue.dbRef._db || queue.dbRef.db;
      if (nativeDb?.prepare && nativeDb?.transaction) {
        queue.stmt ||= nativeDb.prepare(sql);
        queue.tx ||= nativeDb.transaction((batch) => batch.forEach((params) => queue.stmt.run(...params)));
        queue.tx(rows);
      } else {
        rows.forEach((params) => queue.dbRef.run(sql, params, function callback(error) {
          report(error, queue.channel);
        }));
      }
    } catch (error) {
      report(error, queue.channel);
    } finally {
      queue.flushing = false;
    }
  }

  function flushAll() { queues.forEach(flushQueue); }
  function ensureTimer() {
    if (timer) return;
    timer = setInterval(flushAll, flushIntervalMs);
    timer.unref?.();
  }
  function enqueue(dbRef, params, channel = 'sit') {
    const queue = getQueue(dbRef, channel);
    if (!queue) return;
    queue.rows.push(params);
    if (queue.rows.length >= batchSize) flushQueue(queue);
    else ensureTimer();
  }
  function close() {
    flushAll();
    if (timer) clearInterval(timer);
    timer = null;
  }
  return { enqueue, flushAll, close };
}

module.exports = { createCollectionInsertQueue };
```

实现时必须保证回调式 `db.run` 使用普通函数回调读取错误，事务异常与回调错误均调用 `onError(error, channel)`，`close()` 可重复调用。

- [ ] **Step 4: 在server.js替换逐帧db.run**

```js
const COLLECTION_INSERT_SQL = 'INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)';
const collectionInsertQueue = createCollectionInsertQueue({
  sql: COLLECTION_INSERT_SQL,
  batchSize: Number(process.env.SHROOM_COLLECTION_INSERT_BATCH_SIZE) || 200,
  flushIntervalMs: Number(process.env.SHROOM_COLLECTION_INSERT_FLUSH_INTERVAL_MS) || 250,
  onError: handleCollectionDbError,
});
```

所有 sit/back/head 采集写入改用 `collectionInsertQueue.enqueue(dbRef, params, channel)`；停止采集、空间不足和服务shutdown调用 `flushAll()`，最终退出调用 `close()`。

- [ ] **Step 5: 运行测试和语法检查**

Run: `node --test test/collectionInsertQueue.test.js`

Run: `node --check server.js`

Expected: 全部PASS。

- [ ] **Step 6: 提交Task 4**

```powershell
git add -- server/collectionInsertQueue.js test/collectionInsertQueue.test.js server.js
git commit -m "恢复采集数据批量写入"
```

---

### Task 5: 恢复CSV UTF-8 BOM并锁定matCol方向

**Files:**
- Create: `server/csvUtf8.js`
- Create: `server/csvMatrixUtils.js`
- Create: `test/csvUtf8.test.js`
- Modify: `server.js:15,1000-1070,1200-1300,2113-2230,2278-2347,2800-2860,5200-6200`

**Interfaces:**
- Consumes: `csv-writer.createObjectCsvStringifier`、Node `fs`。
- Produces: `CSV_UTF8_BOM`、`writeCsvRecordsWithBom`、`createUtf8BomCsvWriter`、`prefixCsvHeaderWithBom`、`transposeMatColToVisualDirection`、`getCollectionCsvLabelInfo`。

- [ ] **Step 1: 写BOM文件失败测试**

```js
// test/csvUtf8.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createUtf8BomCsvWriter, CSV_UTF8_BOM } = require('../server/csvUtf8');
const {
  getCollectionCsvLabelInfo,
  transposeMatColToVisualDirection,
} = require('../server/csvMatrixUtils');

test('CSV文件以UTF-8 BOM开头并保留中文', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-csv-'));
  const file = path.join(dir, 'test.csv');
  try {
    await createUtf8BomCsvWriter({ path: file, header: [{ id: 'name', title: '名称' }] })
      .writeRecords([{ name: '小床' }]);
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(content[0], CSV_UTF8_BOM);
    assert.match(content, /名称/);
    assert.match(content, /小床/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: 运行测试确认RED**

Run: `node --test test/csvUtf8.test.js`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现BOM写入器**

```js
const fs = require('node:fs');
const { createObjectCsvStringifier } = require('csv-writer');
const CSV_UTF8_BOM = '\ufeff';

async function writeCsvRecordsWithBom(csvFilePath, header, records = []) {
  const stringifier = createObjectCsvStringifier({ header });
  const content = CSV_UTF8_BOM + stringifier.getHeaderString() + stringifier.stringifyRecords(records);
  await fs.promises.writeFile(csvFilePath, content, 'utf8');
}
function createUtf8BomCsvWriter({ path, header }) {
  return { writeRecords: (records) => writeCsvRecordsWithBom(path, header, records) };
}
const prefixCsvHeaderWithBom = (headerText) => CSV_UTF8_BOM + headerText;
module.exports = { CSV_UTF8_BOM, writeCsvRecordsWithBom, createUtf8BomCsvWriter, prefixCsvHeaderWithBom };
```

- [ ] **Step 4: 在所有CSV路径接入BOM并验证现有matCol逻辑**

将 `createObjectCsvWriter` 调用替换为 `createUtf8BomCsvWriter`；所有流式导出的首个header chunk改为：

```js
await writeStreamChunk(stream, prefixCsvHeaderWithBom(stringifier.getHeaderString()));
```

保留当前已存在的 `getCollectionCsvLabelInfo()`、`labelText`、`transposeMatColToVisualDirection()` 和 `formatMatColCsvRealData()`；修正 `buildGenericSitCsvRow()`：12B先调用 `normalizeHistoryPressureData()`，转置判断使用 `matrixOrientation !== 'transposed'`，总压强使用 `formatMatrixTotalForFile()`。

- [ ] **Step 5: 增加matCol方向和标签回归断言**

把 `transposeMatColToVisualDirection` 与 `getCollectionCsvLabelInfo` 移入 `server/csvMatrixUtils.js`，`server.js` 从该模块导入；实现固定为：

```js
function transposeMatColToVisualDirection(data) {
  const source = Array.isArray(data) ? data : [];
  if (source.length !== 160) return source;
  return Array.from({ length: 10 }, (_, row) =>
    Array.from({ length: 16 }, (_, col) => source[col * 10 + row]),
  ).flat();
}

function getCollectionCsvLabelInfo(value, formatDatePart) {
  const datePart = formatDatePart(value);
  const namePart = datePart.replace(/_\d{4}-\d{1,2}-\d{1,2}-\d{2}-\d{2}-\d{2}-\d+$/, '');
  if (!namePart || (namePart === datePart && /^\d+$/.test(namePart))) {
    return { label: '', labelText: '' };
  }
  const labelText = namePart.match(/([^_]+_\d+)$/)?.[1] || '';
  const label = labelText.match(/_(\d+)$/)?.[1] || '';
  return { label, labelText };
}

module.exports = { transposeMatColToVisualDirection, getCollectionCsvLabelInfo };
```

增加测试：

```js
test('matCol把16行10列存储数据转成10行16列视觉方向', () => {
  const source = Array.from({ length: 160 }, (_, index) => index);
  const result = transposeMatColToVisualDirection(source);
  assert.equal(result.length, 160);
  assert.deepEqual(result.slice(0, 4), [0, 10, 20, 30]);
});

test('采集名称解析数字label和完整labelText', () => {
  assert.deepEqual(getCollectionCsvLabelInfo(
    '样本_硬度_3_2026-06-30-10-00-00-1',
    (value) => value,
  ), {
    label: '3', labelText: '硬度_3',
  });
});
```

- [ ] **Step 6: 运行CSV测试和服务器语法检查**

Run: `node --test test/csvUtf8.test.js`

Run: `node --check server.js`

Expected: 全部PASS。

- [ ] **Step 7: 提交Task 5**

```powershell
git add -- server/csvUtf8.js server/csvMatrixUtils.js test/csvUtf8.test.js server.js
git commit -m "恢复CSV编码与小床褥方向回归"
```

---

### Task 6: 架构文档、完整回归与构建产物

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify generated files only if build changes them: `build/index.html`, `build/assets/*`

**Interfaces:**
- Consumes: Tasks 1-5完成的代码和测试结果。
- Produces: 与实现一致的架构说明、更新日志、项目进度和可发布前端构建。

- [ ] **Step 1: 增量更新架构文档**

在小床12B章节明确记录：

```markdown
- `smallBed12B` 在 `licenseManager.isLicenseValid()` 通过后解析2048字节帧，执行 `jqbed` 线序、清零和 V2.7.54 标定；实时、统计、采集、回放和CSV统一使用带 `pressureUnit: kPa` 的1位小数矩阵。旧无单位历史帧按ADC标定一次，新kPa帧不重复转换。
- 12B实时显示支持32x32与16x16指定角采样；设置由Title缓存、Home下发、server统一构帧。SQLite采集按200行或250ms批量落库，停止和退出前刷新。
```

追加2026-08-14项目进度与更新日志，不修改或删除旧记录；顶部最后更新日期改为2026-08-14。

- [ ] **Step 2: 运行后端全部新增测试**

Run: `node --test test/smallBed12B.test.js test/collectionInsertQueue.test.js test/csvUtf8.test.js`

Expected: 全部PASS，无警告和未处理Promise拒绝。

- [ ] **Step 3: 运行前端专项测试**

Run: `npm --prefix client test -- --run src/page/home/smallBed12BDisplay.test.js`

Expected: PASS。不要运行会被基线 `App.test.jsx` 缺失依赖干扰的无筛选全集，除非先确认依赖已经存在。

- [ ] **Step 4: 运行语法、差异和构建验证**

Run: `node --check server.js`

Run: `git diff --check`

Run: `npm --prefix client run build`

Expected: 三条命令退出码0；构建只允许记录既有警告。

- [ ] **Step 5: 核对授权边界与数据链静态证据**

Run: `rg -n "nowDate < endDate|pressureCalibration_V2.7.54|smallBed12BDisplayOptions|pressureUnit|licenseManager.isLicenseValid|collectionInsertQueue|prefixCsvHeaderWithBom" server.js server client/src/page/home/Home.jsx`

Expected: 12B入口仍由 `licenseManager.isLicenseValid()` 保护；存在标定、显示配置、单位、批量队列和BOM调用；不存在恢复出的 `nowDate < endDate`。

- [ ] **Step 6: 检查构建产物和工作树范围**

Run: `git status --short`

Run: `git diff --stat`

Expected: 仅计划内源文件、测试、`ARCHITECTURE.md`和本次新构建bundle有变化；无数据库、日志、临时CSV或授权文件。

- [ ] **Step 7: 提交最终文档与构建**

```powershell
git add -- ARCHITECTURE.md build
git commit -m "完成合并回退业务功能恢复验证"
```

- [ ] **Step 8: 最终提交核对**

Run: `git status --short --branch`

Run: `git log -7 --oneline`

Expected: 工作树干净，当前分支只领先远端本轮设计、计划和实施提交。
