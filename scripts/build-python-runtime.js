"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const pythonRoot = path.join(projectRoot, "python");
const pythonBuildScript = path.join(pythonRoot, "build_exe.py");
const runtimeDir = path.join(pythonRoot, "dist", "onbed_server");
const runtimeExe = path.join(
  runtimeDir,
  process.platform === "win32" ? "onbed_server.exe" : "onbed_server"
);

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

  const result = spawnSync(
    interpreter.command,
    [...interpreter.args, "build_exe.py"],
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

  if (runtimeIsFresh()) {
    console.log(`[pack] python runtime up-to-date -> ${runtimeExe}`);
    return;
  }

  const interpreter = resolveInterpreter();
  runBuild(interpreter);

  if (!fs.existsSync(runtimeExe)) {
    throw new Error(`python runtime build completed without output: ${runtimeExe}`);
  }

  console.log(`[pack] python runtime ready -> ${runtimeExe}`);
}

try {
  main();
} catch (error) {
  console.error(`[pack] python runtime error: ${error.message}`);
  process.exit(1);
}
