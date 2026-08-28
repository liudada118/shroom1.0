const SEMANTIC_VERSION_PATTERN =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function unwrapRawModule(rawModule) {
  if (typeof rawModule === "string") return rawModule;
  if (rawModule && typeof rawModule.default === "string") {
    return rawModule.default;
  }
  return "";
}

export function extractVersionFromPath(filePath) {
  const match = String(filePath || "").match(
    /(?:^|[/\\])(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\.md(?:\?.*)?$/i
  );
  return match ? match[1] : "";
}

export function parseSemanticVersion(version) {
  const match = String(version || "").trim().match(SEMANTIC_VERSION_PATTERN);
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

function comparePrereleaseIdentifiers(left, right) {
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];

    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;

    const leftIsNumber = /^\d+$/.test(leftPart);
    const rightIsNumber = /^\d+$/.test(rightPart);

    if (leftIsNumber && rightIsNumber) {
      return Number(leftPart) - Number(rightPart);
    }
    if (leftIsNumber) return -1;
    if (rightIsNumber) return 1;
    return leftPart.localeCompare(rightPart);
  }

  return 0;
}

export function compareSemanticVersions(leftVersion, rightVersion) {
  const left = parseSemanticVersion(leftVersion);
  const right = parseSemanticVersion(rightVersion);

  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;

  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }

  if (left.prerelease.length === 0 && right.prerelease.length > 0) return 1;
  if (right.prerelease.length === 0 && left.prerelease.length > 0) return -1;

  return comparePrereleaseIdentifiers(left.prerelease, right.prerelease);
}

function isReleaseTitle(line) {
  return /^#*\s*(?:Shroom\s+)?v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\s*$/i.test(
    line
  );
}

function parseChangeLines(lines) {
  const changes = [];

  for (const sourceLine of lines) {
    const line = sourceLine.trim();
    if (!line) continue;

    const listItem = line.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (listItem) {
      changes.push(listItem[1].trim());
      continue;
    }

    if (changes.length > 0 && /^\s+/.test(sourceLine)) {
      changes[changes.length - 1] = `${changes[changes.length - 1]} ${line}`;
      continue;
    }

    changes.push(line.replace(/^#+\s*/, ""));
  }

  return changes.filter(Boolean);
}

export function parseReleaseNote(filePath, rawModule) {
  const version = extractVersionFromPath(filePath);
  const rawText = unwrapRawModule(rawModule)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();

  if (!version || !parseSemanticVersion(version) || !rawText) return null;

  const lines = rawText.split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim());

  if (
    firstContentIndex >= 0 &&
    isReleaseTitle(lines[firstContentIndex].trim())
  ) {
    lines.splice(firstContentIndex, 1);
  }

  return {
    version,
    changes: parseChangeLines(lines),
  };
}

export function buildVersionHistory(releaseNoteModules) {
  return Object.entries(releaseNoteModules || {})
    .map(([filePath, rawModule]) => parseReleaseNote(filePath, rawModule))
    .filter(Boolean)
    .sort((left, right) =>
      compareSemanticVersions(right.version, left.version)
    );
}
