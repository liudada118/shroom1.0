import React, { useEffect, useState, useImperativeHandle, useRef } from 'react'
import './num.css'
import hand from '../../assets/images/hand(1).png'
import { addSide, findMax, interp, rotate90, rotate90CW } from '../../assets/util/util'
import { pressData } from '../../assets/util/matrixToPress'
var valuej1 = localStorage.getItem('carValuej') ? JSON.parse(localStorage.getItem('carValuej')) : 200,
    valueg1 = localStorage.getItem('carValueg') ? JSON.parse(localStorage.getItem('carValueg')) : 2,
    value1 = localStorage.getItem('carValue') ? JSON.parse(localStorage.getItem('carValue')) : 2,
    valuel1 = localStorage.getItem('carValuel') ? JSON.parse(localStorage.getItem('carValuel')) : 2,
    valuef1 = localStorage.getItem('carValuef') ? JSON.parse(localStorage.getItem('carValuef')) : 2,
    valuelInit1 = localStorage.getItem('carValueInit') ? JSON.parse(localStorage.getItem('carValueInit')) : 2


/**
 * 在一维数组表示的 h×w 矩阵中，
 * 每两个相邻元素之间横向和纵向各插入 n 个等距线性插值点，
 * 并返回同样以一维数组形式表示的结果矩阵。
 *
 * @param {number[]} arr      输入的一维数组，长度应为 height * width
 * @param {number}   height   原矩阵的行数 h
 * @param {number}   width    原矩阵的列数 w
 * @param {number}   n        要插入的点数（非负整数；n=0 则返回原矩阵）
 * @returns {number[]}        插值后矩阵，以一维数组形式返回，长度为 newH * newW
 *                            newH = h + (h-1)*n
 *                            newW = w + (w-1)*n
 */
function insertInterpFlat(arr, height, width, n) {
    if (n <= 0) return arr.slice();  // 不插值，直接返回原数组

    // 1. 扁平 → 二维
    const mat = Array.from({ length: height }, (_, i) =>
        arr.slice(i * width, i * width + width)
    );

    // 2. 横向插值
    const horz = mat.map(row => {
        const newRow = [];
        for (let j = 0; j < width - 1; j++) {
            const v0 = row[j];
            const v1 = row[j + 1];
            const delta = (v1 - v0) / (n + 1);
            // 推入 v0 及中间 n 个点
            newRow.push(v0);
            for (let k = 1; k <= n; k++) {
                newRow.push(v0 + delta * k);
            }
        }
        // 最后一列原值
        newRow.push(row[width - 1]);
        return newRow;
    });

    // 3. 纵向插值
    const resultMat = [];
    for (let i = 0; i < height - 1; i++) {
        const A = horz[i];
        const B = horz[i + 1];
        // 先推入原行 A
        resultMat.push(A);

        // 在 A 和 B 之间插入 n 行
        for (let k = 1; k <= n; k++) {
            const t = k / (n + 1);
            const rowK = A.map((v0, j) => v0 + (B[j] - v0) * t);
            resultMat.push(rowK);
        }
    }
    // 最后一行原值
    resultMat.push(horz[height - 1]);

    // 4. 二维 → 扁平
    return resultMat.reduce((acc, row) => acc.concat(row), []);
}

//   // —— 用法示例 ——  
//   const flat = [
//     10, 20, 30,
//     40, 50, 60,
//     70, 80, 90
//   ]; // 原始 3×3  

//   // 在每对相邻元素之间插 2 个点 → 得到 (3 + 2×2)×(3 + 2×2) = 7×7 矩阵
//   const scaledFlat2 = insertInterpFlat(flat, 3, 3, 2);
//   console.log('插 2 点后的长度：', scaledFlat2.length); // 49

//   // 插 1 个点 → 得到 (3 + 1×2)×(3 + 1×2) = 5×5 矩阵
//   const scaledFlat1 = insertInterpFlat(flat, 3, 3, 1);
//   console.log('插 1 点后的长度：', scaledFlat1.length); // 25

//   // 插 0 个点 → 返回原矩阵
//   const sameFlat = insertInterpFlat(flat, 3, 3, 0);
//   console.log('插 0 点后的长度：', sameFlat.length); // 9


let totalArr = [],
    totalPointArr = [];
const Num3D = React.forwardRef((props, refs) => {

    const [textHeight, setHeight] = useState(3)
    const [textColor, setTextColor] = useState(30)
    let width = 32, height = 32
    if (props.matrixName == 'carCol') {
        width = 10
        height = 9
    }
    const [data, setData] = useState(new Array(height).fill(new Array(width).fill(0)));
    const [scale, setScale] = useState(1)

    const typeRef = useRef('hand')

    const changeWsData = (wsPointData) => {
        // console.log(wsPointData.length, valuef1)
        layoutData(wsPointData)
        let pointArr = [[16, 30], [16, 29], [16, 28], [2, 18], [2, 17], [2, 16], [1, 13], [1, 12], [1, 11], [2, 8], [2, 7], [2, 6], [5, 4], [5, 3], [5, 2], [17, 30], [17, 29], [17, 28], [3, 18], [3, 17], [3, 16], [2, 13], [2, 12], [2, 11], [3, 8], [3, 7], [3, 6], [6, 4], [6, 3], [6, 2], [18, 29], [18, 28], [18, 27], [4, 18], [4, 17], [4, 16], [3, 13], [3, 12], [3, 11], [4, 8], [4, 7], [4, 6], [7, 4], [7, 3], [7, 2], [19, 29], [19, 28], [19, 27], [5, 18], [5, 17], [5, 16], [4, 13], [4, 12], [4, 11], [5, 8], [5, 7], [5, 6], [8, 4], [8, 3], [8, 2], [22, 28], [22, 27], [22, 26], [8, 17], [8, 16], [8, 15], [7, 13], [7, 12], [7, 11], [8, 9], [8, 8], [8, 7], [11, 5], [11, 4], [11, 3], [19, 15], [19, 14], [19, 13], [19, 12], [19, 11], [19, 10], [19, 9], [19, 8], [19, 7], [19, 6], [19, 5], [19, 4], [21, 18], [21, 17], [21, 16], [21, 15], [21, 14], [21, 13], [21, 12], [21, 11], [21, 10], [21, 9], [21, 8], [21, 7], [21, 6], [21, 5], [21, 4], [23, 18], [23, 17], [23, 16], [23, 15], [23, 14], [23, 13], [23, 12], [23, 11], [23, 10], [23, 9], [23, 8], [23, 7], [23, 6], [23, 5], [23, 4], [25, 18], [25, 17], [25, 16], [25, 15], [25, 14], [25, 13], [25, 12], [25, 11], [25, 10], [25, 9], [25, 8], [25, 7], [25, 6], [25, 5], [25, 4], [27, 18], [27, 17], [27, 16], [27, 15], [27, 14], [27, 13], [27, 12], [27, 11], [27, 10], [27, 9], [27, 8], [27, 7], [27, 6], [27, 5], [27, 4]]
        let newArr = new Array(1024).fill(0)

        let newData = [...wsPointData]
        newData = rotate90CW(newData, 32, 32)
        let dataG = []
        let ndata = [...newData].map((a, index) => (a - valuef1 < 0 ? 0 : a));
        const ndataNum = ndata.reduce((a, b) => a + b, 0);
        if (ndataNum < valuelInit1) {
            ndata = new Array(width * height).fill(0);
        }

        dataG = gaussBlur_2(ndata, width, height, 1.6)


        wsPointData = dataG

        let a = [];
        for (let i = 0; i < height; i++) {
            a[i] = [];
            for (let j = 0; j < width; j++) {
                a[i].push(wsPointData[i * width + j]);
            }
        }



        // wsPointData = a;
        setData(a);
    }

    const changeWsData147 = (wsPointData) => {
        let pointArr = [[16, 30], [16, 29], [16, 28], [2, 18], [2, 17], [2, 16], [1, 13], [1, 12], [1, 11], [2, 8], [2, 7], [2, 6], [5, 4], [5, 3], [5, 2], [17, 30], [17, 29], [17, 28], [3, 18], [3, 17], [3, 16], [2, 13], [2, 12], [2, 11], [3, 8], [3, 7], [3, 6], [6, 4], [6, 3], [6, 2], [18, 29], [18, 28], [18, 27], [4, 18], [4, 17], [4, 16], [3, 13], [3, 12], [3, 11], [4, 8], [4, 7], [4, 6], [7, 4], [7, 3], [7, 2], [19, 29], [19, 28], [19, 27], [5, 18], [5, 17], [5, 16], [4, 13], [4, 12], [4, 11], [5, 8], [5, 7], [5, 6], [8, 4], [8, 3], [8, 2], [22, 28], [22, 27], [22, 26], [8, 17], [8, 16], [8, 15], [7, 13], [7, 12], [7, 11], [8, 9], [8, 8], [8, 7], [11, 5], [11, 4], [11, 3], [19, 15], [19, 14], [19, 13], [19, 12], [19, 11], [19, 10], [19, 9], [19, 8], [19, 7], [19, 6], [19, 5], [19, 4], [21, 18], [21, 17], [21, 16], [21, 15], [21, 14], [21, 13], [21, 12], [21, 11], [21, 10], [21, 9], [21, 8], [21, 7], [21, 6], [21, 5], [21, 4], [23, 18], [23, 17], [23, 16], [23, 15], [23, 14], [23, 13], [23, 12], [23, 11], [23, 10], [23, 9], [23, 8], [23, 7], [23, 6], [23, 5], [23, 4], [25, 18], [25, 17], [25, 16], [25, 15], [25, 14], [25, 13], [25, 12], [25, 11], [25, 10], [25, 9], [25, 8], [25, 7], [25, 6], [25, 5], [25, 4], [27, 18], [27, 17], [27, 16], [27, 15], [27, 14], [27, 13], [27, 12], [27, 11], [27, 10], [27, 9], [27, 8], [27, 7], [27, 6], [27, 5], [27, 4]]

        let newArr = new Array(1024).fill(0)
        let displayArr = new Array(1024).fill(0)
        layoutData([...wsPointData].map((a) => a))

        for (let j = 0; j < 5; j++) {
            for (let k = 0; k < 15; k++) {
                const index = j * 15 + k
                if (k >= 3 * 1 && k < 3 * 2) {
                    pointArr[index][1] = pointArr[index][1] + 4
                }
                if (k >= 3 * 2 && k < 3 * 3) {
                    pointArr[index][1] = pointArr[index][1] + 2
                }

                if (k >= 3 * 3 && k < 3 * 4) {
                    pointArr[index][1] = pointArr[index][1] + 0
                }
                if (k >= 3 * 4 && k < 3 * 5) {
                    pointArr[index][1] = pointArr[index][1] - 2
                }
            }
        }


        for (let i = 0; i < pointArr.length; i++) {
            // 将手指头向下移动
            if (i >= 15 && i < 4 * 15) {
                pointArr[i][0] = pointArr[i][0] + Math.floor(i / 15)
            }



            const nowArr = pointArr[i];


            const index = nowArr[0] * 32 + nowArr[1]
            newArr[index] = wsPointData[i]
            if (i >= 4 * 15 && i < 5 * 15) {
                pointArr[i][0] = pointArr[i][0] + 4
                newArr[index] = wsPointData[i]
                for (let j = 1; j < 4; j++) {
                    const index = (nowArr[0] + j) * 32 + nowArr[1]
                    newArr[index] = wsPointData[i]
                }
            } else {
                const index = (nowArr[0] + 1) * 32 + nowArr[1]
                newArr[index] = wsPointData[i]
            }
            // if (i >= 4 * 15 && i < 5 * 15) {


            // }

            // if (i > 50) {



            // {
            //     const nowArr = pointArr[i];
            //     const index = nowArr[0] * 32 + nowArr[1]
            //     displayArr[index] = 5
            //     if (i >= 40 && i < 50) {
            //         for (let j = 1; j < 4; j++) {
            //             const index = (nowArr[0] + j) * 32 + nowArr[1]
            //             displayArr[index] = 5
            //         }

            //     }

            //     // if (i > 50) {
            //     {
            //         const index = (nowArr[0] + 1) * 32 + nowArr[1]
            //         displayArr[index] = 5
            //     }
            // }
            // }
        }
        let width = 36, height = 36
        newArr = addSide(newArr, 32, 32, 2, 2, 0)

        newArr = gaussBlur_2(newArr, width, height, 1.2)

        let a = [], newH = 36, newW = 36;
        for (let i = 0; i < newH; i++) {
            a[i] = [];
            for (let j = 0; j < newW; j++) {
                a[i].push(newArr[i * newW + j]);
            }
        }

        // wsPointData = a;
        setData(a);
    }



    const sitValue = (prop) => {
        console.log(props)
        console.log(prop)

        const { valuej, valueg, value, valuel, valuef, valuelInit } = prop;
        if (valuej) valuej1 = valuej;
        if (valueg) valueg1 = valueg;
        if (value) value1 = value;
        if (value) {
            setHeight(value)
        }
        if (valuej) {
            setTextColor(valuej)
        }
        if (valuel) valuel1 = valuel;
        if (valuef) valuef1 = valuef;
        if (valuelInit) valuelInit1 = valuelInit;

    }

    const changeWsDatafinger = (wsPointData) => {

        // console.log(wsPointData)
        const width = 3, height = 4, order = 1
        let data = []
        for (let i = 0; i < 4; i++) {
            for (let j = 6; j < 9; j++) {
                data.push(wsPointData[i * 15 + j])
            }
        }
        layoutData(data)
        let newArr = new Array(1024).fill(0)

        let k = 0
        // for (let i = 13; i < 17; i++) {

        //     for (let j = 14; j < 17; j++) {
        //         console.log(data[k])
        //         newArr[i*32+j] = 20
        //         k++
        //     }
        // }

        for (let i = 13; i < 17; i++) {

            for (let j = 17; j < 20; j++) {
                console.log(data[k])
                newArr[j * 32 + i] = data[k] * 8
                k++
            }
        }

        console.log(data, [...newArr])
        // const res = [...newArr]
        newArr = gaussBlur_2(newArr, 32, 32, 1.6)
        let a = [], newH = 32, newW = 32;
        for (let i = 0; i < newH; i++) {
            a[i] = [];
            for (let j = 0; j < newW; j++) {
                a[i].push(newArr[i * newW + j]);
            }
        }

        // wsPointData = a;
        setData(a);
    }

    const changeWsDatapalm = (wsPointData) => {


        const data = []
        for (let i = 5; i < 10; i++) {
            for (let j = 14; j >= 0; j--) {
                data.push(wsPointData[i * 15 + j])
            }
        }
        layoutData(data)
        let newArr = new Array(1024).fill(0)
        let k = 0
        // for (let i = 13; i < 17; i++) {

        //     for (let j = 14; j < 17; j++) {
        //         console.log(data[k])
        //         newArr[i*32+j] = 20
        //         k++
        //     }
        // }

        for (let i = 13; i < 18; i++) {

            for (let j = 7; j < 7 + 15; j++) {

                newArr[i * 32 + j] = data[k]
                k++
            }
        }
        newArr = gaussBlur_2(newArr, 32, 32, 1.6)
        const height = 32, width = 32

        let a = [];
        for (let i = 0; i < height; i++) {
            a[i] = [];
            for (let j = 0; j < width; j++) {
                a[i].push(newArr[i * width + j]);
            }
        }
        // wsPointData = a;
        setData(a);
    }

    const layoutData = (dataArr) => {


        // dataArr = dataArr.filter((a) => a > valuej1 * 0.025)
        const max = findMax(dataArr)
        const point = dataArr.filter((a) => a > 0).length
        let press = dataArr.reduce((a, b) => a + b, 0)
        // press = Math.floor(press)*3
        // press = press > 724 ? parseInt((pressData[724] * (press / 724)).toFixed(2)) : pressData[press]
        // console.log(press,dataArr)
        const mean = press / (point == 0 ? 1 : point)
        props.data.current?.changeData({
            meanPres: mean.toFixed(2),
            maxPres: max,
            point: point,
            // area: areaSmooth.toFixed(0),
            totalPres: `${press}`,
            // pressure: pressureSmooth.toFixed(2),
        });

        if (totalArr.length < 60) {
            totalArr.push(press);
        } else {
            totalArr.shift();
            totalArr.push(press);
        }

        const maxTotal = findMax(totalArr);

        if (!props.local)
            props.data.current?.handleCharts(totalArr.map(a => { return a - 1 > 0 ? a - 1 : 0 }), maxTotal+ 20);

        if (totalPointArr.length < 60) {
            totalPointArr.push(point);
        } else {
            totalPointArr.shift();
            totalPointArr.push(point);
        }

        const max1 = findMax(totalPointArr);
        if (!props.local)
            props.data.current?.handleChartsArea(totalPointArr, max1 + 20);
        // timeS = 0;


    }


    useEffect(() => {
        // let ws = new WebSocket(" ws://localhost:19999");
        // ws.onopen = () => {
        //     // connection opened
        //     console.info("connect success");
        // };
        // ws.onmessage = (e) => {
        //     let jsonObject = JSON.parse(e.data);
        //     //处理空数组
        //     console.log(typeRef.current)
        //     // 数据转换之后的1024数据
        //     if (jsonObject.sitData != null) {
        //         let wsPointData = jsonObject.sitData;
        //         if (typeRef.current == 'hand') {
        //             changeWsData(wsPointData)
        //         }

        //     }

        //     // 转换线序之后的147数据

        //     if (jsonObject.newArr147 != null) {
        //         let wsPointData = jsonObject.newArr147;
        //         let newArr = [...wsPointData]
        //         newArr.splice(5 * 15, 0, 0);
        //         newArr.splice(5 * 15, 0, 0);
        //         newArr.splice(5 * 15, 0, 0);

        //         if (typeRef.current == 'finger') {
        //             changeWsDatafinger(wsPointData)
        //         } else if (typeRef.current == 'palm') {
        //             changeWsDatapalm(wsPointData)
        //         }

        //     }





        // };
        // ws.onerror = (e) => {
        //     // an error occurred
        // };
        // ws.onclose = (e) => {
        //     // connection closed
        // };

        // return () => {
        //     ws.close()
        // }
    }, [])
    const drawContent = () => { }

    const changeType = (str) => {
        typeRef.current = str
    }

    useImperativeHandle(refs, () => ({

        changeWsData: changeWsData,
        drawContent: drawContent,
        sitValue,
        changeType,
        changeWsDatafinger,
        changeWsDatapalm,
        changeWsData147
    }));

    function jet(min, max, x) {
        let r, g, b;
        let dv;
        r = 1;
        g = 1;
        b = 1;
        if (x < min) x = min;
        if (x > max) x = max;
        dv = max - min;
        if (x < min + 0.25 * dv) {
            r = 0;
            g = (4 * (x - min)) / dv;
        } else if (x < min + 0.5 * dv) {
            r = 0;
            b = 1 + (4 * (min + 0.25 * dv - x)) / dv;
        } else if (x < min + 0.75 * dv) {
            r = (4 * (x - min - 0.5 * dv)) / dv;
            b = 0;
        } else {
            g = 1 + (4 * (min + 0.75 * dv - x)) / dv;
            b = 0;
        }
        var rgb = new Array();
        rgb[0] = parseInt(255 * r);
        rgb[1] = parseInt(255 * g);
        rgb[2] = parseInt(255 * b);
        return rgb;
    }

    function boxesForGauss(sigma, n)  // standard deviation, number of boxes
    {
        var wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1);  // Ideal averaging filter width
        var wl = Math.floor(wIdeal);
        if (wl % 2 == 0) wl--;
        var wu = wl + 2;
        var mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
        var m = Math.round(mIdeal);
        var sizes = [];
        for (var i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
        return sizes;
    }

    function gaussBlur_2(scl, w, h, r) {
        let tcl = []
        var bxs = boxesForGauss(r, 3);
        boxBlur_2(scl, tcl, w, h, (bxs[0] - 1) / 2);
        boxBlur_2(tcl, scl, w, h, (bxs[1] - 1) / 2);
        boxBlur_2(scl, tcl, w, h, (bxs[2] - 1) / 2);
        return tcl
    }

    function boxBlur_2(scl, tcl, w, h, r) {
        for (var i = 0; i < h; i++)
            for (var j = 0; j < w; j++) {
                var val = 0;
                for (var iy = i - r; iy < i + r + 1; iy++)
                    for (var ix = j - r; ix < j + r + 1; ix++) {
                        var x = Math.min(w - 1, Math.max(0, ix));
                        var y = Math.min(h - 1, Math.max(0, iy));
                        val += scl[y * w + x];
                    }
                tcl[i * w + j] = val / ((r + r + 1) * (r + r + 1));
            }
    }


    useEffect(() => {
        var WW = document.documentElement.clientWidth
        var scaleNum = WW / 1920
        setScale(scaleNum)
    }, []);

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#000',
                // alignItems: 'center'
            }}
        >
            <div
                className="threeBoxF"
                style={{
                    color: 'blue', transformStyle: 'preserve-3d',
                    perspective: '500px',

                }}
            >
                <div className="threeBox"
                    style={{ transform: 'rotateX(20deg)' }}
                >
                    {/* <img style={{position : 'absolute' , height : '100%'}} src={hand} alt="" /> */}
                    {data.map((items, indexs) => {
                        return (
                            <div key={indexs} style={{ display: 'flex' }}>
                                {items && items.length
                                    ? items.map((item, index) => {
                                        return (
                                            <div
                                                key={index}
                                                style={{
                                                    width: '2rem',
                                                    color: 'blue',
                                                    fontSize: `${scale * 20 * 1}px`,
                                                    lineHeight: '1.5rem',
                                                    fontWeight: 'bold',
                                                    transform: `translateY(${-item * textHeight}px)`,
                                                    color: `rgb(${jet(0, textColor, item * 5)})`,
                                                }}
                                            >
                                                {parseInt(item)}
                                            </div>
                                        );
                                    })
                                    : null}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
})

export default Num3D