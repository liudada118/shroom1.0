import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const screenshots = await mkdtemp(join(tmpdir(), 'shroom-glove-exhibition-'));
const sockets = new Set();
const errors = [];
let sequence = 0;

/** 点击真实选择器和选项，走正式Title事件而非直接调用渲染器。 */
async function choose(page, label, value) {
  const input = page.getByRole('combobox', { name: label, exact: true });
  await input.locator('xpath=ancestor::div[contains(@class,"ant-select")]').first().locator('.ant-select-selector').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').getByText(value, { exact: true }).click();
}

/** 创建明确的测试压力矩阵与147点映射，零帧保留未扣零基准用于验证展示输入。 */
function packet(sensorType, side, level, { zero = false, quaternion = [0, 0, 0, 1], mappedLength = 147 } = {}) {
  const raw = Array(256).fill(level);
  const processed = Array(256).fill(zero ? 0 : level);
  const mapped = Array(mappedLength).fill(zero ? 0 : level);
  const channel = side === 'right' ? 'back' : 'sit';
  return { type: 'sensor.frame', schemaVersion: 1, channelId: `${sensorType}:${channel}`,
    displaySystemId: sensorType, sensorId: channel, sensorLabel: `${side} test glove`,
    outputChannel: channel, sensorType, source: 'realtime', sequence: ++sequence,
    timestamp: Date.now(), quality: 'good', payload: { value: processed,
      matrix: { rows: 16, cols: 16, total: 256 }, orientation: quaternion,
      stages: { decoded: raw, calibrated: raw, processed, mapped }, protocol: { handSide: side } } };
}

/** 只通过WebSocket发canonical信封，保留真实decoder/身份筛选/模式分派。 */
function send(frame) {
  assert.ok(sockets.size > 0, '真实Home已建立隔离WebSocket');
  for (const socket of sockets) socket.send(JSON.stringify(frame));
}

/** 构造真实设备复位事件，不直接调用渲染器ref。 */
function resetEvent(displaySystemId, side) {
  const channel = side === 'right' ? 'back' : 'sit';
  return { handReset: true, handSide: side, outputChannel: channel, displaySystemId, sensorId: channel };
}

/** 数值比较允许滤波最后几个小数继续收敛，不把另一侧实际归位误判成不变。 */
function assertQuaternionSame(actual, expected, message) {
  assert.ok(actual.every((value, index) => Math.abs(value - expected[index]) < .00001), message);
}

/** 置零只能更改姿态，压力与手指不受复位事件影响。 */
function assertMotionDataSame(actual, expected, message) {
  assert.equal(actual.pressureTotal, expected.pressureTotal, `${message}：压力保持`);
  assert.ok(actual.fingers.every((value, index) => Math.abs(value - expected.fingers[index]) < .0001), `${message}：手指保持`);
}

/** 等待指定侧确实收到复位事件并立即处于零姿态。 */
async function waitMotionReset(page, side, previousResets, pending = null) {
  await page.waitForFunction(({ side, previousResets, pending }) => {
    const hand = window.exhibitionHome.com.current.getSnapshot().hands[side];
    return hand.quaternionResets > previousResets && hand.quaternion.slice(0, 3).every((value) => Math.abs(value) < .000001)
      && Math.abs(Math.abs(hand.quaternion[3]) - 1) < .000001 && (pending == null || hand.zeroPending === pending);
  }, { side, previousResets, pending });
}

/** 等到非零姿态后让展示滤波收敛，以便比较另一侧没有被复位。 */
async function waitMotionRotated(page, side) {
  await page.waitForFunction((side) => window.exhibitionHome.com.current.getSnapshot().hands[side].quaternion
    .slice(0, 3).some((value) => Math.abs(value) > .05), side);
  await page.waitForTimeout(700);
}

/** 经设备事件验证左右独立零点与同值不反弹，读取快照只用于观察。 */
async function verifyDualMotionReset(page) {
  const leftPose = [.25, 0, 0, .968], rightPose = [0, .35, 0, .936];
  send(packet('hand0205Double', 'left', 10, { quaternion: leftPose }));
  send(packet('hand0205Double', 'right', 70, { quaternion: rightPose }));
  await waitMotionRotated(page, 'left');
  await waitMotionRotated(page, 'right');
  const before = await snapshot(page);
  send(resetEvent('handGlove115200', 'left'));
  send({ handReset: true });
  await page.waitForTimeout(100);
  let current = await snapshot(page);
  assert.equal(current.hands.left.quaternionResets, before.hands.left.quaternionResets, '双手裸事件与其他系统事件不复位左手');
  assert.equal(current.hands.right.quaternionResets, before.hands.right.quaternionResets, '双手裸事件不复位右手');
  send(resetEvent('hand0205Double', 'left'));
  await waitMotionReset(page, 'left', before.hands.left.quaternionResets, true);
  current = await snapshot(page);
  assertQuaternionSame(current.hands.right.quaternion, before.hands.right.quaternion, '左手复位不改变右手显示');
  assert.equal(current.hands.right.quaternionResets, before.hands.right.quaternionResets);
  for (const side of ['left', 'right']) assertMotionDataSame(current.hands[side], before.hands[side], '左手复位');
  send(packet('hand0205Double', 'left', 10, { quaternion: leftPose }));
  await page.waitForFunction((received) => {
    const hand = window.exhibitionHome.com.current.getSnapshot().hands.left;
    return hand.received > received && !hand.zeroPending && hand.hasQuaternion
      && hand.quaternion.slice(0, 3).every((value) => Math.abs(value) < .000001);
  }, current.hands.left.received);
  send(packet('hand0205Double', 'right', 70, { quaternion: rightPose }));
  await page.waitForFunction((received) => window.exhibitionHome.com.current.getSnapshot().hands.right.received > received,
    current.hands.right.received);
  assertQuaternionSame((await snapshot(page)).hands.right.quaternion, before.hands.right.quaternion,
    '左手置零后右侧相同读数沿用自己的旧基准');
  await page.screenshot({ path: join(screenshots, 'motion-dual-reset-left.png') });
  send(packet('hand0205Double', 'left', 10, { quaternion: [.48, 0, 0, .877] }));
  await waitMotionRotated(page, 'left');
  const beforeRight = await snapshot(page);
  send(resetEvent('hand0205Double', 'right'));
  await waitMotionReset(page, 'right', beforeRight.hands.right.quaternionResets, true);
  current = await snapshot(page);
  assertQuaternionSame(current.hands.left.quaternion, beforeRight.hands.left.quaternion, '右手复位不改变左手显示');
  assert.equal(current.hands.left.quaternionResets, beforeRight.hands.left.quaternionResets);
  for (const side of ['left', 'right']) assertMotionDataSame(current.hands[side], beforeRight.hands[side], '右手复位');
  send(packet('hand0205Double', 'right', 70, { quaternion: rightPose }));
  await page.waitForFunction((received) => {
    const hand = window.exhibitionHome.com.current.getSnapshot().hands.right;
    return hand.received > received && !hand.zeroPending && hand.hasQuaternion
      && hand.quaternion.slice(0, 3).every((value) => Math.abs(value) < .000001);
  }, current.hands.right.received);
  await page.screenshot({ path: join(screenshots, 'motion-dual-reset-right.png') });
}

/** 普通3D遥操同样经真实按侧事件复位，不借用炫酷场景的实现。 */
async function verifyNormalDualReset(page) {
  await choose(page, '显示方式', '3D 遥操');
  await page.waitForFunction(() => typeof window.exhibitionHome.com.current?.getQuaternionSnapshot === 'function');
  for (const side of ['left', 'right']) send(packet('hand0205Double', side, side === 'left' ? 10 : 70));
  await page.waitForFunction(() => Object.values(window.exhibitionHome.com.current.getQuaternionSnapshot())
    .every((values) => Array.isArray(values) && values.slice(0, 3).every((value) => Math.abs(value) < .000001)));
  send(packet('hand0205Double', 'left', 10, { quaternion: [.25, 0, 0, .968] }));
  send(packet('hand0205Double', 'right', 70, { quaternion: [0, .35, 0, .936] }));
  await page.waitForFunction(() => Object.values(window.exhibitionHome.com.current.getQuaternionSnapshot())
    .every((values) => values.slice(0, 3).some((value) => Math.abs(value) > .05)));
  const before = await page.evaluate(() => window.exhibitionHome.com.current.getQuaternionSnapshot());
  send({ handReset: true });
  await page.waitForTimeout(80);
  assert.deepEqual(await page.evaluate(() => window.exhibitionHome.com.current.getQuaternionSnapshot()), before, '普通双手忽略无side裸复位');
  send(resetEvent('hand0205Double', 'left'));
  await page.waitForFunction(() => window.exhibitionHome.com.current.getQuaternionSnapshot().left.slice(0, 3)
    .every((value) => Math.abs(value) < .000001));
  let current = await page.evaluate(() => window.exhibitionHome.com.current.getQuaternionSnapshot());
  assertQuaternionSame(current.right, before.right, '普通遥操左复位不动右侧');
  send(packet('hand0205Double', 'left', 10, { quaternion: [.25, 0, 0, .968] }));
  await page.waitForTimeout(100);
  assertQuaternionSame((await page.evaluate(() => window.exhibitionHome.com.current.getQuaternionSnapshot())).left, current.left,
    '普通遥操相同左读数不反弹');
  send(resetEvent('hand0205Double', 'right'));
  await page.waitForFunction(() => window.exhibitionHome.com.current.getQuaternionSnapshot().right.slice(0, 3)
    .every((value) => Math.abs(value) < .000001));
  current = await page.evaluate(() => window.exhibitionHome.com.current.getQuaternionSnapshot());
  assert.ok(current.left.slice(0, 3).every((value) => Math.abs(value) < .000001));
  await page.screenshot({ path: join(screenshots, 'normal-dual-reset.png') });
  await choose(page, '显示方式', '炫酷摇操');
  await waitRenderer(page, 'gloveMotion');
}

/** 两个相反符号的单位四元数代表同一旋转，比较时同时考虑这两种表达。 */
function quaternionDistance(actual, expected) {
  return Math.min(Math.hypot(...actual.map((value, index) => value - expected[index])),
    Math.hypot(...actual.map((value, index) => value + expected[index])));
}

/** 只读Home末帧确认WS消息已处理，不能把仍未收到post-init帧的零姿态当作建零成功。 */
async function sendOrientationFrame(page, system, side, level, quaternion) {
  send(packet(system, side, level, { quaternion }));
  await page.waitForFunction(({ side, level, quaternion }) => {
    const frame = window.exhibitionHome.gloveExhibitionFrames?.[side];
    return frame?.pressure?.[0] === level && frame.quaternion?.every((value, index) => value === quaternion[index]);
  }, { side, level, quaternion });
}

/** 经真实帧和设备事件为两种展示建立同一双手基准，不写入渲染器状态。 */
async function zeroDualOrientation(page, mode, baseline) {
  await choose(page, '显示方式', mode === 'normal' ? '3D 遥操' : '炫酷摇操');
  if (mode === 'normal') {
    await page.waitForFunction(() => {
      const state = window.exhibitionHome.com.current?.getQuaternionSnapshot?.();
      return state && ['left', 'right'].every((side) => state[side]?.length === 4);
    });
  } else await waitRenderer(page, 'gloveMotion');
  const before = mode === 'normal' ? null : await snapshot(page);
  for (const side of ['left', 'right']) send(packet('hand0205Double', side, side === 'left' ? 10 : 70, { quaternion: baseline }));
  if (mode === 'normal') await page.waitForTimeout(100);
  else await page.waitForFunction((previous) => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return ['left', 'right'].every((side) => state.hands[side].received > previous.hands[side].received);
  }, before);
  const beforeReset = mode === 'normal' ? null : await snapshot(page);
  for (const side of ['left', 'right']) send(resetEvent('hand0205Double', side));
  if (mode === 'normal') {
    await page.waitForFunction(() => Object.values(window.exhibitionHome.com.current.getQuaternionSnapshot())
      .every((values) => values.slice(0, 3).every((value) => Math.abs(value) < .000001)
        && Math.abs(Math.abs(values[3]) - 1) < .000001));
  } else {
    await waitMotionReset(page, 'left', beforeReset.hands.left.quaternionResets, true);
    await waitMotionReset(page, 'right', beforeReset.hands.right.quaternionResets, true);
  }
  for (const side of ['left', 'right']) await sendOrientationFrame(page, 'hand0205Double', side, side === 'left' ? 11 : 71, baseline);
  if (mode === 'normal') {
    const current = await page.evaluate(() => window.exhibitionHome.com.current.getQuaternionSnapshot());
    for (const side of ['left', 'right']) assert.ok(quaternionDistance(current[side], [0, 0, 0, 1]) < .000001,
      'post-init基准帧已到达，普通遥操才开始方向比较');
  } else await page.waitForFunction(() => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return ['left', 'right'].every((side) => !state.hands[side].zeroPending && state.hands[side].hasQuaternion
      && state.hands[side].quaternion.slice(0, 3).every((value) => Math.abs(value) < .000001));
  });
}

/** 以普通遥操真实输出作基准，逐轴和混合输入比较Motion两侧的实际显示方向。 */
async function verifyMotionOrientationMatchesNormal(page) {
  const sine = Math.sin(Math.PI / 8), cosine = Math.cos(Math.PI / 8);
  const mixed = [
    { label: 'mixed-positive', quaternion: [.18, -.27, .31, Math.sqrt(1 - .18 ** 2 - .27 ** 2 - .31 ** 2)] },
    { label: 'mixed-negative', quaternion: [-.24, .19, -.16, Math.sqrt(1 - .24 ** 2 - .19 ** 2 - .16 ** 2)] },
  ];
  const poses = [
    { label: 'raw-x-positive', quaternion: [sine, 0, 0, cosine] },
    { label: 'raw-x-negative', quaternion: [-sine, 0, 0, cosine] },
    { label: 'raw-y-positive', quaternion: [0, sine, 0, cosine] },
    { label: 'raw-y-negative', quaternion: [0, -sine, 0, cosine] },
    { label: 'raw-z-positive', quaternion: [0, 0, sine, cosine] },
    { label: 'raw-z-negative', quaternion: [0, 0, -sine, cosine] },
    ...mixed,
  ];
  let comparisons = 0;
  for (const baseline of [
    { label: 'identity', quaternion: [0, 0, 0, 1], poses },
    { label: 'non-identity', quaternion: [.22, -.16, .12, Math.sqrt(1 - .22 ** 2 - .16 ** 2 - .12 ** 2)], poses: mixed },
  ]) {
    await zeroDualOrientation(page, 'normal', baseline.quaternion);
    const expected = [];
    for (const pose of baseline.poses) {
      const previous = await page.evaluate(() => window.exhibitionHome.com.current.getQuaternionSnapshot());
      for (const side of ['left', 'right']) send(packet('hand0205Double', side, side === 'left' ? 10 : 70, { quaternion: pose.quaternion }));
      await page.waitForFunction((previous) => {
        const state = window.exhibitionHome.com.current.getQuaternionSnapshot();
        return ['left', 'right'].every((side) => Math.min(
          Math.hypot(...state[side].map((value, index) => value - previous[side][index])),
          Math.hypot(...state[side].map((value, index) => value + previous[side][index]))) > .01);
      }, previous);
      expected.push(await page.evaluate(() => window.exhibitionHome.com.current.getQuaternionSnapshot()));
    }
    await zeroDualOrientation(page, 'gloveMotion', baseline.quaternion);
    for (const [index, pose] of baseline.poses.entries()) {
      const before = await snapshot(page);
      for (const side of ['left', 'right']) send(packet('hand0205Double', side, side === 'left' ? 10 : 70, { quaternion: pose.quaternion }));
      await page.waitForFunction(({ expected, before }) => {
        const state = window.exhibitionHome.com.current.getSnapshot();
        return ['left', 'right'].every((side) => state.hands[side].received > before.hands[side].received && Math.min(
          Math.hypot(...state.hands[side].quaternion.map((value, index) => value - expected[side][index])),
          Math.hypot(...state.hands[side].quaternion.map((value, index) => value + expected[side][index]))) < .00001);
      }, { expected: expected[index], before }, { timeout: 5000 });
      const actual = await snapshot(page);
      for (const side of ['left', 'right']) {
        assert.ok(quaternionDistance(actual.hands[side].quaternion, expected[index][side]) < .00001,
          `${baseline.label}基准 ${pose.label}：${side}的Motion方向与普通3D遥操一致`);
        comparisons += 1;
      }
    }
  }
  console.log('MOTION_NORMAL_ORIENTATION_MATCH_PASS', JSON.stringify({ comparisons }));
}

/** 统一读取真实显示姿态；普通单手的唯一group由left字段承载当前显示右手。 */
async function readInitializationState(page, mode, dual) {
  return page.evaluate(({ mode, dual }) => {
    const handle = window.exhibitionHome.com.current;
    if (mode === 'gloveMotion') {
      const state = handle.getSnapshot();
      return { quaternions: Object.fromEntries(['left', 'right'].map((side) => [side, state.hands[side].quaternion])), hands: state.hands };
    }
    const state = handle.getQuaternionSnapshot();
    return { quaternions: dual ? state : { right: state.left } };
  }, { mode, dual });
}

/** 等待设备姿态真正带动目标侧显示，再让Motion滤波收敛以核对另一侧不变。 */
async function waitInitializationRotation(page, mode, dual, side) {
  await page.waitForFunction(({ mode, dual, side }) => {
    const handle = window.exhibitionHome.com.current;
    const quaternion = mode === 'gloveMotion' ? handle.getSnapshot().hands[side].quaternion
      : handle.getQuaternionSnapshot()[dual ? side : 'left'];
    return quaternion.slice(0, 3).some((value) => Math.abs(value) > .05);
  }, { mode, dual, side });
  if (mode === 'gloveMotion') await page.waitForTimeout(700);
}

/** 通过真实硬件事件验证旧坐标系被丢弃，下一有效新读数才成为本侧零点。 */
async function verifyHardwareInitialization(page) {
  const identity = [0, 0, 0, 1];
  const oldRight = [.18, -.25, .12, .74], oldLeft = [.13, .24, -.17, .9];
  const newRight = [.32, .05, -.21, .81], relativeRight = [.46, -.12, -.08, .71];
  const reentryRight = [-.29, .23, .18, .79], reentryRelative = [-.09, .41, .24, .74];
  let cases = 0;
  for (const { system, mode, dual } of [
    { system: 'hand0205', mode: 'gloveMotion', dual: false },
    { system: 'hand0205Double', mode: 'gloveMotion', dual: true },
    { system: 'hand0205Double', mode: 'normal', dual: true },
    { system: 'hand0205', mode: 'normal', dual: false },
  ]) {
    await setSystem(page, system, mode);
    if (mode === 'gloveMotion') await waitRenderer(page, 'gloveMotion');
    else await page.waitForFunction((dual) => {
      const state = window.exhibitionHome.com.current?.getQuaternionSnapshot?.();
      return state?.left?.length === 4 && (!dual || state.right?.length === 4);
    }, dual);
    if (!dual) await choose(page, '显示手', '右手');
    const initial = await readInitializationState(page, mode, dual);
    for (const side of ['left', 'right']) send(resetEvent(system, side));
    if (mode === 'gloveMotion') {
      for (const side of ['left', 'right']) await waitMotionReset(page, side, initial.hands[side].quaternionResets, true);
    }
    await sendOrientationFrame(page, system, 'left', 18, identity);
    await sendOrientationFrame(page, system, 'right', 36, identity);
    await sendOrientationFrame(page, system, 'left', 18, oldLeft);
    await sendOrientationFrame(page, system, 'right', 36, oldRight);
    await waitInitializationRotation(page, mode, dual, 'right');
    if (mode === 'gloveMotion' || dual) await waitInitializationRotation(page, mode, dual, 'left');
    const before = await readInitializationState(page, mode, dual);
    assert.ok(Math.abs(Math.hypot(...oldRight) - 1) > .1, '初始化前输入明确不是单位长度四元数');
    if (mode === 'normal' && !dual) {
      send(resetEvent(system, 'left'));
      await page.waitForTimeout(100);
      const afterHiddenReset = await readInitializationState(page, mode, dual);
      assertQuaternionSame(afterHiddenReset.quaternions.right, before.quaternions.right,
        '普通单手显示右手时，隐藏左手初始化只清其缓存，不能清除当前唯一group的姿态');
    }
    send(resetEvent('handGlove115200', 'right'));
    if (dual) send({ handReset: true });
    await page.waitForTimeout(100);
    let current = await readInitializationState(page, mode, dual);
    for (const side of Object.keys(before.quaternions)) assertQuaternionSame(current.quaternions[side], before.quaternions[side],
      `${mode}/${system}：其他系统通知及双手裸通知不能改变显示`);
    if (mode === 'gloveMotion') for (const side of ['left', 'right']) {
      assert.equal(current.hands[side].quaternionResets, before.hands[side].quaternionResets);
    }
    send(resetEvent(system, 'right'));
    if (mode === 'gloveMotion') await waitMotionReset(page, 'right', before.hands.right.quaternionResets, true);
    else await page.waitForFunction((dual) => window.exhibitionHome.com.current.getQuaternionSnapshot()[dual ? 'right' : 'left']
      .slice(0, 3).every((value) => Math.abs(value) < .000001), dual);
    current = await readInitializationState(page, mode, dual);
    assert.ok(quaternionDistance(current.quaternions.right, identity) < .000001, '硬件通知立即恢复零姿态');
    const cachedOrientation = await page.evaluate(() => ({
      exhibition: window.exhibitionHome.gloveExhibitionFrames?.right?.quaternion,
      single: window.exhibitionHome.singleGloveFrames?.right?.rotate,
      singlePayload: window.exhibitionHome.singleGloveFrames?.right?.payload?.orientation,
    }));
    assert.equal(cachedOrientation.exhibition, null, '初始化同步清除展示末帧旧姿态，不能在模式切换时重放旧参考系');
    if (!dual) {
      assert.equal(cachedOrientation.single, null, '单手末帧不保留初始化前姿态');
      assert.equal(cachedOrientation.singlePayload, null, '单手canonical缓存不保留初始化前姿态');
    }
    if (current.quaternions.left) assertQuaternionSame(current.quaternions.left, before.quaternions.left, '右侧初始化不改变左侧显示');
    if (mode === 'gloveMotion') {
      assert.equal(current.hands.right.hasQuaternion, false, '硬件通知丢弃初始化前最新姿态');
      for (const side of ['left', 'right']) assertMotionDataSame(current.hands[side], before.hands[side], '硬件通知');
    }
    for (const quaternion of [null, [0, 0, 0, 0], ['bad', 0, 0, 1]]) send(packet(system, 'right', 36, { quaternion }));
    send(packet('handGlove115200', 'right', 99, { quaternion: [.08, .15, .12, .9] }));
    await sendOrientationFrame(page, system, 'left', 18, [-.2, .19, .11, .89]);
    if (mode === 'gloveMotion') await page.waitForTimeout(700);
    current = await readInitializationState(page, mode, dual);
    assert.ok(quaternionDistance(current.quaternions.right, identity) < .000001,
      `${mode}/${system}：坏帧、缺失帧、其他系统帧及另一侧帧不能消耗本侧等待`);
    if (mode === 'gloveMotion') {
      assert.equal(current.hands.right.zeroPending, true);
      assert.equal(current.hands.right.hasQuaternion, false);
      assert.equal(current.hands.right.pressureTotal, 147 * 36, '被拒绝系统的压力也不能污染等待中的手');
    }
    const otherSide = current.quaternions.left;
    if (otherSide) assert.ok(quaternionDistance(otherSide, before.quaternions.left) > .01, '本侧等待期间另一侧姿态继续实时更新');
    await sendOrientationFrame(page, system, 'right', 37, newRight);
    current = await readInitializationState(page, mode, dual);
    assert.ok(quaternionDistance(current.quaternions.right, identity) < .000001,
      `${mode}/${system}：完全不同的首个post-init读数建立新零点，不能相对旧读数旋转`);
    if (mode === 'gloveMotion') {
      assert.equal(current.hands.right.zeroPending, false);
      assert.equal(current.hands.right.hasQuaternion, true);
    }
    await sendOrientationFrame(page, system, 'right', 38, newRight);
    current = await readInitializationState(page, mode, dual);
    assert.ok(quaternionDistance(current.quaternions.right, identity) < .000001, '相同post-init读数持续为零姿态，不反弹');
    await page.screenshot({ path: join(screenshots, `hardware-init-${mode}-${system}-first-frame.png`) });
    await sendOrientationFrame(page, system, 'right', 39, relativeRight);
    await waitInitializationRotation(page, mode, dual, 'right');
    current = await readInitializationState(page, mode, dual);
    assert.ok(quaternionDistance(current.quaternions.right, identity) > .05, '建立新零点后后续相对动作正常响应');
    if (otherSide) assertQuaternionSame(current.quaternions.left, otherSide, '右侧新零点和相对动作不改左侧基准');
    if (mode === 'normal') {
      await choose(page, '显示方式', '热力地图');
      await waitRenderer(page, 'gloveTerrain');
      send(resetEvent(system, 'right'));
      await page.waitForFunction(() => window.exhibitionHome.gloveExhibitionFrames?.right?.quaternion === null);
      await choose(page, '显示方式', '3D 遥操');
      await page.waitForFunction((dual) => {
        const state = window.exhibitionHome.com.current?.getQuaternionSnapshot?.();
        return state?.left?.length === 4 && (!dual || state.right?.length === 4);
      }, dual);
      assert.ok(quaternionDistance((await readInitializationState(page, mode, dual)).quaternions.right, identity) < .000001,
        '其他模式收到硬件通知后，普通遥操重新挂载且无新姿态帧时显示零姿态');
      await sendOrientationFrame(page, system, 'right', 40, reentryRight);
      current = await readInitializationState(page, mode, dual);
      assert.ok(quaternionDistance(current.quaternions.right, identity) < .000001,
        '重新挂载后的首个不同新读数建立零点，不能复用卸载前的模块基准');
      await sendOrientationFrame(page, system, 'right', 41, reentryRight);
      assert.ok(quaternionDistance((await readInitializationState(page, mode, dual)).quaternions.right, identity) < .000001,
        '跨模式初始化后的相同新读数不反弹');
      await sendOrientationFrame(page, system, 'right', 42, reentryRelative);
      await waitInitializationRotation(page, mode, dual, 'right');
      assert.ok(quaternionDistance((await readInitializationState(page, mode, dual)).quaternions.right, identity) > .05,
        '跨模式初始化建立新零点后，相对动作继续响应');
      await page.screenshot({ path: join(screenshots, `hardware-init-normal-${system}-mode-reentry.png`) });
      console.log('NORMAL_HARDWARE_MODE_REENTRY_PASS', system);
    }
    cases += 1;
  }
  console.log('HARDWARE_INITIALIZATION_HANDOFF_PASS', JSON.stringify({ cases }));
}

/** 观察实际骨骼弯曲收敛，不把校准目标值冒充最终显示姿态。 */
async function waitMotionFingers(page, side, value) {
  await page.waitForFunction(({ side, value }) => window.exhibitionHome.com.current.getSnapshot().hands[side].fingers
    .every((finger) => Math.abs(finger - value) < .0001), { side, value });
}

/** 验证校准仅预览选定手，且实际手指到达平铺或握拳姿态。 */
async function waitCalibrationPreview(page, side, pose) {
  await page.waitForFunction(({ side, pose }) => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return state.calibration.active && state.calibration.side === side && state.calibration.pose === pose
      && state.hands[side].fingers.every((finger) => Math.abs(finger - pose) < .0001);
  }, { side, pose });
}

/** 校准期间仍经canonical帧更新压力，采集使用这些帧的最新真实弯指读数。 */
async function feedCalibrationPressure(page, system, levels) {
  for (const [side, level] of Object.entries(levels)) send(packet(system, side, level));
  await page.waitForFunction((levels) => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return Object.entries(levels).every(([side, level]) => state.hands[side].pressureTotal === 147 * level);
  }, levels);
}

/** 读取用户按钮实际保存的手指基准，测试不直接更新Home或渲染器ref。 */
async function readSavedFingerCalibration(page, side) {
  return page.evaluate((side) => JSON.parse(localStorage.getItem(side === 'right' ? 'fingerArrR' : 'fingerArrL')), side);
}

/** 通过真实校准弹窗验证单手当前手、双手独立预览和关闭后的缓存弯指恢复。 */
async function verifyMotionCalibration(page) {
  const display = page.getByRole('region', { name: '渲染与显示', exact: true });
  const calibrate = display.getByRole('button', { name: /^校\s*准$/ });
  const dialog = page.getByRole('dialog', { name: '设备校准', exact: true });
  await setSystem(page, 'hand0205', 'gloveMotion');
  await waitRenderer(page, 'gloveMotion');
  await choose(page, '显示手', '右手');
  await feedCalibrationPressure(page, 'hand0205', { left: 15, right: 25 });
  const initialLeftCalibration = await readSavedFingerCalibration(page, 'left');
  assert.equal(await calibrate.isEnabled(), true, '炫酷摇操可以直接打开校准');
  await calibrate.click();
  await dialog.waitFor();
  assert.equal(await dialog.locator('.ant-select-selection-item').first().innerText(), '右手', '单手校准沿用当前显示右手');
  await choose(page, '校准姿态', '手指握拳');
  await waitCalibrationPreview(page, 'right', 1);
  await feedCalibrationPressure(page, 'hand0205', { right: 50 });
  await waitCalibrationPreview(page, 'right', 1);
  await dialog.getByRole('button', { name: '采集数据', exact: true }).click();
  const rightFist = await readSavedFingerCalibration(page, 'right');
  assert.ok(rightFist[1].every((value) => Number.isFinite(value) && value > 0), '握拳采集写入最新真实压力读数');
  assert.deepEqual(await readSavedFingerCalibration(page, 'left'), initialLeftCalibration, '单手右校准不覆盖左手');
  await choose(page, '校准姿态', '手指平铺');
  await waitCalibrationPreview(page, 'right', 0);
  await feedCalibrationPressure(page, 'hand0205', { right: 10 });
  await dialog.getByRole('button', { name: '采集数据', exact: true }).click();
  const singleRightCalibration = await readSavedFingerCalibration(page, 'right');
  assert.deepEqual(singleRightCalibration[1], rightFist[1], '平铺采集保留握拳基准');
  assert.ok(singleRightCalibration[0].every((value, index) => value > 0 && value < singleRightCalibration[1][index]));
  await feedCalibrationPressure(page, 'hand0205', { right: 30 });
  await waitCalibrationPreview(page, 'right', 0);
  await page.screenshot({ path: join(screenshots, 'motion-single-calibration-preview.png') });
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => !window.exhibitionHome.com.current.getSnapshot().calibration.active);
  await waitMotionFingers(page, 'right', .5);
  assert.equal((await snapshot(page)).hands.right.pressureTotal, 147 * 30, '关闭校准无需新压力帧就恢复新基准下的实时弯指');
  await page.screenshot({ path: join(screenshots, 'motion-single-calibration-restored.png') });

  await setSystem(page, 'hand0205Double', 'gloveMotion');
  await waitRenderer(page, 'gloveMotion');
  await feedCalibrationPressure(page, 'hand0205Double', { left: 12, right: 30 });
  await page.waitForTimeout(600);
  const leftBeforePreview = (await snapshot(page)).hands.left.fingers;
  await calibrate.click();
  await dialog.waitFor();
  await choose(page, '校准手', '右手');
  await choose(page, '校准姿态', '手指握拳');
  await waitCalibrationPreview(page, 'right', 1);
  await feedCalibrationPressure(page, 'hand0205Double', { left: 30, right: 40 });
  await page.waitForFunction((before) => window.exhibitionHome.com.current.getSnapshot().hands.left.fingers
    .some((value, index) => Math.abs(value - before[index]) > .05), leftBeforePreview);
  await waitCalibrationPreview(page, 'right', 1);
  await dialog.getByRole('button', { name: '采集数据', exact: true }).click();
  const dualRightCalibration = await readSavedFingerCalibration(page, 'right');
  assert.notDeepEqual(dualRightCalibration[1], singleRightCalibration[1], '预览期间新压力仍更新右手校准采样');
  assert.deepEqual(dualRightCalibration[0], singleRightCalibration[0]);
  assert.deepEqual(await readSavedFingerCalibration(page, 'left'), initialLeftCalibration, '双手右侧采样不改左侧基准');
  await feedCalibrationPressure(page, 'hand0205Double', { right: 25 });
  await waitCalibrationPreview(page, 'right', 1);
  await choose(page, '校准手', '左手');
  await waitCalibrationPreview(page, 'left', 1);
  await waitMotionFingers(page, 'right', .5);
  await dialog.getByRole('button', { name: '采集数据', exact: true }).click();
  const leftFist = await readSavedFingerCalibration(page, 'left');
  assert.ok(leftFist[1].every((value) => Number.isFinite(value) && value > 0));
  assert.deepEqual(await readSavedFingerCalibration(page, 'right'), dualRightCalibration, '切到左手采集保留右手两种基准');
  await choose(page, '校准姿态', '手指平铺');
  await waitCalibrationPreview(page, 'left', 0);
  await feedCalibrationPressure(page, 'hand0205Double', { left: 10 });
  await dialog.getByRole('button', { name: '采集数据', exact: true }).click();
  const dualLeftCalibration = await readSavedFingerCalibration(page, 'left');
  assert.deepEqual(dualLeftCalibration[1], leftFist[1]);
  assert.ok(dualLeftCalibration[0].every((value, index) => value > 0 && value < dualLeftCalibration[1][index]));
  await feedCalibrationPressure(page, 'hand0205Double', { left: 20, right: 20 });
  await waitCalibrationPreview(page, 'left', 0);
  await waitMotionFingers(page, 'right', 1 / 3);
  await choose(page, '校准手', '右手');
  await waitCalibrationPreview(page, 'right', 0);
  await waitMotionFingers(page, 'left', .5);
  await page.screenshot({ path: join(screenshots, 'motion-dual-calibration-preview.png') });
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => !window.exhibitionHome.com.current.getSnapshot().calibration.active);
  await waitMotionFingers(page, 'left', .5);
  await waitMotionFingers(page, 'right', 1 / 3);
  const restored = await snapshot(page);
  assert.equal(restored.hands.left.pressureTotal, 147 * 20);
  assert.equal(restored.hands.right.pressureTotal, 147 * 20);
  assert.deepEqual(await readSavedFingerCalibration(page, 'left'), dualLeftCalibration);
  assert.deepEqual(await readSavedFingerCalibration(page, 'right'), dualRightCalibration);
  await page.screenshot({ path: join(screenshots, 'motion-dual-calibration-restored.png') });
  await calibrate.click();
  await dialog.waitFor();
  await dialog.getByRole('button', { name: '清除校准数据', exact: true }).click();
  assert.equal(await readSavedFingerCalibration(page, 'left'), null);
  assert.equal(await readSavedFingerCalibration(page, 'right'), null);
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await waitMotionFingers(page, 'left', 60 / 255);
  await waitMotionFingers(page, 'right', 60 / 255);
  await page.evaluate(() => {
    const defaults = JSON.stringify([Array(5).fill(0), Array(5).fill(255)]);
    localStorage.setItem('fingerArrL', defaults);
    localStorage.setItem('fingerArrR', defaults);
  });
  await calibrate.click();
  await dialog.waitFor();
  await page.evaluate(() => window.exhibitionHome.setState({ local: true, dataTime: 'calibration-source-change' }));
  await dialog.waitFor({ state: 'hidden' });
  await waitRenderer(page, 'gloveMotion');
  assert.equal(await page.evaluate(() => window.exhibitionHome.state.calibration), false, '数据源变化后退出校准，避免将旧预览带入新记录');
  assert.equal((await snapshot(page)).calibration.active, false);
  console.log('MOTION_CALIBRATION_UI_PASS');
}

/** 读取公开的小型数值快照，不直接写入组件或场景对象。 */
async function snapshot(page) {
  return page.evaluate(() => window.exhibitionHome.com.current.getSnapshot());
}

/** 等待真实场景挂载与模型加载完成，同时捕获未处理页面异常。 */
async function waitRenderer(page, mode) {
  await page.waitForFunction((expected) => {
    const handle = window.exhibitionHome?.com.current;
    const state = handle?.getSnapshot?.();
    return state?.ready && (state.mode || state.renderer) === expected;
  }, mode, { timeout: 60000 });
  assert.deepEqual(errors, []);
}

/** 从浏览器实际截图读取中央像素，不能用挂载成功冒充模型/热场可见。 */
async function canvasPixels(page, canvas) {
  const png = await canvas.screenshot();
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const target = document.createElement('canvas');
    target.width = image.width; target.height = image.height;
    const context = target.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, target.width, target.height);
    let saturated = 0, bright = 0, checksum = 0;
    for (let y = Math.floor(target.height * .15); y < target.height * .85; y += 2) {
      for (let x = Math.floor(target.width * .3); x < target.width * .7; x += 2) {
        const offset = (y * target.width + x) * 4;
        const red = data[offset], green = data[offset + 1], blue = data[offset + 2];
        const maximum = Math.max(red, green, blue), minimum = Math.min(red, green, blue);
        if (maximum > 55 && maximum - minimum > 35) saturated += 1;
        if (maximum > 90) bright += 1;
        checksum = (checksum + red * 3 + green * 5 + blue * 7) % 1000000007;
      }
    }
    return { saturated, bright, checksum, width: target.width, height: target.height };
  }, png.toString('base64'));
}

/** 使用真实Home切换展示系统，模拟的是用户当前系统状态，不绕过帧入口。 */
async function setSystem(page, matrixName, mode) {
  await page.evaluate(async ({ matrixName, mode }) => {
    localStorage.setItem('file', matrixName);
    await new Promise((resolve) => window.exhibitionHome.setState({ matrixName, systemId: matrixName,
      numMatrixFlag: mode, hand: true, local: false, dataTime: '' }, resolve));
  }, { matrixName, mode });
}

const server = await createServer({
  root: fileURLToPath(new URL('../../client/', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{
    name: 'glove-exhibition-home-test', enforce: 'pre',
    /** 测试仅额外导出真实类，不替换生产生命周期或帧处理。 */
    transform(code, id) {
      if (id.replaceAll('\\', '/').endsWith('/src/page/home/Home.jsx')) return `${code}\nexport { Home as ExhibitionHomeTest };`;
    },
    /** 真实Home、Title、Aside与两个新场景共用正式工具宿主。 */
    configureServer(vite) {
      vite.middlewares.use('/__glove-exhibition-home', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__glove-exhibition-home', `<!doctype html><html><head>
          <meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style>
          </head><body><div id="root"></div><script type="module">
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import { HashRouter } from 'react-router-dom';
          import '@ant-design/v5-patch-for-react-19';
          import i18next from '/src/i18n';
          import '/src/App.css';
          import '/src/page/licensePortal/FiberPortal.css';
          import '/src/page/licensePortal/PortalMonitoring.css';
          import { ExhibitionHomeTest } from '/src/page/home/Home.jsx';
          localStorage.clear(); localStorage.setItem('file','hand0205');
          localStorage.setItem('language','zh');
          localStorage.setItem('allowedTypes',JSON.stringify(['hand0205','hand0205Double','handGlove115200','handGloveFullPacket']));
          localStorage.setItem('fingerArrL',JSON.stringify([Array(5).fill(0),Array(5).fill(255)]));
          localStorage.setItem('fingerArrR',JSON.stringify([Array(5).fill(0),Array(5).fill(255)]));
          await i18next.changeLanguage('zh');
          /** 持有稳定的Portal宿主，Title走实际常驻工具栏分支。 */
          function Fixture() {
            const [host,setHost]=React.useState(null);
            return React.createElement(HashRouter,null,React.createElement('div',{className:'fiber-portal'},
              React.createElement('div',{className:'portal-runtime-monitor'},React.createElement('div',{ref:setHost}),
                host&&React.createElement(ExhibitionHomeTest,{ref:(value)=>{window.exhibitionHome=value;},
                  t:i18next.t.bind(i18next),i18n:i18next,portalEmbedded:true,portalToolsHost:host}))));
          }
          const root=createRoot(document.getElementById('root'));
          window.unmountExhibition=()=>root.unmount();
          root.render(React.createElement(Fixture));
          </script></body></html>`));
      });
    },
  }],
});

let browser;
let page;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => { errors.push(error.message); console.error('PAGE_ERROR', error.stack); });
  await page.routeWebSocket(/:19999/, (socket) => {
    sockets.add(socket); socket.onClose(() => sockets.delete(socket));
    socket.send(JSON.stringify({ selectFlag: 'all', licenseKey: 'fixture-key', date: Date.now() + 86400000 * 30, nowDate: Date.now() }));
  });
  await page.route('http://127.0.0.1:19245/**', (route) => route.fulfill({
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' },
    json: route.request().url().endsWith('/api/algorithm-market')
      ? { packages: [], instances: [], channels: [], configuredAlgorithms: [], allowed: true, reason: '' }
      : { code: 0, data: { ok: true, data: {} }, displaySystems: { runtimeDefinitions: [] } },
  }));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__glove-exhibition-home`);
  await page.waitForFunction(() => window.exhibitionHome?.com.current && window.exhibitionHome?.data.current);
  await page.locator('canvas[data-model-state="ready"]').waitFor();
  await choose(page, '显示方式', '热力地图');
  await waitRenderer(page, 'gloveTerrain');
  const emptyTerrain = await snapshot(page);
  assert.equal(emptyTerrain.tuning.baseGain, .6);
  for (const side of ['left', 'right']) {
    assert.equal(emptyTerrain[side].pressureTotal, 0);
    assert.equal(emptyTerrain[side].pressureMax, 0);
    assert.equal(emptyTerrain[side].pressureHeightMax, 0);
    assert.ok(emptyTerrain[side].heightMax > 0, '无输入仍显示参考项目的默认静态底形');
  }
  const emptyTerrainPixels = await canvasPixels(page, page.locator('canvas[data-renderer="gloveTerrain"]'));
  assert.ok(emptyTerrainPixels.bright > 100, '静态底形在实际画布上可见');
  send(packet('hand0205', 'left', 0));
  send(packet('hand0205', 'right', 0));
  await page.waitForFunction(() => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return state.left.received && state.right.received;
  });
  const initialZeroTerrain = await snapshot(page);
  for (const side of ['left', 'right']) {
    assert.equal(initialZeroTerrain[side].pressureTotal, 0);
    assert.equal(initialZeroTerrain[side].pressureMax, 0);
    assert.equal(initialZeroTerrain[side].pressureHeightMax, 0);
    assert.equal(initialZeroTerrain[side].heightMax, emptyTerrain[side].heightMax,
      '零帧只清除实时压力，静态底形保持默认高度');
  }
  await page.screenshot({ path: join(screenshots, 'terrain-default-static.png') });
  await choose(page, '显示方式', '3D 遥操');
  await page.locator('canvas[data-model-state="ready"]').waitFor();
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(screenshots, 'normal-initial-position.png') });
  await choose(page, '显示方式', '炫酷摇操');
  await waitRenderer(page, 'gloveMotion');
  const initialMotion = await snapshot(page);
  assert.equal(initialMotion.camera.fov, 40);
  assert.ok(Math.abs(initialMotion.camera.direction[1] / initialMotion.camera.direction[2] + 3) < .001,
    '初始相机沿3D遥操的(0,3,-1)方向观察');
  assert.equal(initialMotion.hands.left.mirrorScaleX, 1);
  assert.equal(initialMotion.hands.right.mirrorScaleX, -1);
  await page.screenshot({ path: join(screenshots, 'motion-initial-position.png') });
  send(packet('hand0205', 'left', 25));
  send(packet('hand0205', 'right', 80));
  await page.waitForFunction(() => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return state.hands.left.pressureTotal === 147 * 25 && state.hands.right.pressureTotal === 147 * 80;
  });
  let current = await snapshot(page);
  assert.equal(current.hands.left.visible, true); assert.equal(current.hands.right.visible, false);
  await page.waitForTimeout(350);
  const motionCanvas = page.locator('canvas[data-glove-renderer="motion"]');
  const leftPixels = await canvasPixels(page, motionCanvas);
  assert.ok(leftPixels.saturated > 150 && leftPixels.bright > 100, 'motion彩色线网实际可见');
  await page.screenshot({ path: join(screenshots, 'motion-left.png') });
  await choose(page, '显示手', '右手');
  await page.waitForFunction(() => window.exhibitionHome.com.current.getSnapshot().hands.right.visible);
  await page.waitForTimeout(300);
  const rightPixels = await canvasPixels(page, motionCanvas);
  assert.notEqual(rightPixels.checksum, leftPixels.checksum, '换手后的镜像与压力亮度改变真实像素');
  send(packet('hand0205', 'right', 35, { quaternion: [0, .31, 0, .95] }));
  await page.waitForFunction(() => window.exhibitionHome.com.current.getSnapshot().hands.right.pressureTotal === 147 * 35);
  await page.waitForTimeout(350);
  current = await snapshot(page);
  assert.ok(current.hands.right.quaternion.some((value, index) => Math.abs(value - [0, 0, 0, 1][index]) > .05), '原始四元数驱动真实姿态');
  assert.ok(current.hands.right.fingers.some((value) => value > .1), '既有校准驱动骨骼弯曲');
  const validOrientation = current.hands.right.quaternion;
  send(packet('hand0205', 'right', 35, { quaternion: null }));
  await page.waitForTimeout(120);
  assert.ok((await snapshot(page)).hands.right.quaternion.some((value, index) => Math.abs(value - [0, 0, 0, 1][index]) > .05),
    `缺失姿态沿用上次有效方向：${validOrientation}`);
  await page.screenshot({ path: join(screenshots, 'motion-right.png') });
  await page.waitForTimeout(300);
  const singleBeforeReset = await snapshot(page);
  send(resetEvent('hand0205', 'right'));
  await waitMotionReset(page, 'right', singleBeforeReset.hands.right.quaternionResets, true);
  const singleAfterReset = await snapshot(page);
  for (const side of ['left', 'right']) assertMotionDataSame(singleAfterReset.hands[side], singleBeforeReset.hands[side], '单手无新压力帧复位');
  assertQuaternionSame(singleAfterReset.hands.left.quaternion, singleBeforeReset.hands.left.quaternion, '单手右复位保留左缓存姿态');
  send(packet('hand0205', 'right', 35, { quaternion: [0, .31, 0, .95] }));
  await page.waitForFunction((received) => {
    const hand = window.exhibitionHome.com.current.getSnapshot().hands.right;
    return hand.received > received && !hand.zeroPending && hand.hasQuaternion
      && hand.quaternion.slice(0, 3).every((value) => Math.abs(value) < .000001);
  }, singleAfterReset.hands.right.received);
  const beforeBareReset = await snapshot(page);
  send({ handReset: true });
  await waitMotionReset(page, 'right', beforeBareReset.hands.right.quaternionResets, true);
  assert.equal((await snapshot(page)).hands.left.quaternionResets, beforeBareReset.hands.left.quaternionResets,
    '单手旧裸事件只作用于当前显示右手');
  await page.screenshot({ path: join(screenshots, 'motion-single-reset.png') });

  await choose(page, '显示方式', '热力地图');
  await waitRenderer(page, 'gloveTerrain');
  await page.waitForFunction(() => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return state.left.pressureTotal === 256 * 25 && state.right.pressureTotal === 256 * 35
      && state.right.heightMax > 0 && state.right.pressureHeightMax > 0;
  });
  const terrainCanvas = page.locator('canvas[data-renderer="gloveTerrain"]');
  const terrainPixels = await canvasPixels(page, terrainCanvas);
  assert.ok(terrainPixels.saturated > 150, '热力地图实际着色');
  await page.screenshot({ path: join(screenshots, 'terrain-right-pressure.png') });
  send(packet('hand0205', 'right', 10));
  await page.waitForFunction(() => window.exhibitionHome.com.current.getSnapshot().right.pressureTotal === 2560);
  await page.getByRole('button', { name: '调节', exact: true }).click();
  const initialSlider = page.getByRole('slider', { name: '初始地形', exact: true });
  await initialSlider.waitFor();
  assert.equal(await initialSlider.getAttribute('aria-valuenow'), '0.6');
  assert.equal(await initialSlider.getAttribute('aria-valuemin'), '0');
  assert.equal(await initialSlider.getAttribute('aria-valuemax'), '1.5');
  const defaultGainTerrain = await snapshot(page);
  await initialSlider.press('ArrowRight');
  await page.waitForFunction(() => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return state.tuning.baseGain === .65 && state.right.pressureTotal === 2560;
  });
  await initialSlider.press('End');
  await page.waitForFunction((previousHeight) => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return state.tuning.baseGain === 1.5 && state.right.pressureTotal === 2560
      && state.right.heightMax > previousHeight && state.right.pressureHeightMax > 0;
  }, defaultGainTerrain.right.heightMax);
  const raisedTerrain = await snapshot(page);
  await page.screenshot({ path: join(screenshots, 'terrain-base-gain-maximum.png') });
  await initialSlider.press('Home');
  await page.waitForFunction(() => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return state.tuning.baseGain === 0 && state.right.pressureTotal === 2560
      && state.left.heightMax === 0 && state.right.heightMax === 0
      && state.left.pressureHeightMax === 0 && state.right.pressureHeightMax === 0;
  });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('valueConfig')).hand0205__gloveTerrain.terrainBaseGain), 0);
  await page.screenshot({ path: join(screenshots, 'terrain-base-gain-zero.png') });
  await initialSlider.press('End');
  await page.waitForFunction(() => window.exhibitionHome.com.current.getSnapshot().tuning.baseGain === 1.5);
  const savedTerrainConfig = await page.evaluate(() => JSON.parse(localStorage.getItem('valueConfig')).hand0205__gloveTerrain);
  assert.equal(savedTerrainConfig.terrainBaseGain, 1.5);
  assert.equal(Object.hasOwn(savedTerrainConfig, 'valuelInit1'), false, '底形增益单独保存，不能写入旧整帧阈值键');
  await page.locator('.ant-drawer:visible .ant-drawer-close').click();
  await page.locator('.ant-drawer-open').waitFor({ state: 'hidden' });
  await choose(page, '显示方式', '3D 遥操');
  await page.waitForFunction(() => !document.querySelector('.glove-terrain-view'));
  await choose(page, '显示方式', '热力地图');
  await waitRenderer(page, 'gloveTerrain');
  await page.waitForFunction(() => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return state.tuning.baseGain === 1.5 && state.right.pressureTotal === 2560;
  });
  const restoredTerrain = await snapshot(page);
  assert.equal(restoredTerrain.right.heightMax, raisedTerrain.right.heightMax, '切回热力地图按缓存恢复相同底形和压力总高度');
  send(packet('hand0205', 'right', 35));
  await page.waitForFunction(() => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return state.right.pressureTotal === 8960 && state.right.pressureHeightMax > 0;
  });
  const pressurePixels = await canvasPixels(page, terrainCanvas);
  send(packet('hand0205', 'right', 35, { zero: true }));
  await page.waitForFunction(() => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return state.right.pressureTotal === 0 && state.right.pressureHeightMax === 0
      && state.right.heightMax > 0 && state.left.pressureTotal === 256 * 25;
  });
  const zeroPixels = await canvasPixels(page, terrainCanvas);
  assert.notEqual(zeroPixels.checksum, pressurePixels.checksum, '相同底形增益下零帧清除实时压力并改变实际像素');
  assert.ok(zeroPixels.bright > 100, '压力归零后静态底形继续可见');
  await page.screenshot({ path: join(screenshots, 'terrain-right-zero.png') });
  await choose(page, '显示手', '左手');
  await page.waitForFunction(() => window.exhibitionHome.com.current.getSnapshot().activeSide === 'left');
  assert.equal((await snapshot(page)).left.pressureTotal, 256 * 25, '单手切回独立缓存');

  for (const label of ['3D 遥操', '原始数据', '热力地图']) {
    await choose(page, '显示方式', label);
    if (label === '热力地图') await waitRenderer(page, 'gloveTerrain');
    else await page.waitForFunction(() => !document.querySelector('.glove-motion-renderer,.glove-terrain-view'));
  }
  await page.waitForFunction(() => window.exhibitionHome.com.current.getSnapshot().left.pressureTotal === 256 * 25);
  await setSystem(page, 'hand0205Double', 'gloveTerrain');
  await waitRenderer(page, 'gloveTerrain');
  await page.waitForFunction(() => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return state.left.pressureTotal === 0 && state.right.pressureTotal === 0;
  });
  send(packet('hand0205Double', 'left', 10));
  send(packet('hand0205Double', 'right', 70));
  await page.waitForFunction(() => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return state.activeSide === 'both' && state.left.pressureTotal === 2560 && state.right.pressureTotal === 17920;
  });
  await page.screenshot({ path: join(screenshots, 'terrain-dual.png') });
  await choose(page, '显示方式', '炫酷摇操');
  await waitRenderer(page, 'gloveMotion');
  await page.waitForFunction(() => {
    const state = window.exhibitionHome.com.current.getSnapshot();
    return state.dual && state.hands.left.pressureTotal === 1470 && state.hands.right.pressureTotal === 10290;
  });
  await page.locator('.aside').getByText('2560', { exact: true }).first().waitFor();
  assert.equal(await page.getByRole('combobox', { name: '显示手', exact: true }).count(), 0, '双手同显不提供无效切手');
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(screenshots, 'motion-dual.png') });
  await verifyDualMotionReset(page);
  await verifyNormalDualReset(page);
  await verifyMotionOrientationMatchesNormal(page);
  for (const label of ['热力地图', '炫酷摇操', '热力地图']) {
    await page.evaluate(() => { window.previousExhibitionCanvas = document.querySelector('.glove-motion-renderer canvas,.glove-terrain-view canvas'); });
    await choose(page, '显示方式', label);
    await waitRenderer(page, label === '热力地图' ? 'gloveTerrain' : 'gloveMotion');
    assert.equal(await page.evaluate(() => window.previousExhibitionCanvas.isConnected), false, '切换卸载旧画布');
    assert.equal(await page.locator('.glove-motion-renderer canvas,.glove-terrain-view canvas').count(), 1);
  }
  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(screenshots, 'terrain-dual-900.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '900px重排稳定后不溢出页面');
  await page.setViewportSize({ width: 1440, height: 900 });
  await setSystem(page, 'handGloveFullPacket', 'gloveMotion');
  await waitRenderer(page, 'gloveMotion');
  send(packet('handGlove115200', 'left', 99));
  await page.waitForTimeout(100);
  assert.equal((await snapshot(page)).hands.left.pressureTotal, 0, '其他系统身份的canonical帧不能污染新展示缓存');
  const beforeEmptyReset = await snapshot(page);
  assert.equal(beforeEmptyReset.hands.right.hasQuaternion, false);
  send(resetEvent('handGloveFullPacket', 'right'));
  await waitMotionReset(page, 'right', beforeEmptyReset.hands.right.quaternionResets, true);
  send(packet('handGloveFullPacket', 'right', 20, { mappedLength: 195, quaternion: [.21, 0, 0, .98] }));
  await page.waitForFunction(() => {
    const hand = window.exhibitionHome.com.current.getSnapshot().hands.right;
    return hand.hasQuaternion && !hand.zeroPending && hand.pressureTotal === 195 * 20
      && hand.quaternion.slice(0, 3).every((value) => Math.abs(value) < .000001);
  });
  send(packet('handGloveFullPacket', 'left', 40, { mappedLength: 195 }));
  await page.waitForFunction(() => window.exhibitionHome.com.current.getSnapshot().hands.left.pressureTotal === 195 * 40);
  assert.equal(await page.evaluate(() => window.exhibitionHome.state.numMatrixFlag), 'gloveMotion', '整包型号不回落旧num白名单');
  await page.waitForTimeout(120);
  assert.deepEqual((await snapshot(page)).hands.left.fingers, [0, 0, 0, 0, 0], '195点不冒充147点弯指校准');
  await choose(page, '显示方式', '热力地图');
  await waitRenderer(page, 'gloveTerrain');
  await page.waitForFunction(() => window.exhibitionHome.com.current.getSnapshot().left.pressureTotal === 256 * 40);
  assert.equal((await snapshot(page)).left.layout, 'matrix', '整包地形消费真实raw256矩阵');
  await page.screenshot({ path: join(screenshots, 'terrain-fullpacket.png') });
  await page.evaluate(async () => {
    await new Promise((resolve) => window.exhibitionHome.setState({ local: true, dataTime: 'different-record' }, resolve));
  });
  await waitRenderer(page, 'gloveTerrain');
  assert.equal((await snapshot(page)).left.pressureTotal, 0, '同型号切换数据源清除上一份压力');
  await verifyHardwareInitialization(page);
  await verifyMotionCalibration(page);
  await page.evaluate(() => window.unmountExhibition());
  await page.waitForFunction(() => !document.querySelector('canvas'));
  assert.deepEqual(errors, []);
  console.log('GLOVE_EXHIBITION_HOME_PASS', JSON.stringify({ screenshots, leftPixels, rightPixels, emptyTerrainPixels, terrainPixels, pressurePixels, zeroPixels }));
} catch (error) {
  console.error('GLOVE_EXHIBITION_HOME_FAILURE', screenshots, error);
  if (page) {
    await page.screenshot({ path: join(screenshots, 'failure.png') }).catch(() => {});
    console.error('GLOVE_EXHIBITION_HOME_STATE', await page.evaluate(() => ({ home: window.exhibitionHome?.state?.matrixName,
      mode: window.exhibitionHome?.state?.numMatrixFlag, renderer: window.exhibitionHome?.com.current?.getSnapshot?.() })).catch(() => null));
  }
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
