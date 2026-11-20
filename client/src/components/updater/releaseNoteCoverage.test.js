import { describe, expect, it } from "vitest";
import { buildVersionHistory } from "./releaseNoteHistory";
import { RELEASE_NOTE_MODULES } from "./releaseNoteSources";

// 直接读仓库里真实的版本说明：新增一个版本却漏了某种语言，这里会点名是哪个版本。
const history = Object.fromEntries(
  Object.entries(RELEASE_NOTE_MODULES).map(([language, modules]) => [
    language,
    buildVersionHistory(modules),
  ])
);

/** 把某种语言的版本历史转成「版本号 → 条目」的表。 */
function byVersion(language) {
  return new Map(history[language].map((item) => [item.version, item]));
}

describe("release note translations on disk", () => {
  it("loads the Chinese release notes", () => {
    expect(history.zh.length).toBeGreaterThan(0);
  });

  it.each(["en", "ja"])(
    "has a %s file for every release, with the same number of entries",
    (language) => {
      const translated = byVersion(language);
      const problems = [];

      for (const source of history.zh) {
        const target = translated.get(source.version);
        if (!target) {
          problems.push(`${source.version}: missing ${language} file`);
        } else if (target.changes.length !== source.changes.length) {
          problems.push(
            `${source.version}: ${target.changes.length} entries, Chinese has ${source.changes.length}`
          );
        }
      }

      expect(problems).toEqual([]);
    }
  );

  it.each(["en", "ja"])(
    "has no %s file without a Chinese source",
    (language) => {
      const source = byVersion("zh");
      const orphans = history[language]
        .map((item) => item.version)
        .filter((version) => !source.has(version));

      expect(orphans).toEqual([]);
    }
  );

  it("keeps the English notes free of Chinese text", () => {
    const untranslated = history.en
      .filter((item) => /\p{Script=Han}/u.test(item.changes.join("\n")))
      .map((item) => item.version);

    expect(untranslated).toEqual([]);
  });

  it("does not ship Chinese text as the Japanese notes", () => {
    const source = byVersion("zh");
    const copied = history.ja
      .filter(
        (item) =>
          source.get(item.version)?.changes.join("\n") ===
          item.changes.join("\n")
      )
      .map((item) => item.version);

    expect(copied).toEqual([]);
  });
});
