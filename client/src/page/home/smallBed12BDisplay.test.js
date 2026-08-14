import { describe, expect, it } from "vitest";
import {
  getDisplayOptions,
  getInitialDisplayState,
  getMatrixSize,
  normalizeMatrixMode,
  normalizeRendererConfig,
  normalizeSamplePoint,
} from "./smallBed12BDisplay";

describe("smallBed12B display options", () => {
  it("accepts only 32x32 and 16x16 modes", () => {
    expect(normalizeMatrixMode("16x16")).toBe("16x16");
    expect(normalizeMatrixMode("8x8")).toBe("32x32");
  });

  it("falls back to topLeft for an invalid sampling point", () => {
    expect(normalizeSamplePoint("bottomRight")).toBe("bottomRight");
    expect(normalizeSamplePoint("center")).toBe("topLeft");
  });

  it("returns matching dimensions and websocket options for 16x16", () => {
    expect(getMatrixSize("16x16")).toEqual({ width: 16, height: 16 });
    expect(getDisplayOptions("16x16", "topRight")).toEqual({
      matrixMode: "16x16",
      samplePoint: "topRight",
    });
  });

  it("restores display settings from storage", () => {
    const storage = {
      getItem: (key) => (key.includes("MatrixMode") ? "16x16" : "bottomLeft"),
    };
    expect(getInitialDisplayState(storage)).toMatchObject({
      smallBed12BRealtimeMatrixMode: "16x16",
      smallBed12BRealtimeSamplePoint: "bottomLeft",
      smallBedMatrixWidth: 16,
      smallBedMatrixHeight: 16,
    });
  });

  it("migrates legacy ADC renderer settings to kPa defaults", () => {
    expect(normalizeRendererConfig({
      valueg1: 2,
      valuej1: 2205,
      valuel1: 5,
      valuef1: 6,
      value1: 0.1,
      valuelInit1: 500,
    })).toEqual({
      valueg1: 2,
      valuej1: 25,
      valuel1: 2,
      valuef1: 0,
      value1: 0.1,
      valuelInit1: 0,
    });
  });
});
