import React, { useEffect, useState, useImperativeHandle } from 'react'
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

function insertWb(arr, dataArr, arrW, arrH, startX, startY, width, height) {

    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const newX = startY + i
            const newY = startX + j
            const newIndex = newX * arrW + newY
            arr[newIndex] = dataArr[i * width + j]
        }
    }
}

function genNewArr(arr, positionArr,) {
    const res = []
    for (let i = 0; i < positionArr.length; i++) {
        res[i] = arr[positionArr[i] - 1]
    }
    return res
}

function genNewArrMatrix(arr, width, height) {
    const res = []
    for (let i = 0; i < height; i++) {
        res[i] = []
        for (let j = 0; j < width; j++) {
            res[i].push(arr[i * width + j])
        }
    }
    return res
}

let leftArr = [], rightArr = []
export const 
 Num2DOriginal = React.forwardRef((props, refs) => {
    let width = 32, height = 32
    if (props.matrixName == 'carCol') {
        width = 10
        height = 9
    }
    const [data, setData] = useState([[]]);
    const [data1, setData1] = useState([[]]);
    const [obj, setObj] = useState()
    const [scale, setScale] = useState(1)



    const changeWsData = (wsPointData) => {

        console.log(wsPointData.length, valuef1)
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
        setData(a);
    }

    const sitValue = (prop) => {
        console.log(prop)
        const { valuej, valueg, value, valuel, valuef, valuelInit } = prop;
        if (valuej) valuej1 = valuej;
        if (valueg) valueg1 = valueg;
        if (value) value1 = value;
        if (valuel) valuel1 = valuel;
        if (valuef) valuef1 = valuef;
        if (valuelInit) valuelInit1 = valuelInit;

    }

    const drawContent = () => { }

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

            let newArr1 = [...wsPointData]
            newArr1.splice(5 * 15, 0, 0);
            newArr1.splice(5 * 15, 0, 0);
            newArr1.splice(5 * 15, 0, 0);
            {
                let width = 15
                let height = 10
                let newArr = [...newArr1]
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

                setData(arr);
            }
        } else {

            if (props.matrixName == 'footVideo') {
                // const renderArr = [[2, 2], [2, 4], [2, 6], [2, 8], [2, 10], [2, 12], [5, 1], [5, 4], [5, 6], [5, 8], [5, 11], [5, 13], [8, 1], [8, 4], [8, 6], [8, 8], [8, 11], [8, 14], [11, 2], [11, 5], [11, 8], [11, 10], [11, 12], [11, 14], [14, 2], [14, 5], [14, 8], [14, 10], [14, 12], [14, 14], [17, 2], [17, 4], [17, 6], [17, 8], [17, 10], [17, 12], [20, 2], [20, 4], [20, 6], [20, 8], [20, 10], [20, 12], [23, 2], [23, 4], [23, 6], [23, 8], [23, 10], [23, 12], [26, 2], [26, 4], [26, 6], [26, 8], [26, 10], [26, 11], [29, 3], [29, 5], [29, 6], [29, 8], [29, 9], [29, 11]]
                // let newArr = new Array(16 * 32).fill(0)
                // renderArr.forEach((a, index) => {
                //     let realIndex = renderArr[index][0] * 16 + renderArr[index][1]
                //     newArr[realIndex] = wsPointData[index]
                // })


                // let width = 16
                // let height = 32

                let newArr = [...wsPointData]


                let width = 6
                let height = 10

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

                setData(arr);
            } else if (props.matrixName == 'robotSY') {
                // const back = [62,46,30,14,254,238,222,206,61,45,29,13,253,237,221,205,60,44,28,12,252,236,220,204,59,43,27,11,251,235,219,203,58,42,26,10,250,234,218,202]
                const back = [
                    62, 61, 60, 59, 58,
                    46, 45, 44, 43, 42,
                    254, 253, 252, 251, 250,
                    14, 13, 12, 11, 10,
                    30, 29, 28, 27, 26
                ]

                // const chest = [195, 211, 227, 243, 3, 19, 35, 51, 196, 212, 228, 244, 4, 20, 36, 52, 197, 213, 229, 245, 5, 21, 37, 53, 198, 214, 230, 246, 6, 22, 38, 54, 199, 215, 231, 247, 7, 23, 39, 55, 200, 216, 232, 248, 8, 24, 40, 56]
                const chest = [
                    51, 35, 19, 3, 243, 227, 211, 195,
                    52, 36, 20, 4, 244, 228, 212, 196,
                    53, 37, 21, 5, 245, 229, 213, 197,
                    54, 38, 22, 6, 246, 230, 214, 198,
                    55, 39, 23, 7, 247, 231, 215, 199,
                    56, 40, 24, 8, 248, 232, 216, 200
                ]

                const shoulderL = [9, 25, 41, 57]
                const shoulderR = [249, 233, 217, 201]

                const handL = [79, 95, 111, 127, 80, 96, 112, 128]

                const handR = [177, 162, 146, 130, 178, 161, 145, 129]

                const obj = {
                    back: {
                        data: genNewArrMatrix(genNewArr(wsPointData, back), 5, 5),
                        text: '脑袋',
                    },
                    handL: {
                        data: genNewArrMatrix(genNewArr(wsPointData, handL), 4, 2),
                        text: '左臂',
                    },
                    shoulderL: {
                        data: genNewArrMatrix(genNewArr(wsPointData, shoulderL), 4, 1),
                        text: '左肩',
                    },
                    shoulderR: {
                        data: genNewArrMatrix(genNewArr(wsPointData, shoulderR), 4, 1),
                        text: '右肩',
                    },
                    handR: {
                        data: genNewArrMatrix(genNewArr(wsPointData, handR), 4, 2),
                        text: '右臂',
                    },
                    chest: {
                        data: genNewArrMatrix(genNewArr(wsPointData, chest), 8, 6),
                        text: '前胸',
                    },
                }

                setObj(obj)

                const newArr = new Array(1024).fill(0)

                insertWb(newArr, genNewArr(wsPointData, back), 32, 32, 11, 0, 8, 5)

                insertWb(newArr, genNewArr(wsPointData, handL), 32, 32, 0, 8, 4, 2)

                insertWb(newArr, genNewArr(wsPointData, shoulderL), 32, 32, 4, 8, 4, 1)
                insertWb(newArr, genNewArr(wsPointData, shoulderR), 32, 32, 8, 8, 4, 1)
                insertWb(newArr, genNewArr(wsPointData, handR), 32, 32, 12, 8, 4, 2)

                insertWb(newArr, genNewArr(wsPointData, chest), 32, 32, 11, 12, 8, 6)


                {
                    let width = 32
                    let height = 32
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

                    // setData(arr);
                }
            } else if (props.matrixName == 'robotLCF') {
                // const back = [62,46,30,14,254,238,222,206,61,45,29,13,253,237,221,205,60,44,28,12,252,236,220,204,59,43,27,11,251,235,219,203,58,42,26,10,250,234,218,202]
                const back = [
                    62, 61, 60, 59, 58,
                    46, 45, 44, 43, 42,
                    254, 253, 252, 251, 250,
                    14, 13, 12, 11, 10,
                    30, 29, 28, 27, 26
                ]

                // const chest = [195, 211, 227, 243, 3, 19, 35, 51, 196, 212, 228, 244, 4, 20, 36, 52, 197, 213, 229, 245, 5, 21, 37, 53, 198, 214, 230, 246, 6, 22, 38, 54, 199, 215, 231, 247, 7, 23, 39, 55, 200, 216, 232, 248, 8, 24, 40, 56]
                const chest = [
                    205, 221, 237, 253, 13, 29, 45, 61,
                    204, 220, 236, 252, 12, 28, 44, 60,
                    203, 219, 235, 251, 11, 27, 43, 59,
                    202, 218, 234, 250, 10, 26, 42, 58,
                    201, 217, 233, 249, 9, 25, 41, 57,
                    195, 211, 227, 243, 3, 19, 35, 51,
                    196, 212, 228, 244, 4, 20, 36, 52,
                    197, 213, 229, 245, 5, 21, 37, 53,
                    198, 214, 230, 246, 6, 22, 38, 54,
                    199, 215, 231, 247, 7, 23, 39, 55,
                    200, 216, 232, 248, 8, 24, 40, 56
                ]

                for (let i = 0; i < 11; i++) {
                    for (let j = 0; j < 4; j++) {
                        [chest[i * 8 + j], chest[i * 8 + 7 - j]] = [chest[i * 8 + 7 - j], chest[i * 8 + j]]
                    }
                }

                const shoulderL = [14, 30, 46, 62,
                ]
                const shoulderR = [254, 238, 222, 206
                ]

                const handL = [
                    79, 95, 111, 127,
                    80, 96, 112, 128

                ]

                const handR = [
                    177, 162, 146, 130,
                    178, 161, 145, 129

                ]

                const obj = {
                    
                    handL: {
                        data: genNewArrMatrix(genNewArr(wsPointData, handL), 4, 2),
                        text: '左臂',
                    },
                    shoulderL: {
                        data: genNewArrMatrix(genNewArr(wsPointData, shoulderL), 4, 1),
                        text: '左肩',
                    },
                    chest: {
                        data: genNewArrMatrix(genNewArr(wsPointData, chest), 8, 11),
                        text: '前胸',
                    },
                    shoulderR: {
                        data: genNewArrMatrix(genNewArr(wsPointData, shoulderR), 4, 1),
                        text: '右肩',
                    },
                    handR: {
                        data: genNewArrMatrix(genNewArr(wsPointData, handR), 4, 2),
                        text: '右臂',
                    },
                    
                }

                setObj(obj)
                console.log(obj , wsPointData)
                const newArr = new Array(1024).fill(0)

                insertWb(newArr, genNewArr(wsPointData, back), 32, 32, 11, 0, 8, 5)

                insertWb(newArr, genNewArr(wsPointData, handL), 32, 32, 0, 8, 4, 2)

                insertWb(newArr, genNewArr(wsPointData, shoulderL), 32, 32, 4, 8, 4, 1)
                insertWb(newArr, genNewArr(wsPointData, shoulderR), 32, 32, 8, 8, 4, 1)
                insertWb(newArr, genNewArr(wsPointData, handR), 32, 32, 12, 8, 4, 2)

                insertWb(newArr, genNewArr(wsPointData, chest), 32, 32, 11, 12, 8, 6)


                {
                    let width = 32
                    let height = 32
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

                    // setData(arr);
                }
            } else {
                const back = [
                    58, 42, 26, 10, 250, 234, 218, 202, 59,
                    43, 27, 11, 251, 235, 219, 203, 60, 44,
                    28, 12, 252, 236, 220, 204, 61, 45, 29,
                    13, 253, 237, 221, 205, 62, 46, 30, 14,
                    254, 238, 222, 206
                ]

                const chest = [
                    195, 211, 227, 243, 3, 19, 35, 51, 196, 212,
                    228, 244, 4, 20, 36, 52, 197, 213, 229, 245,
                    5, 21, 37, 53, 198, 214, 230, 246, 6, 22,
                    38, 54, 199, 215, 231, 247, 7, 23, 39, 55,
                    200, 216, 232, 248, 8, 24, 40, 56
                ]

                const shoulderL = [9, 25, 41, 57].reverse()
                const shoulderR = [249, 233, 217, 201]

                const handL = [
                    79, 95, 111, 127,
                    80, 96, 112, 128
                ].reverse()

                const handR = [
                    177, 162, 146,
                    130, 178, 161,
                    145, 129
                ]

                const obj = {
                    back: {
                        data: genNewArrMatrix(genNewArr(wsPointData, back), 8, 5),
                        text: '后背',
                    },
                    handL: {
                        data: genNewArrMatrix(genNewArr(wsPointData, handL), 4, 2),
                        text: '左臂',
                    },
                    shoulderL: {
                        data: genNewArrMatrix(genNewArr(wsPointData, shoulderL), 4, 1),
                        text: '左肩',
                    },
                    shoulderR: {
                        data: genNewArrMatrix(genNewArr(wsPointData, shoulderR), 4, 1),
                        text: '右肩',
                    },
                    handR: {
                        data: genNewArrMatrix(genNewArr(wsPointData, handR), 4, 2),
                        text: '右臂',
                    },
                    chest: {
                        data: genNewArrMatrix(genNewArr(wsPointData, chest), 8, 6),
                        text: '前胸',
                    },
                }

                setObj(obj)

                const newArr = new Array(1024).fill(0)

                insertWb(newArr, genNewArr(wsPointData, back), 32, 32, 11, 0, 8, 5)

                insertWb(newArr, genNewArr(wsPointData, handL), 32, 32, 0, 8, 4, 2)

                insertWb(newArr, genNewArr(wsPointData, shoulderL), 32, 32, 4, 8, 4, 1)
                insertWb(newArr, genNewArr(wsPointData, shoulderR), 32, 32, 8, 8, 4, 1)
                insertWb(newArr, genNewArr(wsPointData, handR), 32, 32, 12, 8, 4, 2)

                insertWb(newArr, genNewArr(wsPointData, chest), 32, 32, 11, 12, 8, 6)


                {
                    let width = 32
                    let height = 32
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

                    // setData(arr);
                }
            }



        }
        // setData(a);
    }

    const changeWsData147R = (wsPointData) => {


        if (props.matrixName == 'hand0205') {

        } else {

            if (props.matrixName == 'footVideo') {
                // const renderArr = [[2, 2], [2, 4], [2, 6], [2, 8], [2, 10], [2, 12], [5, 1], [5, 4], [5, 6], [5, 8], [5, 11], [5, 13], [8, 1], [8, 4], [8, 6], [8, 8], [8, 11], [8, 14], [11, 2], [11, 5], [11, 8], [11, 10], [11, 12], [11, 14], [14, 2], [14, 5], [14, 8], [14, 10], [14, 12], [14, 14], [17, 2], [17, 4], [17, 6], [17, 8], [17, 10], [17, 12], [20, 2], [20, 4], [20, 6], [20, 8], [20, 10], [20, 12], [23, 2], [23, 4], [23, 6], [23, 8], [23, 10], [23, 12], [26, 2], [26, 4], [26, 6], [26, 8], [26, 10], [26, 11], [29, 3], [29, 5], [29, 6], [29, 8], [29, 9], [29, 11]]
                // let newArr = new Array(16 * 32).fill(0)
                // renderArr.forEach((a, index) => {
                //     let realIndex = renderArr[index][0] * 16 + renderArr[index][1]
                //     newArr[realIndex] = wsPointData[index]
                // })
                // let newArr = [...wsPointData]
                const { left, right } = wsPointData

                if (left) {
                    leftArr = [...left]
                    let newArr = [...left]


                    let width = 6
                    let height = 10

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

                    setData(arr);
                }

                if (right) {
                    rightArr = [...right]
                    let width = 6
                    let height = 10
                    // let newArr = [...newArr1]
                    let arr = [];

                    // newArr = newArr.map((a) => changeValue(a))

                    for (let i = 0; i < height; i++) {
                        arr[i] = [];
                        for (let j = 0; j < width; j++) {
                            arr[i][j] = Math.floor(right[i * width + j]);
                        }
                        arr[i][width] = i

                    }

                    arr[height] = []
                    for (let i = 0; i < width; i++) {
                        arr[height][i] = i
                    }

                    setData1(arr);
                }
                const newArr = [...leftArr, ...rightArr]
                const dataArr = [...newArr]
                layoutData([...dataArr])

            }



        }
        // setData(a);
    }

    const layoutData = (dataArr) => {


        // dataArr = dataArr.filter((a) => a > valuej1 * 0.025)
        const max = findMax(dataArr)
        const point = dataArr.filter((a) => a > 0).length
        let press = dataArr.reduce((a, b) => a + b, 0)
        // press = Math.floor(press) * 3
        // console.log(press)
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

        if (!props.local)
            props.data.current?.handleCharts(totalArr.map(a => { return a - 1 > 0 ? a - 1 : 0 }), maxTotal + 20);

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
                    marginTop: '20px',
                    display: 'flex'
                }}
            >
                {/* <img style={{ position: 'absolute',width : '100%' , height : '100%' ,zIndex : 1}} src={hand} alt="" /> */}
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
                    {props.matrixName == 'footVideo' ? '左脚' : ''}
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
                    {props.matrixName == 'footVideo' ? '右脚' : ''}

                </div>

                {
                    obj ? Object.values(obj).map((objItem, index) => {
                        return (
                            <div className="threeBox"
                                //  style={{   transform: 'rotateX(35deg)'}}
                                style={{ marginRight: '20px' }}
                            >
                                {objItem.data.map((items, indexs) => {
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
                                {objItem.text}
                            </div>
                        )
                    }) : ''
                }
            </div>
        </div>
    );
})