import { lineInterp } from "../../assets/util/line"

export function flLine(arr) {
  let adcArr = [224, 208, 192, 176, 160, 144, 223, 207, 191, 175, 159, 143, 222, 206, 190, 174, 158, 142, 221, 205, 189, 173, 157, 141, 220, 204, 188, 172, 156, 140,
    219, 203, 187, 171, 155, 139, 218, 202, 186, 170, 154, 138, 217, 201, 185, 169, 153, 137, 216, 200, 184, 168, 152, 136, 215, 199, 183, 167, 151, 135]

  const pointArr = [[1, 6], [1, 7], [1, 8], [1, 9], [1, 10], [1, 11], [3, 5], [3, 7], [3, 8], [3, 10], [3, 11], [3, 13], [5, 4], [5, 6], [5, 8], [5, 9], [5, 11], [5, 13], [7, 4], [7, 6], [7, 7], [7, 9], [7, 10], [7, 12], [9, 5], [9, 7], [9, 8], [9, 9], [9, 11], [9, 12], [11, 6], [11, 7], [11, 8], [11, 9], [11, 10], [11, 11], [13, 6], [13, 7], [13, 8], [13, 9], [13, 10], [13, 12], [15, 6], [15, 7], [15, 8], [15, 9], [15, 10], [15, 12], [17, 6], [17, 7], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [19, 7], [19, 8], [19, 9], [19, 10], [19, 11], [19, 12]]
  const newArr = new Array(20 * 20).fill(0)
  pointArr.forEach((a, index) => {
    newArr[a[0] * 20 + a[1]] = arr[adcArr[index] - 1]
  })

  return newArr
  // const footArr = [...adcArr].map((a) => arr[a - 1])
  // return footArr
}

export function frLine(arr) {
  let adcArr = [23, 7, 247, 231, 215, 199, 24, 8, 248, 232, 216, 200, 25, 9, 249, 233, 217, 201, 26, 10, 250, 234, 218, 202, 27, 11, 251, 235, 219, 203, 28, 12, 252, 236, 220, 204, 29, 13, 253, 237, 221, 205, 30, 14, 254, 238, 222, 206, 31, 15, 255, 239, 223, 207, 32, 16, 256, 240, 224, 208]
  const pointArr = [[1, 6], [1, 7], [1, 8], [1, 9], [1, 10], [1, 11], [3, 5], [3, 7], [3, 8], [3, 10], [3, 11], [3, 13], [5, 4], [5, 6], [5, 8], [5, 9], [5, 11], [5, 13], [7, 4], [7, 6], [7, 7], [7, 9], [7, 10], [7, 12], [9, 5], [9, 7], [9, 8], [9, 9], [9, 11], [9, 12], [11, 6], [11, 7], [11, 8], [11, 9], [11, 10], [11, 11], [13, 6], [13, 7], [13, 8], [13, 9], [13, 10], [13, 12], [15, 6], [15, 7], [15, 8], [15, 9], [15, 10], [15, 12], [17, 6], [17, 7], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [19, 7], [19, 8], [19, 9], [19, 10], [19, 11], [19, 12]]

  const newArr = new Array(20 * 20).fill(0)
  pointArr.forEach((a, index) => {
    newArr[a[0] * 20 + 19 - a[1]] = arr[adcArr[index] - 1]
  })
  return newArr
  // const footArr = [...adcArr].map((a) => arr[a - 1])
  // return footArr
}

export function hlLine(arr) {
  // let adcArr = [135, 136, 137, 151, 152, 152, 167, 168, 169, 183, 184, 185, 132, 133, 134, 148, 149, 150, 164, 165, 166, 180, 181, 182, 135, 136, 137, 151, 152, 153, 167, 168, 169, 183, 184, 185, 138, 139, 140, 154, 155, 156, 170, 171, 172, 186, 187, 188, 141, 142, 143, 157, 158, 159, 173, 174, 175, 189, 190, 191, 194, 197, 200, 203, 206, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]
  let adcArr = [31, 30, 29, 15, 14, 13, 255, 254, 253, 239, 238, 237, 28, 27, 26, 12, 11, 10, 252, 252, 250, 234, 235, 234, 25, 24, 23, 9, 8, 7, 247, 248, 249, 233, 232, 231, 22, 21, 20, 6, 5, 4, 246, 245, 244, 230, 229, 228, 19, 18, 17, 3, 2, 1, 243, 242, 241, 191, 190, 189, 222, 219, 216, 213, 210, 207, 206, 205, 204, 203, 202, 201, 200, 199, 198, 197, 196, 191, 190, 189, 188, 187, 186, 185, 184, 183, 182, 181, 180, 179, 178, 177, 175, 174, 173, 172, 171, 170, 169, 168, 167, 166, 165, 164, 163, 162, 161, 159, 158, 157, 156, 155, 154, 153, 152, 151, 150, 149, 148, 147, 146, 145, 143, 142, 141, 140, 139, 138, 137, 136, 135, 134, 133, 132, 131, 130, 129]
  const pointArr = [[4, 0], [4, 1], [4, 2], [5, 0], [5, 1], [5, 2], [6, 0], [6, 1], [6, 2], [7, 0], [7, 1], [7, 2], [2, 4], [2, 5], [2, 6], [3, 4], [3, 5], [3, 6], [4, 4], [4, 5], [4, 6], [5, 4], [5, 5], [5, 6], [1, 8], [1, 9], [1, 10], [2, 8], [2, 9], [2, 10], [3, 8], [3, 9], [3, 10], [4, 8], [4, 9], [4, 10], [3, 12], [3, 13], [3, 14], [4, 12], [4, 13], [4, 14], [5, 12], [5, 13], [5, 14], [6, 12], [6, 13], [6, 14], [11, 17], [11, 18], [11, 19], [12, 16], [12, 17], [12, 18], [13, 16], [13, 17], [13, 18], [14, 15], [14, 16], [14, 17], [9, 1], [8, 9], [8, 5], [8, 13], [15, 15], [11, 0], [11, 1], [11, 2], [11, 3], [11, 4], [11, 5], [11, 6], [11, 7], [11, 8], [11, 9], [11, 10], [11, 11], [13, 0], [13, 1], [13, 2], [13, 3], [13, 4], [13, 5], [13, 6], [13, 7], [13, 8], [13, 9], [13, 10], [13, 11], [13, 12], [13, 13], [13, 14], [14, 0], [14, 1], [14, 2], [14, 3], [14, 4], [14, 5], [14, 6], [14, 7], [14, 8], [14, 9], [14, 10], [14, 11], [14, 12], [14, 13], [14, 14], [15, 0], [15, 1], [15, 2], [15, 3], [15, 4], [15, 5], [15, 6], [15, 7], [15, 8], [15, 9], [15, 10], [15, 11], [15, 12], [15, 13], [15, 14], [16, 0], [16, 1], [16, 2], [16, 3], [16, 4], [16, 5], [16, 6], [16, 7], [16, 8], [16, 9], [16, 10], [16, 11], [16, 12], [16, 13], [16, 14]]
  const newArr = new Array(20 * 20).fill(0)
  pointArr.forEach((a, index) => {
    newArr[a[0] * 20 + a[1]] = arr[adcArr[index] - 1]
  })


  // const footArr = [...adcArr].map((a) => arr[a-1])
  // return footArr
  return newArr
}

export function hrLine(arr) {
  // let adcArr = [17, 18, 19, 1, 2, 3, 241, 242, 243, 189, 190, 191, 20, 21, 22, 4, 5, 6, 244, 245, 246, 228, 229, 230, 23, 24, 25, 7, 8, 9, 247, 248, 249, 231, 232, 233, 132, 133, 134, 148, 149, 150, 164, 165, 166, 180, 181, 182, 129, 130, 131, 145, 146, 147, 161, 162, 163, 177, 178, 179, 210, 229, 216, 219, 222, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207]
  let adcArr = [240, 239, 238, 256, 255, 254, 16, 15, 14, 32, 31, 30, 237, 236, 235, 253, 252, 251, 13, 12, 11, 29, 28, 27, 234, 233, 232, 250, 249, 248, 10, 9, 8, 26, 25, 24, 231, 230, 229, 247, 246, 245, 7, 6, 5, 23, 22, 21, 228, 227, 226, 244, 243, 242, 4, 3, 2, 20, 19, 18, 47, 44, 41, 38, 35, 61, 60, 59, 58, 57, 56, 55, 54, 53, 52, 51, 50, 80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82, 112, 111, 110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100, 99, 98, 128, 127, 126, 125, 124, 123, 122, 121, 120, 119, 118, 117, 116, 115, 114]
  const pointArr = [[4, 0], [4, 1], [4, 2], [5, 0], [5, 1], [5, 2], [6, 0], [6, 1], [6, 2], [7, 0], [7, 1], [7, 2], [2, 4], [2, 5], [2, 6], [3, 4], [3, 5], [3, 6], [4, 4], [4, 5], [4, 6], [5, 4], [5, 5], [5, 6], [1, 8], [1, 9], [1, 10], [2, 8], [2, 9], [2, 10], [3, 8], [3, 9], [3, 10], [4, 8], [4, 9], [4, 10], [3, 12], [3, 13], [3, 14], [4, 12], [4, 13], [4, 14], [5, 12], [5, 13], [5, 14], [6, 12], [6, 13], [6, 14], [11, 17], [11, 18], [11, 19], [12, 16], [12, 17], [12, 18], [13, 16], [13, 17], [13, 18], [14, 15], [14, 16], [14, 17], [9, 1], [8, 9], [8, 5], [8, 13], [15, 15], [11, 0], [11, 1], [11, 2], [11, 3], [11, 4], [11, 5], [11, 6], [11, 7], [11, 8], [11, 9], [11, 10], [11, 11], [13, 0], [13, 1], [13, 2], [13, 3], [13, 4], [13, 5], [13, 6], [13, 7], [13, 8], [13, 9], [13, 10], [13, 11], [13, 12], [13, 13], [13, 14], [14, 0], [14, 1], [14, 2], [14, 3], [14, 4], [14, 5], [14, 6], [14, 7], [14, 8], [14, 9], [14, 10], [14, 11], [14, 12], [14, 13], [14, 14], [15, 0], [15, 1], [15, 2], [15, 3], [15, 4], [15, 5], [15, 6], [15, 7], [15, 8], [15, 9], [15, 10], [15, 11], [15, 12], [15, 13], [15, 14], [16, 0], [16, 1], [16, 2], [16, 3], [16, 4], [16, 5], [16, 6], [16, 7], [16, 8], [16, 9], [16, 10], [16, 11], [16, 12], [16, 13], [16, 14]]
  const newArr = new Array(20 * 20).fill(0)
  pointArr.forEach((a, index) => {
    newArr[a[0] * 20 + 19 - a[1]] = arr[adcArr[index] - 1]
  })


  // const footArr = [...adcArr].map((a) => arr[a-1])
  // return footArr
  return newArr
}

export function chestLine(arr) {
  let adcArr = [144, 160, 176, 192, 208, 224, 240, 256, 16, 32, 48, 64, 80, 96, 112, 128, 143, 159, 175, 191, 207, 223, 239, 255, 15, 31, 47, 63, 79, 95, 111, 127, 142, 158, 174, 190, 206, 222, 238, 254, 14, 30, 46, 62, 78, 94, 110, 126, 141, 157, 173, 189, 205, 221, 237, 253, 13, 29, 45, 61, 77, 93, 109, 125, 140, 156, 172, 188, 204, 220, 236, 252, 12, 28, 44, 60, 76, 92, 108, 124, 139, 155, 171, 187, 203, 219, 235, 251, 11, 27, 43, 59, 75, 91, 107, 123, 138, 154, 170, 186, 202, 218, 234, 250, 10, 26, 42, 58, 74, 90, 106, 122, 137, 153, 169, 185, 201, 217, 233, 249, 9, 25, 41, 57, 73, 89, 105, 121, 129, 145, 161, 177, 193, 209, 225, 241, 1, 17, 33, 49, 65, 81, 97, 113, 130, 146, 162, 178, 194, 210, 226, 242, 2, 18, 34, 50, 66, 82, 98, 114, 131, 147, 163, 179, 195, 211, 227, 243, 3, 19, 35, 51, 67, 83, 99, 115, 132, 148, 164, 180, 196, 212, 228, 244, 4, 20, 36, 52, 68, 84, 100, 116, 133, 149, 165, 181, 197, 213, 229, 245, 5, 21, 37, 53, 69, 85, 101, 117, 134, 150, 166, 182, 198, 214, 230, 246, 6, 22, 38, 54, 70, 86, 102, 118, 135, 151, 167, 183, 199, 215, 231, 247, 7, 23, 39, 55, 71, 87, 103, 119, 136, 152, 168, 184, 200, 216, 232, 248, 8, 24, 40, 56, 72, 88, 104, 120]
  const footArr = [...adcArr].map((a) => arr[a - 1])
  return footArr
}


export const heatMapMax = 2000

const canvasWidth = 128, canvasHeight = 128

function addSide(arr, width, height, wnum, hnum, sideNum) {
  const narr = new Array(height);
  const res = [];
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

export function genWebglData(dataArr) {
  let heightIndex = 0, newArr = []
  for (let index = 0; index < dataArr.length; index++) {
    const data = dataArr[index]
    const { arr, height, width, order, interp1, interp2 } = data
    let resArr = arr
    resArr = addSide(
      resArr,

      width,
      height,
      order,
      order,
      1
    );
    const interpArr = lineInterp(resArr, width + order * 2, height + order * 2, interp1, interp2)

    let resData = interpArr

    let dataWidth = (width + 2 * order) * interp1, dataHeight = (height + 2 * order) * interp2, canvas = { width: canvasWidth, height: canvasHeight }

    for (let i = 0; i < dataHeight; i++) {
      for (let j = 0; j < dataWidth; j++) {
        newArr.push([j * (canvas.width / dataWidth), canvasHeight * ((index)) + i * (canvas.height / dataHeight), resData[i * dataWidth + j]])
      }

    }
  }
  return newArr
}

export function robot0401(arr) {
  const wsPointData = [...arr]
  const handYPosition = 1
  const bodyPointArr = [
    // [2, 14], [2, 17],
    // [4, 14], [4, 17],
    // [6, 14], [6, 17],
    // [8, 14], [8, 17],
    // [2, 16], [2, 19],
    // [4, 16], [4, 19],
    // [6, 16], [6, 19],
    // [8, 16], [8, 19],

    // [2, 13], [2, 19],
    // [4, 13], [4, 19],
    // [6, 13], [6, 19],
    // [8, 13], [8, 19],
    [2 + handYPosition, 15 + 1], [2 + handYPosition, 17 + 1],
    [4 + handYPosition, 15 + 1], [4 + handYPosition, 17 + 1],
    [6 + handYPosition, 15 + 1], [6 + handYPosition, 17 + 1],
    [8 + handYPosition, 15 + 1], [8 + handYPosition, 17 + 1],

    // [2, 24], [2, 27],
    // [4, 24], [4, 27],
    // [6, 24], [6, 27],
    // [8, 24], [8, 27],

    // [2, 24], [2, 30],
    // [4, 24], [4, 30],
    // [6, 24], [6, 30],
    // [8, 24], [8, 30],

    [2 + handYPosition, 26], [2 + handYPosition, 28],
    [4 + handYPosition, 26], [4 + handYPosition, 28],
    [6 + handYPosition, 26], [6 + handYPosition, 28],
    [8 + handYPosition, 26], [8 + handYPosition, 28],



    [11 + 1, 2],
    [12 + 1, 2],
    [13 + 1, 2],
    [14 + 1, 2],

    [11 + 1, 9],
    [12 + 1, 9],
    [13 + 1, 9],
    [14 + 1, 9],

    [17, 5], [17, 6], [17, 7], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12],
    [19, 5], [19, 6], [19, 7], [19, 8], [19, 9], [19, 10], [19, 11], [19, 12],
    [21, 5], [21, 6], [21, 7], [21, 8], [21, 9], [21, 10], [21, 11], [21, 12],
    [23, 5], [23, 6], [23, 7], [23, 8], [23, 9], [23, 10], [23, 11], [23, 12],
    [25, 5], [25, 6], [25, 7], [25, 8], [25, 9], [25, 10], [25, 11], [25, 12],
    [27, 5], [27, 6], [27, 7], [27, 8], [27, 9], [27, 10], [27, 11], [27, 12],

    // [17, 21], [17, 22], [17, 23], [17, 24], [17, 25], [17, 26], [17, 27], [17, 28],
    [19, 21], [19, 22], [19, 23], [19, 24], [19, 25], [19, 26], [19, 27], [19, 28],
    [21, 21], [21, 22], [21, 23], [21, 24], [21, 25], [21, 26], [21, 27], [21, 28],
    [23, 21], [23, 22], [23, 23], [23, 24], [23, 25], [23, 26], [23, 27], [23, 28],
    [25, 21], [25, 22], [25, 23], [25, 24], [25, 25], [25, 26], [25, 27], [25, 28],
    [27, 21], [27, 22], [27, 23], [27, 24], [27, 25], [27, 26], [27, 27], [27, 28],

  ]
  const bodyRealArr = []
  const newArr = new Array(1024).fill(0)
  // 左手
  for (let i = 4; i <= 7; i++) {
    for (let j = 15; j >= 14; j--) {
      bodyRealArr.push(wsPointData[i * 16 + j])
    }
  }
  // 右手
  for (let i = 11; i >= 8; i--) {
    // for (let i = 8; i <= 11; i++) {
    for (let j = 1; j >= 0; j--) {
      bodyRealArr.push(wsPointData[i * 16 + j])
    }
  }

  // 左肩
  for (let j = 15; j >= 12; j--) {
    // for (let j = 12; j <= 15; j++) {
    for (let i = 8; i < 9; i++) {
      bodyRealArr.push(wsPointData[j * 16 + i])
    }
  }
  // 右肩
  for (let j = 3; j >= 0; j--) {
    for (let i = 8; i < 9; i++) {
      bodyRealArr.push(wsPointData[j * 16 + i])
    }
  }
  // 前胸
  const chestXPoint = [3, 2, 1, 0, 15, 14, 13, 12].reverse()
  const chestYPoint = [2, 3, 4, 5, 6, 7]
  for (let i = 0; i < chestYPoint.length; i++) {
    for (let j = 0; j < chestXPoint.length; j++) {
      const iN = chestYPoint[i]
      const jN = chestXPoint[j]
      bodyRealArr.push(Math.floor(wsPointData[jN * 16 + iN] * 1.5))
    }
  }
  // 后背
  const backXPoint = [3, 2, 1, 0, 15, 14, 13, 12]
  const backYPoint = [9, 10, 11, 12, 13]

  for (let i = 0; i < backYPoint.length; i++) {
    for (let j = 0; j < backXPoint.length; j++) {
      const iN = backYPoint[i]
      const jN = backXPoint[j]
      bodyRealArr.push(wsPointData[jN * 16 + iN])
    }
  }


  
  bodyPointArr.forEach((a, index) => {
    const arrIndex = a[0] * 32 + a[1]
    newArr[arrIndex] = bodyRealArr[index]
  })

  const leftHandX = [13 + 1, 15 + 1, 17 + 1, 19 + 1]
  const rightHandX = [24, 26, 28, 30]
  const handY = [2 + handYPosition, 4 + handYPosition, 6 + handYPosition, 8 + handYPosition]

  const leftShoulderX = [2, 5]
  const rightShoulderX = [9, 12]
  const shoulderY = [11 + 1, 12 + 1, 13 + 1, 14 + 1]

  const chestX = [5, 6, 7, 8, 9, 10, 11, 12]
  const chestY = [17, 19, 21, 23, 25, 27]


  const backX = [21, 22, 23, 24, 25, 26, 27, 28]
  const backY = [19, 21, 23, 25, 27, 29]
  // const backY = []

  // 横向

  interpArr(newArr, leftHandX, handY, 32)
  interpArr(newArr, rightHandX, handY, 32)
  interpArr(newArr, leftShoulderX, shoulderY, 32, 2)
  interpArr(newArr, rightShoulderX, shoulderY, 32, 2)
  interpArr(newArr, chestX, chestY, 32)
  interpArr(newArr, backX, backY, 32)

  function interpArr(newArr, leftHandX, handY, arrXlength, prop) {
    // const arrXlength = 32
    for (let i = 0; i < handY.length; i++) {
      // 左手

      for (let j = 1; j < leftHandX.length; j++) {
        // const col = handY[i]
        const lastIndexX = leftHandX[j - 1]
        const curIndexX = leftHandX[j]
        const length = curIndexX - lastIndexX
        const lastIndexXValue = newArr[handY[i] * arrXlength + lastIndexX]
        const curIndexXValue = newArr[handY[i] * arrXlength + curIndexX]
        for (let k = 1; k < length; k++) {
          const Xindex = lastIndexX + k
          newArr[handY[i] * arrXlength + Xindex] = lastIndexXValue + (curIndexXValue - lastIndexXValue) * k / length
          if (prop) {
            newArr[handY[i] * arrXlength + Xindex] = lastIndexXValue
          }
        }
      }
    }

    for (let j = leftHandX[0]; j <= leftHandX[leftHandX.length - 1]; j++) {

      for (let i = 1; i < handY.length; i++) {
        const lastIndexY = handY[i - 1]
        const curIndexY = handY[i]
        const length = curIndexY - lastIndexY
        const lastIndexXValue = newArr[lastIndexY * arrXlength + j]
        const curIndexXValue = newArr[curIndexY * arrXlength + j]
        // console.log(lastIndexXValue, curIndexXValue, lastIndexY * arrXlength + j, curIndexY * arrXlength + j)
        for (let k = 1; k < length; k++) {
          const Yindex = lastIndexY + k
          newArr[Yindex * arrXlength + j] = lastIndexXValue + (curIndexXValue - lastIndexXValue) * k / length
          if (prop) {
            newArr[Yindex * arrXlength + j] = lastIndexXValue
          }
        }
      }
    }


  }


  // console.log(first)

 
  // const leftHand = []
  return newArr
}



export  function handSkinChange(res) {

  const handPointArr = [[6, 2], [6, 3], [6, 4], [3, 8], [3, 9], [3, 10], [3, 14], [3, 15], [3, 16], [3, 20], [3, 21], [3, 22], [10, 26], [10, 27], [10, 28], [7, 2], [7, 3], [7, 4], [4, 8], [4, 9], [4, 10], [4, 14], [4, 15], [4, 16], [4, 20], [4, 21], [4, 22], [11, 26], [11, 27], [11, 28], [8, 2], [8, 3], [8, 4], [5, 8], [5, 9], [5, 10], [5, 14], [5, 15], [5, 16], [5, 20], [5, 21], [5, 22], [12, 26], [12, 27], [12, 28], [9, 2], [9, 3], [9, 4], [6, 8], [6, 9], [6, 10], [6, 14], [6, 15], [6, 16], [6, 20], [6, 21], [6, 22], [13, 26], [13, 27], [13, 28], [13, 2], [13, 3], [13, 4], [13, 8], [13, 9], [13, 10], [13, 14], [13, 15], [13, 16], [13, 20], [13, 21], [13, 22], [17, 25], [17, 26], [17, 27], [17, 6], [17, 7], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17], [19, 6], [19, 7], [19, 8], [19, 9], [19, 10], [19, 11], [19, 12], [19, 13], [19, 14], [19, 15], [19, 16], [19, 17], [19, 18], [19, 19], [19, 20], [21, 6], [21, 7], [21, 8], [21, 9], [21, 10], [21, 11], [21, 12], [21, 13], [21, 14], [21, 15], [21, 16], [21, 17], [21, 18], [21, 19], [21, 20], [23, 6], [23, 7], [23, 8], [23, 9], [23, 10], [23, 11], [23, 12], [23, 13], [23, 14], [23, 15], [23, 16], [23, 17], [23, 18], [23, 19], [23, 20], [25, 6], [25, 7], [25, 8], [25, 9], [25, 10], [25, 11], [25, 12], [25, 13], [25, 14], [25, 15], [25, 16], [25, 17], [25, 18], [25, 19], [25, 20]]
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      for (let k = 0; k < 3; k++) {
        if (j == 0) {
          // handPointArr[i * 15 + j * 3 + k][0] = handPointArr[i * 15 + j * 3 + k][0] - 2
          // handPointArr[i * 15 + j * 3 + k][1] = handPointArr[i * 15 + j * 3 + k][1] - 2
        }
      }
    }
  }

  for (let i = 4 * 15; i < 5 * 15; i++) {
    res[i] = res[i] / 3
  }

  const res1 = []
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 15; j++) {
      res1.push(res[i * 15 + 14 - j])
    }
  }
  // for(let i = 75 ; i < 75 + 12 ; i ++){
  //   res.push(i*15 + 14 - j)
  // }
  for (let i = 75 + 12 - 1; i >= 75; i--) {
    res1.push(res[i])
  }

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 15; j++) {
      res1.push(res[75 + 12 + i * 15 + 14 - j])
    }
  }

  // const handPointArr = [[16,3],[16,4],[16,5],[3,14],[3,15],[3,16],[3,18],[3,19],[3,20],[3,22],[3,23],[3,24],[5,26],[5,27],[5,28],[17,3],[17,4],[17,5],[4,14],[4,15],[4,16],[4,18],[4,19],[4,20],[4,22],[4,23],[4,24],[6,26],[6,27],[6,28],[18,4],[18,5],[18,6],[5,14],[5,15],[5,16],[5,18],[5,19],[5,20],[5,22],[5,23],[5,24],[7,26],[7,27],[7,28],[19,4],[19,5],[19,6],[6,14],[6,15],[6,16],[6,18],[6,19],[6,20],[6,22],[6,23],[6,24],[8,26],[8,27],[8,28],[23,6],[23,7],[23,8],[12,14],[12,15],[12,16],[12,18],[12,19],[12,20],[12,22],[12,23],[12,24],[12,26],[12,27],[12,28],[20,16],[20,17],[20,18],[20,19],[20,20],[20,21],[20,22],[20,23],[20,24],[20,25],[20,26],[20,27],[22,13],[22,14],[22,15],[22,16],[22,17],[22,18],[22,19],[22,20],[22,21],[22,22],[22,23],[22,24],[22,25],[22,26],[22,27],[24,13],[24,14],[24,15],[24,16],[24,17],[24,18],[24,19],[24,20],[24,21],[24,22],[24,23],[24,24],[24,25],[24,26],[24,27],[26,13],[26,14],[26,15],[26,16],[26,17],[26,18],[26,19],[26,20],[26,21],[26,22],[26,23],[26,24],[26,25],[26,26],[26,27],[28,13],[28,14],[28,15],[28,16],[28,17],[28,18],[28,19],[28,20],[28,21],[28,22],[28,23],[28,24],[28,25],[28,26],[28,27],[30,13],[30,14],[30,15],[30,16],[30,17],[30,18],[30,19],[30,20],[30,21],[30,22],[30,23],[30,24],[30,25],[30,26],[30,27]]
  let newZeroArr = new Array(1024).fill(0)
  // for(let i = 0 ; i < )
  handPointArr.forEach((a, index) => {
    newZeroArr[(31 - a[0]) * 32 + a[1]] = res1[index]
    if (index >= 75) {
      newZeroArr[(31 - (a[0] + 1)) * 32 + a[1]] = res1[index]
      // newZeroArr[(31 - (a[0] + 1) - 1) * 32 + a[1]] = res[index]
    }
    // newZeroArr[(a[0] + 1) * 32 + a[1]] = handArr[index]
    // newZeroArr[(a[0] + 2) * 32 + a[1]] = handArr[index]
  })

  // newZeroArr = rotate90(newZeroArr, 32, 32)
  // console.log(newZeroArr)



    
    // return res1

  return newZeroArr
}


//  export function robot0401(arr) {
//     const wsPointData = [...arr]
//     const handYPosition = 1
//     const bodyPointArr = [
//       // [2, 14], [2, 17],
//       // [4, 14], [4, 17],
//       // [6, 14], [6, 17],
//       // [8, 14], [8, 17],
//       // [2, 16], [2, 19],
//       // [4, 16], [4, 19],
//       // [6, 16], [6, 19],
//       // [8, 16], [8, 19],

//       // [2, 13], [2, 19],
//       // [4, 13], [4, 19],
//       // [6, 13], [6, 19],
//       // [8, 13], [8, 19],
//       [2 + handYPosition, 15 + 1], [2 + handYPosition, 17 + 1],
//       [4 + handYPosition, 15 + 1], [4 + handYPosition, 17 + 1],
//       [6 + handYPosition, 15 + 1], [6 + handYPosition, 17 + 1],
//       [8 + handYPosition, 15 + 1], [8 + handYPosition, 17 + 1],

//       // [2, 24], [2, 27],
//       // [4, 24], [4, 27],
//       // [6, 24], [6, 27],
//       // [8, 24], [8, 27],

//       // [2, 24], [2, 30],
//       // [4, 24], [4, 30],
//       // [6, 24], [6, 30],
//       // [8, 24], [8, 30],

//       [2 + handYPosition, 26], [2 + handYPosition, 28],
//       [4 + handYPosition, 26], [4 + handYPosition, 28],
//       [6 + handYPosition, 26], [6 + handYPosition, 28],
//       [8 + handYPosition, 26], [8 + handYPosition, 28],



//       [11 + 1, 2],
//       [12 + 1, 2],
//       [13 + 1, 2],
//       [14 + 1, 2],

//       [11 + 1, 9],
//       [12 + 1, 9],
//       [13 + 1, 9],
//       [14 + 1, 9],

//       [17, 5], [17, 6], [17, 7], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12],
//       [19, 5], [19, 6], [19, 7], [19, 8], [19, 9], [19, 10], [19, 11], [19, 12],
//       [21, 5], [21, 6], [21, 7], [21, 8], [21, 9], [21, 10], [21, 11], [21, 12],
//       [23, 5], [23, 6], [23, 7], [23, 8], [23, 9], [23, 10], [23, 11], [23, 12],
//       [25, 5], [25, 6], [25, 7], [25, 8], [25, 9], [25, 10], [25, 11], [25, 12],
//       [27, 5], [27, 6], [27, 7], [27, 8], [27, 9], [27, 10], [27, 11], [27, 12],

//       // [17, 21], [17, 22], [17, 23], [17, 24], [17, 25], [17, 26], [17, 27], [17, 28],
//       [19, 21], [19, 22], [19, 23], [19, 24], [19, 25], [19, 26], [19, 27], [19, 28],
//       [21, 21], [21, 22], [21, 23], [21, 24], [21, 25], [21, 26], [21, 27], [21, 28],
//       [23, 21], [23, 22], [23, 23], [23, 24], [23, 25], [23, 26], [23, 27], [23, 28],
//       [25, 21], [25, 22], [25, 23], [25, 24], [25, 25], [25, 26], [25, 27], [25, 28],
//       [27, 21], [27, 22], [27, 23], [27, 24], [27, 25], [27, 26], [27, 27], [27, 28],

//     ]
//     const bodyRealArr = []
//     const newArr = new Array(1024).fill(0)
//     // 左手
//     for (let i = 4; i <= 7; i++) {
//       for (let j = 15; j >= 14; j--) {
//         bodyRealArr.push(wsPointData[i * 16 + j])
//       }
//     }
//     // 右手
//     for (let i = 11; i >= 8; i--) {
//       // for (let i = 8; i <= 11; i++) {
//       for (let j = 1; j >= 0; j--) {
//         bodyRealArr.push(wsPointData[i * 16 + j])
//       }
//     }

//     // 左肩
//     for (let j = 15; j >= 12; j--) {
//       // for (let j = 12; j <= 15; j++) {
//       for (let i = 8; i < 9; i++) {
//         bodyRealArr.push(wsPointData[j * 16 + i])
//       }
//     }
//     // 右肩
//     for (let j = 3; j >= 0; j--) {
//       for (let i = 8; i < 9; i++) {
//         bodyRealArr.push(wsPointData[j * 16 + i])
//       }
//     }
//     // 前胸
//     const chestXPoint = [3, 2, 1, 0, 15, 14, 13, 12].reverse()
//     const chestYPoint = [2, 3, 4, 5, 6, 7]
//     for (let i = 0; i < chestYPoint.length; i++) {
//       for (let j = 0; j < chestXPoint.length; j++) {
//         const iN = chestYPoint[i]
//         const jN = chestXPoint[j]
//         bodyRealArr.push(Math.floor(wsPointData[jN * 16 + iN] * 1.5))
//       }
//     }
//     // 后背
//     const backXPoint = [3, 2, 1, 0, 15, 14, 13, 12]
//     const backYPoint = [9, 10, 11, 12, 13]

//     for (let i = 0; i < backYPoint.length; i++) {
//       for (let j = 0; j < backXPoint.length; j++) {
//         const iN = backYPoint[i]
//         const jN = backXPoint[j]
//         bodyRealArr.push(wsPointData[jN * 16 + iN])
//       }
//     }


//     console.log(bodyRealArr.length, bodyPointArr.length)
//     bodyPointArr.forEach((a, index) => {
//       const arrIndex = a[0] * 32 + a[1]
//       newArr[arrIndex] = bodyRealArr[index]
//     })

//     const leftHandX = [13 + 1, 15 + 1, 17 + 1, 19 + 1]
//     const rightHandX = [24, 26, 28, 30]
//     const handY = [2 + handYPosition, 4 + handYPosition, 6 + handYPosition, 8 + handYPosition]

//     const leftShoulderX = [2, 5]
//     const rightShoulderX = [9, 12]
//     const shoulderY = [11 + 1, 12 + 1, 13 + 1, 14 + 1]

//     const chestX = [5, 6, 7, 8, 9, 10, 11, 12]
//     const chestY = [17, 19, 21, 23, 25, 27]


//     const backX = [21, 22, 23, 24, 25, 26, 27, 28]
//     const backY = [19, 21, 23, 25, 27, 29]
//     // const backY = []

//     // 横向

//     interpArr(newArr, leftHandX, handY, 32)
//     interpArr(newArr, rightHandX, handY, 32)
//     interpArr(newArr, leftShoulderX, shoulderY, 32, 2)
//     interpArr(newArr, rightShoulderX, shoulderY, 32, 2)
//     interpArr(newArr, chestX, chestY, 32)
//     interpArr(newArr, backX, backY, 32)

//     function interpArr(newArr, leftHandX, handY, arrXlength, prop) {
//       // const arrXlength = 32
//       for (let i = 0; i < handY.length; i++) {
//         // 左手

//         for (let j = 1; j < leftHandX.length; j++) {
//           // const col = handY[i]
//           const lastIndexX = leftHandX[j - 1]
//           const curIndexX = leftHandX[j]
//           const length = curIndexX - lastIndexX
//           const lastIndexXValue = newArr[handY[i] * arrXlength + lastIndexX]
//           const curIndexXValue = newArr[handY[i] * arrXlength + curIndexX]
//           for (let k = 1; k < length; k++) {
//             const Xindex = lastIndexX + k
//             newArr[handY[i] * arrXlength + Xindex] = lastIndexXValue + (curIndexXValue - lastIndexXValue) * k / length
//             if (prop) {
//               newArr[handY[i] * arrXlength + Xindex] = lastIndexXValue
//             }
//           }
//         }
//       }

//       for (let j = leftHandX[0]; j <= leftHandX[leftHandX.length - 1]; j++) {

//         for (let i = 1; i < handY.length; i++) {
//           const lastIndexY = handY[i - 1]
//           const curIndexY = handY[i]
//           const length = curIndexY - lastIndexY
//           const lastIndexXValue = newArr[lastIndexY * arrXlength + j]
//           const curIndexXValue = newArr[curIndexY * arrXlength + j]
//           // console.log(lastIndexXValue, curIndexXValue, lastIndexY * arrXlength + j, curIndexY * arrXlength + j)
//           for (let k = 1; k < length; k++) {
//             const Yindex = lastIndexY + k
//             newArr[Yindex * arrXlength + j] = lastIndexXValue + (curIndexXValue - lastIndexXValue) * k / length
//             if (prop) {
//               newArr[Yindex * arrXlength + j] = lastIndexXValue
//             }
//           }
//         }
//       }


//     }


//     // console.log(first)

//     console.log(arr.every((a) => a == 0), newArr.every((a) => a == 0), bodyRealArr.every((a) => a == 0))
//     // const leftHand = []
//     return newArr
//   }