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

// ========== WebGL Shaders ==========
const VERTEX_SHADER_SRC = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAGMENT_SHADER_SRC = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_data;
  uniform float u_min;
  uniform float u_max;

  vec3 jet1(float minVal, float maxVal, float x) {
    if (x < minVal) x = minVal;
    if (x > maxVal) x = maxVal;
    float dv = maxVal - minVal;
    if (dv == 0.0) return vec3(0.0, 0.0, 1.0);
    float t = (x - minVal) / dv;

    float r = 1.0, g = 1.0, b = 1.0;
    if (t < 0.25) {
      r = 0.0;
      g = 4.0 * t;
      b = 1.0;
    } else if (t < 0.5) {
      r = 0.0;
      g = 1.0;
      b = 1.0 - 4.0 * (t - 0.25);
    } else if (t < 0.75) {
      r = 4.0 * (t - 0.5);
      g = 1.0;
      b = 0.0;
    } else {
      r = 1.0;
      g = 1.0 - 4.0 * (t - 0.75);
      b = 0.0;
    }
    return vec3(r, g, b);
  }

  void main() {
    float value = texture2D(u_data, v_texCoord).r * 255.0;
    vec3 color = jet1(u_min, u_max, value);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

// ========== WebGL 初始化函数 ==========
function initWebGL(canvas, texWidth, texHeight, cellSize) {
    const cw = texWidth * cellSize;
    const ch = texHeight * cellSize;
    canvas.width = cw;
    canvas.height = ch;

    const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) return null;

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    const program = createProgram(gl, vs, fs);
    gl.useProgram(program);

    const positions = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
    const texCoords = new Float32Array([0,1, 1,1, 0,0, 0,0, 1,1, 1,0]);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    const aTex = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(aTex);
    gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const texData = new Uint8Array(texWidth * texHeight);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, texWidth, texHeight, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, texData);

    const uMin = gl.getUniformLocation(program, 'u_min');
    const uMax = gl.getUniformLocation(program, 'u_max');
    gl.uniform1f(uMin, 0);
    gl.uniform1f(uMax, 40);
    gl.uniform1i(gl.getUniformLocation(program, 'u_data'), 0);
    gl.viewport(0, 0, cw, ch);

    return { gl, program, texture, texData, uMin, uMax, vs, fs, posBuffer, texBuffer };
}

// ========== WebGL 渲染函数 ==========
function renderWebGL(glCtx, flatData, texWidth, texHeight) {
    if (!glCtx) return;
    const { gl, texture, texData, uMin, uMax } = glCtx;
    const len = Math.min(flatData.length, texWidth * texHeight);
    let maxVal = 0;
    for (let i = 0; i < len; i++) {
        const v = Math.min(255, Math.max(0, Math.round(flatData[i])));
        texData[i] = v;
        if (v > maxVal) maxVal = v;
    }
    const dynamicMax = Math.max(maxVal, 1);
    gl.uniform1f(uMin, 0);
    gl.uniform1f(uMax, dynamicMax);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, texWidth, texHeight, gl.LUMINANCE, gl.UNSIGNED_BYTE, texData);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// ========== Canvas 2D overlay 绘制函数（数字 + 网格线 + 行列索引） ==========
function drawOverlay(ctx, flatData, texWidth, texHeight, cellSize) {
    const cw = texWidth * cellSize;
    const ch = texHeight * cellSize;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

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

    const len = Math.min(flatData.length, texWidth * texHeight);
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

// ========== 清理 WebGL 资源 ==========
function cleanupWebGL(glCtx) {
    if (!glCtx) return;
    const { gl, program, texture, vs, fs, posBuffer, texBuffer } = glCtx;
    gl.deleteTexture(texture);
    gl.deleteProgram(program);
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    gl.deleteBuffer(posBuffer);
    gl.deleteBuffer(texBuffer);
}

// ========== 预热 WebGL ==========
let _shaderPrewarmedOriginal = false;
function prewarmWebGL() {
    if (_shaderPrewarmedOriginal) return;
    _shaderPrewarmedOriginal = true;
    try {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        const gl = c.getContext('webgl', { antialias: false });
        if (!gl) return;
        const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
        const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
        const prog = createProgram(gl, vs, fs);
        gl.deleteProgram(prog);
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
    } catch (e) { /* ignore */ }
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
            return 30;
        }
        return calcCellSize(width, height, maxW, maxH, 40);
    }, [isRobot, isFoot, props.matrixName, width, height]);

    // 动态计算 cellSize
    const [cellSize, setCellSize] = useState(() => computeCellSize(false));
    const cellSizeRef = useRef(cellSize);
    cellSizeRef.current = cellSize;

    // WebGL refs - 主 canvas
    const glCanvasRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const glCtxRef = useRef(null);
    const overlayCtxRef = useRef(null);

    // 第二个 canvas（footVideo 右脚）
    const glCanvasRef2 = useRef(null);
    const overlayCanvasRef2 = useRef(null);
    const glCtxRef2 = useRef(null);
    const overlayCtxRef2 = useRef(null);

    // 足底：是否有右脚数据
    const [footLayout, setFootLayout] = useState('single-left');
    const footLayoutRef = useRef('single-left');
    const lastLeftFootFrameRef = useRef(0);
    const lastRightFootFrameRef = useRef(0);

    // robot 分区 WebGL + overlay refs
    const robotGlCanvasRefs = useRef([]);
    const robotOverlayCanvasRefs = useRef([]);
    const robotGlCtxRefs = useRef([]);
    const robotOverlayCtxRefs = useRef([]);

    // RAF 节流
    const pendingFlatRef = useRef(null);
    const pendingFlatRef2 = useRef(null);
    const pendingRobotRef = useRef(null);
    const rafIdRef = useRef(null);
    const initedRef = useRef(false);

    // robot 分区状态
    const [robotParts, setRobotParts] = useState(null);
    const robotPartsRef = useRef(null);

    // 当前渲染的纹理尺寸
    const texSizeRef = useRef({ w: width, h: height });

    // 预热 WebGL
    useEffect(() => {
        prewarmWebGL();
    }, []);

    // 初始化 WebGL
    useEffect(() => {
        if (!isRobot && glCanvasRef.current) {
            let tw = width, th = height;
            if (props.matrixName === 'hand0205' || props.matrixName === 'handGlove115200') { tw = 15; th = 10; }
            else if (isFoot) { tw = 6; th = 10; }
            texSizeRef.current = { w: tw, h: th };
            const cs = cellSizeRef.current;
            glCtxRef.current = initWebGL(glCanvasRef.current, tw, th, cs);
            if (overlayCanvasRef.current) {
                overlayCanvasRef.current.width = tw * cs + 30;
                overlayCanvasRef.current.height = th * cs + 30;
                overlayCtxRef.current = overlayCanvasRef.current.getContext('2d');
            }
        }
        initedRef.current = true;

        return () => {
            initedRef.current = false;
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            cleanupWebGL(glCtxRef.current);
            cleanupWebGL(glCtxRef2.current);
            // 清理 robot 分区 WebGL
            robotGlCtxRefs.current.forEach(ctx => cleanupWebGL(ctx));
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
        if (isFoot && showDualFoot && glCanvasRef2.current && !glCtxRef2.current) {
            const cs = cellSizeRef.current;
            glCtxRef2.current = initWebGL(glCanvasRef2.current, 6, 10, cs);
            if (overlayCanvasRef2.current) {
                overlayCanvasRef2.current.width = 6 * cs + 30;
                overlayCanvasRef2.current.height = 10 * cs + 30;
                overlayCtxRef2.current = overlayCanvasRef2.current.getContext('2d');
            }
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

    // 初始化 robot 分区的 WebGL
    useEffect(() => {
        if (robotParts && robotParts.length > 0) {
            requestAnimationFrame(() => {
                const cs = cellSizeRef.current;
                robotParts.forEach((part, idx) => {
                    if (robotGlCanvasRefs.current[idx] && !robotGlCtxRefs.current[idx]) {
                        robotGlCtxRefs.current[idx] = initWebGL(robotGlCanvasRefs.current[idx], part.w, part.h, cs);
                    }
                    if (robotOverlayCanvasRefs.current[idx] && !robotOverlayCtxRefs.current[idx]) {
                        const overlayCanvas = robotOverlayCanvasRefs.current[idx];
                        overlayCanvas.width = part.w * cs + 30;
                        overlayCanvas.height = part.h * cs + 30;
                        robotOverlayCtxRefs.current[idx] = overlayCanvas.getContext('2d');
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

                // 重新初始化主 WebGL
                if (!isRobot && glCanvasRef.current && glCtxRef.current) {
                    const { w, h } = texSizeRef.current;
                    cleanupWebGL(glCtxRef.current);
                    glCtxRef.current = initWebGL(glCanvasRef.current, w, h, newCs);
                    if (overlayCanvasRef.current) {
                        overlayCanvasRef.current.width = w * newCs + 30;
                        overlayCanvasRef.current.height = h * newCs + 30;
                        overlayCtxRef.current = overlayCanvasRef.current.getContext('2d');
                    }
                }

                // 重新初始化 robot 分区 WebGL
                if (isRobot && robotPartsRef.current) {
                    robotPartsRef.current.forEach((part, idx) => {
                        cleanupWebGL(robotGlCtxRefs.current[idx]);
                        if (robotGlCanvasRefs.current[idx]) {
                            robotGlCtxRefs.current[idx] = initWebGL(robotGlCanvasRefs.current[idx], part.w, part.h, newCs);
                        }
                        if (robotOverlayCanvasRefs.current[idx]) {
                            robotOverlayCanvasRefs.current[idx].width = part.w * newCs + 30;
                            robotOverlayCanvasRefs.current[idx].height = part.h * newCs + 30;
                            robotOverlayCtxRefs.current[idx] = robotOverlayCanvasRefs.current[idx].getContext('2d');
                        }
                    });
                }
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
                renderWebGL(glCtxRef.current, data, tw, th);
                if (overlayCtxRef.current) {
                    drawOverlay(overlayCtxRef.current, data, tw, th, cs);
                }
                pendingFlatRef.current = null;
            }

            if (pendingFlatRef2.current !== null && glCtxRef2.current) {
                const { data, tw, th } = pendingFlatRef2.current;
                renderWebGL(glCtxRef2.current, data, tw, th);
                if (overlayCtxRef2.current) {
                    drawOverlay(overlayCtxRef2.current, data, tw, th, cs);
                }
                pendingFlatRef2.current = null;
            }

            if (pendingRobotRef.current !== null) {
                const parts = pendingRobotRef.current;
                parts.forEach((part, idx) => {
                    renderWebGL(robotGlCtxRefs.current[idx], part.data, part.w, part.h);
                    if (robotOverlayCtxRefs.current[idx]) {
                        drawOverlay(robotOverlayCtxRefs.current[idx], part.data, part.w, part.h, cs);
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
            robotGlCtxRefs.current.forEach(ctx => cleanupWebGL(ctx));
            robotGlCtxRefs.current = [];
            robotOverlayCtxRefs.current = [];

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
            // 修正后的 robot1 索引映射（基于 robot0401 的原始 256 点 16x16 数据）
            const back = [58, 42, 26, 10, 250, 234, 218, 202, 59, 43, 27, 11, 251, 235, 219, 203, 60, 44, 28, 12, 252, 236, 220, 204, 61, 45, 29, 13, 253, 237, 221, 205, 62, 46, 30, 14, 254, 238, 222, 206]
            const chest = [195, 211, 227, 243, 3, 19, 35, 51, 196, 212, 228, 244, 4, 20, 36, 52, 197, 213, 229, 245, 5, 21, 37, 53, 198, 214, 230, 246, 6, 22, 38, 54, 199, 215, 231, 247, 7, 23, 39, 55, 200, 216, 232, 248, 8, 24, 40, 56]
            const shoulderL = [249, 233, 217, 201]
            const shoulderR = [57, 41, 25, 9]
            const handL = [80, 79, 96, 95, 112, 111, 128, 127]
            const handR = [178, 177, 162, 161, 146, 145, 130, 129]

            processRobotParts(wsPointData, {
                back: { posArr: back, text: '后背', w: 8, h: 5 },
                handL: { posArr: handL, text: '左臂', w: 2, h: 4 },
                shoulderL: { posArr: shoulderL, text: '左肩', w: 1, h: 4 },
                shoulderR: { posArr: shoulderR, text: '右肩', w: 1, h: 4 },
                handR: { posArr: handR, text: '右臂', w: 2, h: 4 },
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
                    if (!glCtxRef2.current && glCanvasRef2.current) {
                        const cs = cellSizeRef.current;
                        glCtxRef2.current = initWebGL(glCanvasRef2.current, 6, 10, cs);
                        if (overlayCanvasRef2.current) {
                            overlayCanvasRef2.current.width = 6 * cs + 30;
                            overlayCanvasRef2.current.height = 10 * cs + 30;
                            overlayCtxRef2.current = overlayCanvasRef2.current.getContext('2d');
                        }
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
                {/* 非 robot 类型：主 canvas（WebGL + overlay） */}
                {!isRobot && (
                    <div style={{ position: 'relative' }}>
                        <canvas
                            ref={glCanvasRef}
                            style={{ display: 'block' }}
                        />
                        <canvas
                            ref={overlayCanvasRef}
                            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                        />
                        {isFoot && <div style={{ textAlign: 'center', marginTop: '4px' }}>{primaryFootLabel}</div>}
                    </div>
                )}

                {/* footVideo 右脚 - 只在有右脚数据时显示 */}
                {isFoot && showDualFoot && (
                    <div style={{ position: 'relative' }}>
                        <canvas
                            ref={glCanvasRef2}
                            style={{ display: 'block' }}
                        />
                        <canvas
                            ref={overlayCanvasRef2}
                            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                        />
                        <div style={{ textAlign: 'center', marginTop: '4px' }}>右脚</div>
                    </div>
                )}

                {/* robot 分区 canvas（WebGL + overlay） */}
                {isRobot && robotParts && robotParts.map((part, idx) => (
                    <div key={part.key} style={{ margin: '0 5px', position: 'relative' }}>
                        <canvas
                            ref={el => { robotGlCanvasRefs.current[idx] = el; }}
                            style={{ display: 'block' }}
                        />
                        <canvas
                            ref={el => { robotOverlayCanvasRefs.current[idx] = el; }}
                            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                        />
                        <div style={{ textAlign: 'center', marginTop: '4px' }}>{part.text}</div>
                    </div>
                ))}
            </div>
        </div>
    );
})
