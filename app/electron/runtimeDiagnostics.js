const { normalizeRuntimeVersions } = require('./usageAnalytics');

/** Combine host-owned version metadata without returning configuration bodies or business data. */
function runtimeVersionSnapshot(backendRuntime, frontend) {
  let versions = {}, webpage = {};
  try { versions = backendRuntime.getRuntimeStatus?.()?.runtimeVersions || {}; } catch { /* A booting backend has unknown versions. */ }
  try { webpage = frontend?.status?.() || {}; } catch { /* Packaged startup still proceeds. */ }
  return normalizeRuntimeVersions({ ...versions, frontendReleaseId: webpage.activeReleaseId,
    frontendBuildId: webpage.activeBuildId, hostContract: webpage.hostContract });
}

/** Recheck trusted expiry at wake time, even if no renderer or device frame is available. */
function checkLicenseOnWake(backendRuntime, onError = () => {}) {
  try { return Promise.resolve(backendRuntime.checkLicenseAccess?.()).catch(onError); }
  catch (error) { onError(error); return Promise.resolve(); }
}

module.exports = { runtimeVersionSnapshot, checkLicenseOnWake };
