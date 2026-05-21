export function createPressureFrame({
  values,
  rows,
  cols,
  sensorType,
  timestamp = Date.now(),
  meta = {},
}) {
  const normalizedValues = Array.isArray(values) ? values : []
  const expectedLength = rows * cols

  return {
    values:
      normalizedValues.length >= expectedLength
        ? normalizedValues.slice(0, expectedLength)
        : [...normalizedValues, ...new Array(expectedLength - normalizedValues.length).fill(0)],
    rows,
    cols,
    sensorType,
    timestamp,
    meta,
  }
}

export function isPressureFrame(frame) {
  return Boolean(
    frame &&
      Array.isArray(frame.values) &&
      Number.isInteger(frame.rows) &&
      Number.isInteger(frame.cols) &&
      frame.values.length >= frame.rows * frame.cols
  )
}
