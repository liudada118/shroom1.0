const VALUE_TYPE_BYTE_WIDTHS = Object.freeze({
  uint8: 1,
  int8: 1,
  uint16le: 2,
  uint16be: 2,
  int16le: 2,
  int16be: 2,
  uint32le: 4,
  uint32be: 4,
  int32le: 4,
  int32be: 4,
  float32le: 4,
  float32be: 4,
});

function compactPatch(value = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

function formatByteSequence(value) {
  if (typeof value === 'string') return value.trim().toUpperCase();
  if (!Array.isArray(value)) return '';
  return value
    .map((byte) => Number(byte))
    .filter((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

function toPositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 0;
}

/**
 * 坐标/点位文件描述展示几何，不拥有线上协议的帧宽。只有协议尚未声明 valueCount 时，
 * 才用几何点数同时补 valueCount 和定长帧长度；已有协议值时保留现有 frameLength。
 */
export function buildProtocolGeometryDefaults({
  valueCount,
  frameLength,
  pointCount,
  bytesPerValue = 1,
  fixedLength = false,
} = {}) {
  const wireValueCount = toPositiveInteger(valueCount);
  const geometryPointCount = toPositiveInteger(pointCount);
  const resolvedValueCount = wireValueCount || geometryPointCount || null;
  const byteWidth = Math.max(1, toPositiveInteger(bytesPerValue) || 1);
  const currentFrameLength = toPositiveInteger(frameLength);
  return compactPatch({
    valueCount: resolvedValueCount,
    frameLength: fixedLength
      ? (wireValueCount
        ? (currentFrameLength || wireValueCount * byteWidth)
        : (geometryPointCount ? geometryPointCount * byteWidth : currentFrameLength || undefined))
      : undefined,
  });
}

/**
 * 兼容控制面 HttpResult 和旧的裸 JSON 响应。这里只给 Builder 新增的控制面调用使用，
 * 不改变已有展示系统 API 的解包方式。
 */
export function unwrapControlApiData(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (!Object.prototype.hasOwnProperty.call(payload, 'code')) return payload;
  if (Number(payload.code) !== 0) {
    throw new Error(payload.msg || payload.message || payload.error || '请求失败');
  }
  return payload.data ?? {};
}

/**
 * 自动识别候选只来自 Builder 目录。明确标记 detectable 的模板优先遵从；旧目录没有
 * 标记时，仅把“分隔符 + 已知 valueCount”的协议预设纳入探测，避免把定长模板或
 * 只有通信默认值的历史快捷模板误当成可观测协议。
 */
export function getDetectableProtocolCandidateIds(serialTemplates = []) {
  return [...new Set((Array.isArray(serialTemplates) ? serialTemplates : []).flatMap((template) => {
    if (!template?.id || template.detectable === false || template.autoDetect === false) return [];
    if (template.detectable === true || template.autoDetect === true) return [template.id];

    const framingType = template.protocol?.framing?.type || template.defaults?.framingType;
    const valueCount = Number(
      template.protocol?.decoding?.valueCount ?? template.valueCount,
    );
    return framingType === 'delimiter' && Number.isInteger(valueCount) && valueCount > 0
      ? [template.id]
      : [];
  }))];
}

/**
 * 将 serialport 的跨平台描述整理成 Ant Select 选项。path 是真正提交给探测接口的值；
 * USB 序列号和厂商信息只用于帮助用户在多个同型号串口之间辨认。
 */
export function buildSerialPortOptions(ports = []) {
  const seen = new Set();
  return (Array.isArray(ports) ? ports : []).flatMap((port) => {
    const descriptor = typeof port === 'string' ? { path: port } : (port || {});
    const path = String(descriptor.path || '').trim();
    if (!path || seen.has(path)) return [];
    seen.add(path);

    const detail = descriptor.friendlyName
      || descriptor.manufacturer
      || descriptor.serialNumber
      || '';
    const serialNumber = descriptor.serialNumber
      && String(descriptor.serialNumber) !== String(detail)
      ? ` · ${descriptor.serialNumber}`
      : '';
    return [{
      value: path,
      label: detail ? `${path} · ${detail}${serialNumber}` : path,
      port: descriptor,
    }];
  });
}

/**
 * 把目录模板映射成 Builder 的扁平表单字段。手动选模板和自动识别共用这一条映射，
 * 因而不会出现同一协议由两个入口写出不同通信参数的问题。
 */
export function buildSerialTemplateFormPatch({
  template,
  currentValues = {},
  pointCount = 0,
} = {}) {
  if (!template?.id) return null;

  const defaults = template.defaults || {};
  const hasFullProtocol = Boolean(template.protocol && typeof template.protocol === 'object');
  const protocol = hasFullProtocol ? template.protocol : {};
  const framing = protocol.framing || {};
  const decoding = protocol.decoding || {};
  const framingType = framing.type || defaults.framingType || currentValues.framingType;
  const valueType = decoding.valueType || defaults.valueType || currentValues.valueType || 'uint8';
  const bytesPerValue = VALUE_TYPE_BYTE_WIDTHS[valueType] || defaults.bytesPerValue || 1;
  const normalizedPointCount = Number(pointCount) > 0 ? Number(pointCount) : 0;
  const protocolValueCount = Number(decoding.valueCount) > 0 ? Number(decoding.valueCount) : 0;
  const valueCount = hasFullProtocol
    ? (protocolValueCount || normalizedPointCount || currentValues.valueCount)
    : (normalizedPointCount || currentValues.valueCount);

  const patch = compactPatch({
    serialTemplate: template.id,
    transportType: defaults.transportType || 'binary',
    baudRate: protocol.baudRate ?? defaults.baudRate ?? currentValues.baudRate,
    framingType,
    delimiter: framingType === 'delimiter'
      ? formatByteSequence(framing.delimiter ?? defaults.delimiter)
      : currentValues.delimiter,
    includeDelimiter: hasFullProtocol
      ? framing.includeDelimiter === true
      : currentValues.includeDelimiter,
    frameLength: framingType === 'fixedLength'
      ? (framing.frameLength
        || ((protocolValueCount || normalizedPointCount)
          ? (protocolValueCount || normalizedPointCount) * bytesPerValue
          : currentValues.frameLength))
      : currentValues.frameLength,
    valueType,
    dataBits: defaults.dataBits || (bytesPerValue > 1 ? 12 : 8),
    byteOffset: decoding.byteOffset ?? defaults.byteOffset ?? 0,
    valueCount,
  });

  if (!hasFullProtocol) return patch;

  const validation = protocol.validation || {};
  const checksum = validation.checksum || {};
  return {
    ...patch,
    validationHeader: formatByteSequence(validation.header),
    validationHeaderOffset: validation.headerOffset ?? 0,
    checksumType: checksum.type || 'none',
    checksumByteOffset: checksum.byteOffset ?? -1,
    checksumRangeExplicit: Array.isArray(checksum.range),
    checksumRangeStart: checksum.range?.[0] ?? 0,
    checksumRangeEnd: checksum.range?.[1] ?? -1,
  };
}

/**
 * 自动识别命中后，只生成协议/通信表单补丁。业务身份、几何、线序、算法和显示配置
 * 不在返回对象中，调用方即使直接 setFieldsValue 也不会覆盖这些字段。
 */
export function buildDetectedProtocolFormPatch({
  match,
  serialTemplates = [],
  currentValues = {},
} = {}) {
  if (!match?.id || !match.protocol) return null;
  const catalogTemplate = (Array.isArray(serialTemplates) ? serialTemplates : [])
    .find((template) => template.id === match.id);
  return buildSerialTemplateFormPatch({
    template: {
      ...(catalogTemplate || {}),
      id: match.id,
      label: match.label || catalogTemplate?.label,
      protocol: match.protocol,
    },
    currentValues,
    pointCount: 0,
  });
}

export function formatProtocolCandidateLabels(candidates = []) {
  return (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => (
      typeof candidate === 'string'
        ? candidate
        : (candidate?.label || candidate?.id)
    ))
    .filter(Boolean)
    .join('、');
}
