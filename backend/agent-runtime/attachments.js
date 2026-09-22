const path = require('path');
const zlib = require('zlib');
const { randomUUID, createHash } = require('crypto');
const { agentError } = require('./errors');

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 120000;
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.json', '.csv', '.tsv', '.log']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

/** 根据文件签名识别可发送给模型的图片，不接受 SVG 或伪装的文本。 */
function imageMime(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 10 && /^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6))) return 'image/gif';
  return null;
}
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

/** 校验 ZIP 单元内容，防止损坏的点位值被静默使用。 */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** 解析纯 XML 文本实体；不处理 DTD、外部实体或执行内容。 */
function xmlText(value) {
  return value.replace(/<[^>]*>/g, '').replace(/&#(x[0-9a-f]+|\d+);|&(lt|gt|amp|quot|apos);/gi, (match, numeric, named) => {
    if (numeric) {
      const code = numeric[0].toLowerCase() === 'x' ? parseInt(numeric.slice(1), 16) : Number(numeric);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd';
    }
    return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[named.toLowerCase()];
  });
}

/** 提取 OOXML 属性，只用于有限大小的工作簿元数据。 */
function xmlAttribute(tag, name) {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}=["']([^"']*)["']`));
  return match ? xmlText(match[1]) : '';
}

/** 从 ZIP 中按白名单读取工作表 XML，不把压缩包解压到文件系统。 */
function readWorkbookZip(bytes) {
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) { end = offset; break; }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) throw agentError('AGENT_ATTACHMENT_INVALID', 'XLSX 压缩结构无效或不支持分卷文件。');
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16), total = 0;
  const entries = new Map();
  if (count > 256) throw agentError('AGENT_ATTACHMENT_LIMIT', '工作簿包含过多文件，请仅保留需要的点位表。');
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) throw agentError('AGENT_ATTACHMENT_INVALID', 'XLSX 文件目录损坏。');
    const flags = bytes.readUInt16LE(offset + 8), method = bytes.readUInt16LE(offset + 10);
    const expectedCrc = bytes.readUInt32LE(offset + 16);
    const compressed = bytes.readUInt32LE(offset + 20), size = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28), extraLength = bytes.readUInt16LE(offset + 30), commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > end) throw agentError('AGENT_ATTACHMENT_INVALID', 'XLSX 文件目录长度无效。');
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    offset = next;
    if (!/^xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(name)) continue;
    total += size;
    if (entries.has(name) || flags & 1 || ![0, 8].includes(method) || size > 4 * 1024 * 1024 || total > 12 * 1024 * 1024) {
      throw agentError('AGENT_ATTACHMENT_LIMIT', 'XLSX 内容过大、已加密或包含不支持的结构。');
    }
    if (localOffset + 30 > bytes.length || bytes.readUInt32LE(localOffset) !== 0x04034b50) throw agentError('AGENT_ATTACHMENT_INVALID', 'XLSX 文件头无效。');
    const start = localOffset + 30 + bytes.readUInt16LE(localOffset + 26) + bytes.readUInt16LE(localOffset + 28);
    if (start + compressed > bytes.length) throw agentError('AGENT_ATTACHMENT_INVALID', 'XLSX 数据不完整。');
    let content;
    try {
      const data = bytes.subarray(start, start + compressed);
      content = method === 8 ? zlib.inflateRawSync(data, { maxOutputLength: 4 * 1024 * 1024 }) : data;
    } catch { throw agentError('AGENT_ATTACHMENT_INVALID', 'XLSX 内容无法解压。'); }
    if (content.length !== size || crc32(content) !== expectedCrc) throw agentError('AGENT_ATTACHMENT_INVALID', 'XLSX 内容校验失败，文件可能已损坏。');
    const text = content.toString('utf8');
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw agentError('AGENT_ATTACHMENT_INVALID', '工作簿包含不支持的 XML 声明。');
    entries.set(name, text);
  }
  return entries;
}

/** 提取 XLSX 单元格地址和缓存值；不执行公式、宏或外部连接。 */
function extractWorkbook(bytes) {
  const files = readWorkbookZip(bytes);
  const strings = [...(files.get('xl/sharedStrings.xml') || '').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((item) => xmlText(item[1])).join(''));
  const relations = new Map();
  for (const match of (files.get('xl/_rels/workbook.xml.rels') || '').matchAll(/<Relationship\b([^>]*?)\/?\s*>/g)) {
    const target = xmlAttribute(match[1], 'Target');
    if (xmlAttribute(match[1], 'TargetMode') === 'External') continue;
    const file = target.startsWith('/') ? target.slice(1) : path.posix.normalize(`xl/${target}`);
    relations.set(xmlAttribute(match[1], 'Id'), file);
  }
  const sheets = [];
  let count = 0, extractedChars = 200;
  for (const match of (files.get('xl/workbook.xml') || '').matchAll(/<sheet\b([^>]*?)\/?\s*>/g)) {
    const name = xmlAttribute(match[1], 'name');
    const xml = files.get(relations.get(xmlAttribute(match[1], 'r:id')));
    if (!xml) throw agentError('AGENT_ATTACHMENT_INVALID', '工作簿存在无法读取的工作表。');
    if (sheets.length >= 8) throw agentError('AGENT_ATTACHMENT_LIMIT', '一次最多读取 8 个工作表。');
    const cells = [];
    const addresses = new Set();
    extractedChars += name.length + 32;
    for (const cell of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      if (++count > 12000) throw agentError('AGENT_ATTACHMENT_LIMIT', '工作簿单元格过多，请仅保留需要的数据。');
      const type = xmlAttribute(cell[1], 't'), address = xmlAttribute(cell[1], 'r');
      if (!/^[A-Z]{1,3}[1-9]\d{0,6}$/.test(address) || addresses.has(address)) throw agentError('AGENT_ATTACHMENT_INVALID', '工作表含无效或重复的单元格地址。');
      addresses.add(address);
      const body = cell[2] || '';
      const cached = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
      let value = cached ? xmlText(cached[1]) : '';
      if (type === 's') {
        if (!/^\d+$/.test(value) || strings[Number(value)] === undefined) throw agentError('AGENT_ATTACHMENT_INVALID', '工作簿共享文本索引无效。');
        value = strings[Number(value)];
      }
      if (type === 'inlineStr') value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((item) => xmlText(item[1])).join('');
      if (/<f\b/.test(body) && !cached) throw agentError('AGENT_ATTACHMENT_FORMULA', '工作簿含没有缓存值的公式，请在 Excel 重新计算并保存，或导出 CSV。');
      if (type === 'e') throw agentError('AGENT_ATTACHMENT_FORMULA', '工作簿含公式错误，请先修正再导入。');
      if (value) {
        const item = { cell: address, value };
        extractedChars += JSON.stringify(item).length + 1;
        if (extractedChars > MAX_TEXT_CHARS) throw agentError('AGENT_ATTACHMENT_LIMIT', '工作簿展开文本超过 12 万字符，请拆分资料。');
        cells.push(item);
      }
    }
    sheets.push({ sheet: name, cells });
  }
  if (!sheets.length) throw agentError('AGENT_ATTACHMENT_INVALID', '未找到可读取的 XLSX 工作表。');
  return JSON.stringify({ format: 'xlsx-cached-cell-values', note: '单元格值来自文件缓存，保留地址；日期数字未格式化，公式没有重新计算。', sheets });
}

/** 校验导入内容并保留来源，不静默截断线序资料。 */
function parseAttachment({ name, base64, thumbnail }) {
  if (typeof name !== 'string' || name.length > 240 || typeof base64 !== 'string' || base64.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 4) {
    throw agentError('AGENT_ATTACHMENT_LIMIT', '附件名称无效或文件超过 8 MB。');
  }
  const filename = path.basename(name.replace(/\\/g, '/'));
  const extension = path.extname(filename).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension) && extension !== '.xlsx' && !IMAGE_EXTENSIONS.has(extension)) throw agentError('AGENT_ATTACHMENT_TYPE', '支持 PNG、JPG、WebP、GIF 图片，以及 TXT、Markdown、JSON、CSV、TSV、LOG 和 XLSX 文件。');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw agentError('AGENT_ATTACHMENT_LIMIT', '附件为空或超过 8 MB。');
  if (IMAGE_EXTENSIONS.has(extension)) {
    const mimeType = imageMime(bytes);
    if (!mimeType) throw agentError('AGENT_ATTACHMENT_INVALID', '图片格式无效，请重新复制或保存图片后添加。');
    const preview = typeof thumbnail === 'string' && thumbnail.length <= 200000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(thumbnail) ? thumbnail : undefined;
    return { id: randomUUID(), name: filename, kind: 'image', mimeType, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), text: '', base64: bytes.toString('base64'), thumbnail: preview, createdAt: new Date().toISOString() };
  }
  let text;
  try { text = extension === '.xlsx' ? extractWorkbook(bytes) : new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (error) { throw String(error.code).startsWith('AGENT_') ? error : agentError('AGENT_ATTACHMENT_ENCODING', '文本文件须为 UTF-8 编码，请转换后重试。'); }
  if (text.includes('\0') || text.length > MAX_TEXT_CHARS) throw agentError('AGENT_ATTACHMENT_LIMIT', '附件包含二进制内容或文本超过 12 万字符，请拆分资料。');
  if (extension === '.json') {
    try { JSON.parse(text); } catch { throw agentError('AGENT_ATTACHMENT_INVALID', 'JSON 附件格式无效。'); }
  }
  return { id: randomUUID(), name: filename, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), text, createdAt: new Date().toISOString() };
}

module.exports = { parseAttachment, extractWorkbook, MAX_FILE_BYTES, MAX_TEXT_CHARS, crc32, imageMime, IMAGE_EXTENSIONS };
