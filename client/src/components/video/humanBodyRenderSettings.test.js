import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_HUMAN_BODY_RENDER_SETTINGS,
  HUMAN_BODY_RENDER_SETTINGS_KEY,
  clampHumanBodyRadius,
  getHumanBodyAutoRotate,
  normalizeHumanBodyRenderSettings,
  readHumanBodyRenderSettings,
  writeHumanBodyRenderSettings,
} from "./humanBodyRenderSettings";

describe("human body render settings", () => {
  it("uses the compact rendering defaults", () => {
    expect(DEFAULT_HUMAN_BODY_RENDER_SETTINGS).toMatchObject({
      version: 4,
      mode: "heatmap",
      radius: 0.1,
      intensity: 0.8,
      opacity: 0.15,
      colorScheme: 0,
      bgColor: "#afacac",
      modelColor: "#718096",
      settingsCollapsed: false,
      overviewAutoRotate: true,
    });
  });

  it("clamps every radius input to 0.05 through 0.13", () => {
    expect(clampHumanBodyRadius(-1)).toBe(0.05);
    expect(clampHumanBodyRadius(0.09)).toBe(0.09);
    expect(clampHumanBodyRadius(0.31)).toBe(0.13);
    expect(clampHumanBodyRadius("invalid")).toBe(0.1);
  });

  it("normalizes each invalid field independently", () => {
    expect(normalizeHumanBodyRenderSettings({
      version: 1,
      mode: "points",
      radius: 0.31,
      intensity: -4,
      opacity: 2,
      colorScheme: 8,
      bgColor: "red",
      modelColor: "#123456",
      settingsCollapsed: true,
      overviewAutoRotate: false,
    })).toEqual({
      ...DEFAULT_HUMAN_BODY_RENDER_SETTINGS,
      radius: 0.13,
      modelColor: "#123456",
      settingsCollapsed: true,
      overviewAutoRotate: false,
    });
  });

  it("falls back to defaults for incompatible versions", () => {
    expect(normalizeHumanBodyRenderSettings({
      ...DEFAULT_HUMAN_BODY_RENDER_SETTINGS,
      version: 99,
      radius: 0.05,
    })).toEqual(DEFAULT_HUMAN_BODY_RENDER_SETTINGS);
  });

  it("migrates the old cached defaults without overwriting customized colors", () => {
    expect(normalizeHumanBodyRenderSettings({
      ...DEFAULT_HUMAN_BODY_RENDER_SETTINGS,
      version: 1,
      bgColor: "#0a0a0f",
      modelColor: "#6a7a8a",
    })).toMatchObject({ version: 4, bgColor: "#afacac", modelColor: "#718096" });

    expect(normalizeHumanBodyRenderSettings({
      ...DEFAULT_HUMAN_BODY_RENDER_SETTINGS,
      version: 1,
      bgColor: "#10152b",
      modelColor: "#4a5568",
    })).toMatchObject({ version: 4, bgColor: "#10152b", modelColor: "#4a5568" });
  });

  it("migrates the version two defaults to the latest colors", () => {
    expect(normalizeHumanBodyRenderSettings({
      ...DEFAULT_HUMAN_BODY_RENDER_SETTINGS,
      version: 2,
      bgColor: "#e6e6e6",
      modelColor: "#d2d6dc",
    })).toMatchObject({ version: 4, bgColor: "#afacac", modelColor: "#718096" });

    expect(normalizeHumanBodyRenderSettings({
      ...DEFAULT_HUMAN_BODY_RENDER_SETTINGS,
      version: 2,
      bgColor: "#10152b",
      modelColor: "#4a5568",
    })).toMatchObject({ version: 4, bgColor: "#10152b", modelColor: "#4a5568" });
  });

  it("migrates only the version three default radius", () => {
    expect(normalizeHumanBodyRenderSettings({
      ...DEFAULT_HUMAN_BODY_RENDER_SETTINGS,
      version: 3,
      radius: 0.13,
    })).toMatchObject({ version: 4, radius: 0.1 });

    expect(normalizeHumanBodyRenderSettings({
      ...DEFAULT_HUMAN_BODY_RENDER_SETTINGS,
      version: 3,
      radius: 0.08,
    })).toMatchObject({ version: 4, radius: 0.08 });
  });

  it("reads and writes one safe versioned localStorage object", () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };

    expect(readHumanBodyRenderSettings(storage)).toEqual(DEFAULT_HUMAN_BODY_RENDER_SETTINGS);
    expect(writeHumanBodyRenderSettings(storage, {
      ...DEFAULT_HUMAN_BODY_RENDER_SETTINGS,
      mode: "crystal",
      radius: 0.08,
    })).toBe(true);
    expect(JSON.parse(values.get(HUMAN_BODY_RENDER_SETTINGS_KEY))).toMatchObject({ mode: "crystal", radius: 0.08 });
    expect(readHumanBodyRenderSettings(storage)).toMatchObject({ mode: "crystal", radius: 0.08 });
  });

  it("survives broken storage and malformed JSON", () => {
    expect(readHumanBodyRenderSettings({ getItem: () => "{" })).toEqual(DEFAULT_HUMAN_BODY_RENDER_SETTINGS);
    expect(readHumanBodyRenderSettings({ getItem: () => { throw new Error("denied"); } })).toEqual(DEFAULT_HUMAN_BODY_RENDER_SETTINGS);
    expect(writeHumanBodyRenderSettings({ setItem: () => { throw new Error("denied"); } }, {})).toBe(false);
  });
});

describe("human body overview rotation", () => {
  it("rotates only for an unsuspended overview with the saved preference enabled", () => {
    expect(getHumanBodyAutoRotate({ activeRegion: "overview", overviewAutoRotate: true, temporarilySuspended: false })).toBe(true);
    expect(getHumanBodyAutoRotate({ activeRegion: "overview", overviewAutoRotate: false, temporarilySuspended: false })).toBe(false);
    expect(getHumanBodyAutoRotate({ activeRegion: "chest", overviewAutoRotate: true, temporarilySuspended: false })).toBe(false);
    expect(getHumanBodyAutoRotate({ activeRegion: "overview", overviewAutoRotate: true, temporarilySuspended: true })).toBe(false);
  });
});

describe("human body optimized settings UI source contract", () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL("./HumanBodyOptimized.jsx", import.meta.url)),
    "utf8",
  );

  it("connects the model color to the heatmap and crystal shader", () => {
    expect(source).toContain("uniform vec3 uModelColor");
    expect(source).toContain("uModelColor: { value: new THREE.Color(modelColor) }");
  });

  it("clamps imperative and prop-driven radius updates", () => {
    expect(source).toContain("setRadius(clampHumanBodyRadius(Number(size) / 100))");
    expect(source).toContain("setRadius(clampHumanBodyRadius(Number(externalSize) / 100))");
  });

  it("shows only heatmap and crystal with the compact radius range", () => {
    expect(source).toContain('const VISIBLE_RENDER_MODES = [');
    expect(source).not.toContain('["lines", "线网"]');
    expect(source).not.toContain('["points", "点云"]');
    expect(source).not.toContain('["both", "叠加"]');
    expect(source).toMatch(/type="range" min="5" max="13" step="1"/);
  });

  it("offers an accessible collapsible settings panel without point-cloud color controls", () => {
    expect(source).toContain("aria-expanded={!settingsCollapsed}");
    expect(source).not.toContain('<ColorRow label="线条 / 点云"');
  });

  it("shows the rotation preference only for the overview", () => {
    expect(source).toContain('activeRegion === "overview"');
    expect(source).toContain("toggleOverviewAutoRotate");
    expect(source).toContain("temporarilySuspended || dragging || Boolean(flightRef.current)");
  });
});
