/**
 * syntheticFrame.js - 合成帧
 *
 * 一个绕圈游动的高斯斑。文档站没有硬件、也不假设读者起了后端，所以每块活预览
 * 的数据都是这里造的。
 *
 * ## 这是全仓第三份同样的东西，而且**是有意的**
 *
 * | 在哪 | 给谁看 |
 * | :--- | :--- |
 * | `scripts/smoke-core.mjs` | 裸 Node：证明零依赖层不用打包器也跑得通 |
 * | `example/src/main.jsx` | 浏览器：证明 30 行能把画面点亮 |
 * | 这里 | 文档站：十几块预览共用一个数据源 |
 *
 * 三处**都必须自包含**：smoke 不能 import docs，example 是要发给二开者照抄的
 * 最小样例（多一个 import 就多一个「这文件哪来的」）。抽成 `core/` 的公开导出
 * 反而更糟 —— 那等于承诺「本 SDK 提供测试数据生成器」，是新的公开面。
 * 所以这份重复是记账清楚的重复，不是遗漏。
 *
 * ## 与另外两份的一处差异
 *
 * 多一个 `amplitude` 参数。点阵渲染器的默认阈值（`DUAL_CHANNEL_DEFAULTS`）与
 * 数字矩阵不同，同一个 220 的峰值在点阵那边会被压得几乎看不出起伏。
 * 各页按需给不同幅度，不去动包里的阈值默认值。
 */

import React from 'react';

/**
 * 生成一帧。
 *
 * @param {number} t 时间（秒），决定斑点在圆周上的位置。
 * @param {number} width 矩阵列数。
 * @param {number} height 矩阵行数。
 * @param {number} [amplitude] 峰值压力，默认 220。
 * @returns {number[]} 行优先展开的压力数组，长度 `width * height`。
 */
export function syntheticFrame(t, width, height, amplitude = 220) {
  const out = new Array(width * height);
  const radius = Math.min(width, height) / 4;
  const cx = (width - 1) / 2 + Math.cos(t) * radius;
  const cy = (height - 1) / 2 + Math.sin(t) * radius;
  const spread = Math.max(width, height) / 1.6;
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const d2 = (col - cx) ** 2 + (row - cy) ** 2;
      out[row * width + col] = Math.round(amplitude * Math.exp(-d2 / spread));
    }
  }
  return out;
}

/** 合成帧的帧率。30fps 够看出流畅度，又不至于把主线程占满。 */
export const FRAME_INTERVAL_MS = 1000 / 30;

/**
 * 合成帧数据源 hook。
 *
 * 每帧**换一个新数组**，不原地改 —— `RendererHost` 的 `values` effect 依赖数组
 * 身份，原地改不会触发推送。这是个容易踩的坑，Pitfalls 页里有。
 *
 * `enabled` 传 false 时停表并保留最后一帧（不清空）：文档站的预览被限流卸载
 * 之后，重新挂上时应当立刻有画面，而不是等下一个 tick。
 *
 * @param {number} width 矩阵列数。
 * @param {number} height 矩阵行数。
 * @param {object} [options] 选项。
 * @param {number} [options.amplitude] 峰值压力。
 * @param {boolean} [options.enabled] 是否走表，默认 true。
 * @returns {number[] | null} 当前帧。
 */
export function useSyntheticFrames(width, height, options = {}) {
  const { amplitude = 220, enabled = true } = options;
  const [frame, setFrame] = React.useState(null);

  React.useEffect(() => {
    if (!enabled) return undefined;
    const startedAt = Date.now();
    setFrame(syntheticFrame(0, width, height, amplitude));
    const timer = setInterval(() => {
      setFrame(syntheticFrame((Date.now() - startedAt) / 1000, width, height, amplitude));
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [width, height, amplitude, enabled]);

  return frame;
}
