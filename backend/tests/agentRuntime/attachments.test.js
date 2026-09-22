const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parseAttachment, crc32 } = require('../../agent-runtime/attachments');

/** 构造仅含存储条目的最小工作簿，验证真实 ZIP/XML 输入解析。 */
function zipFiles(files) {
  const locals = [], central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const filename = Buffer.from(name), data = Buffer.from(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
    local.writeUInt32LE(crc32(data), 14);
    locals.push(local, filename, data);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50); header.writeUInt32LE(data.length, 20); header.writeUInt32LE(data.length, 24);
    header.writeUInt32LE(crc32(data), 16);
    header.writeUInt16LE(filename.length, 28); header.writeUInt32LE(offset, 42);
    central.push(header, filename); offset += local.length + filename.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/** 提供带中文表名和共享字符串的最小 OOXML 工作簿。 */
function workbook(sheet) {
  return zipFiles({
    'xl/workbook.xml': '<workbook><sheets><sheet name="点位表" sheetId="2" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>编号 &amp; 通道</t></si></sst>',
    'xl/worksheets/sheet2.xml': sheet,
  });
}

test('reads XLSX sheet relationships, cell addresses and shared/inline strings', () => {
  const bytes = workbook('<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="C3"><v>1024</v></c><c r="D3" t="inlineStr"><is><t>左手</t></is></c></row></sheetData></worksheet>');
  const result = parseAttachment({ name: '点位.xlsx', base64: bytes.toString('base64') });
  const data = JSON.parse(result.text);
  assert.equal(data.sheets[0].sheet, '点位表');
  assert.deepEqual(data.sheets[0].cells, [{ cell: 'A1', value: '编号 & 通道' }, { cell: 'C3', value: '1024' }, { cell: 'D3', value: '左手' }]);
});

test('rejects formulas without cached values instead of fabricating a mapping', () => {
  const bytes = workbook('<worksheet><c r="A1"><f>1+1</f></c></worksheet>');
  assert.throws(() => parseAttachment({ name: 'mapping.xlsx', base64: bytes.toString('base64') }), { code: 'AGENT_ATTACHMENT_FORMULA' });
});

test('empty styled cells cannot consume the next cell or shift point addresses', () => {
  const bytes = workbook('<worksheet><c r="A1" s="1"/><c r="B1"><v>42</v></c><c r="C1"/></worksheet>');
  const result = parseAttachment({ name: 'mapping.xlsx', base64: bytes.toString('base64') });
  assert.deepEqual(JSON.parse(result.text).sheets[0].cells, [{ cell: 'B1', value: '42' }]);
});

test('repeated shared strings are bounded during expansion', () => {
  const bytes = zipFiles({
    'xl/workbook.xml': '<workbook><sheets><sheet name="test" r:id="r1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': `<sst><si><t>${'x'.repeat(50000)}</t></si></sst>`,
    'xl/worksheets/sheet1.xml': `<worksheet>${Array.from({ length: 10 }, (_, i) => `<c r="A${i + 1}" t="s"><v>0</v></c>`).join('')}</worksheet>`,
  });
  assert.throws(() => parseAttachment({ name: 'expanded.xlsx', base64: bytes.toString('base64') }), { code: 'AGENT_ATTACHMENT_LIMIT' });
});

test('rejects malformed archives, unsupported formats, invalid JSON and non-UTF8', () => {
  assert.throws(() => parseAttachment({ name: 'bad.xlsx', base64: Buffer.from('not zip').toString('base64') }));
  assert.throws(() => parseAttachment({ name: 'program.exe', base64: 'YQ==' }), { code: 'AGENT_ATTACHMENT_TYPE' });
  assert.throws(() => parseAttachment({ name: 'bad.json', base64: 'ew==' }), { code: 'AGENT_ATTACHMENT_INVALID' });
  assert.throws(() => parseAttachment({ name: 'bad.txt', base64: Buffer.from([0xff, 0xfe]).toString('base64') }), { code: 'AGENT_ATTACHMENT_ENCODING' });
});

test('rejects ZIP expansion and XML external-entity declarations', () => {
  const expanded = workbook('<worksheet/>');
  const central = expanded.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  expanded.writeUInt32LE(20 * 1024 * 1024, central + 24);
  assert.throws(() => parseAttachment({ name: 'large.xlsx', base64: expanded.toString('base64') }), { code: 'AGENT_ATTACHMENT_LIMIT' });
  const dtd = workbook('<!DOCTYPE x [<!ENTITY x SYSTEM "file:///private">]><worksheet/>');
  assert.throws(() => parseAttachment({ name: 'external.xlsx', base64: dtd.toString('base64') }), { code: 'AGENT_ATTACHMENT_INVALID' });
});

test('checks a known CRC32 vector and rejects modified workbook bytes', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const bytes = workbook('<worksheet><c r="A1"><v>100</v></c></worksheet>');
  bytes[bytes.indexOf(Buffer.from('<v>100')) + 3] = 0x32;
  assert.throws(() => parseAttachment({ name: 'broken.xlsx', base64: bytes.toString('base64') }), { code: 'AGENT_ATTACHMENT_INVALID' });
});
