const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const AGENT_APP_SCHEMA_VERSION = 1;
const AGENT_APP_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const AGENT_APP_ALLOWED_PERMISSIONS = Object.freeze(['sensor.read']);
const AGENT_APP_MAX_FILES = 128;
// 允许离线 GLB/纹理，但总量仍压在 HTTP 50 MiB JSON 限制以内（32 MiB base64 约 42.7 MiB）。
const AGENT_APP_MAX_FILE_BYTES = 24 * 1024 * 1024;
const AGENT_APP_MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const AGENT_APP_MAX_PATH_LENGTH = 240;
const AGENT_APP_MANIFEST_FILE = 'app.json';
const AGENT_APP_DEFAULT_RENDERER_HEIGHT = 480;
const SEMANTIC_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

const WINDOWS_RESERVED_NAMES = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

class AgentAppError extends Error {
  constructor(code, message, { httpStatus = 400, details = [] } = {}) {
    super(message);
    this.name = 'AgentAppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPathWithin(parentPath, childPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function validateSafeId(value, fieldName = 'id') {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!AGENT_APP_ID_PATTERN.test(id)) {
    throw new AgentAppError(
      'AGENT_APP_INVALID',
      `${fieldName} must be 1-64 lowercase letters, digits or hyphens and start/end with a letter or digit`,
    );
  }
  return id;
}

function normalizePortableRelativePath(value, fieldName = 'path') {
  if (typeof value !== 'string') {
    throw new AgentAppError('AGENT_APP_FILE_INVALID', `${fieldName} must be a relative path`);
  }
  const input = value.trim();
  if (!input || input.length > AGENT_APP_MAX_PATH_LENGTH || input.includes('\0')) {
    throw new AgentAppError('AGENT_APP_FILE_INVALID', `${fieldName} is invalid`);
  }
  if (input.includes('\\') || path.posix.isAbsolute(input) || path.win32.isAbsolute(input)) {
    throw new AgentAppError('AGENT_APP_FILE_INVALID', `${fieldName} must be a portable package-relative path`);
  }
  const segments = input.split('/');
  if (segments.some((segment) => (
    !segment
      || segment === '.'
      || segment === '..'
      || /[\x00-\x1f<>:"|?*]/.test(segment)
      || /[. ]$/.test(segment)
      || WINDOWS_RESERVED_NAMES.test(segment)
  ))) {
    throw new AgentAppError('AGENT_APP_FILE_INVALID', `${fieldName} contains an unsafe path segment`);
  }
  return segments.join('/');
}

function normalizeAgentAppManifest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AgentAppError('AGENT_APP_INVALID', 'manifest must be an object');
  }
  if (input.schemaVersion !== AGENT_APP_SCHEMA_VERSION) {
    throw new AgentAppError(
      'AGENT_APP_INVALID',
      `manifest.schemaVersion must be ${AGENT_APP_SCHEMA_VERSION}`,
    );
  }

  const id = validateSafeId(input.id);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const version = typeof input.version === 'string' ? input.version.trim() : '';
  if (!name || name.length > 120) {
    throw new AgentAppError('AGENT_APP_INVALID', 'manifest.name must be 1-120 characters');
  }
  if (!version || version.length > 64 || !SEMANTIC_VERSION_PATTERN.test(version)) {
    throw new AgentAppError('AGENT_APP_INVALID', 'manifest.version must be a semantic version up to 64 characters');
  }
  if (!input.renderer || typeof input.renderer !== 'object' || Array.isArray(input.renderer)) {
    throw new AgentAppError('AGENT_APP_INVALID', 'manifest.renderer must be an object');
  }

  const rendererId = validateSafeId(
    input.renderer.id == null ? 'main' : input.renderer.id,
    'manifest.renderer.id',
  );
  const rendererLabel = input.renderer.label == null
    ? name
    : typeof input.renderer.label === 'string' ? input.renderer.label.trim() : '';
  const rendererEntry = normalizePortableRelativePath(input.renderer.entry, 'manifest.renderer.entry');
  const rendererHeight = input.renderer.height == null
    ? AGENT_APP_DEFAULT_RENDERER_HEIGHT
    : input.renderer.height;
  if (!rendererLabel || rendererLabel.length > 120) {
    throw new AgentAppError('AGENT_APP_INVALID', 'manifest.renderer.label must be 1-120 characters');
  }
  if (!Number.isInteger(rendererHeight) || rendererHeight < 160 || rendererHeight > 2000) {
    throw new AgentAppError('AGENT_APP_INVALID', 'manifest.renderer.height must be an integer from 160 to 2000');
  }

  const permissions = input.permissions == null
    ? [...AGENT_APP_ALLOWED_PERMISSIONS]
    : input.permissions;
  if (!Array.isArray(permissions) || permissions.some((item) => typeof item !== 'string')) {
    throw new AgentAppError('AGENT_APP_INVALID', 'manifest.permissions must be a string array');
  }
  const uniquePermissions = [...new Set(permissions)];
  const unsupported = uniquePermissions.filter((permission) => !AGENT_APP_ALLOWED_PERMISSIONS.includes(permission));
  if (unsupported.length) {
    throw new AgentAppError(
      'AGENT_APP_INVALID',
      `unsupported permission: ${unsupported.join(', ')}`,
    );
  }
  if (!uniquePermissions.includes('sensor.read')) {
    throw new AgentAppError('AGENT_APP_INVALID', 'manifest.permissions must include sensor.read');
  }

  return {
    schemaVersion: AGENT_APP_SCHEMA_VERSION,
    id,
    name,
    version,
    renderer: {
      id: rendererId,
      label: rendererLabel,
      entry: rendererEntry,
      height: rendererHeight,
    },
    permissions: uniquePermissions,
  };
}

function decodeBase64(content, filePath) {
  if (content.length % 4 !== 0
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(content)) {
    throw new AgentAppError('AGENT_APP_FILE_INVALID', `invalid base64 content for ${filePath}`);
  }
  return Buffer.from(content, 'base64');
}

function normalizeBundleFiles(files, rendererEntry) {
  if (!Array.isArray(files)) {
    throw new AgentAppError('AGENT_APP_FILE_INVALID', 'files must be an array');
  }
  if (files.length > AGENT_APP_MAX_FILES) {
    throw new AgentAppError(
      'AGENT_APP_LIMIT_EXCEEDED',
      `bundle exceeds ${AGENT_APP_MAX_FILES} files`,
      { httpStatus: 413 },
    );
  }

  const seenPaths = new Set();
  let totalBytes = 0;
  const normalizedFiles = files.map((file, index) => {
    if (!file || typeof file !== 'object' || Array.isArray(file)) {
      throw new AgentAppError('AGENT_APP_FILE_INVALID', `files[${index}] must be an object`);
    }
    const filePath = normalizePortableRelativePath(file.path, `files[${index}].path`);
    const canonicalPath = filePath.toLowerCase();
    if (canonicalPath === AGENT_APP_MANIFEST_FILE || seenPaths.has(canonicalPath)) {
      throw new AgentAppError(
        'AGENT_APP_FILE_INVALID',
        canonicalPath === AGENT_APP_MANIFEST_FILE
          ? `${AGENT_APP_MANIFEST_FILE} is generated from manifest and must not be included in files`
          : `duplicate file path: ${filePath}`,
      );
    }
    seenPaths.add(canonicalPath);

    if (file.encoding !== 'utf8' && file.encoding !== 'base64') {
      throw new AgentAppError('AGENT_APP_FILE_INVALID', `files[${index}].encoding must be utf8 or base64`);
    }
    if (typeof file.content !== 'string') {
      throw new AgentAppError('AGENT_APP_FILE_INVALID', `files[${index}].content must be a string`);
    }
    const buffer = file.encoding === 'base64'
      ? decodeBase64(file.content, filePath)
      : Buffer.from(file.content, 'utf8');
    if (buffer.length > AGENT_APP_MAX_FILE_BYTES) {
      throw new AgentAppError(
        'AGENT_APP_LIMIT_EXCEEDED',
        `${filePath} exceeds ${AGENT_APP_MAX_FILE_BYTES} bytes`,
        { httpStatus: 413 },
      );
    }
    totalBytes += buffer.length;
    if (totalBytes > AGENT_APP_MAX_TOTAL_BYTES) {
      throw new AgentAppError(
        'AGENT_APP_LIMIT_EXCEEDED',
        `bundle exceeds ${AGENT_APP_MAX_TOTAL_BYTES} bytes`,
        { httpStatus: 413 },
      );
    }
    return { path: filePath, buffer };
  });

  if (!seenPaths.has(rendererEntry.toLowerCase())) {
    throw new AgentAppError('AGENT_APP_FILE_INVALID', 'manifest.renderer.entry must exist in files');
  }
  return normalizedFiles;
}

function buildEntryUrl(id, entry) {
  const encodedEntry = entry.split('/').map(encodeURIComponent).join('/');
  return `/api/agent-apps/${encodeURIComponent(id)}/files/${encodedEntry}`;
}

function buildDescriptor(manifest) {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    rendererId: `agent:${manifest.id}`,
    renderer: cloneJson(manifest.renderer),
    permissions: [...manifest.permissions],
    entryUrl: buildEntryUrl(manifest.id, manifest.renderer.entry),
    editable: true,
  };
}

function createAgentAppService({
  runtimeWritableRoot,
  runtimeResourceRoot,
  logger,
  developmentPolicyPath = path.resolve(__dirname, '../../../agent-resources/policy.json'),
} = {}) {
  if (!runtimeWritableRoot) {
    throw new AgentAppError('AGENT_APP_INSTALL_FAILED', 'runtimeWritableRoot is required', { httpStatus: 500 });
  }
  const appsRoot = path.resolve(runtimeWritableRoot, 'agent-apps');
  const packagedPolicyPath = runtimeResourceRoot
    ? path.resolve(runtimeResourceRoot, 'agent', 'policy.json')
    : null;
  let records = new Map();
  let discoveryErrors = [];

  function ensureAppsRoot() {
    fs.mkdirSync(appsRoot, { recursive: true });
    const rootStat = fs.lstatSync(appsRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      throw new AgentAppError(
        'AGENT_APP_DISCOVERY_FAILED',
        'agent app root must be a real directory',
        { httpStatus: 500 },
      );
    }
  }

  function loadAppDirectory(directoryName) {
    validateSafeId(directoryName, 'directory id');
    const directoryPath = path.resolve(appsRoot, directoryName);
    if (!isPathWithin(appsRoot, directoryPath)) {
      throw new AgentAppError('AGENT_APP_INVALID', 'agent app directory escapes writable root');
    }
    const directoryStat = fs.lstatSync(directoryPath);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
      throw new AgentAppError('AGENT_APP_INVALID', 'agent app directory must be a real directory');
    }
    const manifestPath = path.join(directoryPath, AGENT_APP_MANIFEST_FILE);
    const manifestStat = fs.lstatSync(manifestPath);
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) {
      throw new AgentAppError('AGENT_APP_INVALID', `${AGENT_APP_MANIFEST_FILE} must be a regular file`);
    }
    if (manifestStat.size > 64 * 1024) {
      throw new AgentAppError('AGENT_APP_LIMIT_EXCEEDED', `${AGENT_APP_MANIFEST_FILE} exceeds 65536 bytes`);
    }
    let rawManifest;
    try {
      rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      throw new AgentAppError('AGENT_APP_INVALID', `${AGENT_APP_MANIFEST_FILE} is not valid JSON`);
    }
    const manifest = normalizeAgentAppManifest(rawManifest);
    if (manifest.id !== directoryName) {
      throw new AgentAppError('AGENT_APP_INVALID', 'manifest.id must match its directory name');
    }
    const entryPath = path.resolve(directoryPath, ...manifest.renderer.entry.split('/'));
    if (!isPathWithin(directoryPath, entryPath)) {
      throw new AgentAppError('AGENT_APP_INVALID', 'manifest.renderer.entry escapes package directory');
    }
    let entryStat;
    try {
      entryStat = fs.lstatSync(entryPath);
    } catch {
      throw new AgentAppError('AGENT_APP_INVALID', 'manifest.renderer.entry does not exist');
    }
    if (!entryStat.isFile() || entryStat.isSymbolicLink()) {
      throw new AgentAppError('AGENT_APP_INVALID', 'manifest.renderer.entry must be a regular file');
    }
    const realDirectory = fs.realpathSync(directoryPath);
    const realEntry = fs.realpathSync(entryPath);
    if (!isPathWithin(realDirectory, realEntry)) {
      throw new AgentAppError('AGENT_APP_INVALID', 'manifest.renderer.entry escapes package directory');
    }
    return {
      descriptor: buildDescriptor(manifest),
      directoryPath,
      manifest,
    };
  }

  function reload() {
    let directoryEntries;
    try {
      ensureAppsRoot();
      directoryEntries = fs.readdirSync(appsRoot, { withFileTypes: true });
    } catch (error) {
      logger?.error?.('[agent-apps] discovery root failed', error);
      throw new AgentAppError(
        'AGENT_APP_DISCOVERY_FAILED',
        'agent app discovery failed',
        { httpStatus: 500 },
      );
    }
    const nextRecords = new Map();
    const nextErrors = [];
    for (const entry of directoryEntries) {
      if (entry.name.startsWith('.')) continue;
      try {
        const record = loadAppDirectory(entry.name);
        if (nextRecords.has(record.manifest.id)) {
          throw new AgentAppError('AGENT_APP_INVALID', `duplicate agent app id: ${record.manifest.id}`);
        }
        nextRecords.set(record.manifest.id, record);
      } catch (error) {
        logger?.warn?.('[agent-apps] discovery failed', entry.name, error.message || error);
        nextErrors.push({
          directory: entry.name,
          code: error.code || 'AGENT_APP_INVALID',
          message: error.message || 'agent app is invalid',
        });
      }
    }
    records = nextRecords;
    discoveryErrors = nextErrors;
    return getStatus();
  }

  function getStatus() {
    return {
      apps: [...records.values()]
        .map((record) => cloneJson(record.descriptor))
        .sort((left, right) => left.id.localeCompare(right.id)),
      errors: cloneJson(discoveryErrors),
    };
  }

  function getById(id) {
    const normalizedId = validateSafeId(id);
    const record = records.get(normalizedId);
    return record ? cloneJson(record.descriptor) : null;
  }

  function removeTemporaryPath(temporaryPath) {
    try {
      if (isPathWithin(appsRoot, temporaryPath) && fs.existsSync(temporaryPath)) {
        fs.rmSync(temporaryPath, { recursive: true, force: true });
      }
    } catch (error) {
      logger?.warn?.('[agent-apps] temporary path cleanup failed', path.basename(temporaryPath), error.message || error);
    }
  }

  function install({ manifest: manifestInput, files, overwrite = false } = {}) {
    if (typeof overwrite !== 'boolean') {
      throw new AgentAppError('AGENT_APP_INVALID', 'overwrite must be a boolean');
    }
    const manifest = normalizeAgentAppManifest(manifestInput);
    const normalizedFiles = normalizeBundleFiles(files, manifest.renderer.entry);
    try {
      ensureAppsRoot();
    } catch (error) {
      logger?.error?.('[agent-apps] install root unavailable', error);
      throw new AgentAppError('AGENT_APP_INSTALL_FAILED', 'agent app installation failed', { httpStatus: 500 });
    }

    const targetPath = path.resolve(appsRoot, manifest.id);
    if (!isPathWithin(appsRoot, targetPath)) {
      throw new AgentAppError('AGENT_APP_INSTALL_FAILED', 'install target escapes writable root', { httpStatus: 500 });
    }
    if (fs.existsSync(targetPath) && overwrite !== true) {
      throw new AgentAppError('AGENT_APP_EXISTS', 'agent app already exists', { httpStatus: 409 });
    }

    const suffix = `${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const stagingPath = path.resolve(appsRoot, `.${manifest.id}.install-${suffix}`);
    const backupPath = path.resolve(appsRoot, `.${manifest.id}.backup-${suffix}`);
    let movedExisting = false;
    let installed = false;
    try {
      fs.mkdirSync(stagingPath, { recursive: false });
      fs.writeFileSync(
        path.join(stagingPath, AGENT_APP_MANIFEST_FILE),
        `${JSON.stringify(manifest, null, 2)}\n`,
        { flag: 'wx' },
      );
      normalizedFiles.forEach((file) => {
        const filePath = path.resolve(stagingPath, ...file.path.split('/'));
        if (!isPathWithin(stagingPath, filePath)) {
          throw new AgentAppError('AGENT_APP_FILE_INVALID', `unsafe file path: ${file.path}`);
        }
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, file.buffer, { flag: 'wx' });
      });

      // 先在同一磁盘写完整 staging，再用 rename 切换；覆盖时保留 backup，失败可回滚。
      if (fs.existsSync(targetPath)) {
        fs.renameSync(targetPath, backupPath);
        movedExisting = true;
      }
      fs.renameSync(stagingPath, targetPath);
      installed = true;
      reload();
      const app = getById(manifest.id);
      if (!app) {
        throw new AgentAppError('AGENT_APP_INSTALL_FAILED', 'installed agent app failed validation', { httpStatus: 500 });
      }
      removeTemporaryPath(backupPath);
      return { app };
    } catch (error) {
      if (installed && fs.existsSync(targetPath)) removeTemporaryPath(targetPath);
      if (movedExisting && fs.existsSync(backupPath) && !fs.existsSync(targetPath)) {
        try {
          fs.renameSync(backupPath, targetPath);
        } catch (rollbackError) {
          // 保留 hidden backup 供人工恢复；不能用回滚错误覆盖原安装错误。
          logger?.error?.('[agent-apps] rollback failed', rollbackError);
        }
      }
      removeTemporaryPath(stagingPath);
      try {
        reload();
      } catch {
        // 原错误优先；重载失败不覆盖安装失败的错误语义。
      }
      if (error instanceof AgentAppError) throw error;
      logger?.error?.('[agent-apps] install failed', error);
      throw new AgentAppError('AGENT_APP_INSTALL_FAILED', 'agent app installation failed', { httpStatus: 500 });
    }
  }

  function resolveStaticFile(id, requestedPath) {
    const normalizedId = validateSafeId(id);
    const record = records.get(normalizedId);
    if (!record) {
      throw new AgentAppError('AGENT_APP_NOT_FOUND', 'agent app not found', { httpStatus: 404 });
    }
    const relativePath = normalizePortableRelativePath(requestedPath, 'file path');
    const filePath = path.resolve(record.directoryPath, ...relativePath.split('/'));
    if (!isPathWithin(record.directoryPath, filePath)) {
      throw new AgentAppError('AGENT_APP_FILE_INVALID', 'file path escapes package directory');
    }
    let fileStat;
    try {
      fileStat = fs.lstatSync(filePath);
    } catch {
      throw new AgentAppError('AGENT_APP_FILE_NOT_FOUND', 'agent app file not found', { httpStatus: 404 });
    }
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      throw new AgentAppError('AGENT_APP_FILE_NOT_FOUND', 'agent app file not found', { httpStatus: 404 });
    }
    if (fileStat.size > AGENT_APP_MAX_FILE_BYTES) {
      throw new AgentAppError('AGENT_APP_LIMIT_EXCEEDED', 'agent app file exceeds the serving limit', { httpStatus: 413 });
    }
    const realDirectory = fs.realpathSync(record.directoryPath);
    const realFile = fs.realpathSync(filePath);
    if (!isPathWithin(realDirectory, realFile)) {
      throw new AgentAppError('AGENT_APP_FILE_INVALID', 'file path escapes package directory');
    }
    return realFile;
  }

  function readPolicy() {
    const candidates = [packagedPolicyPath, developmentPolicyPath].filter(Boolean);
    const policyPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!policyPath) {
      throw new AgentAppError(
        'AGENT_APP_POLICY_NOT_FOUND',
        'agent app policy is not available',
        { httpStatus: 404 },
      );
    }
    try {
      const stat = fs.lstatSync(policyPath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 256 * 1024) throw new Error('invalid policy file');
      const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
      if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new Error('invalid policy payload');
      return cloneJson(policy);
    } catch (error) {
      logger?.error?.('[agent-apps] policy load failed', error);
      throw new AgentAppError('AGENT_APP_POLICY_INVALID', 'agent app policy is invalid', { httpStatus: 500 });
    }
  }

  try {
    reload();
  } catch (error) {
    // Agent 渲染扩展是可选能力；可写目录暂时不可读不能拖垮串口/采集/存储主服务启动。
    records = new Map();
    discoveryErrors = [{
      directory: '',
      code: error.code || 'AGENT_APP_DISCOVERY_FAILED',
      message: error.message || 'agent app discovery failed',
    }];
  }

  return {
    appsRoot,
    getById,
    getStatus,
    install,
    readPolicy,
    reload,
    resolveStaticFile,
  };
}

module.exports = {
  AGENT_APP_ALLOWED_PERMISSIONS,
  AGENT_APP_ID_PATTERN,
  AGENT_APP_MANIFEST_FILE,
  AGENT_APP_MAX_FILE_BYTES,
  AGENT_APP_MAX_FILES,
  AGENT_APP_MAX_PATH_LENGTH,
  AGENT_APP_MAX_TOTAL_BYTES,
  AGENT_APP_SCHEMA_VERSION,
  AgentAppError,
  createAgentAppService,
  normalizeAgentAppManifest,
  normalizeBundleFiles,
  normalizePortableRelativePath,
};
