const fs = require('fs');
const path = require('path');
const {
  getConfigFileCandidates,
  getWritableConfigFile,
  resolveConfigFile,
} = require('./license/licenseHelper');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');

function ensureDirectory(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

/**
 * 计算后端运行期资源路径，并确保可写目录存在。
 *
 * 开发态使用项目根目录；打包态区分只读 resourcesPath 和可写 userData，
 * 避免把数据库、图片、配置等运行期文件写进 asar。
 *
 * @param {object} options 路径配置选项。
 * @param {Electron.App | null} options.electronApp Electron app 实例。
 * @param {NodeJS.Process} options.processRef 当前进程对象，便于测试注入。
 * @returns {object} 后端运行期路径集合。
 */
function createServerPathConfig({
  electronApp = null,
  processRef = process,
} = {}) {
  const isPackagedRuntime = Boolean(electronApp?.isPackaged);
  const runtimeResourceRoot = isPackagedRuntime ? processRef.resourcesPath : PROJECT_ROOT;
  const runtimeWritableRoot = isPackagedRuntime && typeof electronApp?.getPath === 'function'
    ? electronApp.getPath('userData')
    : PROJECT_ROOT;
  const desktopPath = typeof electronApp?.getPath === 'function'
    ? electronApp.getPath('desktop')
    : runtimeWritableRoot;
  const exportRoot = isPackagedRuntime
    ? (processRef.platform === 'darwin' ? desktopPath : processRef.resourcesPath)
    : runtimeWritableRoot;

  const filePath = path.join(runtimeWritableRoot, 'db');
  const displaySystemsPath = path.join(runtimeWritableRoot, 'display-systems');
  const csvPath = path.join(exportRoot, 'data');
  const imgPath = path.join(runtimeWritableRoot, 'img');
  const pdfPath = isPackagedRuntime
    ? (processRef.platform === 'win32' ? path.join(processRef.resourcesPath, 'OneStep') : path.join(exportRoot, 'oneStepPdf'))
    : path.join(runtimeWritableRoot, 'oneStepPdf');
  const nameTxt = resolveConfigFile();
  const writableNameTxt = getWritableConfigFile();
  const configCandidates = getConfigFileCandidates();

  [filePath, csvPath, imgPath, pdfPath, displaySystemsPath].forEach(ensureDirectory);

  return {
    configCandidates,
    csvPath,
    displaySystemsPath,
    exportRoot,
    filePath,
    imgPath,
    isPackagedRuntime,
    nameTxt,
    pdfPath,
    runtimeResourceRoot,
    runtimeWritableRoot,
    writableNameTxt,
  };
}

module.exports = {
  PROJECT_ROOT,
  createServerPathConfig,
};
