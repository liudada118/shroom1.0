import { describe, expect, it } from "vitest";
import {
  buildNearestSensorMapping,
  computeHumanBodySensorHeatValue,
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

  it("applies the filter in raw sensor units before the heat display scale", () => {
    expect(computeHumanBodySensorHeatValue(5.9, { max: 1555, filter: 6 })).toBe(0);
    expect(computeHumanBodySensorHeatValue(6, { max: 1555, filter: 6 })).toBeCloseTo(60 / 1555, 6);
    expect(computeHumanBodySensorHeatValue(10, { max: 1555, filter: 60 })).toBe(0);
    expect(computeHumanBodySensorHeatValue(60, { max: 1555, filter: 60 })).toBeCloseTo(600 / 1555, 6);
  });

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

  it("can reuse the 12-neighbor mapping while summing only the nearest 3 or 6", () => {
    const extendedSensors = Array.from({ length: 12 }, (_, index) => ({
      position: { x: index * 0.01, y: 0, z: 0 },
    }));
    const mapping = buildNearestSensorMapping(
      new Float32Array([0, 0, 0]),
      extendedSensors,
      { neighborCount: 12, maxDistance: 0.5 },
    );
    computeNearestSensorWeights(mapping, 1);
    const sensorValues = new Float32Array(12).fill(0.05);

    const nearest3 = computeVertexHeatValues(mapping, sensorValues, 1, undefined, { neighborLimit: 3 });
    const nearest6 = computeVertexHeatValues(mapping, sensorValues, 1, undefined, { neighborLimit: 6 });
    const nearest12 = computeVertexHeatValues(mapping, sensorValues, 1, undefined, { neighborLimit: 12 });
    const expectedNearest3 = Array.from(mapping.weights.slice(0, 3))
      .reduce((total, weight) => total + weight * 0.05, 0);

    expect(nearest3[0]).toBeCloseTo(expectedNearest3, 6);
    expect(nearest3[0]).toBeGreaterThan(0);
    expect(nearest3[0]).toBeLessThan(nearest6[0]);
    expect(nearest6[0]).toBeGreaterThan(0);
    expect(nearest6[0]).toBeLessThan(nearest12[0]);
    expect(mapping.neighborCount).toBe(12);
  });
});
