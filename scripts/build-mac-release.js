"use strict";

const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const packageJsonPath = path.join(projectRoot, "package.json");
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const productName = (pkg.build && pkg.build.productName) || pkg.name || "App";
const version = pkg.version || "0.0.0";
const arch = process.arch === "arm64" ? "arm64" : process.arch;
const appOutDir = path.join(distDir, `mac-${arch}`);
const appPath = path.join(appOutDir, `${productName}.app`);
const updateZipPath = path.join(distDir, `${productName}-${version}-${arch}-mac.zip`);
const notarizeZipPath = path.join(distDir, `${productName}-${version}-${arch}-mac-notary.zip`);
const latestMacYmlPath = path.join(distDir, "latest-mac.yml");
const macReleaseNotesPath = path.join(projectRoot, "release-notes", "mac", `${version}.md`);
const macEntitlementsPath = path.join(projectRoot, "scripts", "entitlements.mac.plist");
const pythonRoot = path.join(projectRoot, "python");
const pythonBuildScript = path.join(pythonRoot, "build_exe.py");
const pythonRuntimeDir = path.join(pythonRoot, "dist", "onbed_server");
const pythonRuntimeExe = path.join(
  pythonRuntimeDir,
  process.platform === "win32" ? "onbed_server.exe" : "onbed_server"
);
const appUpdateYmlPath = path.join(appPath, "Contents", "Resources", "app-update.yml");

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd || projectRoot,
    env: options.env || process.env,
    encoding: "utf8",
    stdio: options.stdio || "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }

  return result;
}

function runCapture(cmd, args, options = {}) {
  return run(cmd, args, { ...options, stdio: "pipe" }).stdout.trim();
}

function runBuffered(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd || projectRoot,
    env: options.env || process.env,
    encoding: "utf8",
    stdio: "pipe",
  });

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  if (stdout) {
    process.stdout.write(stdout);
  }
  if (stderr) {
    process.stderr.write(stderr);
  }

  if (result.error) {
    throw result.error;
  }

  return {
    ...result,
    stdout,
    stderr,
    combinedOutput: `${stdout}${stderr}`,
  };
}

function escapeYamlString(value) {
  return String(value).replace(/'/g, "''");
}

function updaterCacheDirName() {
  if (pkg.build && pkg.build.updaterCacheDirName) {
    return pkg.build.updaterCacheDirName;
  }

  return `${pkg.name || productName}-updater`;
}

function publishConfig() {
  const publish = pkg.build && pkg.build.publish;
  if (!Array.isArray(publish) || publish.length === 0) {
    throw new Error("build.publish is required to generate app-update.yml");
  }

  const generic = publish.find((item) => item && item.provider === "generic" && item.url);
  if (!generic) {
    throw new Error("a generic publish provider with url is required to generate app-update.yml");
  }

  return generic;
}

function writeAppUpdateYml() {
  const publish = publishConfig();
  const content = [
    `provider: ${publish.provider}`,
    `url: '${escapeYamlString(publish.url)}'`,
    `updaterCacheDirName: ${updaterCacheDirName()}`,
    "",
  ].join("\n");

  fs.writeFileSync(appUpdateYmlPath, content, "utf8");
}

function fileOutput(targetPath) {
  try {
    return runCapture("file", ["-b", targetPath]);
  } catch {
    return "";
  }
}

function isMachOFile(targetPath) {
  return fileOutput(targetPath).includes("Mach-O");
}

function frameworkNameForPath(targetPath) {
  const parts = targetPath.split(path.sep);
  const frameworkPart = parts.find((part) => part.endsWith(".framework"));
  if (!frameworkPart) {
    return null;
  }
  return frameworkPart.slice(0, -".framework".length);
}

function shouldSignFileDirectly(targetPath) {
  const frameworkName = frameworkNameForPath(targetPath);
  if (!frameworkName) {
    return true;
  }

  const normalized = targetPath.split(path.sep).join("/");
  if (normalized.includes("/Versions/Current/")) {
    return false;
  }

  if (path.basename(targetPath) !== frameworkName) {
    return true;
  }

  return normalized.includes("/Versions/");
}

function walkFiles(dirPath, files = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const nextPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(nextPath, files);
    } else if (entry.isFile()) {
      files.push(nextPath);
    }
  }
  return files;
}

function walkBundles(dirPath, bundles = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const nextPath = path.join(dirPath, entry.name);
    if (!entry.isDirectory()) {
      continue;
    }

    if (
      nextPath.endsWith(".app") ||
      nextPath.endsWith(".framework") ||
      nextPath.endsWith(".xpc")
    ) {
      bundles.push(nextPath);
    }

    walkBundles(nextPath, bundles);
  }
  return bundles;
}

function signPath(targetPath, identity, { runtime = false, entitlements = null } = {}) {
  const args = ["--force", "--sign", `Developer ID Application: ${identity}`, "--timestamp"];
  if (runtime) {
    args.push("--options", "runtime");
  }
  if (entitlements) {
    args.push("--entitlements", entitlements);
  }
  args.push(targetPath);
  run("codesign", args);
}

function signNestedCode(identity) {
  const resourcesDir = path.join(appPath, "Contents", "Resources");
  const frameworksDir = path.join(appPath, "Contents", "Frameworks");
  const candidates = [];

  for (const root of [resourcesDir, frameworksDir]) {
    if (fs.existsSync(root)) {
      candidates.push(...walkFiles(root));
    }
  }

  const machOFiles = candidates
    .filter((filePath) => isMachOFile(filePath) && shouldSignFileDirectly(filePath))
    .sort((a, b) => b.length - a.length);

  for (const filePath of machOFiles) {
    const extension = path.extname(filePath).toLowerCase();
    const runtime = ![".dylib", ".so", ".node"].includes(extension);
    signPath(filePath, identity, { runtime });
  }

  const bundleRoots = [];
  for (const root of [resourcesDir, frameworksDir]) {
    if (fs.existsSync(root)) {
      bundleRoots.push(...walkBundles(root));
    }
  }

  const bundlePaths = bundleRoots.sort((a, b) => b.length - a.length);
  for (const bundlePath of bundlePaths) {
    if (bundlePath.endsWith(".framework") && !bundlePath.startsWith(frameworksDir)) {
      continue;
    }
    const runtime = bundlePath.endsWith(".app") || bundlePath.endsWith(".xpc");
    const entitlements =
      runtime && (bundlePath.endsWith(".app") || bundlePath.endsWith(".xpc"))
        ? macEntitlementsPath
        : null;
    signPath(bundlePath, identity, { runtime, entitlements });
  }
}

function latestMtime(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return stat.mtimeMs;
  }

  let latest = stat.mtimeMs;
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    latest = Math.max(latest, latestMtime(path.join(targetPath, entry.name)));
  }
  return latest;
}

function runtimeIsFresh() {
  if (!fs.existsSync(pythonRuntimeExe)) {
    return false;
  }

  const sourceStamp = Math.max(
    latestMtime(path.join(pythonRoot, "app")),
    latestMtime(pythonBuildScript),
    latestMtime(path.join(pythonRoot, "requirements.txt"))
  );

  return latestMtime(pythonRuntimeDir) >= sourceStamp;
}

function interpreterCandidates() {
  const candidates = [];

  if (process.env.PYTHON_FOR_BUILD) {
    candidates.push({
      command: process.env.PYTHON_FOR_BUILD,
      args: [],
      label: process.env.PYTHON_FOR_BUILD,
    });
  }

  const localCandidates = process.platform === "win32"
    ? [
        path.join(pythonRoot, "Python311", "python.exe"),
      ]
    : [
        path.join(pythonRoot, "venv", "bin", "python3.11"),
        path.join(pythonRoot, "venv", "bin", "python3"),
        path.join(pythonRoot, "venv", "bin", "python"),
      ];

  for (const candidate of localCandidates) {
    candidates.push({ command: candidate, args: [], label: candidate });
  }

  if (process.platform === "win32") {
    candidates.push(
      { command: "py", args: ["-3.11"], label: "py -3.11" },
      { command: "python", args: [], label: "python" }
    );
  } else {
    candidates.push(
      { command: "python3.11", args: [], label: "python3.11" },
      { command: "python3", args: [], label: "python3" },
      { command: "python", args: [], label: "python" }
    );
  }

  return candidates;
}

function probeInterpreter(candidate) {
  const result = spawnSync(
    candidate.command,
    [
      ...candidate.args,
      "-c",
      "import sys, numpy, PyInstaller; print(sys.executable)",
    ],
    {
      cwd: pythonRoot,
      encoding: "utf8",
    }
  );

  if (result.error) {
    return { ok: false, reason: result.error.message };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      reason: (result.stderr || result.stdout || `exit ${result.status}`).trim(),
    };
  }

  return {
    ok: true,
    executable: (result.stdout || "").trim().split(/\r?\n/).pop(),
  };
}

function resolveInterpreter() {
  const failures = [];

  for (const candidate of interpreterCandidates()) {
    const probe = probeInterpreter(candidate);
    if (probe.ok) {
      return { ...candidate, executable: probe.executable };
    }
    failures.push(`${candidate.label}: ${probe.reason}`);
  }

  throw new Error(
    [
      "No usable Python build environment found for the mac release.",
      "Expected Python 3.11 with numpy and PyInstaller installed.",
      ...failures.map((failure) => `- ${failure}`),
    ].join("\n")
  );
}

function ensureMacPythonRuntime() {
  if (runtimeIsFresh()) {
    console.log(`[release] python runtime up-to-date -> ${pythonRuntimeExe}`);
    return;
  }

  const interpreter = resolveInterpreter();
  console.log(`[release] building python runtime with ${interpreter.label} -> ${interpreter.executable}`);
  run(interpreter.command, [...interpreter.args, "build_exe.py"], { cwd: pythonRoot });

  if (!fs.existsSync(pythonRuntimeExe)) {
    throw new Error(`python runtime build completed without output: ${pythonRuntimeExe}`);
  }
}

function detectSigningIdentity() {
  if (process.env.CSC_NAME) {
    return process.env.CSC_NAME;
  }

  const output = runCapture("security", ["find-identity", "-v", "-p", "codesigning"]);
  const match = output.match(/"Developer ID Application: ([^"]+)"/);

  if (!match) {
    throw new Error(
      'Developer ID Application identity not found. Install the certificate with private key or export CSC_NAME="Your Name (TEAMID)".'
    );
  }

  return match[1];
}

function notarizationArgs() {
  const profile = process.env.APPLE_KEYCHAIN_PROFILE || process.env.NOTARYTOOL_PROFILE;
  if (profile) {
    return ["--keychain-profile", profile];
  }

  if (
    process.env.APPLE_ID &&
    process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.APPLE_TEAM_ID
  ) {
    return [
      "--apple-id",
      process.env.APPLE_ID,
      "--password",
      process.env.APPLE_APP_SPECIFIC_PASSWORD,
      "--team-id",
      process.env.APPLE_TEAM_ID,
    ];
  }

  if (
    process.env.APPLE_API_KEY &&
    process.env.APPLE_API_KEY_ID
  ) {
    const args = [
      "--key",
      process.env.APPLE_API_KEY,
      "--key-id",
      process.env.APPLE_API_KEY_ID,
    ];

    if (process.env.APPLE_API_ISSUER) {
      args.push("--issuer", process.env.APPLE_API_ISSUER);
    }

    return args;
  }

  throw new Error(
    [
      "Notarization credentials are not configured.",
      "Set one of the following before running the mac release build:",
      '- export APPLE_KEYCHAIN_PROFILE="your-notarytool-profile"',
      '- export APPLE_ID="you@example.com" APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx" APPLE_TEAM_ID="TEAMID"',
      '- export APPLE_API_KEY="/path/AuthKey_ABC123.p8" APPLE_API_KEY_ID="ABC123" APPLE_API_ISSUER="issuer-uuid"',
    ].join("\n")
  );
}

function releaseNotesBlock() {
  if (!fs.existsSync(macReleaseNotesPath)) {
    return "";
  }

  const normalized = fs.readFileSync(macReleaseNotesPath, "utf8").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }

  const body = normalized
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");

  return `releaseNotes: |-\n${body}\n`;
}

function writeLatestMacYml() {
  const zipBuffer = fs.readFileSync(updateZipPath);
  const sha512 = crypto.createHash("sha512").update(zipBuffer).digest("base64");
  const size = fs.statSync(updateZipPath).size;
  const releaseDate = new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z");
  const releaseNotes = releaseNotesBlock();

  const content = [
    `version: ${version}`,
    "files:",
    `  - url: ${path.basename(updateZipPath)}`,
    `    sha512: ${sha512}`,
    `    size: ${size}`,
    `path: ${path.basename(updateZipPath)}`,
    `sha512: ${sha512}`,
    `releaseDate: '${releaseDate}'`,
    releaseNotes.trimEnd(),
  ]
    .filter(Boolean)
    .join("\n") + "\n";

  fs.writeFileSync(latestMacYmlPath, content, "utf8");
  console.log(`[release] wrote ${latestMacYmlPath}`);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function submitForNotarization(notaryArgs) {
  const result = runBuffered("xcrun", ["notarytool", "submit", notarizeZipPath, ...notaryArgs]);
  if (result.status !== 0) {
    throw new Error(
      `xcrun notarytool submit ${notarizeZipPath} ${notaryArgs.join(" ")} failed with exit code ${result.status ?? "unknown"}`
    );
  }

  const match = result.combinedOutput.match(/\bid:\s*([0-9a-f-]{36})\b/i);
  if (!match) {
    throw new Error("Unable to parse notarization submission ID from xcrun notarytool submit output.");
  }

  return match[1];
}

function waitForNotarization(submissionId, notaryArgs) {
  const maxAttempts = Number(process.env.NOTARY_WAIT_ATTEMPTS || 20);
  const delayMs = Number(process.env.NOTARY_WAIT_DELAY_MS || 30000);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = runBuffered("xcrun", ["notarytool", "wait", submissionId, ...notaryArgs]);
    if (result.status === 0) {
      return;
    }

    const transientNetworkIssue =
      result.combinedOutput.includes("NSURLErrorDomain Code=-1009") ||
      result.combinedOutput.includes("The Internet connection appears to be offline.");

    if (transientNetworkIssue && attempt < maxAttempts) {
      console.warn(
        `[release] notarization wait lost network connectivity (attempt ${attempt}/${maxAttempts}), retrying in ${Math.round(delayMs / 1000)}s`
      );
      sleep(delayMs);
      continue;
    }

    throw new Error(
      `xcrun notarytool wait ${submissionId} ${notaryArgs.join(" ")} failed with exit code ${result.status ?? "unknown"}`
    );
  }

  throw new Error(`notarization wait exceeded ${maxAttempts} attempts for submission ${submissionId}`);
}

function main() {
  if (process.platform !== "darwin") {
    throw new Error("build-mac-release only supports macOS");
  }

  if (!fs.existsSync(macEntitlementsPath)) {
    throw new Error(`mac entitlements file not found: ${macEntitlementsPath}`);
  }

  const identity = detectSigningIdentity();
  const notaryArgs = notarizationArgs();

  console.log(`[release] signing identity -> ${identity}`);
  if (process.env.APPLE_KEYCHAIN_PROFILE || process.env.NOTARYTOOL_PROFILE) {
    console.log(`[release] notarization -> keychain profile ${(process.env.APPLE_KEYCHAIN_PROFILE || process.env.NOTARYTOOL_PROFILE)}`);
  } else if (process.env.APPLE_ID) {
    console.log(`[release] notarization -> Apple ID ${process.env.APPLE_ID}`);
  } else {
    console.log("[release] notarization -> App Store Connect API key");
  }

  run("npm", ["run", "build-client"]);
  ensureMacPythonRuntime();
  run("node", ["scripts/sync-pack-resources.js"]);

  run("npx", ["electron-builder", "--mac", "dir", "--publish", "never"], {
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
  });

  if (!fs.existsSync(appPath)) {
    throw new Error(`packaged app not found: ${appPath}`);
  }

  writeAppUpdateYml();

  if (fs.existsSync(notarizeZipPath)) {
    fs.rmSync(notarizeZipPath, { force: true });
  }
  if (fs.existsSync(updateZipPath)) {
    fs.rmSync(updateZipPath, { force: true });
  }

  signNestedCode(identity);
  signPath(appPath, identity, { runtime: true, entitlements: macEntitlementsPath });
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);

  if (process.env.SKIP_NOTARIZATION === "1") {
    console.log("[release] SKIP_NOTARIZATION=1 -> stopping after local signing and verification");
    return;
  }

  run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, notarizeZipPath]);

  const submissionId = process.env.NOTARY_SUBMISSION_ID || submitForNotarization(notaryArgs);
  console.log(`[release] notarization submission -> ${submissionId}`);
  waitForNotarization(submissionId, notaryArgs);
  run("xcrun", ["stapler", "staple", appPath]);
  run("spctl", ["-a", "-t", "exec", "-vv", appPath]);

  run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, updateZipPath]);
  writeLatestMacYml();

  console.log(`[release] update zip -> ${updateZipPath}`);
  console.log(`[release] latest-mac -> ${latestMacYmlPath}`);
}

try {
  main();
} catch (error) {
  console.error(`[release] mac release failed: ${error.message}`);
  process.exit(1);
}
