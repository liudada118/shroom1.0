import React, { useEffect, useState, useImperativeHandle, useRef, useCallback } from 'react'
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
 */
function insertInterpFlat(arr, height, width, n) {
    if (n <= 0) return arr.slice();

    const mat = Array.from({ length: height }, (_, i) =>
        arr.slice(i * width, i * width + width)
    );

    const horz = mat.map(row => {
        const newRow = [];
        for (let j = 0; j < width - 1; j++) {
            const v0 = row[j];
            const v1 = row[j + 1];
            const delta = (v1 - v0) / (n + 1);
            newRow.push(v0);
            for (let k = 1; k <= n; k++) {
                newRow.push(v0 + delta * k);
            }
        }
        newRow.push(row[width - 1]);
        return newRow;
    });

    const resultMat = [];
    for (let i = 0; i < height - 1; i++) {
        const A = horz[i];
        const B = horz[i + 1];
        resultMat.push(A);
        for (let k = 1; k <= n; k++) {
            const t = k / (n + 1);
            const rowK = A.map((v0, j) => v0 + (B[j] - v0) * t);
            resultMat.push(rowK);
        }
    }
    resultMat.push(horz[height - 1]);

    return resultMat.reduce((acc, row) => acc.concat(row), []);
}


let totalArr = [],
    totalPointArr = [];

// ========== jet 颜色映射（JS 版，用于 Canvas 2D） ==========
function jet(min, max, x) {
    let r, g, b;
    r = 1; g = 1; b = 1;
    if (x < min) x = min;
    if (x > max) x = max;
    const dv = max - min;
    if (dv === 0) return [255, 255, 255];
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
    return [Math.round(255 * r), Math.round(255 * g), Math.round(255 * b)];
}

// ========== Canvas 2D 渲染 3D 柱状效果 ==========
function render3DCanvas(ctx, flatData, texW, texH, cellW, cellH, textHeightMul, textColorMax, scale) {
    const canvasW = ctx.canvas.width;
    const canvasH = ctx.canvas.height;
    ctx.clearRect(0, 0, canvasW, canvasH);

    // 黑色背景
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const fontSize = Math.max(8, Math.round(scale * 20));
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 从后往前绘制（远处先画），模拟 3D 深度
    for (let i = 0; i < texH; i++) {
        for (let j = 0; j < texW; j++) {
            const val = flatData[i * texW + j];
            const intVal = Math.round(val);
            const yOffset = -val * textHeightMul;

            const rgb = jet(0, textColorMax, val * 5);
            ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

            const x = j * cellW + cellW / 2;
            const y = i * cellH + cellH / 2 + yOffset;

            ctx.fillText(intVal.toString(), x, y);
        }
    }
}

// Rotation angle presets for changePointRotation (same as other components)
const ROTATION_PRESETS = [0, Math.PI / 6, Math.PI / 3];

const Num3D = React.forwardRef((props, refs) => {

    const textHeightRef = useRef(3)
    const textColorRef = useRef(30)
    let width = 32, height = 32
    if (props.matrixName == 'carCol') {
        width = 10
        height = 9
    }

    // Canvas ref
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);

    // RAF 节流
    const pendingDataRef = useRef(null);
    const rafIdRef = useRef(null);
    const initedRef = useRef(false);
    const texSizeRef = useRef({ w: width, h: height });

    const scaleRef = useRef(1);

    // Rotation state for right-top angle buttons
    const [rotateX, setRotateX] = useState(20);   // degrees, initial tilt
    const [rotateZ, setRotateZ] = useState(0);     // degrees

    const cellW = 32; // 每个单元格宽度（像素）
    const cellH = 24; // 每个单元格高度（像素）
    // 额外高度用于 Y 偏移（柱状效果向上延伸）
    const extraTop = 200;

    const typeRef = useRef('hand')

    // 初始化 Canvas 2D
    useEffect(() => {
        const WW = document.documentElement.clientWidth;
        scaleRef.current = WW / 1920;

        if (canvasRef.current) {
            const tw = texSizeRef.current.w;
            const th = texSizeRef.current.h;
            canvasRef.current.width = tw * cellW;
            canvasRef.current.height = th * cellH + extraTop;
            ctxRef.current = canvasRef.current.getContext('2d');
        }
        initedRef.current = true;

        return () => {
            initedRef.current = false;
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, []);

    const reinitCanvas = useCallback((tw, th) => {
        if (texSizeRef.current.w === tw && texSizeRef.current.h === th && ctxRef.current) return;
        texSizeRef.current = { w: tw, h: th };
        if (canvasRef.current) {
            canvasRef.current.width = tw * cellW;
            canvasRef.current.height = th * cellH + extraTop;
            ctxRef.current = canvasRef.current.getContext('2d');
        }
    }, [cellW, cellH, extraTop]);

    // RAF 调度渲染
    const scheduleRender = useCallback(() => {
        if (rafIdRef.current) return;
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (!initedRef.current) return;

            if (pendingDataRef.current !== null) {
                const { data, tw, th } = pendingDataRef.current;
                if (ctxRef.current) {
                    // 偏移绘制原点，为柱状效果留出顶部空间
                    ctxRef.current.save();
                    ctxRef.current.translate(0, extraTop);
                    render3DCanvas(
                        ctxRef.current, data, tw, th,
                        cellW, cellH,
                        textHeightRef.current, textColorRef.current,
                        scaleRef.current
                    );
                    ctxRef.current.restore();

                    // 清除顶部区域背景
                    ctxRef.current.fillStyle = '#000';
                    ctxRef.current.fillRect(0, 0, tw * cellW, extraTop);
                }
                pendingDataRef.current = null;
            }
        });
    }, [cellW, cellH, extraTop]);

    const changeWsData = (wsPointData) => {
        layoutData(wsPointData)

        let newData = [...wsPointData]
        newData = rotate90CW(newData, 32, 32)
        let ndata = [...newData].map((a) => (a - valuef1 < 0 ? 0 : a));
        const ndataNum = ndata.reduce((a, b) => a + b, 0);
        if (ndataNum < valuelInit1) {
            ndata = new Array(width * height).fill(0);
        }

        const dataG = gaussBlur_2(ndata, width, height, 1.6)

        reinitCanvas(width, height);
        pendingDataRef.current = { data: dataG, tw: width, th: height };
        scheduleRender();
    }

    const changeWsData147 = (wsPointData) => {
        let pointArr = [[16, 30], [16, 29], [16, 28], [2, 18], [2, 17], [2, 16], [1, 13], [1, 12], [1, 11], [2, 8], [2, 7], [2, 6], [5, 4], [5, 3], [5, 2], [17, 30], [17, 29], [17, 28], [3, 18], [3, 17], [3, 16], [2, 13], [2, 12], [2, 11], [3, 8], [3, 7], [3, 6], [6, 4], [6, 3], [6, 2], [18, 29], [18, 28], [18, 27], [4, 18], [4, 17], [4, 16], [3, 13], [3, 12], [3, 11], [4, 8], [4, 7], [4, 6], [7, 4], [7, 3], [7, 2], [19, 29], [19, 28], [19, 27], [5, 18], [5, 17], [5, 16], [4, 13], [4, 12], [4, 11], [5, 8], [5, 7], [5, 6], [8, 4], [8, 3], [8, 2], [22, 28], [22, 27], [22, 26], [8, 17], [8, 16], [8, 15], [7, 13], [7, 12], [7, 11], [8, 9], [8, 8], [8, 7], [11, 5], [11, 4], [11, 3], [19, 15], [19, 14], [19, 13], [19, 12], [19, 11], [19, 10], [19, 9], [19, 8], [19, 7], [19, 6], [19, 5], [19, 4], [21, 18], [21, 17], [21, 16], [21, 15], [21, 14], [21, 13], [21, 12], [21, 11], [21, 10], [21, 9], [21, 8], [21, 7], [21, 6], [21, 5], [21, 4], [23, 18], [23, 17], [23, 16], [23, 15], [23, 14], [23, 13], [23, 12], [23, 11], [23, 10], [23, 9], [23, 8], [23, 7], [23, 6], [23, 5], [23, 4], [25, 18], [25, 17], [25, 16], [25, 15], [25, 14], [25, 13], [25, 12], [25, 11], [25, 10], [25, 9], [25, 8], [25, 7], [25, 6], [25, 5], [25, 4], [27, 18], [27, 17], [27, 16], [27, 15], [27, 14], [27, 13], [27, 12], [27, 11], [27, 10], [27, 9], [27, 8], [27, 7], [27, 6], [27, 5], [27, 4]]

        let newArr = new Array(1024).fill(0)
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
                    const idx = (nowArr[0] + j) * 32 + nowArr[1]
                    newArr[idx] = wsPointData[i]
                }
            } else {
                const idx = (nowArr[0] + 1) * 32 + nowArr[1]
                newArr[idx] = wsPointData[i]
            }
        }

        let tw = 36, th = 36
        newArr = addSide(newArr, 32, 32, 2, 2, 0)
        newArr = gaussBlur_2(newArr, tw, th, 1.2)

        reinitCanvas(tw, th);
        pendingDataRef.current = { data: newArr, tw, th };
        scheduleRender();
    }

    const sitValue = (prop) => {
        const { valuej, valueg, value, valuel, valuef, valuelInit } = prop;
        if (valuej) valuej1 = valuej;
        if (valueg) valueg1 = valueg;
        if (value) {
            value1 = value;
            textHeightRef.current = value;
        }
        if (valuej) {
            textColorRef.current = valuej;
        }
        if (valuel) valuel1 = valuel;
        if (valuef) valuef1 = valuef;
        if (valuelInit) valuelInit1 = valuelInit;
    }

    const changeWsDatafinger = (wsPointData) => {
        const w = 3, h = 4
        let data = []
        for (let i = 0; i < 4; i++) {
            for (let j = 6; j < 9; j++) {
                data.push(wsPointData[i * 15 + j])
            }
        }
        let newArr = new Array(1024).fill(0)
        let k = 0
        for (let i = 13; i < 17; i++) {
            for (let j = 14; j < 14 + 3; j++) {
                newArr[i * 32 + j] = data[k]
                k++
            }
        }
        newArr = gaussBlur_2(newArr, 32, 32, 1.6)

        reinitCanvas(32, 32);
        pendingDataRef.current = { data: newArr, tw: 32, th: 32 };
        scheduleRender();
    }

    const changeWsDatapalm = (wsPointData) => {
        const w = 15, h = 5
        let data = []
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 15; j++) {
                data.push(wsPointData[i * 15 + j])
            }
        }
        let newArr = new Array(1024).fill(0)
        let k = 0
        for (let i = 13; i < 18; i++) {
            for (let j = 7; j < 7 + 15; j++) {
                newArr[i * 32 + j] = data[k]
                k++
            }
        }
        newArr = gaussBlur_2(newArr, 32, 32, 1.6)

        reinitCanvas(32, 32);
        pendingDataRef.current = { data: newArr, tw: 32, th: 32 };
        scheduleRender();
    }

    const layoutData = (dataArr) => {
        const max = findMax(dataArr)
        const point = dataArr.filter((a) => a > 0).length
        let press = dataArr.reduce((a, b) => a + b, 0)
        const mean = press / (point == 0 ? 1 : point)
        props.data.current?.changeData({
            meanPres: mean.toFixed(2),
            maxPres: max,
            point: point,
            totalPres: `${press}`,
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
    }

    const drawContent = () => { }

    const changeType = (str) => {
        typeRef.current = str
    }

    // ========== 视角调节接口 (compatible with Home.jsx right-top buttons) ==========
    const changePointRotation = ({ direction, value }) => {
        const angleDeg = (ROTATION_PRESETS[value] || 0) * (180 / Math.PI);
        if (direction === 'x') {
            setRotateX(20 + angleDeg); // 20deg base + rotation
        } else if (direction === 'z') {
            setRotateZ(angleDeg);
        }
    }

    const changeGroupRotate = ({ x, z }) => {
        if (x !== undefined) {
            const angleDeg = (ROTATION_PRESETS[x] || 0) * (180 / Math.PI);
            setRotateX(20 + angleDeg);
        }
        if (z !== undefined) {
            const angleDeg = (ROTATION_PRESETS[z] || 0) * (180 / Math.PI);
            setRotateZ(angleDeg);
        }
    }

    const reset = () => {
        setRotateX(20);
        setRotateZ(0);
    }

    // 正面视角：rotateX=0, rotateZ=0（完全正对屏幕）
    const setFrontView = () => {
        setRotateX(0);
        setRotateZ(0);
    }

    useImperativeHandle(refs, () => ({
        changeWsData: changeWsData,
        drawContent: drawContent,
        sitValue,
        changeType,
        changeWsDatafinger,
        changeWsDatapalm,
        changeWsData147,
        // 视角调节接口
        changePointRotation,
        changeGroupRotate,
        reset,
        setFrontView,
    }));

    function boxesForGauss(sigma, n) {
        var wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1);
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

    // 计算 canvas 尺寸
    const tw = texSizeRef.current.w;
    const th = texSizeRef.current.h;

    // Calculate scale to fit within viewport
    // Canvas native size
    const canvasNativeW = tw * cellW;
    const canvasNativeH = th * cellH + extraTop;

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#000',
                overflow: 'hidden',
            }}
        >
            <div
                className="threeBoxF"
                style={{
                    transformStyle: 'preserve-3d',
                    perspective: '500px',
                }}
            >
                <div
                    style={{
                        transform: `rotateX(${rotateX}deg) rotateZ(${rotateZ}deg)`,
                        maxWidth: '85vw',
                        maxHeight: '85vh',
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        width={canvasNativeW}
                        height={canvasNativeH}
                        style={{
                            display: 'block',
                            maxWidth: '85vw',
                            maxHeight: '85vh',
                            objectFit: 'contain',
                        }}
                    />
                </div>
            </div>
        </div>
    );
})

export default Num3D
