/**
 * 授权密钥解析与运行态授权状态构建。
 *
 * 本模块不读写文件，也不直接修改 server.js 的运行态变量；调用方负责保存密钥
 * 和应用返回的授权状态。这样启动加载和前端提交密钥可以复用同一套解析规则。
 */

/**
 * 从授权 file 字段推导前端可选类型标记。
 *
 * @param {string | string[] | null} licenseFile 授权中的 file 字段。
 * @returns {'all' | string[] | undefined} 前端 selectFlag。
 */
function getSelectFlagFromLicense(licenseFile) {
  if (licenseFile === 'all') return 'all';
  if (Array.isArray(licenseFile)) {
    return licenseFile.filter((item) => typeof item === 'string' && item.trim());
  }

  if (typeof licenseFile === 'string' && licenseFile.trim() && licenseFile !== 'all') {
    return [licenseFile];
  }

  return undefined;
}

/**
 * 从授权 file 字段中取默认传感器类型。
 *
 * @param {string | string[] | null} licenseFile 授权中的 file 字段。
 * @param {string | null} fallback 无可用授权类型时的默认值。
 * @returns {string | null} 默认传感器类型。
 */
function getDefaultFileFromLicense(licenseFile, fallback = null) {
  if (Array.isArray(licenseFile)) {
    return licenseFile.find((item) => typeof item === 'string' && item.trim()) || fallback;
  }

  if (typeof licenseFile === 'string' && licenseFile.trim() && licenseFile !== 'all') {
    return licenseFile;
  }

  return fallback;
}

/**
 * 把已解密的授权 payload 转成后端运行态需要的结构。
 *
 * @param {object} parsedLicense 解密并 JSON.parse 后的授权内容。
 * @param {object} options 构建选项。
 * @param {string} options.fallbackFile 当前默认传感器类型。
 * @returns {object} 可应用到 server.js 运行态的授权状态。
 */
function buildLicenseRuntimeState(parsedLicense, options = {}) {
  const licenseFile = parsedLicense.file || null;
  const nextFile = getDefaultFileFromLicense(licenseFile, options.fallbackFile || null);

  return {
    endDate: parseFloat(parsedLicense.date),
    licenseFile,
    moduleConfig: parsedLicense.moduleConfig || null,
    nextFile,
    parsedLicense,
    selectFlag: getSelectFlagFromLicense(licenseFile),
  };
}

/**
 * 解密并校验授权密钥。
 *
 * @param {string} licenseKey 授权密钥原文。
 * @param {object} options 校验选项。
 * @param {(key: string) => string} options.decryptStr AES 解密函数。
 * @param {string} options.fallbackFile 当前默认传感器类型。
 * @returns {{ok: true, state: object} | {ok: false, code: string, message: string}}
 */
function validateLicenseKey(licenseKey, options = {}) {
  const normalizedKey = typeof licenseKey === 'string' ? licenseKey.trim() : '';
  if (!normalizedKey) {
    return {
      ok: false,
      code: 'LICENSE_EMPTY',
      message: '密钥不能为空，请输入有效密钥',
    };
  }

  if (typeof options.decryptStr !== 'function') {
    return {
      ok: false,
      code: 'LICENSE_DECRYPTOR_MISSING',
      message: '密钥校验服务未初始化',
    };
  }

  const decrypted = options.decryptStr(normalizedKey);
  if (!decrypted) {
    return {
      ok: false,
      code: 'LICENSE_DECRYPT_FAILED',
      message: '密钥无效，解密失败',
    };
  }

  try {
    const parsedLicense = JSON.parse(decrypted);
    return {
      ok: true,
      state: buildLicenseRuntimeState(parsedLicense, {
        fallbackFile: options.fallbackFile,
      }),
    };
  } catch (err) {
    return {
      ok: false,
      code: 'LICENSE_PARSE_FAILED',
      message: '密钥无效，请检查后重新输入',
    };
  }
}

module.exports = {
  buildLicenseRuntimeState,
  getDefaultFileFromLicense,
  getSelectFlagFromLicense,
  validateLicenseKey,
};
