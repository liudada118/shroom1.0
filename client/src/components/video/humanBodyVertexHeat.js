export const HUMAN_BODY_VERTEX_NEIGHBOR_COUNT = 12;
export const HUMAN_BODY_VERTEX_MAX_DISTANCE = 0.52;
export const HUMAN_BODY_SENSOR_HEAT_SCALE = 10;
const DEFAULT_CELL_SIZE = 0.26;

const cellCoordinate = (value, cellSize) => Math.floor(Number(value) / cellSize);
const cellKey = (x, y, z) => `${x},${y},${z}`;

export function computeHumanBodySensorHeatValue(rawValue, options = {}) {
  const numericRawValue = Number(rawValue);
  const safeRawValue = Number.isFinite(numericRawValue) ? Math.max(0, numericRawValue) : 0;
  const safeMax = Math.max(1, Number(options.max) || 1);
  const filter = Math.max(0, Number(options.filter) || 0);
  if (safeRawValue < filter) return 0;
  return Math.min(1, (safeRawValue * HUMAN_BODY_SENSOR_HEAT_SCALE) / safeMax);
}

function insertNearest(indices, distancesSquared, offset, count, sensorIndex, distanceSquared) {
  let insertion = count;
  for (let index = 0; index < count; index += 1) {
    if (distanceSquared < distancesSquared[offset + index]) {
      insertion = index;
      break;
    }
  }
  if (insertion >= count) return;
  for (let index = count - 1; index > insertion; index -= 1) {
    indices[offset + index] = indices[offset + index - 1];
    distancesSquared[offset + index] = distancesSquared[offset + index - 1];
  }
  indices[offset + insertion] = sensorIndex;
  distancesSquared[offset + insertion] = distanceSquared;
}

export function buildNearestSensorMapping(vertexPositions, sensors, options = {}) {
  const neighborCount = Math.max(1, Math.trunc(options.neighborCount || HUMAN_BODY_VERTEX_NEIGHBOR_COUNT));
  const maxDistance = Number(options.maxDistance || HUMAN_BODY_VERTEX_MAX_DISTANCE);
  const cellSize = Number(options.cellSize || DEFAULT_CELL_SIZE);
  const vertexCount = Math.floor((vertexPositions?.length || 0) / 3);
  const sensorIndices = new Int16Array(vertexCount * neighborCount);
  sensorIndices.fill(-1);
  const distancesSquared = new Float32Array(vertexCount * neighborCount);
  distancesSquared.fill(Number.POSITIVE_INFINITY);
  const weights = new Float32Array(vertexCount * neighborCount);
  const buckets = new Map();

  sensors.forEach((sensor, sensorIndex) => {
    const position = sensor.position || sensor;
    const key = cellKey(
      cellCoordinate(position.x, cellSize),
      cellCoordinate(position.y, cellSize),
      cellCoordinate(position.z, cellSize),
    );
    const bucket = buckets.get(key) || [];
    bucket.push(sensorIndex);
    buckets.set(key, bucket);
  });

  const cellRadius = Math.ceil(maxDistance / cellSize);
  const maxDistanceSquared = maxDistance * maxDistance;
  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    const x = Number(vertexPositions[vertexIndex * 3]);
    const y = Number(vertexPositions[vertexIndex * 3 + 1]);
    const z = Number(vertexPositions[vertexIndex * 3 + 2]);
    const centerX = cellCoordinate(x, cellSize);
    const centerY = cellCoordinate(y, cellSize);
    const centerZ = cellCoordinate(z, cellSize);
    const offset = vertexIndex * neighborCount;

    for (let cellX = centerX - cellRadius; cellX <= centerX + cellRadius; cellX += 1) {
      for (let cellY = centerY - cellRadius; cellY <= centerY + cellRadius; cellY += 1) {
        for (let cellZ = centerZ - cellRadius; cellZ <= centerZ + cellRadius; cellZ += 1) {
          const bucket = buckets.get(cellKey(cellX, cellY, cellZ));
          if (!bucket) continue;
          bucket.forEach((sensorIndex) => {
            const position = sensors[sensorIndex].position || sensors[sensorIndex];
            const dx = x - Number(position.x);
            const dy = y - Number(position.y);
            const dz = z - Number(position.z);
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            if (distanceSquared <= maxDistanceSquared) {
              insertNearest(sensorIndices, distancesSquared, offset, neighborCount, sensorIndex, distanceSquared);
            }
          });
        }
      }
    }
  }

  return { vertexCount, neighborCount, sensorIndices, distancesSquared, weights };
}

export function computeNearestSensorWeights(mapping, radius) {
  const safeRadius = Math.max(0.000001, Number(radius) || 0);
  const denominator = 2 * safeRadius * safeRadius;
  for (let index = 0; index < mapping.weights.length; index += 1) {
    mapping.weights[index] = mapping.sensorIndices[index] < 0
      ? 0
      : Math.exp(-mapping.distancesSquared[index] / denominator);
  }
  return mapping.weights;
}

export function computeVertexHeatValues(mapping, sensorValues, intensity = 1, target, options = {}) {
  const output = target || new Float32Array(mapping.vertexCount);
  const safeIntensity = Number.isFinite(Number(intensity)) ? Number(intensity) : 1;
  const requestedNeighborLimit = Math.trunc(Number(options.neighborLimit));
  const neighborLimit = Number.isFinite(requestedNeighborLimit) && requestedNeighborLimit > 0
    ? Math.min(mapping.neighborCount, requestedNeighborLimit)
    : mapping.neighborCount;
  for (let vertexIndex = 0; vertexIndex < mapping.vertexCount; vertexIndex += 1) {
    const offset = vertexIndex * mapping.neighborCount;
    let heat = 0;
    for (let neighborIndex = 0; neighborIndex < neighborLimit; neighborIndex += 1) {
      const mappingIndex = offset + neighborIndex;
      const sensorIndex = mapping.sensorIndices[mappingIndex];
      if (sensorIndex < 0) break;
      heat += (Number(sensorValues[sensorIndex]) || 0) * mapping.weights[mappingIndex];
    }
    output[vertexIndex] = Math.min(1, Math.max(0, heat * safeIntensity));
  }
  return output;
}
