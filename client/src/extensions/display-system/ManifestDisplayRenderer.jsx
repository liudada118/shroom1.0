import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Select } from 'antd';
import useMainWebSocket from '../../services/ws/useMainWebSocket';
import {
  applyVisualizationAlgorithm,
  buildDisplayProfileModel,
  calculatePressureMetrics,
  isDataRendererType,
  resolveDisplayProfile,
} from './displayProfileRuntime';
import { buildCoordinatePointLayout } from './coordinatePointLayout';
import { readDisplaySelection, writeDisplaySelection } from './displayProfileStorage';
import {
  applyMatrixTransform,
  transformCoordinateMap,
} from '../../displays/matrixTransform';
import RendererHost from '../../renderers/RendererHost.jsx';
import MatrixWidget from './widgets/MatrixWidget.jsx';
import CoordinatePointWidget from './widgets/CoordinatePointWidget.jsx';
import StatsWidget from './widgets/StatsWidget.jsx';
import DisplayCanvasConfigurator from './canvasConfigurator/DisplayCanvasConfigurator.jsx';
import {
  getManifestSourceChannel,
  readManifestChannelFrames,
} from './manifestSceneAdapter.js';
import './ManifestDisplayRenderer.css';

export default function ManifestDisplayRenderer({ definition, onSidebarData }) {
  const [frames, setFrames] = useState({ sit: [], back: [], head: [], sensor: [] });
  const [rawFrames, setRawFrames] = useState({ sit: [], back: [], head: [], sensor: [] });
  const [normalizedFrames, setNormalizedFrames] = useState({ sit: [], back: [], head: [], sensor: [] });
  const [algorithmMetricFrames, setAlgorithmMetricFrames] = useState({});
  const [selection, setSelection] = useState({});
  const handleMessage = useCallback((message) => {
    const routedFrames = readManifestChannelFrames(message, [
      definition?.displaySystemId,
      definition?.type,
    ]);
    if (!routedFrames.length) return;
    setFrames((current) => routedFrames.reduce(
      (next, frame) => ({ ...next, [frame.channel]: frame.renderValues }),
      current,
    ));
    setNormalizedFrames((current) => routedFrames.reduce(
      (next, frame) => ({ ...next, [frame.channel]: frame.normalizedValues }),
      current,
    ));
    setRawFrames((current) => routedFrames.reduce(
      (next, frame) => ({ ...next, [frame.channel]: frame.rawValues }),
      current,
    ));
    setAlgorithmMetricFrames((current) => routedFrames.reduce(
      (next, frame) => ({ ...next, [frame.channel]: frame.algorithmMetrics }),
      current,
    ));
  }, [definition?.displaySystemId, definition?.type]);
  useMainWebSocket({ onMessage: handleMessage });

  const matrix = definition?.sourceMatrix || definition?.matrix;
  // schemaVersion 3 的 manifest 会带上 sensors[]；v1/v2 升格后同样有，缺失时按单通道处理。
  const sensors = useMemo(
    () => (Array.isArray(definition?.sensors) ? definition.sensors : []),
    [definition?.sensors],
  );
  const matrixTransform = useMemo(
    () => definition?.matrixTransform
      || definition?.page?.matrixTransform
      || { type: 'none' },
    [definition?.matrixTransform, definition?.page?.matrixTransform],
  );
  const coordinateMap = useMemo(
    () => transformCoordinateMap(
      definition?.sourceCoordinateMap || definition?.coordinateMap,
      matrixTransform,
    ),
    [definition?.coordinateMap, definition?.sourceCoordinateMap, matrixTransform],
  );
  const coordinatePointLayout = useMemo(
    () => buildCoordinatePointLayout(coordinateMap),
    [coordinateMap],
  );
  const sidebar = definition?.page?.sidebar;
  const columns = Number(definition?.page?.layout?.columns || 12);
  const profileModel = useMemo(
    () => buildDisplayProfileModel(definition?.page),
    [definition],
  );
  const activeProfile = useMemo(
    () => resolveDisplayProfile(profileModel, selection),
    [profileModel, selection],
  );
  const profileId = definition?.displaySystemId || definition?.type || 'unknown';

  useEffect(() => {
    setSelection(readDisplaySelection(profileId));
  }, [profileId]);

  const updateSelection = useCallback((nextSelection) => {
    setSelection(nextSelection);
    writeDisplaySelection(profileId, nextSelection);
  }, [profileId]);

  const selectProfile = useCallback((profileId) => {
    const profile = profileModel.profiles.find((item) => item.id === profileId);
    updateSelection({
      profileId,
      rendererId: profile?.renderer,
      algorithmId: profile?.visualizationAlgorithm,
    });
  }, [profileModel, updateSelection]);

  const widgetModels = useMemo(() => {
    // 画布 widget 来自 activeProfile：manifest 的 display.canvas.widgets
    // 被用户偏好覆盖后的结果，缺省时就是原来的 display.widgets。
    return activeProfile.canvasWidgets
      .filter((widget) => activeProfile.visibleWidgetIds.has(widget.id))
      .map((widget) => {
      const channel = getManifestSourceChannel(widget.source, sensors);
      const values = frames[channel] || [];
      // 多传感器系统每一路矩阵可能都不一样，widget 要用自己那一路的矩阵，
      // 否则第二路会被按第一路的行列数摆放。找不到就沿用顶层矩阵。
      const channelMatrix = sensors.find(
        (sensor) => (sensor.outputChannel || sensor.id) === channel,
      )?.matrix || matrix;
      const widgetType = isDataRendererType(widget.type)
        ? activeProfile.renderer?.type || widget.type
        : widget.type;
      const visualizedValues = isDataRendererType(widgetType)
        ? applyVisualizationAlgorithm(values, activeProfile.algorithm, channelMatrix)
        : values;
      const transformed = isDataRendererType(widgetType)
        ? applyMatrixTransform(visualizedValues, channelMatrix, matrixTransform)
        : { values: visualizedValues, matrix: channelMatrix };
      return {
        widget: { ...widget, type: widgetType },
        values: transformed.values,
        matrix: transformed.matrix,
        metrics: calculatePressureMetrics(values),
      };
    });
  }, [activeProfile, frames, matrix, matrixTransform, sensors]);

  const updateCanvas = useCallback((canvas) => {
    updateSelection({ ...selection, profileId: activeProfile.profileId, canvas });
  }, [activeProfile.profileId, selection, updateSelection]);

  const sidebarChannel = getManifestSourceChannel(sidebar?.source, sensors);
  const sidebarValues = useMemo(
    () => normalizedFrames[sidebarChannel]?.length
      ? normalizedFrames[sidebarChannel]
      : frames[sidebarChannel] || [],
    [frames, normalizedFrames, sidebarChannel],
  );
  const sidebarAlgorithmMetrics = useMemo(
    () => algorithmMetricFrames[sidebarChannel] || {},
    [algorithmMetricFrames, sidebarChannel],
  );
  const sidebarRawData = useMemo(
    () => rawFrames[sidebarChannel]?.length
      ? rawFrames[sidebarChannel]
      : sidebarValues,
    [rawFrames, sidebarChannel, sidebarValues],
  );
  const sidebarMetrics = useMemo(
    () => calculatePressureMetrics(sidebarValues, sidebar),
    [sidebar, sidebarValues],
  );

  useEffect(() => {
    if (!sidebar || !onSidebarData) return;
    onSidebarData({
      values: sidebarValues,
      rawData: sidebarRawData,
      metrics: sidebarMetrics,
      algorithmMetrics: sidebarAlgorithmMetrics,
    });
  }, [
    onSidebarData,
    sidebar,
    sidebarAlgorithmMetrics,
    sidebarMetrics,
    sidebarRawData,
    sidebarValues,
  ]);

  return (
    <div className="manifest-display" data-display-system={definition?.displaySystemId}>
      <header className="manifest-display-header">
        <div>
          <span>{definition?.displaySystemId}</span>
          <h2>{definition?.label}</h2>
        </div>
        <output>{definition?.protocol?.baudRate ? `${definition.protocol.baudRate} baud` : ''}</output>
      </header>
      <nav className="manifest-profile-menu" aria-label="展示方案选择">
        <label>
          <span>展示方案</span>
          <Select
            value={activeProfile.profileId}
            onChange={selectProfile}
            options={profileModel.profiles.map((profile) => ({ value: profile.id, label: profile.label }))}
          />
        </label>
        <label>
          <span>渲染方式</span>
          <Select
            value={activeProfile.rendererId}
            onChange={(rendererId) => updateSelection({ ...selection, profileId: activeProfile.profileId, rendererId })}
            options={profileModel.renderers.map((renderer) => ({ value: renderer.id, label: renderer.label }))}
          />
        </label>
        <label>
          <span>可视算法</span>
          <Select
            value={activeProfile.algorithmId}
            onChange={(algorithmId) => updateSelection({ ...selection, profileId: activeProfile.profileId, algorithmId })}
            options={profileModel.visualizationAlgorithms.map((algorithm) => ({ value: algorithm.id, label: algorithm.label }))}
          />
        </label>
      </nav>
      <DisplayCanvasConfigurator
        value={activeProfile.canvas}
        onChange={updateCanvas}
        renderers={profileModel.renderers}
      >
        <div className="manifest-widget-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {widgetModels.map(({ widget, values, matrix: widgetMatrix, metrics }) => {
            if (widget.type === 'pressureStats') {
              return <StatsWidget key={widget.id} label={widget.label || widget.id} metrics={metrics} columnSpan={widget.columnSpan} />;
            }
            if (['heatmap', 'matrix', 'raw2d'].includes(widget.type)) {
              if (coordinatePointLayout) {
                return (
                  <CoordinatePointWidget
                    key={widget.id}
                    label={widget.label || widget.id}
                    layout={coordinatePointLayout}
                    values={values}
                    showValues={widget.type !== 'heatmap'}
                    columnSpan={widget.columnSpan}
                    colormap={activeProfile.colormap}
                    overlays={activeProfile.overlays}
                  />
                );
              }
              return (
                <MatrixWidget
                  key={widget.id}
                  label={widget.label || widget.id}
                  matrix={widgetMatrix}
                  values={values}
                  showValues={widget.type !== 'heatmap' && values.length <= 1024}
                  columnSpan={widget.columnSpan}
                  colormap={activeProfile.colormap}
                  overlays={activeProfile.overlays}
                />
              );
            }
            // 内置视图之外的类型交给渲染器插件注册表。未注册时 RendererHost
            // 自己会显示"未注册渲染器"提示，行为与原先的兜底分支一致。
            return (
              <div
                key={widget.id}
                className="manifest-widget-slot"
                style={{ gridColumn: `span ${widget.columnSpan || 8}` }}
              >
                <RendererHost
                  rendererId={widget.type}
                  label={widget.label || widget.id}
                  params={activeProfile.renderer?.params}
                  values={values}
                  channel={getManifestSourceChannel(widget.source, sensors)}
                  local
                />
              </div>
            );
          })}
        </div>
      </DisplayCanvasConfigurator>
    </div>
  );
}
