"use strict";

const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const NATIVE_FILENAME = "onbed_filter.cp311-win_amd64.pyd";

function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function normalizeExpectedSha256(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error("ONBED_FILTER_PYD_SHA256 must be a 64-character SHA-256 digest");
  }
  return normalized;
}

function stageOnbedFilterNative({ appDir, env = process.env }) {
  const targetPath = path.join(appDir, NATIVE_FILENAME);
  const sourceValue = String(env.ONBED_FILTER_PYD_SOURCE || "").trim();
  const targetExists = fs.existsSync(targetPath);

  if (!sourceValue && !targetExists) {
    throw new Error(
      `required Windows native library is missing; set ONBED_FILTER_PYD_SOURCE to ${NATIVE_FILENAME}`
    );
  }

  const expectedSha256 = normalizeExpectedSha256(env.ONBED_FILTER_PYD_SHA256);
  let injected = false;

  try {
    if (sourceValue) {
      const sourcePath = path.resolve(sourceValue);
      if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
        throw new Error(`ONBED_FILTER_PYD_SOURCE is not a file: ${sourcePath}`);
      }

      const sourceSha256 = fileSha256(sourcePath);
      if (sourceSha256 !== expectedSha256) {
        throw new Error(
          `onbed_filter SHA-256 mismatch: expected ${expectedSha256}, received ${sourceSha256}`
        );
      }

      if (path.resolve(sourcePath) !== path.resolve(targetPath)) {
        if (targetExists) {
          const existingSha256 = fileSha256(targetPath);
          if (existingSha256 !== expectedSha256) {
            throw new Error(
              `refusing to overwrite existing ${NATIVE_FILENAME} with a different artifact`
            );
          }
        } else {
          fs.copyFileSync(sourcePath, targetPath);
          injected = true;
        }
      }
    }

    const actualSha256 = fileSha256(targetPath);
    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `onbed_filter SHA-256 mismatch: expected ${expectedSha256}, received ${actualSha256}`
      );
    }

    return {
      path: targetPath,
      sha256: actualSha256,
      injected,
      cleanup() {
        if (injected && fs.existsSync(targetPath)) fs.rmSync(targetPath, { force: true });
      },
    };
  } catch (error) {
    if (injected && fs.existsSync(targetPath)) fs.rmSync(targetPath, { force: true });
    throw error;
  }
}

function spawnPython(candidate, args, options = {}) {
  const baseEnv = options.env || process.env;
  return spawnSync(
    candidate.command,
    [...(candidate.args || []), ...args],
    {
      ...options,
      env: {
        ...baseEnv,
        PYTHONUTF8: "1",
        PYTHONIOENCODING: "utf-8",
      },
    }
  );
}

function parseRuntimeHealth(stdout) {
  const lines = String(stdout || "").trim().split(/\r?\n/).filter(Boolean);
  let response;
  try {
    response = JSON.parse(lines.at(-1));
  } catch {
    throw new Error("runtime did not return a valid JSON health response");
  }

  if (!response?.ok || response.id !== "build-health" || response.data?.pong !== true) {
    throw new Error("runtime health response did not confirm a working RPC server");
  }
  if (response.data.onbedFilterAvailable !== true) {
    throw new Error("native onbed_filter module is unavailable in the packaged runtime");
  }
  return response.data;
}

function verifyRuntimeHealth(runtimeExe) {
  const result = spawnPython(
    { command: runtimeExe, args: [] },
    [],
    {
      input: '{"id":"build-health","fn":"health","args":{}}\n',
      encoding: "utf8",
      timeout: 30000,
      windowsHide: true,
    }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `python runtime health check failed with exit code ${result.status ?? "unknown"}: ${(result.stderr || "").trim()}`
    );
  }
  return parseRuntimeHealth(result.stdout);
}

module.exports = {
  NATIVE_FILENAME,
  fileSha256,
  parseRuntimeHealth,
  spawnPython,
  stageOnbedFilterNative,
  verifyRuntimeHealth,
};
