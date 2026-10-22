/** Read updater errors without forwarding transport bodies, credentials or local paths. */
function errorText(error) {
  return typeof error === 'string' ? error : String(error?.message || '');
}

/** Classify installer failures using a bounded, public diagnostic contract. */
function describeUpdaterError(error, platform = process.platform) {
  const raw = errorText(error);
  const numericStatus = Number(error?.statusCode || error?.status || /\b(?:HttpError:\s*|HTTP\s+)(\d{3})\b/i.exec(raw)?.[1]);
  const status = numericStatus >= 400 && numericStatus <= 599 ? numericStatus : undefined;
  const missing = status === 404 || /\b404\b|NoSuchKey/.test(raw);
  const channel = /(?:latest|beta|alpha)(?:-[a-z0-9]{1,16}){0,3}\.ya?ml\b/i.exec(raw)?.[0];
  let code = 'SOFTWARE_UPDATE_FAILED';
  let message = '安装包更新未完成，请稍后重试；如仍失败，请联系管理员检查安装包发布状态。';
  if (missing && (channel || /Cannot find channel/i.test(raw))) {
    const label = platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : '当前平台';
    code = platform === 'darwin' ? 'MAC_RELEASE_UNAVAILABLE' : platform === 'win32' ? 'WINDOWS_RELEASE_UNAVAILABLE' : 'PLATFORM_RELEASE_UNAVAILABLE';
    message = `当前服务器尚未发布 ${label} 安装包自动更新。可在“应用设置 → 网页更新”检查页面更新，或联系管理员提供适用的安装包。`;
  } else if (missing) {
    code = 'UPDATE_PACKAGE_UNAVAILABLE';
    message = '更新安装包暂不可下载，请联系管理员检查发布文件是否完整。';
  } else if (/ERR_CHECKSUM_MISMATCH|sha512 checksum mismatch/i.test(raw)) {
    code = 'UPDATE_CHECKSUM_MISMATCH';
    message = '更新包校验失败，请联系管理员重新发布匹配的更新清单和安装包。';
  } else if (/ERR_CONTENT_LENGTH_MISMATCH/.test(raw)) {
    code = 'UPDATE_CONTENT_LENGTH_MISMATCH';
    message = '更新文件下载不完整，请稍后重试；如仍失败，请联系管理员检查更新文件和缓存。';
  } else if (/Code signature at URL/.test(raw) && /did not pass validation/.test(raw)) {
    code = 'UPDATE_SIGNATURE_MISMATCH';
    message = '更新安装失败：当前软件与更新包的签名不一致，请联系管理员提供适用的正式安装包。';
  } else if (status === 401 || status === 403) {
    code = 'UPDATE_SERVER_ACCESS_DENIED';
    message = '更新服务器暂不允许下载，请联系管理员检查发布权限。';
  } else if (/ERR_(?:INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION\w*|NETWORK\w*|TIMED_OUT)|ETIMEDOUT|ENOTFOUND|ECONN(?:RESET|REFUSED)|network|timed?\s*out|timeout/i.test(raw)) {
    code = 'UPDATE_NETWORK_UNAVAILABLE';
    message = '无法连接安装包更新服务，请检查网络后重试。';
  }
  return { code, message, platform: ['darwin', 'win32', 'linux'].includes(platform) ? platform : 'other',
    ...(status ? { httpStatus: status } : {}), ...(channel ? { channel: channel.toLowerCase() } : {}) };
}

/** Log engine diagnostics without copying raw messages, HTTP headers, URLs or stacks. */
function createUpdaterLogger(logger, platform = process.platform) {
  return Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, (...args) => {
    const value = args.find(item => item instanceof Error) || args.map(item => typeof item === 'string' ? item : '').join(' ');
    const diagnostic = describeUpdaterError(value, platform);
    const { code, httpStatus, channel } = diagnostic;
    logger[level]?.('[InstallerUpdater] engine', { level, platform: diagnostic.platform, code, ...(httpStatus ? { httpStatus } : {}), ...(channel ? { channel } : {}) });
  }]));
}

module.exports = { describeUpdaterError, createUpdaterLogger };
