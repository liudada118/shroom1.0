const backendMessageKeys = Object.freeze({
  '未检测到有效密钥，请输入密钥后使用': 'license.backendMessages.noValidKey',
  '授权校验未通过': 'license.backendMessages.validationFailed',
  '密钥不能为空，请输入有效密钥': 'license.backendMessages.emptyKey',
  '密钥无效，解密或验签失败': 'license.backendMessages.decryptOrVerifyFailed',
  '该密钥已因系统时间异常被锁定，请联系厂商重新获取新密钥': 'license.backendMessages.lockedKey',
  '密钥无效，请检查后重新输入': 'license.backendMessages.invalidKey',
  '未检测到密钥，请先输入密钥': 'license.backendMessages.keyNotDetected',
  '密钥无效，解密失败': 'license.backendMessages.decryptFailed',
  '密钥格式无法识别': 'license.backendMessages.formatUnrecognized',
  '检测到系统时间异常，请联系厂商重新获取密钥': 'license.backendMessages.timeAnomaly',
  '检测到异常行为，请联系厂商解锁': 'license.backendMessages.contactVendorToUnlock',
  '授权未通过': 'license.backendMessages.authorizationRejected',
  '加密库未就绪': 'license.backendMessages.cryptoNotReady',
  '离线校验库未就绪': 'license.backendMessages.offlineLibraryNotReady',
  '授权状态文件被篡改': 'license.backendMessages.stateTampered',
  '检测到异常行为': 'license.backendMessages.abnormalActivity',
  '检测到系统时间被回拨': 'license.backendMessages.clockRollback',
  '尚未联网验证，请先联网激活一次': 'license.backendMessages.onlineActivationRequired',
  '密钥已吊销': 'license.backendMessages.revoked',
  '密钥已暂停': 'license.backendMessages.suspended',
  '密钥已过期': 'license.backendMessages.keyExpired',
  '授权已过期': 'license.backendMessages.licenseExpired',
  '签名校验失败：激活码无效或被篡改': 'license.backendMessages.invalidSignature',
  '激活码为空': 'license.backendMessages.activationCodeEmpty',
  '激活码格式错误': 'license.backendMessages.activationCodeFormat',
  '激活码缺少 payload 或 signature': 'license.backendMessages.activationCodeEnvelope',
  '激活码缺少到期时间': 'license.backendMessages.activationCodeExpiry',
});

const backendMessagePrefixes = Object.freeze([
  ['离线校验异常：', 'license.backendMessages.offlineValidationError'],
  ['解锁异常：', 'license.backendMessages.unlockError'],
]);

export const translateBackendMessage = (message, t) => {
  if (message == null || message === '') return message;

  const normalizedMessage = String(message).trim();
  const exactKey = backendMessageKeys[normalizedMessage];
  if (exactKey) return t(exactKey);

  const prefixMatch = backendMessagePrefixes.find(([prefix]) => normalizedMessage.startsWith(prefix));
  if (prefixMatch) {
    const [prefix, key] = prefixMatch;
    return t(key, { detail: normalizedMessage.slice(prefix.length) });
  }

  return normalizedMessage;
};
