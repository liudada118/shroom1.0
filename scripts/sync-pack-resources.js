const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const sourceInitDb = path.join(projectRoot, "db", "init.db");
const sourceAgentResources = path.join(projectRoot, "agent-resources");
const packResourcesDir = path.join(projectRoot, "pack-resources");

function resetDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyPath(sourcePath, targetPath, shouldSkip = null) {
  if (shouldSkip?.(sourcePath)) return;
  const stat = fs.lstatSync(sourcePath);

  if (stat.isSymbolicLink()) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.rmSync(targetPath, { force: true, recursive: true });
    fs.symlinkSync(fs.readlinkSync(sourcePath), targetPath);
    return;
  }

  if (stat.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath)) {
      copyPath(path.join(sourcePath, entry), path.join(targetPath, entry), shouldSkip);
    }
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  fs.chmodSync(targetPath, stat.mode);
}

function copyDir(sourceDir, targetDir, shouldSkip = null) {
  copyPath(sourceDir, targetDir, shouldSkip);
}

/** 检查即将随安装包复制的 Python runtime 是否包含 onbed_filter。 */
function runtimeContainsOnbedFilter(dirPath) {
  if (!fs.existsSync(dirPath)) return false;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory() && runtimeContainsOnbedFilter(entryPath)) return true;
    if (entry.isFile() && /^onbed_filter.*\.(?:pyd|so)$/.test(entry.name)) return true;
  }
  return false;
}

function syncDb() {
  const targetDir = path.join(packResourcesDir, "db");
  const targetInitDb = path.join(targetDir, "init.db");

  if (!fs.existsSync(sourceInitDb)) {
    throw new Error(`source init.db not found: ${sourceInitDb}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(sourceInitDb, targetInitDb);
  console.log(`[pack] synced init.db -> ${targetInitDb}`);
}

function syncPython() {
  const targetRoot = path.join(packResourcesDir, "python");
  const sourcePyDistDir = path.join(projectRoot, "python", "dist", "onbed_server");
  const sourcePyAppDir = path.join(projectRoot, "python", "app");
  const distExeName = process.platform === "win32" ? "onbed_server.exe" : "onbed_server";
  const sourcePyDistExe = path.join(sourcePyDistDir, distExeName);

  resetDir(targetRoot);

  if (!fs.existsSync(sourcePyDistExe)) {
    if (process.platform !== "win32" && fs.existsSync(sourcePyAppDir)) {
      const targetAppDir = path.join(targetRoot, "app");
      copyDir(sourcePyAppDir, targetAppDir);
      console.warn(
        `[pack] python dist not found on ${process.platform}, keep source app fallback -> ${targetAppDir}`
      );
      return;
    }

    throw new Error(
      `python runtime not found: ${sourcePyDistExe}. Run npm run build-python-runtime before packaging.`
    );
  }
  if (!runtimeContainsOnbedFilter(sourcePyDistDir)) {
    throw new Error(
      `python runtime is missing onbed_filter: ${sourcePyDistDir}. Rebuild the Python runtime before packaging.`
    );
  }

  const targetDistDir = path.join(targetRoot, "onbed_server");
  copyDir(sourcePyDistDir, targetDistDir);
  console.log(`[pack] synced python runtime -> ${targetDistDir}`);
}

function syncAgentResources() {
  const targetRoot = path.join(packResourcesDir, "agent");

  if (!fs.existsSync(sourceAgentResources)) {
    throw new Error(`agent resources not found: ${sourceAgentResources}`);
  }

  resetDir(targetRoot);
  copyDir(sourceAgentResources, targetRoot, (sourcePath) => (
    path.basename(sourcePath) === '__pycache__' || /\.py[co]$/.test(sourcePath)
  ));
  console.log(`[pack] synced agent resources -> ${targetRoot}`);
}

syncDb();
syncPython();
syncAgentResources();
