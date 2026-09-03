const fs = require('fs');
const path = require('path');

const ALGORITHM_PACKAGE_SCHEMA_VERSION = 1;
const SUPPORTED_ALGORITHM_API_VERSIONS = Object.freeze([1, 2]);
const ALGORITHM_INPUT_MODES = Object.freeze(['single-sensor', 'multi-sensor']);
const ALGORITHM_SYNC_STRATEGIES = Object.freeze(['latest', 'strict']);
const SAFE_ID = /^[A-Za-z][A-Za-z0-9._-]*$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter(isNonEmptyString).map((item) => item.trim()))]
    : [];
}

/**
 * 校验并归一化一个独立的 Python 算法包声明。
 *
 * 算法包与 display-system.json 分开，是为了让同一个算法可以被多个展示系统复用，也让
 * Python API 版本、输入聚合规则、资源和输出指标有一份独立且可冻结的身份证。V1 仍对应
 * `calculate(raw_data, context)`；V2 对应 initialize/process/reset/shutdown 生命周期。
 *
 * @param {*} manifest 原始 algorithm-package.json。
 * @param {{source?: string}} [options] 错误来源。
 * @returns {{ok: boolean, errors: string[], value: object|null}}
 */
function validateAlgorithmPackageManifest(manifest, {
  source = 'algorithm package manifest',
} = {}) {
  if (!isPlainObject(manifest)) {
    return { ok: false, errors: [`${source}: manifest must be an object`], value: null };
  }

  const errors = [];
  const schemaVersion = Number(manifest.schemaVersion || ALGORITHM_PACKAGE_SCHEMA_VERSION);
  const apiVersion = Number(manifest.apiVersion || 1);
  const language = isNonEmptyString(manifest.language) ? manifest.language.trim() : 'python';
  const runtime = isPlainObject(manifest.runtime) ? manifest.runtime : {};
  const input = isPlainObject(manifest.input) ? manifest.input : {};
  const sync = isPlainObject(input.sync) ? input.sync : {};
  const output = isPlainObject(manifest.output) ? manifest.output : {};
  const catalog = isPlainObject(manifest.catalog) ? manifest.catalog : {};
  const resources = isPlainObject(manifest.resources) ? manifest.resources : {};
  const parameters = isPlainObject(manifest.parameters) ? manifest.parameters : {};
  const inputMode = isNonEmptyString(input.mode) ? input.mode.trim() : 'single-sensor';
  const sensors = normalizeStringArray(input.sensors);
  const triggerSensor = isNonEmptyString(input.triggerSensor)
    ? input.triggerSensor.trim()
    : sensors[0] || null;
  const syncStrategy = isNonEmptyString(sync.strategy) ? sync.strategy.trim() : 'latest';
  const maxSkewMs = Number(sync.maxSkewMs ?? 50);
  const maxAgeMs = Number(sync.maxAgeMs ?? 1000);

  if (schemaVersion !== ALGORITHM_PACKAGE_SCHEMA_VERSION) {
    errors.push(`${source}: schemaVersion must be ${ALGORITHM_PACKAGE_SCHEMA_VERSION}`);
  }
  if (!isNonEmptyString(manifest.id) || !SAFE_ID.test(manifest.id.trim())) {
    errors.push(`${source}: id must start with a letter and contain only letters, numbers, dot, underscore or hyphen`);
  }
  if (!isNonEmptyString(manifest.name)) errors.push(`${source}: name is required`);
  if (!isNonEmptyString(manifest.version)) errors.push(`${source}: version is required`);
  if (manifest.description != null && typeof manifest.description !== 'string') {
    errors.push(`${source}: description must be a string`);
  }
  if (manifest.catalog != null && !isPlainObject(manifest.catalog)) {
    errors.push(`${source}: catalog must be an object`);
  }
  if (!SUPPORTED_ALGORITHM_API_VERSIONS.includes(apiVersion)) {
    errors.push(`${source}: apiVersion must be one of ${SUPPORTED_ALGORITHM_API_VERSIONS.join(', ')}`);
  }
  if (language !== 'python') errors.push(`${source}: language must be python`);
  if (!isNonEmptyString(manifest.entry) || !manifest.entry.trim().toLowerCase().endsWith('.py')) {
    errors.push(`${source}: entry must reference a .py file`);
  }
  if (!ALGORITHM_INPUT_MODES.includes(inputMode)) {
    errors.push(`${source}: input.mode must be one of ${ALGORITHM_INPUT_MODES.join(', ')}`);
  }
  if (inputMode === 'multi-sensor') {
    if (apiVersion !== 2) errors.push(`${source}: multi-sensor input requires apiVersion 2`);
    if (sensors.length < 2) errors.push(`${source}: input.sensors must contain at least two sensor ids`);
    if (!triggerSensor || !sensors.includes(triggerSensor)) {
      errors.push(`${source}: input.triggerSensor must reference input.sensors`);
    }
  }
  if (!ALGORITHM_SYNC_STRATEGIES.includes(syncStrategy)) {
    errors.push(`${source}: input.sync.strategy must be one of ${ALGORITHM_SYNC_STRATEGIES.join(', ')}`);
  }
  if (!Number.isFinite(maxSkewMs) || maxSkewMs < 0) {
    errors.push(`${source}: input.sync.maxSkewMs must be a non-negative number`);
  }
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    errors.push(`${source}: input.sync.maxAgeMs must be a positive number`);
  }
  if (runtime.python != null && runtime.python !== '3.11') {
    errors.push(`${source}: runtime.python must be 3.11`);
  }
  if (runtime.profile != null && !isNonEmptyString(runtime.profile)) {
    errors.push(`${source}: runtime.profile must be a non-empty string`);
  }

  Object.entries(resources).forEach(([id, resourcePath]) => {
    if (!SAFE_ID.test(id)) errors.push(`${source}: resources key ${id} is invalid`);
    if (!isNonEmptyString(resourcePath)) errors.push(`${source}: resources.${id} must be a non-empty string`);
  });
  const metricIds = normalizeStringArray(output.metrics);
  if (output.metrics != null && !Array.isArray(output.metrics)) {
    errors.push(`${source}: output.metrics must be an array`);
  }
  metricIds.forEach((id) => {
    if (!SAFE_ID.test(id)) errors.push(`${source}: output metric id ${id} is invalid`);
  });
  const metricDefinitions = Array.isArray(output.metricDefinitions)
    ? output.metricDefinitions
    : [];
  if (output.metricDefinitions != null && !Array.isArray(output.metricDefinitions)) {
    errors.push(`${source}: output.metricDefinitions must be an array`);
  }
  const metricDefinitionIds = new Set();
  metricDefinitions.forEach((definition, index) => {
    if (!isPlainObject(definition)) {
      errors.push(`${source}: output.metricDefinitions[${index}] must be an object`);
      return;
    }
    if (!isNonEmptyString(definition.id) || !SAFE_ID.test(definition.id.trim())) {
      errors.push(`${source}: output.metricDefinitions[${index}].id is invalid`);
      return;
    }
    const id = definition.id.trim();
    if (metricDefinitionIds.has(id)) {
      errors.push(`${source}: duplicate output metric definition id ${id}`);
    }
    metricDefinitionIds.add(id);
    if (!metricIds.includes(id)) {
      errors.push(`${source}: output metric definition ${id} must reference output.metrics`);
    }
    if (definition.decimals != null && (
      !Number.isInteger(definition.decimals)
      || definition.decimals < 0
      || definition.decimals > 6
    )) {
      errors.push(`${source}: output.metricDefinitions[${index}].decimals must be an integer from 0 to 6`);
    }
    if (definition.panel != null && !['pressure', 'area', 'both', 'none'].includes(definition.panel)) {
      errors.push(`${source}: output.metricDefinitions[${index}].panel is invalid`);
    }
  });
  if (catalog.category != null && !isNonEmptyString(catalog.category)) {
    errors.push(`${source}: catalog.category must be a non-empty string`);
  }
  if (catalog.tags != null && !Array.isArray(catalog.tags)) {
    errors.push(`${source}: catalog.tags must be an array`);
  }
  if (catalog.compatibility != null && !isPlainObject(catalog.compatibility)) {
    errors.push(`${source}: catalog.compatibility must be an object`);
  }
  if (catalog.sampleRateHz != null && (
    !Number.isFinite(Number(catalog.sampleRateHz))
    || Number(catalog.sampleRateHz) <= 0
  )) {
    errors.push(`${source}: catalog.sampleRateHz must be a positive number`);
  }

  if (errors.length) return { ok: false, errors, value: null };
  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion,
      id: manifest.id.trim(),
      name: manifest.name.trim(),
      version: manifest.version.trim(),
      description: String(manifest.description || '').trim(),
      apiVersion,
      language,
      entry: manifest.entry.trim(),
      runtime: {
        python: runtime.python || '3.11',
        profile: runtime.profile || 'bundled-v1',
      },
      input: {
        mode: inputMode,
        sensors,
        triggerSensor,
        sync: {
          strategy: syncStrategy,
          maxSkewMs,
          maxAgeMs,
        },
      },
      parameters: { ...parameters },
      resources: { ...resources },
      output: {
        ...output,
        metrics: metricIds,
        metricDefinitions: metricDefinitions.map((definition) => ({
          id: definition.id.trim(),
          label: String(definition.label || definition.id).trim(),
          unit: String(definition.unit || '').trim(),
          decimals: Number.isInteger(definition.decimals) ? definition.decimals : 2,
          panel: ['pressure', 'area', 'both', 'none'].includes(definition.panel)
            ? definition.panel
            : 'none',
        })),
      },
      catalog: {
        ...catalog,
        category: String(catalog.category || 'general').trim(),
        tags: normalizeStringArray(catalog.tags),
        compatibility: isPlainObject(catalog.compatibility) ? { ...catalog.compatibility } : {},
        sampleRateHz: catalog.sampleRateHz == null ? null : Number(catalog.sampleRateHz),
        singleton: catalog.singleton === true,
        attachable: catalog.attachable !== false,
      },
    },
  };
}

function resolvePackagePath(packageDirectory, relativePath, label) {
  if (!isNonEmptyString(relativePath)) return null;
  if (path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be relative to the algorithm package directory`);
  }
  const resolved = path.resolve(packageDirectory, relativePath);
  const relative = path.relative(packageDirectory, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the algorithm package directory`);
  }
  return resolved;
}

/** 读取、校验并解析算法包内的入口和资源路径。 */
function loadAlgorithmPackageManifest(manifestPath, { fsLike = fs } = {}) {
  let raw;
  try {
    raw = JSON.parse(fsLike.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return { ok: false, errors: [`${manifestPath}: ${error.message}`], value: null };
  }
  const validation = validateAlgorithmPackageManifest(raw, { source: manifestPath });
  if (!validation.ok) return validation;

  try {
    const packageDirectory = path.dirname(manifestPath);
    const entry = resolvePackagePath(packageDirectory, validation.value.entry, 'entry');
    const resources = Object.fromEntries(Object.entries(validation.value.resources).map(([id, value]) => (
      [id, resolvePackagePath(packageDirectory, value, `resources.${id}`)]
    )));
    const missing = [entry, ...Object.values(resources)].filter((item) => !fsLike.existsSync(item));
    if (missing.length) {
      return {
        ok: false,
        errors: missing.map((item) => `${manifestPath}: algorithm package file not found: ${item}`),
        value: null,
      };
    }
    return {
      ok: true,
      errors: [],
      value: {
        ...validation.value,
        manifestPath,
        packageDirectory,
        resolvedEntry: entry,
        resolvedResources: resources,
      },
    };
  } catch (error) {
    return { ok: false, errors: [`${manifestPath}: ${error.message}`], value: null };
  }
}

module.exports = {
  ALGORITHM_INPUT_MODES,
  ALGORITHM_PACKAGE_SCHEMA_VERSION,
  ALGORITHM_SYNC_STRATEGIES,
  SUPPORTED_ALGORITHM_API_VERSIONS,
  loadAlgorithmPackageManifest,
  validateAlgorithmPackageManifest,
};
