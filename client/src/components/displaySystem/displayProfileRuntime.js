const DATA_RENDERER_TYPES = new Set(['heatmap', 'matrix', 'raw2d']);

function toNumericValues(values = []) {
  return values.map((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  });
}

function smoothValues(values, matrix, radius = 1) {
  const cols = Math.max(1, Number(matrix?.width || matrix?.cols || Math.sqrt(values.length) || 1));
  const rows = Math.max(1, Number(matrix?.height || matrix?.rows || Math.ceil(values.length / cols)));
  const safeRadius = Math.max(1, Math.min(4, Number(radius) || 1));
  return values.map((_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    let total = 0;
    let count = 0;
    for (let rowOffset = -safeRadius; rowOffset <= safeRadius; rowOffset += 1) {
      for (let colOffset = -safeRadius; colOffset <= safeRadius; colOffset += 1) {
        const nextRow = row + rowOffset;
        const nextCol = col + colOffset;
        const nextIndex = nextRow * cols + nextCol;
        if (nextRow >= 0 && nextRow < rows && nextCol >= 0 && nextCol < cols && nextIndex < values.length) {
          total += values[nextIndex];
          count += 1;
        }
      }
    }
    return count ? total / count : values[index];
  });
}

export function applyVisualizationAlgorithm(values = [], algorithm = {}, matrix = {}) {
  const numeric = toNumericValues(values);
  const type = algorithm?.type || algorithm?.id || 'identity';
  const options = algorithm?.options || {};

  if (type === 'normalize') {
    const targetMax = Number(options.max || 100);
    const currentMax = Math.max(0, ...numeric);
    return currentMax > 0 ? numeric.map((value) => (value / currentMax) * targetMax) : numeric;
  }
  if (type === 'threshold') {
    const threshold = Number(options.threshold || 0);
    return numeric.map((value) => (value >= threshold ? value : 0));
  }
  if (type === 'smooth') {
    return smoothValues(numeric, matrix, options.radius);
  }
  return numeric;
}

export function calculatePressureMetrics(values = [], sidebar = {}) {
  const numeric = toNumericValues(values);
  const threshold = Math.max(0, Number(sidebar?.area?.threshold) || 0);
  const pointArea = Math.max(0, Number(sidebar?.area?.pointArea) || 0);
  const totalPressure = numeric.reduce((sum, value) => sum + value, 0);
  const activePoints = numeric.filter((value) => value > threshold).length;
  return {
    totalPressure,
    maxPressure: numeric.length ? Math.max(...numeric) : 0,
    averagePressure: activePoints ? totalPressure / activePoints : 0,
    activePoints,
    area: activePoints * pointArea,
  };
}

function normalizeCatalog(items = [], fallback = []) {
  const source = Array.isArray(items) && items.length ? items : fallback;
  return source.map((item) => (
    typeof item === 'string'
      ? { id: item, type: item, label: item, options: {} }
      : { options: {}, ...item }
  ));
}

export function buildDisplayProfileModel(page = {}) {
  const widgets = Array.isArray(page.widgets) ? page.widgets : [];
  const viewTypes = (Array.isArray(page.views) ? page.views : [])
    .map((view) => view.type)
    .filter((type, index, values) => DATA_RENDERER_TYPES.has(type) && values.indexOf(type) === index);
  const renderers = normalizeCatalog(page.renderers, (viewTypes.length ? viewTypes : ['heatmap']).map((type) => ({
    id: type,
    type,
    label: type,
  })));
  const visualizationAlgorithms = normalizeCatalog(page.visualizationAlgorithms, [{
    id: 'identity',
    type: 'identity',
    label: '原始数据',
  }]);
  const profiles = Array.isArray(page.profiles) && page.profiles.length
    ? page.profiles
    : [{
      id: 'default',
      label: '默认方案',
      renderer: renderers[0]?.id,
      visualizationAlgorithm: visualizationAlgorithms[0]?.id,
      widgets: widgets.map((widget) => widget.id),
    }];
  const defaultProfile = profiles.some((profile) => profile.id === page.defaultProfile)
    ? page.defaultProfile
    : profiles[0]?.id;
  return { widgets, renderers, visualizationAlgorithms, profiles, defaultProfile };
}

export function resolveDisplayProfile(model, selection = {}) {
  const profile = model.profiles.find((item) => item.id === selection.profileId)
    || model.profiles.find((item) => item.id === model.defaultProfile)
    || model.profiles[0]
    || {};
  const rendererId = model.renderers.some((item) => item.id === selection.rendererId)
    ? selection.rendererId
    : profile.renderer || model.renderers[0]?.id;
  const algorithmId = model.visualizationAlgorithms.some((item) => item.id === selection.algorithmId)
    ? selection.algorithmId
    : profile.visualizationAlgorithm || model.visualizationAlgorithms[0]?.id;
  const renderer = model.renderers.find((item) => item.id === rendererId) || model.renderers[0];
  const algorithm = model.visualizationAlgorithms.find((item) => item.id === algorithmId)
    || model.visualizationAlgorithms[0];
  const visibleWidgetIds = new Set(
    Array.isArray(profile.widgets) && profile.widgets.length
      ? profile.widgets
      : model.widgets.map((widget) => widget.id)
  );
  return {
    profile,
    profileId: profile.id,
    renderer,
    rendererId: renderer?.id,
    algorithm,
    algorithmId: algorithm?.id,
    visibleWidgetIds,
  };
}

export function isDataRendererType(type) {
  return DATA_RENDERER_TYPES.has(type);
}
