const fs = require("node:fs");
const { createObjectCsvStringifier } = require("csv-writer");

const CSV_UTF8_BOM = "\ufeff";

async function writeCsvRecordsWithBom(csvFilePath, header, records = []) {
  const stringifier = createObjectCsvStringifier({ header });
  const content = CSV_UTF8_BOM
    + stringifier.getHeaderString()
    + stringifier.stringifyRecords(records);
  await fs.promises.writeFile(csvFilePath, content, "utf8");
}

function createUtf8BomCsvWriter({ path, header }) {
  return {
    writeRecords: (records) => writeCsvRecordsWithBom(path, header, records),
  };
}

function prefixCsvHeaderWithBom(headerText) {
  return CSV_UTF8_BOM + headerText;
}

module.exports = {
  CSV_UTF8_BOM,
  createUtf8BomCsvWriter,
  prefixCsvHeaderWithBom,
  writeCsvRecordsWithBom,
};
