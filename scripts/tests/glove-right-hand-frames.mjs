import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/**
 * 后端真实形状的手套帧 → 前端解码 → 展示帧 → 热力地形：右手每个部位的落点必须是左手同一部位的镜像，指腹读数两只手一致。
 * ⚠️ 右手的通道数据是后端重排好的 32×32 皮肤布局，和左手不一样；前端测试里「左右手都给 256 点」的假帧测不出右手的问题，
 *   所以这里直接用后端自己的映射函数和信封构造器造帧。不开浏览器、不连设备。
 */
const requireRoot = createRequire(new URL('../../package.json', import.meta.url));
const { handR, handL, handRVideo1470506 } = requireRoot('./backend/compatibility/openWeb.js');
const { buildSensorFrameEnvelope } = requireRoot('./backend/kernel/realtime/sensorFrameEnvelope');
const { createServer } = createRequire(new URL('../../client/package.json', import.meta.url))('vite');
const cacheDir = await mkdtemp(join(tmpdir(), 'shroom-glove-right-hand-'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)), cacheDir, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false } });
let sequence = 0;

/** 16×16 硬件帧：指定的点（1 起点编号）有压力，其余为 0。 */
function hardware(points, value = 200) {
  const frame = Array(256).fill(0);
  for (const point of points) frame[point - 1] = value;
  return frame;
}
/** 一帧里有读数的规范 147 点下标。 */
const pressed = (mapped) => mapped.flatMap((value, index) => (value ? [index] : []));
/**
 * 与右手这些点在解剖位置上相同的左手硬件点：以后端的规范 147 点映射为准，不靠点表猜。
 * @param {number[]} rightPoints 右手硬件点
 */
function leftCounterpart(rightPoints) {
  const wanted = pressed(handR(hardware(rightPoints)));
  const points = [];
  for (let point = 1; point <= 256; point++) {
    const hit = pressed(handL(hardware([point])));
    if (hit.length && hit.every((index) => wanted.includes(index))) points.push(point);
  }
  assert.deepEqual(pressed(handL(hardware(points))), wanted, '左手找不到与右手完全对应的点');
  return points;
}
/** 后端实时通路发布的同一份 legacy 负载，经真实信封构造器包装。 */
function envelope(side, raw) {
  const mapped = side === 'right' ? handR([...raw]) : handL([...raw]);
  const payload = { [side === 'right' ? 'backData' : 'sitData']: side === 'right' ? handRVideo1470506([...raw]) : [...raw],
    realArr: [...raw], rawPressureData: [...raw], newArr147: [...mapped], newArr147Raw: [...mapped], handSide: side,
    sitFlag: true, backFlag: true, rotate: [0, 0, 0, 1] };
  return buildSensorFrameEnvelope({ channel: side === 'right' ? 'back' : 'sit', payload, sensorType: 'hand0205Double', source: 'realtime',
    sequence: ++sequence, timestamp: 1000 + sequence });
}
/** 32×32 地形场的压力重心与总量。 */
function centre(field) {
  let total = 0, row = 0, col = 0;
  field.forEach((value, index) => { total += value; row += value * Math.floor(index / 32); col += value * (index % 32); });
  assert.ok(total > 0, '地形上没有压力');
  return { row: row / total, col: col / total, total };
}

try {
  const { default: decode, getSensorFrameChannelValue } = await server.ssrLoadModule('/src/services/ws/sensorFrameDecoder.js');
  const { buildGloveExhibitionFrame } = await server.ssrLoadModule('/src/page/home/gloveExhibition.js');
  const { buildTerrainField } = await server.ssrLoadModule('/src/components/three/gloveTerrain/terrainField.js');
  /** 走一遍前端：解码 → 取通道值和硬件矩阵（与监测页同一取法）→ 展示帧 → 地形场。 */
  const through = (side, points) => {
    const raw = hardware(points), frame = envelope(side, raw), message = decode(JSON.stringify(frame));
    const channel = side === 'right' ? 'back' : 'sit', channelPressure = getSensorFrameChannelValue(message, channel);
    const rawPressure = Array.isArray(message.rawPressureData) && message.rawPressureData.length >= 256 ? message.rawPressureData : message.realArr ?? channelPressure;
    const exhibition = buildGloveExhibitionFrame({ message, channel, channelPressure, rawPressure, calibration: [Array(5).fill(0), Array(5).fill(255)] });
    return { raw, frame, channelPressure, exhibition, centre: centre(buildTerrainField(exhibition, exhibition.side).field) };
  };

  // 右手硬件点取自后端 handR 的点表：拇指、小指各 12 点加指腹，手掌两侧各 3×3。
  const PARTS = {
    拇指: [240, 239, 238, 256, 255, 254, 16, 15, 14, 32, 31, 30, 47],
    小指: [228, 227, 226, 244, 243, 242, 4, 3, 2, 20, 19, 18, 35],
    手掌靠拇指一侧: [80, 79, 78, 96, 95, 94, 112, 111, 110],
    手掌靠小指一侧: [68, 67, 66, 84, 83, 82, 100, 99, 98],
  };
  const report = {};
  for (const [part, rightPoints] of Object.entries(PARTS)) {
    const right = through('right', rightPoints), left = through('left', leftCounterpart(rightPoints));
    // 这就是右手和左手不一样的地方：通道值是 1024 点的皮肤布局，硬件矩阵在 calibrated 阶段。
    assert.equal(right.frame.payload.value.length, 1024, '右手通道值应为 32×32 皮肤布局');
    assert.equal(right.frame.payload.stages.calibrated.length, 256);
    assert.equal(left.frame.payload.value.length, 256, '左手通道值就是 16×16 硬件矩阵');
    assert.equal(right.exhibition.side, 'right'); assert.equal(left.exhibition.side, 'left');
    assert.deepEqual(right.exhibition.rawPressure, right.raw, `${part}: 右手热力必须读硬件矩阵，不能截皮肤布局的前 256 个`);
    assert.deepEqual(left.exhibition.rawPressure, left.raw, `${part}: 左手热力读硬件矩阵`);
    assert.ok(Math.abs(right.centre.row - left.centre.row) < .75, `${part}: 右手落点的行应与左手相同 ${right.centre.row} / ${left.centre.row}`);
    assert.ok(Math.abs(right.centre.col - (31 - left.centre.col)) < .75, `${part}: 右手落点的列应是左手的镜像 ${right.centre.col} / ${31 - left.centre.col}`);
    assert.ok(Math.abs(right.centre.total - left.centre.total) < left.centre.total * .15, `${part}: 两只手同一部位的压力总量应接近`);
    report[part] = { 右手: [Number(right.centre.row.toFixed(1)), Number(right.centre.col.toFixed(1))], 左手: [Number(left.centre.row.toFixed(1)), Number(left.centre.col.toFixed(1))] };
  }
  // 屏幕上右手拇指在左、小指在右，手掌两侧分别在各自手指的下方。
  assert.ok(report.拇指.右手[1] < report.手掌靠拇指一侧.右手[1] && report.手掌靠拇指一侧.右手[1] < report.手掌靠小指一侧.右手[1]);
  assert.ok(Math.abs(report.小指.右手[1] - report.手掌靠小指一侧.右手[1]) < 2, '右手小指与手掌小指侧在同一列带');

  // 弯指读的是五个指腹：两只手按下指腹，得到的五指读数必须一样，否则摇操里一只手不动。
  const rightPulps = [47, 44, 41, 38, 35], leftPulps = leftCounterpart(rightPulps);
  const rightBend = through('right', rightPulps).exhibition, leftBend = through('left', leftPulps).exhibition;
  assert.deepEqual(rightBend.fingerPoints, [200, 200, 200, 200, 200], '右手五个指腹的读数');
  assert.deepEqual(leftBend.fingerPoints, rightBend.fingerPoints, '左右手指腹读数一致');
  assert.ok(rightBend.fingers.every((value) => value > .7), '默认校准下按下右手指腹，手指弯曲量随之上升');
  console.log('GLOVE_RIGHT_HAND_FRAMES_PASS', JSON.stringify({ 落点行列: report, 左手指腹点: leftPulps, 弯曲量: rightBend.fingers.map((value) => Number(value.toFixed(2))) }));
} finally {
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
