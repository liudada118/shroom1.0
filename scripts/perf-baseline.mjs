/**
 * 数据面性能基线：跑六个热点微基准，与 `perf-baseline.json` 比对，超预算就非零退出。
 *
 * 三种用法 —— 裸跑只比对；`--write` / `--update` 重写基线；`--json` 输出机器可读报告。
 * `--check` 与 `--write` 互斥（同时给会直接抛）。
 *
 * 两道性能闸判的东西不同：**硬预算**（`HARD_BUDGETS_MS`，绝对毫秒）任何机器都要过；
 * **相对预算**（基线的 1.75 倍）只在环境指纹完全一致时启用，否则换台机器就会误报。
 *
 * ⚠️ 还有一道与快慢无关的闸：`signatures` 是各步输出的哈希，它变了说明**行为变了**而不是
 * 变慢了 —— 这时基线数字已经不可比，`--write` 会拒绝写入。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { createPointGridPipeline } from '../sdk/frontend/renderers/pointGrid/core/pipeline.js';

const require = createRequire(import.meta.url);
const {
  SENSOR_FRAME_SCHEMA_VERSION,
  SENSOR_FRAME_TYPE,
  isSensorFrameV1Envelope,
} = require('../sdk/backend/contract/sensorFrameV1.js');
const { buildSensorFrameEnvelope } = require('../backend/kernel/realtime/sensorFrameEnvelope.js');
const { press } = require('../sdk/backend/processing/pressureTransforms.js');
const { carBackLine } = require('../sdk/backend/processing/lineOrders.js');

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const baselinePath = path.join(scriptDirectory, 'perf-baseline.json');
const args = new Set(process.argv.slice(2));
const updateBaseline = args.has('--write') || args.has('--update');
const emitJson = args.has('--json');

if (updateBaseline && args.has('--check')) {
  throw new Error('Use either --check or --write, not both.');
}

const POINT_COUNT = 4096;
const RELATIVE_LIMIT = 1.75;
const MIN_RELATIVE_ALLOWANCE_MS = 0.02;
const TARGET_SAMPLE_MS = 50;
const SAMPLE_COUNT = 7;
const MAX_BATCH_ITERATIONS = 65536;
const HARD_BUDGETS_MS = Object.freeze({
  'sensor-frame.validate-4096': 0.1,
  'sensor-frame.envelope-4096': 1,
  'sensor-frame.json-roundtrip-4096': 2,
  'processing.press-2048': 1,
  'processing.car-back-line-1024': 1,
  'frontend.point-grid-back': 50,
});

// 所有基准返回值最终都异或进这里，防止 V8 把整个被测调用当死代码消除（见 `consume`）。
let sink = 0;

/** 造确定性测试数据（`(i*37+17) % 4096`）—— 每次运行必须逐位相同，否则基线不可比。 */
function makeFixture(length) {
  return Array.from({ length }, (_, index) => (index * 37 + 17) % 4096);
}

/**
 * 算一串数字的 FNV-1a 哈希，用来判「行为有没有变」而不是「有没有变慢」。
 *
 * 先 `Math.round(value * 1000)` 再入哈希：保留三位小数的精度，同时让浮点末位噪声不至于
 * 把哈希翻掉。非有限值（NaN/Infinity）一律当 0，否则它们会让哈希在不同 Node 上不稳定。
 *
 * @param {Iterable<number>} values 待哈希的数字序列。
 * @returns {number} 32 位无符号哈希。
 */
function fnv1aScaledNumbers(values) {
  let hash = 2166136261 >>> 0;
  for (const value of values) {
    const scaled = Number.isFinite(value) ? Math.round(value * 1000) : 0;
    hash ^= scaled >>> 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

/**
 * 把任意基准返回值榨成一个数字喂给 `sink` —— **存在的唯一理由是防止 V8 把被测调用优化掉**。
 *
 * ⚠️ 返回值没人用时，JIT 有权把整个调用消除，测出来的就是空循环耗时（现象是某一项突然快了
 * 两个数量级、且怎么改被测代码都不变）。所以每种返回形状都要取一个**必须真算出来才知道**的
 * 标量：数组取长度 + 末位元素，帧对象取 payload 长度 + sequence。
 *
 * @param {*} value 基准函数的返回值。
 * @returns {number} 参与 sink 累加的标量。
 */
function consume(value) {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') return value.length;
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const last = value.length ? Number(value[value.length - 1]) || 0 : 0;
    return value.length + last;
  }
  if (value && typeof value === 'object') {
    const values = value.payload?.value;
    return (Array.isArray(values) ? values.length : 1) + (Number(value.sequence) || 0);
  }
  return Number(value) || 0;
}

/**
 * 跑 `iterations` 次并返回这一批的总耗时。
 *
 * 先在局部变量累加、最后才异或进模块级 `sink`：在热循环里每次都写模块级变量会引入额外开销，
 * 测出来的就不只是被测函数了。
 *
 * @param {Function} run 被测函数，入参是当前下标。
 * @param {number} iterations 循环次数。
 * @returns {number} 这一批的总耗时（毫秒）。
 */
function runBatch(run, iterations) {
  const startedAt = performance.now();
  let localSink = 0;
  for (let index = 0; index < iterations; index += 1) {
    localSink = (localSink + consume(run(index))) >>> 0;
  }
  sink = (sink ^ localSink) >>> 0;
  return performance.now() - startedAt;
}

/**
 * 取中位数 —— 用它而不是平均值，因为偶发的 GC 或系统调度会甩出几个极大值把平均值带偏。
 *
 * ⚠️ 偶数个样本时取的是**偏上那一个**，不是中间两数的平均。当前 `SAMPLE_COUNT` 是 7（奇数）
 * 所以无所谓，改成偶数之前要先想清楚这一点。
 *
 * @param {number[]} values 样本。
 * @returns {number} 中位数。
 */
function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * 自适应测量：先把单批次撑到约 `TARGET_SAMPLE_MS`，再取 `SAMPLE_COUNT` 批的中位数。
 *
 * 撑批次是因为 `performance.now()` 分辨率有限 —— 一次几十纳秒的调用直接测全是噪声。倍率夹在
 * 2–8 之间是为了别一步跨过头（跨过头会让单批次跑好几秒，整个脚本变慢却不更准）。撑的过程
 * 本身就是预热，所以没有单独的 warmup 阶段。
 *
 * @param {Function} run 被测函数。
 * @returns {{iterationsPerSample: number, medianMs: number, samplesMs: number[]}} 单次调用的耗时。
 */
function measure(run) {
  let iterations = 1;
  let elapsed = runBatch(run, iterations);
  while (elapsed < TARGET_SAMPLE_MS && iterations < MAX_BATCH_ITERATIONS) {
    const multiplier = Math.max(2, Math.min(8, Math.ceil(TARGET_SAMPLE_MS / Math.max(elapsed, 0.001))));
    iterations = Math.min(MAX_BATCH_ITERATIONS, iterations * multiplier);
    elapsed = runBatch(run, iterations);
  }

  const samples = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    samples.push(runBatch(run, iterations) / iterations);
  }
  return {
    iterationsPerSample: iterations,
    medianMs: median(samples),
    samplesMs: samples,
  };
}

/** 取环境指纹（平台 / 架构 / Node 大版本 / CPU 型号），决定能不能和基线做相对比较。 */
function environmentSnapshot() {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeMajor: Number(process.versions.node.split('.')[0]),
    cpuModel: os.cpus()[0]?.model || 'unknown',
  };
}

/**
 * 判两份环境指纹是否完全一致 —— 四项全等才算。
 *
 * 严格到带 CPU 型号，是因为相对预算（1.75 倍）换机器后毫无意义：慢一倍可能只是换了台笔记本。
 * 不一致时脚本只跑硬预算那道闸，并在输出里写明相对比较已停用。
 *
 * @returns {boolean} 是否可以做相对比较。
 */
function hasSameEnvironment(left, right) {
  return Boolean(left && right)
    && left.platform === right.platform
    && left.arch === right.arch
    && left.nodeMajor === right.nodeMajor
    && left.cpuModel === right.cpuModel;
}

/** 毫秒格式化成 4 位小数；非有限值输出 `-`（基线里缺这一项时会走到这里）。 */
function formatMilliseconds(value) {
  return Number.isFinite(value) ? value.toFixed(4) : '-';
}

/**
 * 算相对基线的百分比变化，带正负号；基线缺失或为 0 时输出 `-` 而不是 `Infinity`。
 *
 * @param {number} current 本次测得值。
 * @param {number} reference 基线值。
 * @returns {string} 形如 `+12.3%`。
 */
function formatDelta(current, reference) {
  if (!Number.isFinite(reference) || reference === 0) return '-';
  const percent = ((current / reference) - 1) * 100;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
}

/** 读基线文件；不存在返回 null —— 首次运行是正常情况，由调用方提示去跑 `--write`。 */
function readBaseline() {
  if (!fs.existsSync(baselinePath)) return null;
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

/**
 * 写基线文件，**先写临时文件再 rename**（同分区上 rename 是原子的）。
 *
 * 直接覆写的话，写到一半被打断会留下语法不完整的 JSON，下次 `readBaseline` 直接抛 —— 而且抛在
 * 一个和性能毫无关系的地方。临时文件名带 pid，避免两个进程同时跑时互相覆盖。
 *
 * 只落中位数与预算，**不落样本明细**：样本每次都不同，留着会让每次 `--write` 都产生大 diff，
 * 而且它们没有复现价值。
 *
 * @param {object} report 本次运行的完整报告。
 * @returns {void}
 */
function writeBaseline(report) {
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    environment: report.environment,
    relativeLimit: RELATIVE_LIMIT,
    parameters: report.parameters,
    signatures: report.signatures,
    wire: report.wire,
    benchmarks: Object.fromEntries(
      report.results.map((result) => [result.id, {
        medianMs: result.medianMs,
        budgetMs: result.budgetMs,
      }]),
    ),
  };
  const temporaryPath = `${baselinePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, baselinePath);
}

const sourceValues = makeFixture(POINT_COUNT);
const canonicalFrame = {
  type: SENSOR_FRAME_TYPE,
  schemaVersion: SENSOR_FRAME_SCHEMA_VERSION,
  displaySystemId: 'perf-system',
  sensorId: 'matrix',
  channelId: 'perf-system:matrix',
  sensorLabel: 'Performance Matrix',
  sensorType: 'perf-matrix',
  outputChannel: 'sensor',
  source: 'realtime',
  sequence: 42,
  timestamp: 1_700_000_000_000,
  quality: 'good',
  serial: { role: 'sensor', path: 'PERF', baudRate: 1_000_000 },
  payload: {
    value: sourceValues,
    stages: {
      decoded: sourceValues,
      normalized: sourceValues,
      calibrated: null,
      processed: sourceValues,
      mapped: sourceValues,
    },
    metrics: { max: 4095, min: 0 },
    algorithmMetrics: {},
    matrix: { rows: 64, cols: 64 },
    orientation: null,
    status: { rateHz: 200 },
    temperature: null,
    protocol: null,
    history: null,
  },
};
const canonicalWire = JSON.stringify(canonicalFrame);
const pressureFixture = makeFixture(2048);
const carBackFixture = makeFixture(1024);
const pointGridFixture = makeFixture(16 * 32);
const pointGridPipeline = createPointGridPipeline({ num1: 16, num2: 32, interp: 2, order: 4 });

const projectedFrame = buildSensorFrameEnvelope({
  channel: 'sensor',
  payload: canonicalFrame,
  sensorType: 'perf-matrix',
  sequence: 42,
  timestamp: canonicalFrame.timestamp,
});
const pressureOutput = press(pressureFixture, 100000);
const carBackOutput = carBackLine(carBackFixture);
const pointGridOutput = pointGridPipeline(pointGridFixture, 2);

assert.equal(isSensorFrameV1Envelope(canonicalFrame), true);
assert.equal(projectedFrame?.payload?.value?.length, POINT_COUNT);
assert.equal(pressureOutput.length, 2048);
assert.equal(carBackOutput.length, 1024);
assert.equal(pointGridOutput.length, 40 * 72);
assert.equal(fnv1aScaledNumbers(pressureOutput), 3538819901);
assert.equal(fnv1aScaledNumbers(carBackOutput), 3256276677);
assert.equal(fnv1aScaledNumbers(pointGridOutput), 3027004005);

const benchmarkDefinitions = [
  {
    id: 'sensor-frame.validate-4096',
    run: () => isSensorFrameV1Envelope(canonicalFrame),
  },
  {
    id: 'sensor-frame.envelope-4096',
    run: () => buildSensorFrameEnvelope({
      channel: 'sensor',
      payload: canonicalFrame,
      sensorType: 'perf-matrix',
      sequence: 42,
      timestamp: canonicalFrame.timestamp,
    }),
  },
  {
    id: 'sensor-frame.json-roundtrip-4096',
    run: () => JSON.parse(JSON.stringify(canonicalFrame)),
  },
  {
    id: 'processing.press-2048',
    run: () => press(pressureFixture, 100000),
  },
  {
    id: 'processing.car-back-line-1024',
    run: () => carBackLine(carBackFixture),
  },
  {
    id: 'frontend.point-grid-back',
    run: () => pointGridPipeline(pointGridFixture, 2),
  },
];

const environment = environmentSnapshot();
const baseline = readBaseline();
const sameEnvironment = hasSameEnvironment(environment, baseline?.environment);
const signatures = {
  source4096: fnv1aScaledNumbers(sourceValues),
  pressure2048: fnv1aScaledNumbers(pressureOutput),
  carBack1024: fnv1aScaledNumbers(carBackOutput),
  pointGridBack2880: fnv1aScaledNumbers(pointGridOutput),
};
const wire = {
  bytes: Buffer.byteLength(canonicalWire),
  rawUint16Bytes: POINT_COUNT * 2,
  expansionRatio: Buffer.byteLength(canonicalWire) / (POINT_COUNT * 2),
};

const results = benchmarkDefinitions.map((definition) => {
  const measurement = measure(definition.run);
  const reference = baseline?.benchmarks?.[definition.id]?.medianMs;
  const budgetMs = HARD_BUDGETS_MS[definition.id];
  const relativeBudgetMs = Number.isFinite(reference)
    ? Math.max(reference * (baseline?.relativeLimit || RELATIVE_LIMIT), reference + MIN_RELATIVE_ALLOWANCE_MS)
    : null;
  const failures = [];
  if (measurement.medianMs > budgetMs) {
    failures.push(`hard budget ${formatMilliseconds(budgetMs)} ms`);
  }
  if (sameEnvironment && Number.isFinite(relativeBudgetMs) && measurement.medianMs > relativeBudgetMs) {
    failures.push(`relative budget ${formatMilliseconds(relativeBudgetMs)} ms`);
  }
  return {
    id: definition.id,
    ...measurement,
    referenceMs: reference ?? null,
    budgetMs,
    relativeBudgetMs,
    status: failures.length ? 'FAIL' : 'PASS',
    failures,
  };
});

const structuralFailures = [];
if (baseline) {
  if (JSON.stringify(baseline.signatures) !== JSON.stringify(signatures)) {
    structuralFailures.push('deterministic output signatures changed');
  }
  if (baseline.wire?.bytes !== wire.bytes) {
    structuralFailures.push(`canonical wire size changed: ${baseline.wire?.bytes} -> ${wire.bytes} bytes`);
  }
}

const report = {
  schemaVersion: 1,
  environment,
  baselineEnvironment: baseline?.environment || null,
  sameEnvironment,
  parameters: {
    pointCount: POINT_COUNT,
    targetSampleMs: TARGET_SAMPLE_MS,
    sampleCount: SAMPLE_COUNT,
  },
  signatures,
  wire,
  results,
  structuralFailures,
  sink,
};

const failedResults = results.filter((result) => result.status === 'FAIL');
if (updateBaseline) {
  if (failedResults.length || structuralFailures.length) {
    throw new Error('Refusing to update a baseline that fails a hard budget or behavior signature.');
  }
  writeBaseline(report);
}

if (emitJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log(`Data-plane benchmark: ${environment.platform}/${environment.arch}, Node ${process.versions.node}`);
  console.log(`Frame: ${POINT_COUNT} points, ${wire.bytes} JSON bytes, ${wire.expansionRatio.toFixed(2)}x uint16 payload`);
  console.log(`Relative comparison: ${sameEnvironment ? 'enabled' : 'N/A (environment differs or baseline is new)'}`);
  console.log('');
  console.log('benchmark                              current    baseline   delta      budget     status');
  for (const result of results) {
    console.log([
      result.id.padEnd(38),
      formatMilliseconds(result.medianMs).padStart(8),
      formatMilliseconds(result.referenceMs).padStart(10),
      formatDelta(result.medianMs, result.referenceMs).padStart(9),
      formatMilliseconds(result.budgetMs).padStart(10),
      result.status.padStart(8),
    ].join(' '));
  }
  if (structuralFailures.length) {
    console.log('');
    for (const failure of structuralFailures) console.error(`[FAIL] ${failure}`);
  }
  if (updateBaseline) console.log(`\nBaseline updated: ${baselinePath}`);
}

if (!baseline && !updateBaseline) {
  console.error(`\nMissing baseline: ${baselinePath}. Review the results, then run with --write.`);
  process.exitCode = 2;
} else if (failedResults.length || structuralFailures.length) {
  process.exitCode = 1;
}

