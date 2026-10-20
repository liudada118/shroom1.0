const fs = require('node:fs');
const path = require('node:path');

/** Reject unstamped or mismatched pages before they become an installer update baseline. */
function verifyFrontendBuild(buildRoot, appVersion, readFile = fs.readFileSync) {
  const filename = path.join(buildRoot, 'frontend-build.json');
  let contents;
  try { contents = readFile(filename); }
  catch (cause) {
    const error = new Error(`[pack] FRONTEND_BUILD_METADATA_MISSING: ${filename}. Run npm run build-client before packaging.`, { cause });
    error.code = 'FRONTEND_BUILD_METADATA_MISSING';
    throw error;
  }
  let metadata;
  try {
    if (contents.length > 16384) throw new Error('Metadata exceeds 16 KiB');
    metadata = JSON.parse(contents.toString('utf8'));
    if (!metadata || Array.isArray(metadata) || metadata.schemaVersion !== 1
      || !Number.isSafeInteger(metadata.buildId) || metadata.buildId <= 0
      || typeof metadata.appVersion !== 'string' || !metadata.appVersion) throw new Error('Invalid frontend build identity');
  } catch (cause) {
    const error = new Error(`[pack] FRONTEND_BUILD_METADATA_INVALID: ${filename}. Rebuild the frontend.`, { cause });
    error.code = 'FRONTEND_BUILD_METADATA_INVALID';
    throw error;
  }
  if (typeof appVersion !== 'string' || !appVersion || metadata.appVersion !== appVersion) {
    const error = new Error(`[pack] FRONTEND_BUILD_VERSION_MISMATCH: ${filename} has ${metadata.appVersion}; application version is ${appVersion}. Rebuild the frontend after changing the application version.`);
    error.code = 'FRONTEND_BUILD_VERSION_MISMATCH';
    throw error;
  }
  return metadata;
}

/** Validate the same external-build-first resource layout selected by the packaged Electron host. */
function verifyPackagedFrontendBuild(resourcesRoot, appVersion) {
  const externalBuild = path.join(resourcesRoot, 'build');
  if (fs.existsSync(path.join(externalBuild, 'index.html'))) return verifyFrontendBuild(externalBuild, appVersion);
  const archivePath = path.join(resourcesRoot, 'app.asar');
  if (fs.existsSync(archivePath)) {
    const asar = require('./pack-runtime-dependencies').loadAsar();
    asar.uncache(archivePath);
    try { asar.statFile(archivePath, path.join('build', 'index.html')); }
    catch { throw new Error(`[pack] FRONTEND_BUILD_PAGE_MISSING: no packaged index.html in ${resourcesRoot}.`); }
    return verifyFrontendBuild(path.join(archivePath, 'build'), appVersion,
      () => asar.extractFile(archivePath, path.join('build', 'frontend-build.json')));
  }
  throw new Error(`[pack] FRONTEND_BUILD_PAGE_MISSING: no packaged index.html in ${resourcesRoot}.`);
}

module.exports = { verifyFrontendBuild, verifyPackagedFrontendBuild };
