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
                newArr[col * 16 + firstIndex + k] = firstValue + Math.floor(cha * 10 / length) / 10
            }
        }
    }

    for (let i = 0; i < 9; i++) {
        const col = footPointArr[i * 6 + 0][0]
        const nextCol = footPointArr[(i + 1) * 6 + 0][0]
        const firstIndex = footPointArr[i * 6 + 0][1]
        const lastIndex = footPointArr[i * 6 + 5][1]
        for (let j = firstIndex; j <= lastIndex; j++) {
            newArr[(col + 1) * 16 + j] = newArr[(col) * 16 + j] + Math.floor((newArr[(nextCol) * 16 + j] - newArr[(col) * 16 + j]) * 10 * 1 / 3) / 10
            newArr[(col + 2) * 16 + j] = newArr[(col) * 16 + j] + Math.floor((newArr[(nextCol) * 16 + j] - newArr[(col) * 16 + j]) * 10 * 2 / 3) / 10
        }
    }
    return newArr
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

const MATRIX_WIDTH_RATIO = 0.4;
const MATRIX_SIDE_PANEL_WIDTH = 360;
const MATRIX_HORIZONTAL_PADDING = 48;
const MATRIX_VERTICAL_PADDING = 120;
const MATRIX_MIN_WIDTH = 240;
const MATRIX_MIN_HEIGHT = 280;

function getMatrixViewportBounds() {
    const ww = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const wh = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const ratioWidth = Math.floor(ww * MATRIX_WIDTH_RATIO);
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

// ========== Canvas 2D overlay 绘制函数 ==========
function drawOverlay(ctx, flatData, texWidth, texHeight, cellSize, showNumbers, showBorder) {
    const cw = texWidth * cellSize;
    const ch = texHeight * cellSize;
    ctx.clearRect(0, 0, cw, ch);

    if (showBorder) {
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
    }

    if (showNumbers) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.max(10, cellSize * 0.45)}px monospace`;

        for (let i = 0; i < texHeight; i++) {
            for (let j = 0; j < texWidth; j++) {
                const val = flatData[i * texWidth + j];
                const rounded = Math.round(val);
                ctx.fillStyle = '#fff';
                ctx.fillText(
                    rounded.toString(),
                    j * cellSize + cellSize / 2,
                    i * cellSize + cellSize / 2
                );
            }
        }
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
let _shaderPrewarmed2D = false;
function prewarmWebGL() {
    if (_shaderPrewarmed2D) return;
    _shaderPrewarmed2D = true;
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


export const Num2D = React.forwardRef((props, refs) => {

    let width = 32, height = 32
    if (props.matrixName == 'carCol') {
        width = 10
        height = 9
    }

    const isFoot = props.matrixName === 'footVideo';

    // 计算 cellSize 的辅助函数
    const computeCellSize = useCallback((hasRight = false) => {
        const { maxW, maxH } = getMatrixViewportBounds();

        if (props.matrixName === 'hand0205' || props.matrixName === 'handGlove115200') {
            return calcCellSize(16, 16, maxW, maxH, 40);
        }
        if (isFoot) {
            const tw = hasRight ? 34 : 16;
            const th = 32;
            return calcCellSize(tw, th, maxW, maxH, 40);
        }
        return calcCellSize(width, height, maxW, maxH, 40);
    }, [isFoot, props.matrixName, width, height]);

    // 动态计算 cellSize
    const [cellSize, setCellSize] = useState(() => computeCellSize(false));
    const cellSizeRef = useRef(cellSize);
    cellSizeRef.current = cellSize;

    // WebGL refs
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

    // RAF 节流
    const pendingFlatRef = useRef(null);
    const pendingFlatRef2 = useRef(null);
    const rafIdRef = useRef(null);
    const initedRef = useRef(false);

    // 当前渲染的纹理尺寸
    const texSizeRef = useRef({ w: width, h: height });

    // 预热 WebGL
    useEffect(() => {
        prewarmWebGL();
    }, []);

    // 初始化 WebGL - 根据产品类型使用正确的初始纹理尺寸
    useEffect(() => {
        const cs = cellSizeRef.current;
        if (glCanvasRef.current) {
            let tw = width, th = height;
            // 根据产品类型设置正确的初始纹理尺寸，避免后续 reinit
            if (props.matrixName === 'hand0205' || props.matrixName === 'handGlove115200') { tw = 16; th = 16; }
            else if (isFoot) { tw = 16; th = 32; }
            texSizeRef.current = { w: tw, h: th };
            glCtxRef.current = initWebGL(glCanvasRef.current, tw, th, cs);
            if (overlayCanvasRef.current) {
                overlayCanvasRef.current.width = tw * cs;
                overlayCanvasRef.current.height = th * cs;
                overlayCtxRef.current = overlayCanvasRef.current.getContext('2d');
            }
        }
        initedRef.current = true;

        return () => {
            initedRef.current = false;
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            cleanupWebGL(glCtxRef.current);
            cleanupWebGL(glCtxRef2.current);
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
        if (!isFoot) return;
        const showDualFoot = footLayout === 'dual';
        const newCs = computeCellSize(showDualFoot);
        const cellSizeChanged = cellSizeRef.current !== newCs;

        if (cellSizeChanged) {
            cellSizeRef.current = newCs;
            setCellSize(newCs);
        }

        if (glCanvasRef.current && (cellSizeChanged || !glCtxRef.current)) {
            cleanupWebGL(glCtxRef.current);
            glCtxRef.current = initWebGL(glCanvasRef.current, 16, 32, newCs);
            texSizeRef.current = { w: 16, h: 32 };
            if (overlayCanvasRef.current) {
                overlayCanvasRef.current.width = 16 * newCs;
                overlayCanvasRef.current.height = 32 * newCs;
                overlayCtxRef.current = overlayCanvasRef.current.getContext('2d');
            }
        }

        if (showDualFoot && glCanvasRef2.current && (cellSizeChanged || !glCtxRef2.current)) {
            cleanupWebGL(glCtxRef2.current);
            glCtxRef2.current = initWebGL(glCanvasRef2.current, 16, 32, newCs);
            if (overlayCanvasRef2.current) {
                overlayCanvasRef2.current.width = 16 * newCs;
                overlayCanvasRef2.current.height = 32 * newCs;
                overlayCtxRef2.current = overlayCanvasRef2.current.getContext('2d');
            }
        }

        if (showDualFoot && pendingFlatRef2.current) {
            scheduleRender();
        }
    }, [computeCellSize, footLayout, isFoot]);
    useEffect(() => {
        let resizeTimer = null;
        const handleResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const showDualFoot = footLayoutRef.current === 'dual';
                const newCs = computeCellSize(showDualFoot);
                cellSizeRef.current = newCs;
                setCellSize(newCs);
                // 重新初始化 WebGL canvas 以适应新 cellSize
                if (glCanvasRef.current && glCtxRef.current) {
                    const { w, h } = texSizeRef.current;
                    cleanupWebGL(glCtxRef.current);
                    glCtxRef.current = initWebGL(glCanvasRef.current, w, h, newCs);
                    if (overlayCanvasRef.current) {
                        overlayCanvasRef.current.width = w * newCs;
                        overlayCanvasRef.current.height = h * newCs;
                        overlayCtxRef.current = overlayCanvasRef.current.getContext('2d');
                    }
                }
                if (isFoot && showDualFoot && glCanvasRef2.current && glCtxRef2.current) {
                    cleanupWebGL(glCtxRef2.current);
                    glCtxRef2.current = initWebGL(glCanvasRef2.current, 16, 32, newCs);
                    if (overlayCanvasRef2.current) {
                        overlayCanvasRef2.current.width = 16 * newCs;
                        overlayCanvasRef2.current.height = 32 * newCs;
                        overlayCtxRef2.current = overlayCanvasRef2.current.getContext('2d');
                    }
                }
            }, 200);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(resizeTimer);
        };
    }, [computeCellSize]);

    // 重新初始化 WebGL（当纹理尺寸变化时）
    const reinitGL = useCallback((tw, th) => {
        if (texSizeRef.current.w === tw && texSizeRef.current.h === th && glCtxRef.current) return;
        texSizeRef.current = { w: tw, h: th };
        cleanupWebGL(glCtxRef.current);
        const cs = cellSizeRef.current;
        glCtxRef.current = initWebGL(glCanvasRef.current, tw, th, cs);
        if (overlayCanvasRef.current) {
            overlayCanvasRef.current.width = tw * cs;
            overlayCanvasRef.current.height = th * cs;
            overlayCtxRef.current = overlayCanvasRef.current.getContext('2d');
        }
    }, []);

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
                    drawOverlay(overlayCtxRef.current, data, tw, th, cs, true, true);
                }
                pendingFlatRef.current = null;
            }

            if (pendingFlatRef2.current !== null && glCtxRef2.current) {
                const { data, tw, th } = pendingFlatRef2.current;
                renderWebGL(glCtxRef2.current, data, tw, th);
                if (overlayCtxRef2.current) {
                    drawOverlay(overlayCtxRef2.current, data, tw, th, cs, true, true);
                }
                pendingFlatRef2.current = null;
            }
        });
    }, []);

    // ========== 数据处理函数 ==========

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

        reinitGL(width, height);
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

    const changeWsData147R = (wsPointData) => {
        if (props.matrixName == 'hand0205' || props.matrixName == 'handGlove115200') {
            changeWsData147(wsPointData)
        } else {
            if (isFoot) {
                const { left, right } = wsPointData
                const hasLeftFrame = Array.isArray(left)
                const hasRightFrame = Array.isArray(right)

                const queueFootFrame = (wsData, target) => {
                    const renderArr = [[2, 2], [2, 4], [2, 6], [2, 8], [2, 10], [2, 12], [5, 1], [5, 4], [5, 6], [5, 8], [5, 11], [5, 13], [8, 1], [8, 4], [8, 6], [8, 8], [8, 11], [8, 14], [11, 2], [11, 5], [11, 8], [11, 10], [11, 12], [11, 14], [14, 2], [14, 5], [14, 8], [14, 10], [14, 12], [14, 14], [17, 2], [17, 4], [17, 6], [17, 8], [17, 10], [17, 12], [20, 2], [20, 4], [20, 6], [20, 8], [20, 10], [20, 12], [23, 2], [23, 4], [23, 6], [23, 8], [23, 10], [23, 12], [26, 2], [26, 4], [26, 6], [26, 8], [26, 10], [26, 11], [29, 3], [29, 5], [29, 6], [29, 8], [29, 9], [29, 11]]
                    let newArr = new Array(16 * 32).fill(0)
                    renderArr.forEach((a, index) => {
                        let realIndex = renderArr[index][0] * 16 + renderArr[index][1]
                        newArr[realIndex] = wsData[index]
                    })
                    newArr = footInterp(newArr, renderArr)

                    if (target === 'secondary') {
                        if (!glCtxRef2.current && glCanvasRef2.current) {
                            const cs = cellSizeRef.current;
                            glCtxRef2.current = initWebGL(glCanvasRef2.current, 16, 32, cs);
                            if (overlayCanvasRef2.current) {
                                overlayCanvasRef2.current.width = 16 * cs;
                                overlayCanvasRef2.current.height = 32 * cs;
                                overlayCtxRef2.current = overlayCanvasRef2.current.getContext('2d');
                            }
                        }
                        pendingFlatRef2.current = { data: newArr, tw: 16, th: 32 };
                    } else {
                        reinitGL(16, 32);
                        pendingFlatRef.current = { data: newArr, tw: 16, th: 32 };
                    }

                    scheduleRender();
                }

                if (hasLeftFrame) {
                    syncFootLayout('left')
                    leftArr = [...left]
                    queueFootFrame(left, 'primary')
                    layoutData([...leftArr])
                }

                if (hasRightFrame) {
                    syncFootLayout('right')
                    rightArr = [...right]
                    const target = footLayoutRef.current === 'dual' ? 'secondary' : 'primary'
                    queueFootFrame(right, target)
                    if (target === 'primary') {
                        layoutData([...rightArr])
                    }
                }
            }
        }
    }

    const changeWsData256 = (wsPointData) => {
        let rawData = [...wsPointData]
        // 确保数据长度为256
        if (rawData.length > 256) rawData = rawData.slice(0, 256)
        while (rawData.length < 256) rawData.push(0)

        layoutData([...rawData])

        // 16x16 矩阵直接渲染
        const tw = 16, th = 16;
        reinitGL(tw, th);
        pendingFlatRef.current = { data: rawData, tw, th };
        scheduleRender();
    }

    const changeWsData147 = (wsPointData) => {
        layoutData([...wsPointData])
        if (props.matrixName == 'hand0205' || props.matrixName == 'handGlove115200') {
            let pointArr = [[16, 30], [16, 29], [16, 28], [2, 18], [2, 17], [2, 16], [1, 13], [1, 12], [1, 11], [2, 8], [2, 7], [2, 6], [5, 4], [5, 3], [5, 2], [17, 30], [17, 29], [17, 28], [3, 18], [3, 17], [3, 16], [2, 13], [2, 12], [2, 11], [3, 8], [3, 7], [3, 6], [6, 4], [6, 3], [6, 2], [18, 29], [18, 28], [18, 27], [4, 18], [4, 17], [4, 16], [3, 13], [3, 12], [3, 11], [4, 8], [4, 7], [4, 6], [7, 4], [7, 3], [7, 2], [19, 29], [19, 28], [19, 27], [5, 18], [5, 17], [5, 16], [4, 13], [4, 12], [4, 11], [5, 8], [5, 7], [5, 6], [8, 4], [8, 3], [8, 2], [22, 28], [22, 27], [22, 26], [8, 17], [8, 16], [8, 15], [7, 13], [7, 12], [7, 11], [8, 9], [8, 8], [8, 7], [11, 5], [11, 4], [11, 3], [19, 15], [19, 14], [19, 13], [19, 12], [19, 11], [19, 10], [19, 9], [19, 8], [19, 7], [19, 6], [19, 5], [19, 4], [21, 18], [21, 17], [21, 16], [21, 15], [21, 14], [21, 13], [21, 12], [21, 11], [21, 10], [21, 9], [21, 8], [21, 7], [21, 6], [21, 5], [21, 4], [23, 18], [23, 17], [23, 16], [23, 15], [23, 14], [23, 13], [23, 12], [23, 11], [23, 10], [23, 9], [23, 8], [23, 7], [23, 6], [23, 5], [23, 4], [25, 18], [25, 17], [25, 16], [25, 15], [25, 14], [25, 13], [25, 12], [25, 11], [25, 10], [25, 9], [25, 8], [25, 7], [25, 6], [25, 5], [25, 4], [27, 18], [27, 17], [27, 16], [27, 15], [27, 14], [27, 13], [27, 12], [27, 11], [27, 10], [27, 9], [27, 8], [27, 7], [27, 6], [27, 5], [27, 4]]

            let newArr = new Array(1024).fill(0)

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
                    const nowArr = pointArr[i];
                    const index = nowArr[0] * 32 + nowArr[1]
                    newArr[index] = wsPointData[i]
                }

                const nowArr = pointArr[i];
                const index = nowArr[0] * 32 + nowArr[1]
                if (i >= 4 * 15 && i < 5 * 15) {
                    pointArr[i][0] = pointArr[i][0] + 4
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
            }
            let tw = 36, th = 36
            newArr = addSide(newArr, 32, 32, 2, 2, 0)

            reinitGL(tw, th);
            pendingFlatRef.current = { data: newArr, tw, th };
            scheduleRender();
        } else {
            if (isFoot) {
                const renderArr = [[2, 2], [2, 4], [2, 6], [2, 8], [2, 10], [2, 12], [5, 1], [5, 4], [5, 6], [5, 8], [5, 11], [5, 13], [8, 1], [8, 4], [8, 6], [8, 8], [8, 11], [8, 14], [11, 2], [11, 5], [11, 8], [11, 10], [11, 12], [11, 14], [14, 2], [14, 5], [14, 8], [14, 10], [14, 12], [14, 14], [17, 2], [17, 4], [17, 6], [17, 8], [17, 10], [17, 12], [20, 2], [20, 4], [20, 6], [20, 8], [20, 10], [20, 12], [23, 2], [23, 4], [23, 6], [23, 8], [23, 10], [23, 12], [26, 2], [26, 4], [26, 6], [26, 8], [26, 10], [26, 11], [29, 3], [29, 5], [29, 6], [29, 8], [29, 9], [29, 11]]
                let newArr = new Array(16 * 32).fill(0)
                renderArr.forEach((a, index) => {
                    let realIndex = renderArr[index][0] * 16 + renderArr[index][1]
                    newArr[realIndex] = wsPointData[index]
                })
                newArr = footInterp(newArr, renderArr)

                reinitGL(16, 32);
                pendingFlatRef.current = { data: newArr, tw: 16, th: 32 };
                scheduleRender();
            }
        }
    }

    useImperativeHandle(refs, () => ({
        changeWsData256,
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
    }

    const cs = cellSize;
    const { maxW: containerWidth } = getMatrixViewportBounds();
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
                    marginTop: '40px',
                    display: 'flex',
                    gap: '10px',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    width: `${containerWidth}px`,
                    maxWidth: '100%',
                }}
            >
                {/* 主 canvas（左脚 / 默认） */}
                <div style={{ position: 'relative' }}>
                    <canvas
                        ref={glCanvasRef}
                        style={{ display: 'block' }}
                    />
                    <canvas
                        ref={overlayCanvasRef}
                        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                    />
                    {isFoot && (
                        <div style={{ textAlign: 'center', marginTop: '4px' }}>{primaryFootLabel}</div>
                    )}
                </div>

                {/* 第二个 canvas（footVideo 右脚）- 只在有右脚数据时显示 */}
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
            </div>
        </div>
    );
})
