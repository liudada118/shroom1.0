import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  HUMAN_BODY_ACTIVE_FRAME_INTERVAL_MS,
  getHumanBodyRenderPixelRatio,
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

  it("keeps the projection and orbit pivot on the physical screen and body center", () => {
    expect(source).toContain("camera.clearViewOffset()");
    expect(source).toContain("camera.updateProjectionMatrix()");
    expect(source).toContain("controls.target.set(0, 4, 0)");
    expect(source).toContain("controls.enablePan = false");
    expect(source).not.toContain("camera.setViewOffset(");
    expect(source).not.toContain("getBoundingClientRect?.().right");
    expect(source).toContain('window.visualViewport?.addEventListener("resize", resize)');
  });

  it("mounts the full-screen renderer at the document body viewport root", () => {
    expect(source).toContain('import { createPortal } from "react-dom"');
    expect(source).toContain('createPortal(viewportContent, document.body)');
    expect(source).toContain('data-human-body-viewport="true"');
  });

  it("uses adaptive DPR, dirty rendering, 30 fps activity and hidden-page suspension", () => {
    expect(source).toContain("getHumanBodyRenderPixelRatio(window.devicePixelRatio, qualityState.tier)");
    expect(source).toContain("shouldRenderHumanBodyFrame({");
    expect(source).toContain("updateHumanBodyQualityState(qualityState, now - previousRenderAt)");
    expect(source).toContain('document.addEventListener("visibilitychange", handleVisibilityChange)');
    expect(source).toContain("invalidateRenderRef.current();");
  });
});
