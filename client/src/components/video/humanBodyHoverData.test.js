import { describe, expect, it } from "vitest";
import {
  HOVER_MAX_DISTANCE,
  buildHumanBodySensorNeighborhood,
  clampHumanBodyHoverPosition,
  findNearestHumanBodySensor,
  getHumanBodySensorValue,
} from "./humanBodyHoverData";

describe("getHumanBodySensorValue", () => {
  it("returns the weighted raw-frame sum without shader scaling", () => {
    expect(getHumanBodySensorValue({ sample: [{ index: 0, weight: 0.25 }, { index: 1, weight: 0.75 }] }, [20, 40])).toBe(35);
  });

  it("treats invalid samples and frame values as zero", () => {
    expect(getHumanBodySensorValue({ sample: [{ index: 0, weight: 1 }, { index: 1, weight: 1 }, { index: -1, weight: 1 }, { index: 2, weight: NaN }, null] }, [NaN, undefined])).toBe(0);
    expect(getHumanBodySensorValue({}, [10])).toBe(0);
  });
});

describe("findNearestHumanBodySensor", () => {
  const sensors = [
    { index: 5, position: { x: 0.1, y: 0, z: 0 } },
    { index: 2, position: { x: -0.1, y: 0, z: 0 } },
    { index: 1, position: { x: 0.3, y: 0, z: 0 } },
  ];

  it("uses squared xyz distance, stable index ties, and the inclusive threshold", () => {
    expect(HOVER_MAX_DISTANCE).toBe(0.25);
    expect(findNearestHumanBodySensor({ x: 0, y: 0, z: 0 }, sensors)).toBe(sensors[1]);
    expect(findNearestHumanBodySensor({ x: 0.05, y: 0, z: 0 }, sensors, 0.25)).toBe(sensors[0]);
    expect(findNearestHumanBodySensor({ x: 0.05, y: 0, z: 0 }, [sensors[1]], 0.15)).toBe(sensors[1]);
  });

  it("returns null outside the threshold or for invalid inputs", () => {
    expect(findNearestHumanBodySensor({ x: 0, y: 0, z: 0 }, sensors, 0.099)).toBeNull();
    expect(findNearestHumanBodySensor(null, sensors)).toBeNull();
    expect(findNearestHumanBodySensor({ x: 0, y: 0, z: 0 }, null)).toBeNull();
  });
});

describe("buildHumanBodySensorNeighborhood", () => {
  const center = { part: "leg", placementSide: "left", row: 1, col: 1, sample: [{ index: 0, weight: 1 }] };
  const matching = [
    center,
    { part: "leg", placementSide: "left", row: 0, col: 0, sample: [{ index: 1, weight: 1 }] },
    { part: "leg", placementSide: "left", row: 1, col: 2, sample: [{ index: 2, weight: 1 }] },
    { part: "leg", placementSide: "right", row: 1, col: 0, sample: [{ index: 3, weight: 1 }] },
  ];

  it("returns a fixed top-left-to-bottom-right 3x3 grid centered at index four", () => {
    const neighborhood = buildHumanBodySensorNeighborhood(center, matching, [10, 20, 30, 40]);
    expect(neighborhood).toHaveLength(9);
    expect(neighborhood.map(({ rowOffset, colOffset }) => [rowOffset, colOffset])).toEqual([
      [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 0], [0, 1], [1, -1], [1, 0], [1, 1],
    ]);
    expect(neighborhood[4]).toMatchObject({ sensor: center, value: 10 });
    expect(neighborhood[0]).toMatchObject({ sensor: matching[1], value: 20 });
    expect(neighborhood[5]).toMatchObject({ sensor: matching[2], value: 30 });
    expect(neighborhood[3]).toMatchObject({ sensor: null, value: null });
  });

  it("keeps a fixed empty grid when no center is supplied", () => {
    expect(buildHumanBodySensorNeighborhood(null, matching, [10])).toEqual([
      { sensor: null, value: null, rowOffset: -1, colOffset: -1 },
      { sensor: null, value: null, rowOffset: -1, colOffset: 0 },
      { sensor: null, value: null, rowOffset: -1, colOffset: 1 },
      { sensor: null, value: null, rowOffset: 0, colOffset: -1 },
      { sensor: null, value: null, rowOffset: 0, colOffset: 0 },
      { sensor: null, value: null, rowOffset: 0, colOffset: 1 },
      { sensor: null, value: null, rowOffset: 1, colOffset: -1 },
      { sensor: null, value: null, rowOffset: 1, colOffset: 0 },
      { sensor: null, value: null, rowOffset: 1, colOffset: 1 },
    ]);
  });
});

describe("clampHumanBodyHoverPosition", () => {
  it("places the panel down-right when there is space", () => {
    expect(clampHumanBodyHoverPosition({ x: 100, y: 100 }, { width: 80, height: 60 }, { width: 300, height: 200 })).toEqual({ left: 118, top: 118 });
  });

  it("flips at right and bottom edges then clamps in tiny viewports", () => {
    expect(clampHumanBodyHoverPosition({ x: 290, y: 190 }, { width: 80, height: 60 }, { width: 300, height: 200 })).toEqual({ left: 192, top: 112 });
    expect(clampHumanBodyHoverPosition({ x: 0, y: 0 }, { width: 80, height: 60 }, { width: 40, height: 30 })).toEqual({ left: 8, top: 8 });
  });
});
