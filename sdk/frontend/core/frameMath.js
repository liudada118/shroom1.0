/**
 * frameMath.js - 渲染器要用的三个纯帧函数
 *
 * 这个文件是**拆包时新建的，但三个函数体都是逐字搬过来的**，不是重写：
 *
 * | 函数 | 原位置 | 原行数 |
 * | :--- | :--- | ---: |
 * | `findMax` | `client/src/assets/util/util.js` | 7 |
 * | `jet` | `client/src/assets/util/util.js` | 20 |
 * | `press` | `client/src/assets/util/line.js:257-308` | 51 |
 *
 * ## 为什么要新建这一个文件，而不是把 util.js 整份搬过来
 *
 * `util.js` 是 1,440 行、顶层就读 `localStorage`（`initValue` 常量）、内部导入
 * 不写扩展名的 legacy 模块。它一进包，`core/` 就同时失去「零依赖」与「裸 Node
 * 可加载」两条性质 —— 而这两条正是 `scripts/smoke-core.mjs` 守着的东西。
 *
 * 渲染器真正需要的只有上面这三个函数，加起来 78 行，且都是纯的。所以把这三个
 * 搬进来，`util.js` / `line.js` 在原路径**re-export 本文件**，那 80 个
 * `from '../../assets/util/util'` 的消费文件一行都不用改 —— 与 `jetRgb` 搬进
 * `jetLadder.js` 时用的是同一套做法（见 `jetLadder.js` 头部）。
 *
 * `util.js` 侧配了一条身份断言（`util.jet.test.js`），锁的是「两边是同一个函数
 * 对象」而不是「行为相同」：没有它，将来有人图省事在 `util.js` 里再写一份函数体，
 * 不会有任何测试失败。
 *
 * ## 唯一的行为改动
 *
 * `press` 的 `type !== 'row'` 那支原来有一句 `console.log(colArr)`，**每帧都打**。
 * 它是调试残留（同一份原实现里还有一句 `console.log('分压')`，搬 `sprite3d.js`
 * 时已经摘掉了）。这里也摘掉：60Hz 刷控制台会拖慢开发者工具，而一个要发出去的
 * 包更不该往消费者的控制台里写东西。返回值一个字节都没变。
 */

import { jetRgb } from './jetLadder.js';

/**
 * 求数组最大值。
 *
 * 逐字搬自 `util.js`。注意 `max` 初值是 **0 而不是 -Infinity** —— 全负数组返回 0。
 * 压力数据非负，所以两者等价；但这是原行为，别"顺手修正"。
 *
 * @param {number[]} arr 数值数组。
 * @returns {number} 最大值；空数组给 0。
 */
export function findMax(arr) {
  let max = 0;
  arr.forEach((item) => {
    max = max > item ? max : item;
  });
  return max;
}

/**
 * jet 配色的整数三元组出口。
 *
 * 逐字搬自 `util.js`。取整用的是 `parseInt(255 * r + '')` 而不是 `Math.round`
 * —— 撞上科学计数法会出错（`parseInt('7.1e-12') === 7`），`util.jet.test.js`
 * 里有一条断言把这个 bug 锁住了。**这是 18 处老配色现在的观感，别改。**
 * 需要正确取整的新通路走 `colormaps.js` 的 `sampleColormapRgb`。
 *
 * @param {number} min 值域下界。
 * @param {number} max 值域上界。
 * @param {number} x 取样值，超出 [min, max] 会被夹取。
 * @returns {number[]} `[r, g, b]`，各分量 0-255 的整数。
 */
export function jet(min, max, x) {
  const { r, g, b } = jetRgb(min, max, x);
  var rgb = new Array();
  rgb[0] = parseInt(255 * r + '');
  rgb[1] = parseInt(255 * g + '');
  rgb[2] = parseInt(255 * b + '');
  return rgb;
}

/**
 * 分压重分配。
 *
 * 逐字搬自 `line.js:257-308`（只摘掉那句每帧的 `console.log`，见文件头）。
 * 只有 `Fast1024sit` 这一条预设启用它（`pressureRedistribution.enabled`）。
 *
 * 语义是「把每行（或每列）的读数按该行总和与 `value` 的差重新归一」，
 * `value - colArr[i] <= 0 ? 1 : value - colArr[i]` 这个守卫是防除零兼防倒相。
 *
 * @param {number[]} arr 原始帧。
 * @param {number} width 矩阵宽度。
 * @param {number} height 矩阵高度。
 * @param {number} value 分压基准（原实现里的 `valuep`）。
 * @param {number} prop 分压比例（原实现里的 `valueprop`）。
 * @param {'row'|'col'} [type] 沿行还是沿列归一。
 * @returns {number[]} 重分配后的新数组，不改入参。
 */
export function press(arr, width, height, value, prop, type = "row") {
  let wsPointData = [...arr];

  if (type == "row") {
    let colArr = [];
    for (let i = 0; i < height; i++) {
      let total = 0;
      for (let j = 0; j < width; j++) {
        total += wsPointData[i * width + j];
      }
      colArr.push(total);
    }
    // //////okok
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        wsPointData[i * width + j] = parseInt(
          (wsPointData[i * width + j] /
            (value - colArr[i] <= 0 ? 1 : value - colArr[i])) *
          1000 * prop
        );
      }
    }
  } else {
    let colArr = [];
    for (let i = 0; i < height; i++) {
      let total = 0;
      for (let j = 0; j < width; j++) {
        total += wsPointData[j * height + i];
      }
      colArr.push(total);
    }
    // //////okok

    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        wsPointData[j * height + i] = parseInt(
          (wsPointData[j * height + i] /
            (value - colArr[i] <= 0 ? 1 : value - colArr[i])) *
          1000 * prop
        );
      }
    }
  }

  return wsPointData;
}
