/**
 * frameMath.js - 渲染器要用的纯帧函数
 *
 * 这个文件是**拆包时新建的，但每个函数体都是逐字搬过来的**，不是重写：
 *
 * | 函数 | 原位置 | 原行数 | 哪一轮搬的 |
 * | :--- | :--- | ---: | :--- |
 * | `findMax` | `client/src/assets/util/util.js` | 7 | 一（numMatrix） |
 * | `jet` | `client/src/assets/util/util.js` | 20 | 一（numMatrix） |
 * | `press` | `client/src/assets/util/line.js:257-308` | 51 | 一（numMatrix） |
 * | `interpSmall` | `client/src/assets/util/util.js` | 12 | 二（pointGrid） |
 * | `addSide` | `client/src/assets/util/util.js` | 33 | 二（pointGrid） |
 * | `gaussBlur_1` | `client/src/assets/util/util.js` | 17 | 二（pointGrid） |
 *
 * ## 为什么要新建这一个文件，而不是把 util.js 整份搬过来
 *
 * `util.js` 是 1,440 行、顶层就读 `localStorage`（`initValue` 常量）、内部导入
 * 不写扩展名的 legacy 模块。它一进包，`core/` 就同时失去「零依赖」与「裸 Node
 * 可加载」两条性质 —— 而这两条正是 `scripts/smoke-core.mjs` 守着的东西。
 *
 * 渲染器真正需要的只有上面这几个函数，且都是纯的。所以把它们搬进来，
 * `util.js` / `line.js` 在原路径**re-export 本文件**，那 80 个
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

/**
 * 稀疏放大：把小矩阵铺到大矩阵的网格点上，点与点之间留空（填 0）。
 *
 * 逐字搬自 `util.js:237-248`。点阵管线里它跑在 `addSide` 之后、`gaussBlur_1`
 * 之前 —— 先撑开留白，再由高斯模糊把空隙糊成连续的热力面。所以「插值」这个
 * 名字有点误导：**它自己不插值，只做稀疏摆放**，平滑是下一步的事。
 *
 * 两处照抄、别"顺手修正"的行为：
 *
 * 1. **值被乘了 10。** `smallMat[...] * 10` 是写死的放大系数，跟 `decimalScale`
 *    那套没有关系。改它就是改点阵的高度尺度。
 * 2. **纵向步长用的是 `i * interp2`，横向用 `j * interp1`，但行宽算的是
 *    `width * interp1`。** 也就是纵横两个方向的放大倍数可以不同，而行宽只跟
 *    `interp1` 走。调用点传的 `interp1 === interp2 === 2`，所以没人踩到不对称。
 *
 * @param {number[]} smallMat 原矩阵，行优先展开。
 * @param {number} width 原矩阵列数。
 * @param {number} height 原矩阵行数。
 * @param {number} interp1 横向放大倍数。
 * @param {number} interp2 纵向放大倍数。
 * @returns {number[]} 长度 `width * interp1 * height * interp2` 的新数组。
 */
export function interpSmall(smallMat, width, height, interp1, interp2) {

  const bigMat = new Array((width * interp1) * (height * interp2)).fill(0)
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      bigMat[(width * interp1) * i * interp2 + (j * interp1)
      ] = smallMat[i * width + j] * 10
    }
  }
  return bigMat
}

/**
 * 四周镶边：在矩阵左右各加 `wnum` 列、上下各加 `hnum` 行。
 *
 * 逐字搬自 `util.js:305-337`。点阵管线里它排在最前面 —— 高斯模糊在边界处会把
 * 边缘值往外拖，先镶一圈固定值可以让热力面的边收得干净。
 *
 * **`sideNum >= 0 ? sideNum : 1` 这个守卫要照抄。** 它的意思是「负数一律当 1」，
 * 而默认参数是 0，所以不传就镶 0。写成 `sideNum ?? 0` 不等价。
 *
 * 注意左右镶边只在 `j == 0` 与 `j == width - 1` 两支里做 —— `width === 1` 时
 * 走的是第一支，右边不会镶。调用点的宽度都远大于 1，没人踩到。
 *
 * @param {number[]} arr 原矩阵，行优先展开。
 * @param {number} width 原矩阵列数。
 * @param {number} height 原矩阵行数。
 * @param {number} wnum 左右各加几列。
 * @param {number} hnum 上下各加几行。
 * @param {number} [sideNum] 镶边填充值；负数当 1。
 * @returns {number[]} 长度 `(width + 2 * wnum) * (height + 2 * hnum)` 的新数组。
 */
export function addSide(arr, width, height, wnum, hnum, sideNum = 0) {
  let narr = new Array(height);
  let res = [];
  for (let i = 0; i < height; i++) {
    narr[i] = [];

    for (let j = 0; j < width; j++) {
      if (j == 0) {
        narr[i].push(
          ...new Array(wnum).fill(sideNum >= 0 ? sideNum : 1),
          arr[i * width + j]
        );
      } else if (j == width - 1) {
        narr[i].push(
          arr[i * width + j],
          ...new Array(wnum).fill(sideNum >= 0 ? sideNum : 1)
        );
      } else {
        narr[i].push(arr[i * width + j]);
      }
    }
  }
  for (let i = 0; i < height; i++) {
    res.push(...narr[i]);
  }

  return [
    ...new Array(hnum * (width + 2 * wnum)).fill(sideNum >= 0 ? sideNum : 1),
    ...res,
    ...new Array(hnum * (width + 2 * wnum)).fill(sideNum >= 0 ? sideNum : 1),
  ];
}

/**
 * 朴素高斯模糊。**这个函数不是纯的 —— 结果写进 `tcl`，没有返回值。**
 *
 * 逐字搬自 `util.js:371-387`。本文件里其余函数都返回新数组，只有它是原地写出参，
 * 所以单独点一句：调用方要自己准备好 `tcl`（长度 `w * h`）。这是原签名，改成
 * 返回新数组会让 7 个调用点全部要改，不在这一轮的范围里。
 *
 * 复杂度是 O(w · h · rs²)，`rs = ceil(r * 2.57)`。点阵传的 `r` 是 4-8，
 * 矩阵放大后接近 100×100，所以单帧几十万次乘加 —— 它是点阵管线里最贵的一步，
 * 也是 `fps: 10` 这个预设值的由来。**要提速得换成可分离卷积（横竖各一遍，
 * 降到 O(w · h · rs)），那是独立的一件事，会改变浮点舍入。**
 *
 * 全仓另有 `gaussBlur_2` / `boxBlur_2` / `boxesForGauss` 共 7 份复制粘贴仍在
 * `util.js` 里 —— 那是可分离实现，但没人把点阵切过去。记进积压。
 *
 * @param {number[]} scl 源矩阵，行优先展开，不被修改。
 * @param {number[]} tcl **出参**，长度须为 `w * h`，结果写在这里。
 * @param {number} w 列数。
 * @param {number} h 行数。
 * @param {number} r 高斯半径。
 * @returns {void}
 */
export function gaussBlur_1(scl, tcl, w, h, r) {
  var rs = Math.ceil(r * 2.57); // significant radius
  for (var i = 0; i < h; i++)
    for (var j = 0; j < w; j++) {
      var val = 0,
        wsum = 0;
      for (var iy = i - rs; iy < i + rs + 1; iy++)
        for (var ix = j - rs; ix < j + rs + 1; ix++) {
          var x = Math.min(w - 1, Math.max(0, ix));
          var y = Math.min(h - 1, Math.max(0, iy));
          var dsq = (ix - j) * (ix - j) + (iy - i) * (iy - i);
          var wght = Math.exp(-dsq / (2 * r * r)) / (Math.PI * 2 * r * r);
          val += scl[y * w + x] * wght;
          wsum += wght;
        }
      tcl[i * w + j] = Math.round(val / wsum);
    }
}
