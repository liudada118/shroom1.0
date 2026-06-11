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

  getRendererKey(key, mode) {
    const system = this.get(key);
    if (!system) {
      return null;
    }
    return system.renderers?.[mode] || system.renderers?.[system.defaultMode] || null;
  }
}
