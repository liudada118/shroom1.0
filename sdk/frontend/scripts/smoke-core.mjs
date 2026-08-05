/**
 * smoke-core.mjs - 证明 `core/` 真的是零依赖层
 *
 * 用法：`node sdk/frontend/scripts/smoke-core.mjs`（在仓库任意目录下都行）
 *
 * ## 它证明什么
 *
 * **裸 Node、无打包器、无 `localStorage` 垫片、无 vitest** 也能 import 整个
 * `core/` 并跑通主要通路。这条性质单元测试证明不了 —— vitest 底下有 Vite 的
 * 解析器（会补扩展名）和 `vi.stubGlobal`（会造 localStorage），两个都会把
 * 真正的问题遮住：
 *
 * | 会漏掉的错 | 只有裸 Node 抓得到 |
 * | :--- | :--- |
 * | 相对 import 少写 `.js` | Node 不做扩展名补全，打包器做 |
 * | 模块顶层读 `localStorage` | 测试环境里有垫片，浏览器里也有，裸 Node 里没有 |
 * | 悄悄引入了 react / three | peer 依赖没装时 import 直接失败 |
 *
 * 这三类错的共同表现是「在 client 里跑得好，装到新项目里就崩」—— 正是拆包要
 * 防的那件事。所以这个脚本是**包边界的守卫**，不是补充测试。
 *
 * 失败时进程以非 0 退出，`node:assert/strict` 会打出具体哪条断言崩了。
 */

import assert from 'node:assert/strict';

// 刻意用相对路径而不是包名：脚本在包内，且不想依赖「已经装好了」这个前提。
import {
  COLORMAPS,
  DUAL_CHANNEL_DEFAULTS,
  NUM_MATRIX_PRESETS,
  SCENE_CHANNELS,
  buildCoordinatePointLayout,
  buildSceneFrame,
  computeFrameStats,
  createThresholdState,
  findMax,
  jet,
  listRenderers,
  normalizeNumMatrixParams,
  numMatrix,
  press,
  publishFrame,
  quantizeFrame,
  registerRenderer,
  resetRendererRegistry,
  resolveRendererFromDefinition,
  sampleColormapRgb,
  subscribeFrames,
} from '../core/index.js';

const checks = [];

/**
 * 跑一条检查并记下结果，让输出里能看到每一步过了没有。
 *
 * @param {string} label 这一步在证明什么。
 * @param {() => string} body 断言体，返回一行给人看的摘要。
 */
function check(label, body) {
  const detail = body();
  checks.push(`  ✓ ${label}${detail ? ` —— ${detail}` : ''}`);
}

/* ── 0. 先证明环境里确实没有垫片 ─────────────────────────────────── */

check('运行环境没有 localStorage（若这条失败，后面的证明就不算数了）', () => {
  assert.equal(typeof globalThis.localStorage, 'undefined');
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof globalThis.document, 'undefined');
  return 'localStorage / window / document 全部 undefined';
});

/* ── 1. 阈值：无 localStorage 时全部回落默认值 ──────────────────── */

check('createThresholdState 在没有 localStorage 时回落默认值', () => {
  const state = createThresholdState(DUAL_CHANNEL_DEFAULTS);
  assert.deepEqual(state, { ...DUAL_CHANNEL_DEFAULTS });
  return `valuej1=${state.valuej1} valueg1=${state.valueg1}`;
});

/* ── 2. 参数归一化 ──────────────────────────────────────────────── */

check('normalizeNumMatrixParams 四条预设都能归一化并推出网格', () => {
  const summary = Object.entries(NUM_MATRIX_PRESETS).map(([id, preset]) => {
    const config = normalizeNumMatrixParams(preset);
    const grid = numMatrix.deriveGrid(config);
    assert.ok(grid.count > 0, `${id} 的格子数应大于 0`);
    assert.ok(Number.isInteger(grid.count), `${id} 的格子数应是整数`);
    return `${id} ${grid.gridWidth}×${grid.gridHeight}`;
  });
  return summary.join('，');
});

check('乱传参数不会抛，越界值被夹回范围内', () => {
  const config = normalizeNumMatrixParams({
    backend: 'not-a-backend',
    size: -999,
    decimalScale: 'abc',
    gridWidth: 1e9,
  });
  assert.equal(config.backend, 'sprite3d');
  assert.ok(config.size >= 1);
  assert.equal(config.decimalScale, 1);
  return `backend=${config.backend} size=${config.size} gridWidth=${config.gridWidth}`;
});

/* ── 3. 帧管线 ──────────────────────────────────────────────────── */

const FRAME_W = 23;
const FRAME_H = 23;

/** 一个游动的高斯斑，与 example/ 里喂给渲染器的是同一套合成数据。 */
function syntheticFrame(t) {
  const out = new Array(FRAME_W * FRAME_H);
  const cx = (FRAME_W - 1) / 2 + Math.cos(t) * 5;
  const cy = (FRAME_H - 1) / 2 + Math.sin(t) * 5;
  for (let row = 0; row < FRAME_H; row += 1) {
    for (let col = 0; col < FRAME_W; col += 1) {
      const d2 = (col - cx) ** 2 + (row - cy) ** 2;
      out[row * FRAME_W + col] = Math.round(220 * Math.exp(-d2 / 18));
    }
  }
  return out;
}

check('quantizeFrame + computeFrameStats 跑通一帧合成数据', () => {
  const frame = syntheticFrame(0.7);
  const quantized = quantizeFrame(frame, 0, 1);
  const stats = computeFrameStats(quantized);
  assert.equal(quantized.length, FRAME_W * FRAME_H);
  assert.ok(stats.max > 0 && stats.max <= 220);
  assert.ok(stats.total >= stats.max);
  return `max=${stats.max} total=${stats.total}`;
});

check('floor 过滤把低于阈值的点压掉，不改数组长度', () => {
  const frame = syntheticFrame(0.7);
  const filtered = numMatrix.applyFloorFilter(frame, 100);
  assert.equal(filtered.length, frame.length);
  assert.ok(findMax(filtered) >= 100);
  assert.ok(filtered.filter((v) => v > 0).length < frame.filter((v) => v > 0).length);
  return `过滤前 ${frame.filter((v) => v > 0).length} 个非零点，过滤后 ${filtered.filter((v) => v > 0).length} 个`;
});

check('press 分压重分配返回新数组，不改入参', () => {
  const frame = syntheticFrame(0.7);
  const before = [...frame];
  const out = press(frame, FRAME_W, FRAME_H, 30000, 1, 'col');
  assert.deepEqual(frame, before);
  assert.equal(out.length, frame.length);
  return `${out.length} 点，max=${findMax(out)}`;
});

/* ── 4. 配色 ────────────────────────────────────────────────────── */

check('七条 colormap 在 0 / 0.5 / 1 处都给出合法 RGB', () => {
  COLORMAPS.forEach((entry) => {
    [0, 0.5, 1].forEach((ratio) => {
      const rgb = sampleColormapRgb(entry.id, ratio);
      assert.equal(rgb.length, 3, `${entry.id} 应返回三分量`);
      rgb.forEach((v) => {
        assert.ok(Number.isFinite(v) && v >= 0 && v <= 255, `${entry.id} 分量越界：${v}`);
      });
    });
  });
  return `${COLORMAPS.length} 条：${COLORMAPS.map((c) => c.id).join(' / ')}`;
});

check('jet 保留原实现的 parseInt 取整行为', () => {
  // 与 client/src/assets/util/util.jet.test.js 锁的是同一条性质。
  // 178.5 落在第三段（< 0.75 * 255 = 191.25）：r = 4 * 178.5 / 255 = 0.8 → 204。
  assert.deepEqual(jet(0, 255, 178.5), [204, 255, 0]);
  // parseInt 撞科学计数法的那个 bug —— 255 * 4e-14 = 1.02e-11，parseInt 取到 1。
  // 这是 18 处老配色现在的观感，不是要修的东西（见 core/frameMath.js 头部）。
  assert.equal(jet(0, 100, 1e-12)[1], 1);
  return 'jet(0,255,178.5) = [204,255,0]；科学计数法那条 bug 仍在';
});

/* ── 5. 帧总线 ──────────────────────────────────────────────────── */

check('frameBus 发布 / 订阅 / 退订一个来回', () => {
  const received = [];
  const unsubscribe = subscribeFrames((frame) => received.push(frame));
  publishFrame(buildSceneFrame({ values: [1, 2, 3], width: 3 }));
  unsubscribe();
  publishFrame(buildSceneFrame({ values: [9], width: 1 }));
  assert.equal(received.length, 1, '退订之后不应再收到帧');
  assert.deepEqual(received[0].channels[SCENE_CHANNELS.SIT], [1, 2, 3]);
  return '退订后确实收不到第二帧';
});

/* ── 6. 注册表（用一个纯描述符，不碰 react 层） ─────────────────── */

check('registerRenderer / listRenderers / resolveRendererFromDefinition', () => {
  resetRendererRegistry();
  registerRenderer({
    id: 'smokeStub',
    label: '烟测用的假渲染器',
    // load 在这里不会被调用 —— 这正是「注册只写描述符」的好处：裸 Node 里
    // 也能注册和解析，不需要能加载 JSX。
    load: () => Promise.resolve({ default: null }),
    capabilities: ['sit'],
    methods: ['sitData'],
    normalizeParams: (params) => ({ ...params, normalized: true }),
  });

  const ids = listRenderers().map((item) => item.id);
  assert.deepEqual(ids, ['smokeStub']);

  const resolved = resolveRendererFromDefinition({
    page: {
      renderers: [{ id: 'r1', type: 'smokeStub', params: { foo: 1 } }],
      profiles: [{ id: 'p1', renderer: 'r1' }],
      defaultProfile: 'p1',
    },
  });
  assert.equal(resolved.rendererId, 'smokeStub');
  assert.equal(resolved.params.normalized, true);

  // 解析不出来时返回 null，让旧通路继续跑 —— 绞杀者模式的关键。
  assert.equal(resolveRendererFromDefinition({ rendererId: '不存在的' }), null);

  resetRendererRegistry();
  return '注册 1 个 → 解析命中 → 未知 id 回落 null';
});

/* ── 7. 坐标布局 ────────────────────────────────────────────────── */

check('buildCoordinatePointLayout 接受坐标矩阵、拒绝坏输入', () => {
  const layout = buildCoordinatePointLayout([
    [[0, 0], [1, 0], [2, 0]],
    [[0, 1], [1, 1], [2, 1]],
  ]);
  assert.equal(layout.rows, 2);
  assert.equal(layout.cols, 3);
  assert.equal(buildCoordinatePointLayout(null), null);
  assert.equal(buildCoordinatePointLayout([]), null);
  return `${layout.rows}×${layout.cols}，坏输入回落 null`;
});

/* ── 收尾 ───────────────────────────────────────────────────────── */

console.log('core/ 零依赖层烟测（裸 Node，无垫片、无打包器）');
console.log(checks.join('\n'));
console.log(`\n${checks.length} 项全部通过。`);
