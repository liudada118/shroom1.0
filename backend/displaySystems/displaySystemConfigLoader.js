const fs = require('fs');
const path = require('path');
const {
  validateDisplaySystemConfig,
} = require('./displaySystemConfigValidator');
const {
  validateDisplaySystemDefinitionFiles,
} = require('./displaySystemConfigFileValidator');
const {
  normalizeCoordinateMapDefinition,
} = require('./displaySystemCoordinateMap');

const DEFAULT_MANIFEST_FILENAMES = Object.freeze([
  'display-system.json',
  'system.json',
]);

/**
 * 读取 JSON 文件。
 *
 * @param {string} filePath JSON 文件路径。
 * @returns {object} JSON 对象。
 */
function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * 查找展示系统目录中的 manifest 文件。
 *
 * @param {string} directory 展示系统目录。
 * @param {string[]} manifestFilenames 可接受的 manifest 文件名。
 * @returns {string | null} manifest 文件路径。
 */
function findManifestFile(directory, manifestFilenames = DEFAULT_MANIFEST_FILENAMES) {
  for (const filename of manifestFilenames) {
    const candidate = path.join(directory, filename);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

/**
 * 把 manifest 中的相对文件路径解析成绝对路径。
 *
 * @param {object} config 已校验配置。
 * @param {string} baseDirectory manifest 所在目录。
 * @returns {object} 带 resolvedFiles 的配置。
 */
function resolveDisplaySystemFiles(config, baseDirectory) {
  const resolveMaybe = (filePath) => {
    if (!filePath) return null;
    return path.isAbsolute(filePath) ? filePath : path.resolve(baseDirectory, filePath);
  };

  const resolveSensorFiles = (sensor) => ({
    lineOrder: resolveMaybe(sensor.files?.lineOrder),
    pointOrder: resolveMaybe(sensor.files?.pointOrder),
    coordinateMap: resolveMaybe(sensor.files?.coordinateMap),
    algorithmData: resolveMaybe(sensor.algorithm?.dataFile),
    algorithmEntry: resolveMaybe(sensor.algorithm?.entry),
  });

  // 每个传感器条目自带一套线序/点位/算法文件，各自解析成绝对路径。
  const sensors = (config.sensors || []).map((sensor) => ({
    ...sensor,
    resolvedFiles: resolveSensorFiles(sensor),
  }));

  return {
    ...config,
    sensors,
    // 顶层 resolvedFiles 保持指向第一个传感器，既有调用方无需改动。
    resolvedFiles: sensors[0]?.resolvedFiles || resolveSensorFiles(config),
  };
}

/**
 * 加载单个展示系统目录。
 *
 * @param {string} directory 展示系统目录。
 * @param {object} options 加载选项。
 * @param {boolean} [options.validateFiles] 是否校验引用文件存在。
 * @param {string[]} [options.manifestFilenames] manifest 文件名候选。
 * @returns {{ ok: boolean, config: object | null, errors: string[], manifestPath: string | null }} 加载结果。
 */
function loadDisplaySystemDirectory(directory, {
  validateFiles = true,
  manifestFilenames = DEFAULT_MANIFEST_FILENAMES,
} = {}) {
  const manifestPath = findManifestFile(directory, manifestFilenames);
  if (!manifestPath) {
    return {
      ok: false,
      config: null,
      errors: [`${directory}: display system manifest not found`],
      manifestPath: null,
    };
  }

  let rawConfig;
  try {
    rawConfig = readJsonFile(manifestPath);
  } catch (error) {
    return {
      ok: false,
      config: null,
      errors: [`${manifestPath}: ${error.message}`],
      manifestPath,
    };
  }

  const validation = validateDisplaySystemConfig(rawConfig, { source: manifestPath });
  if (!validation.ok) {
    return {
      ok: false,
      config: null,
      errors: validation.errors,
      manifestPath,
    };
  }

  const config = resolveDisplaySystemFiles(validation.value, path.dirname(manifestPath));
  const missingFiles = [];
  if (validateFiles) {
    config.sensors.forEach((sensor) => {
      for (const [key, filePath] of Object.entries(sensor.resolvedFiles)) {
        if (filePath && !fs.existsSync(filePath)) {
          missingFiles.push(`${manifestPath}: ${key} file not found: ${filePath}`);
        }
      }
    });
  }

  if (missingFiles.length > 0) {
    return {
      ok: false,
      config: null,
      errors: missingFiles,
      manifestPath,
    };
  }

  if (validateFiles) {
    // 逐传感器校验：每个条目的矩阵尺寸要和它自己的 point-order / coordinate-map 对齐，
    // 不能拿第一个传感器的矩阵去校验第二个传感器的文件。
    const definitionErrors = config.sensors.flatMap((sensor) => (
      validateDisplaySystemDefinitionFiles({
        sensor,
        resolvedFiles: sensor.resolvedFiles,
      }, { readJsonFile }).errors
    ));
    if (definitionErrors.length > 0) {
      return {
        ok: false,
        config: null,
        errors: definitionErrors,
        manifestPath,
      };
    }
  }

  const loadCoordinateMap = (filePath) => (filePath
    ? normalizeCoordinateMapDefinition(readJsonFile(filePath))
    : null);

  return {
    ok: true,
    config: {
      ...config,
      sensors: config.sensors.map((sensor) => ({
        ...sensor,
        coordinateMap: loadCoordinateMap(sensor.resolvedFiles.coordinateMap),
      })),
      coordinateMap: loadCoordinateMap(config.resolvedFiles.coordinateMap),
      sourceDirectory: directory,
      manifestPath,
    },
    errors: [],
    manifestPath,
  };
}

/**
 * 扫描多个展示系统根目录。
 *
 * 每个根目录可以直接放 manifest，也可以包含多个子目录，每个子目录一个 manifest。
 *
 * @param {string[]} roots 展示系统根目录列表。
 * @param {object} options 扫描选项。
 * @param {object} [options.logger] 日志对象。
 * @param {boolean} [options.validateFiles] 是否校验引用文件存在。
 * @returns {{ configs: object[], errors: string[] }} 扫描结果。
 */
function discoverDisplaySystems(roots = [], {
  logger,
  validateFiles = true,
} = {}) {
  const configs = [];
  const errors = [];

  roots.filter(Boolean).forEach((root) => {
    if (!fs.existsSync(root)) return;
    if (!fs.statSync(root).isDirectory()) return;

    const direct = loadDisplaySystemDirectory(root, { validateFiles });
    if (direct.ok) {
      configs.push(direct.config);
      return;
    }

    const entries = fs.readdirSync(root, { withFileTypes: true });
    entries
      .filter((entry) => entry.isDirectory())
      .forEach((entry) => {
        const directory = path.join(root, entry.name);
        const result = loadDisplaySystemDirectory(directory, { validateFiles });
        if (result.ok) {
          configs.push(result.config);
        } else if (result.manifestPath) {
          errors.push(...result.errors);
        }
      });
  });

  if (errors.length > 0) {
    logger?.warn?.('[DisplaySystems] config load errors', errors);
  }

  return {
    configs,
    errors,
  };
}

module.exports = {
  DEFAULT_MANIFEST_FILENAMES,
  discoverDisplaySystems,
  findManifestFile,
  loadDisplaySystemDirectory,
  resolveDisplaySystemFiles,
};
