const PART_ORIENTATION = Object.freeze({
  back: Object.freeze({ flipRow: true }),
  rightArm: Object.freeze({ flipRow: true }),
});

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

  return {
    sourceRow: orientedRow * (sourceRows - 1),
    sourceCol: normalizedCol * (sourceCols - 1),
  };
}

export function orientPartRows(partKey, rows) {
  return PART_ORIENTATION[partKey]?.flipRow ? [...rows].reverse() : rows;
}
