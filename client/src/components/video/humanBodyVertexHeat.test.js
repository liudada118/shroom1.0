import { describe, expect, it } from "vitest";
import {
  buildNearestSensorMapping,
  computeNearestSensorWeights,
  computeVertexHeatValues,
} from "./humanBodyVertexHeat";

describe("human body nearest sensor vertex heat", () => {
  const sensors = [
    { position: { x: 0, y: 0, z: 0 } },
    { position: { x: 0.1, y: 0, z: 0 } },
    { position: { x: 0.2, y: 0, z: 0 } },
    { position: { x: 0.3, y: 0, z: 0 } },
  ];

  it("keeps only the requested nearest sensors inside the influence distance", () => {
    const mapping = buildNearestSensorMapping(
      new Float32Array([0.04, 0, 0, 2, 0, 0]),
      sensors,
      { neighborCount: 2, maxDistance: 0.5 },
    );

    expect(Array.from(mapping.sensorIndices.slice(0, 2))).toEqual([0, 1]);
    expect(Array.from(mapping.sensorIndices.slice(2, 4))).toEqual([-1, -1]);
  });

  it("uses the original Gaussian formula and clamps interpolated heat", () => {
    const mapping = buildNearestSensorMapping(
      new Float32Array([0, 0, 0]),
      sensors.slice(0, 2),
      { neighborCount: 2, maxDistance: 0.5 },
    );
    computeNearestSensorWeights(mapping, 0.1);

    const values = computeVertexHeatValues(mapping, new Float32Array([0.5, 0.25]), 2);
    const expected = Math.min(1, (0.5 + 0.25 * Math.exp(-0.5)) * 2);
    expect(values[0]).toBeCloseTo(expected, 6);
  });

  it("defaults to the production 12-neighbor mapping", () => {
    const mapping = buildNearestSensorMapping(new Float32Array([0, 0, 0]), sensors);
    expect(mapping.neighborCount).toBe(12);
    expect(mapping.sensorIndices).toHaveLength(12);
  });
});
