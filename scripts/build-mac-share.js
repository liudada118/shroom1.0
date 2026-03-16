"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const productName = (pkg.build && pkg.build.productName) || pkg.name || "App";
const version = pkg.version || "0.0.0";

function run(cmd, args, cwd = projectRoot) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function findMacAppPath() {
  const distDir = path.join(projectRoot, "dist");
  if (!fs.existsSync(distDir)) {
    throw new Error("dist directory does not exist");
  }

  const candidates = fs
    .readdirSync(distDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("mac-"))
    .map((entry) => path.join(distDir, entry.name, `${productName}.app`))
    .filter((appPath) => fs.existsSync(appPath));

  if (candidates.length === 0) {
    throw new Error(`cannot find ${productName}.app under dist/mac-*`);
  }

  return candidates[0];
}

function getArchFromAppPath(appPath) {
  const parentDir = path.basename(path.dirname(appPath));
  const separator = parentDir.indexOf("-");
  return separator >= 0 ? parentDir.slice(separator + 1) : process.arch;
}

function main() {
  if (process.platform !== "darwin") {
    throw new Error("build-mac-share only supports macOS");
  }

  run("npm", ["run", "prepare-pack-resources"]);
  run("npx", ["electron-builder", "--mac", "zip", "--publish", "never"]);

  const appPath = findMacAppPath();
  const arch = getArchFromAppPath(appPath);
  const outputZip = path.join(projectRoot, "dist", `${productName}-${version}-${arch}-mac-adhoc.zip`);

  run("codesign", ["--deep", "--force", "--sign", "-", "--options", "runtime", appPath]);
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);

  if (fs.existsSync(outputZip)) {
    fs.rmSync(outputZip, { force: true });
  }
  run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, outputZip]);

  console.log(`\n[share] done: ${outputZip}`);
  console.log(`[share] receiver may need: xattr -dr com.apple.quarantine /Applications/${productName}.app`);
  console.log("[share] for no warning dialog, use Apple Developer ID signing + notarization.");
}

try {
  main();
} catch (error) {
  console.error(`\n[share] failed: ${error.message}`);
  process.exit(1);
}
