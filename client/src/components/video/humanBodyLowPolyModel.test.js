import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readGlbJson = (relativeUrl) => {
  const buffer = fs.readFileSync(fileURLToPath(new URL(relativeUrl, import.meta.url)));
  expect(buffer.toString("ascii", 0, 4)).toBe("glTF");
  expect(buffer.readUInt32LE(4)).toBe(2);
  expect(buffer.readUInt32LE(8)).toBe(buffer.length);
  const jsonLength = buffer.readUInt32LE(12);
  expect(buffer.readUInt32LE(16)).toBe(0x4e4f534a);
  return {
    bytes: buffer.length,
    json: JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).trim()),
  };
};

const getPrimitiveMetrics = (document) => {
  const primitive = document.meshes[0].primitives[0];
  const position = document.accessors[primitive.attributes.POSITION];
  const normal = document.accessors[primitive.attributes.NORMAL];
  const uv = document.accessors[primitive.attributes.TEXCOORD_0];
  const indices = document.accessors[primitive.indices];
  return {
    vertices: position.count,
    triangles: indices.count / 3,
    position,
    normal,
    uv,
    indices,
  };
};

describe("human body low-poly model", () => {
  const original = readGlbJson("../../../public/model/human3.glb");
  const lowPoly = readGlbJson("../../../public/model/human3-low.glb");
  const originalMetrics = getPrimitiveMetrics(original.json);
  const lowPolyMetrics = getPrimitiveMetrics(lowPoly.json);

  it("keeps a valid compact mesh while substantially reducing render work", () => {
    expect(lowPoly.json.meshes).toHaveLength(1);
    expect(lowPoly.json.meshes[0].primitives).toHaveLength(1);
    expect(lowPolyMetrics.vertices).toBeLessThan(originalMetrics.vertices * 0.33);
    expect(lowPolyMetrics.triangles).toBeLessThanOrEqual(originalMetrics.triangles * 0.29);
    expect(lowPoly.bytes).toBeLessThan(original.bytes * 0.33);
    expect(lowPolyMetrics.position.count).toBe(lowPolyMetrics.normal.count);
    expect(lowPolyMetrics.position.count).toBe(lowPolyMetrics.uv.count);
    expect([5123, 5125]).toContain(lowPolyMetrics.indices.componentType);
  });

  it("preserves the source coordinate bounds used by sensor projection", () => {
    lowPolyMetrics.position.min.forEach((value, index) => {
      expect(value).toBeCloseTo(originalMetrics.position.min[index], 5);
    });
    lowPolyMetrics.position.max.forEach((value, index) => {
      expect(value).toBeCloseTo(originalMetrics.position.max[index], 5);
    });
  });

  it("loads the low-poly asset first and retains the original model as fallback", () => {
    const source = fs.readFileSync(
      fileURLToPath(new URL("./HumanBodyOptimized.jsx", import.meta.url)),
      "utf8",
    );
    const lowPolyIndex = source.indexOf('"./model/human3-low.glb"');
    const originalIndex = source.indexOf('"./model/human3.glb"');
    expect(lowPolyIndex).toBeGreaterThan(-1);
    expect(originalIndex).toBeGreaterThan(lowPolyIndex);
    expect(source).toContain("loadHumanBodyModel(new GLTFLoader())");
  });
});
