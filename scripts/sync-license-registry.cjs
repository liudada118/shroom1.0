"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  LICENSE_SENSOR_GROUPS,
  validateLicenseSensorGroups,
} = require("../licenseScopes");

const SOURCE_REGISTRY = path.resolve(__dirname, "..", "licenseSensorGroups.json");

function getLicenseRegistryInfo(registry = LICENSE_SENSOR_GROUPS) {
  const counts = validateLicenseSensorGroups(registry);
  const content = `${JSON.stringify(registry, null, 2)}\n`;
  return {
    ...counts,
    content,
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
  };
}

function syncLicenseRegistry(targetPath) {
  if (typeof targetPath !== "string" || !targetPath.trim()) {
    throw new Error("target registry path is required");
  }

  const resolvedTarget = path.resolve(targetPath.trim());
  if (path.extname(resolvedTarget).toLowerCase() !== ".json") {
    throw new Error("target registry path must be a .json file");
  }
  const targetDirectory = path.dirname(resolvedTarget);
  if (!fs.existsSync(targetDirectory) || !fs.statSync(targetDirectory).isDirectory()) {
    throw new Error(`target directory does not exist: ${targetDirectory}`);
  }
  if (resolvedTarget === SOURCE_REGISTRY) {
    throw new Error("target registry must be outside the source file");
  }

  const info = getLicenseRegistryInfo();
  const temporaryPath = `${resolvedTarget}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, info.content, "utf8");
  try {
    fs.copyFileSync(temporaryPath, resolvedTarget);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }

  const targetContent = fs.readFileSync(resolvedTarget, "utf8");
  const targetSha256 = crypto.createHash("sha256").update(targetContent).digest("hex");
  if (targetSha256 !== info.sha256) {
    throw new Error(`target registry checksum mismatch: ${resolvedTarget}`);
  }

  return {
    source: SOURCE_REGISTRY,
    target: resolvedTarget,
    groupCount: info.groupCount,
    sensorTypeCount: info.sensorTypeCount,
    sha256: targetSha256,
  };
}

if (require.main === module) {
  try {
    const result = syncLicenseRegistry(process.argv[2]);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`License registry sync failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  SOURCE_REGISTRY,
  getLicenseRegistryInfo,
  syncLicenseRegistry,
};
