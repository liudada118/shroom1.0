export function createDisplaySystem(config = {}) {
  if (!config.key) {
    throw new Error('display system key is required');
  }
  return {
    label: config.key,
    channels: ['sit'],
    defaultMode: 'normal',
    modes: ['normal'],
    renderers: {},
    controls: {},
    data: {},
    ...config,
  };
}

/**
 * manifest 里 `views[].type` 没写 `renderer` 时的兜底渲染器名。
 *
 * `matrix` / `raw2d` 两条原本填的是组件名 `'Num2D'` / `'Num2DOriginal'`，那两个
 * 组件已经参数化成 `numMatrix` 渲染器的 `webgl` 后端并删除，字符串成了死引用。
 * 现在改填**注册表 id**（`core/registry.js` 的 `numMatrix`），两条走的是同一个
 * 渲染器、只差 `params` —— 具体是数字矩阵还是原始数据，由 manifest 自己在
 * `renderers[].params` 里选预设（`webglNum*` / `webglRaw*`），不是靠这里区分。
 *
 * 其余四条仍是组件名，因为对应的展示形式还没做成渲染器。
 */
const VIEW_RENDERERS = Object.freeze({
  heatmap: 'Heatmap',
  matrix: 'numMatrix',
  raw2d: 'numMatrix',
  model: 'Model',
  lineChart: 'LineChart',
  pressureStats: 'PressureStats',
});

function normalizeManifestViews(display = {}) {
  return (Array.isArray(display.views) ? display.views : []).map((view) => (
    typeof view === 'string'
      ? { id: view, type: view, label: view, source: 'data' }
      : { ...view }
  ));
}

export function createDisplaySystemFromManifest(manifest = {}) {
  const runtimeMetadata = manifest.runtimeDefinition?.displayMetadata || manifest.displayMetadata || {};
  const display = manifest.display || runtimeMetadata;
  const views = normalizeManifestViews(display);
  const key = manifest.sensor?.type || runtimeMetadata.sensorType || manifest.id || runtimeMetadata.id;
  const defaultMode = display.defaultView || views[0]?.id || views[0]?.type || 'heatmap';
  const renderers = Object.fromEntries(views.map((view) => [
    view.id || view.type,
    view.renderer || VIEW_RENDERERS[view.type] || view.type,
  ]));

  return createDisplaySystem({
    key,
    displaySystemId: manifest.id || runtimeMetadata.id || key,
    label: manifest.name || runtimeMetadata.name || key,
    channels: manifest.sensor?.ports || runtimeMetadata.channels || ['sit'],
    defaultMode,
    modes: views.map((view) => view.id || view.type),
    renderers,
    rendererOptions: display.renderers || [],
    visualizationAlgorithms: display.visualizationAlgorithms || [],
    profiles: display.profiles || [],
    defaultProfile: display.defaultProfile || display.profiles?.[0]?.id || null,
    controls: display.controls || {},
    sidebar: display.sidebar || null,
    matrix: runtimeMetadata.matrix || manifest.sensor?.matrix || null,
    coordinateMap: runtimeMetadata.coordinateMap || manifest.coordinateMap || null,
    page: {
      layout: display.layout || { type: 'grid', columns: 12 },
      widgets: display.widgets || views,
      views,
      sidebar: display.sidebar || null,
      renderers: display.renderers || [],
      visualizationAlgorithms: display.visualizationAlgorithms || [],
      profiles: display.profiles || [],
      defaultProfile: display.defaultProfile || null,
    },
    protocol: manifest.protocol || runtimeMetadata.protocol || null,
    algorithm: manifest.algorithm || { type: runtimeMetadata.algorithmType || 'none' },
    source: 'manifest',
  });
}

export class DisplayRegistry {
  constructor(displaySystems = []) {
    this.systems = new Map();
    displaySystems.forEach((system) => this.register(system));
  }

  register(config) {
    const system = createDisplaySystem(config);
    this.systems.set(system.key, system);
    return system;
  }

  registerManifest(manifest) {
    return this.register(createDisplaySystemFromManifest(manifest));
  }

  registerManifests(manifests = []) {
    return manifests.map((manifest) => this.registerManifest(manifest));
  }

  get(key) {
    return this.systems.get(key) || null;
  }

  has(key) {
    return this.systems.has(key);
  }

  list() {
    return [...this.systems.values()];
  }

  getModes(key) {
    return this.get(key)?.modes || [];
  }

  getDefaultMode(key) {
    return this.get(key)?.defaultMode || 'normal';
  }

  getProfiles(key) {
    return this.get(key)?.profiles || [];
  }

  getProfile(key, profileId) {
    const system = this.get(key);
    if (!system) return null;
    const targetId = profileId || system.defaultProfile;
    return system.profiles?.find((profile) => profile.id === targetId) || null;
  }

  getRendererKey(key, mode) {
    const system = this.get(key);
    if (!system) {
      return null;
    }
    return system.renderers?.[mode] || system.renderers?.[system.defaultMode] || null;
  }
}
