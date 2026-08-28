import React from 'react';
import { PART_DRAG_TYPE } from './canvasParts';
import { buildSparklinePath } from '../../../components/aside/chartAppearance';

/**
 * 方块中间那块预览：色卡是一条渐变、图表卡片是一小段曲线、其余是一个字形。
 *
 * 图表卡片零件必须一眼看出"拖出来是一张什么形状的曲线"，一个字形做不到；
 * 曲线数据就是模板自带的 `preview`，和公式编辑器里的模板卡片同源。
 *
 * @param {{previewCss?: string, previewPoints?: number[], icon?: string}} part 零件定义。
 * @returns {React.ReactNode} 预览内容。
 */
function renderVisual(part) {
  if (part.previewCss) return '';
  if (part.previewPoints?.length) {
    return (
      <svg preserveAspectRatio="none" viewBox="0 0 76 28">
        <path
          d={buildSparklinePath(part.previewPoints, 76, 28)}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }
  return part.icon || '＋';
}

/**
 * 零件栏里的一个方块。既可以拖到画布上，也可以直接点击（无鼠标或触屏兜底）。
 *
 * @param {object} props 方块参数。
 * @param {{kind: string, id: string, label: string}} props.part 零件定义。
 * @param {boolean} props.active 是否已经在画布上生效。
 * @param {boolean} props.disabled 只读模式下禁止拖放和点击。
 * @param {(part: object) => void} props.onActivate 点击时的处理函数。
 */
export default function PartTile({ part, active = false, disabled = false, onActivate }) {
  const handleDragStart = (event) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    const payload = JSON.stringify({ kind: part.kind, id: part.id, type: part.type });
    event.dataTransfer.setData(PART_DRAG_TYPE, payload);
    // 部分环境读不到自定义 MIME，附一份 text/plain 兜底。
    event.dataTransfer.setData('text/plain', payload);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const className = [
    'canvas-part-tile',
    `is-${part.kind}`,
    active ? 'is-active' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={className}
      draggable={!disabled}
      disabled={disabled}
      aria-pressed={part.kind === 'widget' ? undefined : active}
      title={part.description || part.label}
      onDragStart={handleDragStart}
      onClick={() => onActivate?.(part)}
    >
      <span className="canvas-part-visual" aria-hidden="true" style={part.previewCss ? { background: part.previewCss } : undefined}>
        {renderVisual(part)}
      </span>
      <span className="canvas-part-label">{part.label}</span>
    </button>
  );
}
