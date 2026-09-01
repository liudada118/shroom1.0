import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PartRail from './PartRail.jsx';
import {
  PART_DRAG_TYPE,
  applySurfacePart,
  buildCanvasParts,
  isSurfacePartActive,
  moveCanvasWidget,
  partSurface,
  removeCanvasWidget,
  updateCanvasWidgetSource,
} from './canvasParts';
import { DEFAULT_COLORMAP_ID, colormapPreviewCss } from '../colormaps';
import './canvasConfigurator.css';

const EMPTY_CANVAS = { colormap: { id: DEFAULT_COLORMAP_ID }, overlays: [], widgets: [] };

function normalizeSourceOptions(sourceOptions) {
  const used = new Set();
  return (Array.isArray(sourceOptions) ? sourceOptions : []).flatMap((option) => {
    const value = String(option?.value ?? option?.id ?? '').trim();
    if (!value || used.has(value)) return [];
    used.add(value);
    return [{ value, label: String(option?.label || value) }];
  });
}

/**
 * 从拖放事件里取出零件描述。自定义 MIME 优先，取不到再退回 text/plain。
 *
 * @param {DragEvent} event 拖放事件。
 * @returns {{kind: string, id: string, type?: string} | null} 零件描述。
 */
function readPartPayload(event) {
  const raw = event.dataTransfer.getData(PART_DRAG_TYPE)
    || event.dataTransfer.getData('text/plain');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.kind && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 展示画布配置器。
 *
 * 配置器和运行时共用这一个组件：Builder 里它的 value 最终写进 manifest 的
 * `display.canvas`，主界面里它的 value 存进 localStorage 的用户偏好。两处结构同构。
 *
 * @param {object} props 组件参数。
 * @param {{colormap: object, overlays: string[], widgets: object[]}} props.value 当前画布配置。
 * @param {(next: object) => void} props.onChange 配置变化回调。
 * @param {React.ReactNode} props.children 画布内容，由调用方渲染真实数据。
 * @param {Array<{id: string, label: string, type?: string}>} [props.renderers] 可选渲染器目录。
 * @param {Array<{value: string, label: string}>} [props.sourceOptions] widget 可选数据源。
 * @param {string} [props.defaultSource] 新增 widget 默认绑定的数据源。
 * @param {(source: string) => string} [props.resolveSourceValue] 把旧 source 别名解析成 option value。
 * @param {string[]} [props.colormapIds] 后端 catalog 允许的配色 id。
 * @param {React.ReactNode} [props.emptyState] 无数据时显示的空状态。
 * @param {boolean} [props.readOnly] 只读模式，禁止一切修改。
 * @param {'inline' | 'overlay'} [props.variant] 形态。`inline` 把画布作为 children 排在零件栏上方，
 *        Builder 用这种；`overlay` 把零件栏固定在视口底部、拖放区盖住整个视口，
 *        主界面的 3D 场景是 100vh，只能用这种。
 * @param {string[]} [props.categoryIds] 只显示这几类零件。
 * @param {string[]} [props.overlayIds] 只显示这几个叠加层，缺省全部。
 * @param {{colormap: object, overlays: string[]}} [props.chartValue] 图表表面的当前外观。
 *        图表和画布是两块独立表面，各有自己的 value 和 onChange —— 换画布配色
 *        不该顺手把侧栏曲线也换掉。
 * @param {(next: object) => void} [props.onChartChange] 图表外观变化回调。
 * @param {string[]} [props.chartOverlayIds] 图表能落地的叠加层；不传就不显示图表类别。
 * @param {object[]} [props.chartTemplates] 可以拖出来的图表卡片模板；不传就不显示这一类。
 * @param {string[]} [props.chartWidgetIds] 已经在页面上的图表卡片模板 id，用来给方块加高亮。
 * @param {(part: object) => void} [props.onChartWidgetAdd] 拖入图表卡片零件时的回调。
 *        它不是值变换（见 `partSurface`），写的是另一个存储键，所以由调用方处理。
 * @param {(id: string) => void} [props.onChartWidgetRemove] 把页面上的图表卡片拖回零件栏时的回调。
 * @param {{dirty: boolean, changes: Array<{label: string}>}} [props.draft] 草稿层状态，
 *        由 `displayDraftState.describeDisplayDraft` 算出。**不传就一行都不渲染** ——
 *        Builder 里配置器的 value 本身就是 manifest 草稿，状态带在那儿没有意义。
 * @param {() => void} [props.onRevert] 点撤销。它和 `draft.dirty` 一起决定状态带出不出现。
 * @param {() => void} [props.onSave] 点保存；不传就不画这个按钮（自带展示系统写不进去）。
 * @param {() => void} [props.onSaveAs] 点另存为；不传就不画这个按钮（老展示系统没有文件夹）。
 * @param {string} [props.saveHint] 状态带右侧的一句说明，例如"自带展示形式只能另存为"。
 */
export default function DisplayCanvasConfigurator({
  value,
  onChange,
  children,
  renderers = [],
  sourceOptions = null,
  defaultSource = '',
  resolveSourceValue = null,
  colormapIds = null,
  emptyState = null,
  readOnly = false,
  simple = false,
  title = '画布零件',
  variant = 'inline',
  categoryIds = null,
  overlayIds = null,
  chartValue = null,
  onChartChange = null,
  chartOverlayIds = null,
  chartTemplates = null,
  chartWidgetIds = null,
  onChartWidgetAdd = null,
  onChartWidgetRemove = null,
  draft = null,
  onRevert = null,
  onSave = null,
  onSaveAs = null,
  saveHint = '',
}) {
  const canvas = value || EMPTY_CANVAS;
  const chart = chartValue || EMPTY_CANVAS;
  const isOverlay = variant === 'overlay';
  const widgetSourceOptions = useMemo(
    () => normalizeSourceOptions(sourceOptions),
    [sourceOptions],
  );
  const resolveConfiguredSource = useCallback((source) => {
    const resolved = typeof resolveSourceValue === 'function'
      ? resolveSourceValue(source)
      : source;
    return String(resolved || source || '').trim();
  }, [resolveSourceValue]);
  const preferredNewWidgetSource = String(
    defaultSource
    || widgetSourceOptions[0]?.value
    || resolveConfiguredSource(canvas.widgets?.[0]?.source)
    || 'sitData',
  ).trim();
  const [newWidgetSource, setNewWidgetSource] = useState(preferredNewWidgetSource);
  const [dragOver, setDragOver] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  // overlay 形态默认收起：展开的栏会盖住 3D 场景左下角的最大值读数
  // （`.maxNum` 是 `bottom: 5%`），所以平时只留右下角一个入口按钮。
  const [collapsed, setCollapsed] = useState(isOverlay);
  const parts = useMemo(
    () => buildCanvasParts({
      renderers, colormapIds, overlayIds, chartOverlayIds, chartTemplates,
    }),
    [chartOverlayIds, chartTemplates, colormapIds, overlayIds, renderers],
  );

  useEffect(() => {
    setNewWidgetSource((current) => {
      const isCurrentAvailable = widgetSourceOptions.length === 0
        || widgetSourceOptions.some((option) => option.value === current);
      return isCurrentAvailable && current ? current : preferredNewWidgetSource;
    });
  }, [preferredNewWidgetSource, widgetSourceOptions]);

  // overlay 形态的拖放区盖住整个视口，平时必须 pointer-events: none，
  // 否则整个界面都点不动。只有真的在拖零件时才让它接管事件，所以在
  // document 上听 dragstart/dragend —— 零件方块的拖拽事件会冒泡到这里。
  useEffect(() => {
    if (!isOverlay || readOnly) return undefined;
    const onDragStart = () => setDragActive(true);
    const onDragEnd = () => {
      setDragActive(false);
      setDragOver(false);
    };
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('dragend', onDragEnd);
    document.addEventListener('drop', onDragEnd);
    return () => {
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('dragend', onDragEnd);
      document.removeEventListener('drop', onDragEnd);
    };
  }, [isOverlay, readOnly]);

  const emit = useCallback((next) => {
    if (readOnly || !next || next === canvas) return;
    onChange?.(next);
  }, [canvas, onChange, readOnly]);

  // 零件按自己所属的表面落到对应的 value 上。图表表面没接（没传 onChartChange）
  // 时直接忽略，而不是错误地写进画布配置。
  const applyPart = useCallback((part) => {
    if (readOnly || !part) return;
    const surface = partSurface(part);
    // 图表卡片不是值变换：它写的是另一个存储键，只能交给调用方。
    if (surface === 'chartWidget') {
      onChartWidgetAdd?.(part);
      return;
    }
    if (surface === 'chart') {
      if (!onChartChange) return;
      const next = applySurfacePart(chart, part);
      if (next !== chart) onChartChange(next);
      return;
    }
    emit(applySurfacePart(canvas, part, { defaultSource: newWidgetSource }));
  }, [canvas, chart, emit, newWidgetSource, onChartChange, onChartWidgetAdd, readOnly]);

  const isPartActive = useCallback((part) => {
    const surface = partSurface(part);
    if (surface === 'chartWidget') {
      return Array.isArray(chartWidgetIds) && chartWidgetIds.includes(part?.id);
    }
    return isSurfacePartActive(surface === 'chart' ? chart : canvas, part);
  }, [canvas, chart, chartWidgetIds]);

  // 零件栏兼作回收区：已放置的画布 widget 和侧栏的图表卡片都能拖回来删除。
  const removePlaced = useCallback((payload) => {
    if (readOnly || !payload) return false;
    if (payload.kind === 'placedWidget') {
      emit(removeCanvasWidget(canvas, payload.id));
      return true;
    }
    if (payload.kind === 'placedChartWidget') {
      onChartWidgetRemove?.(payload.id);
      return true;
    }
    return false;
  }, [canvas, emit, onChartWidgetRemove, readOnly]);

  const handleDragOver = (event) => {
    if (readOnly) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!dragOver) setDragOver(true);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    applyPart(readPartPayload(event));
  };

  const removeWidget = useCallback((widgetId) => {
    if (readOnly) return;
    emit(removeCanvasWidget(canvas, widgetId));
  }, [canvas, emit, readOnly]);

  const moveWidget = useCallback((sourceId, targetId) => {
    if (readOnly) return;
    emit(moveCanvasWidget(canvas, sourceId, targetId));
  }, [canvas, emit, readOnly]);

  const updateWidgetSource = useCallback((widgetId, source) => {
    if (readOnly) return;
    emit(updateCanvasWidgetSource(canvas, widgetId, source));
  }, [canvas, emit, readOnly]);

  const handlePlacedDragStart = (widget) => (event) => {
    if (readOnly) {
      event.preventDefault();
      return;
    }
    const payload = JSON.stringify({ kind: 'placedWidget', id: widget.id });
    event.dataTransfer.setData(PART_DRAG_TYPE, payload);
    event.dataTransfer.setData('text/plain', payload);
    event.dataTransfer.effectAllowed = 'move';
  };

  // 零件栏同时充当"拖出画布"的回收区：把已放置的 widget 拖下来即删除。
  const handleRailDrop = (event) => {
    const payload = readPartPayload(event);
    if (!payload) return;
    // 只有真的删掉了才拦事件，否则拖零件时零件栏会把落点吞掉。
    if (removePlaced(payload)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const hasCanvasContent = Boolean(children) && (canvas.widgets?.length ?? 0) > 0;

  // 草稿状态带。拖零件写的只是 localStorage，展示系统目录里那份 manifest 没动过，
  // 所以这里要明确告诉用户"改动还没落盘"，并给出三个出路。
  // 收起状态下也照样显示 —— 折叠是默认态，把提示藏在折叠里等于没有提示。
  if (simple) {
    return (
      <div className="display-canvas-configurator is-simple">
        <div className="canvas-drop-area">
          {hasCanvasContent || !emptyState ? children : emptyState}
        </div>
      </div>
    );
  }

  const draftBar = draft?.dirty && onRevert ? (
    <div className="canvas-draft-bar">
      <span className="canvas-draft-status">● 有未保存的改动</span>
      {saveHint ? <span className="canvas-draft-hint">{saveHint}</span> : null}
      <button type="button" onClick={onRevert}>撤销</button>
      {onSave ? <button type="button" onClick={onSave}>保存</button> : null}
      {onSaveAs ? <button type="button" onClick={onSaveAs}>另存为</button> : null}
    </div>
  ) : null;

  if (isOverlay) {
    const showLegend = (canvas.overlays || []).includes('legend');
    return (
      <div className="canvas-overlay-configurator">
        {dragActive ? (
          <div
            className={dragOver ? 'canvas-drop-overlay is-drag-over' : 'canvas-drop-overlay'}
            onDragOver={handleDragOver}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="canvas-drop-hint" aria-hidden="true">松手放到画布上</div>
          </div>
        ) : null}
        <div
          className={collapsed ? 'canvas-overlay-bar is-collapsed' : 'canvas-overlay-bar'}
          onDragOver={(event) => {
            if (!readOnly) event.preventDefault();
          }}
          onDrop={handleRailDrop}
        >
          {draftBar}
          <button
            type="button"
            className="canvas-overlay-toggle"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((current) => !current)}
          >
            {collapsed ? '画布零件 ▲' : '收起 ▼'}
          </button>
          {collapsed ? null : (
            <>
              {showLegend ? (
                <div className="canvas-overlay-legend">
                  <span>低</span>
                  <i style={{ background: colormapPreviewCss(canvas.colormap?.id, canvas.colormap) }} />
                  <span>高</span>
                </div>
              ) : null}
              <PartRail
                parts={parts}
                isActive={isPartActive}
                onActivate={applyPart}
                readOnly={readOnly}
                categoryIds={categoryIds}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="display-canvas-configurator">
      <div
        className={dragOver ? 'canvas-drop-area is-drag-over' : 'canvas-drop-area'}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {hasCanvasContent || !emptyState ? children : emptyState}
        {dragOver ? <div className="canvas-drop-hint" aria-hidden="true">松手放到画布上</div> : null}
      </div>
      {(canvas.widgets?.length ?? 0) > 0 || widgetSourceOptions.length ? (
        <div className="canvas-widget-chips">
          <span className="canvas-widget-chips-label">{title}</span>
          {widgetSourceOptions.length ? (
            <label className="canvas-new-widget-source">
              <span>新增组件数据源</span>
              <select
                aria-label="新增组件数据源"
                value={newWidgetSource}
                disabled={readOnly}
                onChange={(event) => setNewWidgetSource(event.target.value)}
              >
                {widgetSourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ) : null}
          {canvas.widgets.map((widget) => (
            <span
              className="canvas-widget-chip"
              key={widget.id}
              draggable={!readOnly}
              onDragStart={handlePlacedDragStart(widget)}
              onDragOver={(event) => {
                if (!readOnly) event.preventDefault();
              }}
              onDrop={(event) => {
                const payload = readPartPayload(event);
                if (payload?.kind !== 'placedWidget') return;
                event.preventDefault();
                event.stopPropagation();
                moveWidget(payload.id, widget.id);
              }}
            >
              <span>{widget.label || widget.id}</span>
              {widgetSourceOptions.length ? (() => {
                const sourceValue = resolveConfiguredSource(widget.source);
                const sourceIsKnown = widgetSourceOptions
                  .some((option) => option.value === sourceValue);
                return (
                  <label className="canvas-widget-source">
                    <span>数据源</span>
                    <select
                      aria-label={`${widget.label || widget.id} 数据源`}
                      value={sourceValue}
                      disabled={readOnly}
                      draggable={false}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => updateWidgetSource(widget.id, event.target.value)}
                    >
                      {!sourceIsKnown && sourceValue ? (
                        <option value={sourceValue}>{sourceValue}</option>
                      ) : null}
                      {widgetSourceOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                );
              })() : null}
              {readOnly ? null : (
                <button type="button" aria-label={`移除 ${widget.label || widget.id}`} onClick={() => removeWidget(widget.id)}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      ) : null}
      <div
        className="canvas-rail-dropzone"
        onDragOver={(event) => {
          if (!readOnly) event.preventDefault();
        }}
        onDrop={handleRailDrop}
      >
        {draftBar}
        <PartRail
          parts={parts}
          isActive={isPartActive}
          onActivate={applyPart}
          readOnly={readOnly}
          categoryIds={categoryIds}
        />
      </div>
    </div>
  );
}
