/**
 * 所有通用矩阵渲染器共用的最小样例。
 *
 * 只维护三样输入：矩阵行列、点位坐标、一帧数据。切换渲染器时，SDK helper 会把
 * 同一份输入转换为目标渲染器参数，不需要分别理解四套历史预设。
 */

import {
  createBuiltinMatrixRendererParams,
  createDirectionCheckFrame,
} from '@shroom/frontend/core';
import { RendererHost, registerBuiltinRenderers } from '@shroom/frontend/react';
import '@shroom/frontend/styles/canvas.css';
import React from 'react';

registerBuiltinRenderers();

const ROWS = 8;
const COLS = 8;

/** 真实项目把这里替换成坐标 JSON；数组顺序就是一帧数据的点位顺序。 */
const coordinateMap = Array.from({ length: ROWS }, (_, row) => (
  Array.from({ length: COLS }, (unused, col) => [col, ROWS - row - 1])
));

/** 默认 1..N 数据可以直观看出首点、末点、行列和旋转方向。 */
const values = createDirectionCheckFrame(ROWS * COLS);

/**
 * @param {object} props 组件属性。
 * @param {'numMatrix'|'pointGrid'|'webglHeatmap'|'blobHeatmap'} props.rendererId 渲染器。
 * @returns {JSX.Element} 使用统一矩阵输入的预览。
 */
export default function MatrixQuickDemo({ rendererId = 'numMatrix' }) {
  const params = React.useMemo(() => createBuiltinMatrixRendererParams(rendererId, {
    matrix: { rows: ROWS, cols: COLS },
    coordinateMap,
    valueMax: values.at(-1),
  }), [rendererId]);

  const handleRenderer = React.useCallback((api) => {
    if (!api) return;
    requestAnimationFrame(() => {
      if (rendererId === 'numMatrix') api.sitValue?.({ valuef: 0 });
      if (rendererId === 'pointGrid') api.sitValue?.({ valuej: values.at(-1) });
      api.sitData?.({ wsPointData: values });
    });
  }, [rendererId]);

  return (
    <RendererHost
      key={rendererId}
      rendererId={rendererId}
      label="矩阵快速样例"
      params={params}
      values={values}
      channel="sit"
      rendererRef={handleRenderer}
    />
  );
}
