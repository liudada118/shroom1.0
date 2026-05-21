export function clearMatrixEdges(values, rows, cols, edgeSize, fillValue = 0) {
  const result = [...values]

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (
        row < edgeSize ||
        row >= rows - edgeSize ||
        col < edgeSize ||
        col >= cols - edgeSize
      ) {
        result[row * cols + col] = fillValue
      }
    }
  }

  return result
}

export function clearMatrixOutsideBounds(
  values,
  rows,
  cols,
  { minRow, maxRow, minCol, maxCol },
  fillValue = 0
) {
  const result = [...values]

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (row < minRow || row > maxRow || col < minCol || col > maxCol) {
        result[row * cols + col] = fillValue
      }
    }
  }

  return result
}

export function mirrorMatrixHorizontal(values, rows, cols) {
  const result = [...values]

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < Math.floor(cols / 2); col += 1) {
      const leftIndex = row * cols + col
      const rightIndex = row * cols + (cols - 1 - col)
      ;[result[leftIndex], result[rightIndex]] = [result[rightIndex], result[leftIndex]]
    }
  }

  return result
}

export function applyThreshold(values, threshold) {
  if (!threshold) {
    return [...values]
  }

  return values.map((value) => (value < threshold ? 0 : value))
}
