"use strict";

const LICENSE_SENSOR_GROUPS = require("./licenseSensorGroups.json");

const GROUP_SCOPE_PREFIX = "@group:";

function validateLicenseSensorGroups(groups = LICENSE_SENSOR_GROUPS) {
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error("license sensor groups must be a non-empty array");
  }

  const groupKeys = new Set();
  const sensorTypes = new Set();
  for (const group of groups) {
    const groupKey = typeof group?.key === "string" ? group.key.trim() : "";
    if (!groupKey || groupKeys.has(groupKey)) {
      throw new Error(`duplicate or invalid license group: ${groupKey || "(empty)"}`);
    }
    if (!Array.isArray(group.items) || group.items.length === 0) {
      throw new Error(`license group has no display systems: ${groupKey}`);
    }
    groupKeys.add(groupKey);

    for (const item of group.items) {
      const sensorType = typeof item?.value === "string" ? item.value.trim() : "";
      if (!sensorType || sensorTypes.has(sensorType)) {
        throw new Error(`duplicate or invalid display system: ${sensorType || "(empty)"}`);
      }
      sensorTypes.add(sensorType);
    }
  }

  return { groupCount: groupKeys.size, sensorTypeCount: sensorTypes.size };
}

validateLicenseSensorGroups();

const GROUPS_BY_KEY = new Map(
  LICENSE_SENSOR_GROUPS.map((group) => [group.key, group]),
);

function createGroupScopeToken(groupKey) {
  const normalized = String(groupKey || "").trim();
  if (!GROUPS_BY_KEY.has(normalized)) {
    throw new Error(`unknown license group: ${normalized || "(empty)"}`);
  }
  return `${GROUP_SCOPE_PREFIX}${normalized}`;
}

function parseGroupScopeToken(value) {
  if (typeof value !== "string" || !value.startsWith(GROUP_SCOPE_PREFIX)) {
    return null;
  }
  const groupKey = value.slice(GROUP_SCOPE_PREFIX.length).trim();
  if (!GROUPS_BY_KEY.has(groupKey)) {
    throw new Error(`unknown license group: ${groupKey || "(empty)"}`);
  }
  return groupKey;
}

function expandLicenseFile(licenseFile, { allSensorTypes = [] } = {}) {
  if (licenseFile === "all") {
    return {
      isAllTypes: true,
      groupKeys: [],
      sensorTypes: [...new Set(allSensorTypes.filter(Boolean))],
    };
  }

  const entries = Array.isArray(licenseFile) ? licenseFile : [licenseFile];
  const groupKeys = [];
  const sensorTypes = [];
  const seenGroups = new Set();
  const seenTypes = new Set();

  for (const entry of entries) {
    if (typeof entry !== "string" || !entry.trim()) continue;
    const normalized = entry.trim();
    const groupKey = parseGroupScopeToken(normalized);
    if (groupKey) {
      if (!seenGroups.has(groupKey)) {
        seenGroups.add(groupKey);
        groupKeys.push(groupKey);
      }
      for (const item of GROUPS_BY_KEY.get(groupKey).items) {
        if (!seenTypes.has(item.value)) {
          seenTypes.add(item.value);
          sensorTypes.push(item.value);
        }
      }
      continue;
    }
    if (!seenTypes.has(normalized)) {
      seenTypes.add(normalized);
      sensorTypes.push(normalized);
    }
  }

  if (sensorTypes.length === 0) {
    throw new Error("license does not contain any display system");
  }

  return { isAllTypes: false, groupKeys, sensorTypes };
}

module.exports = {
  GROUP_SCOPE_PREFIX,
  LICENSE_SENSOR_GROUPS,
  createGroupScopeToken,
  expandLicenseFile,
  parseGroupScopeToken,
  validateLicenseSensorGroups,
};
