import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MeshoptSimplifier } from "../client/node_modules/meshoptimizer/meshopt_simplifier.module.js";

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const UNSIGNED_INT = 5125;
const MISSING_VERTEX = 0xffffffff;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

function readOption(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const inputPath = path.resolve(projectRoot, readOption("--input", "client/public/model/human3.glb"));
const outputPath = path.resolve(projectRoot, readOption("--output", "client/public/model/human3-low.glb"));
const targetRatio = Number(readOption("--ratio", "0.28"));
const targetError = Number(readOption("--error", "0.01"));

if (!(targetRatio > 0 && targetRatio < 1)) {
  throw new Error(`--ratio must be between 0 and 1, received ${targetRatio}`);
}
if (!(targetError > 0 && targetError <= 1)) {
  throw new Error(`--error must be between 0 and 1, received ${targetError}`);
}

function parseGlb(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC || buffer.readUInt32LE(4) !== 2) {
    throw new Error("Only binary glTF 2.0 input is supported");
  }
  if (buffer.readUInt32LE(8) !== buffer.length) {
    throw new Error("GLB header length does not match the file size");
  }

  let offset = 12;
  let json = null;
  let binary = null;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const payload = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === JSON_CHUNK) {
      json = JSON.parse(payload.toString("utf8").replace(/[\u0000\u0020]+$/u, ""));
    } else if (chunkType === BIN_CHUNK) {
      binary = payload;
    }
    offset += 8 + chunkLength;
  }
  if (!json || !binary) throw new Error("GLB must contain JSON and BIN chunks");
  return { json, binary };
}

const componentCount = (type) => ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type]);
const componentBytes = (componentType) => ({ 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[componentType]);

function readAccessor(gltf, binary, accessorIndex) {
  const accessor = gltf.accessors[accessorIndex];
  const view = gltf.bufferViews[accessor.bufferView];
  if (view.buffer !== 0 || accessor.sparse) throw new Error("Sparse or external accessors are not supported");
  const components = componentCount(accessor.type);
  const bytes = componentBytes(accessor.componentType);
  if (!components || !bytes) throw new Error(`Unsupported accessor ${accessorIndex}`);
  const stride = view.byteStride || components * bytes;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const result = accessor.componentType === FLOAT
    ? new Float32Array(accessor.count * components)
    : new Uint32Array(accessor.count * components);
  const dataView = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);

  for (let element = 0; element < accessor.count; element += 1) {
    const elementOffset = start + element * stride;
    for (let component = 0; component < components; component += 1) {
      const valueOffset = elementOffset + component * bytes;
      const target = element * components + component;
      if (accessor.componentType === FLOAT) result[target] = dataView.getFloat32(valueOffset, true);
      else if (accessor.componentType === 5121) result[target] = dataView.getUint8(valueOffset);
      else if (accessor.componentType === UNSIGNED_SHORT) result[target] = dataView.getUint16(valueOffset, true);
      else if (accessor.componentType === UNSIGNED_INT) result[target] = dataView.getUint32(valueOffset, true);
    }
  }
  return { accessor, components, values: result };
}

function compactAttribute(source, components, remap, uniqueCount) {
  const output = new Float32Array(uniqueCount * components);
  for (let oldIndex = 0; oldIndex < remap.length; oldIndex += 1) {
    const newIndex = remap[oldIndex];
    if (newIndex === MISSING_VERTEX) continue;
    for (let component = 0; component < components; component += 1) {
      output[newIndex * components + component] = source[oldIndex * components + component];
    }
  }
  return output;
}

function getBounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let component = 0; component < 3; component += 1) {
      min[component] = Math.min(min[component], positions[index + component]);
      max[component] = Math.max(max[component], positions[index + component]);
    }
  }
  return { min, max };
}

function fitGeometryToBounds(positions, normals, currentBounds, targetBounds) {
  const scales = currentBounds.min.map((min, component) => {
    const currentRange = currentBounds.max[component] - min;
    const targetRange = targetBounds.max[component] - targetBounds.min[component];
    return currentRange > 0 ? targetRange / currentRange : 1;
  });
  for (let index = 0; index < positions.length; index += 3) {
    for (let component = 0; component < 3; component += 1) {
      positions[index + component] = targetBounds.min[component]
        + (positions[index + component] - currentBounds.min[component]) * scales[component];
    }
    const normalX = normals[index] / scales[0];
    const normalY = normals[index + 1] / scales[1];
    const normalZ = normals[index + 2] / scales[2];
    const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
    normals[index] = normalX / normalLength;
    normals[index + 1] = normalY / normalLength;
    normals[index + 2] = normalZ / normalLength;
  }
  return scales;
}

function padBuffer(buffer, fill = 0) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, fill)]) : buffer;
}

function typedBuffer(values) {
  return Buffer.from(values.buffer, values.byteOffset, values.byteLength);
}

function buildGlb(gltf, binary) {
  const jsonChunk = padBuffer(Buffer.from(JSON.stringify(gltf), "utf8"), 0x20);
  const binaryChunk = padBuffer(binary);
  const totalLength = 12 + 8 + jsonChunk.length + 8 + binaryChunk.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(JSON_CHUNK, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binaryChunk.length, 0);
  binHeader.writeUInt32LE(BIN_CHUNK, 4);
  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binaryChunk]);
}

await MeshoptSimplifier.ready;

const sourceBuffer = fs.readFileSync(inputPath);
const { json: sourceGltf, binary: sourceBinary } = parseGlb(sourceBuffer);
if (sourceGltf.meshes?.length !== 1 || sourceGltf.meshes[0].primitives?.length !== 1) {
  throw new Error("Expected human3.glb to contain exactly one mesh primitive");
}

const primitive = sourceGltf.meshes[0].primitives[0];
if (primitive.mode !== undefined && primitive.mode !== 4) throw new Error("Expected a triangle-list primitive");
const position = readAccessor(sourceGltf, sourceBinary, primitive.attributes.POSITION);
const normal = readAccessor(sourceGltf, sourceBinary, primitive.attributes.NORMAL);
const uv = readAccessor(sourceGltf, sourceBinary, primitive.attributes.TEXCOORD_0);
const index = readAccessor(sourceGltf, sourceBinary, primitive.indices);
if (position.accessor.componentType !== FLOAT || normal.accessor.componentType !== FLOAT || uv.accessor.componentType !== FLOAT) {
  throw new Error("Expected float POSITION, NORMAL and TEXCOORD_0 attributes");
}
if (position.accessor.count !== normal.accessor.count || position.accessor.count !== uv.accessor.count) {
  throw new Error("Vertex attribute counts do not match");
}

const sourceIndices = Uint32Array.from(index.values);
const targetIndexCount = Math.max(3, Math.floor((sourceIndices.length * targetRatio) / 3) * 3);
const [simplifiedIndices, simplificationError] = MeshoptSimplifier.simplify(
  sourceIndices,
  position.values,
  3,
  targetIndexCount,
  targetError,
);
const [remap, uniqueVertexCount] = MeshoptSimplifier.compactMesh(simplifiedIndices);
const compactPositions = compactAttribute(position.values, 3, remap, uniqueVertexCount);
const compactNormals = compactAttribute(normal.values, 3, remap, uniqueVertexCount);
const compactUvs = compactAttribute(uv.values, 2, remap, uniqueVertexCount);
const compactIndices = uniqueVertexCount <= 65535
  ? Uint16Array.from(simplifiedIndices)
  : simplifiedIndices;
const sourceBounds = {
  min: position.accessor.min || getBounds(position.values).min,
  max: position.accessor.max || getBounds(position.values).max,
};
const simplifiedBounds = getBounds(compactPositions);
const boundaryFitScale = fitGeometryToBounds(
  compactPositions,
  compactNormals,
  simplifiedBounds,
  sourceBounds,
);
const bounds = getBounds(compactPositions);

const chunks = [];
const bufferViews = [];
let byteOffset = 0;
function appendChunk(values, target) {
  const buffer = padBuffer(typedBuffer(values));
  const viewIndex = bufferViews.length;
  bufferViews.push({ buffer: 0, byteOffset, byteLength: values.byteLength, target });
  chunks.push(buffer);
  byteOffset += buffer.length;
  return viewIndex;
}

const positionView = appendChunk(compactPositions, ARRAY_BUFFER);
const normalView = appendChunk(compactNormals, ARRAY_BUFFER);
const uvView = appendChunk(compactUvs, ARRAY_BUFFER);
const indexView = appendChunk(compactIndices, ELEMENT_ARRAY_BUFFER);
const outputBinary = Buffer.concat(chunks);
const outputGltf = structuredClone(sourceGltf);
outputGltf.asset = {
  ...outputGltf.asset,
  generator: "Shroom human-body low-poly generator (meshoptimizer 0.18.1)",
  extras: {
    ...(outputGltf.asset?.extras || {}),
    lowPoly: {
      source: path.basename(inputPath),
      targetRatio,
      targetError,
      simplificationError,
      sourceVertices: position.accessor.count,
      sourceTriangles: sourceIndices.length / 3,
      vertices: uniqueVertexCount,
      triangles: compactIndices.length / 3,
      simplifiedBounds,
      boundaryFitScale,
    },
  },
};
outputGltf.buffers = [{ byteLength: outputBinary.length }];
outputGltf.bufferViews = bufferViews;
outputGltf.accessors = [
  { bufferView: positionView, componentType: FLOAT, count: uniqueVertexCount, type: "VEC3", min: bounds.min, max: bounds.max },
  { bufferView: normalView, componentType: FLOAT, count: uniqueVertexCount, type: "VEC3" },
  { bufferView: uvView, componentType: FLOAT, count: uniqueVertexCount, type: "VEC2" },
  {
    bufferView: indexView,
    componentType: compactIndices instanceof Uint16Array ? UNSIGNED_SHORT : UNSIGNED_INT,
    count: compactIndices.length,
    type: "SCALAR",
    min: [0],
    max: [uniqueVertexCount - 1],
  },
];
outputGltf.meshes[0].primitives[0].attributes = { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 };
outputGltf.meshes[0].primitives[0].indices = 3;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, buildGlb(outputGltf, outputBinary));

console.log(JSON.stringify({
  input: path.relative(projectRoot, inputPath),
  output: path.relative(projectRoot, outputPath),
  sourceBytes: sourceBuffer.length,
  outputBytes: fs.statSync(outputPath).size,
  sourceVertices: position.accessor.count,
  outputVertices: uniqueVertexCount,
  sourceTriangles: sourceIndices.length / 3,
  outputTriangles: compactIndices.length / 3,
  targetRatio,
  targetError,
  simplificationError,
  bounds,
  simplifiedBounds,
  boundaryFitScale,
}, null, 2));
