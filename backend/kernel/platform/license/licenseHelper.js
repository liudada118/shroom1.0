/**
 * licenseHelper.js
 * 授权文件路径解析辅助。
 *
 * 这里只保留 config.txt 的路径解析函数。
 * 授权校验、网络时间和剩余天数等逻辑由 licenseManager.js 负责。
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

let electronApp = null;
try {
  ({ app: electronApp } = require('electron'));
} catch {}

/**
 * 判断当前是否跑在打包后的 Electron 里。
 *
 * 决定 config.txt 该去哪找：开发时在项目根，打包后在安装目录旁边或 resources 里。
 *
 * **拿不到 electron 时返回 false（当成开发环境）** 是刻意选的安全方向：
 * 后端也会被纯 Node 直接起（测试、脚本），此时按开发环境去项目根找配置是对的。
 * 反过来默认成 true 会让它去 `process.execPath` 旁边找，那是 node 二进制的目录，
 * 必然找不到 —— 现象是「授权文件明明在却读不到」。
 *
 * @returns {boolean} 是否为打包运行时。
 */
function isPackagedRuntime() {
  if (electronApp && typeof electronApp.isPackaged === 'boolean') {
    return electronApp.isPackaged;
  }

  return false;
}

/**
 * 列出 config.txt 的全部候选位置，**按查找优先级排列**。
 *
 * 授权文件的位置是个部署问题而不是代码问题：同一个安装包会被放在 Program Files
 * （目录只读）、U 盘、桌面文件夹里，装的人还可能把 config.txt 丢在 exe 旁边或
 * resources 里。所以这里穷举所有见过的位置，由 `resolveConfigFile` 取第一个存在的。
 *
 * **可写位置排在最前面**（`getWritableConfigFile`）：授权更新要能写回去，
 * 而随包分发的那份可能在只读目录里。找到可写的那份就优先用它，
 * 这样一次更新之后所有后续读取都命中同一个文件。
 *
 * 打包/未打包分成两支：开发时只找项目根（多找无意义，还可能读到上一次打包留下的文件）；
 * 打包后按平台展开：
 * - macOS 要**跳三层目录**（`Contents/MacOS/exe` → `.app` → 上一级），
 *   因为 .app 是个目录，配置要放在它旁边而不是里面 —— 放里面会破坏签名。
 * - Windows 额外找 `resources/`，两种写法（exe 旁边的和 cwd 下的）都要试：
 *   通过快捷方式启动时 cwd 不一定是安装目录。
 *
 * 最后 `new Set` 去重：几条规则在某些布局下会算出同一个路径，
 * 重复会让 `resolveConfigFile` 多做几次 `existsSync`（无害但没必要）。
 *
 * @returns {string[]} 候选路径，去重且保持优先级顺序。
 */
function getConfigFileCandidates() {
  const candidates = [];
  const writableConfig = getWritableConfigFile();
  const packaged = isPackagedRuntime();

  if (writableConfig) {
    candidates.push(writableConfig);
  }

  if (!packaged) {
    candidates.push(path.join(PROJECT_ROOT, 'config.txt'));
  } else {
    if (process.execPath) {
      if (process.platform === 'darwin') {
        const appBundleDir = path.dirname(path.dirname(path.dirname(process.execPath)));
        candidates.push(path.join(path.dirname(appBundleDir), 'config.txt'));
      }

      candidates.push(path.join(path.dirname(process.execPath), 'config.txt'));
    }

    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'config.txt'));
    }

    if (process.platform === 'win32') {
      if (process.execPath) {
        candidates.push(path.join(path.dirname(process.execPath), 'resources', 'config.txt'));
      }
      candidates.push(path.join(process.cwd(), 'resources', 'config.txt'));
    }
  }

  return [...new Set(candidates)];
}

/**
 * 给出**一定可写**的 config.txt 路径（不保证文件已存在）。
 *
 * 打包后走 Electron 的 `userData`（Windows 下是 `%APPDATA%/<应用名>`）：
 * 安装目录很可能在 Program Files 里，没有管理员权限写不进去 —— 授权更新会静默失败。
 * userData 是每用户可写的，这是打包应用写配置的标准位置。
 *
 * 拿不到 electron 时回落到项目根：开发环境下那里就是可写的。
 *
 * 与 `resolveConfigFile` 的分工：这个函数回答「该往哪写」，
 * 那个回答「该从哪读」。两者在「文件还不存在」时给出同一个路径，
 * 所以首次写入之后读写就自然对齐了。
 *
 * @returns {string} 可写的 config.txt 路径。
 */
function getWritableConfigFile() {
  if (electronApp && typeof electronApp.getPath === 'function') {
    return path.join(electronApp.getPath('userData'), 'config.txt');
  }

  return path.join(PROJECT_ROOT, 'config.txt');
}

/**
 * 定位当前该使用的 config.txt。
 *
 * 取候选列表里**第一个存在**的文件；一个都不存在时返回可写路径。
 *
 * 返回一个不存在的路径是有意的：调用方（licenseManager）读它会失败并判定「未授权」，
 * 而写它会在正确的位置创建出来。返回 null 反而会让每个调用点都要再判一次，
 * 且没有地方能告诉「该往哪写」。
 *
 * **每次都现算，不缓存。** 用户可能在程序运行期间把 config.txt 放进来
 * （常见的授权流程就是「先装、再拷授权文件、再重新校验」），缓存会让它必须重启才生效。
 * 代价是几次 `existsSync`，而授权校验不是高频操作。
 *
 * @returns {string} 现有的配置文件路径，或应当写入的可写路径。
 */
function resolveConfigFile() {
  const writableConfig = getWritableConfigFile();
  const existingConfig = getConfigFileCandidates()
    .find((candidate) => fs.existsSync(candidate));

  if (existingConfig) {
    return existingConfig;
  }

  return writableConfig;
}

module.exports = {
  getConfigFileCandidates,
  getWritableConfigFile,
  resolveConfigFile,
};
