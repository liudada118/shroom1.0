"use strict";

const path = require("path");
const { verifyRuntimeHealth } = require("./python-runtime-contract");

const runtimeExe = path.resolve(
  __dirname,
  "..",
  "python",
  "dist",
  "onbed_server",
  process.platform === "win32" ? "onbed_server.exe" : "onbed_server"
);

try {
  const health = verifyRuntimeHealth(runtimeExe);
  console.log(JSON.stringify({ runtime: runtimeExe, ...health }));
} catch (error) {
  console.error(`[pack] python runtime health error: ${error.message}`);
  process.exit(1);
}
