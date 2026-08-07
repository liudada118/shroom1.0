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
  POINT_GRID_PRESETS,
  SCENE_CHANNELS,
  buildCoordinatePointLayout,
  buildSceneFrame,
  computeFrameStats,
  createPointGridPipeline,
  createThresholdState,
  findMax,
  gaussBlur_2,
  jet,
  jetRound,
  jetgGrey,
  listRenderers,
  normalizeNumMatrixParams,
  normalizePointGridParams,
  numMatrix,
  pointGrid,
  press,
  publishFrame,
  quantizeFrame,
  registerRenderer,
  resetRendererRegistry,
  resolveRendererFromDefinition,
  rotate90CW,
  runPointGridPipeline,
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

check('normalizeNumMatrixParams 每条预设都能归一化并推出网格', () => {
  const summary = Object.entries(NUM_MATRIX_PRESETS).map(([id, preset]) => {
    const config = normalizeNumMatrixParams(preset);
    const grid = numMatrix.deriveGrid(config);
    assert.ok(grid.count > 0, `${id} 的格子数应大于 0`);
    assert.ok(Number.isInteger(grid.count), `${id} 的格子数应是整数`);
    assert.ok(numMatrix.BACKENDS.includes(config.backend), `${id} 的 backend 应是已实现的`);
    return `${id} ${grid.gridWidth}×${grid.gridHeight}/${config.backend}`;
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

check('normalizePointGridParams 两条预设都能归一化并推出网格', () => {
  const summary = Object.entries(POINT_GRID_PRESETS).map(([id, preset]) => {
    const config = normalizePointGridParams(preset);
    const grid = pointGrid.deriveGridSize(config.sit);
    assert.ok(grid.total > 0, `${id} 的网格点数应大于 0`);
    assert.ok(Number.isInteger(grid.total), `${id} 的网格点数应是整数`);
    return `${id} ${grid.amountX}×${grid.amountY}`;
  });
  // 这两个尺寸抄自 matCol.jsx / carCol.jsx 的常量区，是搬包前后的对账基准。
  assert.deepEqual(summary, ['matCol 36×24', 'carCol 26×28']);
  return summary.join('，');
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

check('点阵管线 interpSmall → addSide → gaussBlur_1 跑通一帧', () => {
  const config = normalizePointGridParams(POINT_GRID_PRESETS.matCol);
  const { total } = pointGrid.deriveGridSize(config.sit);
  const source = syntheticFrame(0.3).slice(0, config.sit.num1 * config.sit.num2);

  const once = runPointGridPipeline(source, config.sit, 2);
  assert.equal(once.length, total);
  assert.ok(once.every((v) => Number.isFinite(v)), '管线不应产出 NaN');
  assert.ok(findMax(once) > 0, '合成帧过一遍管线后不应全是 0');

  // 复用缓冲区的执行器与一次性调用必须逐点相同 —— 这条在 pipeline.test.js
  // 里也有，这里再验一遍是因为裸 Node 抓的是另一类错（扩展名 / 顶层副作用）。
  const reused = createPointGridPipeline(config.sit)(source, 2);
  assert.deepEqual([...reused], once);
  return `${total} 点，max=${findMax(once)}`;
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

check('jetRound 与 jet 是同一条阶梯、不同的收尾', () => {
  // 同一段上两者取的是同一个色，只差取整方式（parseInt 截断 vs Math.round）。
  assert.deepEqual(jetRound(0, 255, 178.5), [204, 255, 0]);
  // 两处刻意保留的差异，`canvas2d` 后端每个数字都走 jetRound，别互换：
  assert.deepEqual(jetRound(5, 5, 5), [255, 255, 255]); // jet 在这里 g 是 NaN
  assert.ok(Number.isNaN(jet(5, 5, 5)[1]));
  return 'jetRound(5,5,5)=[255,255,255]，jet 同参数 g=NaN';
});

check('rotate90CW 顺时针转 90°，参数顺序是 (arr, height, width)', () => {
  // 1 2      3 1
  // 3 4  →   4 2
  assert.deepEqual(rotate90CW([1, 2, 3, 4], 2, 2), [3, 1, 4, 2]);
  // 非方阵会换形状：2 行 3 列 → 3 行 2 列。
  assert.deepEqual(rotate90CW([1, 2, 3, 4, 5, 6], 2, 3), [4, 1, 5, 2, 6, 3]);
  return '2×2 与 2×3 两例都对得上';
});

check('gaussBlur_2 返回新数组、不取整，且会改掉入参', () => {
  const src = [0, 0, 0, 0, 100, 0, 0, 0, 0];
  const out = gaussBlur_2(src, 3, 3, 1.6);
  assert.equal(out.length, 9);
  assert.ok(out.every(Number.isFinite), '不应出现 NaN');
  // 总量守恒到边界夹取为止；中心一定被摊平了。
  assert.ok(out[4] < 100 && out[4] > 0, '中心应被摊薄但非零');
  // ⚠️ 第二遍 boxBlur_2 把入参当中间缓冲写了一遍 —— 这是原实现的行为，
  // 调用点传的都是刚 map 出来的临时数组，所以没人踩到。
  assert.notDeepEqual(src, [0, 0, 0, 0, 100, 0, 0, 0, 0]);
  return `中心 100 → ${out[4].toFixed(2)}；入参确实被改写`;
});

check('jetgGrey 保留原实现的两条反直觉行为', () => {
  // 1. `if (!x)` 把 0 也算进去了，所以零压力点取到的是**最亮**的那一级，
  //    而不是最暗的。点阵图里那片"底色"就是这么来的。
  assert.deepEqual(jetgGrey(0, 4096, 0), jetgGrey(0, 4096, undefined));
  // 2. 索引是倒着取的（`length - 1 - num`）：值越大越暗。
  const low = jetgGrey(0, 4096, 100);
  const high = jetgGrey(0, 4096, 4000);
  assert.ok(high[0] <= low[0], '值越大应越暗');
  return `x=100 → ${low.join(',')}；x=4000 → ${high.join(',')}`;
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

/* ── 8. 数字矩阵的点位铺排 / 分区布局 / 着色器源码 ──────────────── */

check('147 点位两个变体铺排出的矩阵长度对、且只差大拇指那几行', () => {
  const raw = Array.from({ length: 147 }, (_, i) => i + 1);
  const size = numMatrix.GLOVE_147_BASE * numMatrix.GLOVE_147_BASE;
  const c2d = numMatrix.applyGlove147Layout(raw, {
    thumbRowOffsets: numMatrix.GLOVE_147_THUMB_ROWS_CANVAS2D,
  });
  const gl = numMatrix.applyGlove147Layout(raw, {
    thumbRowOffsets: numMatrix.GLOVE_147_THUMB_ROWS_WEBGL,
  });
  assert.equal(c2d.length, size);
  assert.equal(gl.length, size);
  // 两个变体只有 `thumbRowOffsets` 不同，所以必然有差、但不能全差。
  const diff = c2d.reduce((n, v, i) => n + (v === gl[i] ? 0 : 1), 0);
  assert.ok(diff > 0 && diff < size, `两个变体应部分不同，实测差 ${diff} 格`);
  return `${size} 格，两变体差 ${diff} 格`;
});

check('足底 60 点散布 + 插值铺满 16×32，手套补行给出 15×10 / 15×13', () => {
  const foot = numMatrix.applyFootPointLayout(Array.from({ length: 60 }, () => 50));
  assert.equal(foot.length, numMatrix.FOOT_GRID_WIDTH * numMatrix.FOOT_GRID_HEIGHT);
  assert.ok(foot.every(Number.isFinite), '插值不应产出 NaN');

  const short = numMatrix.padGlove147Rows(Array.from({ length: 147 }, () => 1), {});
  assert.deepEqual([short.gridWidth, short.gridHeight], [15, 10]);
  assert.equal(short.data.length, 150);

  const full = numMatrix.padGlove147Rows(Array.from({ length: 195 }, () => 1), { fullPacket: true });
  assert.deepEqual([full.gridWidth, full.gridHeight], [15, 13]);
  assert.equal(full.data.length, 195);
  return `足底 ${foot.length} 格；手套 150 / 195`;
});

check('三套分区布局都能拼成一整块纹理 + 掩码', () => {
  const frame = Array.from({ length: 256 }, (_, i) => i % 40);
  const summary = numMatrix.ROBOT_LAYOUT_NAMES.map((name) => {
    const parts = numMatrix.getRobotLayout(name);
    const built = numMatrix.buildRobotFrame(frame, parts, numMatrix.ROBOT_LAYOUT_GAP);
    assert.equal(built.layoutData.length, built.layoutW * built.layoutH);
    assert.equal(built.maskData.length, built.layoutW * built.layoutH);
    // 标题那两行永远不在掩码里，所以掩码不可能填满。
    assert.ok(built.maskData.some((v) => v === 0), `${name} 的掩码不该填满`);
    assert.ok(built.maskData.some((v) => v === 255), `${name} 的掩码不该全空`);
    return `${name} ${built.layoutW}×${built.layoutH}`;
  });
  assert.equal(numMatrix.getRobotLayout('查无此人'), null);
  return summary.join('，');
});

check('POT 取整与裸数据转置：只有方阵才转', () => {
  assert.deepEqual([1, 6, 15, 16, 17, 36].map(numMatrix.nextPOT), [1, 8, 16, 16, 32, 64]);
  // 2×2 方阵：转置换位。
  assert.deepEqual(
    numMatrix.normalizeRawFrame([1, 2, 3, 4], { transpose: true, width: 2, height: 2 }),
    [1, 3, 2, 4],
  );
  // 非方阵即便要求转置也原样返回 —— 原实现如此，别"顺手修正"。
  assert.deepEqual(
    numMatrix.normalizeRawFrame([1, 2, 3, 4, 5, 6], { transpose: true, width: 3, height: 2 }),
    [1, 2, 3, 4, 5, 6],
  );
  return 'nextPOT 六例对得上；3×2 要求转置仍原样';
});

check('片元着色器四个变体都能在没有 GL 上下文的裸 Node 里发出源码', () => {
  const summary = Object.entries(numMatrix.FRAGMENT_VARIANTS).map(([name, flags]) => {
    const src = numMatrix.buildFragmentShader(flags);
    assert.ok(src.includes('void main()'), `${name} 应有 main`);
    assert.ok(src.includes('u_texScale'), `${name} 应始终声明 u_texScale`);
    assert.equal(src.includes('u_useMask'), flags.useMask);
    // jet 阶梯是从 core/jetLadder.js 的断点数据发码的，不是抄的第 19 份。
    assert.ok(src.includes('0.25'), `${name} 应含 jet 的第一个断点`);
    return `${name} ${src.split('\n').length} 行`;
  });
  assert.equal(numMatrix.QUAD_POSITIONS.length, 12);
  assert.equal(numMatrix.QUAD_TEX_COORDS.length, 12);
  assert.ok(numMatrix.VERTEX_SHADER_SRC.includes('v_texCoord'));
  return summary.join('，');
});

/* ── 收尾 ───────────────────────────────────────────────────────── */

console.log('core/ 零依赖层烟测（裸 Node，无垫片、无打包器）');
console.log(checks.join('\n'));
console.log(`\n${checks.length} 项全部通过。`);
