const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { loadDisplaySystemDirectory } = require('../manifest/displaySystemConfigLoader');
const { realtimePackage } = require('../../agent-runtime/algorithm-lab/realtimeCatalog');
const { validateNativeConfiguration } = require('./builtinSystemConfiguration');
const { validateBuiltinTemplate } = require('./builtinSystemTemplates');

const MAX_PACKAGE_BYTES = 16 * 1024 * 1024;
const MAX_FILES = 128;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

/** 返回带稳定错误码的包校验错误。 */
function packageError(code, message) { return Object.assign(new Error(message), { code }); }

/** 将包内路径限制为普通相对文件，拒绝磁盘根、父目录和 Windows 特殊路径。 */
function safePath(value) {
  if (typeof value !== 'string' || !value || value.length > 240 || value.includes('\\') || value.includes(':') || value.includes('\0')
    || path.posix.isAbsolute(value) || value.split('/').some((part) => !part || part === '.' || part === '..'
      || /[\x00-\x1f<>"|?*]/.test(part) || /[. ]$/.test(part)
      || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(part))) {
    throw packageError('SYSTEM_PACKAGE_PATH_INVALID', '系统包包含无效文件路径');
  }
  return value;
}

/** 读取原系统目录内的普通文件，不能把任意绝对路径或软链接带进交付包。 */
function readLocalFile(root, absolute) {
  const relative = path.relative(root, absolute).replaceAll('\\', '/');
  safePath(relative);
  const parts = relative.split('/');
  let cursor = root;
  for (const part of parts.slice(0, -1)) {
    cursor = path.join(cursor, part);
    if (fs.lstatSync(cursor).isSymbolicLink()) throw packageError('SYSTEM_PACKAGE_FILE_INVALID', '系统包不能包含软链接目录');
  }
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw packageError('SYSTEM_PACKAGE_FILE_INVALID', '系统包只能包含普通文件');
  return { path: relative, data: fs.readFileSync(absolute) };
}

/** Include only tested, saved restricted classifiers referenced by this configuration. */
function collectAlgorithmDrafts(systemId, configuration, installedAlgorithmRoot) {
  const algorithms = [];
  for (const binding of configuration?.algorithms || []) {
    if (!binding.packageId?.startsWith('user-')) continue;
    if (!installedAlgorithmRoot) throw packageError('SYSTEM_PACKAGE_ALGORITHM_MISSING', '系统已绑定用户算法，但无法读取保存版本');
    const id = binding.packageId.slice(5);
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(id)) throw packageError('SYSTEM_PACKAGE_ALGORITHM_INVALID', '算法包 ID 无效');
    const filename = path.join(installedAlgorithmRoot, `${id}.json`);
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.size > 4000000) throw packageError('SYSTEM_PACKAGE_ALGORITHM_INVALID', '算法包文件无效');
    const draft = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (draft.id !== id || draft.systemId !== systemId || !realtimePackage(draft)) throw packageError('SYSTEM_PACKAGE_ALGORITHM_INVALID', '算法包所属系统或输入契约无效');
    algorithms.push(draft);
  }
  return algorithms;
}

/** 按系统实际引用构建可审阅的 Manifest 插件包；不扫描用户数据目录。 */
function exportManifestPackage(system, { bindings = null, installedAlgorithmRoot = null } = {}) {
  if (!system?.manifestPath || !SAFE_ID.test(system.id || '') || system.editable !== true) {
    throw packageError('SYSTEM_PACKAGE_SOURCE_INVALID', '请选择用户创建的 Manifest 展示系统');
  }
  const root = path.resolve(path.dirname(system.manifestPath));
  const manifest = JSON.parse(fs.readFileSync(system.manifestPath, 'utf8'));
  if (/"agent(?:-chart)?:[a-z0-9-]+(?:[:\"])/.test(JSON.stringify(manifest.display || {}))) {
    throw packageError('SYSTEM_PACKAGE_UNSUPPORTED_DEPENDENCY', '系统引用了 Agent 自定义渲染器或图表，当前交付包尚不能携带该应用资源');
  }
  const paths = new Set([system.manifestPath]);
  for (const sensor of system.sensors || []) {
    for (const file of Object.values(sensor.resolvedFiles || {})) if (file) paths.add(file);
    const packageManifest = sensor.resolvedFiles?.algorithmPackage;
    if (packageManifest) {
      const definition = JSON.parse(fs.readFileSync(packageManifest, 'utf8'));
      if (definition.entry) paths.add(path.resolve(path.dirname(packageManifest), safePath(definition.entry)));
    }
  }
  if (paths.size > MAX_FILES) throw packageError('SYSTEM_PACKAGE_TOO_LARGE', '系统包文件过多');
  const files = [...paths].map((file) => readLocalFile(root, path.resolve(file)))
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(({ path: name, data }) => ({ path: name, size: data.length,
      sha256: createHash('sha256').update(data).digest('hex'), contentBase64: data.toString('base64') }));
  if (files.some((file) => !file.path.endsWith('.json'))) {
    throw packageError('SYSTEM_PACKAGE_UNSUPPORTED_DEPENDENCY', '系统引用了外部算法或资源文件，当前交付包仅支持 JSON 配置及受限分类算法');
  }
  const algorithms = collectAlgorithmDrafts(system.id, bindings?.configuration, installedAlgorithmRoot);
  const payload = { schemaVersion: 1, kind: 'manifest', systemId: system.id, files,
    bindings: bindings?.configuration || null, algorithms };
  const bytes = Buffer.byteLength(JSON.stringify(payload));
  if (bytes > MAX_PACKAGE_BYTES) throw packageError('SYSTEM_PACKAGE_TOO_LARGE', '系统包超过 16 MiB');
  return { ...payload, sha256: createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
}

/** Export an editable native template copy without copying the built-in renderer or protocol code. */
function exportNativePackage(system, { installedAlgorithmRoot = null } = {}) {
  if (system?.kind !== 'builtin-template' || system.editable !== true) {
    throw packageError('SYSTEM_PACKAGE_SOURCE_INVALID', '请选择用户创建的原生模板副本');
  }
  const template = { ...validateBuiltinTemplate(system.builtinTemplate), configuration: system.configuration };
  const checked = validateNativeConfiguration(template.configuration, { sourceType: template.sourceType, systemId: template.id, validatePackages: false });
  const algorithms = collectAlgorithmDrafts(template.id, checked, installedAlgorithmRoot);
  const payload = { schemaVersion: 1, kind: 'native-template', systemId: template.id,
    template: { ...template, configuration: checked }, algorithms };
  if (Buffer.byteLength(JSON.stringify(payload)) > MAX_PACKAGE_BYTES) throw packageError('SYSTEM_PACKAGE_TOO_LARGE', '系统包超过 16 MiB');
  return { ...payload, sha256: createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
}

/** Atomically replace one managed native declaration after checking its built-in source and algorithms. */
function installNativePackage(input, { managedRoot, version = null, isOccupied = () => false,
  isAlgorithmOccupied = () => false, listPackages = () => [] } = {}) {
  if (!managedRoot || input?.schemaVersion !== 1 || input.kind !== 'native-template' || !SAFE_ID.test(input.systemId || '')
    || !Array.isArray(input.algorithms) || input.algorithms.length > 8) throw packageError('SYSTEM_PACKAGE_INVALID', '原生系统包格式无效');
  const { sha256, ...payload } = input;
  if (createHash('sha256').update(JSON.stringify(payload)).digest('hex') !== sha256
    || Buffer.byteLength(JSON.stringify(input)) > MAX_PACKAGE_BYTES) throw packageError('SYSTEM_PACKAGE_INTEGRITY', '系统包完整性校验失败');
  const declaration = validateBuiltinTemplate({ id: input.template?.id, name: input.template?.name, sourceType: input.template?.sourceType });
  if (declaration.id !== input.systemId || isOccupied(input.systemId)) throw packageError('SYSTEM_PACKAGE_CONFLICT', '原生系统 ID 与现有系统冲突');
  const algorithmIds = new Set();
  for (const draft of input.algorithms) {
    if (draft?.systemId !== input.systemId || !realtimePackage(draft) || algorithmIds.has(draft.id)
      || isAlgorithmOccupied(draft.id, input.systemId)) throw packageError('SYSTEM_PACKAGE_ALGORITHM_INVALID', '原生系统算法包无效或冲突');
    algorithmIds.add(draft.id);
  }
  const configuration = validateNativeConfiguration(input.template.configuration, { sourceType: declaration.sourceType, systemId: declaration.id,
    packages: [...input.algorithms.map((draft) => realtimePackage(draft)), ...listPackages()] });
  const root = path.resolve(managedRoot), target = path.join(root, `${declaration.id}.json`);
  const temporary = path.join(root, `.${randomUUID()}.tmp`), backup = path.join(root, `.${randomUUID()}.backup`);
  fs.mkdirSync(root, { recursive: true });
  let moved = false;
  try {
    fs.writeFileSync(temporary, JSON.stringify({ ...declaration, configuration, packageAlgorithms: input.algorithms,
      managedPackage: { sha256, systemId: input.systemId, version } }), { flag: 'wx' });
    if (fs.existsSync(target)) { fs.renameSync(target, backup); moved = true; }
    fs.renameSync(temporary, target);
    if (moved) { try { fs.rmSync(backup, { force: true }); } catch { /* Stale backup is harmless. */ } }
    return { systemId: input.systemId, directory: root, sha256 };
  } catch (error) {
    if (moved && !fs.existsSync(target) && fs.existsSync(backup)) fs.renameSync(backup, target);
    throw error;
  } finally { if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true }); }
}

/** 在独立临时目录校验包内完整配置，再原子切换版本；失败保留现有系统。 */
function installManifestPackage(input, { managedRoot, version = null, isOccupied = () => false,
  isAlgorithmOccupied = () => false, isSensorTypeOccupied = () => false, listPackages = () => [] } = {}) {
  if (!managedRoot || !input || input.schemaVersion !== 1 || input.kind !== 'manifest' || !SAFE_ID.test(input.systemId || '')
    || !Array.isArray(input.files) || input.files.length < 1 || input.files.length > MAX_FILES) {
    throw packageError('SYSTEM_PACKAGE_INVALID', '系统包格式不正确');
  }
  const { sha256, ...payload } = input;
  if (createHash('sha256').update(JSON.stringify(payload)).digest('hex') !== sha256
    || Buffer.byteLength(JSON.stringify(input)) > MAX_PACKAGE_BYTES) {
    throw packageError('SYSTEM_PACKAGE_INTEGRITY', '系统包完整性校验失败');
  }
  if (isOccupied(input.systemId)) throw packageError('SYSTEM_PACKAGE_CONFLICT', '系统 ID 已被现有系统占用');
  if (input.bindings !== null && (typeof input.bindings !== 'object' || Array.isArray(input.bindings))) {
    throw packageError('SYSTEM_PACKAGE_BINDING_INVALID', '算法绑定格式无效');
  }
  if (!Array.isArray(input.algorithms) || input.algorithms.length > 8) throw packageError('SYSTEM_PACKAGE_ALGORITHM_INVALID', '算法包数量无效');
  const algorithmIds = new Set();
  for (const draft of input.algorithms) {
    if (draft?.systemId !== input.systemId || !realtimePackage(draft) || algorithmIds.has(draft.id)
      || isAlgorithmOccupied(draft.id, input.systemId)) {
      throw packageError('SYSTEM_PACKAGE_ALGORITHM_INVALID', '算法包所属系统、契约或 ID 无效');
    }
    algorithmIds.add(draft.id);
  }
  for (const item of input.bindings?.algorithms || []) {
    if (item.packageId?.startsWith('user-') && !algorithmIds.has(item.packageId.slice(5))) {
      throw packageError('SYSTEM_PACKAGE_ALGORITHM_MISSING', '算法绑定引用的保存版本缺失');
    }
  }
  const root = path.resolve(managedRoot);
  const staging = path.join(root, `.stage-${randomUUID()}`);
  const target = path.join(root, input.systemId);
  const backup = path.join(path.dirname(root), 'managed-display-system-backups', `${input.systemId}-${randomUUID()}`);
  const seen = new Set();
  let moved = false;
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.mkdirSync(staging, { recursive: false });
  try {
    for (const file of input.files) {
      const name = safePath(file.path);
      if (seen.has(name) || !Number.isInteger(file.size) || file.size < 0 || file.size > MAX_PACKAGE_BYTES
        || !/^[a-f0-9]{64}$/.test(file.sha256 || '') || typeof file.contentBase64 !== 'string') {
        throw packageError('SYSTEM_PACKAGE_FILE_INVALID', '系统包文件声明无效');
      }
      seen.add(name);
      const data = Buffer.from(file.contentBase64, 'base64');
      if (data.length !== file.size || data.toString('base64') !== file.contentBase64
        || createHash('sha256').update(data).digest('hex') !== file.sha256) {
        throw packageError('SYSTEM_PACKAGE_INTEGRITY', '系统包文件哈希不匹配');
      }
      const destination = path.join(staging, ...name.split('/'));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, data, { flag: 'wx' });
    }
    if (!seen.has('display-system.json')) throw packageError('SYSTEM_PACKAGE_INVALID', '系统包缺少 display-system.json');
    const manifest = JSON.parse(fs.readFileSync(path.join(staging, 'display-system.json'), 'utf8'));
    if (manifest.id !== input.systemId) throw packageError('SYSTEM_PACKAGE_INVALID', '系统 ID 与配置不一致');
    for (const sensor of manifest.sensors || (manifest.sensor ? [manifest.sensor] : [])) {
      for (const name of [sensor.files?.lineOrder, sensor.files?.pointOrder, sensor.files?.coordinateMap,
        sensor.algorithm?.dataFile, sensor.algorithm?.entry, sensor.algorithm?.packageManifest]) {
        if (name && !seen.has(safePath(name))) throw packageError('SYSTEM_PACKAGE_FILE_INVALID', '系统配置引用了包外文件');
      }
    }
    const loaded = loadDisplaySystemDirectory(staging, { validateFiles: true });
    if (!loaded.ok || loaded.config?.id !== input.systemId) throw packageError('SYSTEM_PACKAGE_INVALID', loaded.errors[0] || '系统配置校验失败');
    for (const sensor of loaded.config.sensors || []) {
      if (isSensorTypeOccupied(sensor.type, input.systemId)) {
        throw packageError('SYSTEM_PACKAGE_CONFLICT', `传感器类型 ${sensor.type} 已被其他系统使用`);
      }
    }
    const matrices = Object.fromEntries((loaded.config.sensors || []).map((sensor) => [sensor.id, {
      rows: sensor.matrix.rows, cols: sensor.matrix.cols, total: sensor.matrix.rows * sensor.matrix.cols,
    }]));
    const checked = validateNativeConfiguration({ ...input.bindings || { algorithms: [], charts: [] }, showPressure: true, showArea: true }, {
      systemId: input.systemId,
      packages: [...input.algorithms.map((draft) => realtimePackage(draft)), ...listPackages()],
      inputs: { channels: Object.keys(matrices), matrices },
    });
    if (JSON.stringify(checked.algorithms) !== JSON.stringify(input.bindings?.algorithms || [])
      || JSON.stringify(checked.charts) !== JSON.stringify(input.bindings?.charts || [])) {
      throw packageError('SYSTEM_PACKAGE_BINDING_INVALID', '算法绑定与展示配置不一致');
    }
    for (const sensor of loaded.config.sensors || []) {
      for (const file of Object.values(sensor.resolvedFiles || {})) {
        if (file && !seen.has(safePath(path.relative(staging, file).replaceAll('\\', '/')))) {
          throw packageError('SYSTEM_PACKAGE_FILE_INVALID', '系统配置引用了包外文件');
        }
      }
    }
    fs.writeFileSync(path.join(staging, 'package-bindings.json'), JSON.stringify(input.bindings || { algorithms: [], charts: [] }));
    if (input.algorithms.length) {
      const algorithmDirectory = path.join(staging, 'package-algorithms');
      fs.mkdirSync(algorithmDirectory);
      for (const draft of input.algorithms) fs.writeFileSync(path.join(algorithmDirectory, `${draft.id}.json`), JSON.stringify(draft));
    }
    fs.writeFileSync(path.join(staging, 'package-info.json'), JSON.stringify({ sha256, systemId: input.systemId, version }));
    if (fs.existsSync(target)) { fs.renameSync(target, backup); moved = true; }
    fs.renameSync(staging, target);
    if (moved) {
      try { fs.rmSync(backup, { recursive: true, force: true }); } catch { /* Old version cleanup can be retried later. */ }
    }
    return { systemId: input.systemId, directory: target, sha256 };
  } catch (error) {
    if (moved && !fs.existsSync(target) && fs.existsSync(backup)) fs.renameSync(backup, target);
    throw error;
  } finally {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  }
}

module.exports = { exportManifestPackage, exportNativePackage, installManifestPackage, installNativePackage, safePath };
