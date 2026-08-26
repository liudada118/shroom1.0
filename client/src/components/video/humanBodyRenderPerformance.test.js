import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  HUMAN_BODY_BALANCED_FRAME_INTERVAL_MS,
  HUMAN_BODY_DATA_FRAME_INTERVAL_MS,
  HUMAN_BODY_LOW_POWER_FRAME_INTERVAL_MS,
  getHumanBodyRenderFrameInterval,
  getHumanBodyRenderPixelRatio,
  pinHumanBodyCanvasToViewport,
  shouldRenderHumanBodyFrame,
  updateHumanBodyQualityState,
} from "./humanBodyRenderPerformance";

describe("human body render performance", () => {
  it("caps balanced and low-power pixel ratios without upscaling small displays", () => {
    expect(getHumanBodyRenderPixelRatio(2, "balanced")).toBe(1);
    expect(getHumanBodyRenderPixelRatio(2, "low")).toBe(0.75);
    expect(getHumanBodyRenderPixelRatio(0.9, "balanced")).toBe(0.9);
    expect(getHumanBodyRenderPixelRatio(0.9, "low")).toBe(0.75);
    expect(getHumanBodyRenderPixelRatio(undefined, "balanced")).toBe(1);
  });

  it("pins the canvas CSS box while DPR only changes its backing buffer", () => {
    const canvas = { style: {} };
    expect(pinHumanBodyCanvasToViewport(canvas)).toBe(true);
    expect(canvas.style).toEqual({
      position: "absolute",
      inset: "0",
      display: "block",
      width: "100%",
      height: "100%",
    });
    expect(pinHumanBodyCanvasToViewport(null)).toBe(false);
  });

  it("uses 24 fps when balanced and 18 fps after entering low-power mode", () => {
    expect(getHumanBodyRenderFrameInterval("balanced")).toBe(HUMAN_BODY_BALANCED_FRAME_INTERVAL_MS);
    expect(getHumanBodyRenderFrameInterval("low")).toBe(HUMAN_BODY_LOW_POWER_FRAME_INTERVAL_MS);
  });

  it("prioritizes fresh heat data at 30 fps independently of the camera animation tier", () => {
    expect(shouldRenderHumanBodyFrame({
      visible: true,
      dirty: true,
      continuous: true,
      qualityTier: "low",
      dataPending: true,
      now: HUMAN_BODY_DATA_FRAME_INTERVAL_MS - 1,
      lastRenderAt: 0,
    })).toBe(false);
    expect(shouldRenderHumanBodyFrame({
      visible: true,
      dirty: true,
      continuous: true,
      qualityTier: "low",
      dataPending: true,
      now: HUMAN_BODY_DATA_FRAME_INTERVAL_MS,
      lastRenderAt: 0,
    })).toBe(true);
  });

  it("drops quality quickly but waits about half a minute before trying to recover", () => {
    let state = { tier: "balanced", slowFrames: 0, stableFrames: 0 };
    for (let index = 0; index < 7; index += 1) state = updateHumanBodyQualityState(state, 50);
    expect(state.tier).toBe("balanced");
    state = updateHumanBodyQualityState(state, 50);
    expect(state).toEqual({ tier: "low", slowFrames: 0, stableFrames: 0 });

    for (let index = 0; index < 599; index += 1) state = updateHumanBodyQualityState(state, 60);
    expect(state.tier).toBe("low");
    state = updateHumanBodyQualityState(state, 60);
    expect(state).toEqual({ tier: "balanced", slowFrames: 0, stableFrames: 0 });
  });

  it("renders dirty static frames once and applies the active tier frame cap", () => {
    expect(shouldRenderHumanBodyFrame({ visible: true, dirty: true, continuous: false })).toBe(true);
    expect(shouldRenderHumanBodyFrame({ visible: true, dirty: false, continuous: false })).toBe(false);
    expect(shouldRenderHumanBodyFrame({
      visible: true,
      dirty: false,
      continuous: true,
      qualityTier: "balanced",
      now: HUMAN_BODY_BALANCED_FRAME_INTERVAL_MS - 1,
      lastRenderAt: 0,
    })).toBe(false);
    expect(shouldRenderHumanBodyFrame({
      visible: true,
      dirty: false,
      continuous: true,
      qualityTier: "balanced",
      now: HUMAN_BODY_BALANCED_FRAME_INTERVAL_MS,
      lastRenderAt: 0,
    })).toBe(true);
    expect(shouldRenderHumanBodyFrame({
      visible: true,
      dirty: false,
      continuous: true,
      qualityTier: "low",
      now: HUMAN_BODY_BALANCED_FRAME_INTERVAL_MS,
      lastRenderAt: 0,
    })).toBe(false);
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
    expect(source).toContain("pinHumanBodyCanvasToViewport(renderer.domElement)");
    expect(source).toContain("renderer.setSize(width, height, false)");
  });

  it("mounts the full-screen renderer at the document body viewport root", () => {
    expect(source).toContain('import { createPortal } from "react-dom"');
    expect(source).toContain('createPortal(viewportContent, document.body)');
    expect(source).toContain('data-human-body-viewport="true"');
  });

  it("uses adaptive DPR, tiered frame caps, dirty rendering and hidden-page suspension", () => {
    expect(source).toContain("getHumanBodyRenderPixelRatio(window.devicePixelRatio, qualityState.tier)");
    expect(source).toContain("shouldRenderHumanBodyFrame({");
    expect(source).toContain("qualityTier: qualityState.tier");
    expect(source).toContain("dataPending: hasPendingFrameUpdate");
    expect(source).toContain("updateHumanBodyQualityState(qualityState, now - previousRenderAt)");
    expect(source).toContain('document.addEventListener("visibilitychange", handleVisibilityChange)');
    expect(source).toContain("invalidateRenderRef.current();");
  });

  it("coalesces serial frames and uploads only the latest frame at render cadence", () => {
    expect(source).toContain("frameUpdatePendingRef.current = true");
    expect(source).toContain("const hasPendingFrameUpdate = frameUpdatePendingRef.current");
    expect(source).toContain("const flushPendingFrameUpdate = () => {");
    expect(source).toContain("flushPendingFrameUpdate();");
    expect(source).toContain("latestFrame[index] = Number(wsPointData[index]) || 0");
  });
});
