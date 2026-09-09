const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
// 从已声明的构建工具链加载，兼容 pnpm 隔离安装。
const builderRequire = createRequire(require.resolve('electron-builder'));
const libraryRequire = createRequire(builderRequire.resolve('app-builder-lib'));
const semver = libraryRequire('semver');

const preparedConfigs = new WeakSet();
const packageFilter = [
  '**/*', '!node_modules{,/**/*}', '!test{,/**/*}', '!tests{,/**/*}',
  '!__tests__{,/**/*}', '!example{,/**/*}', '!examples{,/**/*}',
  '!**/*.md', '!**/*.map', '!**/*.o', '!**/*.obj', '!**/*.pdb',
  '!**/config.txt', '!**/.git{,/**/*}', '!**/.bin{,/**/*}',
];

/** 加载 electron-builder 工具链自带的 ASAR 库，不依赖根目录意外提升的包。 */
function loadAsar() {
  return createRequire(libraryRequire.resolve('@electron/universal'))('@electron/asar');
}

/** 列出生产依赖及 peer 依赖；optional 缺失时允许继续打包。 */
function runtimeDependencies(manifest) {
  const ranges = { ...manifest.peerDependencies, ...manifest.dependencies, ...manifest.optionalDependencies };
  return Object.entries(ranges).map(([name, range]) => ({
    name, range,
    optional: Object.hasOwn(manifest.optionalDependencies || {}, name)
      || (!Object.hasOwn(manifest.dependencies || {}, name)
        && manifest.peerDependenciesMeta?.[name]?.optional === true),
  }));
}

/** 从调用包的真实目录解析依赖，兼容 npm 嵌套目录、pnpm 链接和 file: 包。 */
function resolveInstalledPackage(from, name) {
  const resolver = createRequire(path.join(from, 'package.json'));
  // string_decoder 等包名也可能是 Node 内置模块，仍需复制 manifest 声明的 npm 包。
  for (const base of resolver.resolve.paths('__shroom_production_dependency__') || []) {
    const candidate = path.join(base, name, 'package.json');
    if (fs.existsSync(candidate)) return fs.realpathSync(path.dirname(candidate));
  }
  return null;
}

/** 检查已安装版本满足生产依赖声明；file:/workspace: 等本地引用由路径保证。 */
function assertVersion(manifest, dependency, parentName) {
  if (semver.validRange(dependency.range)
    && !semver.satisfies(manifest.version, dependency.range)) {
    throw new Error(`[pack] ${parentName} -> ${dependency.name}: ${manifest.version} does not satisfy ${dependency.range}`);
  }
}

/** 按 Node 的向上查找规则，在计划或 ASAR 清单中查找调用方可见的依赖。 */
function resolvePlannedPackage(packages, parent, name) {
  let directory = parent;
  while (true) {
    if (path.posix.basename(directory) !== 'node_modules') {
      const candidate = path.posix.join(directory, 'node_modules', name);
      if (packages.has(candidate)) return packages.get(candidate);
    }
    const next = path.posix.dirname(directory);
    if (next === directory) return null;
    directory = next;
  }
}

/** 生成完整生产依赖映射；同名多版本按调用方嵌套，避免打包时错误提升依赖。 */
function collectRuntimePackages(projectRoot) {
  const root = fs.realpathSync(projectRoot);
  const packages = new Map();
  const queue = [{ from: root, to: '.', manifest: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) }];
  for (let index = 0; index < queue.length; index += 1) {
    const parent = queue[index];
    for (const dependency of runtimeDependencies(parent.manifest)) {
      const source = resolveInstalledPackage(parent.from, dependency.name);
      if (!source) {
        if (dependency.optional) continue;
        throw new Error(`[pack] ${parent.manifest.name} -> ${dependency.name}: missing production dependency`);
      }
      const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
      assertVersion(manifest, dependency, parent.manifest.name);
      const visible = resolvePlannedPackage(packages, parent.to, dependency.name);
      if (visible?.from === source) continue;
      const rootDestination = path.posix.join('node_modules', dependency.name);
      const destination = visible || packages.has(rootDestination)
        ? path.posix.join(parent.to, 'node_modules', dependency.name) : rootDestination;
      const entry = { from: source, to: destination, manifest };
      packages.set(destination, entry);
      queue.push(entry);
    }
  }
  return [...packages.values()];
}

/** beforePack：显式提供生产包 FileSet，避免旧 npm 清单与 pnpm 实际文件混用。 */
async function prepareRuntimeDependencies(context) {
  const config = context.packager.config;
  if (preparedConfigs.has(config)) return;
  const packages = collectRuntimePackages(context.packager.info.appDir);
  // builder 会先把字符串配置归一为 FileSet；新增独立排除串会意外创建第二个全仓匹配器。
  const rootFiles = config.files.find(item => typeof item === 'object'
    && (!item.from || item.from === '.') && (!item.to || item.to === '.'));
  if (rootFiles) rootFiles.filter.push('!node_modules{,/**/*}');
  else config.files.push('!node_modules{,/**/*}');
  config.files.push(...packages.map(({ from, to }) => ({
    from, to, filter: packageFilter,
  })));
  preparedConfigs.add(config);
  console.log(`[pack] resolved ${packages.length} production packages from installed dependency paths`);
}

/** beforeBuild：依赖由 beforePack 提供；保留现有 Electron native ABI，不触发重新安装。 */
async function runtimeDependenciesHandledExternally() {
  return false;
}

/** 校验 ASAR 内每个生产包的依赖可达性与版本；不允许从开发机 node_modules 补漏。 */
function verifyPackagedDependencies(archivePath) {
  const asar = loadAsar();
  asar.uncache(archivePath);
  const packages = new Map();
  for (const filename of asar.listPackage(archivePath)) {
    const relative = filename.replace(/^[\\/]+/, '').replace(/\\/g, '/');
    if (relative !== 'package.json' && !relative.endsWith('/package.json')) continue;
    const manifest = JSON.parse(asar.extractFile(archivePath, path.normalize(relative)).toString('utf8'));
    packages.set(path.posix.dirname(relative), { manifest, to: path.posix.dirname(relative) });
  }
  const root = packages.get('.');
  if (!root) throw new Error(`[pack] missing package.json in ${archivePath}`);
  const queue = [root];
  const visited = new Set();
  const errors = [];
  for (let index = 0; index < queue.length; index += 1) {
    const parent = queue[index];
    if (visited.has(parent.to)) continue;
    visited.add(parent.to);
    for (const dependency of runtimeDependencies(parent.manifest)) {
      const target = resolvePlannedPackage(packages, parent.to, dependency.name);
      if (!target) {
        if (!dependency.optional) errors.push(`${parent.manifest.name} -> ${dependency.name}: missing`);
        continue;
      }
      try { assertVersion(target.manifest, dependency, parent.manifest.name); }
      catch (error) { errors.push(error.message); }
      queue.push(target);
    }
  }
  if (errors.length) throw new Error(`[pack] invalid runtime dependencies in ${archivePath}:\n${errors.join('\n')}`);
  console.log(`[pack] ASAR dependency check passed (${visited.size - 1} production packages)`);
  return visited.size - 1;
}

module.exports = {
  loadAsar,
  collectRuntimePackages, prepareRuntimeDependencies,
  runtimeDependenciesHandledExternally, verifyPackagedDependencies,
};
