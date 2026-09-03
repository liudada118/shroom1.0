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
const {
  loadAlgorithmPackageManifest,
} = require('./displaySystemAlgorithmPackage');

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
  /**
   * 把一个可能为空的路径解析成绝对路径。
   *
   * 相对路径基于 **manifest 所在目录**而不是进程 cwd，否则打包后从不同工作目录启动会解析
   * 到别处。空值返回 null 不抛错（这些文件几乎都是可选的，是否必须存在由 validateFiles 判）。
   *
   * ⚠️ 绝对路径原样放行、**没有目录包含检查** —— 这让多个展示系统能共用一份线序表，但也
   * 意味着 manifest 写绝对路径能指到磁盘任意位置。加沙箱边界时这里是要收口的点之一。
   *
   * @param {string|null|undefined} filePath manifest 里声明的路径。
   * @returns {string|null} 绝对路径；未声明时为 null。
   */
  const resolveMaybe = (filePath) => {
    if (!filePath) return null;
    return path.isAbsolute(filePath) ? filePath : path.resolve(baseDirectory, filePath);
  };

  /**
   * 把单个传感器条目声明的五个文件解析成绝对路径。
   *
   * 固定返回这五个键（缺的填 null）而不是只放存在的键 —— 下游 `Object.entries` 遍历校验和
   * `sensor.resolvedFiles.coordinateMap` 这类直接取值都依赖键一定在。
   *
   * ⚠️ 两个来源层级不同：前三个来自 `sensor.files`，后两个来自 `sensor.algorithm`。
   *
   * @param {{files?: object, algorithm?: object}} sensor 传感器条目（也可以是整份
   *        config —— 顶层兜底那处就是这么用的）。
   * @returns {{lineOrder: string|null, pointOrder: string|null, coordinateMap: string|null,
   *            algorithmData: string|null, algorithmEntry: string|null,
   *            algorithmPackage: string|null}} 绝对路径集合。
   */
  const resolveSensorFiles = (sensor) => ({
    lineOrder: resolveMaybe(sensor.files?.lineOrder),
    pointOrder: resolveMaybe(sensor.files?.pointOrder),
    coordinateMap: resolveMaybe(sensor.files?.coordinateMap),
    algorithmData: resolveMaybe(sensor.algorithm?.dataFile),
    algorithmEntry: resolveMaybe(sensor.algorithm?.entry),
    algorithmPackage: resolveMaybe(sensor.algorithm?.packageManifest),
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

  let config = resolveDisplaySystemFiles(validation.value, path.dirname(manifestPath));
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

  // 算法包 manifest 是代码算法的权威声明：入口相对算法包目录解析，并把 API 版本、
  // 多传感器输入规则和资源表挂到算法绑定。没有 packageManifest 的旧 V1 算法不经过这里。
  const packageErrors = [];
  const hydratedSensors = config.sensors.map((sensor) => {
    const packagePath = sensor.resolvedFiles.algorithmPackage;
    if (!packagePath) return sensor;
    const loadedPackage = loadAlgorithmPackageManifest(packagePath);
    if (!loadedPackage.ok) {
      packageErrors.push(...loadedPackage.errors);
      return sensor;
    }
    const algorithmPackage = loadedPackage.value;
    return {
      ...sensor,
      algorithm: {
        ...sensor.algorithm,
        type: algorithmPackage.language,
        entry: algorithmPackage.resolvedEntry,
        apiVersion: algorithmPackage.apiVersion,
        package: algorithmPackage,
      },
      resolvedFiles: {
        ...sensor.resolvedFiles,
        algorithmEntry: algorithmPackage.resolvedEntry,
      },
    };
  });
  if (packageErrors.length) {
    return { ok: false, config: null, errors: packageErrors, manifestPath };
  }
  const sensorIds = new Set(hydratedSensors.map((sensor) => sensor.id));
  hydratedSensors.forEach((sensor) => {
    const algorithmPackage = sensor.algorithm?.package;
    if (algorithmPackage?.input?.mode !== 'multi-sensor') return;
    algorithmPackage.input.sensors.forEach((sensorId) => {
      if (!sensorIds.has(sensorId)) {
        packageErrors.push(`${algorithmPackage.manifestPath}: input sensor ${sensorId} is not declared by display system ${validation.value.id}`);
      }
    });
    if (algorithmPackage.input.triggerSensor !== sensor.id) {
      packageErrors.push(`${algorithmPackage.manifestPath}: package must be attached to its trigger sensor ${algorithmPackage.input.triggerSensor}`);
    }
  });
  if (packageErrors.length) {
    return { ok: false, config: null, errors: packageErrors, manifestPath };
  }
  config = {
    ...config,
    sensors: hydratedSensors,
    resolvedFiles: hydratedSensors[0]?.resolvedFiles || config.resolvedFiles,
    algorithm: hydratedSensors[0]?.algorithm || config.algorithm,
  };

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

  /**
   * 读入并归一坐标映射文件；没声明就返回 null。
   *
   * ⚠️ **故意不接错误**：文件此前已过存在性校验，这里再读失败说明磁盘/权限出了事，不该被
   * 当成「manifest 有问题」记进 errors 继续跑 —— 让它冒出去比静默产出一个坐标为 null 的
   * 展示系统好定位。同一份文件被多个传感器引用时会重复读盘，只发生在启动和重载，不缓存。
   *
   * @param {string|null} filePath 坐标映射文件绝对路径。
   * @returns {object|null} 归一后的坐标映射；未声明为 null。
   */
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
