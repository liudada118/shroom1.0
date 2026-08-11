/** 矩阵渲染最短入口：同一份形状和数据切换四种内置渲染器。 */

import { BUILTIN_MATRIX_RENDERER_OPTIONS } from '@shroom/frontend/core';
import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import DemoCard from '../components/DemoCard.jsx';
import { Prose, Section } from '../components/Prose.jsx';
import MatrixQuickDemo from '../demos/MatrixQuickDemo.jsx';
import quickSource from '../demos/MatrixQuickDemo.jsx?raw';

export default function MatrixQuickStart() {
  const [rendererId, setRendererId] = React.useState('numMatrix');
  const renderer = BUILTIN_MATRIX_RENDERER_OPTIONS.find((item) => item.id === rendererId);

  const controls = (
    <div className="matrix-quick-controls">
      <div className="matrix-quick-input">
        <span>形状</span>
        <strong>8 × 8 坐标矩阵</strong>
      </div>
      <div className="matrix-quick-input">
        <span>数据</span>
        <strong>[1, 2, 3, ..., 64]</strong>
      </div>
      <div className="matrix-renderer-switch" aria-label="选择渲染方式">
        {BUILTIN_MATRIX_RENDERER_OPTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === rendererId ? 'is-active' : undefined}
            onClick={() => setRendererId(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Prose
      title="矩阵快速使用"
      lede="只设置形状和一帧数据。四种渲染方式使用完全相同的 8 × 8 坐标矩阵与 1..64 方向校验帧。"
    >
      <DemoCard
        title={renderer.label}
        sub="点击渲染方式立即切换，不改变形状和数据"
        controls={controls}
        height={420}
      >
        <MatrixQuickDemo rendererId={rendererId} />
      </DemoCard>

      <div className="matrix-quick-steps" aria-label="矩阵渲染三步">
        <div><strong>1</strong><span>设置 rows、cols 和坐标 JSON</span></div>
        <div><strong>2</strong><span>传入长度等于 rows × cols 的 values</span></div>
        <div><strong>3</strong><span>选择 rendererId 后交给 RendererHost</span></div>
      </div>

      <Section title="复制即可运行">
        <CodeBlock
          code={quickSource}
          path="MatrixQuickDemo.jsx"
          note="替换 coordinateMap 和 values 即可接入自己的传感器"
        />
      </Section>
    </Prose>
  );
}
