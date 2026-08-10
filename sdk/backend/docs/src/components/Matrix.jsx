/**
 * Matrix.jsx - 把一维压力数组画成热力图
 *
 * 后端包**没有渲染器**（那是 `@shroom/frontend` 的事），但线序、解码、清零这些
 * 变换的效果不看图就说不清楚。所以文档站自己画一张最小的图：一个 CSS grid，
 * 每个点一个 `div`，背景色由值映射。
 *
 * 刻意**不引前端包**。让「后端文档站」偷偷依赖前端包，两个包的边界在文档层就糊了 ——
 * 读者会以为用后端 SDK 就得配一套渲染器（不用）。也刻意不写 canvas：几百到两千个
 * div 的量级 DOM 完全扛得住，而 canvas 要多写一套绘制 + 尺寸同步的代码。
 *
 * ## 行列是猜的，这件事必须写在图上
 *
 * 线序函数返回的是**一维数组**，长度从 60 到 2048 不等，包里没有任何地方声明
 * 「这 147 个值该排成几行几列」—— 那是消费端渲染器的事（`@shroom/frontend` 的
 * `numMatrix` 靠入参拿到 `matrixWidth`）。所以这里只能按长度拆因数，拆出来的
 * 行列**只保证能看见分布，不保证是真实排布**。`<Matrix>` 会把这句话显示出来。
 */

import React from 'react';

/**
 * 按长度推断显示行列。
 *
 * 完全平方数 → n×n，这一档是可信的（32×32 的整帧、10×10 的座垫都落在这里）。
 * 否则取不超过 `sqrt(len)` 的最大因数当列数 —— 2048 拆成 64×32、60 拆成 10×6，
 * 恰好都是真实排布，但那是运气，不是保证。
 *
 * @param {number} len 数组长度。
 * @returns {{rows: number, cols: number, exact: boolean}} 行列与是否可信。
 */
export function inferGrid(len) {
  if (len <= 0) return { rows: 0, cols: 0, exact: false };

  const root = Math.sqrt(len);
  if (Number.isInteger(root)) return { rows: root, cols: root, exact: true };

  for (let cols = Math.floor(root); cols >= 1; cols -= 1) {
    if (len % cols === 0) return { rows: len / cols, cols, exact: false };
  }
  return { rows: 1, cols: len, exact: false };
}

/**
 * 值 → 颜色。
 *
 * 深蓝（低）→ 青 → 黄 → 红（高），走 hsl 的色相插值，一行搞定，不用查色表。
 * 亮度同步抬高，是为了让 0 附近真的看起来是「没有」而不是「有一点点」。
 *
 * @param {number} t 归一化后的值，0..1。
 * @returns {string} css 颜色。
 */
function heat(t) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  return `hsl(${240 - 240 * clamped}, 85%, ${10 + 46 * clamped}%)`;
}

/**
 * 一维数组的热力图。
 *
 * @param {object} props 组件属性。
 * @param {number[]} props.data 一维数值数组。
 * @param {number} [props.cols] 列数。不传就按长度推断。
 * @param {number} [props.max] 归一化上限。不传就取数组自身最大值 ——
 *   两块图要对比时**必须显式传同一个 max**，否则各归各的，看起来一样亮。
 * @param {string} [props.caption] 图下方的说明。
 * @returns {JSX.Element} 热力图。
 */
export default function Matrix({ data, cols, max, caption }) {
  const values = Array.isArray(data) ? data : [];
  const grid = React.useMemo(
    () => (cols ? { rows: Math.ceil(values.length / cols), cols, exact: true } : inferGrid(values.length)),
    [values.length, cols],
  );

  const scale = React.useMemo(() => {
    if (Number.isFinite(max) && max > 0) return max;
    const peak = values.reduce((acc, value) => (Number(value) > acc ? Number(value) : acc), 0);
    return peak > 0 ? peak : 1;
  }, [values, max]);

  if (!values.length) {
    return <p className="docs-status">（空数组，没有可画的点）</p>;
  }

  return (
    <div>
      <div
        className="docs-matrix"
        style={{
          gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
          aspectRatio: `${grid.cols} / ${grid.rows}`,
        }}
      >
        {values.map((value, index) => (
          <div
            // eslint-disable-next-line react/no-array-index-key -- 就是按下标画的网格
            key={index}
            className="docs-matrix-cell"
            style={{ background: heat(Number(value) / scale) }}
          />
        ))}
      </div>
      <p className="docs-matrix-cap">
        {caption && <span>{caption} · </span>}
        {values.length} 点 · 按 {grid.rows}×{grid.cols} 画
        {!grid.exact && <span>（行列是按因数拆的，只为看见分布，不是真实排布）</span>}
      </p>
    </div>
  );
}
