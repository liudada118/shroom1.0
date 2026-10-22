const ERROR_KEYS = {
  MAC_RELEASE_UNAVAILABLE: 'macUnavailable', WINDOWS_RELEASE_UNAVAILABLE: 'windowsUnavailable',
  PLATFORM_RELEASE_UNAVAILABLE: 'platformUnavailable', UPDATE_PACKAGE_UNAVAILABLE: 'packageUnavailable',
  UPDATE_NETWORK_UNAVAILABLE: 'networkUnavailable', UPDATE_SERVER_ACCESS_DENIED: 'accessDenied',
  UPDATE_CHECKSUM_MISMATCH: 'checksumMismatch', UPDATE_CONTENT_LENGTH_MISMATCH: 'downloadIncomplete',
  UPDATE_SIGNATURE_MISMATCH: 'signatureMismatch', SOFTWARE_UPDATE_FAILED: 'genericFailure',
};

/** Keep old installed hosts' raw transport errors out of webpage notices and logs. */
export function updaterErrorKey(error) {
  if (Object.prototype.hasOwnProperty.call(ERROR_KEYS, error?.code)) return `update.${ERROR_KEYS[error.code]}`;
  const raw = String(typeof error === 'string' ? error : error?.message || '');
  if (/\b404\b|NoSuchKey/.test(raw)) {
    if (/latest-mac\.ya?ml|macOS 安装包/.test(raw)) return 'update.macUnavailable';
    if (/latest\.ya?ml|Windows 安装包/.test(raw)) return 'update.windowsUnavailable';
    if (/Cannot find channel/.test(raw)) return 'update.platformUnavailable';
    return 'update.packageUnavailable';
  }
  if (/macOS 安装包自动更新/.test(raw)) return 'update.macUnavailable';
  if (/Windows 安装包自动更新/.test(raw)) return 'update.windowsUnavailable';
  if (/ERR_CHECKSUM_MISMATCH|sha512 checksum mismatch|更新包校验失败/i.test(raw)) return 'update.checksumMismatch';
  if (/ERR_CONTENT_LENGTH_MISMATCH|更新文件下载不完整/.test(raw)) return 'update.downloadIncomplete';
  if (/Code signature at URL|签名不一致|签名链/.test(raw)) return 'update.signatureMismatch';
  if (/\b(?:401|403)\b|更新服务器暂不允许下载/.test(raw)) return 'update.accessDenied';
  if (/ERR_(?:INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION\w*|NETWORK\w*|TIMED_OUT)|ETIMEDOUT|ENOTFOUND|ECONN(?:RESET|REFUSED)|network|timed?\s*out|timeout|无法连接安装包更新服务/i.test(raw)) return 'update.networkUnavailable';
  return 'update.genericFailure';
}
