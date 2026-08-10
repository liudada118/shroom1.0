/**
 * mathUtils.js - 数学和数据处理工具函数
 *
 * 从 server.js 中提取的纯函数，不依赖任何全局状态。
 * 包含高斯模糊、插值、分压计算等算法。
 */

/**
 * 高斯模糊（返回新数组）
 * @param {number[]} scl - 输入一维数组
 * @param {number} w - 宽度
 * @param {number} h - 高度
 * @param {number} r - 模糊半径
 * @returns {number[]} 模糊后的数组
 */
function gaussBlur_return(scl, w, h, r) {
  const res = new Array(scl.length).fill(1);
  let rs = Math.ceil(r * 2.57);
  for (let i = 0; i < h; i++) {
    for (let j = 0; j < w; j++) {
      let val = 0, wsum = 0;
      for (let iy = i - rs; iy < i + rs + 1; iy++)
        for (let ix = j - rs; ix < j + rs + 1; ix++) {
          let x = Math.min(w - 1, Math.max(0, ix));
          let y = Math.min(h - 1, Math.max(0, iy));
          let dsq = (ix - j) * (ix - j) + (iy - i) * (iy - i);
          let wght = Math.exp(-dsq / (2 * r * r)) / (Math.PI * 2 * r * r);
          val += scl[y * w + x] * wght;
          wsum += wght;
        }
      res[i * w + j] = Math.round(val / wsum);
    }
  }
  return res;
}

/**
 * 高斯模糊（变体2）
 * @param {number[]} scl - 输入一维数组
 * @param {number} w - 宽度
 * @param {number} h - 高度
 * @param {number} r - 模糊半径
 * @returns {number[]} 模糊后的数组
 */
function gaussBlur_2(scl, w, h, r) {
  const tcl = new Array(scl.length).fill(1);
  let rs = Math.ceil(r * 2.57);
  for (let i = 0; i < h; i++)
    for (let j = 0; j < w; j++) {
      let val = 0, wsum = 0;
      for (let iy = i - rs; iy < i + rs + 1; iy++)
        for (let ix = j - rs; ix < j + rs + 1; ix++) {
          let x = Math.min(w - 1, Math.max(0, ix));
          let y = Math.min(h - 1, Math.max(0, iy));
          let dsq = (ix - j) * (ix - j) + (iy - i) * (iy - i);
          let wght = Math.exp(-dsq / (2 * r * r)) / (Math.PI * 2 * r * r);
          val += scl[y * w + x] * wght;
          wsum += wght;
        }
      tcl[i * w + j] = Math.round(val / wsum);
    }
  return tcl;
}

/**
 * 小矩阵插值放大
 * @param {number[]} smallMat - 输入小矩阵
 * @param {number} width - 原始宽度
 * @param {number} height - 原始高度
 * @param {number} interp1 - 水平插值倍数
 * @param {number} interp2 - 垂直插值倍数
 * @returns {number[]} 放大后的矩阵
 */
function interpSmall(smallMat, width, height, interp1, interp2) {
  const bigMat = new Array((width * interp1) * (height * interp2)).fill(0);
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      bigMat[(width * interp1) * i * interp2 + (j * interp1)] = smallMat[i * width + j] * 10;
    }
  }
  return bigMat;
}

/**
 * 查找数组最大值
 * @param {number[]} arr
 * @returns {number}
 */
function findMax(arr) {
  let max = 0;
  arr.forEach((item) => {
    max = max > item ? max : item;
  });
  return max;
}

/**
 * 将负数截断为 0
 * @param {number} num
 * @returns {number}
 */
function numLessZeroToZero(num) {
  return num < 0 ? 0 : num;
}

/**
 * 分压公式（标准版）
 * @param {number[]} arr - 输入数组
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {string} type - "row" 或 "col"
 * @param {number} value - 分压值
 * @returns {number[]}
 */
function press6(arr, width, height, type = "row", value = 1245) {
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
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        wsPointData[i * width + j] = parseInt(
          (wsPointData[i * width + j] * 3 / 4 /
            (value - colArr[i] * 3 / 4 <= 0 ? 1 : value - colArr[i] * 3 / 4)) * 1
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
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        wsPointData[j * height + i] = parseInt(
          (wsPointData[j * height + i] * 3 / 4 /
            (value - colArr[i] * 3 / 4 <= 0 ? 1 : value - colArr[i] * 3 / 4)) * 1
        );
      }
    }
  }
  return wsPointData;
}

/**
 * 分压公式（新版 1220）
 */
function pressNew1220({ arr, width, height, type = "row", value }) {
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
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        let den = wsPointData[i * width + j] + value - colArr[i];
        if (den <= 0) den = 1;
        wsPointData[i * width + j] = parseInt(wsPointData[i * width + j] * value / den);
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
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        let den = wsPointData[j * height + i] + value - colArr[i];
        if (den <= 0) den = 1;
        wsPointData[j * height + i] = parseInt((wsPointData[j * height + i] * value / den) / 2);
      }
    }
  }
  return wsPointData;
}

function pressNew12203131({ arr, width, height, type = "row", value }) {
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
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        let den = wsPointData[i * width + j] + value - colArr[i];
        if (den <= 0) den = 1;
        wsPointData[i * width + j] = parseInt(wsPointData[i * width + j] * value / den);
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
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        if(i == 31) continue;
        if(j == 16) continue;
        let den = wsPointData[j * height + i] + value - colArr[i];
        if (den <= 0) den = 1;
        wsPointData[j * height + i] = parseInt((wsPointData[j * height + i] * value / den) / 2);
      }
    }
  }
  return wsPointData;
}

/**
 * 分压公式（座椅版）
 */
function press6sit(arr, width, height, type = "row", value = 480) {
  let wsPointData = [...arr];
  const props = 4;

  if (type == "row") {
    let colArr = [];
    for (let i = 0; i < height; i++) {
      let total = 0;
      for (let j = 0; j < width; j++) {
        total += wsPointData[i * width + j];
      }
      colArr.push(total);
    }
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        wsPointData[i * width + j] = parseInt(
          (wsPointData[i * width + j] * props / 4 /
            (value - colArr[i] * props / 4 <= 0 ? 1 : value - colArr[i] * props / 4)) * 1000
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
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        wsPointData[j * height + i] = parseInt(
          (wsPointData[j * height + i] * props / 4 /
            (value - colArr[i] * props / 4 <= 0 ? 1 : value - colArr[i] * props / 4)) * 600
        );
      }
    }
  }
  return wsPointData;
}

/**
 * 4 字节 buffer 转浮点数数组
 * @param {Buffer} buffers
 * @returns {number[]}
 */
function bytes4ToInt10(buffers) {
  const res = [];
  if (!buffers || !buffers.length) return res;
  for (let i = 0; i < buffers.length / 4; i++) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    for (let j = 0; j < 4; j++) {
      const byte = buffers[i * 4 + j];
      view.setUint8(j, (byte != null && !isNaN(byte)) ? byte : 0);
    }
    const floatValue = view.getFloat32(0, true);
    // NaN/Infinity 保护：无效值替换为 0
    res.push(isFinite(floatValue) ? floatValue : 0);
  }
  return res;
}

/**
 * 数组坐标重映射
 * @param {number[]} arr - 原始数组
 * @param {Array} arrX - X 坐标映射
 * @param {Array} arrY - Y 坐标映射
 * @param {number} matrixLength - 矩阵边长
 * @returns {number[]}
 */
function arrToRealLine(arr, arrX, arrY, matrixLength) {
  const realX = [], realY = [];
  arrX.forEach((a) => {
    if (Array.isArray(a)) {
      if (a[0] > a[1]) {
        for (let i = a[0]; i >= a[1]; i--) realX.push(i);
      } else {
        for (let i = a[0]; i <= a[1]; i++) realX.push(i);
      }
    } else {
      realX.push(a);
    }
  });

  arrY.forEach((a) => {
    if (Array.isArray(a)) {
      if (a[0] > a[1]) {
        for (let i = a[0]; i >= a[1]; i--) realY.push(i);
      } else {
        for (let i = a[0]; i <= a[1]; i++) realY.push(i);
      }
    } else {
      realY.push(a);
    }
  });

  let newArr = [];
  for (let i = 0; i < realY.length; i++) {
    for (let j = 0; j < realX.length; j++) {
      const realXCoo = realY[i];
      const realYCoo = realX[j];
      newArr.push(arr[realXCoo * matrixLength + realYCoo]);
    }
  }
  return newArr;
}

module.exports = {
  gaussBlur_return,
  gaussBlur_2,
  interpSmall,
  findMax,
  numLessZeroToZero,
  press6,
  pressNew1220,
  press6sit,
  bytes4ToInt10,
  arrToRealLine,
  pressNew12203131,
};
