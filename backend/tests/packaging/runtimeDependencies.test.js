const assert = require('assert');
const fs = require('fs');
const diskFs = process.versions.electron ? require('original-fs') : fs;
const os = require('os');
const path = require('path');
const { finished } = require('stream/promises');
const {
  loadAsar, collectRuntimePackages, prepareRuntimeDependencies,
  runtimeDependenciesHandledExternally, verifyPackagedDependencies,
} = require('../../../scripts/pack-runtime-dependencies');
const asar = loadAsar();

/** 写入最小测试包，用真实 junction 模拟 pnpm 与旧 npm 目录共存。 */
function writePackage(directory, manifest) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(directory, 'index.js'), 'module.exports = true;');
}

/** 验证依赖解析、同名多版本和 ASAR 发布门禁，不依赖开发机全局补包。 */
async function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-pack-deps-'));
  try {
    const project = path.join(temporary, 'project');
    writePackage(project, { name: 'app', dependencies: { express: '^5.0.0', qs: '^6.0.0' }, devDependencies: { unused: '*' } });
    const actualExpress = path.join(project, 'node_modules/.pnpm/express/node_modules/express');
    writePackage(actualExpress, { name: 'express', version: '5.0.0', dependencies: { qs: '^7.0.0', body: '^1.0.0', string_decoder: '^1.0.0' }, optionalDependencies: { missing: '*' } });
    writePackage(path.join(actualExpress, '../qs'), { name: 'qs', version: '7.0.0' });
    writePackage(path.join(actualExpress, '../string_decoder'), { name: 'string_decoder', version: '1.0.0' });
    writePackage(path.join(actualExpress, '../body'), { name: 'body', version: '1.0.0', dependencies: { express: '^5.0.0' } });
    fs.symlinkSync(actualExpress, path.join(project, 'node_modules/express'), 'junction');
    writePackage(path.join(project, 'node_modules/qs'), { name: 'qs', version: '6.0.0' });
    writePackage(path.join(project, 'node_modules/body'), { name: 'body', version: '0.1.0' });
    fs.writeFileSync(path.join(project, 'package-lock.json'), '{"packages":{}}');

    const plan = collectRuntimePackages(project);
    assert.equal(plan.length, 5, 'cycles are deduplicated and dev/absent optional packages are omitted');
    assert.equal(plan.find(item => item.to === 'node_modules/qs').manifest.version, '6.0.0');
    assert.equal(plan.find(item => item.to === 'node_modules/express/node_modules/qs').manifest.version, '7.0.0');
    assert.equal(plan.find(item => item.to === 'node_modules/body').manifest.version, '1.0.0', 'resolve from real caller, not stale npm directory');
    assert(plan.some(item => item.manifest.name === 'string_decoder'), 'builtin-named npm packages are copied');

    const config = { files: [{ from: '.', to: '.', filter: ['**/*', '!db/**'] }], npmRebuild: true };
    const context = { packager: { info: { appDir: project }, config } };
    await prepareRuntimeDependencies(context);
    await prepareRuntimeDependencies(context);
    assert.equal(config.files.length, 6, 'multi-target builds do not append duplicate mappings');
    assert(config.files.every(item => typeof item === 'object'), 'do not introduce a second wildcard matcher after normalization');
    assert(config.files[0].filter.includes('!db/**'), 'preserve existing application exclusions');
    assert.equal(await runtimeDependenciesHandledExternally(), false);

    const staged = path.join(temporary, 'staged');
    writePackage(staged, JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8')));
    for (const item of plan) writePackage(path.join(staged, item.to), item.manifest);
    const archive = path.join(temporary, 'good.asar');
    await finished(await asar.createPackage(staged, archive));
    assert.equal(verifyPackagedDependencies(archive), 5);

    const corruptArchive = path.join(temporary, 'corrupt.asar');
    diskFs.copyFileSync(archive, corruptArchive);
    const { headerSize } = asar.getRawHeader(corruptArchive);
    const manifestPath = path.join('node_modules', 'express', 'package.json');
    const manifestOffset = asar.statFile(corruptArchive, manifestPath).offset;
    const descriptor = diskFs.openSync(corruptArchive, 'r+');
    try { diskFs.writeSync(descriptor, Buffer.from('logFilePath'), 0, 11, 8 + headerSize + Number(manifestOffset)); }
    finally { diskFs.closeSync(descriptor); }
    assert.throws(() => verifyPackagedDependencies(corruptArchive), (error) => {
      assert.equal(error.code, 'PACKAGED_MANIFEST_INTEGRITY_FAILED');
      assert(error.message.includes('node_modules/express/package.json'));
      assert(!error.message.includes('logFilePath'), 'do not echo unrelated packed file bytes');
      return true;
    });

    const invalidDirectory = path.join(temporary, 'invalid-manifest');
    writePackage(invalidDirectory, { name: 'invalid-app' });
    fs.writeFileSync(path.join(invalidDirectory, 'package.json'), 'logFilePath = null;');
    const invalidArchive = path.join(temporary, 'invalid-manifest.asar');
    await finished(await asar.createPackage(invalidDirectory, invalidArchive));
    assert.throws(() => verifyPackagedDependencies(invalidArchive), { code: 'PACKAGED_MANIFEST_INVALID' });

    const privateDirectory = path.join(temporary, 'private-workspace');
    writePackage(privateDirectory, { name: 'private-app' });
    for (const privatePath of [
      'display-systems/draft/display-system.json', 'displaySystems/draft/display-system.json',
      'agent-apps/draft/algorithm.py', 'manifest-algorithm-bindings/draft.json',
      'managed-display-systems/customer/display-system.json', 'managed-native-systems/customer.json',
      'company-system-revisions/draft.json', 'serial-protocols/custom.json', 'builtin-system-copies/copy.json',
      'managed-system-catalog.json', 'system-package-staff-credential.json', 'jqbed-algorithm-config.json',
    ]) {
      const privateFile = path.join(privateDirectory, privatePath);
      fs.mkdirSync(path.dirname(privateFile), { recursive: true });
      fs.writeFileSync(privateFile, '{"private":"never-distribute"}');
      const privateArchive = path.join(temporary, `${privatePath.replace(/\//g, '-')}.asar`);
      await finished(await asar.createPackage(privateDirectory, privateArchive));
      assert.throws(() => verifyPackagedDependencies(privateArchive), (error) => {
        assert.equal(error.code, 'PACKAGED_LOCAL_WORKSPACE_FOUND');
        assert(!error.message.includes('never-distribute'), 'never expose workspace contents');
        return true;
      });
      fs.rmSync(privateFile);
      // 移除已测试目录，避免下一轮被空目录抢先拦截。
      if (privatePath.includes('/')) fs.rmSync(path.join(privateDirectory, privatePath.split('/')[0]), { recursive: true });
    }
    writePackage(path.join(privateDirectory, 'backend/display-systems'), { name: 'runtime-module' });
    writePackage(path.join(privateDirectory, 'agent-resources/algorithm-packages'), { name: 'official-algorithms' });
    writePackage(path.join(privateDirectory, 'display-systems-runtime'), { name: 'neighbor' });
    const publicArchive = path.join(temporary, 'runtime-resources.asar');
    await finished(await asar.createPackage(privateDirectory, publicArchive));
    assert.equal(verifyPackagedDependencies(publicArchive), 0, 'keep source modules, official resources and neighboring names');

    const badPackage = path.join(staged, 'node_modules/express/package.json');
    fs.writeFileSync(badPackage, JSON.stringify({ name: 'express', version: '5.0.0', dependencies: { missing: '^1.0.0', qs: '^8.0.0' } }));
    const badArchive = path.join(temporary, 'bad.asar');
    await finished(await asar.createPackage(staged, badArchive));
    assert.throws(() => verifyPackagedDependencies(badArchive), /express -> missing: missing/);
    assert.throws(() => verifyPackagedDependencies(badArchive), /7\.0\.0 does not satisfy \^8\.0\.0/);

    writePackage(project, { name: 'app', dependencies: { missing: '*' } });
    assert.throws(() => collectRuntimePackages(project), /missing production dependency/);
    writePackage(project, { name: 'app', dependencies: { qs: '^9.0.0' } });
    assert.throws(() => collectRuntimePackages(project), /does not satisfy/);
    console.log('runtimeDependencies tests passed');
  } finally {
    // Electron 把 .asar 当虚拟目录；清理测试归档需要真实文件系统。
    diskFs.rmSync(temporary, { recursive: true, force: true, maxRetries: 3 });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
