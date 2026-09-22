import React, { useEffect, useReducer, useRef, useState } from 'react';
import { clampRulerPoint, createRulerState, MAX_SCREEN_RULERS, screenRulerDistance, screenRulerReducer } from './portalRulerState';
import { nearestSensorPoint, normalizeSensorPitch, readSensorPitch, saveSensorPitch, sensorRulerDistance, sensorRulerSpan } from './sensorRuler';

export { screenRulerDistance } from './portalRulerState';

/** 端点固定到真实矩阵点，保留两点点击、拖拽、多线和键盘编辑。 */
export default function PortalScreenRuler({ active, onClose, api, systemKey }) {
  const rootRef = useRef(null);
  const gesture = useRef(null);
  const [state, dispatch] = useReducer(screenRulerReducer, undefined, createRulerState);
  const { columns = 0, rows = 0 } = api?.getSnapshot() || {};
  const storageKey = `shroom.sensorPitch.v1:${systemKey}:${columns}x${rows}`;
  const [pitch, setPitch] = useState(() => readSensorPitch(storageKey));
  const [draft, setDraft] = useState(() => readSensorPitch(storageKey) || { x: '', y: '' });
  const [notice, setNotice] = useState('');
  const [projected, setProjected] = useState([]);
  const bounds = { width: columns - 1, height: rows - 1 };
  useEffect(() => {
    const saved = readSensorPitch(storageKey);
    setPitch(saved); setDraft(saved || { x: '', y: '' }); setNotice('');
  }, [storageKey]);
  useEffect(() => {
    if (!active || !api) return undefined;
    const root = rootRef.current;
    dispatch({ type: 'reset', width: columns - 1, height: rows - 1 });
    dispatch({ type: 'cursor', point: { x: Math.floor((columns - 1) / 2), y: Math.floor((rows - 1) / 2) } });
    api.setMeasurementActive(true);
    /** 只刷新点位投影；窗口大小和压力高度变化不会改变物理端点。 */
    const refresh = () => setProjected(api.getSensorPoints());
    refresh(); root.focus({ preventScroll: true });
    const timer = setInterval(refresh, 100);
    return () => { clearInterval(timer); api.setMeasurementActive(false); gesture.current = null; };
  }, [active, api, columns, rows]);
  if (!active || !api) return null;

  /** 鼠标落到真实传感点，状态仅存整数行列。 */
  const location = (event) => nearestSensorPoint(api.getSensorPoints(), { x: event.clientX, y: event.clientY }, columns);
  /** 将保存的传感点重新投影到覆盖层，测量不依赖投影距离。 */
  const screen = (point) => {
    if (!point) return null;
    const hit = projected.find((entry) => entry.index === point.y * columns + point.x && entry.visible);
    const rect = rootRef.current?.getBoundingClientRect();
    return hit && rect ? { x: hit.x - rect.left, y: hit.y - rect.top } : null;
  };
  /** 显示经过配置的毫米距离，缺少点距时不显示伪造读数。 */
  const distanceLabel = (start, end) => {
    if (pitch && (!start || !end)) return '请选择两个传感点';
    const distance = sensorRulerDistance(start, end, pitch);
    const span = sensorRulerSpan(start, end);
    return distance === null ? (span ? `横 ${span.columns} 格 · 纵 ${span.rows} 格` : '请设置点距') : `${distance.toFixed(2)} mm`;
  };
  /** 根据可交互线段或端点取得编辑对象，空白区域继续原来的两点测量。 */
  const pointerDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.target.closest('[data-ruler-id]');
    const line = state.lines.find((entry) => entry.id === Number(target?.dataset.rulerId));
    const point = location(event);
    if (!point) { setNotice('请在传感点上落点。'); return; }
    setNotice('');
    if (line && !state.start) {
      const part = target.dataset.rulerPart || 'line';
      const focus = part === 'line' ? rootRef.current.querySelector(`[data-ruler-group="${line.id}"]`) : target;
      focus?.focus({ preventScroll: true });
      dispatch({ type: 'select', id: line.id });
      gesture.current = { mode: 'edit', line, part, point, before: state };
    } else {
      event.currentTarget.focus({ preventScroll: true });
      if (state.lines.length >= MAX_SCREEN_RULERS) { dispatch({ type: 'place', point }); return; }
      gesture.current = { mode: 'draw', point, anchor: state.start || point, pending: Boolean(state.start), before: state, moved: false };
      dispatch({ type: 'preview', start: state.start || point, point });
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  /** 拖线保留长度，拖端点改长度；新建线只有松手或第二次落点后才保存。 */
  const pointerMove = (event) => {
    const point = location(event), drag = gesture.current;
    if (!point) return;
    if (drag?.mode === 'edit') {
      dispatch({ type: 'move', line: drag.line, part: drag.part,
        delta: { x: point.x - drag.point.x, y: point.y - drag.point.y }, bounds });
    } else if (drag) {
      if (screenRulerDistance(drag.point, point) >= 1) drag.moved = true;
      dispatch({ type: 'preview', start: drag.anchor, point });
    } else dispatch({ type: 'cursor', point });
  };
  /** 结束指针手势，单击第一点仍保留实时预览。 */
  const pointerUp = (event) => {
    const drag = gesture.current; gesture.current = null;
    const point = location(event);
    if (point && drag?.mode === 'draw' && (drag.moved || drag.pending)) dispatch({ type: 'place', point });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  /** 指针取消或丢失捕获时回到手势之前，不留下误改或半条线。 */
  const cancelGesture = () => {
    if (gesture.current) dispatch({ type: 'restore', state: gesture.current.before });
    gesture.current = null;
  };
  /** 方向键移动准星或已聚焦的线/端点，Enter 落点，Delete 删除，Escape 退出。 */
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
    const target = event.target.closest('[data-ruler-id]');
    const line = state.lines.find((entry) => entry.id === Number(target?.dataset.rulerId));
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const id = line?.id ?? state.selectedId;
      if (id !== null) { event.preventDefault(); dispatch({ type: 'remove', id }); rootRef.current.focus(); }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (line) dispatch({ type: 'select', id: line.id });
      else dispatch({ type: 'place', point: state.cursor });
      return;
    }
    const vector = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!vector) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    if (line) dispatch({ type: 'move', line, part: target.dataset.rulerPart || 'line', delta: { x: vector[0] * step, y: vector[1] * step }, bounds });
    else dispatch({ type: 'cursor', point: clampRulerPoint({ x: state.cursor.x + vector[0] * step, y: state.cursor.y + vector[1] * step }, bounds) });
  };
  const selected = state.lines.find((line) => line.id === state.selectedId);
  const start = state.start || selected?.start, end = state.start ? state.cursor : selected?.end;
  const span = sensorRulerSpan(start, end);
  const previewStart = screen(state.start), cursor = screen(state.cursor);
  return <div className="portal-screen-ruler" onKeyDown={(event) => event.stopPropagation()} onKeyUp={(event) => event.stopPropagation()}>
    <svg ref={rootRef} className="portal-ruler-surface" tabIndex={0} role="group" aria-label="传感点量尺画布"
      aria-describedby="portal-ruler-instructions" onKeyDown={onKeyDown} onPointerDown={pointerDown} onPointerMove={pointerMove}
      onPointerUp={pointerUp} onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture}
      onContextMenu={(event) => {
        event.preventDefault();
        if (state.start) dispatch({ type: 'cancel' });
        else {
          const id = Number(event.target.closest('[data-ruler-id]')?.dataset.rulerId);
          if (state.lines.some((line) => line.id === id)) dispatch({ type: 'select', id });
        }
      }}>
      {state.lines.map((saved) => {
        const line = { ...saved, start: screen(saved.start), end: screen(saved.end) };
        if (!line.start || !line.end) return null;
        return <g key={line.id} className={`portal-ruler-saved${line.id === state.selectedId ? ' is-selected' : ''}`}
        tabIndex={0} role="group" aria-label={`量尺 ${line.id}`} data-ruler-group={line.id} data-ruler-id={line.id}>
        <line className="portal-ruler-hit" x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} data-ruler-id={line.id} />
        <line className="portal-ruler-stroke" x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} />
        {['start', 'end'].map((part) => <g key={part}>
          <circle className="portal-ruler-endpoint-hit" cx={line[part].x} cy={line[part].y} r="18" tabIndex={0} role="button"
            aria-label={`量尺 ${line.id}${part === 'start' ? '起点' : '终点'}`} data-ruler-id={line.id} data-ruler-part={part} />
          <circle className="portal-ruler-endpoint" cx={line[part].x} cy={line[part].y} r="5" />
        </g>)}
        <text x={(line.start.x + line.end.x) / 2} y={(line.start.y + line.end.y) / 2 - 14} textAnchor="middle"
          data-ruler-id={line.id}>{line.id} · {distanceLabel(saved.start, saved.end)}</text>
      </g>; })}
      {previewStart && cursor && <g className="portal-ruler-line">
        <line x1={previewStart.x} y1={previewStart.y} x2={cursor.x} y2={cursor.y} />
        <circle cx={previewStart.x} cy={previewStart.y} r="5" /><circle cx={cursor.x} cy={cursor.y} r="5" />
      </g>}
      {cursor && <path className="portal-ruler-crosshair" d={`M${cursor.x - 7},${cursor.y}h14 M${cursor.x},${cursor.y - 7}v14`} />}
    </svg>
    <div className="portal-ruler-readout" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
      <div className="portal-ruler-summary"><strong>传感点量尺 · {distanceLabel(start, end)}</strong><span>{state.lines.length}/{MAX_SCREEN_RULERS} 条</span></div>
      <form className="portal-ruler-spacing" onSubmit={(event) => {
        event.preventDefault(); const next = normalizeSensorPitch(draft);
        if (!next) { setNotice('请输入大于 0 的横向和纵向点距。'); return; }
        setPitch(next); setNotice(saveSensorPitch(storageKey, next) ? '点距已保存到此系统。' : '本次点距已应用，本机保存失败。');
      }}>
        <label>横向点距（mm）<input aria-label="横向点距（mm）" type="number" min="0.000001" step="any" required value={draft.x}
          onChange={(event) => setDraft({ ...draft, x: event.target.value })} /></label>
        <label>纵向点距（mm）<input aria-label="纵向点距（mm）" type="number" min="0.000001" step="any" required value={draft.y}
          onChange={(event) => setDraft({ ...draft, y: event.target.value })} /></label>
        <button type="submit">应用点距</button>
      </form>
      <span id="portal-ruler-instructions">端点锁定传感点中心，按整格移动；1 格是相邻两点的中心间距。方向键移动 1 格，测量不计压力峰高。</span>
      {span && <span className="portal-ruler-grid-span">横跨 {span.columns} 格 · 纵跨 {span.rows} 格</span>}
      {start && end && <span>起点（{start.x + 1}, {start.y + 1}）→ 终点（{end.x + 1}, {end.y + 1}）</span>}
      <div className="portal-ruler-actions">
        {state.start && <button type="button" onClick={() => dispatch({ type: 'cancel' })}>取消当前绘制</button>}
        <button type="button" disabled={state.selectedId === null} onClick={() => dispatch({ type: 'remove', id: state.selectedId })}>删除选中</button>
        <button type="button" disabled={!state.lines.length && !state.start} onClick={() => dispatch({ type: 'clear' })}>清空量尺</button>
        <button type="button" onClick={onClose}>退出量尺</button>
      </div>
      {state.error && <span role="alert" className="portal-ruler-error">{state.error}</span>}
      {notice && <span role="status">{notice}</span>}
    </div>
  </div>;
}
