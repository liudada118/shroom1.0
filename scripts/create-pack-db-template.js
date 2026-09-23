const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

/** 确认打包暂存目录位于项目内，拒绝指向业务数据库或外部目录的链接。 */
function resolvePackDbDirectory(projectRoot) {
  const root = fs.realpathSync(projectRoot);
  const packRoot = path.join(root, 'pack-resources');
  const target = path.join(packRoot, 'db');
  for (const candidate of [packRoot, target]) {
    let stat;
    try { stat = fs.lstatSync(candidate); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (stat.isSymbolicLink() || !stat.isDirectory() || fs.realpathSync(candidate) !== candidate) {
      throw new Error(`[pack] unsafe database staging directory: ${candidate}`);
    }
  }
  if (path.relative(root, target) !== path.join('pack-resources', 'db')) {
    throw new Error('[pack] database staging directory must be pack-resources/db');
  }
  return target;
}

/** 从运行时 schema 新建空模板；只替换经过路径检查的打包暂存目录。 */
function writeEmptyTemplate(projectRoot) {
  const target = resolvePackDbDirectory(projectRoot);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-pack-db-'));
  try {
    const Database = require('better-sqlite3');
    const { ensureChannelHistorySchema } = require('../backend/kernel/storage/dbManager');
    const template = path.join(temporary, 'init.db');
    const db = new Database(template);
    try { ensureChannelHistorySchema(db); }
    finally { db.close(); }
    // ⚠️ 不能复制开发库后清表：SQLite 空闲页仍可能保留客户采集内容。
    resolvePackDbDirectory(projectRoot);
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(template, path.join(target, 'init.db'));
    return path.join(target, 'init.db');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

/** 使用项目 Electron 的 Node ABI 生成模板，兼容由普通 npm/Node 启动的打包脚本。 */
function createPackDbTemplate(projectRoot = path.resolve(__dirname, '..')) {
  const root = fs.realpathSync(projectRoot);
  if (process.versions.electron) return writeEmptyTemplate(root);
  const result = spawnSync(require('electron'), [__filename, root], {
    cwd: root,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    windowsHide: true,
    encoding: 'utf8',
  });
  if (result.error || result.status !== 0) {
    throw new Error(`[pack] empty database template failed: ${result.error?.message || result.stderr || result.stdout}`);
  }
  return path.join(root, 'pack-resources', 'db', 'init.db');
}

if (require.main === module) {
  try { createPackDbTemplate(process.argv[2] || path.resolve(__dirname, '..')); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { createPackDbTemplate };
