const assert = require('node:assert/strict');
const fs = require('node:fs');
const diskFs = process.versions.electron ? require('original-fs') : fs;
const os = require('node:os');
const path = require('node:path');
const { finished } = require('node:stream/promises');
const { after, test } = require('node:test');
const { verifyFrontendBuild, verifyPackagedFrontendBuild } = require('../../../scripts/verify-frontend-build');
const { loadAsar } = require('../../../scripts/pack-runtime-dependencies');
const { electronBuilderBeforePack, electronBuilderAfterPack } = require('../../../scripts/package-hooks');

// Builder runs under plain Node; bypass Electron's archive cache so test fixtures can be removed on Windows.
const previousNoAsar = process.noAsar;
if (process.versions.electron) process.noAsar = true;
after(() => { process.noAsar = previousNoAsar; });

const VERSION = '1.1.37';
const METADATA = { schemaVersion: 1, buildId: 1792395247824, appVersion: VERSION };

/** Create an isolated packaging fixture; never read or replace the repository build directory. */
function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-frontend-metadata-'));
  t.after(() => diskFs.rmSync(root, { recursive: true, force: true, maxRetries: 3 }));
  return root;
}

/** Write a synthetic page and optional metadata, retaining malformed values for rejection checks. */
function writeBuild(root, metadata = METADATA) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><div id="root"></div>');
  if (metadata !== null) fs.writeFileSync(path.join(root, 'frontend-build.json'),
    typeof metadata === 'string' ? metadata : JSON.stringify(metadata));
}

/** Build the minimal real ASAR needed to exercise final Windows and macOS resource verification. */
async function writeArchive(resources, source, metadata) {
  fs.mkdirSync(resources, { recursive: true });
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({ name: 'synthetic-app', version: VERSION }));
  if (metadata !== undefined) writeBuild(path.join(source, 'build'), metadata);
  await finished(await loadAsar().createPackage(source, path.join(resources, 'app.asar')));
}

/** Construct the real Builder hook shape with an explicit application version and resource root. */
function builderContext(project, appOutDir, resources) {
  return { appOutDir, packager: { info: { appDir: project }, appInfo: { version: VERSION },
    config: { files: [{ from: '.', to: '.', filter: ['**/*'] }] }, getResourcesDir: () => resources } };
}

test('frontend metadata requires a valid stamped identity for the actual application version without writing a replacement', (t) => {
  const root = temporary(t);
  const good = path.join(root, 'good');
  writeBuild(good);
  const original = fs.readFileSync(path.join(good, 'frontend-build.json'));
  assert.deepEqual(verifyFrontendBuild(good, VERSION), METADATA);
  assert.deepEqual(fs.readFileSync(path.join(good, 'frontend-build.json')), original);
  const cases = [null, '{bad', [], { ...METADATA, schemaVersion: 2 }, { ...METADATA, buildId: 0 },
    { ...METADATA, buildId: -1 }, { ...METADATA, buildId: 1.5 }, { ...METADATA, buildId: Number.MAX_SAFE_INTEGER + 1 },
    { ...METADATA, appVersion: '' }, { ...METADATA, appVersion: '1.1.36' }];
  cases.forEach((metadata, index) => {
    const build = path.join(root, `bad-${index}`);
    writeBuild(build, metadata);
    assert.throws(() => verifyFrontendBuild(build, VERSION), {
      code: metadata === null ? 'FRONTEND_BUILD_METADATA_MISSING'
        : index === cases.length - 1 ? 'FRONTEND_BUILD_VERSION_MISMATCH' : 'FRONTEND_BUILD_METADATA_INVALID',
    });
    if (metadata === null) assert.equal(fs.existsSync(path.join(build, 'frontend-build.json')), false);
  });
});

test('Builder beforePack rejects missing or stale metadata before mutating dependency mappings', async (t) => {
  const project = temporary(t);
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'synthetic-app', version: VERSION }));
  const context = builderContext(project, path.join(project, 'output'), path.join(project, 'output/resources'));
  const before = JSON.stringify(context.packager.config);
  await assert.rejects(electronBuilderBeforePack(context), { code: 'FRONTEND_BUILD_METADATA_MISSING' });
  assert.equal(JSON.stringify(context.packager.config), before);
  writeBuild(path.join(project, 'build'), { ...METADATA, appVersion: '1.1.36' });
  await assert.rejects(electronBuilderBeforePack(context), { code: 'FRONTEND_BUILD_VERSION_MISMATCH' });
  assert.equal(JSON.stringify(context.packager.config), before);
  writeBuild(path.join(project, 'build'));
  await electronBuilderBeforePack(context);
  assert.ok(context.packager.config.files[0].filter.includes('!node_modules{,/**/*}'));
  assert.equal(require('../../../scripts/electron-builder-before-pack'), electronBuilderBeforePack);
  assert.equal(require('../../../scripts/electron-builder-after-pack'), electronBuilderAfterPack);
});

test('Builder afterPack validates Windows and macOS extraResources and retains private-config cleanup', async (t) => {
  const root = temporary(t);
  const layouts = [['win-unpacked', 'resources'], ['mac-arm64/Shroom.app', 'Contents/Resources']];
  for (const [outputName, resourceName] of layouts) {
    const appOutDir = path.join(root, outputName), resources = path.join(appOutDir, resourceName);
    const source = path.join(root, `${outputName.split('/')[0]}-source`);
    await writeArchive(resources, source);
    writeBuild(path.join(resources, 'build'));
    fs.writeFileSync(path.join(appOutDir, 'config.txt'), 'synthetic-private-config');
    const context = builderContext(root, appOutDir, resources);
    await electronBuilderAfterPack(context);
    assert.equal(fs.existsSync(path.join(appOutDir, 'config.txt')), false);
    fs.unlinkSync(path.join(resources, 'build/frontend-build.json'));
    await assert.rejects(electronBuilderAfterPack(context), { code: 'FRONTEND_BUILD_METADATA_MISSING' });
    writeBuild(path.join(resources, 'build'), { ...METADATA, appVersion: '1.1.36' });
    await assert.rejects(electronBuilderAfterPack(context), { code: 'FRONTEND_BUILD_VERSION_MISMATCH' });
  }
});

test('legacy app.asar/build is verified but cannot hide broken metadata in the preferred external build', async (t) => {
  const root = temporary(t), resources = path.join(root, 'resources');
  await writeArchive(resources, path.join(root, 'source'), METADATA);
  assert.deepEqual(verifyPackagedFrontendBuild(resources, VERSION), METADATA);
  await electronBuilderAfterPack(builderContext(root, root, resources));
  writeBuild(path.join(resources, 'build'), null);
  assert.throws(() => verifyPackagedFrontendBuild(resources, VERSION), { code: 'FRONTEND_BUILD_METADATA_MISSING' });
  const otherResources = path.join(root, 'missing-stamp/resources');
  await writeArchive(otherResources, path.join(root, 'missing-stamp/source'), null);
  assert.throws(() => verifyPackagedFrontendBuild(otherResources, VERSION), { code: 'FRONTEND_BUILD_METADATA_MISSING' });
});
