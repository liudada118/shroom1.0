const fs = require('fs');
const path = require('path');
const {
  loadAlgorithmPackageManifest,
} = require('./displaySystemAlgorithmPackage');

const ALGORITHM_PACKAGE_MANIFEST_FILE = 'algorithm-package.json';

function uniqueResolvedPaths(paths = []) {
  const seen = new Set();
  return paths
    .filter(Boolean)
    .map((item) => path.resolve(item))
    .filter((item) => {
      const key = process.platform === 'win32' ? item.toLowerCase() : item;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function publicPackageManifest(loaded) {
  const {
    manifestPath,
    packageDirectory,
    resolvedEntry,
    resolvedResources,
    ...manifest
  } = loaded;
  return manifest;
}

function normalizeMetricDefinitions(output = {}) {
  const byId = new Map(
    (Array.isArray(output.metricDefinitions) ? output.metricDefinitions : [])
      .filter((item) => item?.id)
      .map((item) => [item.id, item]),
  );
  return (output.metrics || []).map((id) => {
    const item = byId.get(id) || {};
    return {
      id,
      label: String(item.label || id),
      unit: String(item.unit || ''),
      decimals: Number.isInteger(item.decimals) ? item.decimals : 2,
      panel: ['pressure', 'area', 'both', 'none'].includes(item.panel)
        ? item.panel
        : 'none',
    };
  });
}

/**
 * 从只读资源根发现平台内置 Python 算法包。
 *
 * 返回给 Builder/Agent 的描述只包含可移植 manifest 和源码；绝不暴露安装机绝对路径。
 * 同 id 时前面的根优先，方便开发态资源覆盖打包资源而不会在下拉框里出现两份。
 */
function discoverBuiltinAlgorithmPackages({ roots = [], fsLike = fs } = {}) {
  const packages = [];
  const invalid = [];
  const seenIds = new Set();

  uniqueResolvedPaths(roots).forEach((root) => {
    if (!fsLike.existsSync(root)) return;
    let entries;
    try {
      entries = fsLike.readdirSync(root, { withFileTypes: true });
    } catch (error) {
      invalid.push({ source: root, errors: [error.message] });
      return;
    }

    entries
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((entry) => {
        const manifestPath = path.join(root, entry.name, ALGORITHM_PACKAGE_MANIFEST_FILE);
        if (!fsLike.existsSync(manifestPath)) return;
        const loaded = loadAlgorithmPackageManifest(manifestPath, { fsLike });
        if (!loaded.ok) {
          invalid.push({ source: manifestPath, errors: loaded.errors });
          return;
        }
        if (seenIds.has(loaded.value.id)) {
          invalid.push({
            source: manifestPath,
            errors: [`duplicate builtin algorithm package id: ${loaded.value.id}`],
          });
          return;
        }

        let algorithmSource;
        try {
          algorithmSource = fsLike.readFileSync(loaded.value.resolvedEntry, 'utf8');
        } catch (error) {
          invalid.push({ source: loaded.value.resolvedEntry, errors: [error.message] });
          return;
        }

        const manifest = publicPackageManifest(loaded.value);
        const catalog = manifest.catalog || {};
        seenIds.add(manifest.id);
        packages.push({
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          description: String(manifest.description || catalog.description || ''),
          category: String(catalog.category || 'general'),
          tags: Array.isArray(catalog.tags) ? [...catalog.tags] : [],
          compatibility: catalog.compatibility || {},
          sampleRateHz: Number(catalog.sampleRateHz) || null,
          singleton: catalog.singleton === true,
          attachable: catalog.attachable !== false,
          metricDefinitions: normalizeMetricDefinitions(manifest.output),
          packageManifest: manifest,
          algorithmSource,
        });
      });
  });

  return { packages, invalid };
}

module.exports = {
  ALGORITHM_PACKAGE_MANIFEST_FILE,
  discoverBuiltinAlgorithmPackages,
};
