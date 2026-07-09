const { zeroLine } = require('./matrixTransforms');
const {
  FOOT_R_ADC_ORDER,
  FOOT_VIDEO_POINTS,
} = require('./lineOrderDefinitions/foot');
const { mapOneBasedOrder } = require('./lineOrderMapper');

/**
 * 旧系统的视频点位映射集合。
 *
 * 这些函数主要负责把 32x32、16x16 或脚部 64x32 数据裁剪、翻转、
 * 旋转成前端展示需要的矩阵。
 */

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

function paintInterpolatedFootFrame(values, points) {
  const frame = new Array(32 * 64).fill(0);
  points.forEach((point, index) => {
    frame[point[0] * 32 + point[1]] = values[index];
  });

  for (let i = 0; i < 10; i += 1) {
    for (let j = 1; j < 6; j += 1) {
      const col = points[i * 6 + j][0];
      const length = points[i * 6 + j][1] - points[i * 6 + j - 1][1];
      const firstIndex = points[i * 6 + j - 1][1];
      const lastIndex = points[i * 6 + j][1];
      const firstValue = frame[col * 32 + firstIndex];
      const lastValue = frame[col * 32 + lastIndex];
      const diff = lastValue - firstValue;
      for (let k = 1; k < length; k += 1) {
        frame[col * 32 + firstIndex + k] = firstValue + Math.floor(diff * 10 / length) / 10;
      }
    }
  }

  for (let i = 0; i < 9; i += 1) {
    const col = points[i * 6][0];
    const nextCol = points[(i + 1) * 6][0];
    const firstIndex = points[i * 6][1];
    const lastIndex = points[i * 6 + 5][1];
    for (let j = firstIndex; j <= lastIndex; j += 1) {
      frame[(col + 1) * 32 + j] = frame[col * 32 + j]
        + Math.floor((frame[nextCol * 32 + j] - frame[col * 32 + j]) * 10 * 1 / 5) / 10;
      frame[(col + 2) * 32 + j] = frame[col * 32 + j]
        + Math.floor((frame[nextCol * 32 + j] - frame[col * 32 + j]) * 10 * 2 / 5) / 10;
      frame[(col + 3) * 32 + j] = frame[col * 32 + j]
        + Math.floor((frame[nextCol * 32 + j] - frame[col * 32 + j]) * 10 * 3 / 5) / 10;
      frame[(col + 4) * 32 + j] = frame[col * 32 + j]
        + Math.floor((frame[nextCol * 32 + j] - frame[col * 32 + j]) * 10 * 4 / 5) / 10;
    }
  }

  return frame;
}

function arrX2Y(arr) {
  const length = arr.length;
  const size = Math.sqrt(length);
  if (size % 1 !== 0) {
    throw new Error('输入数组长度不是完全平方数，无法构成正方形矩阵');
  }

  const result = new Array(length);
  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      const oldIndex = i * size + j;
      const newIndex = (size - 1 - j) * size + (size - 1 - i);
      result[newIndex] = arr[oldIndex];
    }
  }
  return result;
}

function buildHandVideoBase(arr) {
  let source = [...arr];
  const firstHalf = source.splice(0, 8 * 16);
  source = source.concat(firstHalf);
  source = arrX2Y(source);

  const handArr = [];
  for (let i = 0; i < 10; i += 1) {
    for (let j = 14; j >= 0; j -= 1) {
      handArr.push(source[(j + 1) * 16 + 15 - i]);
    }
  }

  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 15; j += 1) {
      [handArr[i * 15 + j], handArr[(9 - i) * 15 + j]] = [
        handArr[(9 - i) * 15 + j],
        handArr[i * 15 + j],
      ];
    }
  }

  handArr.splice(5 * 15 + 12, 3);
  return handArr;
}

function reorderHandVideoRows(handArr) {
  const result = [];
  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 15; j += 1) {
      result.push(handArr[i * 15 + 14 - j]);
    }
  }

  for (let i = 75 + 12 - 1; i >= 75; i -= 1) {
    result.push(handArr[i]);
  }

  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 15; j += 1) {
      result.push(handArr[75 + 12 + i * 15 + 14 - j]);
    }
  }
  return result;
}

function smallM(wsPointData) {
  const source = [];
  for (let i = 0; i < 32; i += 1) {
    if (i === 4 || i === 12 || i === 24) continue;
    for (let j = 22; j < 32; j += 1) source.push(wsPointData[i * 32 + j]);
    if (i === 6 || i === 15 || i === 26) {
      for (let j = 22; j < 32; j += 1) source.push(wsPointData[i * 32 + j]);
    }
  }

  const result = [];
  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 10; j += 1) {
      if (j === 4) continue;
      if (j === 2 || j === 3) {
        result[i * 10 + j + 1] = source[i * 10 + j];
        continue;
      }
      result[i * 10 + j] = source[i * 10 + j];
      if (j === 1) result[i * 10 + j + 1] = source[i * 10 + j];
    }
  }

  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      [result[i * 10 + j], result[i * 10 + 4 - j]] = [
        result[i * 10 + 4 - j],
        result[i * 10 + j],
      ];
    }
  }
  return result;
}

function smallM1(wsPointData) {
  const result = [];
  for (let j = 0; j < 32; j += 1) {
    for (let i = 22; i < 32; i += 1) {
      result.push(wsPointData[i * 32 + j]);
    }
  }
  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      [result[i * 10 + j], result[i * 10 + 4 - j]] = [
        result[i * 10 + 4 - j],
        result[i * 10 + j],
      ];
    }
  }
  return result;
}

function rect(wsPointData) {
  const cropped = [];
  for (let i = 22; i < 32; i += 1) {
    for (let j = 0; j < 16; j += 1) {
      cropped.push(wsPointData[i * 32 + j]);
    }
  }

  for (let i = 0; i < 10; i += 1) {
    for (let j = 7; j < 12; j += 1) {
      [cropped[i * 16 + j], cropped[i * 16 + 22 - j]] = [
        cropped[i * 16 + 22 - j],
        cropped[i * 16 + j],
      ];
    }
  }

  const result = [];
  for (let j = 0; j < 16; j += 1) {
    for (let i = 0; i < 10; i += 1) {
      result.push(cropped[i * 16 + j]);
    }
  }
  return result;
}

function short(wsPointData) {
  for (let i = 0; i < 32; i += 1) {
    for (let j = 16; j < 24; j += 1) {
      [wsPointData[i * 32 + j], wsPointData[i * 32 + 47 - j]] = [
        wsPointData[i * 32 + 47 - j],
        wsPointData[i * 32 + j],
      ];
    }
  }

  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 16; j += 1) {
      [wsPointData[i * 32 + j], wsPointData[i * 32 + 31 - j]] = [
        wsPointData[i * 32 + 31 - j],
        wsPointData[i * 32 + j],
      ];
    }
  }
  return wsPointData;
}

function matColLine(arr) {
  let result = [];
  for (let i = 0; i < 16; i += 1) {
    for (let j = 0; j < 10; j += 1) {
      result.push(arr[i * 32 + j]);
    }
  }

  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 10; j += 1) {
      [result[i * 10 + j], result[(7 - i) * 10 + j]] = [
        result[(7 - i) * 10 + j],
        result[i * 10 + j],
      ];
    }
  }

  const firstRows = result.splice(0, 10 * 8);
  result = result.concat(firstRows);
  return result;
}

function handBlue(arr) {
  const wsPointData = [...arr];
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      [wsPointData[(16 + i) * 32 + j], wsPointData[(31 - i) * 32 + j]] = [
        wsPointData[(31 - i) * 32 + j],
        wsPointData[(16 + i) * 32 + j],
      ];
    }
  }

  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 8; j += 1) {
      [wsPointData[i * 32 + j], wsPointData[i * 32 + 14 - j]] = [
        wsPointData[i * 32 + 14 - j],
        wsPointData[i * 32 + j],
      ];
    }
  }

  return zeroLine(wsPointData);
}

function handSinglePoint(arr) {
  const wsPointData = [];
  for (let start = 481; start <= 992; start += 32) {
    for (let point = start; point < start + 32; point += 1) {
      wsPointData.push(arr[point - 1] || 0);
    }
  }
  for (let start = 449; start >= 1; start -= 32) {
    for (let point = start; point < start + 32; point += 1) {
      wsPointData.push(arr[point - 1] || 0);
    }
  }
  for (let point = 993; point <= 1024; point += 1) {
    wsPointData.push(arr[point - 1] || 0);
  }
  return wsPointData;
}

function carCol(arr) {
  const wsPointData = [...arr];
  const cropped = [];
  for (let i = 6; i < 16; i += 1) {
    for (let j = 0; j < 9; j += 1) {
      cropped.push(wsPointData[i * 32 + j]);
    }
  }

  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 9; j += 1) {
      [cropped[i * 9 + j], cropped[(4 - i) * 9 + j]] = [
        cropped[(4 - i) * 9 + j],
        cropped[i * 9 + j],
      ];
    }
  }

  [2, 3, 4, 5, 6, 7, 8].forEach((row) => {
    cropped[row * 9 + 4] = 0;
  });

  const result = [];
  for (let j = 0; j < 9; j += 1) {
    for (let i = 0; i < 10; i += 1) {
      result.push(cropped[i * 9 + j]);
    }
  }
  return result;
}

function gloves0123Res(wsPointData) {
  const result = [];
  for (let i = 8; i < 16; i += 1) {
    for (let j = 6; j < 16; j += 1) result.push(wsPointData[i * 16 + j]);
  }

  for (let i = 0; i < 2; i += 1) {
    for (let j = 6; j < 16; j += 1) result.push(wsPointData[i * 16 + j]);
  }

  for (let i = 0; i < 10; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      [result[i * 10 + j], result[i * 10 + 4 - j]] = [
        result[i * 10 + 4 - j],
        result[i * 10 + j],
      ];
    }
  }

  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 10; j += 1) {
      [result[i * 10 + j], result[(9 - i) * 10 + j]] = [
        result[(9 - i) * 10 + j],
        result[i * 10 + j],
      ];
    }
  }

  return result;
}

function buildFootVideo1Points() {
  const points = FOOT_VIDEO_POINTS.map((point) => [...point]);
  for (let i = 0; i < 10; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      [points[i * 6 + (5 - j)], points[i * 6 + j]] = [
        points[i * 6 + j],
        points[i * 6 + (5 - j)],
      ];
    }
  }
  return points.map((point) => [point[0], 31 - point[1]]);
}

function footVideo1(arr) {
  const values = mapOneBasedOrder(arr, FOOT_R_ADC_ORDER);
  return paintInterpolatedFootFrame(values, buildFootVideo1Points());
}

function handVideoRealPoint_0506_3(arr) {
  const handArr = buildHandVideoBase(arr);
  for (let i = 4 * 15; i < 5 * 15; i += 1) {
    handArr[i] = Math.floor(handArr[i] / 3);
  }
  return handArr;
}

function handVideo1_0416_0506(arr) {
  const handArr = buildHandVideoBase(arr);
  const result = reorderHandVideoRows(handArr);
  const handPointArr = [
    [6, 2], [6, 3], [6, 4], [3, 8], [3, 9], [3, 10], [3, 14], [3, 15], [3, 16], [3, 20], [3, 21], [3, 22], [10, 26], [10, 27], [10, 28],
    [7, 2], [7, 3], [7, 4], [4, 8], [4, 9], [4, 10], [4, 14], [4, 15], [4, 16], [4, 20], [4, 21], [4, 22], [11, 26], [11, 27], [11, 28],
    [8, 2], [8, 3], [8, 4], [5, 8], [5, 9], [5, 10], [5, 14], [5, 15], [5, 16], [5, 20], [5, 21], [5, 22], [12, 26], [12, 27], [12, 28],
    [9, 2], [9, 3], [9, 4], [6, 8], [6, 9], [6, 10], [6, 14], [6, 15], [6, 16], [6, 20], [6, 21], [6, 22], [13, 26], [13, 27], [13, 28],
    [13, 2], [13, 3], [13, 4], [13, 8], [13, 9], [13, 10], [13, 14], [13, 15], [13, 16], [13, 20], [13, 21], [13, 22], [17, 25], [17, 26], [17, 27],
    [17, 6], [17, 7], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17],
    [19, 6], [19, 7], [19, 8], [19, 9], [19, 10], [19, 11], [19, 12], [19, 13], [19, 14], [19, 15], [19, 16], [19, 17], [19, 18], [19, 19], [19, 20],
    [21, 6], [21, 7], [21, 8], [21, 9], [21, 10], [21, 11], [21, 12], [21, 13], [21, 14], [21, 15], [21, 16], [21, 17], [21, 18], [21, 19], [21, 20],
    [23, 6], [23, 7], [23, 8], [23, 9], [23, 10], [23, 11], [23, 12], [23, 13], [23, 14], [23, 15], [23, 16], [23, 17], [23, 18], [23, 19], [23, 20],
    [25, 6], [25, 7], [25, 8], [25, 9], [25, 10], [25, 11], [25, 12], [25, 13], [25, 14], [25, 15], [25, 16], [25, 17], [25, 18], [25, 19], [25, 20],
  ];

  for (let i = 4 * 15; i < 5 * 15; i += 1) {
    result[i] /= 3;
  }

  const frame = new Array(1024).fill(0);
  handPointArr.forEach((point, index) => {
    frame[(31 - point[0]) * 32 + point[1]] = result[index];
    if (index >= 75) {
      frame[(31 - (point[0] + 1)) * 32 + point[1]] = result[index];
    }
  });
  return frame;
}

function footArrToNormal(arr) {
  let source = arr;
  if (source == null || source === '' || source === 'undefined') {
    source = [];
  } else if (!Array.isArray(source)) {
    try {
      source = JSON.parse(source);
    } catch (error) {
      source = [];
    }
  }

  return FOOT_VIDEO_POINTS.map((point) => source[point[0] * 32 + point[1]] || 0);
}

function rightEye(wsPointData) {
  const result = [];
  const lastArr = wsPointData.splice(128, 128);
  const source = lastArr.concat(wsPointData);
  const order = [7, 8, 9, 10, 11, 12, 13, 14, 6, 5, 4, 3, 2, 1, 0, 15].reverse();

  for (let j = 0; j < 16; j += 1) {
    for (let i = 0; i < order.length; i += 1) {
      result.push(source[j * 16 + order[i]]);
    }
  }
  return result;
}

module.exports = {
  carCol,
  footArrToNormal,
  footVideo1,
  gloves0123Res,
  handBlue,
  handSinglePoint,
  handVideo1_0416_0506,
  handVideoRealPoint_0506_3,
  leftEye: () => undefined,
  matColLine,
  rect,
  rightEye,
  short,
  smallM,
  smallM1,
};
