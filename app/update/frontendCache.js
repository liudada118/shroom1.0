const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID, verify } = require('node:crypto');
const { recordBusinessEvent } = require('../../backend/common/businessEvents');

const PUBLIC_KEY = fs.readFileSync(path.join(__dirname, '../../backend/extension-host/workspace/systemPackagePublicKey.pem'), 'utf8');
const DEFAULT_ENDPOINT = 'https://shroom.jq-industries.com/api/frontend/latest';
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_RELEASE_BYTES = 256 * 1024 * 1024;

/** Reject ambiguous paths on both Windows and Unix before a manifest reaches disk. */
function safeResourcePath(value) {
  return typeof value === 'string' && value.length <= 240 && !/[\\:\x00-\x1f<>"|?*%]/.test(value)
    && value.split('/').every(part => part && !['.', '..'].includes(part) && !/[. ]$/.test(part)
      && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}

/** Compare numeric software versions without accepting unrecognized version strings. */
function supportsVersion(actual, minimum) {
  if (!/^\d+\.\d+\.\d+$/.test(actual) || !/^\d+\.\d+\.\d+$/.test(minimum)) return false;
  const a = actual.split('.').map(Number), b = minimum.split('.').map(Number);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] > b[index];
  return true;
}

/** Accept only signed, bounded releases using the current host IPC contract. */
function validateRelease(envelope, appVersion, publicKey = PUBLIC_KEY) {
  const manifest = envelope?.manifest;
  if (!manifest || manifest.schemaVersion !== 1 || manifest.hostContract !== 1 || !Number.isSafeInteger(manifest.releaseId)
    || manifest.releaseId < 1 || !supportsVersion(appVersion, manifest.minAppVersion)
    || (manifest.buildId !== undefined && (!Number.isSafeInteger(manifest.buildId) || manifest.buildId < 1))
    || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 2000
    || typeof envelope.signature !== 'string'
    || !verify(null, Buffer.from(JSON.stringify(manifest)), publicKey, Buffer.from(envelope.signature, 'base64'))) throw new Error('FRONTEND_RELEASE_INVALID');
  const paths = new Set(); let bytes = 0;
  for (const file of manifest.files) {
    const canonical = String(file.path).toLowerCase();
    if (!safeResourcePath(file.path) || paths.has(canonical) || !Number.isSafeInteger(file.size) || file.size < 0
      || file.size > MAX_FILE_BYTES || !/^[a-f0-9]{64}$/.test(file.sha256 || '')) throw new Error('FRONTEND_RELEASE_INVALID');
    paths.add(canonical); bytes += file.size;
  }
  if (!paths.has('index.html') || bytes > MAX_RELEASE_BYTES || !manifest.files.some(file => /\.js$/.test(file.path))) throw new Error('FRONTEND_RELEASE_INVALID');
  return manifest;
}

/** Read the installer build identity; older unstamped installers keep their packaged page. */
function readPackagedBuild(shippedRoot, appVersion) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(shippedRoot, 'frontend-build.json'), 'utf8'));
    if (data.schemaVersion === 1 && Number.isSafeInteger(data.buildId) && data.buildId > 0
      && data.appVersion === appVersion) return data;
  } catch { /* Missing or damaged metadata cannot establish an update baseline. */ }
  return null;
}

/** Verify a regular resource without traversing symlink directories. */
function matchesResource(root, file) {
  try {
    let target = root;
    for (const part of file.path.split('/')) {
      target = path.join(target, part);
      if (fs.lstatSync(target).isSymbolicLink()) return false;
    }
    const stat = fs.lstatSync(target);
    return stat.isFile() && stat.size === file.size
      && createHash('sha256').update(fs.readFileSync(target)).digest('hex') === file.sha256;
  } catch { return false; }
}

/** Read a response with a byte cap and timeout; redirects never change the trusted update origin. */
async function boundedFetch(fetchImpl, url, limit, signal) {
  const response = await fetchImpl(url, { redirect: 'error', signal });
  if (!response.ok) throw new Error('FRONTEND_SERVICE_UNAVAILABLE');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > limit) throw new Error('FRONTEND_RESOURCE_TOO_LARGE');
      chunks.push(Buffer.from(item.value));
    }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => {}); }
}

/** Stage complete web releases separately from the running page; failed boots retain the last good release. */
function createFrontendCache({ root, appVersion, fetchImpl = globalThis.fetch, endpoint = DEFAULT_ENDPOINT,
  publicKey = PUBLIC_KEY, onStatus = () => {} }) {
  const directory = path.join(root, 'frontend-cache'), pointer = path.join(directory, 'state.json');
  const source = new URL(endpoint);
  if (source.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(source.hostname)) throw new Error('FRONTEND_SOURCE_INVALID');
  let state = {}, selected = null, checking = null, controller = null, stopped = false, packaged = null, packagedRoot = null, stagingRoot = null;
  try { state = JSON.parse(fs.readFileSync(pointer, 'utf8')); } catch { /* First installation uses the packaged page. */ }
  if (!state || typeof state !== 'object' || Array.isArray(state)) state = {};

  /** Save the release pointer only after complete files and signatures have been checked. */
  function save(next) {
    fs.mkdirSync(directory, { recursive: true });
    const temporary = `${pointer}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(next)); fs.renameSync(temporary, pointer); state = next;
  }

  /** Recheck cached bytes before serving executable code, including offline starts. */
  function checkedRoot(envelope) {
    const manifest = validateRelease(envelope, appVersion, publicKey);
    const releaseRoot = path.join(directory, String(manifest.releaseId));
    for (const file of manifest.files) {
      if (!matchesResource(releaseRoot, file)) throw new Error('FRONTEND_CACHE_INVALID');
    }
    return releaseRoot;
  }

  /** Cached code must be built after the webpage shipped with this installer. */
  function newerThanPackaged(envelope) {
    return packaged && Number.isSafeInteger(envelope?.manifest?.buildId)
      && envelope.manifest.buildId > packaged.buildId;
  }

  /** Remove only unused cache releases and abandoned downloads; never touch business data. */
  function cleanup(staging) {
    const keep = new Set([state.active, state.previous, state.pending, selected?.envelope].filter(Boolean)
      .map(envelope => String(envelope.manifest?.releaseId)));
    try {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.isSymbolicLink() || keep.has(entry.name)
          || !/^(?:[1-9]\d{0,15}|\.download-[a-f0-9-]{36})$/.test(entry.name)) continue;
        const target = path.resolve(directory, entry.name);
        if (path.dirname(target) !== path.resolve(directory) || target === staging || target === stagingRoot) continue;
        try { fs.rmSync(target, { recursive: true, force: true }); } catch { /* Retry locked files on the next cleanup. */ }
      }
    } catch { /* Read-only disks and antivirus locks do not interrupt the running page. */ }
  }

  /** Reuse verified bytes across retained releases, including renamed resources. */
  function resourceSources() {
    const resources = new Map();
    for (const envelope of [selected?.envelope, state.pending, state.active, state.previous].filter(Boolean)) {
      try {
        const manifest = validateRelease(envelope, appVersion, publicKey);
        const resourceRoot = path.join(directory, String(manifest.releaseId));
        for (const file of manifest.files) {
          const key = `${file.sha256}:${file.size}`;
          if (!resources.has(key)) resources.set(key, []);
          resources.get(key).push({ root: resourceRoot, file });
        }
      } catch { /* Invalid metadata cannot supply executable resources. */ }
    }
    return resources;
  }

  /** Link immutable resources when possible; copies support cross-volume and ASAR installs. */
  function reuseResource(file, target, resources) {
    const candidates = [...(resources.get(`${file.sha256}:${file.size}`) || []), { root: packagedRoot, file }];
    for (const candidate of candidates) {
      if (!candidate.root || !matchesResource(candidate.root, candidate.file)) continue;
      const from = path.join(candidate.root, candidate.file.path);
      // ⚠️ userData is writable: sharing blocks with the installer would also damage the fallback page.
      if (candidate.root === packagedRoot) fs.copyFileSync(from, target);
      else { try { fs.linkSync(from, target); } catch { fs.copyFileSync(from, target); } }
      return true;
    }
    return false;
  }

  /** An unfinished previous boot discards the candidate; the shipped page is always a final fallback. */
  function selectRoot(shippedRoot) {
    if (selected) return selected.root;
    packagedRoot = shippedRoot; packaged = readPackagedBuild(shippedRoot, appVersion);
    // ⚠️ Installing new code must also retire cached pages, including same-version rebuilds.
    const installer = packaged ? `${appVersion}:${packaged.buildId}` : `${appVersion}:unstamped`;
    if (state.installer !== installer) {
      try {
        save({ ...state, installer,
          active: newerThanPackaged(state.active) ? state.active : undefined,
          previous: newerThanPackaged(state.previous) ? state.previous : undefined,
          pending: newerThanPackaged(state.pending) ? state.pending : undefined });
      } catch {
        packaged = null; selected = { root: shippedRoot, pending: false };
        return shippedRoot;
      }
    }
    if (state.booting) {
      try { save({ ...state, booting: undefined,
        pending: state.booting === true || state.booting === state.pending?.manifest?.releaseId ? undefined : state.pending }); }
      catch { packaged = null; selected = { root: shippedRoot, pending: false }; return shippedRoot; }
    }
    for (const candidate of [state.pending, state.active, state.previous].filter(Boolean)) {
      try {
        if (!newerThanPackaged(candidate)) continue;
        const candidateRoot = checkedRoot(candidate);
        const pending = candidate === state.pending;
        selected = { root: candidateRoot, envelope: candidate, pending };
        if (pending) save({ ...state, booting: candidate.manifest.releaseId });
        else if (candidate === state.previous) save({ ...state, active: candidate, previous: undefined, pending: undefined });
        cleanup();
        return candidateRoot;
      } catch {
        recordBusinessEvent('usage_session_summary', { featureId: 'webpage_update', action: 'cache_rejected', result: 'failure', errorCode: 'FRONTEND_CACHE_INVALID' });
      }
    }
    selected = { root: shippedRoot, pending: false };
    try { save({ ...state, active: undefined, previous: undefined, pending: undefined, booting: undefined }); } catch { /* Packaged code remains usable on a read-only disk. */ }
    cleanup();
    return shippedRoot;
  }

  /** The React app confirms successful startup before a candidate becomes the last good release. */
  function ready() {
    if (selected?.pending) {
      save({ ...state, active: selected.envelope, previous: state.active, booting: undefined,
        pending: state.pending?.manifest?.releaseId === selected.envelope.manifest.releaseId ? undefined : state.pending });
      selected.pending = false;
      recordBusinessEvent('usage_session_summary', { featureId: 'webpage_update', action: 'activate', result: 'success' });
    }
    cleanup();
    return status();
  }

  /** Stop using a candidate that could not initialize, keeping the previous release and all business data. */
  function rollback(shippedRoot) {
    if (!selected?.pending) return false;
    try {
      save({ ...state, booting: undefined,
        pending: state.pending?.manifest?.releaseId === selected.envelope.manifest.releaseId ? undefined : state.pending });
      selected = null; selectRoot(shippedRoot);
    } catch { packaged = null; selected = { root: shippedRoot, pending: false }; }
    onStatus({ type: 'web-update-error', message: '新版页面启动失败，已恢复上一版本。' });
    recordBusinessEvent('usage_session_summary', { featureId: 'webpage_update', action: 'rollback', result: 'success', errorCode: 'FRONTEND_BOOT_FAILED' });
    return true;
  }

  /** Return metadata only; callers cannot choose a filesystem path or update endpoint. */
  function status() { return { activeReleaseId: selected?.envelope?.manifest?.releaseId || null,
    pendingReleaseId: state.pending?.manifest?.releaseId || null, checking: Boolean(checking) }; }

  /** Reuse unchanged bytes and fetch missing resources before scheduling a complete release. */
  function check() {
    if (stopped || !packaged) return Promise.resolve(status());
    if (checking) return checking;
    checking = (async () => {
      const startedAt = Date.now();
      recordBusinessEvent('feature_attempted', { featureId: 'webpage_update', action: 'check' });
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000); timeout.unref?.();
      let staging;
      try {
        const envelope = JSON.parse((await boundedFetch(fetchImpl, source.href, 2 * 1024 * 1024, controller.signal)).toString('utf8'));
        const manifest = validateRelease(envelope, appVersion, publicKey);
        const latest = Math.max(state.highestReleaseId || 0, state.active?.manifest?.releaseId || 0, state.pending?.manifest?.releaseId || 0);
        if (!newerThanPackaged(envelope) || manifest.releaseId <= latest) {
          recordBusinessEvent('usage_session_summary', { featureId: 'webpage_update', action: 'check_current', result: 'success' });
          return status();
        }
        cleanup();
        onStatus({ type: 'web-update-downloading' });
        staging = path.join(directory, `.download-${randomUUID()}`); fs.mkdirSync(staging, { recursive: true });
        stagingRoot = staging;
        const resources = resourceSources(); let reusedBytes = 0, downloadedBytes = 0;
        for (const file of manifest.files) {
          const target = path.join(staging, file.path); fs.mkdirSync(path.dirname(target), { recursive: true });
          if (reuseResource(file, target, resources)) { reusedBytes += file.size; continue; }
          const url = new URL(`/api/frontend/releases/${manifest.releaseId}/${file.path.split('/').map(encodeURIComponent).join('/')}`, source.origin);
          const data = await boundedFetch(fetchImpl, url.href, file.size, controller.signal);
          if (data.length !== file.size || createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error('FRONTEND_INTEGRITY_FAILED');
          fs.writeFileSync(target, data); downloadedBytes += data.length;
          const key = `${file.sha256}:${file.size}`;
          if (!resources.has(key)) resources.set(key, []);
          resources.get(key).push({ root: staging, file });
        }
        if (!manifest.files.every(file => matchesResource(staging, file))) throw new Error('FRONTEND_INTEGRITY_FAILED');
        const target = path.join(directory, String(manifest.releaseId));
        if (fs.existsSync(target)) throw new Error('FRONTEND_RELEASE_ALREADY_EXISTS');
        fs.renameSync(staging, target); staging = null;
        save({ ...state, pending: envelope, highestReleaseId: manifest.releaseId });
        cleanup();
        onStatus({ type: 'web-update-ready', reusedBytes, downloadedBytes, message: '新版页面已缓存，下次启动自动使用。' });
        recordBusinessEvent('usage_session_summary', { featureId: 'webpage_update', action: 'download_ready', result: 'success',
          count: downloadedBytes, durationMs: Math.min(86400000, Math.max(0, Date.now() - startedAt)) });
      } catch (error) {
        recordBusinessEvent('usage_session_summary', { featureId: 'webpage_update', action: 'update_failed', result: stopped ? 'cancelled' : 'failure',
          errorCode: /^[A-Z_]{1,80}$/.test(error.message || '') ? error.message : 'FRONTEND_UPDATE_UNAVAILABLE' });
        onStatus({ type: 'web-update-unavailable', message: '继续使用当前本地页面。' });
      }
      finally {
        clearTimeout(timeout); controller = null;
        stagingRoot = null;
        if (staging && path.dirname(staging) === directory) {
          try { fs.rmSync(staging, { recursive: true, force: true }); } catch { /* The next startup cleans abandoned staging files. */ }
        }
      }
      return status();
    })().finally(() => { checking = null; onStatus({ checking: false }); });
    return checking;
  }

  /** Cancel background downloads without touching completed releases or the current page. */
  function dispose() { stopped = true; controller?.abort(); }
  return { selectRoot, ready, rollback, check, status, dispose };
}

module.exports = { createFrontendCache, validateRelease, safeResourcePath, supportsVersion, DEFAULT_ENDPOINT };
