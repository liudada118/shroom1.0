const REGION_TO_DATA_PART_KEY = Object.freeze({
  "前胸": "chest",
  "后背": "back",
  "右肩": "leftShoulder",
  "右手臂": "leftArm",
  "左肩": "rightShoulder",
  "左手臂": "rightArm",
});

const PART_ORIENTATION = Object.freeze({
  back: Object.freeze({ flipRow: true }),
  backPantsLeft: Object.freeze({ flipRow: true }),
  backPantsRight: Object.freeze({ flipRow: true }),
});

export function resolveSensorPartKey(region, placementSide) {
  if (region === "前裤") {
    return placementSide === "negative-x" ? "frontPantsLeft" : "frontPantsRight";
  }
  if (region === "后裤") {
    return placementSide === "negative-x" ? "backPantsLeft" : "backPantsRight";
  }
  return REGION_TO_DATA_PART_KEY[region];
}

export function getSourceGridPosition(
  partKey,
  targetRow,
  targetCol,
  targetRows,
  targetCols,
  sourceRows,
  sourceCols,
) {
  const normalizedRow = targetRows > 1 ? (targetRow - 1) / (targetRows - 1) : 0;
  const normalizedCol = targetCols > 1 ? (targetCol - 1) / (targetCols - 1) : 0;
  const orientedRow = PART_ORIENTATION[partKey]?.flipRow
    ? 1 - normalizedRow
    : normalizedRow;
  const orientedCol = PART_ORIENTATION[partKey]?.flipCol
    ? 1 - normalizedCol
    : normalizedCol;

  return {
    sourceRow: orientedRow * (sourceRows - 1),
    sourceCol: orientedCol * (sourceCols - 1),
  };
}

export function orientPartMatrix(partKey, rows) {
  const orientation = PART_ORIENTATION[partKey];
  let result = orientation?.flipRow ? [...rows].reverse() : rows;
  if (orientation?.flipCol) result = result.map((row) => [...row].reverse());
  return result;
}
