/**
 * main.jsx - `@shroom/frontend` 最小可跑 demo
 *
 * 这份文件回答的问题是：**新项目怎么在几十行里把压力矩阵画出来。**
 *
 * ## 三行就是全部
 *
 * ```jsx
 * registerBuiltinRenderers();                              // 1. 注册本包 ships 的渲染器
 * import '@shroom/frontend/styles/canvas.css';             // 2. 6 行样式（.canvasNum）
 * <RendererHost rendererId="numMatrix" params={...} values={frame} channel="sit" />
 * ```
 *
 * `values` 是 `RendererHost` 的**声明式**入口 —— 给了它就不订阅帧总线（见
 * `react/RendererHost.jsx` 的 `values` prop 注释）。宿主内部把数组转成
 * `api.sitData({ wsPointData })` 推给渲染器，所以喂数据不需要碰 ref、
 * 不需要认识渲染器的命令式接口。
 *
 * ## 数据从哪来
 *
 * 默认是**合成帧**：一个绕圈游动的高斯斑，30fps。没有硬件、没有后端也能看到
 * 画面 —— 这是 demo 必须先成立的性质。
 *
 * 打开「连真后端」开关会用本包的 `SensorClient` 接 `ws://127.0.0.1:19999`（主
 * 应用后端的默认帧端口）。接不上就退回合成帧，不弹错、不白屏 —— 二开者第一次
 * 跑 demo 时大概率没起后端。
 *
 * ## 三个控件挑的是哪三个
 *
 * 参数面有二十多个字段（见 `core/numMatrix/params.js`），这里只暴露三个，选的
 * 标准是「改了立刻看得见、且各自打通一条不同的通路」：
 *
 * | 控件 | 通的是哪条路 |
 * | :--- | :--- |
 * | 配色下拉 | `colormap` prop —— 走 props 而不是 params，用户随时可改 |
 * | `size` | params 变更 → 场景**重建**（`paramsKey` 变了） |
 * | `decimalScale` | 数字纹理烘焙（1 显示整数、10 显示一位小数） |
 *
 * 想看全部参数就直接改 `params` 那个字面量 —— 归一化会把越界值夹回范围，乱填
 * 不会崩（`normalizeNumMatrixParams` 的性质，烟测里锁着）。
 */

import {
  COLORMAPS,
  NUM_MATRIX_PRESETS,
  SensorClient,
  normalizeNumMatrixParams,
  numMatrix,
} from '@shroom/frontend';
import { RendererHost, registerBuiltinRenderers } from '@shroom/frontend/react';
import '@shroom/frontend/styles/canvas.css';
import React from 'react';
import { createRoot } from 'react-dom/client';

// 注册本包 ships 的渲染器（当前只有 numMatrix）。必须在渲染之前跑一次 ——
// `RendererHost` 是按 id 去注册表里查描述符的，查不到会渲染「未注册」提示。
registerBuiltinRenderers();

/** 后端帧端口。主应用后端的默认值，见 `src/client/SensorClient.js`。 */
const WS_URL = 'ws://127.0.0.1:19999';

/** 合成帧的帧率。30fps 足够看出流畅度，又不会把主线程占满。 */
const FRAME_INTERVAL_MS = 1000 / 30;

/**
 * 一个绕圈游动的高斯斑。
 *
 * 与 `scripts/smoke-core.mjs` 里的 `syntheticFrame` 是同一套合成数据 —— 一处给
 * 裸 Node 证明零依赖层跑得通，一处给浏览器证明画得出来。
 *
 * @param {number} t 时间参数（秒），决定斑点在圆周上的位置。
 * @param {number} width 矩阵列数。
 * @param {number} height 矩阵行数。
 * @returns {number[]} 行优先展开的压力数组，长度 `width * height`。
 */
function syntheticFrame(t, width, height) {
  const out = new Array(width * height);
  const radius = Math.min(width, height) / 4;
  const cx = (width - 1) / 2 + Math.cos(t) * radius;
  const cy = (height - 1) / 2 + Math.sin(t) * radius;
  const spread = Math.max(width, height) / 1.6;
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const d2 = (col - cx) ** 2 + (row - cy) ** 2;
      out[row * width + col] = Math.round(220 * Math.exp(-d2 / spread));
    }
  }
  return out;
}

/**
 * 合成帧数据源。
 *
 * 每 33ms 换一个新数组 —— `RendererHost` 的 `values` effect 依赖数组身份，
 * 原地改数组不会触发推送。
 *
 * @param {number} width 矩阵列数。
 * @param {number} height 矩阵行数。
 * @param {boolean} enabled 关掉时停表，不留后台定时器。
 * @returns {number[] | null} 当前帧。
 */
function useSyntheticFrames(width, height, enabled) {
  const [frame, setFrame] = React.useState(null);

  React.useEffect(() => {
    if (!enabled) return undefined;
    const startedAt = Date.now();
    setFrame(syntheticFrame(0, width, height));
    const timer = setInterval(() => {
      setFrame(syntheticFrame((Date.now() - startedAt) / 1000, width, height));
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [width, height, enabled]);

  return frame;
}

/**
 * 真后端数据源。
 *
 * 这是本包 `SensorClient` 的最小用法：`connect()` → `on('frame')` → 拿
 * `frame.data`。归一化在 `src/store/normalizeFrame.js` 里做完了，所以不管后端
 * 发的是新协议还是 legacy 字段名，到这里都是 `{ sensorType, channel, data, ... }`。
 *
 * 后端没起的时候浏览器控制台会留一条 `ERR_CONNECTION_REFUSED` —— 那是浏览器
 * 自己打的，JS 层拦不掉（`onerror` 事件不带原因，也不能阻止这条日志）。状态栏会
 * 显示「连不上（退回合成帧）」，画面继续跑合成帧，**不是 bug**。
 *
 * @param {boolean} enabled 开关；关掉时断连。
 * @returns {{frame: number[] | null, status: string}} 当前帧与连接状态。
 */
function useBackendFrames(enabled) {
  const [frame, setFrame] = React.useState(null);
  const [status, setStatus] = React.useState('idle');

  React.useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setFrame(null);
      return undefined;
    }

    const client = new SensorClient({ url: WS_URL });
    const offs = [
      client.on('open', () => setStatus('connected')),
      // 断开 / 出错时必须清掉最后一帧，否则画面冻在那一帧上，而状态文案写着
      // 「退回合成帧」—— 那就成了骗人的提示。清空之后合成帧会自动接上。
      client.on('close', () => { setStatus('closed'); setFrame(null); }),
      client.on('error', () => { setStatus('error'); setFrame(null); }),
      client.on('frame', (incoming) => {
        if (incoming.channel === 'sit' && incoming.data?.length) setFrame(incoming.data);
      }),
    ];

    setStatus('connecting');
    try {
      client.connect();
    } catch {
      // 连不上不是错误路径 —— demo 的常态就是没起后端。上层会退回合成帧。
      setStatus('error');
    }

    return () => {
      offs.forEach((off) => off());
      client.disconnect();
    };
  }, [enabled]);

  return { frame, status };
}

const BACKEND_STATUS_TEXT = {
  idle: '未连接',
  connecting: '连接中…',
  connected: '已连接',
  closed: '已断开（退回合成帧）',
  error: '连不上（退回合成帧）',
};

const PANEL_STYLE = {
  position: 'fixed',
  top: 16,
  left: 16,
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 14px',
  borderRadius: 8,
  background: 'rgba(20, 20, 24, 0.82)',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  backdropFilter: 'blur(6px)',
};

const ROW_STYLE = { display: 'flex', alignItems: 'center', gap: 8 };
const LABEL_STYLE = { minWidth: 74, opacity: 0.72 };
const HINT_STYLE = { marginTop: 2, fontSize: 12, opacity: 0.5, maxWidth: 260 };

function App() {
  const [colormapId, setColormapId] = React.useState(COLORMAPS[0].id);
  const [size, setSize] = React.useState(2);
  const [decimalScale, setDecimalScale] = React.useState(1);
  const [useBackend, setUseBackend] = React.useState(false);

  // 归一化一次，网格尺寸从它推出来 —— 合成帧的行列数与渲染器认的必须是同一份，
  // 不能各自写死。乱填的 size 也在这一步被夹回合法范围。
  const params = React.useMemo(
    () => normalizeNumMatrixParams({ ...NUM_MATRIX_PRESETS.fast1024, size, decimalScale }),
    [size, decimalScale],
  );
  const grid = React.useMemo(() => numMatrix.deriveGrid(params), [params]);

  const backend = useBackendFrames(useBackend);
  const synthetic = useSyntheticFrames(grid.gridWidth, grid.gridHeight, !backend.frame);
  const frame = backend.frame || synthetic;

  const colormap = React.useMemo(() => ({ id: colormapId }), [colormapId]);

  return (
    <>
      <div style={PANEL_STYLE}>
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>配色</span>
          <select value={colormapId} onChange={(e) => setColormapId(e.target.value)}>
            {COLORMAPS.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.label}</option>
            ))}
          </select>
        </div>

        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>格子大小</span>
          <input
            type="number"
            min="1"
            max="8"
            step="1"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            style={{ width: 56 }}
          />
          <span style={{ opacity: 0.5 }}>{grid.gridWidth}×{grid.gridHeight}</span>
        </div>

        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>小数位</span>
          <label style={{ ...ROW_STYLE, gap: 4 }}>
            <input
              type="checkbox"
              checked={decimalScale === 10}
              onChange={(e) => setDecimalScale(e.target.checked ? 10 : 1)}
            />
            {/* 叫「一位小数」而不是「除 10」：`decimalScale=10` 的语义是「后端送
                来的整数是真值的 10 倍」，本 demo 的合成数据没有放大，所以看得见的
                变化只是多一位小数。真机上 `smallBed12B` 才是「除 10」那个用法。 */}
            <span>显示一位小数（decimalScale=10）</span>
          </label>
        </div>

        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>数据源</span>
          <label style={{ ...ROW_STYLE, gap: 4 }}>
            <input
              type="checkbox"
              checked={useBackend}
              onChange={(e) => setUseBackend(e.target.checked)}
            />
            <span>连真后端</span>
          </label>
          <span style={{ opacity: 0.5 }}>
            {useBackend ? BACKEND_STATUS_TEXT[backend.status] : '合成帧 30fps'}
          </span>
        </div>

        <div style={HINT_STYLE}>
          连真后端会接 {WS_URL}；没起后端就一直是合成的游动高斯斑。
        </div>
      </div>

      <RendererHost
        rendererId="numMatrix"
        label="数字矩阵"
        params={params}
        values={frame}
        channel="sit"
        colormap={colormap}
      />
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
