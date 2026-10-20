const readReturnedInteger = (value, maximum) => (
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= maximum
    ? value
    : null
);

export function readJqbedReturnedSettings(reservedBytes) {
  const values = Array.isArray(reservedBytes) ? reservedBytes : [];
  return {
    sensitivity: readReturnedInteger(values[4], 3),
    bedType: readReturnedInteger(values[5], 1),
  };
}

// Omitted/sentinel values mean this frame has no new setting; keep the last valid value in this session.
export function mergeJqbedReturnedSettings(previous, reservedBytes) {
  const next = readJqbedReturnedSettings(reservedBytes);
  return {
    sensitivity: next.sensitivity ?? readReturnedInteger(previous?.sensitivity, 3),
    bedType: next.bedType ?? readReturnedInteger(previous?.bedType, 1),
  };
}

export function sameJqbedReturnedSettings(a, b) {
  return (a?.sensitivity ?? null) === (b?.sensitivity ?? null)
    && (a?.bedType ?? null) === (b?.bedType ?? null);
}
