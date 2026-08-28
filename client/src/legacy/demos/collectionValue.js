export function getCollectionFieldValue(fieldName, values) {
  if (!fieldName || typeof fieldName !== 'string') return undefined;
  return values[fieldName.trim()];
}

export function buildCollectionRow(matrixData, area, name, objArea, values) {
  return [
    JSON.stringify(matrixData),
    area,
    name,
    getCollectionFieldValue(name, values),
    objArea,
    getCollectionFieldValue(objArea, values),
  ];
}
