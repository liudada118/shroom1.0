export const rainbowColors = [
  [255, 255, 0],
  [204, 255, 0],
  [153, 255, 0],
  [102, 255, 0],
  [51, 255, 0],
  [0, 255, 0],
  [0, 255, 51],
  [0, 255, 102],
  [0, 255, 153],
  [0, 255, 204],
  // [0, 255, 255],
  // [0, 204, 255],
  // [0, 153, 255],
  // ...new Array(5).fill([0, 102, 255]),
  ...new Array(5).fill([0, 255, 255]),
  ...new Array(5).fill([0, 204, 255]),
  ...new Array(5).fill([0, 153, 255]),
  ...new Array(15).fill([0, 102, 255]),
  [255, 255, 255],
  [255, 255, 255],
  ...new Array(5).fill([255, 255, 255]),
];
export const garyColors = [
  [0, 0, 0],
  [17, 17, 17],
  [34, 34, 34],
  [51, 51, 51],
  [68, 68, 68],
  [85, 85, 85],
  // [102, 102, 102],
  // [119, 119, 119],
  // [136, 136, 136],
  // [153, 153, 153],
  // [170, 170, 170],
  // [187, 187, 187],
  // [204, 204, 204],
  // [221, 221, 221],
  // [238, 238, 238],
  // [255, 255, 255],
]

export const rainbowBackColors = [
  [255, 255, 0],
  [204, 255, 0],
  [153, 255, 0],
  [102, 255, 0],
  [51, 255, 0],
  [0, 255, 0],
  [0, 255, 51],
  [0, 255, 102],
  [0, 255, 153],
  [0, 255, 204],
  // [0, 255, 255],
  // [0, 204, 255],
  // [0, 153, 255],
  // ...new Array(5).fill([0, 102, 255]),
  ...new Array(5).fill([0, 255, 255]),
  ...new Array(5).fill([0, 204, 255]),
  ...new Array(5).fill([0, 153, 255]),
  ...new Array(50).fill([0, 102, 255]),
  [255, 255, 255],
  [255, 255, 255],
  ...new Array(5).fill([255, 255, 255]),
];


export const rainbowTextColors = [
  [255, 255, 0],
  [204, 255, 0],
  [153, 255, 0],
  [102, 255, 0],
  [51, 255, 0],
  [0, 255, 0],
  [0, 255, 51],
  [0, 255, 102],
  [0, 255, 153],
  [0, 255, 204],
  [0, 255, 255],
  [0, 204, 255],
  [0, 153, 255],
  // ...new Array(1).fill([0, 102, 255]),
  // ...new Array(1).fill([0, 255, 255]),
  // ...new Array(1).fill([0, 204, 255]),
  // ...new Array(1).fill([0, 153, 255]),
  ...new Array(5).fill([0, 102, 255]),
  [255, 255, 255],
  [255, 255, 255],
  ...new Array(5).fill([255, 255, 255]),
];

export function calFoot(arr , width , height){
  let footArr = []
  for(let i = 0 ; i < height ; i++){
    let count = 0
    for(let j = 0 ; j < width ; j ++){
      if(arr[i*16 + j] > 15){
        count ++
      }
    }
    footArr[i] = count
  }
  let left = 0 , right =0
  for(let i = 0 ; i < height ; i ++){
    if(footArr[i] > 1){
      left = i
      break
    }
  }

  for(let i = 31 ; i >= 0 ; i --){
    if(footArr[i] > 1){
      right = i
      break
    }
  }

  return right - left
}

// export function analyzeLeftRightAreaIndex(leftPoints, rightPoints) {
//   var zLeftTopPoint = { x: 10, y: 1000, value: 0 };
//   var zLeftButPoint = { x: 10, y: 10, value: 0 };
//   for (var i = 0; i < leftPoints.length; i++) {
//     var one = leftPoints[i];
//     var y = one.y;
//     var v = one.value;
//     if (zLeftTopPoint.y > y) {
//       zLeftTopPoint = one;
//     }
//     if (zLeftButPoint.y < y) {
//       zLeftButPoint = one;
//     }
//   }
//   zLeftButPoint = getMaxYValuePoint(leftPoints, zLeftButPoint);
//   var zRightTopPoint = { x: 10, y: 1000, value: 0 };
//   var zRightButPoint = { x: 10, y: 10, value: 0 };
//   for (var i = 0; i < rightPoints.length; i++) {
//     var one = rightPoints[i];
//     var y = one.y;
//     if (zRightTopPoint.y > y) {
//       zRightTopPoint = one;
//     }
//     if (zRightButPoint.y < y) {
//       zRightButPoint = one;
//     }
//   }
//   zRightButPoint = getMaxYValuePoint(rightPoints, zRightButPoint);
//   singleDKAreaIndex(1, leftPoints, zLeftButPoint.x, zLeftButPoint.y, zLeftTopPoint.x, zLeftTopPoint.y);
//   singleDKAreaIndex(2, rightPoints, zRightButPoint.x, zRightButPoint.y, zRightTopPoint.x, zRightTopPoint.y);
// }

// export function singleDKAreaIndex(type, points, x1, y1, x2, y2) {
//   var linePixe = 10 * pixelScaleY;
//   var xG1 = x1 - linePixe;
//   var xG2 = x1 + linePixe;
//   var xyDs4 = getLineXY(xG1, y1, xG2, y1);
//   var yT = y2 + (y1 - y2) * 17 / 100;
//   var xyDs1 = getLineXY(xG1, yT, xG2, yT);
//   var yD1 = yT + (y1 - yT) * 1 / 3;
//   var xyDs2 = getLineXY(xG1, yD1, xG2, yD1);
//   var yD2 = yT + (y1 - yT) * 2 / 3;
//   var xyDs3 = getLineXY(xG1, yD2, xG2, yD2);
//   var mjA = 0;
//   var mjB = 0;
//   var mjC = 0;
//   for (var i = 0; i < points.length; i++) {
//     var one = points[i];
//     var v = one.value;
//     if (v < 10) {
//       continue;
//     }
//     var isOk = isAreaValue(xyDs1, xyDs2, one);
//     if (isOk) {
//       mjA++;
//       continue;
//     }
//     isOk = isAreaValue(xyDs2, xyDs3, one);
//     if (isOk) {
//       mjB++;
//       continue;
//     }
//     isOk = isAreaValue(xyDs3, xyDs4, one);
//     if (isOk) {
//       mjC++;
//       continue;
//     }
//   }
//   var scaleJx = (mjB / (mjA + mjB + mjC)).toFixed(2);
//   var jxStr = "正常";
//   if (scaleJx < 0.21) {
//     jxStr = "高弓足";
//   } else if (scaleJx > 0.26) {
//     jxStr = "扁平足";
//   }
//   return jxStr
// }

// export function analyzeLeftRightDouble(_points) {
//   leftMax = 0;
//   rightMax = 0;
//   var zLeftPoint = { x: 1000, y: 0, value: 0 };
//   var zRightPoint = { x: 0, y: 0, value: 0 };
//   for (var i = 0; i < _points.length; i++) {
//     var one = _points[i];
//     var x = one.x;
//     var y = one.y;
//     if (zLeftPoint.x > x) {
//       zLeftPoint = one;
//     }
//     if (zRightPoint.x < x) {
//       zRightPoint = one;
//     }
//   }
//   var centerX = (zLeftPoint.x + zRightPoint.x) / 2;
//   var centerY = (zLeftPoint.y + zRightPoint.y) / 2;
//   var x1 = zLeftPoint.x;
//   var y1 = zLeftPoint.y;
//   var x2 = zRightPoint.x;
//   var y2 = zRightPoint.y;
//   var x3 = 0;
//   var y3 = y2;
//   var a = Math.sqrt(Math.abs(Math.pow(Math.abs(x1 - x2), 2) + Math.pow(y1 - y2, 2)));
//   var b = Math.sqrt(Math.abs(Math.pow(Math.abs(x2 - x3), 2) + Math.pow(y2 - y3, 2)));
//   var c = Math.sqrt(Math.abs(Math.pow(Math.abs(x3 - x1), 2) + Math.pow(y3 - y1, 2)));
//   var cosc = (Math.pow(a, 2) + Math.pow(b, 2) - Math.pow(c, 2)) / (2 * a * b);
//   var jcc = Math.acos(cosc) / (Math.PI / 180);
//   var r = Math.sqrt(Math.pow((x1 - centerX), 2) + Math.pow((y1 - centerY), 2));
//   var xU = getZeroNumber(centerX - r * Math.cos((90 + jcc) * Math.PI / 180));
//   var yU = getZeroNumber(centerY - r * Math.sin((90 + jcc) * Math.PI / 180));
//   var xT = Math.abs((xU - centerX)) * 2;
//   var yT = Math.abs((yU - centerY)) * 2;
//   var xD = centerX - xT;
//   var yD = centerY + yT;
//   // canvasCtx.moveTo(xD, yD);
//   // canvasCtx.lineTo(xU, yU);
//   var lineXy = getLineXY(xD, yD, xU, yU);
//   for (var i = 0; i < _points.length; i++) {
//     var one = _points[i];
//     var v = one.value;
//     var isLeft = isLeftLineArea(lineXy, one);
//     if (isLeft) {
//       leftPoints.push(one);
//       leftCount++;
//       leftArea += v;
//       if (v > leftMax) {
//         leftMax = v;
//       }
//     } else {
//       rightPoints.push(one);
//       rightCount++;
//       rightArea += v;
//       if (v > rightMax) {
//         rightMax = v;
//       }
//     }
//   }
//   setInnerHTML("textArea1", leftCount);
//   setInnerHTML("textArea2", rightCount);
//   setInnerHTML("textArea3", leftArea);
//   setInnerHTML("textArea4", rightArea);
//   setInnerHTML("textArea5", getNaNNumber(leftArea / leftCount).toFixed(2));
//   setInnerHTML("textArea6", getNaNNumber(rightArea / rightCount).toFixed(2));
//   setInnerHTML("textArea7", (oneArea * leftCount).toFixed(2));
//   setInnerHTML("textArea8", (oneArea * rightCount).toFixed(2));
//   setInnerHTML("textArea9", leftMax);
//   setInnerHTML("textArea10", rightMax);
//   var all = leftArea + rightArea;
//   var leftScale = getNaNNumber(leftArea / all * 100).toFixed(1);
//   var rightScale = getNaNNumber(rightArea / all * 100).toFixed(1);
//   $("#piezoHight1").css("height", leftScale + "px");
//   $("#piezoHight2").css("height", rightScale + "px");
//   if (leftScale > 50) {
//     $("#piezoHight1").css("background-color", "red");
//   } else {
//     $("#piezoHight1").css("background-color", "#5cb85c");
//   }
//   if (rightScale > 50) {
//     $("#piezoHight2").css("background-color", "red");
//   } else {
//     $("#piezoHight2").css("background-color", "#5cb85c");
//   }
//   setInnerHTML("piezoScale1", leftScale + "%");
//   setInnerHTML("piezoScale2", rightScale + "%");
// }

// export function initData(data) {
//   resetArge();
//   var pointNum = 0;
//   var pointAll = 0;
//   var jsonObj = JSON.parse(data);
//   var isAddCop = false;
//   var maxY = 0;
//   var maxYPoint;
//   for (var i = 0; i < jsonObj.length; i++) {
//     var obj = jsonObj[i];
//     var row = obj.row;
//     var value = obj.value;
//     var sss = value.split(",");
//     for (var k = 0; k < sss.length; k++) {
//       var v = sss[k];
//       v = filterValue(v);
//       if (v != 0) {
//         var yy = row * pixelScaleY;
//         var one = { x: k * pixelScaleX, y: yy, value: v };
//         points.push(one);
//         pointAll = pointAll + v;
//         pointNum = pointNum + 1;
//         isAddCop = true;
//         if (maxY < yy) {
//           maxY = yy;
//           maxYPoint = one;
//         }
//       }
//     }
//   }
//   if (isAddCop) {
//     if (jsonObj != null && jsonObj.length != 0) {
//       copPoints.push(jsonObj);
//     }
//   }
//   if (maxY != 0) {
//     aePoints.push({ x: maxYPoint.x, y: maxYPoint.y, date: new Date() });
//   }
//   curPoints = points;
//   drawMap();
// }


// function getMaxYValuePoint(allPoints, butPoint) {
//   var rstPoint = butPoint;
//   for (var i = 0; i < allPoints.length; i++) {
//     var one = allPoints[i];
//     var y = one.y;
//     var v = one.value;
//     if (butPoint.y == y) {
//       if (rstPoint.value < v) {
//         rstPoint = one;
//       }
//     }
//   }
//   //像素向下延伸一格
//   rstPoint.y = rstPoint.y + pixelScaleY;
//   return rstPoint;
// }

// function getZeroNumber(v) {
//   if (v < 0) {
//     v = 0;
//   }
//   return v;
// }

// function getLineXY(xxx1, yyy1, xxx2, yyy2) {
//   // console.log(xxx1 + " " + yyy1 + "   " + xxx2 + " " + yyy2)
//   var arr = new Array();
//   for (var i = 0; i < 100; i++) {
//     var x = 0;
//     var y = 0;
//     if (xxx1 > xxx2) {
//       x = xxx2 + (xxx1 - xxx2) * i / 100;
//       if (yyy1 > yyy2) {
//         y = yyy2 + (yyy1 - yyy2) * i / 100;
//       } else {
//         y = yyy2 - (yyy2 - yyy1) * i / 100;
//       }
//     } else {
//       x = xxx1 + (xxx2 - xxx1) * i / 100;
//       if (yyy1 > yyy2) {
//         y = yyy1 - (yyy1 - yyy2) * i / 100;
//       } else {
//         y = yyy1 + (yyy2 - yyy1) * i / 100;
//       }
//     }
//     arr.push({ x: parseInt(x), y: parseInt(y), value: 400 });
//   }
//   return arr;
// }

// function isAreaValue(xyDs1, xyDs2, one) {
//   var x = one.x;
//   var y = one.y;
//   var ok = 0;
//   for (var i = 0; i < xyDs1.length; i++) {
//     var tmpx = xyDs1[i].x;
//     var tmpy = xyDs1[i].y;
//     if (x > tmpx && y > tmpy) {
//       ok++;
//       break;
//     }
//   }
//   for (var i = 0; i < xyDs2.length; i++) {
//     var tmpx = xyDs2[i].x;
//     var tmpy = xyDs2[i].y;
//     if (x < tmpx && y < tmpy) {
//       ok++;
//       break;
//     }
//   }
//   if (ok == 2) {
//     return true;
//   }
//   return false;
// }




