const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createUtf8BomCsvWriter, CSV_UTF8_BOM } = require("../server/csvUtf8");
const {
  getCollectionCsvLabelInfo,
  transposeMatColToVisualDirection,
} = require("../server/csvMatrixUtils");

test("CSV output starts with a UTF-8 BOM and preserves Chinese text", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shroom-csv-"));
  const file = path.join(directory, "test.csv");
  try {
    await createUtf8BomCsvWriter({
      path: file,
      header: [{ id: "name", title: "名称" }],
    }).writeRecords([{ name: "小床" }]);
    const content = fs.readFileSync(file, "utf8");
    assert.equal(content[0], CSV_UTF8_BOM);
    assert.match(content, /名称/);
    assert.match(content, /小床/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("matCol converts stored 16x10 rows into the visual 10x16 direction", () => {
  const source = Array.from({ length: 160 }, (_value, index) => index);
  const result = transposeMatColToVisualDirection(source);
  assert.equal(result.length, 160);
  assert.deepEqual(result.slice(0, 4), [0, 10, 20, 30]);
});

test("collection names expose both numeric and descriptive labels", () => {
  assert.deepEqual(getCollectionCsvLabelInfo(
    "样本_硬度_3_2026-06-30-10-00-00-1",
    (value) => value,
  ), {
    label: "3",
    labelText: "硬度_3",
  });
});
