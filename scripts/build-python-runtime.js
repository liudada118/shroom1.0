"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  spawnPython,
  stageOnbedFilterNative,
  verifyRuntimeHealth,
} = require("./python-runtime-contract");

const projectRoot = path.resolve(__dirname, "..");
const pythonRoot = path.join(projectRoot, "python");
const pythonBuildScript = path.join(pythonRoot, "build_exe.py");
const runtimeDir = path.join(pythonRoot, "dist", "onbed_server");
const runtimeExe = path.join(
  runtimeDir,
  process.platform === "win32" ? "onbed_server.exe" : "onbed_server"
);

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function existingDir(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function pathCommandCandidates(command) {
  if (process.platform === "win32") return [];

  const result = spawnPython({ command: "which", args: [] }, ["-a", command], {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.error || result.status !== 0) {
    return [];
  }

  return unique((result.stdout || "").split(/\r?\n/));
}

function condaPython311Candidates() {
  if (process.platform === "win32") return [];

  const home = os.homedir();
  const candidates = [];
  const baseRoots = unique([
    process.env.CONDA_PREFIX || null,
    "/opt/miniconda3",
    path.join(home, "miniconda3"),
    "/opt/anaconda3",
    path.join(home, "anaconda3"),
  ]);
  const envRoots = unique([
    process.env.CONDA_PREFIX ? path.join(process.env.CONDA_PREFIX, "..") : null,
    "/opt/miniconda3/envs",
    path.join(home, "miniconda3", "envs"),
    "/opt/anaconda3/envs",
    path.join(home, "anaconda3", "envs"),
  ]);

  for (const root of baseRoots) {
    if (existingDir(root)) {
      candidates.push(path.join(root, "bin", "python3.11"));
    }
  }

  for (const envRoot of envRoots) {
    if (!existingDir(envRoot)) continue;
    try {
      for (const entry of fs.readdirSync(envRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        candidates.push(path.join(envRoot, entry.name, "bin", "python3.11"));
      }
    } catch {}
  }

  return unique(candidates.filter((candidate) => fs.existsSync(candidate)));
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
  if (!fs.existsSync(runtimeExe)) {
    return false;
  }

  const sourceStamp = Math.max(
    latestMtime(path.join(pythonRoot, "app")),
    latestMtime(pythonBuildScript),
    latestMtime(path.join(pythonRoot, "requirements.txt"))
  );

  return latestMtime(runtimeDir) >= sourceStamp;
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

  if (process.platform === "win32") {
    const localPython = path.join(pythonRoot, "Python311", "python.exe");
    candidates.push(
      { command: localPython, args: [], label: localPython },
      { command: "py", args: ["-3.11"], label: "py -3.11" },
      { command: "python", args: [], label: "python" }
    );
  } else {
    const localCandidates = [
      path.join(pythonRoot, "venv", "bin", "python3.11"),
      path.join(pythonRoot, "venv", "bin", "python3"),
      path.join(pythonRoot, "venv", "bin", "python"),
    ];

    for (const localPython of localCandidates) {
      candidates.push({ command: localPython, args: [], label: localPython });
    }

    for (const candidate of unique([
      ...pathCommandCandidates("python3.11"),
      ...condaPython311Candidates(),
      "python3.11",
      "python3",
      "python",
    ])) {
      candidates.push({ command: candidate, args: [], label: candidate });
    }
  }

  return candidates;
}

function probeInterpreter(candidate) {
  const result = spawnPython(
    candidate,
    [
      "-c",
      "import sys, numpy, PyInstaller; assert sys.version_info[:2] == (3, 11), sys.version; print(sys.executable)",
    ],
    {
      cwd: pythonRoot,
      encoding: "utf8",
    }
  );

  if (result.error) {
    return {
      ok: false,
      reason: result.error.message,
    };
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
      return {
        ...candidate,
        executable: probe.executable,
      };
    }

    failures.push(`${candidate.label}: ${probe.reason}`);
  }

  throw new Error(
    [
      "No usable Python build environment found for packaging.",
      "Expected Python 3.11 with numpy and PyInstaller installed.",
      ...failures.map((failure) => `- ${failure}`),
    ].join("\n")
  );
}

function runBuild(interpreter) {
  console.log(
    `[pack] building python runtime with ${interpreter.label} -> ${interpreter.executable}`
  );

  const result = spawnPython(
    interpreter,
    ["build_exe.py"],
    {
      cwd: pythonRoot,
      stdio: "inherit",
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `python runtime build failed with exit code ${result.status ?? "unknown"}`
    );
  }
}

function main() {
  if (process.platform !== "win32") {
    console.log("[pack] build-python-runtime skipped on non-Windows; keep existing platform packaging flow");
    return;
  }

  if (!fs.existsSync(pythonBuildScript)) {
    throw new Error(`python build script not found: ${pythonBuildScript}`);
  }

  const stagedNative = stageOnbedFilterNative({
    appDir: path.join(pythonRoot, "app"),
  });
  console.log(`[pack] verified onbed_filter SHA-256 ${stagedNative.sha256}`);

  try {
    if (runtimeIsFresh()) {
      console.log(`[pack] python runtime up-to-date -> ${runtimeExe}`);
    } else {
      const interpreter = resolveInterpreter();
      runBuild(interpreter);

      if (!fs.existsSync(runtimeExe)) {
        throw new Error(`python runtime build completed without output: ${runtimeExe}`);
      }

      console.log(`[pack] python runtime ready -> ${runtimeExe}`);
    }

    const health = verifyRuntimeHealth(runtimeExe);
    console.log(
      `[pack] python runtime health ready; onbedFilterAvailable=${health.onbedFilterAvailable}; `
      + `onbedFilterSensitivitySchema=${health.onbedFilterSensitivitySchema}`
    );
  } finally {
    stagedNative.cleanup();
  }
}

try {
  main();
} catch (error) {
  console.error(`[pack] python runtime error: ${error.message}`);
  process.exit(1);
}
