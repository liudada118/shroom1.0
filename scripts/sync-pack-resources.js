const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const sourceInitDb = path.join(projectRoot, "db", "init.db");
const packResourcesDir = path.join(projectRoot, "pack-resources");

function resetDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyPath(sourcePath, targetPath) {
  const stat = fs.lstatSync(sourcePath);

  if (stat.isSymbolicLink()) {
    return copyPath(fs.realpathSync(sourcePath), targetPath);
  }

  if (stat.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath)) {
      copyPath(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  fs.chmodSync(targetPath, stat.mode);
}

function copyDir(sourceDir, targetDir) {
  copyPath(sourceDir, targetDir);
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

  const targetDistDir = path.join(targetRoot, "onbed_server");
  copyDir(sourcePyDistDir, targetDistDir);
  console.log(`[pack] synced python runtime -> ${targetDistDir}`);
}

syncDb();
syncPython();
