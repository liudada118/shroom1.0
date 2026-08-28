import { isHumanBodyHoverColumnFlipped } from "./humanBodyOrientation";

export const HOVER_MAX_DISTANCE = 0.25;

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function getPointCoordinates(point) {
  if (!point || !isFiniteNumber(point.x) || !isFiniteNumber(point.y) || !isFiniteNumber(point.z)) {
    return null;
  }
  return point;
}

function getSensorCoordinates(sensor) {
  return getPointCoordinates(sensor?.position || sensor);
}

function getGrid(radius) {
  const normalizedRadius = Number.isInteger(radius) && radius >= 0 ? radius : 1;
  const cells = [];
  for (let rowOffset = -normalizedRadius; rowOffset <= normalizedRadius; rowOffset += 1) {
    for (let colOffset = -normalizedRadius; colOffset <= normalizedRadius; colOffset += 1) {
      cells.push({ rowOffset, colOffset });
    }
  }
  return cells;
}

export function getHumanBodySensorValue(sensor, frame) {
  if (!Array.isArray(sensor?.sample) || !Array.isArray(frame)) return 0;

  return sensor.sample.reduce((total, sample) => {
    if (!Number.isInteger(sample?.index) || sample.index < 0 || !isFiniteNumber(sample.weight)) return total;
    const rawValue = frame[sample.index];
    return total + (isFiniteNumber(rawValue) ? rawValue * sample.weight : 0);
  }, 0);
}

export function findNearestHumanBodySensor(point, sensors, maxDistance = HOVER_MAX_DISTANCE) {
  const target = getPointCoordinates(point);
  if (!target || !Array.isArray(sensors) || !isFiniteNumber(maxDistance) || maxDistance < 0) return null;

  const maximumDistanceSquared = maxDistance ** 2;
  let nearest = null;
  let nearestDistanceSquared = Infinity;

  sensors.forEach((sensor) => {
    const candidate = getSensorCoordinates(sensor);
    if (!candidate) return;
    const distanceSquared = (candidate.x - target.x) ** 2
      + (candidate.y - target.y) ** 2
      + (candidate.z - target.z) ** 2;
    if (distanceSquared > maximumDistanceSquared) return;

    const isCloser = distanceSquared < nearestDistanceSquared;
    const isStableTie = distanceSquared === nearestDistanceSquared
      && Number(sensor.index) < Number(nearest?.index);
    if (isCloser || isStableTie) {
      nearest = sensor;
      nearestDistanceSquared = distanceSquared;
    }
  });

  return nearest;
}

export function buildHumanBodySensorNeighborhood(center, sensors, frame, radius = 1) {
  const cells = getGrid(radius);
  if (!center) return cells.map(({ rowOffset, colOffset }) => ({ sensor: null, value: null, rowOffset, colOffset }));

  const matchingSensors = new Map();
  if (Array.isArray(sensors)) {
    sensors.forEach((sensor) => {
      if (sensor?.part === center.part && sensor.placementSide === center.placementSide) {
        matchingSensors.set(`${sensor.row},${sensor.col}`, sensor);
      }
    });
  }

  const flipCol = isHumanBodyHoverColumnFlipped(center.partKey);
  return cells.map(({ rowOffset, colOffset }) => {
    const sourceColOffset = flipCol ? -colOffset : colOffset;
    const sensor = matchingSensors.get(`${center.row + rowOffset},${center.col + sourceColOffset}`) || null;
    return {
      sensor,
      value: sensor ? getHumanBodySensorValue(sensor, frame) : null,
      rowOffset,
      colOffset,
    };
  });
}

export function clampHumanBodyHoverPosition(pointer, panelSize, viewportSize, offset = 18, margin = 8) {
  const pointerX = isFiniteNumber(pointer?.x) ? pointer.x : 0;
  const pointerY = isFiniteNumber(pointer?.y) ? pointer.y : 0;
  const panelWidth = isFiniteNumber(panelSize?.width) && panelSize.width >= 0 ? panelSize.width : 0;
  const panelHeight = isFiniteNumber(panelSize?.height) && panelSize.height >= 0 ? panelSize.height : 0;
  const viewportWidth = isFiniteNumber(viewportSize?.width) && viewportSize.width >= 0 ? viewportSize.width : 0;
  const viewportHeight = isFiniteNumber(viewportSize?.height) && viewportSize.height >= 0 ? viewportSize.height : 0;
  const safeOffset = isFiniteNumber(offset) ? offset : 18;
  const safeMargin = isFiniteNumber(margin) ? Math.max(0, margin) : 8;
  const maxLeft = Math.max(safeMargin, viewportWidth - panelWidth - safeMargin);
  const maxTop = Math.max(safeMargin, viewportHeight - panelHeight - safeMargin);
  const preferredLeft = pointerX + safeOffset;
  const preferredTop = pointerY + safeOffset;
  const left = preferredLeft + panelWidth <= viewportWidth - safeMargin
    ? preferredLeft
    : pointerX - panelWidth - safeOffset;
  const top = preferredTop + panelHeight <= viewportHeight - safeMargin
    ? preferredTop
    : pointerY - panelHeight - safeOffset;

  return {
    left: Math.min(maxLeft, Math.max(safeMargin, left)),
    top: Math.min(maxTop, Math.max(safeMargin, top)),
  };
}
