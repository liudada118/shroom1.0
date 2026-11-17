import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import translations from '../../client/src/i18n/monitorAuditTranslations.js';
import { assertQuarterTurn, assertSamePicture, capturePointPicture, captureSettledPointPicture, installPointPictureProbe } from './point-picture-probe.mjs';

/**
 * 正式门户里的展示方向：3D 点图的「旋转 90°」，以及原始数据的旋转 90°、水平翻转、纵向翻转。
 * 从工具箱按钮点进去，核对画面真的变了，而数据、侧栏统计和发给后端的内容一样都没变。
 * 3D 点图看显卡收到的矩阵和顶点缓冲，数字矩阵和热力图看合成之后的屏幕像素；设备、授权和后端响应由测试隔离。
 * `--only=<系统>` 只跑一个系统。
 */
const SYSTEMS = [
  // 旧 3D 点图（经 pointViewTools）+ 精灵图数字矩阵；这一套另外读出渲染器手里的帧。
  { id: 'bed4096num', size: 64, point: true, canvas: '.canvasNum canvas', ruler: true, frames: true },
  // 手部 3D 点图（直接用共享视角工具）+ WebGL 数字矩阵。
  { id: 'hand', size: 32, point: true, canvas: '.canvasNum canvas', ruler: true },
  // 两个显示模式都是斑点热力图，转和翻的是画布元素，画布里的像素不动。
  { id: 'bed4096', size: 64, point: false, canvas: '.portal-data-renderer canvas[width="1024"]', bitmap: true },
];
const MODES = { normal: '3D 模型', numoriginal: '原始数据' };
const TOOLS = { rotate: '旋转 90°', flipX: '水平翻转', flipY: '纵向翻转' };

const { createServer } = createRequire(new URL('../../client/package.json', import.meta.url))('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-display-orientation-'));
const errors = [], sockets = new Set(), commands = [], uplink = [];
const license = { valid: true, selectFlag: 'all', date: Date.now() + 30 * 86400000, nowDate: Date.now() };
let browser, page, sequence = 0, current = null;
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, 'vite-cache'), server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'display-orientation-observer', enforce: 'pre',
    /** 只读出渲染器手里的帧，用来确认旋转、翻转之后数据顺序没变；不替换任何运算。 */
    transform(source, id) {
      const path = id.replaceAll('\\', '/').split('?')[0];
      if (path.endsWith('/components/three/4096.jsx')) {
        const hook = 'particles = new THREE.Points(sitGeometry, material);';
        assert.ok(source.includes(hook));
        return source.replace(hook, `${hook} (window.__orientationFrames ||= {}).normal = () => Array.from(ndata1);`);
      }
      if (path.endsWith('/numMatrix/react/backends/sprite3d.js')) {
        const hook = 'const peak = findPeak(data);';
        assert.ok(source.includes(hook));
        return source.replace(hook, `${hook} (window.__orientationFrames ||= {}).numoriginal = () => Array.from(data);`);
      }
      return null;
    },
    /** 挂载正式门户和 Home。 */
    configureServer(vite) {
      vite.middlewares.use('/__display-orientation', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__display-orientation', '<html><head><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    },
  }],
});

/**
 * 方向可辨的一帧：把矩阵分成 4×4 块，左上角一个 L 形（四块）受压，其余是底压。
 * L 形转四个方向互不相同，镜像之后也转不回来，所以画面转了几圈、是转还是翻都分得出来。
 */
const LIT = [[0, 0], [0, 1], [0, 2], [1, 0]];
const pattern = (size, base) => Array.from({ length: size * size }, (_, index) => {
  const row = Math.floor(Math.floor(index / size) * 4 / size), col = Math.floor((index % size) * 4 / size);
  return LIT.some(([r, c]) => r === row && c === col) ? 200 : base;
});
/** 一帧的合力，侧栏「压力总和」应当等于它。 */
const sum = (values) => values.reduce((total, value) => total + value, 0);
/** 按行、列排好分块，比较时不受读出顺序影响。 */
const sortBlocks = (blocks) => [...blocks].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
/** 4×4 分块顺时针转若干个 90°：每转一次，原来的上边到右边。 */
const turnBlocks = (blocks, turns = 1) => {
  let next = blocks;
  for (let turn = 0; turn < turns; turn++) next = next.map(([row, col]) => [col, 3 - row]);
  return sortBlocks(next);
};
/** 4×4 分块左右（'x'）或上下（'y'）镜像。 */
const mirrorBlocks = (blocks, axis) => sortBlocks(blocks.map(([row, col]) => (axis === 'x' ? [row, 3 - col] : [3 - row, col])));

/** 从真实 WebSocket 发一帧，不直接调用渲染器。 */
function send(system, values) {
  const frame = { type: 'sensor.frame', schemaVersion: 1, source: 'realtime', displaySystemId: system.id, sensorType: system.id,
    sensorId: 'sit', sensorLabel: '方向测试', channelId: `${system.id}:sit`, outputChannel: 'sit', sequence: ++sequence, timestamp: Date.now(), quality: 'good',
    serial: { role: 'sit', path: 'COM_ORIENTATION_TEST', baudRate: 3000000, parserChannel: `${system.id}:sit` },
    payload: { value: values, matrix: { rows: system.size, cols: system.size, total: system.size * system.size } } };
  for (const socket of sockets) socket.send(JSON.stringify(frame));
}

/** 反复读取直到等于预期；界面每 250 毫秒才刷新一次工具状态，画布要等下一帧才重画，都不能操作完立刻读。 */
async function settle(label, read, expected) {
  let seen;
  for (let round = 0; round < 80; round++) {
    seen = await read();
    if (JSON.stringify(seen) === JSON.stringify(expected)) return;
    await page.waitForTimeout(50);
  }
  assert.deepEqual(seen, expected, label);
}

/** 打开门户并进入某个系统的实时监测；后端问候语报的也是这个系统。 */
async function enter(system) {
  current = system.id;
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__display-orientation?actual-monitor=1`);
  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.locator(`[data-system="${system.id}"]`).click();
  await page.getByRole('button', { name: translations.monitorUi.enterSystem.zh, exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
}

/** 选择正式显示菜单里的显示模式。 */
async function mode(label) {
  await page.locator('.portal-display-panel .ant-select').last().click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: label }).click();
}

/** 打开工具箱的某个分类，返回里面的按钮。 */
async function tool(tab, name) {
  const utility = page.locator('.portal-utility-panel');
  if (!await utility.isVisible()) await page.getByRole('button', { name: '工具', exact: true }).click();
  await utility.getByRole('tab', { name: tab, exact: true }).click();
  return utility.getByRole('button', { name, exact: true });
}

/** 收起工具箱，让出被它盖住的画布下沿。 */
async function closeTools() {
  const utility = page.locator('.portal-utility-panel');
  if (!await utility.isVisible()) return;
  await utility.getByRole('button', { name: '收起实用工具', exact: true }).click();
  await utility.waitFor({ state: 'hidden' });
  // 鼠标挪到角落，按钮的说明气泡不留在画布上。
  await page.mouse.move(2, 2);
}

/** 点「数据处理」里的一个方向按钮（rotate / flipX / flipY）。 */
async function press(key) {
  await (await tool('数据处理', TOOLS[key])).click();
}

/**
 * 等「数据处理」里的三个方向按钮到达预期状态：可用，并且按下的正好是 expected 里为真的那几个。
 * @param {{rotate?: boolean, flipX?: boolean, flipY?: boolean}} [expected] 没写的按钮应当没按下
 */
async function orientation(label, expected = {}) {
  await tool('数据处理', TOOLS.rotate);
  const utility = page.locator('.portal-utility-panel');
  /** 读一个按钮：不可用时返回 'disabled'，否则返回它有没有按下。 */
  const read = async (name) => {
    const button = utility.getByRole('button', { name, exact: true });
    return await button.isDisabled() ? 'disabled' : await button.getAttribute('aria-pressed') === 'true';
  };
  await settle(`${label}: 旋转 / 翻转按钮的状态`, async () => ({ rotate: await read(TOOLS.rotate), flipX: await read(TOOLS.flipX), flipY: await read(TOOLS.flipY) }),
    { rotate: false, flipX: false, flipY: false, ...expected });
}

/** 等侧栏（以及能读出帧的系统的渲染器）收到这一帧。 */
async function delivered(system, view, values) {
  if (system.frames) await page.waitForFunction(([name, expected]) => {
    const frame = window.__orientationFrames?.[name]?.();
    return frame && frame.length === expected.length && frame.every((value, index) => value === expected[index]);
  }, [view, values]);
  await page.waitForFunction((expected) => Number(document.querySelector('.aside .pressData')?.textContent) === expected, sum(values));
}

/** 改了展示方向之后，渲染器手里的帧和侧栏合力必须还是原来那一帧。 */
async function assertDataUntouched(label, system, view, values) {
  if (system.frames) assert.deepEqual(await page.evaluate((name) => window.__orientationFrames[name](), view), values, `${label}: 渲染器手里的帧顺序变了`);
  assert.equal(Number(await page.locator('.aside .pressData').first().textContent()), sum(values), `${label}: 侧栏合力变了`);
}

/** 本系统各显示模式保存的展示方向；没保存过的模式不出现。 */
const savedViews = (system) => page.evaluate((id) => Object.fromEntries(Object.keys(localStorage)
  .filter((key) => key.startsWith('shroom.workspaceView.v1:')).map((key) => [JSON.parse(key.slice('shroom.workspaceView.v1:'.length)), JSON.parse(localStorage.getItem(key))])
  .filter(([[identity]]) => identity === id)
  .map(([[, view], snapshot]) => [view, { quarterTurns: snapshot.quarterTurns ?? null, flipX: snapshot.flipX ?? null, flipY: snapshot.flipY ?? null }])), system.id);

/** 到目前为止页面发给后端的命令数和消息数。 */
const traffic = () => ({ commands: commands.length, uplink: uplink.length });

/**
 * 截下画布真实上屏的那一块，按 4×4 分块，返回受压（颜色明显不同于底色）的块。
 * 读的是合成之后的屏幕像素，画布元素被 CSS 转过、翻过也看得出来。
 * ⚠️ 截图前要收起工具箱：它盖住画布下沿，被盖住的块会被误判。
 * @returns {Promise<{blocks: number[][]|null, distances: number[]}>} blocks 为 null 表示这一刻画面上分不出受压块
 */
async function litBlocks(system) {
  await closeTools();
  const png = await page.screenshot({ clip: await page.locator(system.canvas).first().boundingBox() });
  const colors = await page.evaluate(async (source) => {
    const image = new Image(); image.src = source; await image.decode();
    const copy = document.createElement('canvas'); copy.width = 256; copy.height = 256;
    const context = copy.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, 256, 256);
    return Array.from({ length: 16 }, (_, block) => {
      // 每块只取中间一半，避开块与块交界处的格线和晕染。
      const pixels = context.getImageData((block % 4) * 64 + 16, Math.floor(block / 4) * 64 + 16, 32, 32).data;
      const color = [0, 0, 0];
      for (let offset = 0; offset < pixels.length; offset += 4) for (let channel = 0; channel < 3; channel++) color[channel] += pixels[offset + channel] / (pixels.length / 4);
      return color;
    });
  }, `data:image/png;base64,${png.toString('base64')}`);
  // 16 块里 12 块是底压，按通道取中位数就是底色。
  const base = [0, 1, 2].map((channel) => colors.map((color) => color[channel]).sort((a, b) => a - b)[8]);
  const distances = colors.map((color) => Math.round(Math.hypot(...color.map((value, channel) => value - base[channel]))));
  const ranked = [...distances].sort((a, b) => b - a);
  // 受压块和底色之间要有明显的断层，否则这张图分不出方向，不能拿来下结论。
  const clear = ranked[3] > 25 && ranked[4] < ranked[3] / 3;
  return { distances, blocks: clear ? distances.flatMap((distance, block) => (distance >= ranked[3] ? [[Math.floor(block / 4), block % 4]] : [])) : null };
}

/** 等画面上的受压块到达预期位置。 */
async function expectBlocks(label, system, expected) {
  let seen;
  for (let round = 0; round < 40; round++) {
    seen = await litBlocks(system);
    if (JSON.stringify(seen.blocks) === JSON.stringify(expected)) return;
    await page.waitForTimeout(75);
  }
  assert.deepEqual(seen.blocks, expected, `${label}: 画面上受压块的位置不对（各块与底色的差：${seen.distances}）`);
}

/**
 * 读出与数据同向时画面上受压块的位置，并确认这幅画面能分清方向。
 * 各渲染器自己的版面约定（热力图左右镜像、手部矩阵转置）都体现在这里，之后的预期由它转、翻出来，不另外假设。
 */
async function uprightBlocks(label, system) {
  let seen = await litBlocks(system);
  for (let round = 0; round < 40 && !seen.blocks; round++) { await page.waitForTimeout(75); seen = await litBlocks(system); }
  assert.ok(seen.blocks, `${label}: 画面上分不出受压块（各块与底色的差：${seen.distances}）`);
  await expectBlocks(`${label} 画面稳定`, system, seen.blocks);
  /** 分块集合的可比较写法。 */
  const key = (blocks) => JSON.stringify(blocks);
  const turns = [0, 1, 2, 3].map((count) => key(turnBlocks(seen.blocks, count)));
  assert.equal(new Set(turns).size, 4, `${label}: 四个方向的画面必须互不相同`);
  assert.ok([0, 1, 2, 3].every((count) => !turns.includes(key(turnBlocks(mirrorBlocks(seen.blocks, 'x'), count)))), `${label}: 镜像必须和旋转分得开`);
  return seen.blocks;
}

/**
 * 用传感点量尺在画面上点两个格子，等它读到预期的起点和终点（数据自己的列、行，1 起点）。
 * 量尺只认投影点对应的原始索引，所以它读到什么，画面上那个格子实际就是哪一个传感点。
 * @param {number[][]} cells 屏幕上的两个格子 [行, 列]
 * @param {(row: number, col: number) => number[]} toData 屏幕格 → 数据的 [列, 行]（0 起点），由调用处按「画面是怎么摆的」手工给出
 */
async function measure(label, system, cells, toData) {
  await (await tool('数据分析', '传感点量尺')).click();
  const ruler = page.locator('.portal-screen-ruler'); await ruler.waitFor();
  const box = await page.locator(system.canvas).first().boundingBox();
  for (const [row, col] of cells) {
    const x = box.x + (col + .5) * box.width / system.size, y = box.y + (row + .5) * box.height / system.size;
    assert.equal(await page.evaluate(([px, py]) => Boolean(document.elementFromPoint(px, py)?.closest('.portal-ruler-surface')), [x, y]), true, `${label}: 落点被别的界面挡住了`);
    await page.mouse.click(x, y);
  }
  const [from, to] = cells.map(([row, col]) => toData(row, col));
  await settle(`${label}: 量尺读到的起点和终点`, async () => (await ruler.locator('span').filter({ hasText: /^起点（/ }).first().textContent().catch(() => null)),
    `起点（${from[0] + 1}, ${from[1] + 1}）→ 终点（${to[0] + 1}, ${to[1] + 1}）`);
  await ruler.getByRole('button', { name: '退出量尺', exact: true }).click();
  await ruler.waitFor({ state: 'hidden' });
}

/**
 * 在与数据同向的画面上拖一个框，侧栏合力应当等于框里那些原始格的和；再退出框选回到全图。
 * 框跨在受压块与底压的交界上，行或列差一格合力都会变，用来确认没翻没转时按屏幕框选仍然选中对应的原始行列。
 */
async function selectRegion(label, system, values) {
  const size = system.size;
  // 屏幕上的行 [rows[0], rows[1])、列 [cols[0], cols[1])；与数据同向时就是数据的行列。
  const rows = [Math.floor(size * .4), Math.floor(size * .56)], cols = [Math.floor(size * .16), Math.floor(size * .34)];
  let expected = 0;
  for (let row = rows[0]; row < rows[1]; row++) for (let col = cols[0]; col < cols[1]; col++) expected += values[row * size + col];
  assert.ok(expected > 0 && expected < sum(values), `${label}: 选区必须跨在受压块的边界上`);
  await (await tool('数据分析', '框选分析')).click();
  const panel = page.getByRole('complementary', { name: '框选区域管理', exact: true }); await panel.waitFor();
  const box = await page.locator(system.canvas).first().boundingBox();
  /** 第 row 行、第 col 列那一格左上角的屏幕位置。 */
  const corner = (row, col) => [box.x + col * box.width / size, box.y + row * box.height / size];
  const [x1, y1] = corner(rows[0], cols[0]), [x2, y2] = corner(rows[1], cols[1]);
  await page.mouse.move(x1 + 1, y1 + 1); await page.mouse.down(); await page.mouse.move(x2 - 1, y2 - 1, { steps: 4 }); await page.mouse.up();
  /** 侧栏当前显示的合力。 */
  const total = async () => Number(await page.locator('.aside .pressData').first().textContent());
  await settle(`${label}: 框选 ${rows[1] - rows[0]} 行 × ${cols[1] - cols[0]} 列之后的侧栏合力`, total, expected);
  await panel.getByRole('button', { name: '退出框选', exact: true }).click();
  await panel.waitFor({ state: 'hidden' });
  await settle(`${label}: 退出框选后回到全图合力`, total, sum(values));
  console.log('DISPLAY_ORIENTATION_SELECTION_PASS', label, JSON.stringify({ rows, cols, total: expected }));
}

/**
 * 3D 点图：转的是画面，不是数据。（3D 的水平 / 纵向翻转是原有功能，由别的脚本覆盖。）
 * @returns {Promise<{base: Array, once: Array, centerError: number}>} 没转和转过一次的真实上屏读数，刷新之后拿来对比
 */
async function verifyPointView(system, first, second) {
  const label = `${system.id} 3D 点图`;
  send(system, first); await delivered(system, 'normal', first);
  const base = await captureSettledPointPicture(page, label);
  await orientation(`${label} 进入时`);
  const before = traffic();
  await press('rotate');
  const once = await capturePointPicture(page);
  const plane = assertQuarterTurn(`${label} 点一次旋转 90°`, base, once, 1);
  await orientation(`${label} 转过一次`, { rotate: true });
  await assertDataUntouched(label, system, 'normal', first);
  // 转过之后来的新帧照常按原始顺序进入渲染器和侧栏，画面保持转过的方向。
  send(system, second); await delivered(system, 'normal', second);
  assertSamePicture(`${label} 转过之后换一帧数据`, once, await capturePointPicture(page, 30), { data: false });
  assert.equal(await (await tool('数据分析', '框选分析')).isDisabled(), true, `${label}: 转过之后不提供按屏幕框选，避免选错行列`);
  await settle(`${label}: 保存的展示方向`, async () => (await savedViews(system)).normal, { quarterTurns: 1, flipX: false, flipY: false });
  assert.deepEqual(traffic(), before, `${label}: 展示旋转不向后端发任何命令或消息`);
  await closeTools();
  await page.screenshot({ path: join(artifacts, `${system.id}-point-rotated.png`) });
  return { base, once, centerError: Number(plane.error.toFixed(5)), layers: base.map((record) => record.count) };
}

/** 数字矩阵和热力图走完全部步骤之后停在的画面：转过一次，再水平翻转。 */
const finalBlocks = (upright) => mirrorBlocks(turnBlocks(upright, 1), 'x');

/**
 * 数字矩阵或热力图：旋转 90°、水平翻转、纵向翻转三个按钮，按屏幕像素核对每一步。
 * @param {string} view 显示模式的键（normal / numoriginal），也是保存展示方向用的键
 * @returns {Promise<number[][]>} 与数据同向时受压块的位置，刷新之后拿来对比
 */
async function verifyMatrixView(system, view, first, second) {
  const label = `${system.id} ${MODES[view]}`;
  send(system, first); await delivered(system, view, first);
  await orientation(`${label} 进入时`);
  const upright = await uprightBlocks(label, system);
  const selectable = !await (await tool('数据分析', '框选分析')).isDisabled();
  const before = traffic();
  // 量尺落点：画布中间一带偏右的两格（上沿被量尺面板盖住、下沿被工具箱盖住）。
  const size = system.size, cells = [[Math.floor(size * .4), Math.floor(size * .9)], [Math.floor(size * .58), Math.floor(size * .62)]];
  // 与数据同向：屏幕的列、行就是数据的列、行。
  if (system.ruler) await measure(`${label} 与数据同向`, system, cells, (row, col) => [col, row]);
  if (selectable) await selectRegion(`${label} 与数据同向`, system, first);
  /** 画布自己的位图；从画布导出图片用的就是它。 */
  const bitmap = () => page.locator(system.canvas).first().evaluate((canvas) => canvas.toDataURL());
  const exported = system.bitmap ? await bitmap() : null;
  /** 每一步之后：画面到位、数据没动、画布里的像素没动。 */
  const check = async (step, pressed, blocks, values = first) => {
    await orientation(`${label} ${step}`, pressed);
    await expectBlocks(`${label} ${step}`, system, blocks);
    await assertDataUntouched(`${label} ${step}`, system, view, values);
    if (system.bitmap && values === first) assert.equal(await bitmap(), exported, `${label} ${step}: 画布里的像素被改了，导出的图会跟着变`);
  };

  // 旋转：顺时针四次回到原位。
  for (let turn = 1; turn <= 4; turn++) {
    await press('rotate');
    await check(`第 ${turn} 次旋转后`, { rotate: turn < 4 }, turnBlocks(upright, turn));
    if (turn === 1) await page.screenshot({ path: join(artifacts, `${system.id}-${view}-rotated.png`) });
  }

  // 翻转：水平 → 再纵向（两个都翻等于转半圈）→ 撤掉水平（只剩纵向）→ 撤掉纵向回到原样。
  await press('flipX');
  await check('水平翻转后', { flipX: true }, mirrorBlocks(upright, 'x'));
  await page.screenshot({ path: join(artifacts, `${system.id}-${view}-flipped.png`) });
  // 左右镜像：屏幕上从右往左数的列号是数据的列号，行不变。
  if (system.ruler) await measure(`${label} 水平翻转后`, system, cells, (row, col) => [size - 1 - col, row]);
  await press('flipY');
  await check('再纵向翻转后', { flipX: true, flipY: true }, mirrorBlocks(mirrorBlocks(upright, 'x'), 'y'));
  await press('flipX');
  await check('撤掉水平翻转后', { flipY: true }, mirrorBlocks(upright, 'y'));
  await press('flipY');
  await check('撤掉纵向翻转后', {}, upright);
  assert.equal(await (await tool('数据分析', '框选分析')).isDisabled(), !selectable, `${label}: 回到与数据同向后框选恢复原来的可用状态`);
  // 转过、翻过再回来，按屏幕框选选中的仍是对应的原始行列。
  if (selectable) await selectRegion(`${label} 转过翻过再回到同向`, system, first);

  // 转过之后再翻：翻的是当前看到的左右，不是数据原来的左右。
  await press('rotate');
  await check('转过一次', { rotate: true }, turnBlocks(upright, 1));
  // 顺时针一次：原来的上边到了右边，所以屏幕上的行号是数据的列号，屏幕上从右往左数的列号是数据的行号。
  if (system.ruler) await measure(`${label} 转过一次`, system, cells, (row, col) => [row, size - 1 - col]);
  send(system, second); await delivered(system, view, second);
  await expectBlocks(`${label} 转过之后来的新帧保持转过的方向`, system, turnBlocks(upright, 1));
  await press('flipX');
  await check('转过之后水平翻转', { rotate: true, flipX: true }, finalBlocks(upright), second);
  // 转过那幅再左右镜像：屏幕上的行号是数据的列号，屏幕上的列号是数据的行号。
  if (system.ruler) await measure(`${label} 转过之后水平翻转`, system, cells, (row, col) => [row, col]);
  if (selectable) assert.equal(await (await tool('数据分析', '框选分析')).isDisabled(), true, `${label}: 转过、翻过之后不提供按屏幕框选`);
  // 「转过一次再水平翻转」和「水平翻转再逆时针一次」是同一幅画面，保存时记成后一种。
  await settle(`${label}: 保存的展示方向`, async () => (await savedViews(system))[view], { quarterTurns: 3, flipX: true, flipY: false });
  assert.deepEqual(traffic(), before, `${label}: 旋转、翻转和量尺不向后端发任何命令或消息`);
  return upright;
}

/** 走完一个系统：两个显示模式各管各的方向，刷新页面之后各自记得，恢复视角回到与数据同向。 */
async function verifySystem(system) {
  const first = pattern(system.size, 0), second = pattern(system.size, 12);
  await enter(system);
  const normal = system.point ? await verifyPointView(system, first, second) : await verifyMatrixView(system, 'normal', first, second);
  await mode(MODES.numoriginal);
  await page.locator(system.canvas).first().waitFor();
  // 进入原始数据时三个按钮都没按下、画面与数据同向：上一个模式的方向不带过来（verifyMatrixView 开头核对）。
  const raw = await verifyMatrixView(system, 'numoriginal', first, second);
  const turnedAndFlipped = { quarterTurns: 3, flipX: true, flipY: false };
  assert.deepEqual(await savedViews(system), { normal: system.point ? { quarterTurns: 1, flipX: false, flipY: false } : turnedAndFlipped, numoriginal: turnedAndFlipped },
    `${system.id}: 两个模式各自保存展示方向`);

  await enter(system);
  send(system, first); await delivered(system, 'normal', first);
  if (system.point) {
    await orientation(`${system.id} 重新进入${MODES.normal}`, { rotate: true });
    assertSamePicture(`${system.id} 重新进入后 3D 点图保持转过的方向`, normal.once, await capturePointPicture(page, 30), { data: false });
  } else {
    await orientation(`${system.id} 重新进入${MODES.normal}`, { rotate: true, flipX: true });
    await expectBlocks(`${system.id} 重新进入后${MODES.normal}保持原来的方向`, system, finalBlocks(normal));
  }
  await (await tool('视角调节', '恢复视角')).click();
  await orientation(`${system.id} ${MODES.normal}恢复视角`);
  if (system.point) assertSamePicture(`${system.id} 恢复视角回到没转的 3D 点图`, normal.base, await capturePointPicture(page, 30), { data: false });
  else await expectBlocks(`${system.id} 恢复视角回到与数据同向`, system, normal);
  await mode(MODES.numoriginal);
  await page.locator(system.canvas).first().waitFor();
  send(system, first); await delivered(system, 'numoriginal', first);
  await orientation(`${system.id} 重新进入${MODES.numoriginal}`, { rotate: true, flipX: true });
  await expectBlocks(`${system.id} 重新进入后${MODES.numoriginal}保持原来的方向`, system, finalBlocks(raw));
  await (await tool('视角调节', '恢复视角')).click();
  await orientation(`${system.id} ${MODES.numoriginal}恢复视角`);
  await expectBlocks(`${system.id} 恢复视角回到与数据同向的${MODES.numoriginal}`, system, raw);
  const upright = { quarterTurns: 0, flipX: false, flipY: false };
  await settle(`${system.id}: 恢复之后保存的展示方向`, () => savedViews(system), { normal: upright, numoriginal: upright });
  console.log('DISPLAY_ORIENTATION_SYSTEM_PASS', system.id, JSON.stringify(system.point
    ? { layers: normal.layers, centerError: normal.centerError, rawUpright: raw } : { normalUpright: normal, rawUpright: raw }));
}

try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(30000); page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(installPointPictureProbe);
  await page.routeWebSocket(/:19999/, (socket) => {
    sockets.add(socket); socket.onClose(() => sockets.delete(socket));
    // 页面发给后端的每一条消息都记下来：改展示方向不应该产生任何一条。
    socket.onMessage((message) => uplink.push(String(message)));
    socket.send(JSON.stringify({ licenseKey: 'fixture-key', ...license, currentSensorType: current }));
  });
  await page.route('http://127.0.0.1:19245/**', (route) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;
    // 除了查询之外的请求（命令、采集、导出）全部记下来。
    if (request.method() !== 'GET') commands.push({ path, body: request.postData() });
    if (path === '/api/collection/status') return route.fulfill({ headers, json: { current: null, collectionSummary: null, recent: [] } });
    if (path === '/api/display-systems') return route.fulfill({ headers, json: { displaySystems: { runtimeDefinitions: [] } } });
    if (path === '/api/algorithm-market') return route.fulfill({ headers, json: { packages: [], instances: [] } });
    if (path === '/api/commands') {
      const command = request.postDataJSON();
      const results = command.type === 'license.activate' ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [];
      return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { results } } } });
    }
    return route.fulfill({ headers, json: {} });
  });
  const only = process.argv.find((value) => value.startsWith('--only='))?.slice(7);
  const systems = SYSTEMS.filter((system) => !only || system.id === only);
  assert.ok(systems.length > 0, `没有名为 ${only} 的系统`);
  for (const system of systems) await verifySystem(system);
  assert.deepEqual(errors, []);
  console.log('DISPLAY_ORIENTATION_HOME_PASS', JSON.stringify({ artifacts, systems: systems.map((system) => system.id), commands: commands.length, uplink: uplink.length }));
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('DISPLAY_ORIENTATION_HOME_FAILED', JSON.stringify({ artifacts, system: current, errors })); throw error;
} finally { await browser?.close(); await server.close(); }
