import React, { useEffect, useRef, useState, useCallback, useImperativeHandle } from 'react'
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

function genNewArr(arr, positionArr) {
    const res = []
    for (let i = 0; i < positionArr.length; i++) {
        const value = Number(arr[positionArr[i] - 1])
        res[i] = Number.isFinite(value) ? value : 0
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

// ========== 动态计算 cellSize ==========
function calcCellSize(texW, texH, maxW, maxH, padding) {
    const availW = maxW - padding * 2;
    const availH = maxH - padding * 2;
    const cellW = Math.floor(availW / texW);
    const cellH = Math.floor(availH / texH);
    return Math.max(8, Math.min(cellW, cellH));
}

// 为 robot 分区计算合适的 cellSize
function calcRobotCellSize(parts, maxW, maxH) {
    let totalW = 0;
    let maxPartH = 0;
    parts.forEach((p, idx) => {
        totalW += p.w;
        if (p.h > maxPartH) maxPartH = p.h;
    });
    totalW += (parts.length - 1) * 3 + parts.length * 2;
    maxPartH += 3;

    const availW = maxW - 60;
    const availH = maxH - 100;
    const cellW = Math.floor(availW / totalW);
    const cellH = Math.floor(availH / maxPartH);
    return Math.max(12, Math.min(cellW, cellH, 35));
}

// ========== Jet 色谱（Canvas 2D 版本） ==========
function jet1(minVal, maxVal, x) {
    if (x < minVal) x = minVal;
    if (x > maxVal) x = maxVal;
    const dv = maxVal - minVal;
    if (dv === 0) return [0, 0, 255];
    const t = (x - minVal) / dv;

    let r = 255, g = 255, b = 255;
    if (t < 0.25) {
        r = 0;
        g = Math.round(4.0 * t * 255);
        b = 255;
    } else if (t < 0.5) {
        r = 0;
        g = 255;
        b = Math.round((1.0 - 4.0 * (t - 0.25)) * 255);
    } else if (t < 0.75) {
        r = Math.round(4.0 * (t - 0.5) * 255);
        g = 255;
        b = 0;
    } else {
        r = 255;
        g = Math.round((1.0 - 4.0 * (t - 0.75)) * 255);
        b = 0;
    }
    return [r, g, b];
}

// ========== Canvas 2D 渲染函数（颜色 + 数字 + 网格线 + 行列索引） ==========
function renderCanvas2D(ctx, flatData, texWidth, texHeight, cellSize) {
    const cw = texWidth * cellSize;
    const ch = texHeight * cellSize;
    ctx.canvas.width = cw + 30;
    ctx.canvas.height = ch + 30;
    ctx.clearRect(0, 0, cw + 30, ch + 30);

    // 计算动态最大值
    let maxVal = 0;
    const len = Math.min(flatData.length, texWidth * texHeight);
    for (let i = 0; i < len; i++) {
        const v = Math.round(flatData[i]);
        if (v > maxVal) maxVal = v;
    }
    const dynamicMax = Math.max(maxVal, 1);

    // 绘制颜色格子
    for (let i = 0; i < texHeight; i++) {
        for (let j = 0; j < texWidth; j++) {
            const idx = i * texWidth + j;
            const val = idx < len ? Math.round(flatData[idx]) : 0;
            const [r, g, b] = jet1(0, dynamicMax, val);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
        }
    }

    // 绘制网格线
    ctx.strokeStyle = 'rgba(0, 0, 40, 0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= texHeight; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(cw, i * cellSize);
        ctx.stroke();
    }
    for (let j = 0; j <= texWidth; j++) {
        ctx.beginPath();
        ctx.moveTo(j * cellSize, 0);
        ctx.lineTo(j * cellSize, ch);
        ctx.stroke();
    }

    // 绘制数字
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.max(10, cellSize * 0.45)}px monospace`;

    for (let i = 0; i < texHeight; i++) {
        for (let j = 0; j < texWidth; j++) {
            const idx = i * texWidth + j;
            const val = idx < len ? Math.round(flatData[idx]) : 0;
            ctx.fillStyle = '#fff';
            ctx.fillText(
                val.toString(),
                j * cellSize + cellSize / 2,
                i * cellSize + cellSize / 2
            );
        }
    }

    // 行索引（右侧）
    ctx.fillStyle = '#333';
    ctx.font = `${Math.max(8, cellSize * 0.35)}px monospace`;
    ctx.textAlign = 'left';
    for (let i = 0; i < texHeight; i++) {
        ctx.fillText(
            i.toString(),
            cw + 2,
            i * cellSize + cellSize / 2
        );
    }
    // 列索引（底部）
    ctx.textAlign = 'center';
    for (let j = 0; j < texWidth; j++) {
        ctx.fillText(
            j.toString(),
            j * cellSize + cellSize / 2,
            ch + cellSize * 0.5
        );
    }
}


const MATRIX_WIDTH_RATIO = 0.4;
const ROBOT_MATRIX_WIDTH_RATIO = 0.6;
const MATRIX_SIDE_PANEL_WIDTH = 360;
const MATRIX_HORIZONTAL_PADDING = 48;
const MATRIX_VERTICAL_PADDING = 120;
const MATRIX_MIN_WIDTH = 240;
const MATRIX_MIN_HEIGHT = 280;

function getMatrixViewportBounds(widthRatio = MATRIX_WIDTH_RATIO) {
    const ww = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const wh = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const ratioWidth = Math.floor(ww * widthRatio);
    const availableWidth = Math.max(ww - MATRIX_SIDE_PANEL_WIDTH - MATRIX_HORIZONTAL_PADDING, 160);
    const safeViewportWidth = Math.max(ww - 32, 160);
    const maxW = Math.min(
        safeViewportWidth,
        Math.max(MATRIX_MIN_WIDTH, Math.min(ratioWidth, availableWidth))
    );

    return {
        maxW,
        maxH: Math.max(MATRIX_MIN_HEIGHT, wh - MATRIX_VERTICAL_PADDING),
    };
}

export const Num2DOriginal = React.forwardRef((props, refs) => {
    let width = 32, height = 32
    if (props.matrixName == 'carCol') {
        width = 10
        height = 9
    }

    const isRobot = props.matrixName === 'robotSY' || props.matrixName === 'robotLCF' || props.matrixName === 'robot1';
    const isFoot = props.matrixName === 'footVideo';

    // 计算初始 cellSize 的辅助函数
    const computeCellSize = useCallback((hasRight = false) => {
        const { maxW, maxH } = getMatrixViewportBounds(isRobot ? ROBOT_MATRIX_WIDTH_RATIO : MATRIX_WIDTH_RATIO);

        if (isRobot) {
            return calcRobotCellSize(
                [{ w: 8, h: 6 }, { w: 4, h: 2 }, { w: 4, h: 1 }, { w: 4, h: 1 }, { w: 4, h: 2 }, { w: 8, h: 6 }],
                maxW, maxH
            );
        }
        if (props.matrixName === 'hand0205' || props.matrixName === 'handGlove115200') {
            return calcCellSize(15, 10, maxW, maxH, 40);
        }
        if (isFoot) {
            return 30; // 触觉足底固定 30×30px 单元格
        }
        return calcCellSize(width, height, maxW, maxH, 40);
    }, [isRobot, isFoot, props.matrixName, width, height]);

    // 动态计算 cellSize
    const [cellSize, setCellSize] = useState(() => computeCellSize(false));
    const cellSizeRef = useRef(cellSize);
    cellSizeRef.current = cellSize;

    // Canvas refs - 主 canvas（单个 canvas 同时绘制颜色和数字）
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);

    // 第二个 canvas（footVideo 右脚）
    const canvasRef2 = useRef(null);
    const ctxRef2 = useRef(null);

    // 足底：是否有右脚数据
    const [footLayout, setFootLayout] = useState('single-left');
    const footLayoutRef = useRef('single-left');
    const lastLeftFootFrameRef = useRef(0);
    const lastRightFootFrameRef = useRef(0);

    // robot 分区 canvas refs
    const robotCanvasRefs = useRef([]);
    const robotCtxRefs = useRef([]);

    // RAF 节流
    const pendingFlatRef = useRef(null);
    const pendingFlatRef2 = useRef(null);
    const pendingRobotRef = useRef(null);
    const rafIdRef = useRef(null);
    const initedRef = useRef(false);

    // robot 分区状态
    const [robotParts, setRobotParts] = useState(null);
    const robotPartsRef = useRef(null);

    // 初始化 Canvas 2D
    useEffect(() => {
        if (!isRobot && canvasRef.current) {
            ctxRef.current = canvasRef.current.getContext('2d');
        }
        initedRef.current = true;

        return () => {
            initedRef.current = false;
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, []);

    const syncFootLayout = useCallback((side) => {
        if (!isFoot) return footLayoutRef.current;
        const now = Date.now();
        const ttl = 1200;
        if (side === 'left') {
            lastLeftFootFrameRef.current = now;
        }
        if (side === 'right') {
            lastRightFootFrameRef.current = now;
        }

        const leftActive = now - lastLeftFootFrameRef.current < ttl;
        const rightActive = now - lastRightFootFrameRef.current < ttl;
        const nextLayout = leftActive && rightActive ? 'dual' : rightActive ? 'single-right' : 'single-left';

        if (footLayoutRef.current !== nextLayout) {
            footLayoutRef.current = nextLayout;
            setFootLayout(nextLayout);
        }

        return nextLayout;
    }, [isFoot]);

    useEffect(() => {
        const showDualFoot = footLayout === 'dual';
        if (isFoot && showDualFoot && canvasRef2.current && !ctxRef2.current) {
            ctxRef2.current = canvasRef2.current.getContext('2d');
        }
        if (isFoot) {
            const newCs = computeCellSize(showDualFoot);
            cellSizeRef.current = newCs;
            setCellSize(newCs);
        }
        if (showDualFoot && pendingFlatRef2.current) {
            scheduleRender();
        }
    }, [computeCellSize, footLayout, isFoot]);
    useEffect(() => {
        if (robotParts && robotParts.length > 0) {
            requestAnimationFrame(() => {
                robotParts.forEach((part, idx) => {
                    if (robotCanvasRefs.current[idx] && !robotCtxRefs.current[idx]) {
                        robotCtxRefs.current[idx] = robotCanvasRefs.current[idx].getContext('2d');
                    }
                });
            });
        }
    }, [robotParts]);

    useEffect(() => {
        let resizeTimer = null;
        const handleResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const showDualFoot = footLayoutRef.current === 'dual';
                const newCs = computeCellSize(showDualFoot);
                cellSizeRef.current = newCs;
                setCellSize(newCs);
            }, 200);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(resizeTimer);
        };
    }, [computeCellSize]);

    // RAF 调度渲染
    const scheduleRender = useCallback(() => {
        if (rafIdRef.current) return;
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (!initedRef.current) return;
            const cs = cellSizeRef.current;

            if (pendingFlatRef.current !== null) {
                const { data, tw, th } = pendingFlatRef.current;
                if (ctxRef.current) {
                    renderCanvas2D(ctxRef.current, data, tw, th, cs);
                }
                pendingFlatRef.current = null;
            }

            if (pendingFlatRef2.current !== null && ctxRef2.current) {
                const { data, tw, th } = pendingFlatRef2.current;
                renderCanvas2D(ctxRef2.current, data, tw, th, cs);
                pendingFlatRef2.current = null;
            }

            if (pendingRobotRef.current !== null) {
                const parts = pendingRobotRef.current;
                parts.forEach((part, idx) => {
                    if (robotCtxRefs.current[idx]) {
                        renderCanvas2D(robotCtxRefs.current[idx], part.data, part.w, part.h, cs);
                    }
                });
                pendingRobotRef.current = null;
            }
        });
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

        pendingFlatRef.current = { data: wsPointData, tw: width, th: height };
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

    // 处理 robot 类型的分区数据
    const processRobotParts = (wsPointData, objDef) => {
        const parts = Object.entries(objDef).map(([key, val]) => {
            const flatData = genNewArr(wsPointData, val.posArr);
            return {
                key,
                text: val.text,
                w: val.w,
                h: val.h,
                data: flatData
            };
        });

        // 检查分区是否变化，需要更新 JSX
        if (!robotPartsRef.current || robotPartsRef.current.length !== parts.length) {
            const partsMeta = parts.map(p => ({ key: p.key, text: p.text, w: p.w, h: p.h }));
            robotPartsRef.current = partsMeta;
            robotCtxRefs.current = [];

            // 动态计算 robot 的 cellSize
            const { maxW, maxH } = getMatrixViewportBounds(ROBOT_MATRIX_WIDTH_RATIO);
            const newCs = calcRobotCellSize(partsMeta, maxW, maxH);
            cellSizeRef.current = newCs;
            setCellSize(newCs);

            setRobotParts(partsMeta);
        }

        pendingRobotRef.current = parts;
        scheduleRender();
    }

    const changeWsData147 = (wsPointData) => {
        layoutData([...wsPointData])

        if (props.matrixName == 'hand0205' || props.matrixName == 'handGlove115200') {
            let newArr1 = [...wsPointData]
            newArr1.splice(5 * 15, 0, 0);
            newArr1.splice(5 * 15, 0, 0);
            newArr1.splice(5 * 15, 0, 0);

            const tw = 15, th = 10;
            pendingFlatRef.current = { data: newArr1, tw, th };
            scheduleRender();
        } else if (props.matrixName == 'footVideo') {
            let newArr = [...wsPointData]
            const tw = 6, th = 10;
            pendingFlatRef.current = { data: newArr, tw, th };
            scheduleRender();
        } else if (props.matrixName == 'robotSY') {
            const back = [62, 61, 60, 59, 58, 46, 45, 44, 43, 42, 254, 253, 252, 251, 250, 14, 13, 12, 11, 10, 30, 29, 28, 27, 26]
            const chest = [51, 35, 19, 3, 243, 227, 211, 195, 52, 36, 20, 4, 244, 228, 212, 196, 53, 37, 21, 5, 245, 229, 213, 197, 54, 38, 22, 6, 246, 230, 214, 198, 55, 39, 23, 7, 247, 231, 215, 199, 56, 40, 24, 8, 248, 232, 216, 200]
            const shoulderL = [9, 25, 41, 57]
            const shoulderR = [249, 233, 217, 201]
            const handL = [79, 95, 111, 127, 80, 96, 112, 128]
            const handR = [177, 162, 146, 130, 178, 161, 145, 129]

            processRobotParts(wsPointData, {
                back: { posArr: back, text: '脑袋', w: 5, h: 5 },
                handL: { posArr: handL, text: '左臂', w: 4, h: 2 },
                shoulderL: { posArr: shoulderL, text: '左肩', w: 4, h: 1 },
                shoulderR: { posArr: shoulderR, text: '右肩', w: 4, h: 1 },
                handR: { posArr: handR, text: '右臂', w: 4, h: 2 },
                chest: { posArr: chest, text: '前胸', w: 8, h: 6 },
            });
        } else if (props.matrixName == 'robotLCF') {
            const chest = [51, 35, 19, 3, 243, 227, 211, 195, 52, 36, 20, 4, 244, 228, 212, 196, 53, 37, 21, 5, 245, 229, 213, 197, 54, 38, 22, 6, 246, 230, 214, 198, 55, 39, 23, 7, 247, 231, 215, 199, 56, 40, 24, 8, 248, 232, 216, 200, 57, 41, 25, 9, 249, 233, 217, 201, 58, 42, 26, 10, 250, 234, 218, 202, 59, 43, 27, 11, 251, 235, 219, 203, 60, 44, 28, 12, 252, 236, 220, 204, 61, 45, 29, 13, 253, 237, 221, 205, 62, 46, 30, 14, 254, 238, 222, 206]
            const shoulderL = [15, 31, 47, 63]
            const shoulderR = [255, 239, 223, 207]
            const handL = [79, 95, 111, 127, 80, 96, 112, 128]
            const handR = [177, 162, 146, 130, 178, 161, 145, 129]

            processRobotParts(wsPointData, {
                handL: { posArr: handL, text: '左臂', w: 4, h: 2 },
                shoulderL: { posArr: shoulderL, text: '左肩', w: 4, h: 1 },
                shoulderR: { posArr: shoulderR, text: '右肩', w: 4, h: 1 },
                handR: { posArr: handR, text: '右臂', w: 4, h: 2 },
                chest: { posArr: chest, text: '前胸', w: 8, h: 12 },
            });
        } else if (props.matrixName == 'robot1') {
            const back = [62, 61, 60, 59, 58, 46, 45, 44, 43, 42, 254, 253, 252, 251, 250, 14, 13, 12, 11, 10, 30, 29, 28, 27, 26, 78, 77, 76, 75, 74, 94, 93, 92, 91, 90, 110, 109, 108, 107, 106]
            const chest = [51, 35, 19, 3, 243, 227, 211, 195, 52, 36, 20, 4, 244, 228, 212, 196, 53, 37, 21, 5, 245, 229, 213, 197, 54, 38, 22, 6, 246, 230, 214, 198, 55, 39, 23, 7, 247, 231, 215, 199, 56, 40, 24, 8, 248, 232, 216, 200]
            const shoulderL = [9, 25, 41, 57]
            const shoulderR = [249, 233, 217, 201]
            const handL = [126, 125, 124, 123, 142, 141, 140, 139]
            const handR = [177, 162, 146, 130, 178, 161, 145, 129]

            processRobotParts(wsPointData, {
                back: { posArr: back, text: '后背', w: 8, h: 5 },
                handL: { posArr: handL, text: '左臂', w: 4, h: 2 },
                shoulderL: { posArr: shoulderL, text: '左肩', w: 4, h: 1 },
                shoulderR: { posArr: shoulderR, text: '右肩', w: 4, h: 1 },
                handR: { posArr: handR, text: '右臂', w: 4, h: 2 },
                chest: { posArr: chest, text: '前胸', w: 8, h: 6 },
            });
        }
    }

    const changeWsData147R = (wsPointData) => {
        if (props.matrixName == 'hand0205' || props.matrixName == 'handGlove115200') {
            changeWsData147(wsPointData)
        } else if (props.matrixName == 'footVideo') {
            const { left, right } = wsPointData
            const hasLeftFrame = Array.isArray(left)
            const hasRightFrame = Array.isArray(right)

            if (hasLeftFrame) {
                syncFootLayout('left')
                leftArr = [...left]
                const tw = 6, th = 10;
                pendingFlatRef.current = { data: left, tw, th };
                scheduleRender();
                layoutData([...leftArr])
            }

            if (hasRightFrame) {
                syncFootLayout('right')
                rightArr = [...right]
                const tw = 6, th = 10;
                if (footLayoutRef.current === 'dual') {
                    if (!ctxRef2.current && canvasRef2.current) {
                        ctxRef2.current = canvasRef2.current.getContext('2d');
                    }
                    pendingFlatRef2.current = { data: right, tw, th };
                } else {
                    pendingFlatRef.current = { data: right, tw, th };
                    layoutData([...rightArr]);
                }
                scheduleRender();
            }
        }
    }

    useImperativeHandle(refs, () => ({
        changeWsData147,
        changeWsData147R,
        changeWsData: changeWsData,
        drawContent: drawContent,
        sitValue
    }));

    // ========== 高斯模糊 ==========
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

    useEffect(() => {
        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, []);

    const cs = cellSize;
    const { maxW: containerWidth } = getMatrixViewportBounds(isRobot ? ROBOT_MATRIX_WIDTH_RATIO : MATRIX_WIDTH_RATIO);
    const showDualFoot = footLayout === 'dual';
    const primaryFootLabel = footLayout === 'single-right' ? '\u53f3\u811a' : '\u5de6\u811a';

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#fff',
                fontSize: '12px'
            }}
        >
            <div
                className="threeBoxF"
                style={{
                    position: 'relative',
                    marginTop: '20px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    width: `${containerWidth}px`,
                    maxWidth: '100%',
                }}
            >
                {/* 非 robot 类型：主 canvas */}
                {!isRobot && (
                    <div>
                        <canvas
                            ref={canvasRef}
                            style={{ display: 'block' }}
                        />
                        {isFoot && <div style={{ textAlign: 'center', marginTop: '4px' }}>{primaryFootLabel}</div>}
                    </div>
                )}

                {/* footVideo 右脚 - 只在有右脚数据时显示 */}
                {isFoot && showDualFoot && (
                    <div>
                        <canvas
                            ref={canvasRef2}
                            style={{ display: 'block' }}
                        />
                        <div style={{ textAlign: 'center', marginTop: '4px' }}>右脚</div>
                    </div>
                )}

                {/* robot 分区 canvas */}
                {isRobot && robotParts && robotParts.map((part, idx) => (
                    <div key={part.key} style={{ margin: '0 5px' }}>
                        <canvas
                            ref={el => { robotCanvasRefs.current[idx] = el; }}
                            style={{ display: 'block' }}
                        />
                        <div style={{ textAlign: 'center', marginTop: '4px' }}>{part.text}</div>
                    </div>
                ))}
            </div>
        </div>
    );
})
