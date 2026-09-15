import React, { useEffect, useRef, useState } from 'react';

/** 返回屏幕 CSS 像素距离，不把投影距离标为传感器毫米。 */
export function screenRulerDistance(start, end) {
  return start && end ? Math.hypot(end.x - start.x, end.y - start.y) : 0;
}

/** 在画面上点击两点或拖出一条线；方向键移动准星，Enter 落点，Escape 退出。 */
export default function PortalScreenRuler({ active, onClose }) {
  const rootRef = useRef(null);
  const gesture = useRef(null);
  const [points, setPoints] = useState({ start: null, end: null, cursor: { x: 400, y: 300 } });
  useEffect(() => {
    if (!active) return undefined;
    const root = rootRef.current;
    /** 视口改变后旧的屏幕测量失效，重新选择测量点。 */
    const reset = () => {
      const rect = root.getBoundingClientRect();
      gesture.current = null;
      setPoints({ start: null, end: null, cursor: { x: rect.width / 2, y: rect.height / 2 } });
    };
    reset(); root.focus({ preventScroll: true });
    const observer = new ResizeObserver(reset);
    observer.observe(root);
    return () => { observer.disconnect(); gesture.current = null; };
  }, [active]);
  if (!active) return null;

  /** 将指针限制在覆盖层内，计算使用 CSS 像素而不是 Canvas DPR 背板。 */
  const location = (event) => {
    const rect = rootRef.current.getBoundingClientRect();
    return { x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)) };
  };
  /** 键盘与单点点击共用落点语义。 */
  const place = (point) => setPoints((current) => !current.start || current.end
    ? { start: point, end: null, cursor: point } : { ...current, end: point, cursor: point });
  /** 方向键移动准星，Shift 加速；不需要拖拽也能完成测量。 */
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); place(points.cursor); return; }
    const vector = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!vector) return;
    event.preventDefault(); event.stopPropagation();
    const rect = rootRef.current.getBoundingClientRect(), step = event.shiftKey ? 10 : 1;
    setPoints((current) => ({ ...current, cursor: {
      x: Math.max(0, Math.min(rect.width, current.cursor.x + vector[0] * step)),
      y: Math.max(0, Math.min(rect.height, current.cursor.y + vector[1] * step)),
    } }));
  };
  const end = points.end || points.cursor;
  return <div className="portal-screen-ruler">
    <svg ref={rootRef} className="portal-ruler-surface" tabIndex={0} role="group" aria-label="屏幕量尺画布"
      aria-describedby="portal-ruler-instructions" onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
        const point = location(event);
        gesture.current = { point, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
        place(point);
      }}
      onPointerMove={(event) => {
        const point = location(event), drag = gesture.current;
        if (drag && screenRulerDistance(drag.point, point) > 3) drag.moved = true;
        setPoints((current) => drag?.moved ? { start: drag.point, end: point, cursor: point } : { ...current, cursor: point });
      }}
      onPointerUp={(event) => {
        gesture.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }} onPointerCancel={() => { gesture.current = null; }}>
      {points.start && <g className="portal-ruler-line">
        <line x1={points.start.x} y1={points.start.y} x2={end.x} y2={end.y} />
        <circle cx={points.start.x} cy={points.start.y} r="5" /><circle cx={end.x} cy={end.y} r="5" />
      </g>}
      <path className="portal-ruler-crosshair" d={`M${points.cursor.x - 7},${points.cursor.y}h14 M${points.cursor.x},${points.cursor.y - 7}v14`} />
    </svg>
    <div className="portal-ruler-readout">
      <strong>屏幕量尺 · {screenRulerDistance(points.start, end).toFixed(1)} px</strong>
      <span id="portal-ruler-instructions">点击两点或拖拽；方向键移动，Enter 落点。仅屏幕距离，非实际尺寸。</span>
      <button type="button" onClick={onClose}>退出量尺</button>
    </div>
  </div>;
}
