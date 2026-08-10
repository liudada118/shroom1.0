/**
 * crypto.js - 浏览器里的极小 crypto
 *
 * **这是文档站的垫片，不是 `@shroom/backend` 的要求。**
 *
 * `contract/commandProtocol.js` 生成 requestId 时用 `crypto.randomUUID()`，
 * 拿不到才回落 `crypto.randomBytes(6)`。浏览器的 `globalThis.crypto` 原生就有
 * `randomUUID`（https 或 localhost 下），所以直接转发过去，回落分支根本不会走到 ——
 * 但还是实现了它，否则 `typeof crypto.randomUUID === 'function'` 判假时会崩在一个
 * 更难看的地方。
 *
 * @see ../vite.config.js 里的 alias
 */

export function randomUUID() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // 没有原生 randomUUID 的老浏览器：用 getRandomValues 拼一个 v4。
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function randomBytes(size) {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  // 包里写的是 `randomBytes(6).toString('hex')`，所以要带 Node Buffer 那个签名。
  bytes.toString = (encoding) => (encoding === 'hex'
    ? [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
    : String.fromCharCode(...bytes));
  return bytes;
}

export default { randomBytes, randomUUID };
