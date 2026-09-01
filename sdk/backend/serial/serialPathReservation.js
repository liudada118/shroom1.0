const reservedSerialPaths = new Map();

function normalizeSerialPath(path) {
  const value = String(path || '').trim();
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

/**
 * 原子占用一个物理串口路径。返回 token 表示成功，null 表示已有探测占用。
 */
function reserveSerialPath(path, owner = Symbol('serial-path-reservation')) {
  const key = normalizeSerialPath(path);
  if (!key || reservedSerialPaths.has(key)) return null;
  const token = owner || Symbol('serial-path-reservation');
  reservedSerialPaths.set(key, token);
  return token;
}

function releaseSerialPath(path, token) {
  const key = normalizeSerialPath(path);
  if (!key || reservedSerialPaths.get(key) !== token) return false;
  reservedSerialPaths.delete(key);
  return true;
}

function getSerialPathReservation(path) {
  return reservedSerialPaths.get(normalizeSerialPath(path)) || null;
}

module.exports = {
  getSerialPathReservation,
  normalizeSerialPath,
  releaseSerialPath,
  reserveSerialPath,
};
