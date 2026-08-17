import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  HUMAN_BODY_ACTIVE_FRAME_INTERVAL_MS,
  getHumanBodyRenderPixelRatio,
  getHumanBodyViewOffsetX,
  getHumanBodyVisualCenter,
  shouldRenderHumanBodyFrame,
  updateHumanBodyQualityState,
} from "./humanBodyRenderPerformance";

describe("human body render performance", () => {
  it("caps balanced and low-power pixel ratios without upscaling small displays", () => {
    expect(getHumanBodyRenderPixelRatio(2, "balanced")).toBe(1.25);
    expect(getHumanBodyRenderPixelRatio(2, "low")).toBe(1);
    expect(getHumanBodyRenderPixelRatio(0.9, "balanced")).toBe(0.9);
    expect(getHumanBodyRenderPixelRatio(undefined, "balanced")).toBe(1);
  });

  it("centers the model inside the unobstructed space between side panels", () => {
    expect(getHumanBodyVisualCenter({
      width: 1920,
      leftPanelRight: 587,
      rightPanelLeft: 1780,
    })).toBe(1183.5);
    expect(getHumanBodyViewOffsetX(1920, 1183.5)).toBe(-223.5);
  });

  it("falls back to the physical viewport center when panels leave too little room", () => {
    expect(getHumanBodyVisualCenter({
      width: 640,
      leftPanelRight: 400,
      rightPanelLeft: 520,
    })).toBe(320);
    expect(getHumanBodyVisualCenter({ width: 1000 })).toBe(500);
  });

  it("drops quality after sustained slow frames and recovers only after stability", () => {
    let state = { tier: "balanced", slowFrames: 0, stableFrames: 0 };
    for (let index = 0; index < 9; index += 1) state = updateHumanBodyQualityState(state, 48);
    expect(state.tier).toBe("balanced");
    state = updateHumanBodyQualityState(state, 48);
    expect(state).toEqual({ tier: "low", slowFrames: 0, stableFrames: 0 });

    for (let index = 0; index < 179; index += 1) state = updateHumanBodyQualityState(state, 34);
    expect(state.tier).toBe("low");
    state = updateHumanBodyQualityState(state, 34);
    expect(state).toEqual({ tier: "balanced", slowFrames: 0, stableFrames: 0 });
  });

  it("renders dirty static frames once and caps continuous activity at 30 fps", () => {
    expect(shouldRenderHumanBodyFrame({ visible: true, dirty: true, continuous: false })).toBe(true);
    expect(shouldRenderHumanBodyFrame({ visible: true, dirty: false, continuous: false })).toBe(false);
    expect(shouldRenderHumanBodyFrame({
      visible: true,
      dirty: false,
      continuous: true,
      now: HUMAN_BODY_ACTIVE_FRAME_INTERVAL_MS - 1,
      lastRenderAt: 0,
    })).toBe(false);
    expect(shouldRenderHumanBodyFrame({
      visible: true,
      dirty: false,
      continuous: true,
      now: HUMAN_BODY_ACTIVE_FRAME_INTERVAL_MS,
      lastRenderAt: 0,
    })).toBe(true);
    expect(shouldRenderHumanBodyFrame({ visible: false, dirty: true, continuous: true })).toBe(false);
  });
});

describe("human body optimized performance wiring", () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL("./HumanBodyOptimized.jsx", import.meta.url)),
    "utf8",
  );

  it("measures both overlay panels and recenters the camera on every viewport change", () => {
    expect(source).toContain("settingsPanelRef.current?.getBoundingClientRect?.().right");
    expect(source).toContain("regionPanelRef.current?.getBoundingClientRect?.().left");
    expect(source).toContain("camera.setViewOffset(width, height, viewOffsetX, 0, width, height)");
    expect(source).toContain('window.visualViewport?.addEventListener("resize", resize)');
  });

  it("uses adaptive DPR, dirty rendering, 30 fps activity and hidden-page suspension", () => {
    expect(source).toContain("getHumanBodyRenderPixelRatio(window.devicePixelRatio, qualityState.tier)");
    expect(source).toContain("shouldRenderHumanBodyFrame({");
    expect(source).toContain("updateHumanBodyQualityState(qualityState, now - previousRenderAt)");
    expect(source).toContain('document.addEventListener("visibilitychange", handleVisibilityChange)');
    expect(source).toContain("invalidateRenderRef.current();");
  });
});
