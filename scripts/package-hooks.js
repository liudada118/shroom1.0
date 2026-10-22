const fs = require('fs');
const path = require('path');
const { prepareRuntimeDependencies, verifyPackagedDependencies } = require('./pack-runtime-dependencies');
const { verifyFrontendBuild, verifyPackagedFrontendBuild } = require('./verify-frontend-build');

const PACK_OUTPUT_DIRS = ['out', 'dist'];

function removeFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.rmSync(filePath, { force: true });
  console.log(`[pack] removed ${filePath}`);
  return true;
}

function removeBundledConfig(appDir) {
  if (!appDir) {
    return 0;
  }

  const candidates = new Set([
    path.join(appDir, 'config.txt'),
    path.join(appDir, 'resources', 'config.txt'),
  ]);

  let removed = 0;
  for (const candidate of candidates) {
    if (removeFileIfExists(candidate)) {
      removed += 1;
    }
  }

  return removed;
}

function cleanPackOutputs(projectRoot = process.cwd()) {
  for (const relDir of PACK_OUTPUT_DIRS) {
    const absDir = path.join(projectRoot, relDir);
    if (!fs.existsSync(absDir)) {
      continue;
    }

    fs.rmSync(absDir, { recursive: true, force: true });
    console.log(`[pack] cleared ${absDir}`);
  }
}

/** Validate the frontend identity before resolving the existing production dependency package sets. */
async function electronBuilderBeforePack(context) {
  const appDir = context.packager.info.appDir;
  verifyFrontendBuild(path.join(appDir, 'build'), context.packager.appInfo.version);
  await prepareRuntimeDependencies(context);
}

/** Validate final resource metadata and dependencies while retaining the private-config cleanup. */
async function electronBuilderAfterPack(context) {
  removeBundledConfig(context && context.appOutDir);
  const resources = context.packager.getResourcesDir(context.appOutDir);
  verifyPackagedFrontendBuild(resources, context.packager.appInfo.version);
  verifyPackagedDependencies(path.join(resources, 'app.asar'));
}

async function electronForgeAfterComplete(buildPath) {
  removeBundledConfig(buildPath);
}

module.exports = {
  cleanPackOutputs,
  electronBuilderBeforePack,
  electronBuilderAfterPack,
  electronForgeAfterComplete,
};
