import { describe, expect, it } from "vitest";
import {
  buildVersionHistory,
  compareSemanticVersions,
  extractVersionFromPath,
  parseReleaseNote,
} from "./releaseNoteHistory";

describe("releaseNoteHistory", () => {
  it("extracts the release version from Windows and Vite paths", () => {
    expect(
      extractVersionFromPath(
        "../../../../release-notes/windows/1.1.34.md?raw"
      )
    ).toBe("1.1.34");
    expect(
      extractVersionFromPath("E:\\shroom1\\release-notes\\windows\\2.0.0.md")
    ).toBe("2.0.0");
  });

  it("uses the filename as the version and parses existing Markdown bullets", () => {
    const result = parseReleaseNote(
      "../../../../release-notes/windows/1.1.8.md",
      "Shroom 1.1.7\r\n\r\n- 取消32*32线序和算法\r\n- 修复展示"
    );

    expect(result).toEqual({
      version: "1.1.8",
      changes: ["取消32*32线序和算法", "修复展示"],
    });
  });

  it("accepts Vite raw modules and plain description lines", () => {
    const result = parseReleaseNote("/release-notes/windows/1.2.0.md", {
      default: "# Shroom 1.2.0\n\n新增算法通道\n2. 支持回放",
    });

    expect(result).toEqual({
      version: "1.2.0",
      changes: ["新增算法通道", "支持回放"],
    });
  });

  it("sorts versions semantically instead of lexicographically", () => {
    const history = buildVersionHistory({
      "/release-notes/windows/1.1.9.md": "Shroom 1.1.9\n\n- 九",
      "/release-notes/windows/1.1.34.md": "Shroom 1.1.34\n\n- 三十四",
      "/release-notes/windows/1.1.10.md": "Shroom 1.1.10\n\n- 十",
      "/release-notes/windows/not-a-version.md": "ignored",
    });

    expect(history.map((item) => item.version)).toEqual([
      "1.1.34",
      "1.1.10",
      "1.1.9",
    ]);
  });

  it("orders stable releases after prereleases", () => {
    expect(compareSemanticVersions("2.0.0", "2.0.0-beta.2")).toBeGreaterThan(0);
    expect(
      compareSemanticVersions("2.0.0-beta.10", "2.0.0-beta.2")
    ).toBeGreaterThan(0);
  });
});
