function rotate90(arr, height, width) {
  const matrix = [];
  for (let i = 0; i < height; i += 1) {
    matrix[i] = [];
    for (let j = 0; j < width; j += 1) {
      matrix[i].push(arr[i * height + j]);
    }
  }

  const temp = [];
  const len = matrix.length;
  for (let i = 0; i < len; i += 1) {
    for (let j = 0; j < len; j += 1) {
      const k = len - 1 - j;
      if (!temp[k]) temp[k] = [];
      temp[k][i] = matrix[i][j];
    }
  }
  return temp.flat();
}

function pressNew({ arr, width, height, type = 'row', value }) {
  const wsPointData = [...arr];

  if (type === 'row') {
    const rowTotals = [];
    for (let i = 0; i < height; i += 1) {
      let total = 0;
      for (let j = 0; j < width; j += 1) total += wsPointData[i * width + j];
      rowTotals.push(total);
    }

    for (let i = 0; i < height; i += 1) {
      for (let j = 0; j < width; j += 1) {
        wsPointData[i * width + j] = parseInt(
          (wsPointData[i * width + j] / (value - rowTotals[i] === 0 ? 1 : value - rowTotals[i])) * 1000,
          10,
        );
      }
    }
  } else {
    const colTotals = [];
    for (let i = 0; i < height; i += 1) {
      let total = 0;
      for (let j = 0; j < width; j += 1) total += wsPointData[j * height + i];
      colTotals.push(total);
    }

    for (let i = 0; i < height; i += 1) {
      for (let j = 0; j < width; j += 1) {
        wsPointData[j * height + i] = parseInt(
          (wsPointData[j * height + i] / (value - colTotals[i] === 0 ? 1 : value - colTotals[i])) * 1000,
          10,
        );
      }
    }
  }

  return wsPointData;
}

function extractCar10Region(arr) {
  const data = [];
  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      if (i < 10 && j > 21) data.push(arr[i * 32 + j]);
    }
  }

  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 10; j += 1) {
      [data[i * 10 + j], data[(4 - i) * 10 + j]] = [
        data[(4 - i) * 10 + j],
        data[i * 10 + j],
      ];
    }
  }

  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 10; j += 1) {
      [data[i * 10 + j], data[(i + 5) * 10 + j]] = [
        data[(i + 5) * 10 + j],
        data[i * 10 + j],
      ];
    }
  }

  return data;
}

function reorderSmallBedBase(input) {
  let wsPointData = input;
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      [wsPointData[i * 32 + j], wsPointData[(14 - i) * 32 + j]] = [
        wsPointData[(14 - i) * 32 + j],
        wsPointData[i * 32 + j],
      ];
    }
  }

  const firstRows = wsPointData.splice(0, 15 * 32);
  wsPointData = wsPointData.concat(firstRows);
  return wsPointData;
}

function flipSmallBedTopRows(wsPointData) {
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      [wsPointData[i * 32 + j], wsPointData[(16 - i) * 32 + j]] = [
        wsPointData[(16 - i) * 32 + j],
        wsPointData[i * 32 + j],
      ];
    }
  }
  return wsPointData;
}

/**
 * 旧汽车压力拟合公式。
 *
 * @param {number} value 单点平均压力输入。
 * @returns {number} 拟合后的 mmHg。
 */
function carFitting(value) {
  return 0.0582 * Math.pow(value, 2) + (-1.4553) * Math.pow(value, 1) + 11.6990;
}

/**
 * 将 mmHg 和面积换算为力。
 *
 * @param {number} mmgH 压力 mmHg。
 * @param {number} area 面积点数。
 * @returns {number} 牛顿值。
 */
function mmghToPress(mmgH, area) {
  const pa = mmgH * 133;
  const squareMeters = area * 0.014 * 0.015;
  return pa * squareMeters;
}

/**
 * 计算框选区域内的压力总和。
 *
 * @param {number[]} data 压力矩阵。
 * @param {[number, number, number, number]} indexArr 区域边界 `[x1, x2, y1, y2]`。
 * @param {number} height 每行跨度，沿用旧函数参数名。
 * @returns {number} 区域压力总和。
 */
function calPressArr(data, indexArr, height) {
  const selectedValues = [];
  for (let i = indexArr[2]; i < indexArr[3]; i += 1) {
    for (let j = indexArr[0]; j < indexArr[1]; j += 1) {
      selectedValues.push(data[i * height + j]);
    }
  }
  return selectedValues.reduce((sum, value) => sum + value, 0);
}

/**
 * 单点 ADC 到压力值的旧公式。
 *
 * @param {number} x ADC 或压力原始值。
 * @returns {number} 换算后的压力值。
 */
function calculatePressure(x) {
  return 1.314 * Math.pow(10, -4) * Math.pow(x, 3.955);
}

/**
 * 按采集时间修正压力漂移。
 *
 * @param {number} startValue 起始值。
 * @param {number} relValue 当前相对值。
 * @param {number} time 采集时间刻度。
 * @returns {number} 修正后的压力值。
 */
function calPress(startValue, relValue, time) {
  if (time < 60 * 13) {
    return relValue - (startValue * 0.05 * time) / 60 / 13;
  }
  if (time < 120 * 13) {
    return relValue
      - startValue * 0.05
      - (startValue * 0.03 * (time - 60 * 13)) / 60 / 13;
  }
  return relValue
    - startValue * 0.08
    - (startValue * 0.02 * (time - 120 * 13)) / 120 / 13;
}

/**
 * 双 32x32 压力面归一化，保持旧左侧 1.2 系数。
 *
 * @param {number[]} arr 32x64 压力矩阵。
 * @param {number} value 归一化目标值。
 * @returns {number[]} 归一化后的 32x64 压力矩阵。
 */
function press(arr, value) {
  let left = [];
  let right = [];
  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      left.push(arr[i * 64 + j]);
      right.push(arr[i * 64 + 32 + j]);
    }
  }

  left = pressNew({ arr: left, height: 32, width: 32, value });
  right = pressNew({ arr: right, height: 32, width: 32, value });

  const result = [];
  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 64; j += 1) {
      result.push(j < 32 ? left[i * 32 + j] * 1.2 : right[i * 32 + j - 32]);
    }
  }
  return result;
}

/**
 * 双 32x32 压力面仅做左侧 1.2 系数修正。
 *
 * @param {number[]} arr 32x64 压力矩阵。
 * @returns {number[]} 修正后的压力矩阵。
 */
function press12(arr) {
  const left = [];
  const right = [];
  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      left.push(arr[i * 64 + j]);
      right.push(arr[i * 64 + 32 + j]);
    }
  }

  const result = [];
  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 64; j += 1) {
      result.push(j < 32 ? left[i * 32 + j] * 1.2 : right[i * 32 + j - 32]);
    }
  }
  return result;
}

function car10Sit(arr) {
  return extractCar10Region(arr);
}

function car10Back(arr) {
  let data = extractCar10Region(arr);

  for (let i = 0; i < 10; i += 1) {
    for (let j = 0; j < 5; j += 1) {
      [data[i * 10 + 9 - j], data[i * 10 + j]] = [
        data[i * 10 + j],
        data[i * 10 + 9 - j],
      ];
    }
  }

  for (let i = 0; i < 10; i += 1) {
    data[i * 10] = data[i * 10 + 1];
    data[i * 10 + 9] = data[i * 10 + 8];
    data[i] = data[10 + i];
  }

  data = rotate90(data, 10, 10);
  return data;
}

function objChange(newValue, oldValue, valueFlag) {
  return !(newValue > oldValue - valueFlag && newValue < oldValue + valueFlag);
}

function smallBed(wsPointData) {
  return flipSmallBedTopRows(reorderSmallBedBase(wsPointData));
}

function smallBedReal(wsPointData) {
  return flipSmallBedTopRows(reorderSmallBedBase(wsPointData));
}

function smallBed1(wsPointData) {
  return reorderSmallBedBase(wsPointData);
}

function smallBedReal1(wsPointData) {
  return reorderSmallBedBase(wsPointData);
}

/**
 * 将总压力和受力点数量换算为牛顿。
 *
 * 保持旧公式输出，但去掉旧 openWeb.js 中未声明变量 `N` 带来的隐式全局副作用。
 *
 * @param {number} sitPoint 受力点数量。
 * @param {number} sitTotal 压力总和。
 * @returns {number} 保留两位小数的牛顿值。
 */
function pressToN(sitPoint, sitTotal) {
  const sitPressure = carFitting(sitTotal / (sitPoint || 1));
  const force = mmghToPress(sitPressure, sitPoint);
  return Number(force.toFixed(2));
}

/**
 * 压力换算和压力帧归一化入口。
 */
module.exports = {
  calPress,
  calculatePressure,
  calPressArr,
  car10Back,
  car10Sit,
  carFitting,
  mmghToPress,
  objChange,
  press,
  press12,
  pressToN,
  smallBed,
  smallBed1,
  smallBedReal,
  smallBedReal1,
};
