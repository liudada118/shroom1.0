import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Select } from 'antd';
import useMainWebSocket from '../../services/ws/useMainWebSocket';
import {
  applyVisualizationAlgorithm,
  buildDisplayProfileModel,
  calculatePressureMetrics,
  isDataRendererType,
  resolveDisplayProfile,
} from './displayProfileRuntime';
import { readDisplaySelection, writeDisplaySelection } from './displayProfileStorage';
import { applyMatrixTransform } from '../../displays/matrixTransform';
import RendererHost from '../../renderers/RendererHost.jsx';
import AgentRendererHost from './AgentRendererHost.jsx';
import MatrixWidget from './widgets/MatrixWidget.jsx';
import CoordinatePointWidget from './widgets/CoordinatePointWidget.jsx';
import StatsWidget from './widgets/StatsWidget.jsx';
import DisplayCanvasConfigurator from './canvasConfigurator/DisplayCanvasConfigurator.jsx';
import {
  getManifestSourceChannel,
  getManifestSourceChannelId,
  getManifestSourceSensor,
  readManifestChannelFrames,
} from './manifestSceneAdapter.js';
import {
  buildManifestWidgetLabel,
  getManifestChannelFrame,
  reduceManifestChannelFrames,
} from './manifestChannelState.js';
import {
  buildManifestWidgetRendererParams,
  buildManifestWidgetSourceOptions,
  resolveManifestWidgetGeometry,
  resolveManifestWidgetSourceValue,
} from './manifestWidgetGeometry.js';
import { listAgentRendererApps } from './api.js';
import { parseAgentRendererId } from './agentRendererBridge.js';
import './ManifestDisplayRenderer.css';

const ManifestDisplayRenderer = forwardRef(function ManifestDisplayRenderer({
  definition,
  onSidebarData,
  enabled = true,
}, rendererRef) {
  // schemaVersion 3 的 manifest 会带上 sensors[]；v1/v2 升格后同样有，缺失时按单通道处理。
  const sensors = useMemo(
    () => (Array.isArray(definition?.sensors) ? definition.sensors : []),
    [definition?.sensors],
  );
  const [channelFrames, setChannelFrames] = useState({});
  const [selection, setSelection] = useState({});
  const [agentRendererRegistry, setAgentRendererRegistry] = useState({
    status: 'loading',
    apps: [],
    error: '',
  });
  const pushFrames = useCallback((routedFrames) => {
    if (!Array.isArray(routedFrames) || routedFrames.length === 0) return false;
    setChannelFrames((current) => reduceManifestChannelFrames(current, routedFrames));
    return true;
  }, []);
  const handleMessage = useCallback((message) => {
    const routedFrames = readManifestChannelFrames(message, [
      definition?.displaySystemId,
      definition?.type,
    ], sensors);
    return pushFrames(routedFrames);
  }, [definition?.displaySystemId, definition?.type, pushFrames, sensors]);
  useImperativeHandle(rendererRef, () => ({
    handleMessage,
    pushFrame: handleMessage,
    pushFrames,
  }), [handleMessage, pushFrames]);
  // Home 已持有主连接，嵌入时传 enabled=false；独立使用组件时仍可自行订阅。
  useMainWebSocket({ onMessage: handleMessage, enabled });

  const matrix = definition?.sourceMatrix || definition?.matrix;
  const matrixTransform = useMemo(
    () => definition?.matrixTransform
      || definition?.page?.matrixTransform
      || { type: 'none' },
    [definition?.matrixTransform, definition?.page?.matrixTransform],
  );
  const widgetSourceOptions = useMemo(
    () => buildManifestWidgetSourceOptions(sensors),
    [sensors],
  );
  const resolveWidgetSourceValue = useCallback(
    (source) => resolveManifestWidgetSourceValue(source, sensors),
    [sensors],
  );
  const sidebar = definition?.page?.sidebar;
  const agentRendererById = useMemo(
    () => new Map(agentRendererRegistry.apps
      .filter((app) => app.rendererId)
      .map((app) => [app.rendererId, app])),
    [agentRendererRegistry.apps],
  );
  const agentChannels = useMemo(() => {
    const displaySystemId = String(definition?.displaySystemId || definition?.type || '').trim();
    return sensors.flatMap((sensor) => {
      const sensorId = String(sensor?.sensorId || sensor?.id || '').trim();
      const outputChannel = String(sensor?.outputChannel || sensorId).trim();
      const channelId = String(
        sensor?.channelId || (displaySystemId && sensorId ? `${displaySystemId}:${sensorId}` : sensorId),
      ).trim();
      const frame = getManifestChannelFrame(channelFrames, channelId, outputChannel);
      // sensors[] 是声明清单，不代表每一路都已经收到数据。Agent channels[] 只承载
      // 实际帧，缺帧传感器必须缺席，不能伪造成 values=[] 的 32x32 帧。
      if (!frame?.renderValues?.length) return [];
      const values = frame?.renderValues || [];
      return [{
        displaySystemId: frame?.displaySystemId || displaySystemId,
        sensorId: frame?.sensorId || sensorId,
        sensorLabel: frame?.sensorLabel || sensor?.sensorLabel || sensor?.label || sensorId,
        sensorType: sensor?.sensorType || sensor?.type || '',
        outputChannel: frame?.outputChannel || outputChannel,
        channelId: frame?.channelId || channelId,
        timestamp: frame?.timestamp ?? null,
        values,
        rawValues: frame?.rawValues || [],
        matrix: sensor?.sourceMatrix || sensor?.matrix || matrix || {},
        metrics: calculatePressureMetrics(values),
        algorithmMetrics: frame?.algorithmMetrics || {},
        serial: frame?.serial || null,
      }];
    });
  }, [channelFrames, definition?.displaySystemId, definition?.type, matrix, sensors]);
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

  useEffect(() => {
    setChannelFrames({});
  }, [profileId]);

  useEffect(() => {
    let active = true;
    listAgentRendererApps()
      .then((apps) => {
        if (active) setAgentRendererRegistry({ status: 'ready', apps, error: '' });
      })
      .catch((error) => {
        if (active) {
          setAgentRendererRegistry({
            status: 'error',
            apps: [],
            error: error.message || 'Agent 渲染器目录读取失败',
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

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
      const geometry = resolveManifestWidgetGeometry({
        source: widget.source,
        sensors,
        definition,
        matrixTransform,
      });
      const { sourceSensor } = geometry;
      const channel = getManifestSourceChannel(widget.source, sensors);
      const channelId = getManifestSourceChannelId(
        widget.source,
        sensors,
        definition?.displaySystemId,
      );
      const channelFrame = getManifestChannelFrame(channelFrames, channelId, channel);
      const values = channelFrame?.renderValues || [];
      // 多传感器系统每一路矩阵可能都不一样，widget 要用自己那一路的矩阵，
      // 否则第二路会被按第一路的行列数摆放。找不到就沿用顶层矩阵。
      const channelMatrix = geometry.sourceMatrix || matrix;
      const widgetType = isDataRendererType(widget.type)
        ? activeProfile.renderer?.type || widget.type
        : widget.type;
      const usesProfileDataRenderer = isDataRendererType(widget.type);
      const visualizedValues = usesProfileDataRenderer
        ? applyVisualizationAlgorithm(values, activeProfile.algorithm, channelMatrix)
        : values;
      const transformed = usesProfileDataRenderer
        ? applyMatrixTransform(visualizedValues, channelMatrix, matrixTransform)
        : { values: visualizedValues, matrix: channelMatrix };
      return {
        widget: { ...widget, type: widgetType },
        values: transformed.values,
        matrix: transformed.matrix,
        coordinateMap: geometry.coordinateMap,
        coordinatePointLayout: geometry.coordinatePointLayout,
        rendererParams: buildManifestWidgetRendererParams({
          rendererId: widgetType,
          params: activeProfile.renderer?.params,
          matrix: transformed.matrix,
          coordinateMap: usesProfileDataRenderer
            ? geometry.coordinateMap
            : geometry.sourceCoordinateMap,
        }),
        metrics: calculatePressureMetrics(values),
        channel,
        channelId,
        channelFrame,
        identity: {
          displaySystemId: channelFrame?.displaySystemId || definition?.displaySystemId || definition?.type || '',
          sensorId: channelFrame?.sensorId || sourceSensor?.sensorId || sourceSensor?.id || '',
          sensorLabel: channelFrame?.sensorLabel
            || sourceSensor?.sensorLabel
            || sourceSensor?.label
            || '',
          sensorType: sourceSensor?.sensorType || sourceSensor?.type || '',
          outputChannel: channelFrame?.outputChannel || channel,
          channelId: channelFrame?.channelId || channelId,
        },
        timestamp: channelFrame?.timestamp ?? null,
        rawValues: channelFrame?.rawValues || [],
        algorithmMetrics: channelFrame?.algorithmMetrics || {},
        serial: channelFrame?.serial || null,
        label: buildManifestWidgetLabel(
          widget.label || widget.id,
          channelFrame,
          sourceSensor,
        ),
      };
    });
  }, [activeProfile, channelFrames, definition, matrix, matrixTransform, sensors]);

  const updateCanvas = useCallback((canvas) => {
    updateSelection({ ...selection, profileId: activeProfile.profileId, canvas });
  }, [activeProfile.profileId, selection, updateSelection]);

  const sidebarSensor = getManifestSourceSensor(sidebar?.source, sensors);
  const sidebarChannel = getManifestSourceChannel(sidebar?.source, sensors);
  const sidebarChannelId = getManifestSourceChannelId(
    sidebar?.source,
    sensors,
    definition?.displaySystemId,
  );
  const sidebarFrame = useMemo(
    () => getManifestChannelFrame(channelFrames, sidebarChannelId, sidebarChannel),
    [channelFrames, sidebarChannel, sidebarChannelId],
  );
  const sidebarValues = useMemo(
    () => (sidebarFrame?.normalizedValues?.length
      ? sidebarFrame.normalizedValues
      : sidebarFrame?.renderValues || []),
    [sidebarFrame],
  );
  const sidebarAlgorithmMetrics = useMemo(
    () => sidebarFrame?.algorithmMetrics || {},
    [sidebarFrame],
  );
  const sidebarRawData = useMemo(
    () => (sidebarFrame?.rawValues?.length ? sidebarFrame.rawValues : sidebarValues),
    [sidebarFrame, sidebarValues],
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
      displaySystemId: sidebarFrame?.displaySystemId
        || definition?.displaySystemId
        || definition?.type
        || '',
      channelId: sidebarFrame?.channelId || sidebarChannelId,
      outputChannel: sidebarFrame?.outputChannel || sidebarChannel,
      sensorId: sidebarFrame?.sensorId || sidebarSensor?.sensorId || sidebarSensor?.id || '',
      sensorLabel: sidebarFrame?.sensorLabel
        || sidebarSensor?.sensorLabel
        || sidebarSensor?.label
        || '',
      sensorType: sidebarSensor?.sensorType || sidebarSensor?.type || '',
      timestamp: sidebarFrame?.timestamp ?? null,
      matrix: sidebarSensor?.sourceMatrix || sidebarSensor?.matrix || matrix || {},
      serial: sidebarFrame?.serial || sidebarSensor?.serial || null,
      channels: agentChannels,
    });
  }, [
    onSidebarData,
    agentChannels,
    definition?.displaySystemId,
    definition?.type,
    matrix,
    sidebar,
    sidebarAlgorithmMetrics,
    sidebarMetrics,
    sidebarRawData,
    sidebarChannel,
    sidebarChannelId,
    sidebarFrame,
    sidebarSensor,
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
        sourceOptions={widgetSourceOptions}
        defaultSource={widgetSourceOptions[0]?.value}
        resolveSourceValue={resolveWidgetSourceValue}
        simple
      >
        <div className="manifest-widget-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {widgetModels.map(({
            widget,
            values,
            matrix: widgetMatrix,
            coordinateMap: widgetCoordinateMap,
            coordinatePointLayout: widgetCoordinatePointLayout,
            rendererParams: widgetRendererParams,
            metrics,
            channelId,
            identity,
            timestamp,
            rawValues,
            algorithmMetrics,
            serial,
            label,
          }) => {
            if (widget.type === 'pressureStats') {
              return <StatsWidget key={widget.id} label={label} metrics={metrics} columnSpan={widget.columnSpan} />;
            }
            if (['heatmap', 'matrix', 'raw2d'].includes(widget.type)) {
              if (widgetCoordinatePointLayout) {
                return (
                  <CoordinatePointWidget
                    key={widget.id}
                    label={label}
                    layout={widgetCoordinatePointLayout}
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
                  label={label}
                  matrix={widgetMatrix}
                  values={values}
                  showValues={widget.type !== 'heatmap' && values.length <= 1024}
                  columnSpan={widget.columnSpan}
                  colormap={activeProfile.colormap}
                  overlays={activeProfile.overlays}
                />
              );
            }
            if (parseAgentRendererId(widget.type)) {
              return (
                <div
                  key={widget.id}
                  className="manifest-widget-slot"
                  style={{ gridColumn: `span ${widget.columnSpan || 8}` }}
                >
                  <AgentRendererHost
                    rendererId={widget.type}
                    app={agentRendererById.get(widget.type)}
                    registryLoading={agentRendererRegistry.status === 'loading'}
                    registryError={agentRendererRegistry.error}
                    widgetId={widget.id}
                    label={label}
                    identity={identity}
                    timestamp={timestamp}
                    values={values}
                    rawValues={rawValues}
                    matrix={widgetMatrix}
                    metrics={metrics}
                    algorithmMetrics={algorithmMetrics}
                    serial={serial}
                    channels={agentChannels}
                  />
                </div>
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
                  label={label}
                  params={widgetRendererParams}
                  values={values}
                  channel={channelId || getManifestSourceChannel(widget.source, sensors)}
                  coordinateMap={widgetCoordinateMap}
                  local
                />
              </div>
            );
          })}
        </div>
      </DisplayCanvasConfigurator>
    </div>
  );
});

export default ManifestDisplayRenderer;
