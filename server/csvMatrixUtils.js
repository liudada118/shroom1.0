function transposeMatColToVisualDirection(data) {
  const source = Array.isArray(data) ? data : [];
  if (source.length !== 160) return source;
  return Array.from({ length: 10 }, (_rowValue, row) => (
    Array.from(
      { length: 16 },
      (_columnValue, column) => source[column * 10 + row],
    )
  )).flat();
}

function getCollectionCsvLabelInfo(value, formatDatePart) {
  const datePart = formatDatePart(value);
  const namePart = datePart.replace(
    /_\d{4}-\d{1,2}-\d{1,2}-\d{2}-\d{2}-\d{2}-\d+$/,
    "",
  );
  if (!namePart || (namePart === datePart && /^\d+$/.test(namePart))) {
    return { label: "", labelText: "" };
  }
  const labelText = namePart.match(/([^_]+_\d+)$/)?.[1] || "";
  const label = labelText.match(/_(\d+)$/)?.[1] || "";
  return { label, labelText };
}

module.exports = {
  getCollectionCsvLabelInfo,
  transposeMatColToVisualDirection,
};
