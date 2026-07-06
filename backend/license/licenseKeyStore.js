/**
 * 授权密钥文件存储服务。
 *
 * licenseHelper 只负责解析 config.txt 的候选路径；本模块负责真正读取和写入密钥，
 * 让 server.js / WebSocket handler 不再直接关心授权文件的落盘细节。
 */
const fs = require('fs');
const path = require('path');
const {
  getConfigFileCandidates,
  getWritableConfigFile,
} = require('./licenseHelper');

/**
 * 从候选路径中找到当前存在的授权配置文件。
 *
 * @param {object} options 查找选项。
 * @param {string} options.preferredPath 优先检查的配置文件路径。
 * @returns {string} 已存在的配置文件路径；没有找到时返回空字符串。
 */
function findExistingConfigFile(options = {}) {
  const candidates = [
    options.preferredPath,
    ...getConfigFileCandidates(),
  ].filter(Boolean);

  return [...new Set(candidates)].find((candidate) => fs.existsSync(candidate)) || '';
}

/**
 * 读取当前已保存的授权密钥。
 *
 * @param {object} options 读取选项。
 * @param {string} options.preferredPath 优先读取的配置文件路径。
 * @returns {string} 已保存的授权密钥；没有可用文件时返回空字符串。
 */
function readStoredLicenseKey(options = {}) {
  const existingConfig = findExistingConfigFile(options);

  if (!existingConfig) {
    return '';
  }

  return fs.readFileSync(existingConfig, 'utf8').trim();
}

/**
 * 将授权密钥保存到运行期可写 config.txt。
 *
 * @param {string} licenseKey 授权密钥原文。
 * @param {object} options 写入选项。
 * @param {string} options.targetPath 指定写入路径；未传时使用默认可写路径。
 * @returns {string} 实际写入的配置文件路径。
 */
function writeStoredLicenseKey(licenseKey, options = {}) {
  const targetPath = options.targetPath || getWritableConfigFile();
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, String(licenseKey || ''), 'utf8');
  return targetPath;
}

module.exports = {
  findExistingConfigFile,
  readStoredLicenseKey,
  writeStoredLicenseKey,
};
