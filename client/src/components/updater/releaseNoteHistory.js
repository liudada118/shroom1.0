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

/** 版本历史支持的语言；第一项是兜底语言，也是打包时注入 `latest.yml` 的那一份。 */
export const RELEASE_NOTE_LANGUAGES = ["zh", "en", "ja"];

/**
 * 按语言生成版本历史，某个版本没有译文（或译文是空的）时整条回退到中文。
 * ⚠️ 版本列表以中文为准：只有译文、没有中文原文的版本在任何语言下都不显示。
 *
 * @param modulesByLanguage 形如 `{ zh, en, ja }`，值是各语言的 `import.meta.glob` 结果。
 * @returns 形如 `{ zh: [...], en: [...], ja: [...] }`，每个数组与 `buildVersionHistory` 的返回同形。
 */
export function buildLocalizedVersionHistory(modulesByLanguage) {
  const [fallbackLanguage] = RELEASE_NOTE_LANGUAGES;
  const fallbackHistory = buildVersionHistory(
    modulesByLanguage?.[fallbackLanguage]
  );

  return Object.fromEntries(
    RELEASE_NOTE_LANGUAGES.map((language) => {
      if (language === fallbackLanguage) return [language, fallbackHistory];

      const translated = new Map(
        buildVersionHistory(modulesByLanguage?.[language]).map((item) => [
          item.version,
          item,
        ])
      );

      return [
        language,
        fallbackHistory.map((item) => {
          const own = translated.get(item.version);
          return own && own.changes.length > 0 ? own : item;
        }),
      ];
    })
  );
}

/**
 * 取某个界面语言对应的版本历史。
 *
 * @param historyByLanguage `buildLocalizedVersionHistory` 的返回值。
 * @param language i18next 的语言码，带地区后缀（`en-US`）也可以；不认识的语言给中文。
 * @returns 该语言的版本历史数组。
 */
export function selectVersionHistory(historyByLanguage, language) {
  const baseLanguage = String(language || "").toLowerCase().split("-")[0];
  const key = RELEASE_NOTE_LANGUAGES.includes(baseLanguage)
    ? baseLanguage
    : RELEASE_NOTE_LANGUAGES[0];

  return historyByLanguage?.[key] || [];
}
