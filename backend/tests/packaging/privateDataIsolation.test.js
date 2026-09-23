const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { createRequire } = require('module');
const Database = require('better-sqlite3');
const { createPackDbTemplate } = require('../../../scripts/create-pack-db-template');
const { CHANNEL_HISTORY_COLUMNS } = require('../../kernel/storage/dbManager');
const builderRequire = createRequire(require.resolve('electron-builder'));
const matcher = builderRequire('minimatch');
const minimatch = matcher.minimatch || matcher;
const manifest = require('../../../package.json');

/** 依据打包文件匹配规则判断合成文件是否会被选中。 */
function includesFile(patterns, filename) {
  return patterns.some((pattern) => !pattern.startsWith('!') && minimatch(filename, pattern, { dot: true }))
    && !patterns.some((pattern) => pattern.startsWith('!') && minimatch(filename, pattern.slice(1), { dot: true }));
}

/** 验证包内模板为空、已有数据不变、陈旧暂存和用户 Agent 目录不入包。 */
function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-pack-private-test-'));
  try {
    const project = path.join(temporary, 'project');
    const sourceDirectory = path.join(project, 'db');
    fs.mkdirSync(sourceDirectory, { recursive: true });
    const source = path.join(sourceDirectory, 'init.db');
    const db = new Database(source);
    db.exec('CREATE TABLE matrix (data TEXT); CREATE TABLE private_settings (value TEXT);');
    db.prepare('INSERT INTO matrix VALUES (?)').run('synthetic-collected-frame');
    db.prepare('INSERT INTO private_settings VALUES (?)').run('synthetic-private-content');
    db.close();
    const original = fs.readFileSync(source);

    const staging = path.join(project, 'pack-resources', 'db');
    fs.mkdirSync(path.join(staging, 'old-export'), { recursive: true });
    fs.copyFileSync(source, path.join(staging, 'init.db'));
    fs.copyFileSync(source, path.join(staging, 'customer.db'));
    fs.writeFileSync(path.join(staging, 'old-export', 'records.json'), 'synthetic-old-export');
    fs.symlinkSync(sourceDirectory, path.join(staging, 'old-source-link'), process.platform === 'win32' ? 'junction' : 'dir');
    const template = createPackDbTemplate(project);
    assert.deepStrictEqual(fs.readdirSync(staging), ['init.db'], 'Forge staging cannot retain old databases or exports');
    assert.deepStrictEqual(fs.readFileSync(source), original, 'development database stays byte-for-byte unchanged');
    const cleanDb = new Database(template, { readonly: true });
    try {
      assert.equal(cleanDb.prepare('SELECT COUNT(*) AS count FROM matrix').get().count, 0);
      assert.deepStrictEqual(cleanDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all(), [{ name: 'matrix' }]);
      const columns = new Set(cleanDb.prepare('PRAGMA table_info(matrix)').all().map((column) => column.name));
      CHANNEL_HISTORY_COLUMNS.forEach(([column]) => assert(columns.has(column), `missing runtime column ${column}`));
      assert.equal(cleanDb.prepare("PRAGMA integrity_check").get().integrity_check, 'ok');
    } finally { cleanDb.close(); }
    assert(!fs.readFileSync(template).includes(Buffer.from('synthetic-private-content')), 'fresh file cannot retain private SQLite pages');

    const cleanProject = path.join(temporary, 'fresh-project');
    fs.mkdirSync(cleanProject);
    const helper = path.resolve(__dirname, '../../../scripts/create-pack-db-template.js');
    const hostResult = spawnSync('node', [helper, cleanProject], { encoding: 'utf8', windowsHide: true });
    assert.equal(hostResult.status, 0, hostResult.stderr || hostResult.stdout);
    assert(fs.existsSync(path.join(cleanProject, 'pack-resources', 'db', 'init.db')), 'normal Node delegates native work to project Electron');
    assert(!fs.existsSync(path.join(cleanProject, 'db')), 'packaging never creates or opens a source database');

    const linkedProject = path.join(temporary, 'linked-project');
    fs.mkdirSync(path.join(linkedProject, 'pack-resources'), { recursive: true });
    fs.symlinkSync(sourceDirectory, path.join(linkedProject, 'pack-resources', 'db'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => createPackDbTemplate(linkedProject), /unsafe database staging directory/);
    const linkedParentProject = path.join(temporary, 'linked-parent-project');
    fs.mkdirSync(linkedParentProject);
    fs.symlinkSync(sourceDirectory, path.join(linkedParentProject, 'pack-resources'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => createPackDbTemplate(linkedParentProject), /unsafe database staging directory/);
    assert.deepStrictEqual(fs.readFileSync(source), original, 'rejecting linked stage never changes the link target');

    const dbResource = manifest.build.extraResources.find((resource) => resource.to === 'db');
    assert(includesFile(dbResource.filter, 'init.db'));
    for (const filename of ['customer.db', 'init.db-wal', 'nested/init.db', 'records.json']) {
      assert(!includesFile(dbResource.filter, filename), `database extraResources must reject ${filename}`);
    }
    const privateFiles = ['agent/settings.json', 'agent/state.json', 'agent/conversations/example.json',
      'agent/attachments/example.image', 'userData/agent/settings.json', 'builtin-system-copies/private.json'];
    const forgeIgnore = manifest.config.forge.packagerConfig.ignore.map((pattern) => new RegExp(pattern));
    for (const filename of privateFiles) {
      assert(!includesFile(manifest.build.files, filename), `Builder must exclude ${filename}`);
      assert(forgeIgnore.some((pattern) => pattern.test(`/${filename}`)), `Forge must exclude ${filename}`);
    }
    for (const filename of ['backend/agent-runtime/runtime.js', 'app/electron/agentSettings.js']) {
      assert(includesFile(manifest.build.files, filename), `runtime code must remain packaged: ${filename}`);
      assert(!forgeIgnore.some((pattern) => pattern.test(`/${filename}`)), `Forge must keep runtime code: ${filename}`);
    }
    assert(manifest.build.extraResources.some((resource) => resource.from === './agent-resources' && resource.to === 'agent'));
    assert(manifest.config.forge.packagerConfig.extraResource.includes('./pack-resources/agent'));
    console.log('privateDataIsolation tests passed');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

main();
