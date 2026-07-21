const DEFAULT_VIEW_SOURCES = Object.freeze({
  heatmap: 'data',
  matrix: 'data',
  raw2d: 'data',
  model: 'data',
  lineChart: 'metrics.totalPressure',
  pressureStats: 'metrics',
});

const DEFAULT_RENDERER_TYPES = Object.freeze(['heatmap', 'matrix', 'raw2d']);
const DEFAULT_VISUALIZATION_ALGORITHM = Object.freeze({
  id: 'identity',
  type: 'identity',
  label: 'Original data',
  options: {},
});

const SIDEBAR_METRIC_IDS = Object.freeze([
  'totalPressure',
  'averagePressure',
  'maxPressure',
  'activePoints',
  'area',
]);
const SAFE_ALGORITHM_METRIC_ID = /^[A-Za-z][A-Za-z0-9._-]*$/;

function isSidebarMetricId(id) {
  const value = String(id || '');
  return SIDEBAR_METRIC_IDS.includes(value)
    || (value.startsWith('algorithm.') && SAFE_ALGORITHM_METRIC_ID.test(value.slice(10)));
}

function normalizeAlgorithmMetricDefinitions(metrics) {
  if (!Array.isArray(metrics)) return [];
  return metrics
    .filter((metric) => metric && SAFE_ALGORITHM_METRIC_ID.test(String(metric.id || '')))
    .map((metric) => ({
      id: String(metric.id),
      label: String(metric.label || metric.id),
      unit: String(metric.unit || ''),
      decimals: Math.max(0, Math.min(6, Number(metric.decimals) || 0)),
    }));
}

function normalizeMetricIds(metrics, fallback) {
  const source = Array.isArray(metrics) && metrics.length ? metrics : fallback;
  return source.map(String).filter((id, index, values) => (
    isSidebarMetricId(id) && values.indexOf(id) === index
  ));
}

function normalizeSidebarConfig(sidebar) {
  if (!sidebar || typeof sidebar !== 'object' || Array.isArray(sidebar)) return null;
  const pressure = sidebar.pressure || {};
  const area = sidebar.area || {};
  const pressureMetrics = normalizeMetricIds(
    pressure.metrics,
    ['averagePressure', 'maxPressure', 'totalPressure'],
  );
  const areaMetrics = normalizeMetricIds(area.metrics, ['activePoints', 'area']);
  const primaryMetric = isSidebarMetricId(pressure.primaryMetric)
    ? pressure.primaryMetric
    : pressureMetrics[0] || 'totalPressure';

  return {
    source: String(sidebar.source || 'sitData'),
    algorithmMetrics: normalizeAlgorithmMetricDefinitions(sidebar.algorithmMetrics),
    pressure: {
      visible: pressure.visible !== false,
      title: String(pressure.title || 'Pressure Data'),
      primaryMetric,
      metrics: pressureMetrics,
    },
    area: {
      visible: area.visible !== false,
      title: String(area.title || 'Pressure Area'),
      threshold: Math.max(0, Number(area.threshold) || 0),
      pointArea: Math.max(0, Number(area.pointArea) || 0),
      unit: String(area.unit || 'cm²'),
      metrics: areaMetrics,
    },
  };
}

function normalizeView(view, index) {
  if (typeof view === 'string') {
    return {
      id: view,
      type: view,
      label: view,
      source: DEFAULT_VIEW_SOURCES[view] || 'data',
    };
  }
  if (!view || typeof view !== 'object' || Array.isArray(view)) return null;
  const type = String(view.type || '').trim();
  const id = String(view.id || type || `view-${index + 1}`).trim();
  if (!type || !id) return null;
  return {
    ...view,
    id,
    type,
    label: String(view.label || id),
    source: String(view.source || DEFAULT_VIEW_SOURCES[type] || 'data'),
  };
}

function normalizeCatalogItem(item, index, fallbackPrefix) {
  if (typeof item === 'string') {
    return { id: item, type: item, label: item, options: {} };
  }
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const type = String(item.type || item.id || '').trim();
  const id = String(item.id || type || `${fallbackPrefix}-${index + 1}`).trim();
  if (!id || !type) return null;
  return {
    ...item,
    id,
    type,
    label: String(item.label || id),
    options: item.options && typeof item.options === 'object' ? { ...item.options } : {},
  };
}

function normalizeProfile(profile, index) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null;
  const id = String(profile.id || `profile-${index + 1}`).trim();
  if (!id) return null;
  return {
    ...profile,
    id,
    label: String(profile.label || id),
    renderer: String(profile.renderer || '').trim(),
    visualizationAlgorithm: String(
      profile.visualizationAlgorithm || profile.algorithm || 'identity'
    ).trim(),
    widgets: Array.isArray(profile.widgets)
      ? profile.widgets.map(String).filter(Boolean)
      : [],
  };
}

function buildDefaultRenderers(views, widgets) {
  const rendererTypes = [...views, ...widgets]
    .map((item) => item.type)
    .filter((type, index, values) => (
      DEFAULT_RENDERER_TYPES.includes(type) && values.indexOf(type) === index
    ));
  return (rendererTypes.length ? rendererTypes : ['heatmap']).map((type) => ({
    id: type,
    type,
    label: type,
    options: {},
  }));
}

function normalizeDisplayConfig(display = {}) {
  const views = (Array.isArray(display.views) ? display.views : [])
    .map(normalizeView)
    .filter(Boolean);
  const widgets = (Array.isArray(display.widgets) ? display.widgets : views)
    .map(normalizeView)
    .filter(Boolean);
  const defaultView = display.defaultView || views[0]?.id || widgets[0]?.id || 'heatmap';
  const renderers = (Array.isArray(display.renderers) ? display.renderers : [])
    .map((item, index) => normalizeCatalogItem(item, index, 'renderer'))
    .filter(Boolean);
  const visualizationAlgorithms = (
    Array.isArray(display.visualizationAlgorithms) ? display.visualizationAlgorithms : []
  )
    .map((item, index) => normalizeCatalogItem(item, index, 'algorithm'))
    .filter(Boolean);
  const normalizedRenderers = renderers.length ? renderers : buildDefaultRenderers(views, widgets);
  const normalizedAlgorithms = visualizationAlgorithms.length
    ? visualizationAlgorithms
    : [{ ...DEFAULT_VISUALIZATION_ALGORITHM }];
  const profiles = (Array.isArray(display.profiles) ? display.profiles : [])
    .map(normalizeProfile)
    .filter(Boolean);
  const normalizedProfiles = profiles.length ? profiles : [{
    id: 'default',
    label: 'Default',
    renderer: normalizedRenderers[0].id,
    visualizationAlgorithm: normalizedAlgorithms[0].id,
    widgets: widgets.map((widget) => widget.id),
  }];
  const defaultProfile = display.defaultProfile || normalizedProfiles[0].id;

  return {
    layout: display.layout || { type: 'grid', columns: 12 },
    views,
    widgets,
    defaultView,
    controls: display.controls || {},
    sidebar: normalizeSidebarConfig(display.sidebar),
    renderers: normalizedRenderers,
    visualizationAlgorithms: normalizedAlgorithms,
    profiles: normalizedProfiles,
    defaultProfile,
  };
}

function validateUniqueIds(items, field, errors, source) {
  const ids = new Set();
  items.forEach((item) => {
    if (ids.has(item.id)) errors.push(`${source}: duplicate ${field} id ${item.id}`);
    ids.add(item.id);
  });
  return ids;
}

function validateDisplayConfig(display, { source = 'display system manifest' } = {}) {
  if (display == null) return [];
  if (typeof display !== 'object' || Array.isArray(display)) {
    return [`${source}: display must be an object`];
  }

  const errors = [];
  if (display.sidebar != null) {
    if (typeof display.sidebar !== 'object' || Array.isArray(display.sidebar)) {
      errors.push(`${source}: display.sidebar must be an object`);
    } else {
      const pressure = display.sidebar.pressure;
      const area = display.sidebar.area;
      const algorithmMetricIds = new Set();
      if (display.sidebar.algorithmMetrics != null && !Array.isArray(display.sidebar.algorithmMetrics)) {
        errors.push(`${source}: display.sidebar.algorithmMetrics must be an array`);
      }
      (Array.isArray(display.sidebar.algorithmMetrics) ? display.sidebar.algorithmMetrics : [])
        .forEach((metric, index) => {
          if (!metric || !SAFE_ALGORITHM_METRIC_ID.test(String(metric.id || ''))) {
            errors.push(`${source}: display.sidebar.algorithmMetrics[${index}].id is invalid`);
            return;
          }
          if (algorithmMetricIds.has(metric.id)) {
            errors.push(`${source}: duplicate sidebar algorithm metric id ${metric.id}`);
          }
          algorithmMetricIds.add(metric.id);
        });
      [
        ['pressure', pressure],
        ['area', area],
      ].forEach(([section, config]) => {
        if (config?.metrics != null && !Array.isArray(config.metrics)) {
          errors.push(`${source}: display.sidebar.${section}.metrics must be an array`);
        }
        (Array.isArray(config?.metrics) ? config.metrics : []).forEach((metric) => {
          if (!isSidebarMetricId(metric)) {
            errors.push(`${source}: display.sidebar.${section} references unknown metric ${metric}`);
          } else if (
            String(metric).startsWith('algorithm.')
            && !algorithmMetricIds.has(String(metric).slice(10))
          ) {
            errors.push(`${source}: display.sidebar.${section} references undeclared algorithm metric ${metric}`);
          }
        });
      });
      if (pressure?.primaryMetric && !isSidebarMetricId(pressure.primaryMetric)) {
        errors.push(`${source}: display.sidebar.pressure.primaryMetric is unknown`);
      } else if (
        String(pressure?.primaryMetric || '').startsWith('algorithm.')
        && !algorithmMetricIds.has(String(pressure.primaryMetric).slice(10))
      ) {
        errors.push(`${source}: display.sidebar.pressure.primaryMetric references undeclared algorithm metric`);
      }
      if (area?.threshold != null && (!Number.isFinite(Number(area.threshold)) || Number(area.threshold) < 0)) {
        errors.push(`${source}: display.sidebar.area.threshold must be a non-negative number`);
      }
      if (area?.pointArea != null && (!Number.isFinite(Number(area.pointArea)) || Number(area.pointArea) < 0)) {
        errors.push(`${source}: display.sidebar.area.pointArea must be a non-negative number`);
      }
    }
  }
  const normalized = normalizeDisplayConfig(display);
  const ids = new Set();
  normalized.widgets.forEach((widget, index) => {
    if (!widget.type) errors.push(`${source}: display.widgets[${index}].type is required`);
    if (ids.has(widget.id)) errors.push(`${source}: duplicate display widget id ${widget.id}`);
    ids.add(widget.id);
  });
  if (
    normalized.views.length > 0
    && !normalized.views.some((view) => view.id === normalized.defaultView || view.type === normalized.defaultView)
  ) {
    errors.push(`${source}: display.defaultView must reference a configured view`);
  }
  const rendererIds = validateUniqueIds(normalized.renderers, 'display renderer', errors, source);
  const algorithmIds = validateUniqueIds(
    normalized.visualizationAlgorithms,
    'display visualization algorithm',
    errors,
    source,
  );
  const profileIds = validateUniqueIds(normalized.profiles, 'display profile', errors, source);
  normalized.profiles.forEach((profile) => {
    if (!rendererIds.has(profile.renderer)) {
      errors.push(`${source}: display profile ${profile.id} references unknown renderer ${profile.renderer}`);
    }
    if (!algorithmIds.has(profile.visualizationAlgorithm)) {
      errors.push(`${source}: display profile ${profile.id} references unknown visualization algorithm ${profile.visualizationAlgorithm}`);
    }
    profile.widgets.forEach((widgetId) => {
      if (!ids.has(widgetId)) {
        errors.push(`${source}: display profile ${profile.id} references unknown widget ${widgetId}`);
      }
    });
  });
  if (!profileIds.has(normalized.defaultProfile)) {
    errors.push(`${source}: display.defaultProfile must reference a configured profile`);
  }
  return errors;
}

module.exports = {
  DEFAULT_RENDERER_TYPES,
  SIDEBAR_METRIC_IDS,
  isSidebarMetricId,
  normalizeDisplayConfig,
  normalizeSidebarConfig,
  normalizeProfile,
  normalizeView,
  validateDisplayConfig,
};
