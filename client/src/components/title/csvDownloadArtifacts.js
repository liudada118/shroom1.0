function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return '';
}

function firstText(...values) {
  return values.map(cleanText).find(Boolean) || '';
}

function cleanList(values, ...fallbacks) {
  const entries = Array.isArray(values) ? values : [];
  return [...new Set([...entries, ...fallbacks].map(cleanText).filter(Boolean))];
}

const ARTIFACT_LIST_FIELDS = Object.freeze([
  'serialRoles',
  'serialPortPaths',
  'baudRates',
  'parserChannels',
]);

/**
 * 将后端的通道导出产物归一成前端稳定形状。物理串口只读显式字段，绝不按数组下标推断。
 */
export function normalizeCsvDownloadArtifact(value) {
  if (!isObject(value)) return null;
  const serial = isObject(value.serial) ? value.serial : {};
  const sensor = isObject(value.sensor) ? value.sensor : {};
  const channelId = cleanText(value.channelId);
  const filePath = firstText(value.filePath, value.file, value.currentFile);
  if (!channelId && !filePath) return null;

  const serialRole = firstText(value.serialRole, serial.role, serial.serialRole);
  const serialPortPath = firstText(
    value.serialPortPath,
    value.portPath,
    serial.portPath,
    serial.path,
    serial.serialPortPath,
  );
  const baudRate = value.baudRate ?? serial.baudRate ?? null;
  const parserChannel = firstText(
    value.parserChannel,
    serial.parserChannel,
    serial.parser?.id,
    serial.parser?.role,
    serial.parser,
  );

  return {
    ...value,
    channelId,
    displaySystemId: cleanText(value.displaySystemId),
    sensorId: firstText(value.sensorId, sensor.id),
    sensorLabel: firstText(value.sensorLabel, value.label, sensor.sensorLabel, sensor.label),
    outputChannel: cleanText(value.outputChannel),
    serialRole,
    serialPortPath,
    baudRate,
    parserChannel,
    serialRoles: cleanList(value.serialRoles, serialRole),
    serialPortPaths: cleanList(value.serialPortPaths, serialPortPath),
    baudRates: cleanList(value.baudRates, baudRate),
    parserChannels: cleanList(value.parserChannels, parserChannel),
    serialChanged: value.serialChanged === true
      || cleanList(value.serialPortPaths, serialPortPath).length > 1,
    filePath,
  };
}

/**
 * 同一 channelId 的进度项和最终项合并；无 channelId 的 legacy 项才按文件路径兼容。
 */
export function mergeCsvDownloadArtifacts(current = [], incoming = []) {
  const merged = (Array.isArray(current) ? current : [])
    .map(normalizeCsvDownloadArtifact)
    .filter(Boolean);

  for (const candidate of Array.isArray(incoming) ? incoming : []) {
    const next = normalizeCsvDownloadArtifact(candidate);
    if (!next) continue;
    const index = merged.findIndex((item) => (next.channelId
      ? (
        item.channelId === next.channelId
        || (!item.channelId && next.filePath && item.filePath === next.filePath)
      )
      : (next.filePath && item.filePath === next.filePath)));
    if (index < 0) {
      merged.push(next);
      continue;
    }
    const meaningfulEntries = Object.entries(next).filter(([, value]) => (
      value !== '' && value !== null && value !== undefined
    ));
    const updated = { ...merged[index], ...Object.fromEntries(meaningfulEntries) };
    for (const key of ARTIFACT_LIST_FIELDS) {
      updated[key] = cleanList([
        ...(merged[index][key] || []),
        ...(next[key] || []),
      ]);
    }
    updated.serialChanged = updated.serialChanged === true || updated.serialPortPaths.length > 1;
    merged[index] = updated;
  }
  return merged;
}

/**
 * Manifest 下载只请求当前展示系统声明的 canonical 通道，避免同一日期混入其它系统。
 */
export function resolveManifestDownloadChannelIds(definition = {}) {
  if (!isObject(definition) || definition.source !== 'manifest') return [];
  const displaySystemId = cleanText(definition.displaySystemId);
  const sensors = Array.isArray(definition.sensors) ? definition.sensors : [];
  return [...new Set(sensors.map((sensor) => {
    const channelId = cleanText(sensor?.channelId);
    if (channelId) return channelId;
    const sensorId = firstText(sensor?.sensorId, sensor?.id);
    return displaySystemId && sensorId ? `${displaySystemId}:${sensorId}` : '';
  }).filter(Boolean))];
}

/**
 * 同时兼容最终 downloadArtifacts 与逐通道进度对象；不读取 files[] 的相对顺序。
 */
export function collectCsvDownloadArtifacts(detail = {}) {
  if (!isObject(detail)) return [];
  const progress = isObject(detail.csvDownloadProgress) ? detail.csvDownloadProgress : {};
  const candidates = [
    ...(Array.isArray(detail.downloadArtifacts) ? detail.downloadArtifacts : []),
    ...(Array.isArray(progress.downloadArtifacts) ? progress.downloadArtifacts : []),
    ...(Array.isArray(progress.artifacts) ? progress.artifacts : []),
    ...(isObject(detail.downloadArtifact) ? [detail.downloadArtifact] : []),
    ...(isObject(progress.downloadArtifact) ? [progress.downloadArtifact] : []),
  ];
  if (progress.channelId || progress.currentFile) candidates.push(progress);
  return mergeCsvDownloadArtifacts([], candidates);
}

export function getUnmatchedLegacyDownloadFiles(files = [], artifacts = []) {
  const artifactPaths = new Set(
    (Array.isArray(artifacts) ? artifacts : [])
      .map((artifact) => normalizeCsvDownloadArtifact(artifact)?.filePath)
      .filter(Boolean),
  );
  return [...new Set((Array.isArray(files) ? files : [])
    .map(cleanText)
    .filter((filePath) => filePath && !artifactPaths.has(filePath)))];
}
