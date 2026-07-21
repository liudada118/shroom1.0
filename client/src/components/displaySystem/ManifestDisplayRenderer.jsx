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
import './ManifestDisplayRenderer.css';

function getChannelFromSource(source = '') {
  if (source.startsWith('back')) return 'back';
  if (source.startsWith('head')) return 'head';
  if (source.startsWith('sensor')) return 'sensor';
  return 'sit';
}

function MatrixWidget({ values, matrix, label, showValues = false, columnSpan }) {
  const cols = Number(matrix?.width || matrix?.cols || Math.sqrt(values.length) || 1);
  const max = Math.max(1, ...values.map(Number).filter(Number.isFinite));
  return (
    <section className="manifest-widget manifest-matrix-widget" style={{ gridColumn: `span ${columnSpan || 8}` }}>
      <h3>{label}</h3>
      <div
        className="manifest-matrix"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {values.map((value, index) => {
          const ratio = Math.max(0, Number(value) || 0) / max;
          const hue = 195 - ratio * 195;
          return (
            <span
              key={index}
              title={`${index}: ${value}`}
              style={{ backgroundColor: `hsl(${hue} 88% ${42 + ratio * 8}%)` }}
            >
              {showValues ? (Number.isInteger(value) ? value : Number(value).toFixed(1)) : ''}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function StatsWidget({ metrics, label, columnSpan }) {
  const items = [
    ['Total', metrics.totalPressure.toFixed(2)],
    ['Maximum', metrics.maxPressure.toFixed(2)],
    ['Average', metrics.averagePressure.toFixed(2)],
    ['Active Points', metrics.activePoints],
  ];
  return (
    <section className="manifest-widget manifest-stats-widget" style={{ gridColumn: `span ${columnSpan || 4}` }}>
      <h3>{label}</h3>
      <div className="manifest-stats-grid">
        {items.map(([name, value]) => (
          <div key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ManifestDisplayRenderer({ definition, onSidebarData }) {
  const [frames, setFrames] = useState({ sit: [], back: [], head: [], sensor: [] });
  const [normalizedFrames, setNormalizedFrames] = useState({ sit: [], back: [], head: [], sensor: [] });
  const [algorithmMetricFrames, setAlgorithmMetricFrames] = useState({});
  const [selection, setSelection] = useState({});
  const handleMessage = useCallback((message) => {
    if (!message || typeof message !== 'object') return;
    setFrames((current) => {
      const next = { ...current };
      if (Array.isArray(message.sitData)) next.sit = message.sitData;
      if (Array.isArray(message.backData)) next.back = message.backData;
      if (Array.isArray(message.headData)) next.head = message.headData;
      if (Array.isArray(message.sensorData)) next.sensor = message.sensorData;
      if (Array.isArray(message.data) && message.outputChannel) next[message.outputChannel] = message.data;
      if (Array.isArray(message.value) && message.portId) next[message.portId] = message.value;
      return next;
    });
    if (message.outputChannel && Array.isArray(message.normalizedData)) {
      setNormalizedFrames((current) => ({
        ...current,
        [message.outputChannel]: message.normalizedData,
      }));
    }
    const algorithmMetrics = message.algorithmMetrics || message.metrics?.algorithm;
    if (message.outputChannel && algorithmMetrics && typeof algorithmMetrics === 'object') {
      setAlgorithmMetricFrames((current) => ({
        ...current,
        [message.outputChannel]: algorithmMetrics,
      }));
    }
  }, []);
  useMainWebSocket({ onMessage: handleMessage });

  const matrix = definition?.matrix;
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
  const storageKey = `display-profile:${definition?.displaySystemId || definition?.type || 'unknown'}`;

  useEffect(() => {
    try {
      setSelection(JSON.parse(localStorage.getItem(storageKey)) || {});
    } catch {
      setSelection({});
    }
  }, [storageKey]);

  const updateSelection = useCallback((nextSelection) => {
    setSelection(nextSelection);
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextSelection));
    } catch {
      // The selection remains active for this session when storage is unavailable.
    }
  }, [storageKey]);

  const selectProfile = useCallback((profileId) => {
    const profile = profileModel.profiles.find((item) => item.id === profileId);
    updateSelection({
      profileId,
      rendererId: profile?.renderer,
      algorithmId: profile?.visualizationAlgorithm,
    });
  }, [profileModel, updateSelection]);

  const widgetModels = useMemo(() => {
    return profileModel.widgets
      .filter((widget) => activeProfile.visibleWidgetIds.has(widget.id))
      .map((widget) => {
      const channel = getChannelFromSource(widget.source);
      const values = frames[channel] || [];
      const widgetType = isDataRendererType(widget.type)
        ? activeProfile.renderer?.type || widget.type
        : widget.type;
      const renderedValues = isDataRendererType(widgetType)
        ? applyVisualizationAlgorithm(values, activeProfile.algorithm, matrix)
        : values;
      return {
        widget: { ...widget, type: widgetType },
        values: renderedValues,
        metrics: calculatePressureMetrics(values),
      };
    });
  }, [activeProfile, frames, matrix, profileModel]);

  const sidebarChannel = getChannelFromSource(sidebar?.source);
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
  const sidebarMetrics = useMemo(
    () => calculatePressureMetrics(sidebarValues, sidebar),
    [sidebar, sidebarValues],
  );

  useEffect(() => {
    if (!sidebar || !onSidebarData) return;
    onSidebarData({
      values: sidebarValues,
      metrics: sidebarMetrics,
      algorithmMetrics: sidebarAlgorithmMetrics,
    });
  }, [onSidebarData, sidebar, sidebarAlgorithmMetrics, sidebarMetrics, sidebarValues]);

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
      <div className="manifest-widget-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {widgetModels.map(({ widget, values, metrics }) => {
          if (widget.type === 'pressureStats') {
            return <StatsWidget key={widget.id} label={widget.label || widget.id} metrics={metrics} columnSpan={widget.columnSpan} />;
          }
          if (['heatmap', 'matrix', 'raw2d'].includes(widget.type)) {
            return (
              <MatrixWidget
                key={widget.id}
                label={widget.label || widget.id}
                matrix={matrix}
                values={values}
                showValues={widget.type !== 'heatmap' && values.length <= 1024}
                columnSpan={widget.columnSpan}
              />
            );
          }
          return (
            <section key={widget.id} className="manifest-widget manifest-unsupported-widget">
              <h3>{widget.label || widget.id}</h3>
              <span>当前客户端未注册渲染器：{widget.type}</span>
            </section>
          );
        })}
      </div>
    </div>
  );
}
