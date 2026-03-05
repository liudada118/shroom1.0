import { useRef, useEffect, useCallback } from 'react';

/**
 * WebGL 高速热力图渲染组件
 * 将 NxM 的压力数据通过 GPU 纹理 + Fragment Shader 颜色映射实现高速渲染
 * 完全绕过 React DOM，200Hz 数据无压力
 */

// ========== Vertex Shader ==========
const VERTEX_SHADER_SRC = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

// ========== Fragment Shader (jet1 颜色映射) ==========
const FRAGMENT_SHADER_SRC = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_data;
  uniform float u_min;
  uniform float u_max;
  uniform float u_showNumbers; // 0.0 = heatmap only

  // jet1 颜色映射 - 与 Num2D.jsx 中的 jet1 函数一致
  vec3 jet1(float minVal, float maxVal, float x) {
    float r = 1.0, g = 1.0, b = 1.0;
    if (x < minVal) x = minVal;
    if (x > maxVal) x = maxVal;
    float dv = maxVal - minVal;
    if (dv == 0.0) return vec3(1.0, 1.0, 1.0);

    if (x < minVal + 0.2 * dv) {
      // 白色区域（低值）
      r = 1.0; g = 1.0; b = 1.0;
    } else if (x < minVal + 0.4 * dv) {
      r = 0.0;
      g = (5.0 * (x - minVal - 0.2 * dv)) / dv;
      b = 1.0;
    } else if (x < minVal + 0.6 * dv) {
      r = 0.0;
      g = 1.0;
      b = 1.0 + (4.0 * (minVal + 0.4 * dv - x)) / dv;
    } else if (x < minVal + 0.8 * dv) {
      r = (4.0 * (x - minVal - 0.6 * dv)) / dv;
      g = 1.0;
      b = 0.0;
    } else {
      r = 1.0;
      g = 1.0 + (4.0 * (minVal + 0.8 * dv - x)) / dv;
      b = 0.0;
    }
    return vec3(r, g, b);
  }

  void main() {
    // 从纹理中读取压力值（存储在 R 通道，归一化到 0-1）
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
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

/**
 * WebGLHeatmap 组件
 *
 * @param {Object} props
 * @param {number} props.width - 数据矩阵宽度（列数），默认 32
 * @param {number} props.height - 数据矩阵高度（行数），默认 32
 * @param {number} props.cellSize - 每个单元格的像素大小，默认 20
 * @param {number} props.colorMin - 颜色映射最小值，默认 0
 * @param {number} props.colorMax - 颜色映射最大值，默认 40
 * @param {boolean} props.showNumbers - 是否显示数字，默认 true
 * @param {boolean} props.showBorder - 是否显示网格边框，默认 true
 * @param {string} props.label - 标签文字（如"左脚"）
 */
const WebGLHeatmap = ({ width = 32, height = 32, cellSize = 20, colorMin = 0, colorMax = 40, showNumbers = true, showBorder = true, label = '' }) => {
  const canvasRef = useRef(null);       // WebGL canvas
  const overlayRef = useRef(null);      // Canvas 2D overlay（数字+网格）
  const glRef = useRef(null);           // WebGL context
  const programRef = useRef(null);      // WebGL program
  const textureRef = useRef(null);      // 数据纹理
  const texDataRef = useRef(null);      // Uint8Array 纹理数据缓冲
  const uniformsRef = useRef({});       // uniform locations
  const rafIdRef = useRef(null);        // RAF id
  const pendingDataRef = useRef(null);  // 待渲染的一维数据
  const lastDataRef = useRef(null);     // 最后一帧的原始数据（用于绘制数字）
  const initedRef = useRef(false);

  const canvasWidth = width * cellSize;
  const canvasHeight = height * cellSize;

  // 初始化 WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl;

    // 创建 shader program
    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    const program = createProgram(gl, vs, fs);
    programRef.current = program;
    gl.useProgram(program);

    // 全屏四边形顶点（两个三角形）
    const positions = new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1,
    ]);
    // 纹理坐标（翻转 Y 轴使数据从上到下显示）
    const texCoords = new Float32Array([
      0, 1,  1, 1,  0, 0,
      0, 0,  1, 1,  1, 0,
    ]);

    // 位置 buffer
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const aPosition = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    // 纹理坐标 buffer
    const texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    const aTexCoord = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(aTexCoord);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);

    // 创建数据纹理
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // NEAREST 采样保持像素清晰（不模糊）
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 初始化空纹理（LUMINANCE 单通道，每像素 1 字节）
    const texData = new Uint8Array(width * height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, texData);
    textureRef.current = texture;
    texDataRef.current = texData;

    // 获取 uniform locations
    uniformsRef.current = {
      uMin: gl.getUniformLocation(program, 'u_min'),
      uMax: gl.getUniformLocation(program, 'u_max'),
      uData: gl.getUniformLocation(program, 'u_data'),
    };

    gl.uniform1f(uniformsRef.current.uMin, colorMin);
    gl.uniform1f(uniformsRef.current.uMax, colorMax);
    gl.uniform1i(uniformsRef.current.uData, 0);

    gl.viewport(0, 0, canvasWidth, canvasHeight);

    // 初始化 overlay canvas
    if (overlayRef.current) {
      overlayRef.current.width = canvasWidth;
      overlayRef.current.height = canvasHeight;
    }

    initedRef.current = true;

    return () => {
      initedRef.current = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      // cleanup WebGL resources
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(posBuffer);
      gl.deleteBuffer(texBuffer);
    };
  }, [width, height, cellSize]);

  // 更新颜色范围
  useEffect(() => {
    if (!glRef.current || !programRef.current) return;
    const gl = glRef.current;
    gl.useProgram(programRef.current);
    gl.uniform1f(uniformsRef.current.uMin, colorMin);
    gl.uniform1f(uniformsRef.current.uMax, colorMax);
  }, [colorMin, colorMax]);

  // 渲染一帧
  const renderFrame = useCallback(() => {
    rafIdRef.current = null;
    if (!initedRef.current) return;

    const flatData = pendingDataRef.current;
    if (!flatData) return;
    pendingDataRef.current = null;

    const gl = glRef.current;
    const texData = texDataRef.current;

    // 将压力数据写入纹理缓冲（clamp 到 0-255）
    const len = Math.min(flatData.length, width * height);
    for (let i = 0; i < len; i++) {
      texData[i] = Math.min(255, Math.max(0, flatData[i]));
    }

    // 上传纹理数据到 GPU（texSubImage2D 比 texImage2D 更快）
    gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.LUMINANCE, gl.UNSIGNED_BYTE, texData);

    // 绘制
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 绘制数字和网格到 overlay canvas
    if (showNumbers || showBorder) {
      drawOverlay(flatData);
    }

    lastDataRef.current = flatData;
  }, [width, height, showNumbers, showBorder, cellSize]);

  // 绘制 overlay（数字 + 网格线）
  const drawOverlay = useCallback((flatData) => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (showBorder) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= height; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvasWidth, i * cellSize);
        ctx.stroke();
      }
      for (let j = 0; j <= width; j++) {
        ctx.beginPath();
        ctx.moveTo(j * cellSize, 0);
        ctx.lineTo(j * cellSize, canvasHeight);
        ctx.stroke();
      }
    }

    if (showNumbers) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${Math.max(8, cellSize * 0.5)}px monospace`;

      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          const val = flatData[i * width + j];
          if (val > 0) {
            // 根据背景亮度选择文字颜色
            ctx.fillStyle = val > (colorMax * 0.6) ? '#fff' : '#000';
            ctx.fillText(
              Math.round(val).toString(),
              j * cellSize + cellSize / 2,
              i * cellSize + cellSize / 2
            );
          }
        }
      }
    }
  }, [width, height, cellSize, canvasWidth, canvasHeight, showNumbers, showBorder, colorMin, colorMax]);

  // 调度渲染（RAF 节流）
  const scheduleRender = useCallback(() => {
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(renderFrame);
  }, [renderFrame]);

  // 暴露给父组件的更新方法
  const updateData = useCallback((flatArray) => {
    pendingDataRef.current = flatArray;
    scheduleRender();
  }, [scheduleRender]);

  return {
    canvasRef,
    overlayRef,
    updateData,
    canvasWidth,
    canvasHeight,
    element: (
      <div style={{ position: 'relative', width: canvasWidth, height: canvasHeight }}>
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: canvasWidth, height: canvasHeight }}
        />
        {(showNumbers || showBorder) && (
          <canvas
            ref={overlayRef}
            style={{ position: 'absolute', top: 0, left: 0, width: canvasWidth, height: canvasHeight, pointerEvents: 'none' }}
          />
        )}
        {label && (
          <div style={{ position: 'absolute', bottom: -24, left: 0, width: '100%', textAlign: 'center', color: '#000', fontSize: '14px' }}>
            {label}
          </div>
        )}
      </div>
    ),
  };
};

export default WebGLHeatmap;
