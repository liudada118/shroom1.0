const fs = require('fs');
const path = require('path');
const {
  validateDisplaySystemConfig,
} = require('./displaySystemConfigValidator');

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

  const resolvedFiles = {
    lineOrder: resolveMaybe(config.files.lineOrder),
    pointOrder: resolveMaybe(config.files.pointOrder),
    algorithmData: resolveMaybe(config.algorithm.dataFile),
    algorithmEntry: resolveMaybe(config.algorithm.entry),
  };

  return {
    ...config,
    resolvedFiles,
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
    for (const [key, filePath] of Object.entries(config.resolvedFiles)) {
      if (filePath && !fs.existsSync(filePath)) {
        missingFiles.push(`${manifestPath}: ${key} file not found: ${filePath}`);
      }
    }
  }

  if (missingFiles.length > 0) {
    return {
      ok: false,
      config: null,
      errors: missingFiles,
      manifestPath,
    };
  }

  return {
    ok: true,
    config: {
      ...config,
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
