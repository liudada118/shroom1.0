const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { pressSmallBed } = require("./utilMatrix");
const { handLArr } = require("./util/constant");
module.exports = {
  openWeb: function ({ hostname, port }) {
    const server = http.createServer((req, res) => {
      if (req.url === "/") {
        // 读取打包后的 index.html 文件
        const filePath = path.join(__dirname, "build", "index.html");
        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "text/plain");
            res.end("Internal Server Error");
          } else {
            // 设置响应头和内容，发送网页文件
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html");
            res.end(data);
          }
        });
      } else {
        // 处理其他请求（如样式表、脚本、图片等）
        const filePath = path.join(__dirname, "build", req.url);
        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "text/plain");
            res.end("Not Found");
          } else {
            res.statusCode = 200;
            res.setHeader("Content-Type", getContentType(filePath));
            res.end(data);
          }
        });
      }
    });

    server.listen(port, hostname, () => {
      const url = `http://${hostname}:${port}`;
      console.log(`Server running at http://${hostname}:${port}/`);
      exec(`start chrome "${url}"`, (err, stdout, stderr) => {
        if (err) {
          console.error(`exec error: ${err}`);
          return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
      });
    });

    function getContentType(filePath) {
      const extname = path.extname(filePath);
      switch (extname) {
        case ".html":
          return "text/html";
        case ".css":
          return "text/css";
        case ".js":
          return "text/javascript";
        case ".png":
          return "image/png";
        case ".jpg":
          return "image/jpg";
        default:
          return "text/plain";
      }
    }
  },

  interp(smallMat, bigMat, Length, num) {
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
  },
  addSide(arr, width, height, wnum, hnum, sideNum) {
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
  },
  gaussBlur_1(scl, tcl, w, h, r) {
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
  },
  carSitLine(arr) {
    let wsPointData = [...arr];
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + j], wsPointData[(15 - i) * 32 + j]] = [
          wsPointData[(15 - i) * 32 + j],
          wsPointData[i * 32 + j],
        ];
      }
    }

    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 8; j++) {
        [wsPointData[i * 32 + j + 15], wsPointData[i * 32 + 16 - j + 15]] = [
          wsPointData[i * 32 + 16 - j + 15],
          wsPointData[i * 32 + j + 15],
        ];
      }
    }
    wsPointData = getLineOk(wsPointData);
    wsPointData = rotateMatrixsit180(wsPointData, 32, 32);
    return wsPointData;
  },

  sit10Line(arr) {
    let wsPointData = [...arr];
    let newArr = []
    for (let i = 0; i < 10; i++) {
      for (let j = 22; j < 32; j++) {
        newArr.push(wsPointData[i * 32 + j])
      }
    }

    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 10; j++) {
        [newArr[i * 10 + j], newArr[(4 - i) * 10 + j]] = [newArr[(4 - i) * 10 + j], newArr[i * 10 + j]]
      }
    }
    newArr = rotate90(newArr, 10, 10)
    // console.log(newArr , arr[6*32+7])
    return newArr;
  },

  carBackLine(arr) {
    let wsPointData = [...arr];
    // 1-15行调换
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + j], wsPointData[(14 - i) * 32 + j]] = [
          wsPointData[(14 - i) * 32 + j],
          wsPointData[i * 32 + j],
        ];
      }
    }


    // 15 - 32 列交换
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 8; j++) {
        [wsPointData[i * 32 + j + 15], wsPointData[i * 32 + 16 - j + 15]] = [
          wsPointData[i * 32 + 16 - j + 15],
          wsPointData[i * 32 + j + 15],
        ];
      }
    }

    let b = wsPointData.splice(0, 15 * 32);

    wsPointData = wsPointData.concat(b);

    wsPointData = rotateMatrix(wsPointData, 32, 32);
    wsPointData = getLineOk(wsPointData);
    wsPointData = rotateMatrixback180(wsPointData, 32, 32);
    return wsPointData;

  },
  wowSitLine(arr) {
    let wsPointData = [...arr]
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 8; j++) {
        [wsPointData[i * 32 + (15 - j)], wsPointData[(i) * 32 + j]] = [wsPointData[(i) * 32 + j], wsPointData[i * 32 + (15 - j)],]
      }
    }


    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 16; j++) {
        const a = wsPointData[i * 32 + j]
        wsPointData[i * 32 + j] = wsPointData[i * 32 + 16 + j]
        wsPointData[i * 32 + 16 + j] = a
      }
    }

    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + (j)], wsPointData[(17 - i) * 32 + j]] = [wsPointData[(17 - i) * 32 + j], wsPointData[i * 32 + (j)],]
      }
    }


    wsPointData = zeroLine(wsPointData)
    wsPointData = rotateArray90Degrees(wsPointData, 32, 32)

    // for (let i = 0; i < 32; i++) {
    //   for (let j = 0; j < 16; j++) {
    //     [wsPointData[i * 32 + (31 - j)], wsPointData[(i) * 32 + j]] = [wsPointData[(i) * 32 + j], wsPointData[i * 32 + (31 - j)],]
    //   }
    // }

    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + (j)], wsPointData[(31 - i) * 32 + j]] = [wsPointData[(31 - i) * 32 + j], wsPointData[i * 32 + (j)],]
      }
    }

    return wsPointData
  },
  wowBackLine(arr) {
    let wsPointData = [...arr]
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 8; j++) {
        [wsPointData[i * 32 + (15 - j)], wsPointData[(i) * 32 + j]] = [wsPointData[(i) * 32 + j], wsPointData[i * 32 + (15 - j)],]
      }
    }


    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 16; j++) {
        const a = wsPointData[i * 32 + j]
        wsPointData[i * 32 + j] = wsPointData[i * 32 + 16 + j]
        wsPointData[i * 32 + 16 + j] = a
      }
    }

    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + (j)], wsPointData[(17 - i) * 32 + j]] = [wsPointData[(17 - i) * 32 + j], wsPointData[i * 32 + (j)],]
      }
    }


    wsPointData = zeroLine(wsPointData)
    wsPointData = rotateArrayCounter90Degrees(wsPointData, 32, 32)
    return wsPointData
  },
  xiyueReal1(arr) {
    let wsPointData = [...arr]
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + (j)], wsPointData[(10 - i) * 32 + j]] = [wsPointData[(10 - i) * 32 + j], wsPointData[i * 32 + (j)],]
      }
    }
    // wsPointData = press6(wsPointData, 32, 32, 'col')
    return wsPointData
  },
  newHand(wsPointData) {
    // console.log(wsPointData)
    // let arr = [0, 17, 18, 19, 20, 21].reverse()
    // const newArr = []
    // for (let i = 0; i < arr.length; i++) {
    //   if (i < 3) {
    //     for (let j = 31; j > 21; j--) {
    //       newArr.push(wsPointData[arr[i] * 32 + j])
    //     }
    //   } else {
    //     for (let j = 31; j > 23; j--) {
    //       newArr.push(wsPointData[arr[i] * 32 + j])
    //     }
    //   }
    // }

    let arr = [0, 17, 18, 19, 20, 21]
    const newArr = []
    for (let i = 0; i < arr.length; i++) {
      if (i < 3) {
        // for (let j = 31; j > 21; j--) {
        //   newArr.push(wsPointData[arr[i] * 32 + j])
        // }

        for (let j = 22; j < 32; j++) {
          newArr.push(wsPointData[arr[i] * 32 + j])
        }
      } else {
        // for (let j = 31; j > 23; j--) {
        //   newArr.push(wsPointData[arr[i] * 32 + j])
        // }


        for (let j = 24; j < 32; j++) {
          newArr.push(wsPointData[arr[i] * 32 + j])
        }
      }
    }



    // console.log(newArr)

    const handPointArr = [
      [4, 5], [4, 6], [2, 8], [2, 9], [1, 12], [1, 13], [2, 16], [2, 17], [14, 25], [14, 26],
      [8, 5], [8, 6], [6, 9], [6, 10], [6, 12], [6, 13], [6, 16], [6, 17], [18, 24], [18, 25],
      [11, 6], [11, 7], [10, 9], [10, 10], [10, 12], [10, 13], [10, 15], [10, 16], [22, 23], [22, 24],
      [18, 8], [18, 9], [18, 10], [18, 11], [18, 12], [18, 13], [18, 14], [18, 15],
      [21, 8], [21, 9], [21, 10], [21, 11], [21, 12], [21, 13], [21, 14], [21, 15],
      [24, 8], [24, 9], [24, 10], [24, 11], [24, 12], [24, 13], [24, 14], [24, 15]
    ]
    let newZeroArr = new Array(1024).fill(0)
    // for(let i = 0 ; i < )
    handPointArr.forEach((a, index) => {
      newZeroArr[a[0] * 32 + a[1]] = newArr[index]
      newZeroArr[(a[0] + 1) * 32 + a[1]] = newArr[index]
      newZeroArr[(a[0] + 2) * 32 + a[1]] = newArr[index]
    })
    newZeroArr = rotate90(newZeroArr, 32, 32)
    // console.log(newZeroArr)
    return newZeroArr
  },
  gloves(wsPointData) {

    let handData = []
    for (let j = 0; j < 3; j++) {
      // for (let i = 15; i > 5; i--) {
      for (let i = 6; i < 16; i++) {
        handData.push(wsPointData[i * 32 + j])
      }
    }

    /**
     * 手指和手掌间的数据
     */

    for (let j = 3; j < 5; j++) {
      // for (let i = 13; i > 5; i--) {
      for (let i = 6; i < 14; i++) {
        handData.push(wsPointData[i * 32 + j])
      }
    }

    for (let j = 9; j >= 5; j--) {
      // for (let i = 15; i > 5; i--) {
      for (let i = 6; i < 16; i++) {
        handData.push(wsPointData[i * 32 + j])
      }
    }

    const glovesPoints = [
      [10, 2], [9, 3], [4, 7], [3, 8], [2, 14], [2, 15], [3, 21], [3, 22], [14, 27], [15, 28],
      [13, 4], [12, 5], [8, 9], [7, 10], [7, 14], [7, 15], [7, 20], [7, 21], [17, 25], [18, 26],
      [15, 6], [14, 7], [12, 10], [11, 11], [11, 14], [11, 15], [11, 19], [11, 20], [19, 24], [20, 25],
      [19, 9], [18, 10], [16, 11], [15, 12], [15, 14], [15, 15], [15, 18], [15, 19],
      [20, 10], [19, 11], [18, 12], [17, 13], [17, 14], [17, 15], [17, 18], [17, 19],
      [22, 11], [21, 12], [20, 13], [20, 14], [20, 15], [20, 16], [20, 18], [20, 19], [21, 22], [21, 23],
      [23, 11], [23, 12], [22, 13], [22, 14], [22, 15], [21, 16], [21, 17], [21, 18], [22, 22], [22, 23],
      [24, 12], [24, 13], [23, 14], [23, 15], [23, 16], [23, 17], [23, 18], [23, 19], [23, 20], [23, 21],
      [25, 12], [25, 13], [25, 14], [25, 15], [25, 16], [25, 17], [25, 18], [25, 19], [25, 20], [25, 21],
      [27, 12], [27, 13], [27, 14], [27, 15], [27, 16], [26, 17], [26, 18], [26, 19], [26, 20], [26, 21]
    ]

    let newZeroArr = new Array(1024).fill(0)

    for (let i = 0; i < 3 * 10 + 2 * 8; i++) {
      newZeroArr[glovesPoints[i][0] * 32 + glovesPoints[i][1]] = handData[i]
      newZeroArr[(glovesPoints[i][0] + 1) * 32 + glovesPoints[i][1]] = handData[i]
    }
    for (let i = 3 * 10 + 2 * 8; i < 3 * 10 + 2 * 8 + 5 * 10; i++) {
      newZeroArr[glovesPoints[i][0] * 32 + glovesPoints[i][1]] = handData[i]
    }

    newZeroArr = rotate90(newZeroArr, 32, 32)
    // console.log(newZeroArr)
    return newZeroArr
  },
  gloves1(wsPointData) {

    let handData = []
    for (let j = 0; j < 3; j++) {
      // for (let i = 15; i > 5; i--) {
      for (let i = 6; i < 16; i++) {
        handData.push(wsPointData[i * 32 + j])
      }
    }

    /**
     * 手指和手掌间的数据
     */

    for (let j = 3; j < 5; j++) {
      // for (let i = 13; i > 5; i--) {
      for (let i = 6; i < 14; i++) {
        handData.push(wsPointData[i * 32 + j])
      }
    }

    for (let j = 9; j >= 5; j--) {
      // for (let i = 15; i > 5; i--) {
      for (let i = 6; i < 16; i++) {
        handData.push(wsPointData[i * 32 + j])
      }
    }

    const glovesPoints = [[10, 2], [10, 3], [4, 7], [4, 8], [2, 14], [2, 15], [3, 21], [3, 22], [15, 27], [15, 28], [12, 4], [12, 5], [8, 9], [8, 10], [7, 14], [7, 15], [7, 20], [7, 21], [17, 26], [17, 27], [14, 6], [14, 7], [12, 10], [12, 11], [11, 14], [11, 15], [11, 19], [11, 20], [19, 24], [19, 25], [16, 11], [16, 12], [16, 13], [16, 14], [16, 15], [16, 16], [16, 17], [16, 18], [19, 11], [19, 12], [19, 13], [19, 14], [19, 15], [19, 16], [19, 17], [19, 18], [22, 11], [22, 12], [22, 13], [22, 14], [22, 15], [22, 16], [22, 17], [22, 18], [22, 19], [22, 20], [23, 11], [23, 12], [23, 13], [23, 14], [23, 15], [23, 16], [23, 17], [23, 18], [23, 19], [23, 20], [24, 11], [24, 12], [24, 13], [24, 14], [24, 15], [24, 16], [24, 17], [24, 18], [24, 19], [24, 20], [25, 11], [25, 12], [25, 13], [25, 14], [25, 15], [25, 16], [25, 17], [25, 18], [25, 19], [25, 20], [26, 11], [26, 12], [26, 13], [26, 14], [26, 15], [26, 16], [26, 17], [26, 18], [26, 19], [26, 20]]

    let newZeroArr = new Array(1024).fill(0)

    for (let i = 0; i < 3 * 10 + 2 * 8; i++) {
      newZeroArr[glovesPoints[i][0] * 32 + glovesPoints[i][1]] = handData[i]
      newZeroArr[(glovesPoints[i][0] + 1) * 32 + glovesPoints[i][1]] = handData[i]
    }
    for (let i = 3 * 10 + 2 * 8; i < 3 * 10 + 2 * 8 + 5 * 10; i++) {
      newZeroArr[glovesPoints[i][0] * 32 + glovesPoints[i][1]] = handData[i]
    }

    newZeroArr = rotate90(newZeroArr, 32, 32)
    // console.log(newZeroArr)
    return newZeroArr
  },
  gloves2(wsPointData) {

    let handData = []
    for (let j = 9; j >= 7; j--) {
      for (let i = 15; i >= 6; i--) {
        handData.push(wsPointData[i * 32 + j])
      }
    }

    for (let j = 6; j >= 5; j--) {
      for (let i = 15; i >= 8; i--) {
        handData.push(wsPointData[i * 32 + j])
      }
    }

    for (let j = 0; j < 5; j++) {
      for (let i = 15; i >= 6; i--) {
        handData.push(wsPointData[i * 32 + j])
      }
    }

    const glovesPoints = [[10, 2], [10, 3], [4, 7], [4, 8], [2, 14], [2, 15], [3, 21], [3, 22], [15, 27], [15, 28], [12, 4], [12, 5], [8, 9], [8, 10], [7, 14], [7, 15], [7, 20], [7, 21], [17, 26], [17, 27], [14, 6], [14, 7], [12, 10], [12, 11], [11, 14], [11, 15], [11, 19], [11, 20], [19, 24], [19, 25], [16, 11], [16, 12], [16, 13], [16, 14], [16, 15], [16, 16], [16, 17], [16, 18], [19, 11], [19, 12], [19, 13], [19, 14], [19, 15], [19, 16], [19, 17], [19, 18], [22, 11], [22, 12], [22, 13], [22, 14], [22, 15], [22, 16], [22, 17], [22, 18], [22, 19], [22, 20], [23, 11], [23, 12], [23, 13], [23, 14], [23, 15], [23, 16], [23, 17], [23, 18], [23, 19], [23, 20], [24, 11], [24, 12], [24, 13], [24, 14], [24, 15], [24, 16], [24, 17], [24, 18], [24, 19], [24, 20], [25, 11], [25, 12], [25, 13], [25, 14], [25, 15], [25, 16], [25, 17], [25, 18], [25, 19], [25, 20], [26, 11], [26, 12], [26, 13], [26, 14], [26, 15], [26, 16], [26, 17], [26, 18], [26, 19], [26, 20]]

    let newZeroArr = new Array(1024).fill(0)

    for (let i = 0; i < 3 * 10 + 2 * 8; i++) {
      newZeroArr[glovesPoints[i][0] * 32 + glovesPoints[i][1]] = handData[i]
      newZeroArr[(glovesPoints[i][0] + 1) * 32 + glovesPoints[i][1]] = handData[i]
    }
    for (let i = 3 * 10 + 2 * 8; i < 3 * 10 + 2 * 8 + 5 * 10; i++) {
      newZeroArr[glovesPoints[i][0] * 32 + glovesPoints[i][1]] = handData[i]
    }

    newZeroArr = rotate90(newZeroArr, 32, 32)
    // console.log(newZeroArr)
    return newZeroArr
  }, sit100Line(wsPointData) {
    let left = [], center = [], right = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 1; j >= 0; j--) {
        left.push(wsPointData[i * 32 + j]);
      }
    }

    for (let i = 3; i < 13; i++) {
      for (let j = 7; j >= 2; j--) {
        center.push(wsPointData[i * 32 + j]);
      }
    }

    for (let i = 15; i >= 13; i--) {
      for (let j = 9; j >= 8; j--) {
        right.push(wsPointData[i * 32 + j]);
      }
    }

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 2; j++) {
        [center[(j + 5) * 6 + i], center[(4 - j + 5) * 6 + i]] = [center[(4 - j + 5) * 6 + i], center[(j + 5) * 6 + i],]
      }
    }

    return [...right, ...left, ...center]
  }, endiSit1024(arr) {
    let arrX = [[0, 22]]
    let arrY = [[11, 22], [10, 0]]

    let newArr = arrToRealLine(arr, arrX, arrY, 32)

    // newArr = lineInterp(newArr, 23, 23, 2, 2)

    // newArr = rotate90(newArr, 45, 45)

    // console.log(newArr.length)
    return newArr
  },
  press(arr, value) {
    let left = [],
      right = [];
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 32; j++) {
        left.push(arr[i * 64 + j]);
        right.push(arr[i * 64 + 32 + j]);
      }
    }
    left = pressNew({ arr: left, height: 32, width: 32, value: value });
    right = pressNew({ arr: right, height: 32, width: 32, value: value });
    const newArr = [];
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 64; j++) {
        if (j < 32) {
          newArr.push(left[i * 32 + j] * 1.2);
        } else {
          newArr.push(right[i * 32 + j - 32]);
        }
      }
    }
    return newArr;
  },
  press12(arr) {
    let left = [],
      right = [];
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 32; j++) {
        left.push(arr[i * 64 + j]);
        right.push(arr[i * 64 + 32 + j]);
      }
    }
    const newArr = [];
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 64; j++) {
        if (j < 32) {
          newArr.push(left[i * 32 + j] * 1.2);
        } else {
          newArr.push(right[i * 32 + j - 32]);
        }
      }
    }
    return newArr;
  },
  calculatePressure(x) {
    // if (x < 40) {
    //   return 0
    // }
    // const coefficient3 = 0.0001
    // const coefficient2 = -0.0036;
    // const coefficient1 = 0.1492;
    // const constant = -0.6129;

    // const y = coefficient5 * Math.pow(x, 5) + coefficient4 * Math.pow(x, 4) + coefficient3 * Math.pow(x, 3) + coefficient2 * Math.pow(x, 2) + coefficient1 * x + constant;

    // return (coefficient3 * Math.pow(x, 3) +coefficient2 * Math.pow(x, 2) + coefficient1 * x + constant).toFixed(
    //   2
    // );

    let y = 1.314 * Math.pow(10, -4) * Math.pow(x, 3.955)


    return y;
  },
  car10Back(arr) {

    let ndata = [];
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 32; j++) {
        if (i < 10 && j > 21) {
          ndata.push(arr[i * 32 + j]);
        }
      }
    }

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

    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 5; j++) {
        [ndata[i * 10 + 9 - j], ndata[i * 10 + j]] = [
          ndata[i * 10 + j],
          ndata[i * 10 + 9 - j],
        ];
      }
    }

    for (let i = 0; i < 10; i++) {
      ndata[i * 10 + 0] = ndata[i * 10 + 1];
      ndata[i * 10 + 9] = ndata[i * 10 + 8];
      ndata[0 + i] = ndata[10 + i];
    }

    ndata = rotate90(ndata, 10, 10)

    return ndata
  },
  car10Sit(arr) {
    /**
     * 寻找位置
     */
    let ndata = [];
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 32; j++) {
        if (i < 10 && j > 21) {
          ndata.push(arr[i * 32 + j]);
        }
      }
    }

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

    return ndata
  },

  objChange(newValue, oldValue, valueFlag) {
    if (newValue > oldValue - valueFlag && newValue < oldValue + valueFlag) {
      return false;
    } else {
      return true;
    }
  },
  calPress(startValue, relValue, time) {
    let value;
    if (time < 60 * 13) {
      value = relValue - (startValue * 0.05 * time) / 60 / 13;
    } else if (time < 120 * 13) {
      value =
        relValue -
        startValue * 0.05 -
        (startValue * 0.03 * (time - 60 * 13)) / 60 / 13;
    } else {
      value =
        relValue -
        startValue * 0.08 -
        (startValue * 0.02 * (time - 120 * 13)) / 120 / 13;
    }
    return value;
  }
  ,
  interp1016(smallMat, bigMat, height, width, num) {
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
  },
  gaussBlur_1(scl, tcl, w, h, r) {
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
  },
  addSide(arr, width, height, wnum, hnum, sideNum) {
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
  },
  timeStampToDate(data) {
    var date = new Date(data);  // 参数需要毫秒数，所以这里将秒数乘于 1000
    Y = date.getFullYear() + '/';
    // M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '/';
    M = (date.getMonth() + 1) + '/';
    D = date.getDate() + ' ';
    h = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + ':';
    m = (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()) + ':';
    s = (date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds()) + ':';
    us = date.getMilliseconds() < 10 ? '0' + date.getMilliseconds() : date.getMilliseconds()
    // document.write(Y+M+D+h+m+s);
    return Y + M + D + h + m + s + us
  },
  timeStampTo_Date(data) {
    var date = new Date(data);  // 参数需要毫秒数，所以这里将秒数乘于 1000
    Y = date.getFullYear() + '-';
    // M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '/';
    M = (date.getMonth() + 1) + '-';
    D = date.getDate() + ' ';
    h = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + '-';
    m = (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()) + '-';
    s = date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds();

    // document.write(Y+M+D+h+m+s);
    return Y + M + D + h + m + s
  },
  timeStampToDateNum(data) {
    var date = new Date(data);  // 参数需要毫秒数，所以这里将秒数乘于 1000
    Y = date.getFullYear();
    // M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '/';
    M = (date.getMonth() + 1) < 10 ? '0' + (date.getMonth() + 1) : (date.getMonth() + 1);
    D = date.getDate();
    h = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours());
    m = (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes());
    s = date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds();

    // console.log(Y,M,D,h,m,s);
    return Y + M + D + h + m + s
  },
  calPressArr(data, indexArr, height) {
    const newArr = []
    for (let i = indexArr[2]; i < indexArr[3]; i++) {
      for (let j = indexArr[0]; j < indexArr[1]; j++) {
        newArr.push(data[i * height + j])
      }
    }
    return newArr.reduce((a, b) => a + b, 0)
  },
  pressToN(sitPoint, sitTotal) {
    const sitPressure = carFitting(sitTotal / (sitPoint ? sitPoint : 1))
    N = mmghToPress(sitPressure, sitPoint)
    return Number(N.toFixed(2))
  },
  smallBed(wsPointData) {

    // for (let i = 0; i < 32; i++) {
    //   for (let j = 0; j < 32; j++) {
    //     wsPointData[i * 32 + j] = wsPointData[i * 32 + j] * (1 + Math.floor(i / 8)*compen/100)
    //   }
    // }

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + j], wsPointData[(14 - i) * 32 + j]] = [wsPointData[(14 - i) * 32 + j], wsPointData[i * 32 + j]]
      }
    }

    const arr1 = wsPointData.splice(0, 15 * 32)
    wsPointData = wsPointData.concat(arr1)

    // wsPointData = smallBedZero(wsPointData, 32, 32)
    // wsPointData = pressSmallBed({ arr: wsPointData })

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + j], wsPointData[(16 - i) * 32 + j]] = [wsPointData[(16 - i) * 32 + j], wsPointData[i * 32 + j]]
      }
    }

    // wsPointData = rotate90(wsPointData, 32, 32)
    return wsPointData
  },
  jqbed(arr) {
    let wsPointData = [...arr];
    // 1-15行调换
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + j], wsPointData[(14 - i) * 32 + j]] = [
          wsPointData[(14 - i) * 32 + j],
          wsPointData[i * 32 + j],
        ];
      }
    }

    let b = wsPointData.splice(0, 15 * 32);

    wsPointData = wsPointData.concat(b);
    // wsPointData = press6(wsPointData, 32, 32, 'col')
    return wsPointData
  },
  carYLine(arr) {
    let wsPointData = [...arr];
    // 1-15行调换
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + j], wsPointData[(14 - i) * 32 + j]] = [
          wsPointData[(14 - i) * 32 + j],
          wsPointData[i * 32 + j],
        ];
      }
    }

    let b = wsPointData.splice(0, 15 * 32);

    wsPointData = wsPointData.concat(b);
    // wsPointData = press6(wsPointData, 32, 32, 'col')
    return wsPointData
  },
  smallBedReal(wsPointData) {

    // for (let i = 0; i < 32; i++) {
    //   for (let j = 0; j < 32; j++) {
    //     wsPointData[i * 32 + j] = wsPointData[i * 32 + j] * (1 + Math.floor(i / 8)*compen/100)
    //   }
    // }

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + j], wsPointData[(14 - i) * 32 + j]] = [wsPointData[(14 - i) * 32 + j], wsPointData[i * 32 + j]]
      }
    }



    const arr1 = wsPointData.splice(0, 15 * 32)
    wsPointData = wsPointData.concat(arr1)

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + j], wsPointData[(16 - i) * 32 + j]] = [wsPointData[(16 - i) * 32 + j], wsPointData[i * 32 + j]]
      }
    }

    // wsPointData = smallBedZero(wsPointData, 32, 32)

    return wsPointData
  },
  smallBed1(wsPointData) {

    // for (let i = 0; i < 32; i++) {
    //   for (let j = 0; j < 32; j++) {
    //     wsPointData[i * 32 + j] = wsPointData[i * 32 + j] * (1 + Math.floor(i / 8)*compen/100)
    //   }
    // }

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + j], wsPointData[(14 - i) * 32 + j]] = [wsPointData[(14 - i) * 32 + j], wsPointData[i * 32 + j]]
      }
    }

    const arr1 = wsPointData.splice(0, 15 * 32)
    wsPointData = wsPointData.concat(arr1)

    // wsPointData = zeroLine(wsPointData,32,32)
    // wsPointData = smallBedZero(wsPointData, 32, 32)
    // wsPointData = pressSmallBed({ arr: wsPointData })

    // for (let i = 0; i < 8; i++) {
    //   for (let j = 0; j < 32; j++) {
    //     [wsPointData[i * 32 + j], wsPointData[(16 - i) * 32 + j]] = [wsPointData[(16 - i) * 32 + j], wsPointData[i * 32 + j]]
    //   }
    // }

    // wsPointData = rotate90(wsPointData, 32, 32)
    return wsPointData
  },
  smallBedReal1(wsPointData) {

    // for (let i = 0; i < 32; i++) {
    //   for (let j = 0; j < 32; j++) {
    //     wsPointData[i * 32 + j] = wsPointData[i * 32 + j] * (1 + Math.floor(i / 8)*compen/100)
    //   }
    // }

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + j], wsPointData[(14 - i) * 32 + j]] = [wsPointData[(14 - i) * 32 + j], wsPointData[i * 32 + j]]
      }
    }



    const arr1 = wsPointData.splice(0, 15 * 32)
    wsPointData = wsPointData.concat(arr1)

    // let colArr = [];
    // for (let i = 0; i < height; i++) {
    //   let total = 0;
    //   for (let j = 0; j < width; j++) {
    //     total += wsPointData[j * height + i];
    //   }
    //   colArr.push(total);
    // }

    // const badIndex = []
    // for (let i = 1; i < colArr.length - 2; i++) {
    //   if (colArr[i] > (colArr[i - 1] + colArr[i + 1]) * 2){
    //     badIndex.push(i)
    //   }
    // }

    // for(let i = 0 ; i < 32 ; i ++ ){
    //   for(let j = badIndex[0] ; j < badIndex.length ; j++){
    //     wsPointData[j] =  (wsPointData[j - 1] +  wsPointData[j + 1])/2
    //   }
    // }
    // wsPointData = smallBedZero(wsPointData, 32, 32)
    // wsPointData = wsPointData.map((a) => a < 11 ? 0 : a)
    // wsPointData = pressSmallBed({ arr: wsPointData, width: 32, height: 32, type: 'col', num: 945 })

    // wsPointData = rotate90(wsPointData, 32, 32)
    return wsPointData
  },
  zeroLine(arr, max = 100, min = 40) {
    let wsPointData = [...arr];
    let colArr = [],
      rowArr = [];
    for (let i = 0; i < 32; i++) {
      let coltotal = 0,
        rowtotal = 0;
      for (let j = 0; j < 32; j++) {
        coltotal += wsPointData[j * 32 + i];
        rowtotal += wsPointData[i * 32 + j];
      }
      colArr.push(coltotal);
      rowArr.push(rowtotal);
    }

    for (let i = 1; i < 31; i++) {
      if (rowArr[i + 1] > max && rowArr[i] < min && rowArr[i - 1] > max) {
        for (let j = 0; j < 32; j++) {
          wsPointData[i * 32 + j] =
            (wsPointData[(i - 1) * 32 + j] + wsPointData[(i + 1) * 32 + j]) / 2;
        }
      }
    }

    for (let i = 1; i < 31; i++) {
      if (colArr[i + 1] > max && colArr[i] < min && colArr[i - 1] > max) {
        // console.log(i)
        for (let j = 0; j < 32; j++) {
          wsPointData[j * 32 + i] = (wsPointData[(j) * 32 + i - 1] + wsPointData[(j) * 32 + i + 1]) / 2;
        }
      }
    }
    return wsPointData;
  },
  smallBedZero(arr, height, width) {
    let wsPointData = [...arr]
    for (let i = 0; i < 32; i++) {
      wsPointData[20 + i * 32] = (wsPointData[20 - 1 + i * 32] + wsPointData[20 + 1 + i * 32]) / 2
    }
    return wsPointData
  },

  smallM(wsPointData) {
    let newArr = []
    for (let i = 0; i < 32; i++) {
      if (i == 4 || i == 12 || i == 24) {
        continue;
      }
      for (let j = 22; j < 32; j++) {
        newArr.push(wsPointData[i * 32 + j])
      }
      if (i == 6 || i == 15 || i == 26) {
        for (let j = 22; j < 32; j++) {
          newArr.push(wsPointData[i * 32 + j])
        }
      }
    }
    const newArr2 = []
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 10; j++) {
        if (j == 4) {
          continue;
        }
        if (j == 2 || j == 3) {
          newArr2[i * 10 + j + 1] = newArr[i * 10 + j]
          continue;
        }
        newArr2[i * 10 + j] = newArr[i * 10 + j]
        if (j == 1) {
          newArr2[i * 10 + j + 1] = newArr[i * 10 + j]
        }

      }
    }

    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 2; j++) {
        [newArr2[i * 10 + j], newArr2[i * 10 + 4 - j]] = [newArr2[i * 10 + 4 - j], newArr2[i * 10 + j],]
      }
    }
    return newArr2
  },
  smallM1(wsPointData) {
    let newArr = []
    for (let j = 0; j < 32; j++) {
      for (let i = 22; i < 32; i++) {
        newArr.push(wsPointData[i * 32 + j])
      }
    }
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 2; j++) {
        [newArr[i * 10 + j], newArr[i * 10 + 4 - j]] = [newArr[i * 10 + 4 - j], newArr[i * 10 + j],]
      }
    }
    return newArr
  },
  rect(wsPointData) {
    let newArr = []
    for (let i = 22; i < 32; i++) {
      for (let j = 0; j < 16; j++) {
        newArr.push(wsPointData[i * 32 + j])
      }
    }

    for (let i = 0; i < 10; i++) {
      for (let j = 7; j < 12; j++) {
        [newArr[i * 16 + j], newArr[i * 16 + 11 - j + 11]] = [newArr[i * 16 + 11 + 11 - j], newArr[i * 16 + j],]
      }
    }

    const newArr2 = []
    for (let j = 0; j < 16; j++) {
      for (let i = 0; i < 10; i++) {
        newArr2.push(newArr[i * 16 + j])
      }
    }
    return newArr2
  },
  short(wsPointData) {
    let newArr = []
    // for (let i = 22; i < 32; i++) {
    //   for (let j = 0; j < 16; j++) {
    //     newArr.push(wsPointData[i * 32 + j])
    //   }
    // }

    for (let i = 0; i < 32; i++) {
      for (let j = 16; j < 24; j++) {
        [wsPointData[i * 32 + j], wsPointData[i * 32 + 16 - j + 31]] = [wsPointData[i * 32 + 16 + 31 - j], wsPointData[i * 32 + j],]
      }
    }

    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 16; j++) {
        [wsPointData[i * 32 + j], wsPointData[i * 32 - j + 31]] = [wsPointData[i * 32 + 31 - j], wsPointData[i * 32 + j],]
      }
    }

    // const newArr2 = []
    // for (let j = 0; j < 16; j++) {
    //   for (let i = 0; i < 10; i++) {

    //     newArr2.push(newArr[i * 16 + j])
    //   }
    // }
    return wsPointData
  },
  handLine(arr, flag) {
    let wsPointData = [...arr];
    // let b = wsPointData.splice(0, 17 * 32)
    // wsPointData = wsPointData.concat(b)

    // 串线删除
    // for (let i = 0; i < 32; i++) {
    //   wsPointData[i * 32 + 14] = 0
    //   wsPointData[i * 32 + 19] = 0
    // }

    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 9; j++) {
        [wsPointData[i * 32 + 15 + j], wsPointData[i * 32 + 15 + 16 - j]] = [
          wsPointData[i * 32 + 15 + 16 - j],
          wsPointData[i * 32 + 15 + j],
        ];
      }
    }

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[i * 32 + j], wsPointData[(15 - i) * 32 + j]] = [
          wsPointData[(15 - i) * 32 + j],
          wsPointData[i * 32 + j],
        ];
      }
    }

    if (flag) {
      wsPointData = press(wsPointData);
    }
    wsPointData = rotateMatrixsit180(wsPointData, 32, 32);
    return wsPointData;
  },
  matColLine(arr) {
    let newArr = []
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 10; j++) {
        newArr.push(arr[i * 32 + j])
      }
    }

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 10; j++) {
        [newArr[(i) * 10 + j], newArr[(7 - i) * 10 + j]] = [newArr[(7 - i) * 10 + j], newArr[(i) * 10 + j]]
      }
    }

    const arr1 = newArr.splice(0, 10 * 8)
    newArr = newArr.concat(arr1)

    return newArr;
  },
  yanfeng10sit(arr) {
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

    // for (let i = 0; i < 5; i++) {
    //   for (let j = 0; j < 10; j++) {
    //     [newData[( i) * 10 + j], newData[(5 + 4 - i) * 10 + j]] = [newData[(5 + 4 - i) * 10 + j], newData[( i) * 10 + j]]
    //   }
    // }

    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 5; j++) {
        [newData[(i) * 10 + j], newData[(i) * 10 + 9 - j]] = [newData[(i) * 10 + 9 - j], newData[(i) * 10 + j]]
      }
    }
    return newData
  },
  wowhead(arr) {
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

    // for (let i = 0; i < 5; i++) {
    //   for (let j = 0; j < 10; j++) {
    //     [newData[( i) * 10 + j], newData[(5 + 4 - i) * 10 + j]] = [newData[(5 + 4 - i) * 10 + j], newData[( i) * 10 + j]]
    //   }
    // }

    // for (let i = 0; i < 10; i++) {
    //   for (let j = 0; j < 5; j++) {
    //     [newData[(i) * 10 + j], newData[(i) * 10 + 9 - j]] = [newData[(i) * 10 + 9 - j], newData[(i) * 10 + j]]
    //   }
    // }

    // for (let i = 0; i < 5; i++) {
    //   for (let j = 0; j < 10; j++) {
    //     [newData[i * 10 + j], newData[(9 - i) * 10 + j]] = [100, newData[(i) * 10 + j]]
    //   }
    // }

    // for (let i = 0; i < 32; i++) {
    //   for (let j = 0; j < 16; j++) {
    //     const a = wsPointData[i * 32 + j]
    //     wsPointData[i * 32 + j] = wsPointData[i * 32 + 16 + j]
    //     wsPointData[i * 32 + 16 + j] = a
    //   }
    // }

    // newData = new Array(100).fill(100)
    return newData
  },
  yanfeng10back(arr) {
    let newData = []
    for (let i = 6; i < 16; i++) {
      for (let j = 0; j < 10; j++) {
        newData.push(arr[i * 32 + j])
      }
    }

    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 10; j++) {
        [newData[(i) * 10 + j], newData[(4 - i) * 10 + j]] = [newData[(4 - i) * 10 + j], newData[(i) * 10 + j]]
      }
    }
    newData = rotate90(newData, 10, 10)

    return newData
  },
  handBlue(arr) {
    let wsPointData = [...arr]
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 32; j++) {
        [wsPointData[(16 + i) * 32 + j], wsPointData[(16 + 15 - i) * 32 + j]] = [wsPointData[(16 + 15 - i) * 32 + j], wsPointData[(16 + i) * 32 + j],]
      }
    }

    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 8; j++) {
        [wsPointData[(i) * 32 + j], wsPointData[(i) * 32 + 14 - j]] = [wsPointData[(i) * 32 + 14 - j], wsPointData[(i) * 32 + j],]
      }
    }

    wsPointData = zeroLine(wsPointData)
    return wsPointData
  }, carCol(arr) {
    const wsPointData = [...arr]
    let newData = []
    for (let i = 6; i < 16; i++) {
      for (let j = 0; j < 9; j++) {
        newData.push(wsPointData[i * 32 + j])
      }
    }

    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 9; j++) {
        [newData[i * 9 + j], newData[(4 - i) * 9 + j]] = [newData[(4 - i) * 9 + j], newData[(i) * 9 + j]]
      }
    }

    let newArr = []

    newData[2 * 9 + 4] = 0
    newData[3 * 9 + 4] = 0
    newData[4 * 9 + 4] = 0
    newData[5 * 9 + 4] = 0
    newData[6 * 9 + 4] = 0
    newData[7 * 9 + 4] = 0
    newData[8 * 9 + 4] = 0

    for (let j = 0; j < 9; j++) {
      for (let i = 0; i < 10; i++) {
        newArr.push(newData[i * 9 + j])
      }
    }
    return newArr
  },
  gloves0123(wsPointData) {
    let handData = []
    for (let j = 9; j >= 7; j--) {
      // for (let i = 15; i > 5; i--) {
      for (let i = 0; i < 10; i++) {
        handData.push(wsPointData[i * 10 + j])
      }
    }

    /**
     * 手指和手掌间的数据
     */

    for (let j = 6; j >= 5; j--) {
      // for (let i = 13; i > 5; i--) {
      for (let i = 2; i < 10; i++) {
        handData.push(wsPointData[i * 10 + j])
      }
    }

    for (let j = 4; j >= 0; j--) {
      // for (let i = 15; i > 5; i--)   {
      for (let i = 0; i < 10; i++) {
        handData.push(wsPointData[i * 10 + j])
      }
    }


    // return handData

    const glovesPoints = [[10, 2], [10, 3], [4, 7], [4, 8], [2, 14], [2, 15], [3, 21], [3, 22], [15, 27], [15, 28], [12, 4], [12, 5], [8, 9], [8, 10], [7, 14], [7, 15], [7, 20], [7, 21], [17, 26], [17, 27], [14, 6], [14, 7], [12, 10], [12, 11], [11, 14], [11, 15], [11, 19], [11, 20], [19, 24], [19, 25], [16, 11], [16, 12], [16, 13], [16, 14], [16, 15], [16, 16], [16, 17], [16, 18], [19, 11], [19, 12], [19, 13], [19, 14], [19, 15], [19, 16], [19, 17], [19, 18], [22, 11], [22, 12], [22, 13], [22, 14], [22, 15], [22, 16], [22, 17], [22, 18], [22, 19], [22, 20], [23, 11], [23, 12], [23, 13], [23, 14], [23, 15], [23, 16], [23, 17], [23, 18], [23, 19], [23, 20], [24, 11], [24, 12], [24, 13], [24, 14], [24, 15], [24, 16], [24, 17], [24, 18], [24, 19], [24, 20], [25, 11], [25, 12], [25, 13], [25, 14], [25, 15], [25, 16], [25, 17], [25, 18], [25, 19], [25, 20], [26, 11], [26, 12], [26, 13], [26, 14], [26, 15], [26, 16], [26, 17], [26, 18], [26, 19], [26, 20]]

    let newZeroArr = new Array(1024).fill(0)

    for (let i = 0; i < 3 * 10 + 2 * 8; i++) {
      newZeroArr[glovesPoints[i][0] * 32 + glovesPoints[i][1]] = handData[i]
      newZeroArr[(glovesPoints[i][0] + 1) * 32 + glovesPoints[i][1]] = handData[i]
    }
    for (let i = 3 * 10 + 2 * 8; i < 3 * 10 + 2 * 8 + 5 * 10; i++) {
      newZeroArr[glovesPoints[i][0] * 32 + glovesPoints[i][1]] = handData[i]
    }

    newZeroArr = rotate90(newZeroArr, 32, 32)
    // console.log(newZeroArr)
    return newZeroArr
  },
  gloves0123Res(wsPointData) {
    let resData = []
    for (let i = 8; i < 16; i++) {
      // arr[k] = []
      for (let j = 6; j < 16; j++) {
        // arr[k].push(wsPointData[i * 16 + j])
        resData.push(wsPointData[i * 16 + j])
      }
      // k++
    }

    for (let i = 0; i < 2; i++) {
      // arr[k] = []
      for (let j = 6; j < 16; j++) {
        // arr[k].push(wsPointData[i * 16 + j])
        resData.push(wsPointData[i * 16 + j])
      }
      // k++
    }

    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 2; j++) {
        [resData[i * 10 + j], resData[i * 10 + 4 - j]] = [resData[i * 10 + 4 - j], resData[i * 10 + j],]
      }
    }

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 10; j++) {
        [resData[i * 10 + j], resData[(9 - i) * 10 + j]] = [resData[(9 - i) * 10 + j], resData[i * 10 + j],]
      }
    }


    return resData
  }, handR(arr) {
    let adcArr = [240, 239, 238, 256, 255, 254, 16, 15, 14, 32, 31, 30, 237, 236, 235, 253, 252, 251, 13, 12, 11, 29, 28, 27, 234, 233, 232, 250, 249, 248, 10, 9, 8, 26, 25, 24, 231, 230, 229,
      247, 246, 245, 7, 6, 5, 23, 22, 21, 228, 227, 226, 244, 243, 242, 4, 3, 2, 20, 19, 18, 47, 44, 41, 38, 35, 61, 60, 59, 58, 57, 56, 55, 54, 53, 52, 51, 50, 80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82, 112, 111, 110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100, 99, 98, 128, 127, 126, 125, 124, 123, 122, 121, 120, 119, 118, 117, 116, 115, 114]


    adcArr = adcArr.map((a) => a - 1)


    const finger1 = adcArr.splice(0, 12)
    const finger2 = adcArr.splice(0, 12)
    const finger3 = adcArr.splice(0, 12)
    const finger4 = adcArr.splice(0, 12)
    const finger5 = adcArr.splice(0, 12)
    const fingerArr = [finger1, finger2, finger3, finger4, finger5]


    const res = new Array(147).fill(0)
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 5; k++) {
        for (let j = 0; j < 3; j++) {
          res[i * 15 + k * 3 + j] = arr[fingerArr[k][i * 3 + j]]
        }
      }
    }

    const fingerMiddleHand = adcArr.splice(0, 5)
    let handArr = adcArr.splice(0, 72)



    // handArr = [0, 0, 0, ...handArr]


    for (let i = 0; i < 5; i++) {
      res[15 * 4 + 1 + i * 3] = arr[fingerMiddleHand[i]]
    }

    console.log(handArr.length, 'handArr')

    for (let i = 0; i < handArr.length; i++) {
      res[15 * 5 + i] = arr[handArr[i]]
    }

    return res
  }, handRVideo1470506(arr) {

    let handArr = handR(arr)


    // const res = []
    // for(let i = 0 ; i < 5 ; i ++){
    //   for(let j = 0 ; j < 15 ; j ++){
    //     res.push()
    //   }
    // }

    // // return handArr
    // // const handPointArr2D = [[15, 3], [15, 4], [15, 5], [3, 13], [3, 14], [3, 15], [2, 18], [2, 19], [2, 20], [3, 22], [3, 23], [3, 24], [5, 26], [5, 27], [5, 28], [16, 3], [16, 4], [16, 5], [4, 13], [4, 14], [4, 15], [3, 18], [3, 19], [3, 20], [4, 22], [4, 23], [4, 24], [6, 26], [6, 27], [6, 28], [17, 3], [17, 4], [17, 5], [5, 13], [5, 14], [5, 15], [4, 18], [4, 19], [4, 20], [5, 22], [5, 23], [5, 24], [7, 26], [7, 27], [7, 28], [18, 3], [18, 4], [18, 5], [6, 13], [6, 14], [6, 15], [5, 18], [5, 19], [5, 20], [6, 22], [6, 23], [6, 24], [8, 26], [8, 27], [8, 28], [22, 6], [22, 7], [22, 8], [12, 14], [12, 15], [12, 16], [11, 18], [11, 19], [11, 20], [12, 21], [12, 22], [12, 23], [13, 25], [13, 26], [13, 27], [19, 16], [19, 17], [19, 18], [19, 19], [19, 20], [19, 21], [19, 22], [19, 23], [19, 24], [19, 25], [19, 26], [19, 27], [21, 13], [21, 14], [21, 15], [21, 16], [21, 17], [21, 18], [21, 19], [21, 20], [21, 21], [21, 22], [21, 23], [21, 24], [21, 25], [21, 26], [21, 27], [23, 13], [23, 14], [23, 15], [23, 16], [23, 17], [23, 18], [23, 19], [23, 20], [23, 21], [23, 22], [23, 23], [23, 24], [23, 25], [23, 26], [23, 27], [25, 13], [25, 14], [25, 15], [25, 16], [25, 17], [25, 18], [25, 19], [25, 20], [25, 21], [25, 22], [25, 23], [25, 24], [25, 25], [25, 26], [25, 27], [27, 13], [27, 14], [27, 15], [27, 16], [27, 17], [27, 18], [27, 19], [27, 20], [27, 21], [27, 22], [27, 23], [27, 24], [27, 25], [27, 26], [27, 27]]
    // const handPointArr3D = [[16,3],[16,4],[16,5],[3,13],[3,14],[3,15],[3,18],[3,19],[3,20],[3,22],[3,23],[3,24],[5,26],[5,27],[5,28],[17,3],[17,4],[17,5],[4,13],[4,14],[4,15],[4,18],[4,19],[4,20],[4,22],[4,23],[4,24],[6,26],[6,27],[6,28],[18,4],[18,5],[18,6],[5,13],[5,14],[5,15],[5,18],[5,19],[5,20],[5,22],[5,23],[5,24],[7,26],[7,27],[7,28],[19,4],[19,5],[19,6],[6,13],[6,14],[6,15],[6,18],[6,19],[6,20],[6,22],[6,23],[6,24],[8,26],[8,27],[8,28],[23,6],[23,7],[23,8],[11,14],[11,15],[11,16],[11,18],[11,19],[11,20],[11,22],[11,23],[11,24],[11,26],[11,27],[11,28],[20,16],[20,17],[20,18],[20,19],[20,20],[20,21],[20,22],[20,23],[20,24],[20,25],[20,26],[20,27],[22,13],[22,14],[22,15],[22,16],[22,17],[22,18],[22,19],[22,20],[22,21],[22,22],[22,23],[22,24],[22,25],[22,26],[22,27],[24,13],[24,14],[24,15],[24,16],[24,17],[24,18],[24,19],[24,20],[24,21],[24,22],[24,23],[24,24],[24,25],[24,26],[24,27],[26,13],[26,14],[26,15],[26,16],[26,17],[26,18],[26,19],[26,20],[26,21],[26,22],[26,23],[26,24],[26,25],[26,26],[26,27],[28,13],[28,14],[28,15],[28,16],[28,17],[28,18],[28,19],[28,20],[28,21],[28,22],[28,23],[28,24],[28,25],[28,26],[28,27],[30,13],[30,14],[30,15],[30,16],[30,17],[30,18],[30,19],[30,20],[30,21],[30,22],[30,23],[30,24],[30,25],[30,26],[30,27]]
    // const handPointArr = [
    //   [12,1],[12,2],[12,3],[3,3],[3,4],[3,5],[1,13],[1,14],[1,15],[5,21],[5,22],[5,23],[22,30],[23,30],[24,30],
    //   [13,1],[13,2],[13,3],[4,4],[4,5],[4,6],[2,13],[2,14],[2,15],[6,20],[6,21],[6,22],[22,29],[23,29],[24,29],
    //   [14,2],[14,3],[14,4],[5,4],[5,5],[5,6],[3,12],[3,13],[3,14],[7,20],[7,21],[7,22],[22,28],[23,28],[24,28],
    //   [15,3],[15,4],[15,5],[6,4],[6,5],[6,6],[4,12],[4,13],[4,14],[8,19],[8,20],[8,21],[22,27],[23,27],[24,27],
    //   [17,3],[17,4],[17,5],[9,6],[9,7],[9,8],[8,12],[8,13],[8,14],[11,18],[11,19],[11,20],[22,24],[23,24],[24,24],
    //   [16,8],[16,9],[16,10],[16,11],[16,12],[16,13],[16,14],[16,15],[16,16],[16,17],
    //   [18,8],[18,9],[18,10],[18,11], [18,12],[18,13],[18,14],[18,15],[18,16],[18,17],[20,8],[20,9],[20,10],[20,11],[20,12],[20,13],[20,14],[20,15],
    //   [20,16],[20,17],[22,8],[22,9],[22,10],[22,11],[22,12],[22,13],[22,14],[22,15],[22,16],[22,17],[24,8],[24,9],[24,10],[24,11],[24,12],[24,13],[24,14],[24,15],[24,16],[24,17]]

    let handPointArr = [
      [21, 3], [20, 3], [19, 3], [3, 10], [3, 11], [3, 12], [0, 15], [0, 16], [0, 17], [2, 23], [2, 24], [2, 25], [7, 27], [7, 28], [7, 29],
      [21, 4], [20, 4], [19, 4], [4, 10], [4, 11], [4, 12], [1, 15], [1, 16], [1, 17], [3, 23], [3, 24], [3, 25], [8, 27], [8, 28], [8, 29],
      [22, 5], [21, 5], [20, 5], [5, 10], [5, 11], [5, 12], [2, 16], [2, 17], [2, 18], [4, 23], [4, 24], [4, 25], [9, 27], [9, 28], [9, 29],
      [22, 6], [21, 6], [20, 6], [6, 11], [6, 12], [6, 13], [3, 16], [3, 17], [3, 18], [5, 23], [5, 24], [5, 25], [10, 27], [10, 28], [10, 29],
      [23, 8], [22, 8], [21, 8], [10, 12], [10, 13], [10, 14], [9, 17], [9, 18], [9, 19], [9, 22], [9, 23], [9, 24], [12, 26], [12, 27], [12, 28],
      [15, 18], [15, 18], [15, 19], [15, 20], [15, 21], [15, 22], [15, 23], [15, 24], [15, 25], [15, 26], [15, 27], [15, 28],
      [17, 15], [17, 15], [17, 16], [17, 17], [17, 18], [17, 19], [17, 20], [17, 21], [17, 22], [17, 23], [17, 24], [17, 25], [17, 26], [17, 27], [17, 28],
      [19, 15], [19, 15], [19, 16], [19, 17], [19, 18], [19, 19], [19, 20], [19, 21], [19, 22], [19, 23], [19, 24], [19, 25], [19, 26], [19, 27], [19, 28],
      [21, 15], [21, 15], [21, 16], [21, 17], [21, 18], [21, 19], [21, 20], [21, 21], [21, 22], [21, 23], [21, 24], [21, 25], [21, 26], [21, 27], [21, 28],
      [23, 15], [23, 15], [23, 16], [23, 17], [23, 18], [23, 19], [23, 20], [23, 21], [23, 22], [23, 23], [23, 24], [23, 25], [23, 26], [23, 27], [23, 28]]

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        for (let k = 0; k < 3; k++) {
          if (j == 0) {
            // handPointArr[i*15 + j*3 + k][0] = handPointArr[i*15 + j*3 + k][0] - 2
            handPointArr[i * 15 + j * 3 + k][1] = handPointArr[i * 15 + j * 3 + k][1] - 1
          }

          // if (j == 1) {
          //   // handPointArr[i*15 + j*3 + k][0] = handPointArr[i*15 + j*3 + k][0] - 2
          //   handPointArr[i * 15 + j * 3 + k][1] = handPointArr[i * 15 + j * 3 + k][1] + 1
          // }

          // if(j == 2){
          //   // handPointArr[i*15 + j*3 + k][0] = handPointArr[i*15 + j*3 + k][0] - 2
          //   handPointArr[i*15 + j*3 + k][1] = handPointArr[i*15 + j*3 + k][1] - 2
          // }

          if (j == 3) {
            // handPointArr[i*15 + j*3 + k][0] = handPointArr[i*15 + j*3 + k][0] - 2
            handPointArr[i * 15 + j * 3 + k][1] = handPointArr[i * 15 + j * 3 + k][1] - 1
          }

          if (j == 4) {
            // handPointArr[i*15 + j*3 + k][0] = handPointArr[i*15 + j*3 + k][0] - 2
            handPointArr[i * 15 + j * 3 + k][1] = handPointArr[i * 15 + j * 3 + k][1] - 1
          }
        }
      }
    }

    // 手指翻转数组
    // for (let i = 0; i < 5; i++) {
    //   for (let j = 0; j < 15; j++) {
    //     [handPointArr[i * 15 + j], handPointArr[i * 15 + 14 - j]] = [handPointArr[i * 15 + 14 - j], handPointArr[i * 15 + j],]
    //   }
    // }


    // for (let j = 0; j < 15; j++) {
    //   [handPointArr[5 * 15 + j], handPointArr[5 * 15 + 14 - j]] = [handPointArr[5 * 15 + 14 - j], handPointArr[5 * 15 + j],]
    // }

    // for (let i = 6; i < 10; i++) {
    //   for (let j = 0; j < 15; j++) {
    //     [handPointArr[i * 15 + j], handPointArr[i * 15 + 14 - j]] = [handPointArr[i * 15 + 14 - j], handPointArr[i * 15 + j],]
    //   }
    // }


    handPointArr = handPointArr.map((a) => [a[0] + 1, a[1]])
    let newZeroArr = new Array(1024).fill(0)
    // for(let i = 0 ; i < )
    handPointArr.forEach((a, index) => {

      if ([0, 15, 30, 45, 60].includes(index)) {

      } else if ([1, 2, 16, 17, 31, 32, 46, 47, 61, 62].includes(index)) {
        newZeroArr[(a[0]) * 32 + 31 - a[1]] = handArr[index]
      } else {
        newZeroArr[(a[0]) * 32 + 31 - a[1]] = handArr[index]
        newZeroArr[(a[0] + 1) * 32 + 31 - a[1]] = handArr[index]
      }

      // newZeroArr[(a[0] + 2) * 32 + a[1]] = handArr[index]
    })

    // for(let i = 0 ; i < 32 ; i++){
    //   for(let j = 0 ; j < 32 ; j++){
    //     [newZeroArr[i*32 + j] ,newZeroArr[i*32 + 31-j]] = [newZeroArr[i*32 + j] ,newZeroArr[i*32 + 31-j]]
    //   }
    // }

    newZeroArr = rotate90(newZeroArr, 32, 32)
    // console.log(newZeroArr)
    return newZeroArr
  }, footR(arr) {
    const footArr = []
    let adcArr = [23, 7, 247, 231, 215, 199, 24, 8, 248, 232, 216, 200, 25, 9, 249, 233, 217, 201, 26, 10, 250, 234, 218, 202, 27, 11, 251, 235, 219, 203, 28, 12, 252, 236, 220, 204, 29, 13, 253, 237, 221, 205, 30, 14, 254, 238, 222, 206, 31, 15, 255, 239, 223, 207, 32, 16, 256, 240, 224, 208]
    adcArr.forEach((a, index) => {
      footArr[index] = arr[a - 1]
    })
    return footArr
  }, footVideo1(arr) {
    const footArr = []
    let adcArr = [23, 7, 247, 231, 215, 199, 24, 8, 248, 232, 216, 200, 25, 9, 249, 233, 217, 201, 26, 10, 250, 234, 218, 202, 27, 11, 251, 235, 219, 203, 28, 12, 252, 236, 220, 204, 29, 13, 253, 237, 221, 205, 30, 14, 254, 238, 222, 206, 31, 15, 255, 239, 223, 207, 32, 16, 256, 240, 224, 208]

    // for (let i = 0; i < 10; i++) {
    //   for (let j = 0; j < 6; j++) {
    //     footArr.push(arr[(13 - j) * 16 + 15 - i])
    //   }
    // }
    adcArr.forEach((a, index) => {
      footArr[index] = arr[a - 1]
    })

    // let footPointArr = [
    //   [8, 10], [8, 13], [8, 16], [8, 19], [8, 21], [8, 24],
    //   [13, 8], [13, 11], [13, 15], [13, 18], [13, 22], [13, 25],
    //   [18, 7], [18, 11], [18, 14], [18, 18], [18, 22], [18, 25],
    //   [23, 7], [23, 10], [23, 14], [23, 17], [23, 20], [23, 23],
    //   [28, 7], [28, 10], [28, 13], [28, 16], [28, 18], [28, 21],
    //   [33, 8], [33, 11], [33, 13], [33, 15], [33, 18], [33, 20],
    //   [38, 9], [38, 11], [38, 13], [38, 16], [38, 19], [38, 21],
    //   [43, 9], [43, 11], [43, 14], [43, 17], [43, 19], [43, 22],
    //   [48, 10], [48, 12], [48, 14], [48, 17], [48, 19], [48, 22],
    //   [53, 11], [53, 13], [53, 15], [53, 17], [53, 19], [53, 21]]

    // let footPointArr = [[8, 21], [8, 18], [8, 15], [8, 12], [8, 10], [8, 7], [13, 23], [13, 20], [13, 16], [13, 13], [13, 9], [13, 6], [18, 24], [18, 20], [18, 17], [18, 13], [18, 9], [18, 6], [23, 24], [23, 21], [23, 17], [23, 14], [23, 11], [23, 8], [28, 24], [28, 21], [28, 18], [28, 15], [28, 13], [28, 10], [33, 23], [33, 20], [33, 18], [33, 16], [33, 13], [33, 11], [38, 22], [38, 20], [38, 18], [38, 15], [38, 12], [38, 10], [43, 22], [43, 20], [43, 17], [43, 14], [43, 12], [43, 9], [48, 21], [48, 19], [48, 17], [48, 14], [48, 12], [48, 9], [53, 20], [53, 18], [53, 16], [53, 14], [53, 12], [53, 10]]
    let footPointArr = [
      [8, 10], [8, 13], [8, 16], [8, 19], [8, 21], [8, 24],
      [13, 8], [13, 11], [13, 15], [13, 18], [13, 22], [13, 25],
      [18, 7], [18, 11], [18, 14], [18, 18], [18, 22], [18, 25],
      [23, 7], [23, 10], [23, 14], [23, 17], [23, 20], [23, 23],
      [28, 7], [28, 10], [28, 13], [28, 16], [28, 18], [28, 21],
      [33, 8], [33, 11], [33, 13], [33, 15], [33, 18], [33, 20],
      [38, 9], [38, 11], [38, 13], [38, 16], [38, 19], [38, 21],
      [43, 9], [43, 11], [43, 14], [43, 17], [43, 19], [43, 22],
      [48, 10], [48, 12], [48, 14], [48, 17], [48, 19], [48, 22],
      [53, 11], [53, 13], [53, 15], [53, 17], [53, 19], [53, 21]]


    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 3; j++) {
        [footPointArr[i*6 + (5-j)] , footPointArr[i*6 + (j)]] = [footPointArr[i*6 + (j)] ,footPointArr[i*6 + (5-j)] ] 
      }
    }

    footPointArr = footPointArr.map((a) => {
      return [a[0], 31 - a[1]]
    })

    const colArr = [8, 13, 18, 23, 28, 33, 38, 43, 48, 53]

    const newArr = new Array(32 * 64).fill(0)

    footPointArr.forEach((a, index) => {
      newArr[a[0] * 32 + a[1]] = footArr[index]
    })

    for (let i = 0; i < 10; i++) {
      for (let j = 1; j < 6; j++) {
        const col = footPointArr[i * 6 + j][0]
        const length = footPointArr[i * 6 + j][1] - footPointArr[i * 6 + j - 1][1]
        const firstIndex = footPointArr[i * 6 + j - 1][1]
        const lastIndex = footPointArr[i * 6 + j][1]
        const firstValue = newArr[col * 32 + firstIndex]
        const lastValue = newArr[col * 32 + lastIndex]
        const cha = lastValue - firstValue
        for (let k = 1; k < length; k++) {
          // newArr[a[0] * 32 + a[1]]
          newArr[col * 32 + firstIndex + k] = firstValue + Math.floor(cha * 10 / length) / 10
        }
      }
    }

    for (let i = 0; i < 9; i++) {
      const col = footPointArr[i * 6 + 0][0]
      const nextCol = footPointArr[(i + 1) * 6 + 0][0]
      const firstIndex = footPointArr[i * 6 + 0][1]
      const lastIndex = footPointArr[i * 6 + 5][1]
      // console.log(newArr[(nextCol) * 32 + 1] , newArr[(col) * 32 + 1])
      for (let j = firstIndex; j <= lastIndex; j++) {
        newArr[(col + 1) * 32 + j] = newArr[(col) * 32 + j] + Math.floor((newArr[(nextCol) * 32 + j] - newArr[(col) * 32 + j]) * 10 * 1 / 5) / 10
        newArr[(col + 2) * 32 + j] = newArr[(col) * 32 + j] + Math.floor((newArr[(nextCol) * 32 + j] - newArr[(col) * 32 + j]) * 10 * 2 / 5) / 10
        newArr[(col + 3) * 32 + j] = newArr[(col) * 32 + j] + Math.floor((newArr[(nextCol) * 32 + j] - newArr[(col) * 32 + j]) * 10 * 3 / 5) / 10
        newArr[(col + 4) * 32 + j] = newArr[(col) * 32 + j] + Math.floor((newArr[(nextCol) * 32 + j] - newArr[(col) * 32 + j]) * 10 * 4 / 5) / 10
      }
    }





    // for(let i = 0 ; i < 10 ; i ++){
    //   for(let j = 0 ; j < 6 ; j ++){
    //     const col = colArr[i]
    //     const colPoint = footPointArr.find((a) => a[0] == col)
    //     const length = colPoint.length
    //     const yu = 6 % length
    //     const chu = 6 / length
    //     if(chu > 1){
    //       newArr
    //     }

    //   }
    // }

    return newArr
  }, handL(arr) {
    let adcArr = handLArr
    adcArr = adcArr.map((a) => a - 1)

    const finger1 = adcArr.splice(0, 12)
    const finger2 = adcArr.splice(0, 12)
    const finger3 = adcArr.splice(0, 12)
    const finger4 = adcArr.splice(0, 12)
    const finger5 = adcArr.splice(0, 12)
    const fingerArr = [finger1, finger2, finger3, finger4, finger5]


    const res = new Array(147).fill(0)
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 5; k++) {
        for (let j = 0; j < 3; j++) {
          res[i * 15 + k * 3 + j] = arr[fingerArr[k][i * 3 + j]]
        }
      }
    }

    const fingerMiddleHand = adcArr.splice(0, 5)

    for (let i = 0; i < 5; i++) {
      res[15 * 4 + 1 + i * 3] = arr[fingerMiddleHand[i]]
    }

    // handArr = [0, 0, 0, ...handArr]



    let handArr = adcArr.splice(0, 72)
    for (let i = 0; i < handArr.length; i++) {
      res[15 * 5 + i] = arr[handArr[i]]
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


    return res1
  }, handVideoRealPoint_0506_3(arr) {
    let newArr = [...arr]

    const after = newArr.splice(0, 8 * 16)
    newArr = newArr.concat(after)
    newArr = arrX2Y(newArr, 16, 16)
    const handArr = []
    for (let i = 0; i < 10; i++) {
      for (let j = 14; j >= 0; j--) {
        if (i == 5) {
          // if (j < 3) {
          //   continue
          // }
          handArr.push(newArr[(j + 1) * 16 + 15 - i])
        } else {
          handArr.push(newArr[(j + 1) * 16 + 15 - i])
        }

      }
    }


    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 15; j++) {
        [handArr[i * 15 + j], handArr[(9 - i) * 15 + j]] = [handArr[(9 - i) * 15 + j], handArr[i * 15 + j]]
      }
    }

    handArr.splice(5 * 15 + 12, 3)


    for (let i = 4 * 15; i < 5 * 15; i++) {
      handArr[i] = Math.floor(handArr[i] / 3)
    }
    return handArr
  }, handVideo1_0416_0506(arr) {
    let newArr = [...arr]

    const after = newArr.splice(0, 8 * 16)
    newArr = newArr.concat(after)
    newArr = arrX2Y(newArr, 16, 16)
    const handArr = []
    for (let i = 0; i < 10; i++) {
      for (let j = 14; j >= 0; j--) {
        // if(i >= 5){
        //   let k = 4
        //   if(j >=3*k && j < 3*(k+1)){
        //     newArr[(j + 1) * 16 + 15 - i] = 100
        //   }
        // }

        // if(i == 4){
        //   newArr[(j + 1) * 16 + 15 - i] = newArr[(j + 1) * 16 + 15 - i] / 3
        // }

        if (i == 5) {

          handArr.push(newArr[(j + 1) * 16 + 15 - i])
        } else {
          handArr.push(newArr[(j + 1) * 16 + 15 - i])
        }

      }
    }

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 15; j++) {
        [handArr[i * 15 + j], handArr[(9 - i) * 15 + j]] = [handArr[(9 - i) * 15 + j], handArr[i * 15 + j]]
      }
    }

    handArr.splice(5 * 15 + 12, 3)


    // for(let i = 5*15+12+15*3 ; i < 5*15 + 12+15*4 ; i++){
    //   handArr[i] = 100
    // }
    let j = 4
    // for (let i = 5; i < 6; i++) {
    //   for (let k = j * 3; k < (j + 1) * 3; k++) {
    //     handArr[i*15 + k] = 100
    //   }
    // }

    // for (let i = 6; i < 10; i++) {
    //   for (let k = j * 3; k < (j + 1) * 3; k++) {
    //     handArr[i*15 + k-3] = 100
    //   }
    // }

    const res = []
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 15; j++) {
        res.push(handArr[i * 15 + 14 - j])
      }
    }
    // for(let i = 75 ; i < 75 + 12 ; i ++){
    //   res.push(i*15 + 14 - j)
    // }
    for (let i = 75 + 12 - 1; i >= 75; i--) {
      res.push(handArr[i])
    }

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 15; j++) {
        res.push(handArr[75 + 12 + i * 15 + 14 - j])
      }
    }
    // const res = [...handArr]

    // // return handArr
    const handPointArr2D = [[15, 3], [15, 4], [15, 5], [3, 13], [3, 14], [3, 15], [2, 18], [2, 19], [2, 20], [3, 22], [3, 23], [3, 24], [5, 26], [5, 27], [5, 28], [16, 3], [16, 4], [16, 5], [4, 13], [4, 14], [4, 15], [3, 18], [3, 19], [3, 20], [4, 22], [4, 23], [4, 24], [6, 26], [6, 27], [6, 28], [17, 3], [17, 4], [17, 5], [5, 13], [5, 14], [5, 15], [4, 18], [4, 19], [4, 20], [5, 22], [5, 23], [5, 24], [7, 26], [7, 27], [7, 28], [18, 3], [18, 4], [18, 5], [6, 13], [6, 14], [6, 15], [5, 18], [5, 19], [5, 20], [6, 22], [6, 23], [6, 24], [8, 26], [8, 27], [8, 28], [22, 6], [22, 7], [22, 8], [12, 14], [12, 15], [12, 16], [11, 18], [11, 19], [11, 20], [12, 21], [12, 22], [12, 23], [13, 25], [13, 26], [13, 27], [19, 16], [19, 17], [19, 18], [19, 19], [19, 20], [19, 21], [19, 22], [19, 23], [19, 24], [19, 25], [19, 26], [19, 27], [21, 13], [21, 14], [21, 15], [21, 16], [21, 17], [21, 18], [21, 19], [21, 20], [21, 21], [21, 22], [21, 23], [21, 24], [21, 25], [21, 26], [21, 27], [23, 13], [23, 14], [23, 15], [23, 16], [23, 17], [23, 18], [23, 19], [23, 20], [23, 21], [23, 22], [23, 23], [23, 24], [23, 25], [23, 26], [23, 27], [25, 13], [25, 14], [25, 15], [25, 16], [25, 17], [25, 18], [25, 19], [25, 20], [25, 21], [25, 22], [25, 23], [25, 24], [25, 25], [25, 26], [25, 27], [27, 13], [27, 14], [27, 15], [27, 16], [27, 17], [27, 18], [27, 19], [27, 20], [27, 21], [27, 22], [27, 23], [27, 24], [27, 25], [27, 26], [27, 27]]
    // const handPointArr3D = [[16,3],[16,4],[16,5],[3,13],[3,14],[3,15],[3,18],[3,19],[3,20],[3,22],[3,23],[3,24],[5,26],[5,27],[5,28],[17,3],[17,4],[17,5],[4,13],[4,14],[4,15],[4,18],[4,19],[4,20],[4,22],[4,23],[4,24],[6,26],[6,27],[6,28],[18,4],[18,5],[18,6],[5,13],[5,14],[5,15],[5,18],[5,19],[5,20],[5,22],[5,23],[5,24],[7,26],[7,27],[7,28],[19,4],[19,5],[19,6],[6,13],[6,14],[6,15],[6,18],[6,19],[6,20],[6,22],[6,23],[6,24],[8,26],[8,27],[8,28],[23,6],[23,7],[23,8],[11,14],[11,15],[11,16],[11,18],[11,19],[11,20],[11,22],[11,23],[11,24],[11,26],[11,27],[11,28],[20,16],[20,17],[20,18],[20,19],[20,20],[20,21],[20,22],[20,23],[20,24],[20,25],[20,26],[20,27],[22,13],[22,14],[22,15],[22,16],[22,17],[22,18],[22,19],[22,20],[22,21],[22,22],[22,23],[22,24],[22,25],[22,26],[22,27],[24,13],[24,14],[24,15],[24,16],[24,17],[24,18],[24,19],[24,20],[24,21],[24,22],[24,23],[24,24],[24,25],[24,26],[24,27],[26,13],[26,14],[26,15],[26,16],[26,17],[26,18],[26,19],[26,20],[26,21],[26,22],[26,23],[26,24],[26,25],[26,26],[26,27],[28,13],[28,14],[28,15],[28,16],[28,17],[28,18],[28,19],[28,20],[28,21],[28,22],[28,23],[28,24],[28,25],[28,26],[28,27],[30,13],[30,14],[30,15],[30,16],[30,17],[30,18],[30,19],[30,20],[30,21],[30,22],[30,23],[30,24],[30,25],[30,26],[30,27]]
    // 走线完美
    // const handPointArr = [
    //   [12, 1], [12, 2], [12, 3], [3, 3], [3, 4], [3, 5], [1, 13], [1, 14], [1, 15], [·5, 21], [5, 22], [5, 23], [22, 30], [23, 30], [24, 30],
    //   [13, 1], [13, 2], [13, 3], [4, 4], [4, 5], [4, 6], [2, 13], [2, 14], [2, 15], [6, 20], [6, 21], [6, 22], [22, 29], [23, 29], [24, 29],
    //   [14, 2], [14, 3], [14, 4], [5, 4], [5, 5], [5, 6], [3, 12], [3, 13], [3, 14], [7, 20], [7, 21], [7, 22], [22, 28], [23, 28], [24, 28],
    //   [15, 3], [15, 4], [15, 5], [6, 4], [6, 5], [6, 6], [4, 12], [4, 13], [4, 14], [8, 19], [8, 20], [8, 21], [22, 27], [23, 27], [24, 27],
    //   [17, 3], [17, 4], [17, 5], [9, 6], [9, 7], [9, 8], [8, 12], [8, 13], [8, 14], [11, 18], [11, 19], [11, 20], [22, 24], [23, 24], [24, 24],
    //   [16, 7], [16, 8], [16, 9], [16, 10], [16, 11], [16, 12], [16, 13], [16, 14], [16, 15], [16, 16], [16, 17], [16, 18],
    //   [18, 7], [18, 8], [18, 9], [18, 10], [18, 11], [18, 12], [18, 13], [18, 14], [18, 15], [18, 16], [18, 17], [16, 18], [16, 19], [16, 20], [16, 21],
    //   [20, 7], [20, 8], [20, 9], [20, 10], [20, 11], [20, 12], [20, 13], [20, 14], [20, 15], [20, 16], [20, 17], [20, 18], [20, 19], [20, 20], [20, 21],
    //   [22, 7], [22, 8], [22, 9], [22, 10], [22, 11], [22, 12], [22, 13], [22, 14], [22, 15], [22, 16], [22, 17], [22, 18], [22, 19], [22, 20], [22, 21],
    //   [24, 7], [24, 8], [24, 9], [24, 10], [24, 11], [24, 12], [24, 13], [24, 14], [24, 15], [24, 16], [24, 17], [24, 18], [24, 19], [24, 20], [24, 21],]

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

    // const handPointArr = [[16,3],[16,4],[16,5],[3,14],[3,15],[3,16],[3,18],[3,19],[3,20],[3,22],[3,23],[3,24],[5,26],[5,27],[5,28],[17,3],[17,4],[17,5],[4,14],[4,15],[4,16],[4,18],[4,19],[4,20],[4,22],[4,23],[4,24],[6,26],[6,27],[6,28],[18,4],[18,5],[18,6],[5,14],[5,15],[5,16],[5,18],[5,19],[5,20],[5,22],[5,23],[5,24],[7,26],[7,27],[7,28],[19,4],[19,5],[19,6],[6,14],[6,15],[6,16],[6,18],[6,19],[6,20],[6,22],[6,23],[6,24],[8,26],[8,27],[8,28],[23,6],[23,7],[23,8],[12,14],[12,15],[12,16],[12,18],[12,19],[12,20],[12,22],[12,23],[12,24],[12,26],[12,27],[12,28],[20,16],[20,17],[20,18],[20,19],[20,20],[20,21],[20,22],[20,23],[20,24],[20,25],[20,26],[20,27],[22,13],[22,14],[22,15],[22,16],[22,17],[22,18],[22,19],[22,20],[22,21],[22,22],[22,23],[22,24],[22,25],[22,26],[22,27],[24,13],[24,14],[24,15],[24,16],[24,17],[24,18],[24,19],[24,20],[24,21],[24,22],[24,23],[24,24],[24,25],[24,26],[24,27],[26,13],[26,14],[26,15],[26,16],[26,17],[26,18],[26,19],[26,20],[26,21],[26,22],[26,23],[26,24],[26,25],[26,26],[26,27],[28,13],[28,14],[28,15],[28,16],[28,17],[28,18],[28,19],[28,20],[28,21],[28,22],[28,23],[28,24],[28,25],[28,26],[28,27],[30,13],[30,14],[30,15],[30,16],[30,17],[30,18],[30,19],[30,20],[30,21],[30,22],[30,23],[30,24],[30,25],[30,26],[30,27]]
    let newZeroArr = new Array(1024).fill(0)
    // for(let i = 0 ; i < )
    handPointArr.forEach((a, index) => {
      newZeroArr[(31 - a[0]) * 32 + a[1]] = res[index]
      if (index >= 75) {
        newZeroArr[(31 - (a[0] + 1)) * 32 + a[1]] = res[index]
        // newZeroArr[(31 - (a[0] + 1) - 1) * 32 + a[1]] = res[index]
      }
      // newZeroArr[(a[0] + 1) * 32 + a[1]] = handArr[index]
      // newZeroArr[(a[0] + 2) * 32 + a[1]] = handArr[index]
    })

    // newZeroArr = rotate90(newZeroArr, 32, 32)
    // console.log(newZeroArr)
    return newZeroArr
  }, footL(arr) {
    const footArr = []
    let adcArr = [224, 208, 192, 176, 160, 144, 223, 207, 191, 175, 159, 143, 222, 206, 190, 174, 158, 142, 221, 205, 189, 173, 157, 141, 220, 204, 188, 172, 156, 140,
      219, 203, 187, 171, 155, 139, 218, 202, 186, 170, 154, 138, 217, 201, 185, 169, 153, 137, 216, 200, 184, 168, 152, 136, 215, 199, 183, 167, 151, 135]
    adcArr.forEach((a, index) => {
      footArr[index] = arr[a - 1]
    })
    return footArr
  }, footVideo(arr) {
    const footArr = []
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 6; j++) {
        footArr.push(arr[(13 - j) * 16 + 15 - i])
      }
    }

    const footPointArr = [
      [8, 10], [8, 13], [8, 16], [8, 19], [8, 21], [8, 24],
      [13, 8], [13, 11], [13, 15], [13, 18], [13, 22], [13, 25],
      [18, 7], [18, 11], [18, 14], [18, 18], [18, 22], [18, 25],
      [23, 7], [23, 10], [23, 14], [23, 17], [23, 20], [23, 23],
      [28, 7], [28, 10], [28, 13], [28, 16], [28, 18], [28, 21],
      [33, 8], [33, 11], [33, 13], [33, 15], [33, 18], [33, 20],
      [38, 9], [38, 11], [38, 13], [38, 16], [38, 19], [38, 21],
      [43, 9], [43, 11], [43, 14], [43, 17], [43, 19], [43, 22],
      [48, 10], [48, 12], [48, 14], [48, 17], [48, 19], [48, 22],
      [53, 11], [53, 13], [53, 15], [53, 17], [53, 19], [53, 21]]
    const colArr = [8, 13, 18, 23, 28, 33, 38, 43, 48, 53]

    const newArr = new Array(32 * 64).fill(0)

    footPointArr.forEach((a, index) => {
      newArr[a[0] * 32 + a[1]] = footArr[index]
    })

    for (let i = 0; i < 10; i++) {
      for (let j = 1; j < 6; j++) {
        const col = footPointArr[i * 6 + j][0]
        const length = footPointArr[i * 6 + j][1] - footPointArr[i * 6 + j - 1][1]
        const firstIndex = footPointArr[i * 6 + j - 1][1]
        const lastIndex = footPointArr[i * 6 + j][1]
        const firstValue = newArr[col * 32 + firstIndex]
        const lastValue = newArr[col * 32 + lastIndex]
        const cha = lastValue - firstValue
        for (let k = 1; k < length; k++) {
          // newArr[a[0] * 32 + a[1]]
          newArr[col * 32 + firstIndex + k] = firstValue + Math.floor(cha * 10 / length) / 10
        }
      }
    }

    for (let i = 0; i < 9; i++) {
      const col = footPointArr[i * 6 + 0][0]
      const nextCol = footPointArr[(i + 1) * 6 + 0][0]
      const firstIndex = footPointArr[i * 6 + 0][1]
      const lastIndex = footPointArr[i * 6 + 5][1]
      // console.log(newArr[(nextCol) * 32 + 1] , newArr[(col) * 32 + 1])
      for (let j = firstIndex; j <= lastIndex; j++) {
        newArr[(col + 1) * 32 + j] = newArr[(col) * 32 + j] + Math.floor((newArr[(nextCol) * 32 + j] - newArr[(col) * 32 + j]) * 10 * 1 / 5) / 10
        newArr[(col + 2) * 32 + j] = newArr[(col) * 32 + j] + Math.floor((newArr[(nextCol) * 32 + j] - newArr[(col) * 32 + j]) * 10 * 2 / 5) / 10
        newArr[(col + 3) * 32 + j] = newArr[(col) * 32 + j] + Math.floor((newArr[(nextCol) * 32 + j] - newArr[(col) * 32 + j]) * 10 * 3 / 5) / 10
        newArr[(col + 4) * 32 + j] = newArr[(col) * 32 + j] + Math.floor((newArr[(nextCol) * 32 + j] - newArr[(col) * 32 + j]) * 10 * 4 / 5) / 10
      }
    }





    // for(let i = 0 ; i < 10 ; i ++){
    //   for(let j = 0 ; j < 6 ; j ++){
    //     const col = colArr[i]
    //     const colPoint = footPointArr.find((a) => a[0] == col)
    //     const length = colPoint.length
    //     const yu = 6 % length
    //     const chu = 6 / length
    //     if(chu > 1){
    //       newArr
    //     }

    //   }
    // }

    return newArr
  }, footArrToNormal(arr) {
    if (!Array.isArray(arr)) {
      arr = JSON.parse(arr)
    }
    const footPointArr = [
      [8, 10], [8, 13], [8, 16], [8, 19], [8, 21], [8, 24],
      [13, 8], [13, 11], [13, 15], [13, 18], [13, 22], [13, 25],
      [18, 7], [18, 11], [18, 14], [18, 18], [18, 22], [18, 25],
      [23, 7], [23, 10], [23, 14], [23, 17], [23, 20], [23, 23],
      [28, 7], [28, 10], [28, 13], [28, 16], [28, 18], [28, 21],
      [33, 8], [33, 11], [33, 13], [33, 15], [33, 18], [33, 20],
      [38, 9], [38, 11], [38, 13], [38, 16], [38, 19], [38, 21],
      [43, 9], [43, 11], [43, 14], [43, 17], [43, 19], [43, 22],
      [48, 10], [48, 12], [48, 14], [48, 17], [48, 19], [48, 22],
      [53, 11], [53, 13], [53, 15], [53, 17], [53, 19], [53, 21]]


    let left = [...arr]

    const newArr = []
    footPointArr.forEach((a, index) => {
      const newIndex = a[0] * 32 + a[1]
      const leftValue = left[newIndex] ? left[newIndex] : 0
      newArr.push(leftValue,)
    })
    return newArr
  },
  rightEye(wsPointData) {
    const newArr = []
    let lastArr = wsPointData.splice(128, 128)
    wsPointData = lastArr.concat(wsPointData)
    const arr = [7, 8, 9, 10, 11, 12, 13, 14, 6, 5, 4, 3, 2, 1, 0, 15].reverse()

    for (let j = 0; j < 16; j++) {
      for (let i = 0; i < arr.length; i++) {

        newArr.push(wsPointData[j * 16 + arr[i]])
      }
    }

    return newArr
  }, leftEye(wsPointData) {

  }, zeroLineMatrix(arr, matrixLength, max, min) {
    let wsPointData = [...arr];
    let colArr = [],
      rowArr = [];
    for (let i = 0; i < matrixLength; i++) {
      let coltotal = 0,
        rowtotal = 0;
      for (let j = 0; j < matrixLength; j++) {
        coltotal += wsPointData[j * matrixLength + i];
        rowtotal += wsPointData[i * matrixLength + j];
      }
      colArr.push(coltotal);
      rowArr.push(rowtotal);
    }

    for (let i = 1; i < matrixLength - 1; i++) {
      if (rowArr[i + 1] > 100 && rowArr[i] < 40 && rowArr[i - 1] > 100) {
        for (let j = 0; j < matrixLength; j++) {
          wsPointData[i * matrixLength + j] =
            (wsPointData[(i - 1) * matrixLength + j] + wsPointData[(i + 1) * matrixLength + j]) / 2;
        }
      }
    }

    for (let i = 1; i < matrixLength - 1; i++) {
      if (colArr[i + 1] > 100 && colArr[i] < 40 && colArr[i - 1] > 100) {
        // console.log(i)
        for (let j = 0; j < matrixLength; j++) {
          wsPointData[j * matrixLength + i] = (wsPointData[(j) * matrixLength + i - 1] + wsPointData[(j) * matrixLength + i + 1]) / 2;
        }
      }
    }
    return wsPointData;
  }

};

function rotateMatrix(matrix, m, n) {
  const rotatedMatrix = new Array(n);

  for (let i = 0; i < n; i++) {
    rotatedMatrix[i] = new Array(m);
    for (let j = 0; j < m; j++) {
      rotatedMatrix[i][j] = matrix[(m - 1 - j) * n + i];
    }
  }
  const rotatedArray = rotatedMatrix.flat();
  return rotatedArray;
}

function getLineOk(arr) {
  const wsPointData = [...arr];
  // let colArr = [], rowArr = []
  // for (let i = 0; i < 32; i++) {
  //     let coltotal = 0, rowtotal = 0
  //     for (let j = 0; j < 32; j++) {
  //         coltotal += wsPointData[j * 32 + i]
  //         rowtotal += wsPointData[i * 32 + j]
  //     }
  //     colArr.push(coltotal)
  //     rowArr.push(rowtotal)
  // }

  // for (let i = 1; i < 31; i++) {
  //     if (rowArr[i + 1] > 70 && rowArr[i] < 40 && rowArr[i - 1] > 70) {
  //         for (let j = 0; j < 32; j++) {
  //             wsPointData[i * 32 + j] = parseInt((wsPointData[(i - 1) * 32 + j] + wsPointData[(i + 1) * 32 + j])/2)
  //         }
  //     }
  // }

  // for(let i = 0; i < 32; i++){
  //     if (colArr[i + 1] > 70 && colArr[i] < 40 && colArr[i - 1] > 70) {
  //         for (let j = 1; j < 31; j++) {
  //             wsPointData[i * 32 + j] = parseInt((wsPointData[i * 32 + j + 1] + wsPointData[i * 32 + j - 1])/2)
  //         }
  //     }
  // }

  for (let i = 1; i < 31; i++) {
    for (let j = 1; j < 31; j++) {
      if (wsPointData[i * 32 + j] < 10) {
        if (
          wsPointData[i * 32 + j + 1] > 10 &&
          wsPointData[i * 32 + j - 1] > 10
        ) {
          wsPointData[i * 32 + j] = parseInt(
            (wsPointData[i * 32 + j + 1] + wsPointData[i * 32 + j - 1]) / 2
          );
        } else if (
          wsPointData[(i + 1) * 32 + j] > 10 &&
          wsPointData[(i - 1) * 32 + j] > 10
        ) {
          wsPointData[i * 32 + j] = parseInt(
            (wsPointData[(i + 1) * 32 + j] + wsPointData[(i - 1) * 32 + j]) / 2
          );
        }
      }
    }
  }
  return wsPointData;
}

function rotateMatrixback180(matrix, m, n) {
  const wsPointData = [...matrix];
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n / 2; j++) {
      [wsPointData[i * m + j], wsPointData[i * m + n - 1 - j]] = [
        wsPointData[i * m + n - 1 - j],
        wsPointData[i * m + j],
      ];
    }
  }

  for (let i = 0; i < m / 2; i++) {
    for (let j = 0; j < n; j++) {
      [wsPointData[i * m + j], wsPointData[(m - 1 - i) * m + j]] = [
        wsPointData[(m - 1 - i) * m + j],
        wsPointData[i * m + j],
      ];
    }
  }

  return wsPointData;
}

function rotateMatrixsit180(matrix, m, n) {
  const wsPointData = [...matrix];
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n / 2; j++) {
      [wsPointData[i * m + j], wsPointData[i * m + n - 1 - j]] = [
        wsPointData[i * m + n - 1 - j],
        wsPointData[i * m + j],
      ];
    }
  }
  return wsPointData;
}

function pressNew({ arr, width, height, type = "row", value }) {
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
            (value - colArr[i] == 0 ? 1 : value - colArr[i])) *
          1000
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
            (value - colArr[i] == 0 ? 1 : value - colArr[i])) *
          1000
        );
      }
    }
  }

  //////

  // wsPointData = wsPointData.map((a,index) => {return calculateY(a)})
  return wsPointData;
}

function rotate90(arr, height, width) {
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

function rotateArrayCounter90Degrees(array, rows, cols) {
  const length = array.length;

  if (length !== rows * cols) {
    console.error("输入数组长度与给定的行数和列数不匹配。");
    return;
  }

  // 将一维数组转换为二维数组
  const originalMatrix = [];
  for (let i = 0; i < rows; i++) {
    originalMatrix.push(array.slice(i * cols, (i + 1) * cols));
  }

  // 创建一个新的旋转后的矩阵
  const rotatedMatrix = new Array(rows).fill().map(() => []);

  // 进行矩阵转置和行翻转
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      rotatedMatrix[cols - 1 - col][row] = originalMatrix[row][col];
    }
  }

  // 将旋转后的矩阵转换为一维数组
  const rotatedArray = rotatedMatrix.flat();

  return rotatedArray;
}

function rotateArray90Degrees(array) {
  const length = array.length;

  // 计算生成二维数组的行数和列数
  const rows = Math.sqrt(length);
  const cols = rows;

  if (rows % 1 !== 0) {
    console.error("输入数组长度不适合生成正方形二维数组。");
    return;
  }

  // 将一维数组转换为二维数组
  const originalMatrix = [];
  for (let i = 0; i < rows; i++) {
    originalMatrix.push(array.slice(i * cols, (i + 1) * cols));
  }

  // 创建一个新的旋转后的矩阵
  const rotatedMatrix = new Array(cols).fill().map(() => []);

  // 进行矩阵转置和行翻转
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      rotatedMatrix[col][rows - 1 - row] = originalMatrix[row][col];
    }
  }

  // 将旋转后的矩阵转换为一维数组
  const rotatedArray = rotatedMatrix.flat();

  return rotatedArray;
}

function carFitting(value) {

  const res = 0.0582 * Math.pow(value, 2) + (-1.4553) * Math.pow(value, 1) + 11.6990
  // console.log(value , res)
  return res
}

function mmghToPress(mmgH, area) {
  const pa = mmgH * 133
  const mm = area * 0.014 * 0.015
  const F = pa * mm
  return F
}

// function pressSmallBed({ arr, width, height, type = 'row', num = 100 }) {

//   let wsPointData = [...arr];
//   if (num === 0) {
//     return wsPointData
//   }
//   if (type == "row") {
//     let colArr = [];
//     for (let i = 0; i < height; i++) {
//       let total = 0;
//       for (let j = 0; j < width; j++) {
//         total += wsPointData[i * width + j];
//       }
//       colArr.push(total);
//     }
//     // //////okok
//     for (let i = 0; i < height; i++) {
//       for (let j = 0; j < width; j++) {
//         wsPointData[i * width + j] = parseInt(
//           (wsPointData[i * width + j] /
//             (num - colArr[i] == 0 ? 1 : num - colArr[i])) *
//           100
//         );

//         wsPointData[i * width + j] = wsPointData[i * width + j] < 0 ? 0 : wsPointData[i * width + j]
//       }
//     }
//   } else {
//     let colArr = [];
//     for (let i = 0; i < height; i++) {
//       let total = 0;
//       for (let j = 0; j < width; j++) {
//         total += wsPointData[j * height + i];
//       }
//       colArr.push(total);
//     }
//     // console.log(colArr)
//     // //////okok
//     for (let i = 0; i < height; i++) {
//       for (let j = 0; j < width; j++) {
//         wsPointData[j * height + i] = parseInt(
//           (wsPointData[j * height + i] /
//             (num - colArr[i] == 0 ? 1 : num - colArr[i])) *
//           100
//         );

//         wsPointData[i * width + j] = wsPointData[i * width + j] < 0 ? 0 : wsPointData[i * width + j]
//       }
//     }
//   }

//   //////

//   // wsPointData = wsPointData.map((a,index) => {return calculateY(a)})
//   return wsPointData;
// }

function pressSmallBedToValue({ arr, width, height, type = 'row', num = 100 }) {

  let wsPointData = [...arr];
  if (num === 0) {
    return wsPointData
  }
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
          (wsPointData[i * width + j] * (num - colArr[i] == 0 ? 1 : num - colArr[i])) *
          100

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
    // console.log(colArr)
    // //////okok
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        wsPointData[j * height + i] = parseInt(
          (wsPointData[j * height + i] * (num - colArr[i] == 0 ? 1 : num - colArr[i])) *
          100

        );
      }
    }
  }

  //////

  // wsPointData = wsPointData.map((a,index) => {return calculateY(a)})
  return wsPointData;
}

function zeroLine(arr, max, min) {
  let wsPointData = [...arr];
  let colArr = [],
    rowArr = [];
  for (let i = 0; i < 32; i++) {
    let coltotal = 0,
      rowtotal = 0;
    for (let j = 0; j < 32; j++) {
      coltotal += wsPointData[j * 32 + i];
      rowtotal += wsPointData[i * 32 + j];
    }
    colArr.push(coltotal);
    rowArr.push(rowtotal);
  }

  for (let i = 1; i < 31; i++) {
    if (rowArr[i + 1] > 100 && rowArr[i] < 40 && rowArr[i - 1] > 100) {
      for (let j = 0; j < 32; j++) {
        wsPointData[i * 32 + j] =
          (wsPointData[(i - 1) * 32 + j] + wsPointData[(i + 1) * 32 + j]) / 2;
      }
    }
  }

  for (let i = 1; i < 31; i++) {
    if (colArr[i + 1] > 100 && colArr[i] < 40 && colArr[i - 1] > 100) {
      // console.log(i)
      for (let j = 0; j < 32; j++) {
        wsPointData[j * 32 + i] = (wsPointData[(j) * 32 + i - 1] + wsPointData[(j) * 32 + i + 1]) / 2;
      }
    }
  }
  return wsPointData;
}

function zeroLineMatrix(arr, matrixLength, max, min) {
  let wsPointData = [...arr];
  let colArr = [],
    rowArr = [];
  for (let i = 0; i < matrixLength; i++) {
    let coltotal = 0,
      rowtotal = 0;
    for (let j = 0; j < matrixLength; j++) {
      coltotal += wsPointData[j * matrixLength + i];
      rowtotal += wsPointData[i * matrixLength + j];
    }
    colArr.push(coltotal);
    rowArr.push(rowtotal);
  }

  for (let i = 1; i < matrixLength - 1; i++) {
    if (rowArr[i + 1] > 100 && rowArr[i] < 40 && rowArr[i - 1] > 100) {
      for (let j = 0; j < matrixLength; j++) {
        wsPointData[i * matrixLength + j] =
          (wsPointData[(i - 1) * matrixLength + j] + wsPointData[(i + 1) * matrixLength + j]) / 2;
      }
    }
  }

  for (let i = 1; i < matrixLength - 1; i++) {
    if (colArr[i + 1] > 100 && colArr[i] < 40 && colArr[i - 1] > 100) {
      // console.log(i)
      for (let j = 0; j < matrixLength; j++) {
        wsPointData[j * matrixLength + i] = (wsPointData[(j) * matrixLength + i - 1] + wsPointData[(j) * matrixLength + i + 1]) / 2;
      }
    }
  }
  return wsPointData;
}

function smallBedZero(arr, height, width) {
  let wsPointData = [...arr]
  for (let i = 0; i < 32; i++) {
    wsPointData[20 + i * 32] = (wsPointData[20 - 1 + i * 32] + wsPointData[20 + 1 + i * 32]) / 2
  }
  return wsPointData
}

function press6(arr, width, height, type = "row", value = (1245),) {
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
          1000
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
          (wsPointData[j * height + i] * 3 / 4 /
            (value - colArr[i] * 3 / 4 <= 0 ? 1 : value - colArr[i] * 3 / 4)) *
          1000
        );
      }
    }
  }

  //////

  // wsPointData = wsPointData.map((a,index) => {return calculateY(a)})
  return wsPointData;
}


function handR(arr) {
  let adcArr = [240, 239, 238, 256, 255, 254, 16, 15, 14, 32, 31, 30, 237, 236, 235, 253, 252, 251, 13, 12, 11, 29, 28, 27, 234, 233, 232, 250, 249, 248, 10, 9, 8, 26, 25, 24, 231, 230, 229, 247, 246, 245, 7, 6, 5, 23, 22, 21, 228, 227, 226, 244, 243, 242, 4, 3, 2, 20, 19, 18, 47, 44, 41, 38, 35, 61, 60, 59, 58, 57, 56, 55, 54, 53, 52, 51, 50, 80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82, 112, 111, 110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100, 99, 98, 128, 127, 126, 125, 124, 123, 122, 121, 120, 119, 118, 117, 116, 115, 114]


  adcArr = adcArr.map((a) => a - 1)


  const finger1 = adcArr.splice(0, 12)
  const finger2 = adcArr.splice(0, 12)
  const finger3 = adcArr.splice(0, 12)
  const finger4 = adcArr.splice(0, 12)
  const finger5 = adcArr.splice(0, 12)
  const fingerArr = [finger1, finger2, finger3, finger4, finger5]


  const res = new Array(147).fill(0)
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 5; k++) {
      for (let j = 0; j < 3; j++) {
        res[i * 15 + k * 3 + j] = arr[fingerArr[k][i * 3 + j]]
      }
    }
  }

  const fingerMiddleHand = adcArr.splice(0, 5)

  for (let i = 0; i < 5; i++) {
    res[15 * 4 + 1 + i * 3] = arr[fingerMiddleHand[i]]
  }

  // handArr = [0, 0, 0, ...handArr]



  let handArr = adcArr.splice(0, 72)
  for (let i = 0; i < handArr.length; i++) {
    res[15 * 5 + i] = arr[handArr[i]]
  }

  return res
}

function handL(arr) {
  let adcArr = [31, 30, 29, 15, 14, 13, 255, 254, 253, 239, 238, 237, 28, 27, 26, 12, 11, 10, 252, 252, 250, 234, 235, 234, 25, 24, 23, 9, 8, 7, 247, 248, 249, 233, 232, 231, 22, 21, 20, 6, 5, 4, 246, 245, 244, 230, 229, 228, 19, 18, 17, 3, 2, 1, 243, 242, 241, 191, 190, 189, 222, 219, 216, 213, 210, 207, 206, 205, 204, 203, 202, 201, 200, 199, 198, 197, 196, 191, 190, 189, 188, 187, 186, 185, 184, 183, 182, 181, 180, 179, 178, 177, 175, 174, 173, 172, 171, 170, 169, 168, 167, 166, 165, 164, 163, 162, 161, 159, 158, 157, 156, 155, 154, 153, 152, 151, 150, 149, 148, 147, 146, 145, 143, 142, 141, 140, 139, 138, 137, 136, 135, 134, 133, 132, 131, 130, 129]

  adcArr = adcArr.map((a) => a - 1)


  const finger1 = adcArr.splice(0, 12)
  const finger2 = adcArr.splice(0, 12)
  const finger3 = adcArr.splice(0, 12)
  const finger4 = adcArr.splice(0, 12)
  const finger5 = adcArr.splice(0, 12)
  const fingerArr = [finger1, finger2, finger3, finger4, finger5]


  const res = new Array(147).fill(0)
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 5; k++) {
      for (let j = 0; j < 3; j++) {
        res[i * 15 + k * 3 + j] = arr[fingerArr[k][i * 3 + j]]
      }
    }
  }

  const fingerMiddleHand = adcArr.splice(0, 5)

  for (let i = 0; i < 5; i++) {
    res[15 * 4 + 1 + i * 3] = arr[fingerMiddleHand[i]]
  }

  // handArr = [0, 0, 0, ...handArr]



  let handArr = adcArr.splice(0, 72)
  for (let i = 0; i < handArr.length; i++) {
    res[15 * 5 + i] = arr[handArr[i]]
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


  return res1
}

function arrX2Y(arr, width, height) {
  // const newArr = []
  // for (let i = height - 1; i >= 0; i--) {
  //   for (let j = width - 1; j >= 0; j--) {
  //     newArr.push(arr[j * width + i])
  //   }
  // }
  // return newArr


  // 计算边长 n，数组长度必须为 n*n
  const len = arr.length;
  const n = Math.sqrt(len);
  if (n % 1 !== 0) {
    throw new Error("输入数组的长度不是完全平方数，无法构成正方形矩阵");
  }

  const result = new Array(len);
  // 遍历矩阵的每个位置 (i, j)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const oldIndex = i * n + j;
      const newIndex = (n - 1 - j) * n + (n - 1 - i);
      result[newIndex] = arr[oldIndex];
    }
  }
  return result;
}

function arrToRealLine(arr, arrX, arrY, matrixLength) {
  const realX = [], realY = []
  arrX.forEach((a) => {
    if (Array.isArray(a)) {
      // for(let i = )
      if (a[0] > a[1]) {
        for (let i = a[0]; i >= a[1]; i--) {
          realX.push(i)
        }
      } else {
        for (let i = a[0]; i <= a[1]; i++) {
          realX.push(i)
        }
      }
    } else {
      realX.push(a)
    }
  })

  arrY.forEach((a) => {
    if (Array.isArray(a)) {
      // for(let i = )
      if (a[0] > a[1]) {
        for (let i = a[0]; i >= a[1]; i--) {
          realY.push(i)
        }
      } else {
        for (let i = a[0]; i <= a[1]; i++) {
          realY.push(i)
        }
      }
    } else {
      realY.push(a)
    }
  })

  let newArr = []
  for (let i = 0; i < realY.length; i++) {
    for (let j = 0; j < realX.length; j++) {
      const realXCoo = realY[i]
      const realYCoo = realX[j]
      newArr.push(arr[realXCoo * matrixLength + realYCoo])
    }
  }

  return newArr
}