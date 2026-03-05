/**
 *
 * @param {*} arr 32*32
 * @returns 10*10
 */
import { rainbowTextColors, rainbowTextColorsxy } from "./color";
import { garyColors, rainbowBackColors, rainbowColors } from "./value";

export function findArr(arr) {
  let ndata = [];
  for (let i = 0; i < 32; i++) {
    for (let j = 0; j < 32; j++) {
      if (i < 10 && j > 21) {
        ndata.push(arr[i * 32 + j]);
      }
    }
  }
  return ndata;
}

export function find1016Arr(arr) {
  let ndata = [];
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 10; j++) {
      ndata.push(arr[i * 32 + j]);
    }
  }

  for (let i = 8; i < 12; i++) {
    for (let j = 0; j < 10; j++) {
      [ndata[i * 10 + j], ndata[(15 - i + 8) * 10 + j]] = [
        ndata[(15 - i + 8) * 10 + j],
        ndata[i * 10 + j],
      ];
    }
  }
  return ndata;
}

export function find1012BackArr(arr) {
  let ndata = [];
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 10; j++) {
      ndata.push(arr[i * 32 + j]);
    }
  }

  for (let i = 8; i < 12; i++) {
    for (let j = 0; j < 10; j++) {
      [ndata[i * 10 + j], ndata[(15 - i + 8) * 10 + j]] = [
        ndata[(15 - i + 8) * 10 + j],
        ndata[i * 10 + j],
      ];
    }
  }

  ndata = ndata.splice(40, 160);
  return ndata;
}

export function newFindArr(arr) {
  let ndata = [];
  for (let i = 0; i < 32; i++) {
    for (let j = 0; j < 32; j++) {
      if (j < 10 && i > 21) {
        ndata.push(arr[i * 32 + j]);
      }
    }
  }
  return ndata;
}

export function rotate(arr, height, width) {
  let matrix = [];
  for (let i = 0; i < height; i++) {
    matrix[i] = [];
    for (let j = 0; j < width; j++) {
      matrix[i].push(arr[i * width + j]);
    }
  }
  // let n = matrix.length;
  // let res = new Array(n).fill(0).map(() => new Array(n).fill(0));
  // for (let i = 0; i < n; i++)
  //   for (let j = n - 1; j >= 0; j--) res[i][n - j - 1] = matrix[j][i];

  var temp = [];
  var len = matrix.length;
  for (var i = 0; i < len; i++) {
    for (var j = 0; j < len; j++) {
      var k = len - 1 - j;
      if (!temp[k]) {
        temp[k] = [];
      }
      temp[k][i] = matrix[i][j];
    }
  }

  let resArr = [];
  for (let i = 0; i < temp.length; i++) {
    resArr = resArr.concat(temp[i]);
  }
  return resArr;
}

export function newBackLinearOrder(ndata) {
  for (let i = 0; i < 10; i++) {
    for (let j = 5; j < 7; j++) {
      [ndata[i * 10 + j], ndata[i * 10 + 9 + 5 - j]] = [
        ndata[i * 10 + 9 + 5 - j],
        ndata[i * 10 + j],
      ];
    }
  }
}

export function newSitLinearOrder(ndata) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 10; j++) {
      [ndata[i * 10 + j], ndata[(4 - i) * 10 + j]] = [
        ndata[(4 - i) * 10 + j],
        ndata[i * 10 + j],
      ];
    }
  }
}

export function rotate180(arr, height, width) {
  let matrix = [];
  for (let i = 0; i < height; i++) {
    matrix[i] = [];
    for (let j = 0; j < width; j++) {
      matrix[i].push(arr[i * width + j]);
    }
  }
  //逆时针旋转 180 度
  //行 = h - 1 - 行(i);  h表示总行数
  //列 = n - 1 - 列(j);  n表示总列数
  var temp = [];
  var len = matrix.length;
  for (var i = 0; i < len; i++) {
    for (var j = 0; j < len; j++) {
      var k = len - 1 - i;
      if (!temp[k]) {
        temp[k] = [];
      }
      temp[k][len - 1 - j] = matrix[i][j];
    }
  }
  let resArr = [];
  for (let i = 0; i < temp.length; i++) {
    resArr = resArr.concat(temp[i]);
  }
  return resArr;
}

export function backLinearOrder(ndata) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 10; j++) {
      [ndata[i * 10 + j], ndata[(4 - i) * 10 + j]] = [
        ndata[(4 - i) * 10 + j],
        ndata[i * 10 + j],
      ];
    }
  }

  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 10; j++) {
      [ndata[i * 10 + j], ndata[(i + 5) * 10 + j]] = [
        ndata[(i + 5) * 10 + j],
        ndata[i * 10 + j],
      ];
    }
  }
}



/**
 * 正方形插值
 * @param {} smallMat 
 * @param {*} bigMat 
 * @param {*} Length 
 * @param {*} num 
 */
export function interp(smallMat, bigMat, Length, num) {
  for (let x = 1; x <= Length; x++) {
    for (let y = 1; y <= Length; y++) {
      bigMat[
        Length * num * (num * (y - 1)) +
        (Length * num * num) / 2 +
        num * (x - 1) +
        num / 2
      ] = smallMat[Length * (y - 1) + x - 1] * 10;
    }
  }
}


/**
 * 正方形插值
 * @param {} smallMat 
 * @param {*} bigMat 
 * @param {*} Length 
 * @param {*} num 
 */
export function interpSquare(smallMat, Length, num) {
  const res = new Array(Length * num * Length * num).fill(1);

  for (let x = 1; x <= Length; x++) {
    for (let y = 1; y <= Length; y++) {
      res[
        Length * num * (num * (y - 1)) +
        (Length * num * num) / 2 +
        num * (x - 1) +
        num / 2
      ] = smallMat[Length * (y - 1) + x - 1] * 10;
    }
  }

  return res
}


/**
 * 矩形插值
 * @param {*} smallMat 
 * @param {*} width 
 * @param {*} height 
 * @param {*} interp1 
 * @param {*} interp2 
 * @returns 
 */
// height , width , heightInterp , widthInterp
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


// export function interpSmall100(smallMat, width, height, interp1, interp2) {

//   const bigMat = new Array((width * interp1) * (height * interp2)).fill(0)
//     for (let i = 0; i < height; i++) {
//       for (let j = 0; j < width; j++) {
//           const realValue = smallMat[i * width + j]
//           const rowValue = smallMat[i * width + j + 1] ? smallMat[i * width + j + 1] : 0
//           const colValue = smallMat[(i + 1) * width + j] ? smallMat[(i + 1) * width + j] : 0
//           bigMat[(width * interp1) * i * interp2 + (j * interp1)
//           ] = smallMat[i * width + j]*10
//           // for (let k = 0; k < interp1; k++) {
//           //   // for (let z = 0; z < interp2; z++) {
//           //   //   bigMat[(width * interp1) * (i * interp2 + k) + ((j * interp1) + z)
//           //   //   ] = smallMat[i * width + j] * 10
//           //   // }
//           // }

//           // for (let k = 0; k < interp2; k++) {
//           //   bigMat[(width * interp1) * (i * interp2 + k) + ((j * interp1))] = realValue + (colValue - realValue) * (k) / interp2
//           // }
//           for (let k = 0; k < interp1; k++) {
//               bigMat[(width * interp1) * (i * interp2) + ((j * interp1 + k))] = realValue + (rowValue - realValue) * (k) / interp1*10
//           }
//       }
//   }

//   // const newWidth = width * interp1

//   // for (let i = 0; i < height; i++) {
//   //     for (let j = 0; j < newWidth; j++) {
//   //         const realValue = bigMat[i * interp2 * newWidth + j]
//   //         // const rowValue = bigMat[i * width + j + 1] * 10 ? bigMat[i * width + j + 1] * 10 : 0
//   //         // const colValue = bigMat[(i + 1) * width + j] * 10 ? bigMat[(i + 1) * width + j] * 10 : 0
//   //         const colValue = bigMat[((i + 1) * interp2) * newWidth + j] //? bigMat[(((i + 1) * interp2) + 1) * newWidth + j] : 0
//   //         for (let k = 0; k < interp2; k++) {
//   //             bigMat[newWidth * (i * interp2 + k) + ((j))] = realValue + (colValue - realValue) * (k) / interp2
//   //         }
//   //     }
//   // }
//   return bigMat
// }

export function interp1016(smallMat, bigMat, height, width, num) {
  for (let x = 1; x <= height; x++) {
    for (let y = 1; y <= width; y++) {
      bigMat[
        width * num * (num * (x - 1)) +
        (width * num) * Math.floor(num / 2) +
        num * (y - 1) +
        Math.floor(num / 2)
      ] = smallMat[height * (y - 1) + x - 1] * 10;
    }
  }
}

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

export function addSide1(arr, width, height, wnum, hnum, sideNum) {
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

/**
 * 高斯return
 * @param {*} scl 
 * @param {*} tcl 
 * @param {*} w 
 * @param {*} h 
 * @param {*} r 
 */
export function gaussBlur_return(scl, w, h, r) {
  const res = new Array(scl.length).fill(1)
  var rs = Math.ceil(r * 2.57); // significant radius
  for (var i = 0; i < h; i++) {
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
      res[i * w + j] = Math.round(val / wsum);
    }
  }
  return res
}

// export function jet(min, max, x) {
//   let red, g, blue;
//   let dv;
//   red = 1.0;
//   g = 1.0;
//   blue = 1.0;
//   if (x < min) {
//     x = min;
//   }
//   if (x > max) {
//     x = max;
//   }
//   dv = max - min;
//   if (x < min + 0.25 * dv) {
//     red = 0;
//     g = 0;
//     blue = 0.8;

//     // red = 0;
//     // g = 4 * (x - min) / dv;
//   } else if (x < min + 0.5 * dv) {
//     red = 0;
//     g = 0 - (3.2 * (min + 0.25 * dv - x)) / dv;
//     blue = 0.8 + (1.8 * (min + 0.25 * dv - x)) / dv;
//   } else if (x < min + 0.75 * dv) {
//     // red = 4 * (x - min - 0.5 * dv) / dv;
//     // blue = 0;
//     red = (4 * (x - min - 0.5 * dv)) / dv;
//     blue = 0.32 - (1.28 * (x - min - 0.5 * dv)) / dv;
//     g = 0.8 - (0.4 * (x - min - 0.5 * dv)) / dv;
//   } else {
//     g = 1 + (4 * (min + 0.75 * dv - x)) / dv;
//     blue = 0;
//   }
//   var rgb = new Array();
//   rgb[0] = parseInt(255 * red + "");
//   rgb[1] = parseInt(255 * g + "");
//   rgb[2] = parseInt(255 * blue + "");
//   return rgb;
// }

/**
 * 最初版本
 * @param {*} min 
 * @param {*} max 
 * @param {*} x 
 * @returns 
 */
export function jet(min, max, x) {
  let red, g, blue;
  let dv;
  red = 1.0;
  g = 1.0;
  blue = 1.0;
  if (x < min) {
    x = min;
  }
  if (x > max) {
    x = max;
  }
  dv = max - min;
  if (x < min + 0.25 * dv) {
    // red = 0;
    // g = 0;
    // blue = 0;

    red = 0;
    g = (4 * (x - min)) / dv;
  } else if (x < min + 0.5 * dv) {
    red = 0;
    blue = 1 + (4 * (min + 0.25 * dv - x)) / dv;
  } else if (x < min + 0.75 * dv) {
    red = (4 * (x - min - 0.5 * dv)) / dv;
    blue = 0;
  } else {
    g = 1 + (4 * (min + 0.75 * dv - x)) / dv;
    blue = 0;
  }
  var rgb = new Array();
  rgb[0] = parseInt(255 * red + '');
  rgb[1] = parseInt(255 * g + '');
  rgb[2] = parseInt(255 * blue + '');
  return rgb;
}

export function jetRgb(min, max, x) {
  let red, g, blue;
  let dv;
  red = 1.0;
  g = 1.0;
  blue = 1.0;
  if (x < min) {
    x = min;
  }
  if (x > max) {
    x = max;
  }
  dv = max - min;
  if (x < min + 0.25 * dv) {
    // red = 0;
    // g = 0;
    // blue = 0;

    red = 0;
    g = (4 * (x - min)) / dv;
  } else if (x < min + 0.5 * dv) {
    red = 0;
    blue = 1 + (4 * (min + 0.25 * dv - x)) / dv;
  } else if (x < min + 0.75 * dv) {
    red = (4 * (x - min - 0.5 * dv)) / dv;
    blue = 0;
  } else {
    g = 1 + (4 * (min + 0.75 * dv - x)) / dv;
    blue = 0;
  }

  return { r: red, g: g, b: blue };
}

export function jetWhite(min, max, x) {
  // #4800f9  72,0,249  #1c41f9  28,65,249  #1cf993 28,249,147  #cdf91c  205,249,28
  //#1c74f9 #1cd0f9

  let red, g, blue;
  let dv;
  red = 1.0;
  g = 1.0;
  blue = 1.0;
  if (x < min) {
    x = min;
  }
  if (x > max) {
    x = max;
  }
  dv = max - min;
  if (x < min + 0.01 * dv) {
    red = 1;
    g = 1;
    blue = 1;

    // red = 0;
    // g = 4 * (x - min) / dv;
  } else if (x < min + 0.3 * dv) {
    // red = 0;
    // g = 0 - (3.2 * (min + 0.25 * dv - x)) / dv;
    // blue = 0.8 + (1.8 * (min + 0.25 * dv - x)) / dv;
    // red  = 213/255
    // g = 242 /255
    // blue = 222 / 255
    red = 1 + (((3.3 * 245) / 255) * (min + 0.01 * dv - x)) / dv; //  10
    g = 1 + (((3.3 * 20) / 255) * (min + 0.01 * dv - x)) / dv; // 235
    blue = 1 + (((3.3 * 20) / 255) * (min + 0.01 * dv - x)) / dv; // 235
  } else if (x < min + 0.8 * dv) {
    //x= 50   red = 0  blue = 0.32 g = 0.8
    // red = 4 * (x - min - 0.5 * dv) / dv;
    // blue = 0;
    red = 1 - (2 * (x - min - 0.3 * dv)) / dv; //(4 * (x - min - 0.5 * dv)) / dv;               // 0.3*4
    blue = 1 - (2 * (x - min - 0.3 * dv)) / dv; //0.32 - (1.28 * (x - min - 0.5 * dv)) / dv;    //0.32- 0.3*1.28
    g = 1 - (2 * (x - min - 0.3 * dv)) / dv; //0.8 - (0.4 * (x - min - 0.5 * dv)) / dv;         //0.8 - 0.3*0.4
  } else {
    g = 1 + (4 * (min + 0.8 * dv - x)) / dv;
    blue = 0;
  }
  var rgb = new Array();
  rgb[0] = parseInt(255 * red + "");
  rgb[1] = parseInt(255 * g + "");
  rgb[2] = parseInt(255 * blue + "");
  return rgb;
}

export function jetWhite1(min, max, x) {
  // #4800f9  72,0,249  #1c41f9  28,65,249  #1cf993 28,249,147  #cdf91c  205,249,28
  //#1c74f9 #1cd0f9
  let value = [255, 255, 255];
  let value1 = [0, 69, 223];
  let value2 = [28, 65, 249];
  let value3 = [28, 249, 147];
  let value4 = [205, 249, 28];
  let red, g, blue;
  let dv;
  red = value[0];
  g = value[1];
  blue = value[2];
  if (x < min) {
    x = min;
  }
  if (x > max) {
    x = max;
  }
  dv = max - min;
  if (x < min + 0.01 * dv) {
    red = value[0];
    g = value[1];
    blue = value[2];

    // red = 0;
    // g = 4 * (x - min) / dv;
  } else if (x < min + 0.3 * dv) {
    // if(value1[0] > value[0]){
    red =
      value[0] + (3.3 * (value1[0] - value[0]) * (x - min + 0.01 * dv)) / dv; //  10
    // }else{
    //   red = value[0] - (((3.3 * (value1[0] - value[0])) ) * (x - min + 0.01 * dv)) / dv; //  10
    // }

    // if(value1[1] > value[1]){
    g = value[1] + (3.3 * (value1[1] - value[1]) * (x - min + 0.01 * dv)) / dv; //  10
    // }else{
    //   g = value[1] - (((3.3 * (value1[1] - value[1])) ) * (x - min + 0.01 * dv)) / dv; //  10
    // }
    // = 0 - (((3.3 * 65) ) * (x - min + 0.01 * dv)) / dv;    // 235

    // if(value1[2] > value[2]){
    blue =
      value[2] + (3.3 * (value1[2] - value[2]) * (x - min + 0.01 * dv)) / dv; //  10
    // }else{
    //   blue = value[2] - (((3.3 * (value1[2] - value[2])) ) * (x - min + 0.01 * dv)) / dv; //  10
    // }
  } else if (x < min + 0.8 * dv) {
    // if(value2[0] > value1[0]){
    red =
      value1[0] + (3.3 * (value2[0] - value1[0]) * (x - min + 0.01 * dv)) / dv; //  10
    // }else{
    //   red = value1[0] - (((3.3 * (value2[0] - value1[0])) ) * (x - min + 0.01 * dv)) / dv; //  10
    // }

    // if(value2[1] > value1[1]){
    g =
      value1[1] + (3.3 * (value2[1] - value1[1]) * (x - min + 0.01 * dv)) / dv; //  10
    // }else{
    //   g = value1[1] - (((3.3 * (value2[1] - value1[1])) ) * (x - min + 0.01 * dv)) / dv; //  10
    // }
    // = 0 - (((3.3 * 65) ) * (x - min + 0.01 * dv)) / dv;    // 235

    // if(value2[2] > value1[2]){
    blue =
      value1[2] + (3.3 * (value2[2] - value1[2]) * (x - min + 0.01 * dv)) / dv; //  10
    // }else{
    //   blue = value1[2] - (((3.3 * (value2[2] - value1[2])) ) * (x - min + 0.01 * dv)) / dv; //  10
    // }
  } else {
    // if(value3[0] > value2[0]){
    red =
      value2[0] + (3.3 * (value3[0] - value2[0]) * (x - min + 0.01 * dv)) / dv; //  10
    // }else{
    //   red = value2[0] - (((3.3 * (value3[0] - value2[0])) ) * (x - min + 0.01 * dv)) / dv; //  10
    // }

    // if(value3[1] > value2[1]){
    g =
      value2[1] + (3.3 * (value3[1] - value2[1]) * (x - min + 0.01 * dv)) / dv; //  10
    // }else{
    //   g = value2[1] - (((3.3 * (value3[1] - value2[1])) ) * (x - min + 0.01 * dv)) / dv; //  10
    // }

    // if(value3[2] > value2[2]){
    blue =
      value2[2] + (3.3 * (value3[2] - value2[2]) * (x - min + 0.01 * dv)) / dv; //  10
    // }else{
    //   blue = value2[2] - (((3.3 * (value3[2] - value2[2])) ) * (x - min + 0.01 * dv)) / dv; //  10
    // }
  }
  var rgb = new Array();
  rgb[0] = parseInt(red + "");
  rgb[1] = parseInt(g + "");
  rgb[2] = parseInt(blue + "");
  return rgb;
}

export function jetWhite2(min, max, x) {
  if (!x) {
    return rainbowColors[rainbowColors.length - 1]
  }
  const length = rainbowColors.length;
  const count = (max - min) / length;
  const num = Math.floor(x / count) >= length - 1 ? length - 1 : Math.floor(x / count) < 0 ? 0 : Math.floor(x / count);
  // console.log(length,count,x  , num,Math.floor(x / count))
  return rainbowColors[length - 1 - num];
}

export function jetWhite3(min, max, x) {
  if (!x) {
    return rainbowTextColorsxy[rainbowTextColorsxy.length - 1]
  }
  const length = rainbowTextColorsxy.length;
  const count = (max - min) * 2 / length;
  const num = Math.floor(x / count) >= length - 1 ? length - 1 : Math.floor(x / count) < 0 ? 0 : Math.floor(x / count);
  // console.log(length,count,x  , num,Math.floor(x / count))
  return rainbowTextColorsxy[length - 1 - num];
}

export function jetWhite4(min, max, x) {
  if (!x) {
    return rainbowTextColorsxy[rainbowTextColorsxy.length - 1]
  }
  const length = rainbowTextColorsxy.length;
  const count = (max - min) * 2 / length;
  const num = Math.floor(x / count) >= length - 1 ? length - 1 : Math.floor(x / count) < 0 ? 0 : Math.floor(x / count);
  // console.log(length,count,x  , num,Math.floor(x / count))
  return rainbowTextColorsxy[length - 1 - num];
}

export function jetgGrey(min, max, x) {
  if (!x) {
    return garyColors[garyColors.length - 1]
  }
  const length = garyColors.length;
  const count = (max - min) / length;
  const num = Math.floor(x / count) >= length - 1 ? length - 1 : Math.floor(x / count) < 0 ? 0 : Math.floor(x / count);
  // console.log(length,count,x  , num,Math.floor(x / count))
  return garyColors[length - 1 - num];
}

export function jetWhite2Back(min, max, x) {
  // let rainbowColors = [
  //   // "#FF0000", // 红
  //   // "#FF3300",
  //   // "#FF6600",
  //   // "#FF9900",
  //   // "#FFCC00",
  //   "#FFFF00", // 黄
  //   "#CCFF00",
  //   "#99FF00",
  //   "#66FF00",
  //   "#33FF00",
  //   "#00FF00", // 绿
  //   "#00FF33",
  //   "#00FF66",
  //   "#00FF99",
  //   "#00FFCC",
  //   "#00FFFF", // 蓝
  //   "#00CCFF",
  //   "#0099FF",
  //   "#0066FF",
  //   ...new Array(2).fill("#0066FF"),
  //   ...new Array(3).fill("#ffffff"),
  //   // "#0033FF",
  //   '#ffffff'
  //   // "#0000FF", // 靛
  //   // "#3300FF",
  //   // "#6600FF",
  //   // "#9900FF",
  //   // "#CC00FF",
  //   // "#FF00FF", // 紫
  //   // "#FF33FF",
  //   // "#FF66FF",
  //   // "#FF99FF",
  //   // "#FFCCFF"
  // ];

  // let rainbowColors = [
  //   [255, 255, 0],
  //   [204, 255, 0],
  //   [153, 255, 0],
  //   [102, 255, 0],
  //   [51, 255, 0],
  //   [0, 255, 0],
  //   [0, 255, 51],
  //   [0, 255, 102],
  //   [0, 255, 153],
  //   [0, 255, 204],
  //   // [0, 255, 255],
  //   // [0, 204, 255],
  //   // [0, 153, 255],
  //   // ...new Array(5).fill([0, 102, 255]),
  //   ...new Array(5).fill([0, 255, 255]),
  //   ...new Array(5).fill([0, 204, 255]),
  //   ...new Array(5).fill([0, 153, 255]),
  //   ...new Array(10).fill([0, 102, 255]),
  //   [255, 255, 255],
  //   [255, 255, 255],
  //   ...new Array(5).fill([255, 255, 255]),
  // ];
  // rainbowColors = rainbowColors.map((a) => JSON.parse(colorRgb(a)) )
  // console.log(rainbowColors)
  const length = rainbowBackColors.length;
  const count = (max - min) / length;
  const num = Math.floor(x / count) >= length - 1 ? length - 1 : Math.floor(x / count) < 0 ? 0 : Math.floor(x / count);
  // console.log(length,count,x  , num,Math.floor(x / count))
  return rainbowBackColors[length - 1 - num];
}

var colorRgb = function (sColor) {
  sColor = sColor.toLowerCase();
  //十六进制颜色值的正则表达式
  var reg = /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/;
  // 如果是16进制颜色
  if (sColor && reg.test(sColor)) {
    if (sColor.length === 4) {
      var sColorNew = "#";
      for (var i = 1; i < 4; i += 1) {
        sColorNew += sColor.slice(i, i + 1).concat(sColor.slice(i, i + 1));
      }
      sColor = sColorNew;
    }
    //处理六位的颜色值
    var sColorChange = [];
    for (var i = 1; i < 7; i += 2) {
      sColorChange.push(parseInt("0x" + sColor.slice(i, i + 2)));
    }
    return "[" + sColorChange.join(",") + "]";
  }
  return sColor;
};

export function sitLineOrder(ndata) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 10; j++) {
      [ndata[i * 10 + j], ndata[(4 - i) * 10 + j]] = [
        ndata[(4 - i) * 10 + j],
        ndata[i * 10 + j],
      ];
    }
  }
}

export class Stoke {
  constructor(value) {
    this.length = value;
    this.stack = [];
  }

  addValue(value) {
    if (this.stack.length < this.length) {
      this.stack.push(Math.abs(value));
    } else {
      this.stack.push(Math.abs(value));
      this.stack.shift();
    }
    // console.log(this.stack)
  }

  computeValue(value) {
    return this.stack.filter((a) => a > value).length;
  }
}

export class numCom {
  constructor(arr) {
    this.arr = arr;
    this.sum = this.arr.reduce((prev, cur) => prev + cur, 0);
    this.aver = this.sum / (this.arr.length > 0 ? this.arr.length : 1);
    this.arr.sort((x, y) => x - y);
    this.value4 = this.arr.length;
  }

  computeAver(num) {
    let arr = [...this.arr];
    let arr1 = [...this.arr];
    // arr.sort((x,y) => x-y).splice(Number(this.arr.length*num) ,Number(this.arr.length*(1-num))+2)
    // arr1.sort((x,y) => x-y).splice(0 ,Number(this.arr.length*(1-num))+2)
    let max = this.arr.length > 0 ? this.arr[this.arr.length - 1] : 0;
    let min = this.arr.length > 0 ? this.arr[0] : 0;
    let flag1 = Number(min + (max - min) / 3);
    let flag2 = Number(min + ((max - min) * 2) / 3);
    this.arr.push(flag1, flag2);
    this.arr.sort((x, y) => x - y);
    this.value1 =
      this.arr.indexOf(flag1) - 1 <= 0 ? 0 : this.arr.indexOf(flag1) - 1;
    this.value2 =
      this.arr.indexOf(flag2) - this.arr.indexOf(flag1) - 1 <= 0
        ? 0
        : this.arr.indexOf(flag2) - this.arr.indexOf(flag1) - 1;
    this.value3 =
      this.arr.length - 1 - this.arr.indexOf(flag2) - 2 <= 0
        ? 0
        : this.arr.length - 1 - this.arr.indexOf(flag2) - 2;

    this.value5 = this.arr.indexOf(flag2) - 1;
    let sum = arr.reduce((prev, cur) => prev + cur, 0);
    let sum1 = arr1.reduce((prev, cur) => prev + cur, 0);
    this.averSmall = sum / (arr.length > 0 ? arr.length : 1);
    this.averBig = sum1 / (arr1.length > 0 ? arr1.length : 1);
  }

  computeAverDiff() {
    let num = 0;
    this.arr.forEach((a, index) => {
      num += a - this.aver;
    });
    return num;
  }

  computeAverNum(num) {
    return this.arr.filter((a) => a > num).length;
  }
}
export function rotate90(arr, height, width) {
  //逆时针旋转 90 度
  //列 = 行
  //行 = n - 1 - 列(j);  n表示总行数
  let matrix = [];
  for (let i = 0; i < height; i++) {
    matrix[i] = [];
    for (let j = 0; j < width; j++) {
      matrix[i].push(arr[i * height + j]);
    }
  }

  var temp = [];
  var len = matrix.length;
  for (var i = 0; i < len; i++) {
    for (var j = 0; j < len; j++) {
      var k = len - 1 - j;
      if (!temp[k]) {
        temp[k] = [];
      }
      temp[k][i] = matrix[i][j];
    }
  }
  let res = [];
  for (let i = 0; i < temp.length; i++) {
    res = res.concat(temp[i]);
  }
  return res;
}

export function rotate90CW(arr, height, width) {
  // 1. 把一维数组变成 height×width 的二维矩阵
  const matrix = Array.from({ length: height }, (_, i) =>
    arr.slice(i * width, i * width + width)
  );

  // 2. 顺时针旋转：newMatrix[col][height-1-row] = matrix[row][col]
  const newMatrix = [];
  for (let col = 0; col < width; col++) {
    newMatrix[col] = [];
    for (let row = 0; row < height; row++) {
      newMatrix[col][row] = matrix[height - 1 - row][col];
    }
  }

  // 3. 再拍平成一维数组
  return newMatrix.flat();
}


export function press(arr, width, height, num) {
  // 每一列的总和
  let arrList = [];
  // for (let i = 0; i < height; i++) {
  //   arrList[i] = 0;
  //   for (let j = 0; j < width; j++) {
  //     arrList[i] += arr[j * height + i];
  //   }
  // }

  // let newArr = [...arr];
  // // 当每个值大于零的时候，新数组的每个点为这旧数组的值加上这一列总和减去这个值的六分之一
  // for (let i = 0; i < height; i++) {
  //   for (let j = 0; j < width; j++) {
  //     if (newArr[j * height + i] > 10) {
  //       newArr[j * height + i] = parseInt(
  //         newArr[j * height + i] + (arrList[i] - newArr[j * height + i]) / 4
  //       );
  //     }
  //   }
  // }

  let rowArrList = [];
  for (let i = 0; i < height; i++) {
    rowArrList[i] = 0;
    for (let j = 0; j < width; j++) {
      rowArrList[i] += arr[j + i * height];
    }
  }
  let newArr1 = [...arr];
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      if (newArr1[j + i * height] > 6) {
        newArr1[j + i * height] = parseInt(
          newArr1[j + i * height] +
          (rowArrList[i] - newArr1[j + i * height]) / (num ? num : 8)
        );
      }
    }
  }

  return newArr1;
}

export function pressSj(arr, width, height) {
  // 每一列的总和
  let arrList = [];
  // for (let i = 0; i < height; i++) {
  //   arrList[i] = 0;
  //   for (let j = 0; j < width; j++) {
  //     arrList[i] += arr[j * height + i];
  //   }
  // }

  // let newArr = [...arr];
  // // 当每个值大于零的时候，新数组的每个点为这旧数组的值加上这一列总和减去这个值的六分之一
  // for (let i = 0; i < height; i++) {
  //   for (let j = 0; j < width; j++) {
  //     if (newArr[j * height + i] > 10) {
  //       newArr[j * height + i] = parseInt(
  //         newArr[j * height + i] + (arrList[i] - newArr[j * height + i]) / 4
  //       );
  //     }
  //   }
  // }

  let rowArrList = [];
  for (let i = 0; i < height; i++) {
    rowArrList[i] = 0;
    for (let j = 0; j < width; j++) {
      rowArrList[i] += arr[j + i * height];
    }
  }
  let newArr1 = [...arr];
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      if (newArr1[j + i * height] > 6) {
        newArr1[j + i * height] = parseInt(
          newArr1[j + i * height] +
          (rowArrList[i] - newArr1[j + i * height]) / 4
        );
      }
    }
  }

  return newArr1;
}

export function findMax(arr) {
  let max = 0;
  arr.forEach((item) => {
    max = max > item ? max : item;
  });
  return max;
}
const chartValueArr = [200, 500, 1000, 1800, 3000, 5000, 10000, 18000, 30000, 45000, 60000, 80000]
export function returnChartMax(value) {

  for (let i = 0; i < chartValueArr.length - 1;) {
    if (value > chartValueArr[i] && value < chartValueArr[i + 1]) {
      return chartValueArr[i + 1]
    } else if (value > chartValueArr[i] && value > chartValueArr[i + 1]) {
      i++
    } else if (value < chartValueArr[i]) {
      return chartValueArr[i]
    }
  }
  return 100000
}

export function findMin(arr) {
  let min = 0;
  arr.forEach((item) => {
    min = min < item ? min : item;
  });
  return min;
}

export class Stick {
  constructor(num) {
    this.size = num;
    this.arr = [1000, 1000];
  }
  addNum(num) {
    if (this.arr.length < this.size) {
      this.arr.push(num);
    } else {
      this.arr.shift();
      this.arr.push(num);
    }
  }
}

export function most(arrays) {
  let max = 1,
    maxEle;
  let obj = arrays.reduce(function (preVal, curVal) {
    preVal[curVal] ? preVal[curVal]++ : (preVal[curVal] = 1);
    if (preVal[curVal] > max) {
      max++;
      maxEle = curVal;
    }
    return preVal;
  }, {});
  return maxEle;
}

export function changePropArr(Arr) {
  //let Arr = [1, 3, 1, 2, 12, 3, 5, 4, 2, 1, 48, 68, 68, 75, 93, 108, 87, 84, 65, 44, 71, 64, 76, 99, 87, 109, 130, 111, 96, 53, 78, 92, 59, 78, 53, 97, 118, 104, 75, 59, 83, 128, 102, 97, 83, 74, 108, 110, 80, 54, 23, 44, 41, 76, 49, 22, 43, 34, 28, 29, 44, 33, 41, 48, 91, 46, 28, 34, 27, 25, 36, 46, 62, 32, 55, 58, 49, 36, 28, 9, 140, 45, 81, 43, 48, 60, 25, 12, 19, 103, 137, 125, 98, 106, 73, 71, 81, 120, 57, 130]
  let arr = new Array(10).fill(0);
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      arr[i] += Arr[i * 10 + j];
    }
  }
  let max = findMax(arr);
  return arr.map((a, index) => a / max);
}

export function changeBackPropArr(realData) {
  let Arr = [
    1, 3, 1, 2, 12, 3, 5, 4, 2, 1, 48, 68, 68, 75, 93, 108, 87, 84, 65, 44, 71,
    64, 76, 99, 87, 109, 130, 111, 96, 53, 78, 92, 59, 78, 53, 97, 118, 104, 75,
    59, 83, 128, 102, 97, 83, 74, 108, 110, 80, 54, 23, 44, 41, 76, 49, 22, 43,
    34, 28, 29, 44, 33, 41, 48, 91, 46, 28, 34, 27, 25, 36, 46, 62, 32, 55, 58,
    49, 36, 28, 9, 140, 45, 81, 43, 48, 60, 25, 12, 19, 103, 137, 125, 98, 106,
    73, 71, 81, 120, 57, 130,
  ];
  let arr = new Array(10).fill(0);
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      arr[i] += Arr[i * 10 + j];
    }
  }
  let max = findMax(arr);
  let propArr = arr.map((a, index) => a / max);
  let min = findMin(propArr);
  let realprop = propArr.map((a, index) => 1 - a + min);
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      realData[i * 10 + j] = realData[i * 10 + j] * realprop[i];
    }
  }
}

export function changeSitPropArr(realData) {
  let Arr = [
    4, 10, 22, 26, 10, 3, 3, 4, 18, 5, 29, 90, 104, 104, 66, 38, 37, 49, 63, 43,
    116, 146, 132, 142, 108, 93, 71, 99, 110, 133, 87, 79, 68, 71, 76, 82, 78,
    88, 98, 102, 93, 85, 72, 74, 81, 87, 83, 94, 103, 109, 101, 69, 81, 89, 61,
    36, 65, 92, 111, 65, 104, 72, 77, 73, 68, 54, 106, 87, 88, 83, 95, 75, 85,
    67, 72, 65, 96, 90, 70, 71, 75, 91, 88, 60, 95, 86, 119, 89, 54, 102, 54,
    67, 71, 45, 116, 84, 102, 85, 58, 56,
  ];
  let arr = new Array(10).fill(0);
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      arr[i] += Arr[i * 10 + j];
    }
  }
  let max = findMax(arr);
  let propArr = arr.map((a, index) => a / max);
  let min = findMin(propArr);
  let realprop = propArr.map((a, index) => 1 - a + min);
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      realData[i * 10 + j] = realData[i * 10 + j] * realprop[i];
    }
  }
}

export function discoverSureCurve(detectedArr, num) {
  let sureArr = [
    1, 0, 0, 0, 4, 3, 2, 1, 4, 3, 66, 93, 90, 87, 106, 116, 94, 82, 104, 57, 79,
    94, 100, 117, 99, 116, 127, 121, 101, 66, 90, 111, 91, 104, 82, 108, 127,
    111, 107, 81, 87, 121, 106, 102, 96, 77, 111, 117, 121, 84, 41, 59, 68, 103,
    84, 40, 56, 50, 62, 71, 66, 55, 67, 71, 92, 60, 45, 69, 73, 60, 50, 61, 83,
    54, 68, 67, 60, 62, 45, 28, 122, 32, 37, 27, 27, 22, 12, 8, 14, 85, 102, 80,
    63, 52, 42, 49, 70, 91, 29, 84,
  ];
  let propSure = changePropArr(sureArr);
  let sureMax = findMax(propSure);

  let sureCurve = propSure.map((a, index) => (a / sureMax).toFixed(2));
  let propDetected = changePropArr(detectedArr);
  let detectedMax = findMax(propDetected);
  let detectedCurve = propDetected.map((a, index) =>
    (a / detectedMax).toFixed(2)
  );
  console.log(sureCurve, detectedCurve);
  return detectedCurve.every((a, index) => {
    return (
      a <= Number(sureCurve[index]) + num && a >= Number(sureCurve[index]) + num
    );
  });
}

export function calFootType(arr, valueFlag) {
  // 将脚每一行求和
  const newArr = arr.map((a) => a < valueFlag ? 0 : a)
  const leftArr = []
  for (let i = 0; i < 32; i++) {
    let num = 0
    for (let j = 0; j < 16; j++) {
      num += arr[i * 16 + j]
    }
    leftArr.push(num)
  }

  // 找到整个脚的索引和重量
  const leftFoot = [], leftFootValue = []
  leftArr.forEach((a, index) => {
    if (a > valueFlag * 2) {
      leftFoot.push(index)
      leftFootValue.push(a)
    }
  })

  const footTotalPress = leftFootValue.reduce((a, b) => a + b, 0)

  // let footSlope = []
  // // 找到每个点的斜率
  // for (let i = 1; i < leftFootValue.length; i++) {
  //   footSlope.push(leftFootValue[i] - leftFootValue[i - 1])
  // }

  // 找到第一个下降然后上升的点  脚趾头跟脚板的分界线
  let footStart = 0
  for (let i = 1; i < leftFootValue.length; i++) {
    if (leftFootValue[i] - leftFootValue[i - 1] < 0 && ((leftFootValue[i + 1] - leftFootValue[i]) / leftFootValue[i]) > 0.2) {
      footStart = i + 1 + leftFoot[0]
      if (i > leftFootValue.length * 0.4) {
        footStart = leftFoot[0]
      }
      break
    }
  }

  if (!footStart) {
    footStart = leftFoot[0]
  }
  let footEnd = leftFoot[leftFoot.length - 1]

  let length = footEnd - footStart
  if (length % 3 == 1) {
    length = length - 1
    footEnd = footEnd - 1
  }

  if (length % 3 == 2) {
    length = length - 2
    footEnd = footEnd - 1
    footStart = footStart - 1
  }

  let totalFootPoint = 0, contentPoint = 0

  for (let i = footStart; i < footEnd; i++) {
    for (let j = 0; j < 16; j++) {
      if (arr[i * 16 + j] > valueFlag) {
        totalFootPoint++
      }
      if (i >= footStart + Math.floor(length / 3) && i < footStart + Math.floor(length * 2 / 3) && arr[i * 16 + j] > valueFlag) {
        contentPoint++
      }

      // arr[(i ) * 16 + j] = 100
    }
  }

  // console.log(footStart ,contentPoint  , totalFootPoint)

  const prop = contentPoint / (totalFootPoint ? totalFootPoint : 1)
  return { footType: prop, footLength: leftFoot.length }

}

export class smoothClass {
  constructor(length) {
    this.smoothValue = new Array(length).fill(0)
  }

  getSmooth(arr, smoothValue) {
    // this.value = this.value + (value - this.value) / smoothValue
    for (let i = 0; i < arr.length; i++) {
      if (isNaN(arr[i])) {
        arr[i] = 0
      }
      this.smoothValue[i] = this.smoothValue[i] + (arr[i] - this.smoothValue[i]) / smoothValue
    }
  }
}

export function timeStampToDate(data) {
  console.log(data)
  if (typeof data !== 'number') {
    return ''
  }
  var date = new Date(data);  // 参数需要毫秒数，所以这里将秒数乘于 1000
  let Y = date.getFullYear() + '/';
  // let M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '/';
  let M = (date.getMonth() + 1) + '/';
  let D = date.getDate() + ' ';
  let h = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + ':';
  let m = (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()) + ':';
  let s = (date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds()) + ':';
  let us = date % 1000
  // document.write(Y+M+D+h+m+s);
  return Y + M + D + h + m + s + us
}

export function timeStampToDateNospace(data) {
  console.log(data)
  if (typeof data !== 'number') {
    return ''
  }
  var date = new Date(data);  // 参数需要毫秒数，所以这里将秒数乘于 1000
  let Y = date.getFullYear() + '-';
  // let M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '-';
  let M = (date.getMonth() + 1) + '-';
  let D = date.getDate() + '-';
  let h = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + '-';
  let m = (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()) + '-';
  let s = (date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds()) + '-';
  let us = date % 1000
  // document.write(Y+M+D+h+m+s);
  return Y + M + D + h + m + s + us
}

export const initValue = {
  valueg1: localStorage.getItem("carValueg")
    ? JSON.parse(localStorage.getItem("carValueg"))
    : 3.3,
  valuej1: localStorage.getItem("carValuej")
    ? JSON.parse(localStorage.getItem("carValuej"))
    : 2655,
  valuel1: localStorage.getItem("carValuel")
    ? JSON.parse(localStorage.getItem("carValuel"))
    : 4,
  valuef1: localStorage.getItem("carValuef")
    ? JSON.parse(localStorage.getItem("carValuef"))
    : 0,
  value1: localStorage.getItem("carValue")
    ? JSON.parse(localStorage.getItem("carValue"))
    : 2.08,
  valuelInit1: localStorage.getItem("carValueInit")
    ? JSON.parse(localStorage.getItem("carValueInit"))
    : 500,
  valueMult: localStorage.getItem("valueMult")
    ? JSON.parse(localStorage.getItem("valueMult"))
    : 1,
  compen: localStorage.getItem("compen")
    ? JSON.parse(localStorage.getItem("compen"))
    : 0,
  press: localStorage.getItem("press")
    ? JSON.parse(localStorage.getItem("press"))
    : 0,
  ymax1: localStorage.getItem('ymax') ? JSON.parse(localStorage.getItem('ymax')) : 251,
}

export function calculatePressure(x) {
  // if (x < 40) {
  //   return 0
  // }
  const coefficient3 = 0.0001
  const coefficient2 = -0.0036;
  const coefficient1 = 0.1492;
  const constant = -0.6129;

  // const y = coefficient5 * Math.pow(x, 5) + coefficient4 * Math.pow(x, 4) + coefficient3 * Math.pow(x, 3) + coefficient2 * Math.pow(x, 2) + coefficient1 * x + constant;

  return (coefficient3 * Math.pow(x, 3) + coefficient2 * Math.pow(x, 2) + coefficient1 * x + constant).toFixed(
    2
  );
}

export function yanfeng10sit(arr) {
  let newData = []
  for (let i = 6; i < 16; i++) {
    for (let j = 0; j < 10; j++) {
      newData.push(arr[i * 32 + j])
    }
  }

  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 10; j++) {
      [newData[(5 + i) * 10 + j], newData[(5 + 4 - i) * 10 + j]] = [newData[(5 + 4 - i) * 10 + j], newData[(5 + i) * 10 + j]]
    }
  }
  newData = rotate90(newData, 10, 10)

  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 5; j++) {
      [newData[(i) * 10 + j], newData[(i) * 10 + 9 - j]] = [newData[(i) * 10 + 9 - j], newData[(i) * 10 + j]]
    }
  }
  return newData
}

// function rotate90(arr, height, width) {
//   //逆时针旋转 90 度
//   //列 = 行
//   //行 = n - 1 - 列(j);  n表示总行数
//   let matrix = [];
//   for (let i = 0; i < height; i++) {
//     matrix[i] = [];
//     for (let j = 0; j < width; j++) {
//       matrix[i].push(arr[i * height + j]);
//     }
//   }

//   var temp = [];
//   var len = matrix.length;
//   for (var i = 0; i < len; i++) {
//     for (var j = 0; j < len; j++) {
//       var k = len - 1 - j;
//       if (!temp[k]) {
//         temp[k] = [];
//       }
//       temp[k][i] = matrix[i][j];
//     }
//   }
//   let res = [];
//   for (let i = 0; i < temp.length; i++) {
//     res = res.concat(temp[i]);
//   }
//   return res;
// }


