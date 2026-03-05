import React, { useEffect, useState, useImperativeHandle, useRef, useCallback } from 'react'
import './num.css'
import { addSide, findMax } from '../../assets/util/util';
import { pressData } from '../../assets/util/matrixToPress';
import hand from '../../assets/images/hand0509.png'
var valuej1 = localStorage.getItem('carValuej') ? JSON.parse(localStorage.getItem('carValuej')) : 200,
    valueg1 = localStorage.getItem('carValueg') ? JSON.parse(localStorage.getItem('carValueg')) : 2,
    value1 = localStorage.getItem('carValue') ? JSON.parse(localStorage.getItem('carValue')) : 2,
    valuel1 = localStorage.getItem('carValuel') ? JSON.parse(localStorage.getItem('carValuel')) : 2,
    valuef1 = localStorage.getItem('carValuef') ? JSON.parse(localStorage.getItem('carValuef')) : 2,
    valuelInit1 = localStorage.getItem('carValueInit') ? JSON.parse(localStorage.getItem('carValueInit')) : 2



let totalArr = [],
    totalPointArr = [];

function footInterp(arr, footPointArr) {
    // const newArr = new Array(32 * 64).fill(0)

    // footPointArr.forEach((a, index) => {
    //   newArr[a[0] * 32 + a[1]] = footArr[index]
    // })
    const newArr = [...arr]

    for (let i = 0; i < 10; i++) {
        for (let j = 1; j < 6; j++) {
            const col = footPointArr[i * 6 + j][0]
            const length = footPointArr[i * 6 + j][1] - footPointArr[i * 6 + j - 1][1]
            const firstIndex = footPointArr[i * 6 + j - 1][1]
            const lastIndex = footPointArr[i * 6 + j][1]
            const firstValue = newArr[col * 16 + firstIndex]
            const lastValue = newArr[col * 16 + lastIndex]
            const cha = lastValue - firstValue
            for (let k = 1; k < length; k++) {
                // newArr[a[0] * 16 + a[1]]
                newArr[col * 16 + firstIndex + k] = firstValue + Math.floor(cha * 10 / length) / 10
            }
        }
    }

    for (let i = 0; i < 9; i++) {
        const col = footPointArr[i * 6 + 0][0]
        const nextCol = footPointArr[(i + 1) * 6 + 0][0]
        const firstIndex = footPointArr[i * 6 + 0][1]
        const lastIndex = footPointArr[i * 6 + 5][1]
        // console.log(newArr[(nextCol) * 16 + 1] , newArr[(col) * 16 + 1])
        for (let j = firstIndex; j <= lastIndex; j++) {
            newArr[(col + 1) * 16 + j] = newArr[(col) * 16 + j] + Math.floor((newArr[(nextCol) * 16 + j] - newArr[(col) * 16 + j]) * 10 * 1 / 3) / 10
            newArr[(col + 2) * 16 + j] = newArr[(col) * 16 + j] + Math.floor((newArr[(nextCol) * 16 + j] - newArr[(col) * 16 + j]) * 10 * 2 / 3) / 10
            // newArr[(col + 3) * 16 + j] = newArr[(col) * 16 + j] + Math.floor((newArr[(nextCol) * 16 + j] - newArr[(col) * 16 + j]) * 10 * 3 / 5) / 10
            // newArr[(col + 4) * 16 + j] = newArr[(col) * 16 + j] + Math.floor((newArr[(nextCol) * 16 + j] - newArr[(col) * 16 + j]) * 10 * 4 / 5) / 10
        }
    }
    return newArr
}
let leftArr = [], rightArr = []
export const Num2D = React.forwardRef((props, refs) => {

    let width = 32, height = 32
    if (props.matrixName == 'carCol') {
        width = 10
        height = 9
    }
    const [data, setData] = useState(new Array(height).fill(new Array(width).fill(0)));
    const [data1, setData1] = useState(new Array(height).fill(new Array(width).fill(0)));
    const [scale, setScale] = useState(1)

    // === RAF 节流：200Hz数据只缓冲，60fps渲染 ===
    const pendingDataRef = useRef(null);
    const pendingData1Ref = useRef(null);
    const rafIdRef = useRef(null);

    const scheduleRender = useCallback(() => {
        if (rafIdRef.current) return; // 已有待执行的RAF
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (pendingDataRef.current !== null) {
                setData(pendingDataRef.current);
                pendingDataRef.current = null;
            }
            if (pendingData1Ref.current !== null) {
                setData1(pendingData1Ref.current);
                pendingData1Ref.current = null;
            }
        });
    }, []);

    // 组件卸载时清理RAF
    useEffect(() => {
        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, []);



    const changeWsData = (wsPointData) => {
        let newData = [...wsPointData]
        let dataG = []
        let ndata = [...newData].map((a, index) => (a - valuef1 < 0 ? 0 : a));
        const ndataNum = ndata.reduce((a, b) => a + b, 0);
        if (ndataNum < valuelInit1) {
            ndata = new Array(width * height).fill(1);
        }

        gaussBlur_2(ndata, dataG, width, height, 1)


        wsPointData = dataG

        let a = [];
        for (let i = 0; i < height; i++) {
            a[i] = [];
            for (let j = 0; j < width; j++) {
                a[i].push(wsPointData[i * width + j]);
            }
        }

        // wsPointData = a;
        pendingDataRef.current = a;
        scheduleRender();
    }

    const sitValue = (prop) => {
        const { valuej, valueg, value, valuel, valuef, valuelInit } = prop;
        if (valuej) valuej1 = valuej;
        if (valueg) valueg1 = valueg;
        if (value) value1 = value;
        if (valuel) valuel1 = valuel;
        if (valuef) valuef1 = valuef;
        if (valuelInit) valuelInit1 = valuelInit;

    }

    const drawContent = () => { }

    const changeWsData147R = (wsPointData) => {

        if (props.matrixName == 'hand0205') {

        } else {

            if (props.matrixName == 'footVideo') {

                const { left, right } = wsPointData






                if (left) {
                    leftArr = [...left]
                    const wsPointData = [...left]
                    const renderArr = [[2, 2], [2, 4], [2, 6], [2, 8], [2, 10], [2, 12], [5, 1], [5, 4], [5, 6], [5, 8], [5, 11], [5, 13], [8, 1], [8, 4], [8, 6], [8, 8], [8, 11], [8, 14], [11, 2], [11, 5], [11, 8], [11, 10], [11, 12], [11, 14], [14, 2], [14, 5], [14, 8], [14, 10], [14, 12], [14, 14], [17, 2], [17, 4], [17, 6], [17, 8], [17, 10], [17, 12], [20, 2], [20, 4], [20, 6], [20, 8], [20, 10], [20, 12], [23, 2], [23, 4], [23, 6], [23, 8], [23, 10], [23, 12], [26, 2], [26, 4], [26, 6], [26, 8], [26, 10], [26, 11], [29, 3], [29, 5], [29, 6], [29, 8], [29, 9], [29, 11]]
                    let newArr = new Array(16 * 32).fill(0)
                    renderArr.forEach((a, index) => {
                        let realIndex = renderArr[index][0] * 16 + renderArr[index][1]
                        newArr[realIndex] = wsPointData[index]
                    })

                    newArr = footInterp(newArr, renderArr)
                    let width = 16
                    let height = 32

                    // let newArr = [...wsPointData]


                    // let width = 6
                    // let height = 10

                    // let newArr = [...newArr1]
                    let arr = [];

                    // newArr = newArr.map((a) => changeValue(a))

                    for (let i = 0; i < height; i++) {
                        arr[i] = [];
                        for (let j = 0; j < width; j++) {
                            arr[i][j] = Math.floor(newArr[i * width + j]);
                        }
                        arr[i][width] = i

                    }

                    arr[height] = []
                    for (let i = 0; i < width; i++) {
                        arr[height][i] = i
                    }

                    pendingDataRef.current = arr;
                    scheduleRender();
                }

                if (right) {
                    rightArr = [...right]
                    const wsPointData = [...right]
                    const renderArr = [[2, 2], [2, 4], [2, 6], [2, 8], [2, 10], [2, 12], [5, 1], [5, 4], [5, 6], [5, 8], [5, 11], [5, 13], [8, 1], [8, 4], [8, 6], [8, 8], [8, 11], [8, 14], [11, 2], [11, 5], [11, 8], [11, 10], [11, 12], [11, 14], [14, 2], [14, 5], [14, 8], [14, 10], [14, 12], [14, 14], [17, 2], [17, 4], [17, 6], [17, 8], [17, 10], [17, 12], [20, 2], [20, 4], [20, 6], [20, 8], [20, 10], [20, 12], [23, 2], [23, 4], [23, 6], [23, 8], [23, 10], [23, 12], [26, 2], [26, 4], [26, 6], [26, 8], [26, 10], [26, 11], [29, 3], [29, 5], [29, 6], [29, 8], [29, 9], [29, 11]]
                    let newArr = new Array(16 * 32).fill(0)
                    renderArr.forEach((a, index) => {
                        let realIndex = renderArr[index][0] * 16 + renderArr[index][1]
                        newArr[realIndex] = wsPointData[index]
                    })

                    newArr = footInterp(newArr, renderArr)
                    let width = 16
                    let height = 32


                    // let newArr = [...wsPointData]


                    // let width = 6
                    // let height = 10
                    // let newArr = [...newArr1]
                    let arr = [];

                    // newArr = newArr.map((a) => changeValue(a))

                    for (let i = 0; i < height; i++) {
                        arr[i] = [];
                        for (let j = 0; j < width; j++) {
                            arr[i][j] = Math.floor(newArr[i * width + j]);
                        }
                        arr[i][width] = i

                    }

                    arr[height] = []
                    for (let i = 0; i < width; i++) {
                        arr[height][i] = i
                    }

                    pendingData1Ref.current = arr;
                    scheduleRender();
                }

                const newArr = [...leftArr, ...rightArr]


                const dataArr = [...newArr]

                layoutData([...dataArr])
            }



        }
        // setData(a);
    }

    useImperativeHandle(refs, () => ({
        changeWsData147,
        changeWsData147R,
        changeWsData: changeWsData,
        drawContent: drawContent,
        sitValue
    }));

    function jet1(min, max, x) {
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
        if (x < min + 0.2 * dv) {
            red = 1;
            g = 1;
            blue = 1;

            // red = 0;
            // g = (4 * (x - min)) / dv;
        } else if (x < min + 0.4 * dv) {
            // red = 0;
            // g = 0;
            // blue = 0;

            red = 0;
            g = (5 * (x - min - 0.2 * dv)) / dv;
        } else if (x < min + 0.6 * dv) {
            red = 0;
            blue = 1 + (4 * (min + 0.4 * dv - x)) / dv;
        } else if (x < min + 0.8 * dv) {
            red = (4 * (x - min - 0.6 * dv)) / dv;
            blue = 0;
        } else {
            g = 1 + (4 * (min + 0.8 * dv - x)) / dv;
            blue = 0;
        }
        var rgb = new Array();
        rgb[0] = parseInt(255 * red + '');
        rgb[1] = parseInt(255 * g + '');
        rgb[2] = parseInt(255 * blue + '');
        return rgb;
    }


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

    function gaussBlur_2(scl, tcl, w, h, r) {
        var bxs = boxesForGauss(r, 3);
        boxBlur_2(scl, tcl, w, h, (bxs[0] - 1) / 2);
        boxBlur_2(tcl, scl, w, h, (bxs[1] - 1) / 2);
        boxBlur_2(scl, tcl, w, h, (bxs[2] - 1) / 2);
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

    const changeWsData147 = (wsPointData) => {
        layoutData([...wsPointData])
        if (props.matrixName == 'hand0205') {



            let pointArr = [[16, 30], [16, 29], [16, 28], [2, 18], [2, 17], [2, 16], [1, 13], [1, 12], [1, 11], [2, 8], [2, 7], [2, 6], [5, 4], [5, 3], [5, 2], [17, 30], [17, 29], [17, 28], [3, 18], [3, 17], [3, 16], [2, 13], [2, 12], [2, 11], [3, 8], [3, 7], [3, 6], [6, 4], [6, 3], [6, 2], [18, 29], [18, 28], [18, 27], [4, 18], [4, 17], [4, 16], [3, 13], [3, 12], [3, 11], [4, 8], [4, 7], [4, 6], [7, 4], [7, 3], [7, 2], [19, 29], [19, 28], [19, 27], [5, 18], [5, 17], [5, 16], [4, 13], [4, 12], [4, 11], [5, 8], [5, 7], [5, 6], [8, 4], [8, 3], [8, 2], [22, 28], [22, 27], [22, 26], [8, 17], [8, 16], [8, 15], [7, 13], [7, 12], [7, 11], [8, 9], [8, 8], [8, 7], [11, 5], [11, 4], [11, 3], [19, 15], [19, 14], [19, 13], [19, 12], [19, 11], [19, 10], [19, 9], [19, 8], [19, 7], [19, 6], [19, 5], [19, 4], [21, 18], [21, 17], [21, 16], [21, 15], [21, 14], [21, 13], [21, 12], [21, 11], [21, 10], [21, 9], [21, 8], [21, 7], [21, 6], [21, 5], [21, 4], [23, 18], [23, 17], [23, 16], [23, 15], [23, 14], [23, 13], [23, 12], [23, 11], [23, 10], [23, 9], [23, 8], [23, 7], [23, 6], [23, 5], [23, 4], [25, 18], [25, 17], [25, 16], [25, 15], [25, 14], [25, 13], [25, 12], [25, 11], [25, 10], [25, 9], [25, 8], [25, 7], [25, 6], [25, 5], [25, 4], [27, 18], [27, 17], [27, 16], [27, 15], [27, 14], [27, 13], [27, 12], [27, 11], [27, 10], [27, 9], [27, 8], [27, 7], [27, 6], [27, 5], [27, 4]]

            let newArr = new Array(1024).fill(0)
            let displayArr = new Array(1024).fill(0)


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
                    const nowArr = pointArr[i];


                    const index = nowArr[0] * 32 + nowArr[1]
                    newArr[index] = wsPointData[i]
                }



                const nowArr = pointArr[i];


                const index = nowArr[0] * 32 + nowArr[1]
                // newArr[index] = wsPointData[i]
                if (i >= 4 * 15 && i < 5 * 15) {
                    pointArr[i][0] = pointArr[i][0] + 4
                    // newArr[index] = wsPointData[i]
                    for (let j = 0; j < 4; j++) {
                        const index = (nowArr[0] + j) * 32 + nowArr[1]
                        newArr[index] = wsPointData[i]
                    }
                } else {
                    {
                        const nowArr = pointArr[i];


                        const index = nowArr[0] * 32 + nowArr[1]
                        newArr[index] = wsPointData[i]
                    }
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

            // newArr = gaussBlur_2(newArr, width, height, 1.2)

            let a = [], newH = 36, newW = 36;
            for (let i = 0; i < newH; i++) {
                a[i] = [];
                for (let j = 0; j < newW; j++) {
                    a[i].push(newArr[i * newW + j]);
                }
            }

            // wsPointData = a;
            pendingDataRef.current = a;
            scheduleRender();
        } else {
            if (props.matrixName == 'footVideo') {

                // newArr = footL(pointArr)
                // layoutData([...wsPointData])
                const renderArr = [[2, 2], [2, 4], [2, 6], [2, 8], [2, 10], [2, 12], [5, 1], [5, 4], [5, 6], [5, 8], [5, 11], [5, 13], [8, 1], [8, 4], [8, 6], [8, 8], [8, 11], [8, 14], [11, 2], [11, 5], [11, 8], [11, 10], [11, 12], [11, 14], [14, 2], [14, 5], [14, 8], [14, 10], [14, 12], [14, 14], [17, 2], [17, 4], [17, 6], [17, 8], [17, 10], [17, 12], [20, 2], [20, 4], [20, 6], [20, 8], [20, 10], [20, 12], [23, 2], [23, 4], [23, 6], [23, 8], [23, 10], [23, 12], [26, 2], [26, 4], [26, 6], [26, 8], [26, 10], [26, 11], [29, 3], [29, 5], [29, 6], [29, 8], [29, 9], [29, 11]]
                let newArr = new Array(16 * 32).fill(0)
                renderArr.forEach((a, index) => {
                    let realIndex = renderArr[index][0] * 16 + renderArr[index][1]
                    newArr[realIndex] = wsPointData[index]
                })

                newArr = footInterp(newArr, renderArr)
                let width = 16
                let height = 32

                // let newArr = [...wsPointData]


                // let width = 6
                // let height = 10

                // let newArr = [...newArr1]
                let arr = [];

                // newArr = newArr.map((a) => changeValue(a))

                for (let i = 0; i < height; i++) {
                    arr[i] = [];
                    for (let j = 0; j < width; j++) {
                        arr[i][j] = Math.floor(newArr[i * width + j]);
                    }
                    arr[i][width] = i

                }

                arr[height] = []
                for (let i = 0; i < width; i++) {
                    arr[height][i] = i
                }

                pendingDataRef.current = arr;
                scheduleRender();

            }
        }
    }

    const layoutData = (dataArr) => {


        // dataArr = dataArr.filter((a) => a > valuej1 * 0.025)
        const max = findMax(dataArr)
        const point = dataArr.filter((a) => a > 0).length
        let press = dataArr.reduce((a, b) => a + b, 0)
        // press = Math.floor(press) * 3
        // press = press > 724 ? parseInt((pressData[724] * (press / 724)).toFixed(2)) : pressData[press]
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

        if (!props.local) {
            props.data.current?.handleCharts(totalArr, maxTotal + 20);

        }
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
                backgroundColor: '#fff',
                // alignItems: 'center'
                fontSize: '12px'
            }}
        >

            <div
                className="threeBoxF"
                style={{
                    // color: 'blue', transformStyle: 'preserve-3d',
                    // perspective: '500px',
                    position: 'relative',
                    marginTop: '40px',
                    display: 'flex'
                }}
            >
                {/* <img style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 1 }} src={hand} alt="" /> */}
                <div className="threeBox"
                //  style={{   transform: 'rotateX(35deg)'}}
                >
                    {data.map((items, indexs) => {
                        return (
                            <div key={indexs} style={{ display: 'flex' }}>
                                {items && items.length
                                    ? items.map((item, index) => {
                                        return <div style={{ width: "20px", height: '20px', lineHeight: '20px', backgroundColor: `rgb(${jet1(0, 40, item)})`, border: '1px solid', textAlign: 'center' }}>{item}</div>;
                                    })
                                    : null}
                            </div>
                        );
                    })}
                    <div>{props.matrixName == 'footVideo' ? '左脚' : ''}</div>
                </div>


                <div className="threeBox"
                //  style={{   transform: 'rotateX(35deg)'}}
                >
                    {props.matrixName == 'footVideo' ? data1.map((items, indexs) => {
                        return (
                            <div key={indexs} style={{ display: 'flex' }}>
                                {items && items.length
                                    ? items.map((item, index) => {
                                        return <div style={{ width: "20px", height: '20px', lineHeight: '20px', backgroundColor: `rgb(${jet1(0, 40, item)})`, border: '1px solid', textAlign: 'center' }}>{item}</div>;
                                    })
                                    : null}
                            </div>
                        );
                    }) : ''}
                    <div>{props.matrixName == 'footVideo' ? '右脚' : ''}</div>

                </div>
            </div>
        </div>
    );
})