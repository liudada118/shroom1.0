/**
 * LineOrderPlayground.jsx - 线序变换的活演示
 *
 * 这块画面跑的是 `@shroom/backend/processing/lineOrders.js` 里的**真函数**，
 * 不是抄下来的结果。下拉里的每一项也不是手写的清单 —— 是加载时把整个模块
 * `Object.entries()` 出来，挨个喂一帧探出来的。
 *
 * ## 为什么用「探测」而不是手写清单
 *
 * 那个模块导出 37 个东西，形状很不齐：大多是 `(arr) => arr`，但里面混着两个标量
 * 函数（`convertTempFullBedTemperature`）、一个返回对象的（`tempFullBed`）、
 * 一个需要三个入参的（`rotate90`）、两个常量。手写一份「哪些能画成图」的清单，
 * 下次谁加个导出，清单不会有任何报错 —— 而这个站存在的全部理由就是不让这种事发生。
 *
 * 所以 `probeLineOrders()` 在加载时跑一遍，按**实际返回值**分类。加一个导出，
 * 刷新页面它自己就出现在下拉或下面那张表里。
 *
 * ## 探测为什么可以直接调
 *
 * 这些函数是纯计算：读入参、返回新数组，不碰文件、不碰串口、不留状态
 * （`jqbed` 那句 `splice` 动的是 `[...arr]` 的副本）。所以在模块加载时对全部 37 个
 * 各调一次是安全的，代价是几毫秒。
 */

import lineOrders from '@shroom/backend/processing/lineOrders.js';
import React from 'react';

import Matrix from '../components/Matrix.jsx';

/** 整帧尺寸。传感器的原始帧几乎都是 32×32=1024，探测和演示都用这个。 */
const SIDE = 32;
const FRAME_LENGTH = SIDE * SIDE;
/** 演示里的满量程。固定住，两块图才有可比性。 */
const PEAK = 240;

/**
 * 造一帧合成数据。
 *
 * 三种图案各有各的用处，不是三个随便的花样：
 *
 * - `corner`：**左上角一个不对称的直角标记**。线序干的事基本都是翻转 / 旋转 /
 *   平移，只有不对称图形能一眼看出它到底转到哪去了。默认选它。
 * - `blob`：两块高斯斑，像人坐上去或手按上去。看的是「压力分布会不会被打散」。
 * - `ramp`：行列双向渐变。看的是索引重排的整体走向。
 *
 * @param {'corner'|'blob'|'ramp'} pattern 图案。
 * @returns {number[]} 长度 1024 的一维帧。
 */
export function makeFrame(pattern) {
  const frame = new Array(FRAME_LENGTH).fill(0);

  for (let row = 0; row < SIDE; row += 1) {
    for (let col = 0; col < SIDE; col += 1) {
      const index = row * SIDE + col;

      if (pattern === 'ramp') {
        frame[index] = Math.round((PEAK * (row + col)) / (2 * SIDE - 2));
        continue;
      }

      if (pattern === 'blob') {
        const blobs = [[10, 11, 5], [21, 20, 7]];
        let value = 0;
        blobs.forEach(([blobRow, blobCol, radius]) => {
          const distance = Math.hypot(row - blobRow, col - blobCol);
          value += PEAK * Math.exp(-((distance / radius) ** 2));
        });
        frame[index] = Math.min(PEAK, Math.round(value));
        continue;
      }

      // corner：一条长边（上边 12 格）+ 一条短边（左边 6 格），亮度还不一样。
      // 上下翻和左右翻的结果不同，转 90° 和转 270° 的结果也不同 —— 这就是要的。
      const onTopBar = row >= 2 && row <= 4 && col >= 2 && col <= 13;
      const onLeftBar = col >= 2 && col <= 4 && row >= 5 && row <= 10;
      if (onTopBar) frame[index] = PEAK;
      else if (onLeftBar) frame[index] = Math.round(PEAK * 0.45);
      else frame[index] = 6; // 一点点底噪，好让空白区和「真的 0」区分得开
    }
  }

  return frame;
}

/**
 * 把 `lineOrders` 的全部导出按**实际行为**分类。
 *
 * @returns {{playable: object[], others: object[]}} 能画成图的，和不能的。
 */
export function probeLineOrders() {
  const probe = makeFrame('corner');
  const playable = [];
  const others = [];

  Object.entries(lineOrders).forEach(([name, value]) => {
    if (typeof value !== 'function') {
      others.push({ name, kind: '常量', detail: `${typeof value} = ${JSON.stringify(value)}` });
      return;
    }

    let result;
    try {
      result = value(probe);
    } catch (error) {
      others.push({ name, kind: '喂整帧会抛', detail: error.message });
      return;
    }

    if (Array.isArray(result)) {
      if (result.length === 0) {
        // rotate90(arr, height, width) 落在这里：少给的两个入参是 undefined，
        // 循环一次都不进，返回空数组。它不是坏的，是需要额外入参。
        others.push({
          name,
          kind: '需要额外入参',
          detail: `函数签名 ${value.length} 个参数，只喂一帧时返回空数组`,
        });
        return;
      }
      playable.push({ name, fn: value, length: result.length });
      return;
    }

    if (result && typeof result === 'object') {
      others.push({
        name,
        kind: '返回结构体',
        detail: `字段：${Object.keys(result).join(', ')}`,
      });
      return;
    }

    others.push({ name, kind: '标量函数', detail: `喂数组得到 ${String(result)}，它吃的是单个数` });
  });

  playable.sort((a, b) => a.name.localeCompare(b.name));
  others.sort((a, b) => a.name.localeCompare(b.name));
  return { playable, others };
}

const { playable: PLAYABLE } = probeLineOrders();

const PATTERNS = [
  { id: 'corner', label: '角标（看翻转/旋转）' },
  { id: 'blob', label: '两块压力斑（看分布）' },
  { id: 'ramp', label: '双向渐变（看重排走向）' },
];

export default function LineOrderPlayground() {
  const [pattern, setPattern] = React.useState('corner');
  const [name, setName] = React.useState('jqbed');

  const frame = React.useMemo(() => makeFrame(pattern), [pattern]);

  const output = React.useMemo(() => {
    const entry = PLAYABLE.find((item) => item.name === name);
    if (!entry) return { error: `模块里没有导出 ${name}` };
    try {
      return { data: entry.fn(frame) };
    } catch (error) {
      // 探测时用角标图案过了，换个图案挂掉是有可能的（比如补点算法碰到全 0）。
      // 这种情况要显示出来，不能吞。
      return { error: error.message };
    }
  }, [frame, name]);

  return (
    <div>
      <div className="docs-card-controls" style={{ border: 0, padding: '0 0 12px' }}>
        <label className="docs-field">
          <span>输入图案</span>
          <select value={pattern} onChange={(event) => setPattern(event.target.value)}>
            {PATTERNS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="docs-field">
          <span>线序函数</span>
          <select value={name} onChange={(event) => setName(event.target.value)}>
            {PLAYABLE.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}（→ {item.length} 点）
              </option>
            ))}
          </select>
        </label>
        <span className="docs-badge">{PLAYABLE.length} 个可画的导出</span>
      </div>

      <div className="docs-matrix-pair">
        <div className="docs-matrix-panel">
          <Matrix data={frame} cols={SIDE} max={PEAK} caption="输入：原始帧" />
        </div>
        <div className="docs-matrix-panel">
          {output.error
            ? <p className="docs-status docs-status-error">{name}() 抛了：{output.error}</p>
            : <Matrix data={output.data} max={PEAK} caption={`输出：${name}()`} />}
        </div>
      </div>
    </div>
  );
}
