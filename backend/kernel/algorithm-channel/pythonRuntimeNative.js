'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const NATIVE_FILENAME = 'onbed_filter.cp311-win_amd64.pyd';

/** 计算原生库文件的 SHA-256，用于校验构建来源及缓存内容。 */
function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/** 比较源码与运行时的原生库内容，防止时间戳较新的旧 PYD 被复用。 */
function runtimeNativeMatchesSource({ appDir, runtimeDir, platform = process.platform }) {
  if (platform !== 'win32') return true;

  try {
    const sourceSha256 = fileSha256(path.join(appDir, NATIVE_FILENAME));
    const candidates = [
      path.join(runtimeDir, '_internal', NATIVE_FILENAME),
      path.join(runtimeDir, NATIVE_FILENAME),
    ].filter((candidate) => fs.existsSync(candidate));

    return candidates.length > 0
      && candidates.every((candidate) => fileSha256(candidate) === sourceSha256);
  } catch {
    return false;
  }
}

module.exports = { NATIVE_FILENAME, fileSha256, runtimeNativeMatchesSource };
