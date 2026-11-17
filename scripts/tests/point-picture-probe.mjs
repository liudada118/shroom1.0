import assert from 'node:assert/strict';

/**
 * 点图「真实上屏画面」探针：浏览器脚本共用。
 * 读的是显卡实际收到的模型视图矩阵和顶点缓冲，不读工具或场景的内部状态，所以能分清「画面转了」和「数据被改了」。
 */

/**
 * 页面内钩子，交给 page.addInitScript。挂上之后 window.__pointPicture.capture 是 Map 时记录每一层点图的绘制。
 * ⚠️ 这个函数会被序列化到页面里执行，不能引用本模块的任何变量。
 */
export function installPointPictureProbe() {
  window.__pointPicture = { capture: null };
  for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Type) continue;
    // ⚠️ 矩阵按着色器程序分别记：Three.js 值没变就不重传，只留「最后一次上传」会在静止帧读到别的物体的矩阵。
    const programs = new WeakMap(), values = new WeakMap();
    const getUniform = Type.prototype.getUniformLocation;
    /** 记下每个着色器程序的模型视图矩阵位置。 */
    Type.prototype.getUniformLocation = function (...args) {
      const location = getUniform.apply(this, args);
      if (location && args[1] === 'modelViewMatrix') programs.set(args[0], location);
      return location;
    };
    const uniformMatrix = Type.prototype.uniformMatrix4fv;
    /** 保留每个位置最近一次上传的矩阵。 */
    Type.prototype.uniformMatrix4fv = function (...args) {
      if (args[0]) values.set(args[0], Array.from(args[2]));
      return uniformMatrix.apply(this, args);
    };
    /** 读回本次绘制实际绑定的三分量顶点属性并算 FNV-1a 指纹，同时给出外接范围。 */
    const readAttribute = (gl, program, name, first, count) => {
      const location = gl.getAttribLocation(program, name);
      const buffer = location < 0 ? null : gl.getVertexAttrib(location, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
      if (!buffer || gl.getVertexAttrib(location, gl.VERTEX_ATTRIB_ARRAY_SIZE) !== 3) return null;
      const bound = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const data = new Float32Array(gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE) / 4);
      gl.getBufferSubData(gl.ARRAY_BUFFER, 0, data);
      gl.bindBuffer(gl.ARRAY_BUFFER, bound);
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      let hash = 2166136261;
      for (const byte of new Uint8Array(data.buffer, first * 12, count * 12)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
      for (let index = first * 3; index < (first + count) * 3; index++) {
        min[index % 3] = Math.min(min[index % 3], data[index]); max[index % 3] = Math.max(max[index % 3], data[index]);
      }
      return { buffer, hash, min, max };
    };
    const draw = Type.prototype.drawArrays;
    /** 只记点图绘制，坐标轴和贴图不会冒充点图。 */
    Type.prototype.drawArrays = function (...args) {
      const picture = window.__pointPicture;
      if (args[0] === this.POINTS && picture.capture && typeof this.getBufferSubData === 'function') {
        const program = this.getParameter(this.CURRENT_PROGRAM), matrix = values.get(programs.get(program));
        const position = matrix ? readAttribute(this, program, 'position', args[1], args[2]) : null;
        // 同一层点一帧只记一次，按顶点缓冲去重。
        if (position) picture.capture.set(position.buffer, { matrix: [...matrix], count: args[2], position: position.hash,
          min: position.min, max: position.max, color: readAttribute(this, program, 'color', args[1], args[2])?.hash ?? null });
      }
      return draw.apply(this, args);
    };
  }
}

/**
 * 读回下一帧里每一层点图真实上屏的矩阵和缓冲指纹。
 * @param {import('playwright').Page} page 已经装了 installPointPictureProbe 的页面
 * @param {number} [settleFrames] 先空等几帧，让镜头惯性收敛
 * @returns {Promise<Array<{matrix: number[], count: number, position: number, color: number|null, min: number[], max: number[]}>>}
 */
export function capturePointPicture(page, settleFrames = 0) {
  return page.evaluate((frames) => new Promise((resolve) => {
    const picture = window.__pointPicture;
    let remaining = frames;
    /** 帧回调之间整帧点图已经画完，不会读到画了一半的状态。 */
    const next = () => {
      if (remaining-- > 0) return requestAnimationFrame(next);
      if (!picture.capture) { picture.capture = new Map(); return requestAnimationFrame(next); }
      if (!picture.capture.size) return requestAnimationFrame(next);
      const records = [...picture.capture.values()];
      picture.capture = null; resolve(records);
    };
    requestAnimationFrame(next);
  }), settleFrames);
}

/**
 * 等点图不再变化后读回一帧，作为之后比较的基准。
 * ⚠️ 点的高度按帧平滑逼近目标值；不等它停下来，之后顶点缓冲的差异就分不清是平滑还是被测操作造成的。
 */
export async function captureSettledPointPicture(page, label) {
  let base = await capturePointPicture(page, 30);
  assert.ok(base.length > 0, `${label}: 没有读到点图顶点缓冲`);
  for (let round = 0; ; round++) {
    const next = await capturePointPicture(page, 10);
    const settled = next.length === base.length && next.every((record, index) => record.position === base[index].position && record.color === base[index].color);
    base = next;
    if (settled) return base;
    assert.ok(round < 200, `${label}: 点图顶点一直在变，无法作为基准`);
  }
}

/** 列优先 4×4 矩阵相乘：先做 b 再做 a。 */
export function multiply(a, b) {
  const out = Array(16).fill(0);
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
  return out;
}

/** 列优先 4×4 矩阵求逆。 */
export function invert(m) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
    b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
    b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  return [a11 * b11 - a12 * b10 + a13 * b09, a02 * b10 - a01 * b11 - a03 * b09, a31 * b05 - a32 * b04 + a33 * b03, a22 * b04 - a21 * b05 - a23 * b03,
    a12 * b08 - a10 * b11 - a13 * b07, a00 * b11 - a02 * b08 + a03 * b07, a32 * b02 - a30 * b05 - a33 * b01, a20 * b05 - a22 * b02 + a23 * b01,
    a10 * b10 - a11 * b08 + a13 * b06, a01 * b08 - a00 * b10 - a03 * b06, a30 * b04 - a31 * b02 + a33 * b00, a21 * b02 - a20 * b04 - a23 * b00,
    a11 * b07 - a10 * b09 - a12 * b06, a00 * b09 - a01 * b07 + a02 * b06, a31 * b01 - a30 * b03 - a32 * b00, a20 * b03 - a21 * b01 + a22 * b00].map((value) => value / det);
}

/** 矩阵作用于齐次坐标，返回前三个分量。 */
export const apply = (m, [x, y, z, w = 1]) => [0, 1, 2].map((row) => m[row] * x + m[row + 4] * y + m[row + 8] * z + m[row + 12] * w);
/** 归一成单位向量。 */
export const unit = (a) => a.map((value) => value / Math.hypot(...a));
/** 向量相减 a − b。 */
const subtract = (a, b) => a.map((value, index) => value - b[index]);
/** 点积。 */
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
/** 叉积 a × b。 */
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** 镜头空间里的两次绘制相差多少：转动部分逐项比，位移按场景单位比。 */
export function motionError(before, after, expected = IDENTITY) {
  const motion = multiply(after, invert(before));
  return { linear: Math.max(...[0, 1, 2, 4, 5, 6, 8, 9, 10].map((index) => Math.abs(motion[index] - expected[index]))),
    shift: Math.max(...[12, 13, 14].map((index) => Math.abs(motion[index] - expected[index]))) };
}

/** 同一层点图在两次读数里的身份：点数加底面范围。压力只改高度，不会改它。 */
const layerKey = (record) => [record.count, record.min[0], record.max[0], record.min[2], record.max[2]].join('|');

/**
 * 把前后两次读数里的同一层点图对上。
 * ⚠️ 不能按绘制顺序或缓冲对象对：半透明点图按远近排序，转过之后先后会换；有的旧场景每帧重建顶点缓冲；
 *   被视锥剔除的层这一帧根本不在读数里。底面范围相同的几层（左右脚）按「和其余层做同一个运动」来分。
 * @param {number[]} [guide] 预期的镜头空间运动；不传时取第一对身份唯一的层的运动
 */
export function pairLayers(label, expected, actual, guide = null) {
  const direct = [], open = [];
  for (const record of expected) {
    const same = actual.filter((item) => layerKey(item) === layerKey(record));
    if (same.length === 1 && expected.filter((item) => layerKey(item) === layerKey(record)).length === 1) direct.push([record, same[0]]);
    else if (same.length) open.push([record, same]);
  }
  /** 按参考运动把身份相同的几层逐个对上，返回配对和它们偏离参考运动的总量。 */
  const assign = (reference, taken) => {
    const used = new Set(taken), pairs = [];
    let cost = 0;
    for (const [record, candidates] of open) {
      const free = candidates.filter((item) => !used.has(item));
      if (!free.length) continue;
      /** 这一对的运动离参考运动有多远。 */
      const distance = (item) => Math.max(...multiply(item.matrix, invert(record.matrix)).map((value, entry) => Math.abs(value - reference[entry])));
      const best = free.reduce((a, b) => (distance(b) < distance(a) ? b : a));
      used.add(best); pairs.push([record, best]); cost += distance(best);
    }
    return { pairs, cost };
  };
  const reference = guide || (direct[0] ? multiply(direct[0][1].matrix, invert(direct[0][0].matrix)) : null);
  let rest = { pairs: [] };
  if (open.length && reference) rest = assign(reference, direct.map(([, other]) => other));
  // 没有身份唯一的层可以当参考（左右脚两块一模一样）：把第一层分别和每个候选配对，取让各层运动最一致的那一种。
  else if (open.length) rest = open[0][1].map((candidate) => assign(multiply(candidate.matrix, invert(open[0][0].matrix)), [])).reduce((a, b) => (b.cost < a.cost ? b : a));
  const pairs = [...direct, ...rest.pairs];
  assert.ok(pairs.length > 0, `${label}: 前后两次没有读到同一层点图`);
  return pairs;
}

/**
 * 两组真实绘制必须是同一幅画面：矩阵一致，顶点和颜色缓冲逐字节相同。
 * @param {{data?: boolean}} [options] data 为 false 时只比画面姿态，用于中间换过一帧数据的场合
 */
export function assertSamePicture(label, expected, actual, { data = true } = {}) {
  for (const [record, other] of pairLayers(label, expected, actual, IDENTITY)) {
    const error = motionError(record.matrix, other.matrix);
    assert.ok(error.linear < 2e-3 && error.shift < .05, `${label}: ${layerKey(record)} 这一层的画面姿态不一致 ${JSON.stringify(error)}`);
    if (!data) continue;
    assert.equal(other.position, record.position, `${label}: ${layerKey(record)} 这一层顶点被改写`);
    assert.equal(other.color, record.color, `${label}: ${layerKey(record)} 这一层颜色被改写`);
  }
}

/**
 * 用真实上屏的模型视图矩阵和顶点缓冲核对一次展示旋转。
 * 整组点图必须做同一个刚体运动：绕点图法线转 steps 个 90°、整幅画面（各层底面合起来）的中心不动、从正面看是顺时针；
 * 顶点和颜色缓冲一个字节都不能变。
 * @param {number} steps 顺时针转了几个 90°（1–3）
 * @returns {{record: object, turned: object, normal: number[], center: number[], error: number}} 点图平面那一层转之前、转之后的读数，以及它在镜头空间里的法线和中心
 */
export function assertQuarterTurn(label, before, after, steps) {
  const pairs = pairLayers(label, before, after);
  const motion = multiply(pairs[0][1].matrix, invert(pairs[0][0].matrix));
  for (const [record, other] of pairs) {
    assert.equal(other.position, record.position, `${label}: ${layerKey(record)} 这一层顶点被改写，转的应该是画面不是数据`);
    assert.equal(other.color, record.color, `${label}: ${layerKey(record)} 这一层颜色被改写`);
    const own = multiply(other.matrix, invert(record.matrix));
    const difference = Math.max(...own.map((value, entry) => Math.abs(value - motion[entry]) / (entry >= 12 ? 20 : 1)));
    assert.ok(difference < 3e-3, `${label}: ${layerKey(record)} 这一层没有跟着整幅画面一起转 ${difference}`);
  }
  const angle = -steps * Math.PI / 2;
  /** 绕单位轴 axis 把向量转 angle。 */
  const turn = (axis, vector) => vector.map((value, index) => value * Math.cos(angle) + cross(axis, vector)[index] * Math.sin(angle)
    + axis[index] * dot(axis, vector) * (1 - Math.cos(angle)));
  let plane = null;
  const errors = [];
  for (const [record, other] of pairs) {
    // 以这一层为点图平面：把转之前所有层的零高度底面换到它的坐标里，合起来的外接范围的中心就是转轴穿过的点。
    const toPlane = invert(record.matrix), min = [Infinity, Infinity], max = [-Infinity, -Infinity];
    for (const layer of before) {
      const relative = multiply(toPlane, layer.matrix);
      for (const x of [layer.min[0], layer.max[0]]) for (const z of [layer.min[2], layer.max[2]]) {
        const point = apply(relative, [x, 0, z]);
        min[0] = Math.min(min[0], point[0]); max[0] = Math.max(max[0], point[0]);
        min[1] = Math.min(min[1], point[2]); max[1] = Math.max(max[1], point[2]);
      }
    }
    const normal = unit(apply(record.matrix, [0, 1, 0, 0]));
    const local = [(min[0] + max[0]) / 2, 0, (min[1] + max[1]) / 2];
    const center = apply(record.matrix, local);
    const error = Math.max(...[[0, 0, 0], [60, 0, 0], [0, 60, 0], [0, 0, 60]].map((offset) => {
      const point = center.map((value, axis) => value + offset[axis]);
      const expected = center.map((value, axis) => value + turn(normal, offset)[axis]);
      return Math.hypot(...subtract(apply(motion, point), expected));
    }));
    errors.push(error);
    if (error < .05) { plane = { normal, center, local, min, max, record, turned: other, error }; break; }
  }
  assert.ok(plane, `${label}: 画面不是绕整幅点图的底面中心、沿点图法线转了 ${steps} 个 90° ${JSON.stringify(errors)}`);
  assert.ok(dot(plane.normal, plane.center) < 0, `${label}: 镜头没有对着点图正面，无法判断顺逆时针`);
  if (steps % 2) {
    /** 透视除法后的屏幕方向：x 向右、y 向上。 */
    const screen = (matrix, point) => { const view = apply(matrix, point); return [view[0] / -view[2], view[1] / -view[2]]; };
    const middle = screen(plane.record.matrix, plane.local);
    for (const corner of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const point = [corner[0] ? plane.max[0] : plane.min[0], 0, corner[1] ? plane.max[1] : plane.min[1]];
      const from = subtract(screen(plane.record.matrix, point), middle), to = subtract(screen(plane.turned.matrix, point), middle);
      const winding = from[0] * to[1] - from[1] * to[0];
      // y 向上的屏幕里，顺时针对应负的叉积；转三次等于逆时针一次。
      assert.equal(Math.sign(winding), steps === 3 ? 1 : -1, `${label}: 屏幕上的转向不对 ${JSON.stringify({ corner, from, to })}`);
    }
  }
  return plane;
}

/**
 * 转过之后做一次水平镜像，翻的必须是当前看到的左右：镜像轴与没转时点图自身 X 轴在屏幕上的方向相同。
 * @param {object} plane assertQuarterTurn 返回的点图平面（转之前、转之后的读数）
 * @param {Array} turned 镜像之前的读数
 * @param {Array} mirrored 镜像之后的读数
 */
export function assertMirrorAcrossScreen(label, plane, turned, mirrored) {
  const axis = unit(apply(plane.record.matrix, [1, 0, 0, 0]));
  const mirror = [0, 1, 2].flatMap((column) => [0, 1, 2].map((row) => (row === column ? 1 : 0) - 2 * axis[row] * axis[column]));
  const after = pairLayers(label, turned, mirrored).find(([record]) => record === plane.turned)[1];
  const error = motionError(plane.turned.matrix, after.matrix, [...mirror.slice(0, 3), 0, ...mirror.slice(3, 6), 0, ...mirror.slice(6, 9), 0, 0, 0, 0, 1]);
  assert.ok(error.linear < 3e-3, `${label}: 转过之后的水平镜像没有沿当前画面的左右方向 ${error.linear}`);
}
