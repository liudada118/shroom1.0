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
    float r = 0.0, g = 0.0, b = 0.5;
    if (x < minVal) x = minVal;
    if (x > maxVal) x = maxVal;
    float dv = maxVal - minVal;
    if (dv == 0.0) return vec3(0.0, 0.0, 0.5);

    if (x < minVal + 0.125 * dv) {
      r = 0.0; g = 0.0; b = 0.5 + 0.5 * (x - minVal) / (0.125 * dv);
    } else if (x < minVal + 0.375 * dv) {
      r = 0.0;
      g = (x - minVal - 0.125 * dv) / (0.25 * dv);
      b = 1.0;
    } else if (x < minVal + 0.625 * dv) {
      r = (x - minVal - 0.375 * dv) / (0.25 * dv);
      g = 1.0;
      b = 1.0 - (x - minVal - 0.375 * dv) / (0.25 * dv);
    } else if (x < minVal + 0.875 * dv) {
      r = 1.0;
      g = 1.0 - (x - minVal - 0.625 * dv) / (0.25 * dv);
      b = 0.0;
    } else {
      r = 1.0 - 0.5 * (x - minVal - 0.875 * dv) / (0.125 * dv);
      g = 0.0;
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

function initWebGL(canvas, texWidth, texHeight, cellSize) {
    const cw = texWidth * cellSize;
    const ch = texHeight * cellSize;
    canvas.width = cw;
    canvas.height = ch;

    const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
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

function renderWebGL(glCtx, flatData, texWidth, texHeight) {
    if (!glCtx) return;
    const { gl, texture, texData } = glCtx;
    const len = Math.min(flatData.length, texWidth * texHeight);
    for (let i = 0; i < len; i++) {
        texData[i] = Math.min(255, Math.max(0, Math.round(flatData[i])));
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, texWidth, texHeight, gl.LUMINANCE, gl.UNSIGNED_BYTE, texData);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function drawOverlay(ctx, flatData, texWidth, texHeight, cellSize, showNumbers, showBorder) {
    const cw = texWidth * cellSize;
    const ch = texHeight * cellSize;
    ctx.clearRect(0, 0, cw, ch);

    if (showBorder) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 0.5;
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
        ctx.font = `${Math.max(8, cellSize * 0.5)}px monospace`;

        for (let i = 0; i < texHeight; i++) {
            for (let j = 0; j < texWidth; j++) {
                const val = flatData[i * texWidth + j];
                if (val > 0) {
                    ctx.fillStyle = (val > 24 || val < 5) ? '#fff' : '#000';
                    ctx.fillText(
                        Math.round(val).toString(),
                        j * cellSize + cellSize / 2,
                        i * cellSize + cellSize / 2
                    );
                }
            }
        }
    }
}

// 为 robotSY/robotLCF/robot1 的分区绘制 overlay（带行列索引）
function drawOverlayWithIndex(ctx, flatData, texWidth, texHeight, cellSize) {
    const cw = texWidth * cellSize;
    const ch = texHeight * cellSize;
    ctx.clearRect(0, 0, cw, ch);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 0.5;
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

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(8, cellSize * 0.45)}px monospace`;

    for (let i = 0; i < texHeight; i++) {
        for (let j = 0; j < texWidth; j++) {
            const val = flatData[i * texWidth + j];
            ctx.fillStyle = (val > 24 || val < 5) ? '#fff' : '#000';
            ctx.fillText(
                Math.round(val).toString(),
                j * cellSize + cellSize / 2,
                i * cellSize + cellSize / 2
            );
        }
    }

    // 行索引（右侧）
    ctx.fillStyle = '#333';
    ctx.font = `${Math.max(8, cellSize * 0.4)}px monospace`;
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
            ch + cellSize * 0.6
        );
    }
}

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


export const Num2DOriginal = React.forwardRef((props, refs) => {
    let width = 32, height = 32
    if (props.matrixName == 'carCol') {
        width = 10
        height = 9
    }
    const cellSize = 20;

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

    // robot 分区 canvas refs（最多6个分区）
    const robotGlRefs = useRef([]);
    const robotOverlayRefs = useRef([]);
    const robotGlCtxs = useRef([]);
    const robotOverlayCtxs = useRef([]);

    // RAF 节流
    const pendingFlatRef = useRef(null);
    const pendingFlatRef2 = useRef(null);
    const pendingRobotRef = useRef(null);
    const rafIdRef = useRef(null);
    const initedRef = useRef(false);

    const texSizeRef = useRef({ w: width, h: height });

    // robot 分区状态（用于触发 JSX 更新分区数量）
    const [robotParts, setRobotParts] = useState(null);
    const robotPartsRef = useRef(null);

    // 初始化 WebGL
    useEffect(() => {
        const isRobot = props.matrixName === 'robotSY' || props.matrixName === 'robotLCF' || props.matrixName === 'robot1';
        if (!isRobot && glCanvasRef.current) {
            const tw = (props.matrixName === 'hand0205') ? 15 : width;
            const th = (props.matrixName === 'hand0205') ? 11 : height;
            texSizeRef.current = { w: tw, h: th };
            glCtxRef.current = initWebGL(glCanvasRef.current, tw, th, cellSize);
            if (overlayCanvasRef.current) {
                overlayCanvasRef.current.width = tw * cellSize + 20;
                overlayCanvasRef.current.height = th * cellSize + 20;
                overlayCtxRef.current = overlayCanvasRef.current.getContext('2d');
            }
        }
        initedRef.current = true;

        return () => {
            initedRef.current = false;
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            cleanupWebGL(glCtxRef.current);
            cleanupWebGL(glCtxRef2.current);
            robotGlCtxs.current.forEach(ctx => cleanupWebGL(ctx));
        };
    }, []);

    // 初始化第二个 canvas（footVideo）
    useEffect(() => {
        if (props.matrixName === 'footVideo' && glCanvasRef2.current && !glCtxRef2.current) {
            glCtxRef2.current = initWebGL(glCanvasRef2.current, 6, 10, cellSize);
            if (overlayCanvasRef2.current) {
                overlayCanvasRef2.current.width = 6 * cellSize + 20;
                overlayCanvasRef2.current.height = 10 * cellSize + 20;
                overlayCtxRef2.current = overlayCanvasRef2.current.getContext('2d');
            }
        }
    }, [props.matrixName]);

    // 初始化 robot 分区 canvas
    useEffect(() => {
        if (robotParts && robotParts.length > 0) {
            // 延迟一帧确保 DOM 已渲染
            requestAnimationFrame(() => {
                robotParts.forEach((part, idx) => {
                    if (robotGlRefs.current[idx] && !robotGlCtxs.current[idx]) {
                        robotGlCtxs.current[idx] = initWebGL(robotGlRefs.current[idx], part.w, part.h, cellSize);
                        if (robotOverlayRefs.current[idx]) {
                            robotOverlayRefs.current[idx].width = part.w * cellSize + 20;
                            robotOverlayRefs.current[idx].height = part.h * cellSize + 20;
                            robotOverlayCtxs.current[idx] = robotOverlayRefs.current[idx].getContext('2d');
                        }
                    }
                });
            });
        }
    }, [robotParts]);

    const reinitGL = useCallback((tw, th) => {
        if (texSizeRef.current.w === tw && texSizeRef.current.h === th && glCtxRef.current) return;
        texSizeRef.current = { w: tw, h: th };
        cleanupWebGL(glCtxRef.current);
        if (glCanvasRef.current) {
            glCtxRef.current = initWebGL(glCanvasRef.current, tw, th, cellSize);
            if (overlayCanvasRef.current) {
                overlayCanvasRef.current.width = tw * cellSize + 20;
                overlayCanvasRef.current.height = th * cellSize + 20;
                overlayCtxRef.current = overlayCanvasRef.current.getContext('2d');
            }
        }
    }, [cellSize]);

    // RAF 调度渲染
    const scheduleRender = useCallback(() => {
        if (rafIdRef.current) return;
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (!initedRef.current) return;

            if (pendingFlatRef.current !== null) {
                const { data, tw, th } = pendingFlatRef.current;
                renderWebGL(glCtxRef.current, data, tw, th);
                if (overlayCtxRef.current) {
                    drawOverlayWithIndex(overlayCtxRef.current, data, tw, th, cellSize);
                }
                pendingFlatRef.current = null;
            }

            if (pendingFlatRef2.current !== null) {
                const { data, tw, th } = pendingFlatRef2.current;
                renderWebGL(glCtxRef2.current, data, tw, th);
                if (overlayCtxRef2.current) {
                    drawOverlayWithIndex(overlayCtxRef2.current, data, tw, th, cellSize);
                }
                pendingFlatRef2.current = null;
            }

            if (pendingRobotRef.current !== null) {
                const parts = pendingRobotRef.current;
                parts.forEach((part, idx) => {
                    if (robotGlCtxs.current[idx]) {
                        renderWebGL(robotGlCtxs.current[idx], part.data, part.w, part.h);
                        if (robotOverlayCtxs.current[idx]) {
                            drawOverlayWithIndex(robotOverlayCtxs.current[idx], part.data, part.w, part.h, cellSize);
                        }
                    }
                });
                pendingRobotRef.current = null;
            }
        });
    }, [cellSize]);

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
            // 清理旧的 WebGL 上下文
            robotGlCtxs.current.forEach(ctx => cleanupWebGL(ctx));
            robotGlCtxs.current = [];
            robotOverlayCtxs.current = [];
            setRobotParts(partsMeta);
        }

        pendingRobotRef.current = parts;
        scheduleRender();
    }

    const changeWsData147 = (wsPointData) => {
        layoutData([...wsPointData])

        if (props.matrixName == 'hand0205') {
            let newArr1 = [...wsPointData]
            newArr1.splice(5 * 15, 0, 0);
            newArr1.splice(5 * 15, 0, 0);
            newArr1.splice(5 * 15, 0, 0);

            const tw = 15, th = 10;
            reinitGL(tw, th);
            pendingFlatRef.current = { data: newArr1, tw, th };
            scheduleRender();
        } else if (props.matrixName == 'footVideo') {
            let newArr = [...wsPointData]
            const tw = 6, th = 10;
            reinitGL(tw, th);
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
            // 翻转每行
            for (let i = 0; i < 11; i++) {
                for (let j = 0; j < 4; j++) {
                    [chest[i * 8 + j], chest[i * 8 + 7 - j]] = [chest[i * 8 + 7 - j], chest[i * 8 + j]]
                }
            }
            const shoulderL = [14, 30, 46, 62]
            const shoulderR = [254, 238, 222, 206]
            const handL = [79, 95, 111, 127, 80, 96, 112, 128]
            const handR = [177, 162, 146, 130, 178, 161, 145, 129]

            processRobotParts(wsPointData, {
                handL: { posArr: handL, text: '左臂', w: 4, h: 2 },
                shoulderL: { posArr: shoulderL, text: '左肩', w: 4, h: 1 },
                chest: { posArr: chest, text: '前胸', w: 8, h: 11 },
                shoulderR: { posArr: shoulderR, text: '右肩', w: 4, h: 1 },
                handR: { posArr: handR, text: '右臂', w: 4, h: 2 },
            });
        } else {
            // robot1 默认
            const back = [58, 42, 26, 10, 250, 234, 218, 202, 59, 43, 27, 11, 251, 235, 219, 203, 60, 44, 28, 12, 252, 236, 220, 204, 61, 45, 29, 13, 253, 237, 221, 205, 62, 46, 30, 14, 254, 238, 222, 206]
            const chest = [195, 211, 227, 243, 3, 19, 35, 51, 196, 212, 228, 244, 4, 20, 36, 52, 197, 213, 229, 245, 5, 21, 37, 53, 198, 214, 230, 246, 6, 22, 38, 54, 199, 215, 231, 247, 7, 23, 39, 55, 200, 216, 232, 248, 8, 24, 40, 56]
            const shoulderL = [9, 25, 41, 57].reverse()
            const shoulderR = [249, 233, 217, 201]
            const handL = [79, 95, 111, 127, 80, 96, 112, 128].reverse()
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
        if (props.matrixName == 'hand0205') {
            // hand0205 暂不处理
        } else if (props.matrixName == 'footVideo') {
            const { left, right } = wsPointData

            if (left) {
                leftArr = [...left]
                const tw = 6, th = 10;
                reinitGL(tw, th);
                pendingFlatRef.current = { data: left, tw, th };
                scheduleRender();
            }

            if (right) {
                rightArr = [...right]
                const tw = 6, th = 10;
                // 确保第二个 canvas 已初始化
                if (!glCtxRef2.current && glCanvasRef2.current) {
                    glCtxRef2.current = initWebGL(glCanvasRef2.current, tw, th, cellSize);
                    if (overlayCanvasRef2.current) {
                        overlayCanvasRef2.current.width = tw * cellSize + 20;
                        overlayCanvasRef2.current.height = th * cellSize + 20;
                        overlayCtxRef2.current = overlayCanvasRef2.current.getContext('2d');
                    }
                }
                pendingFlatRef2.current = { data: right, tw, th };
                scheduleRender();
            }

            const newArr = [...leftArr, ...rightArr]
            layoutData([...newArr])
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

    const isRobot = props.matrixName === 'robotSY' || props.matrixName === 'robotLCF' || props.matrixName === 'robot1';
    const isFoot = props.matrixName === 'footVideo';

    // 计算主 canvas 尺寸
    let mainTw = width, mainTh = height;
    if (props.matrixName === 'hand0205') { mainTw = 15; mainTh = 11; }
    else if (isFoot) { mainTw = 6; mainTh = 10; }

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
                    alignItems: 'flex-start'
                }}
            >
                {/* 非 robot 类型：主 canvas */}
                {!isRobot && (
                    <div style={{ position: 'relative' }}>
                        <canvas
                            ref={glCanvasRef}
                            width={mainTw * cellSize}
                            height={mainTh * cellSize}
                            style={{ display: 'block' }}
                        />
                        <canvas
                            ref={overlayCanvasRef}
                            width={mainTw * cellSize + 20}
                            height={mainTh * cellSize + 20}
                            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                        />
                        {isFoot && <div style={{ textAlign: 'center', marginTop: '4px' }}>左脚</div>}
                    </div>
                )}

                {/* footVideo 右脚 */}
                {isFoot && (
                    <div style={{ position: 'relative' }}>
                        <canvas
                            ref={glCanvasRef2}
                            width={6 * cellSize}
                            height={10 * cellSize}
                            style={{ display: 'block' }}
                        />
                        <canvas
                            ref={overlayCanvasRef2}
                            width={6 * cellSize + 20}
                            height={10 * cellSize + 20}
                            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                        />
                        <div style={{ textAlign: 'center', marginTop: '4px' }}>右脚</div>
                    </div>
                )}

                {/* robot 分区 canvas */}
                {isRobot && robotParts && robotParts.map((part, idx) => (
                    <div key={part.key} style={{ marginRight: '20px' }}>
                        <div style={{ position: 'relative' }}>
                            <canvas
                                ref={el => { robotGlRefs.current[idx] = el; }}
                                width={part.w * cellSize}
                                height={part.h * cellSize}
                                style={{ display: 'block' }}
                            />
                            <canvas
                                ref={el => { robotOverlayRefs.current[idx] = el; }}
                                width={part.w * cellSize + 20}
                                height={part.h * cellSize + 20}
                                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                            />
                        </div>
                        <div style={{ textAlign: 'center', marginTop: '4px' }}>{part.text}</div>
                    </div>
                ))}
            </div>
        </div>
    );
})
