/**
 * 串口协议预设加载器。
 *
 * 这个目录里每个 `.json` 是一份协议预设：新建传感器时选中它，波特率 / 分帧 / 解码
 * 三段就自动填好，不用再手抄字节。字节结构的说明在同名 `.md` 里，人看的。
 *
 * 预设的 `protocol` 段**不是这里发明的格式** —— 它就是展示系统 manifest 的 `protocol` 段，
 * 定义、归一化和校验全部复用 `displaySystems/displaySystemProtocol.js`，
 * 解析器由 `serialParserManager.createParserFromProtocol()` 直接生成。所以预设里的
 * `protocol` 可以整段复制进 `display-system.json`，中间不需要任何转换层。
 *
 * 打包之后用户不需要重新构建就能加协议：往 `<runtimeWritableRoot>/serial-protocols/`
 * 丢 JSON 即可，同 id 时用户目录覆盖内置（见 `loadSerialProtocolPresets`）。
 */
const fs = require('fs');
const path = require('path');
const {
  normalizeProtocolConfig,
  validateProtocolConfig,
} = require('../../displaySystems/displaySystemProtocol');

/** 内置预设目录，就是本文件所在目录。 */
const BUILTIN_PRESET_DIRECTORY = __dirname;

/** 用户放自定义预设的目录名，挂在 runtimeWritableRoot 下面。 */
const USER_PRESET_DIRECTORY_NAME = 'serial-protocols';

const PRESET_SOURCES = Object.freeze({
  BUILTIN: 'builtin',
  USER: 'user',
});

/**
 * 校验矩阵形状。
 *
 * 允许为空 —— 低密度 72/144 那种协议本身不决定矩阵形状，`matrix` 就是 `null`，
 * 由使用者填。但一旦填了，三个字段必须自洽，否则前端会拿到一个画不出来的形状。
 *
 * @param {object | null | undefined} matrix 矩阵形状。
 * @param {{source: string}} options 错误信息前缀。
 * @returns {string[]} 错误列表。
 */
function validateMatrix(matrix, { source }) {
  if (matrix == null) return [];
  if (typeof matrix !== 'object') return [`${source}: matrix must be an object or null`];

  const errors = [];
  ['width', 'height', 'total'].forEach((key) => {
    if (!Number.isInteger(matrix[key]) || matrix[key] <= 0) {
      errors.push(`${source}: matrix.${key} must be a positive integer`);
    }
  });
  if (!errors.length && matrix.width * matrix.height !== matrix.total) {
    errors.push(`${source}: matrix.total must equal width * height`);
  }
  return errors;
}

/**
 * 校验并归一化一份预设。
 *
 * 归一化后的 `protocol` 用的是 `normalizeProtocolConfig` 的输出形状，字段名与
 * manifest 完全一致，因此调用方可以直接把它写进 `display-system.json`。
 *
 * @param {object} raw 预设文件内容。
 * @param {{source: string}} options 错误信息前缀。
 * @returns {{preset: object | null, errors: string[]}} 归一化结果。
 */
function normalizePreset(raw, { source }) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { preset: null, errors: [`${source}: preset must be a JSON object`] };
  }

  const errors = [];
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) errors.push(`${source}: id is required`);

  const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : id;

  if (raw.channels != null && !Array.isArray(raw.channels)) {
    errors.push(`${source}: channels must be an array`);
  }

  errors.push(...validateMatrix(raw.matrix, { source }));

  // protocol 是必填的 —— 一份不带 protocol 的预设填不了任何东西，
  // 让它静默通过只会让用户选中后什么也没发生。
  if (raw.protocol == null) {
    errors.push(`${source}: protocol is required`);
  } else {
    errors.push(...validateProtocolConfig(raw.protocol, { source }));
  }

  if (errors.length) return { preset: null, errors };

  return {
    preset: {
      id,
      label,
      summary: typeof raw.summary === 'string' ? raw.summary : '',
      doc: typeof raw.doc === 'string' ? raw.doc : '',
      matrix: raw.matrix == null ? null : {
        width: raw.matrix.width,
        height: raw.matrix.height,
        total: raw.matrix.total,
      },
      channels: Array.isArray(raw.channels) ? raw.channels.map((item) => String(item)) : [],
      protocol: normalizeProtocolConfig(raw.protocol),
    },
    errors: [],
  };
}

/**
 * 读取一个目录下的所有 `.json` 预设。
 *
 * 目录不存在不是错误 —— 用户目录默认就不存在。单个文件坏掉也不让整次加载失败，
 * 坏文件带着原因进 `invalid`，好文件照常返回。
 *
 * @param {string} directory 目录路径。
 * @param {string} sourceKind `builtin` 或 `user`。
 * @param {{fileSystem: object}} options 依赖注入，便于测试。
 * @returns {{presets: object[], invalid: object[]}} 读取结果。
 */
function readPresetDirectory(directory, sourceKind, { fileSystem = fs } = {}) {
  const presets = [];
  const invalid = [];

  let entries = [];
  try {
    if (!fileSystem.existsSync(directory)) return { presets, invalid };
    entries = fileSystem.readdirSync(directory);
  } catch (error) {
    invalid.push({
      filePath: directory,
      source: sourceKind,
      errors: [`${directory}: unable to read directory (${error.message})`],
    });
    return { presets, invalid };
  }

  entries
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort()
    .forEach((name) => {
      const filePath = path.join(directory, name);
      let raw = null;
      try {
        raw = JSON.parse(fileSystem.readFileSync(filePath, 'utf8'));
      } catch (error) {
        invalid.push({
          filePath,
          source: sourceKind,
          errors: [`${name}: invalid JSON (${error.message})`],
        });
        return;
      }

      const { preset, errors } = normalizePreset(raw, { source: name });
      if (errors.length) {
        invalid.push({ filePath, source: sourceKind, errors });
        return;
      }
      presets.push({ ...preset, source: sourceKind, filePath });
    });

  return { presets, invalid };
}

/**
 * 加载全部串口协议预设。
 *
 * 内置目录先扫，用户目录后扫，**同 id 后来者覆盖** —— 这样用户可以只改一个波特率
 * 就覆盖掉内置预设，不用动源码，也不用等下一次打包。
 *
 * @param {object} options 加载选项。
 * @param {string[]} options.extraDirectories 额外扫描的目录（通常是用户可写目录）。
 * @param {object} options.fileSystem 文件系统实现，便于测试注入。
 * @returns {{presets: object[], invalid: object[], directories: string[]}} 加载结果。
 */
function loadSerialProtocolPresets({ extraDirectories = [], fileSystem = fs } = {}) {
  const directories = [BUILTIN_PRESET_DIRECTORY, ...extraDirectories.filter(Boolean)];
  const byId = new Map();
  const invalid = [];

  directories.forEach((directory, index) => {
    const sourceKind = index === 0 ? PRESET_SOURCES.BUILTIN : PRESET_SOURCES.USER;
    const result = readPresetDirectory(directory, sourceKind, { fileSystem });
    result.presets.forEach((preset) => {
      const previous = byId.get(preset.id);
      byId.set(preset.id, previous ? { ...preset, overrides: previous.filePath } : preset);
    });
    invalid.push(...result.invalid);
  });

  return {
    presets: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
    invalid,
    directories,
  };
}

/**
 * 按 id 取一份预设。
 * @param {string} id 预设 id。
 * @param {object} options 与 `loadSerialProtocolPresets` 相同。
 * @returns {object | null} 预设，找不到返回 null。
 */
function getSerialProtocolPreset(id, options = {}) {
  const target = String(id || '').trim();
  if (!target) return null;
  return loadSerialProtocolPresets(options).presets.find((preset) => preset.id === target) || null;
}

/**
 * 拼出用户预设目录路径。
 * @param {string} runtimeWritableRoot 可写根目录。
 * @returns {string} 用户预设目录，入参为空时返回空串。
 */
function resolveUserPresetDirectory(runtimeWritableRoot) {
  if (!runtimeWritableRoot) return '';
  return path.join(runtimeWritableRoot, USER_PRESET_DIRECTORY_NAME);
}

module.exports = {
  BUILTIN_PRESET_DIRECTORY,
  PRESET_SOURCES,
  USER_PRESET_DIRECTORY_NAME,
  getSerialProtocolPreset,
  loadSerialProtocolPresets,
  normalizePreset,
  resolveUserPresetDirectory,
};
