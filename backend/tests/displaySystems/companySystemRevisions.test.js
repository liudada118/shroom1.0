const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadDisplaySystemDirectory } = require('../../extension-host/manifest/displaySystemConfigLoader');
const { createDisplaySystemWorkspaceService } = require('../../extension-host/workspace/displaySystemWorkspaceService');
const { createBuiltinSystemTemplates } = require('../../extension-host/workspace/builtinSystemTemplates');
const { createCompanySystemRevisions } = require('../../extension-host/workspace/companySystemRevisions');
const { exportManifestPackage, exportNativePackage, installManifestPackage, installNativePackage } = require('../../extension-host/workspace/systemPackageService');

/** Create a local revision fixture with a separately installed published source. */
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-revision-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const writableRoot = path.join(root, 'display-systems');
  const workspace = createDisplaySystemWorkspaceService({ writableRoot });
  let revisions;
  const builtinTemplates = createBuiltinSystemTemplates({ root: path.join(root, 'native'),
    isRevisionDraft: (id) => revisions?.isDraftId(id) || false });
  const getById = (id) => {
    const native = builtinTemplates.get(id);
    if (native) return native;
    const directory = path.join(writableRoot, id);
    if (!fs.existsSync(directory)) return null;
    const loaded = loadDisplaySystemDirectory(directory);
    return loaded.ok ? { ...loaded.config, editable: true } : null;
  };
  const exportPackage = (id) => {
    const system = getById(id);
    return system.kind === 'builtin-template' ? exportNativePackage(system) : exportManifestPackage(system);
  };
  revisions = createCompanySystemRevisions({ root, workspace, builtinTemplates, getById,
    reload: () => builtinTemplates.reload(), exportPackage, verifyRelease: (release) => (
      release.package?.systemId === release.systemId && release.package.sha256 === release.sha256 && release.signature === 'test-signature') });
  return { root, workspace, builtinTemplates, revisions };
}

/** Wrap an exported package as a server release for this test's controlled verifier. */
function release(input, version = 3) {
  return { systemId: input.systemId, version, sha256: input.sha256, package: input, signature: 'test-signature' };
}

test('Manifest revision uses a separate draft ID and submits the stable published identity', (t) => {
  const f = fixture(t);
  const source = loadDisplaySystemDirectory(path.resolve(__dirname, '../../../display-systems/seatpad2'));
  assert.equal(source.ok, true);
  const original = exportManifestPackage({ ...source.config, editable: true });
  const created = f.revisions.create(release(original));
  assert.notEqual(created.draftId, original.systemId);
  assert.equal(f.revisions.list()[0].baseVersion, 3);
  assert.equal(f.revisions.inspect(created.draftId).hasChanges, false);
  const draftFile = path.join(f.workspace.writableRoot, created.draftId, 'display-system.json');
  const draft = JSON.parse(fs.readFileSync(draftFile, 'utf8'));
  draft.name = '坐垫优化版';
  fs.writeFileSync(draftFile, JSON.stringify(draft));
  const inspection = f.revisions.inspect(created.draftId);
  assert.equal(inspection.hasChanges, true);
  assert.ok(inspection.changedFiles.includes('display-system.json'));
  const output = f.revisions.exportRevision(created.draftId);
  assert.equal(output.baseVersion, 3);
  assert.equal(output.package.systemId, 'seatpad2');
  const installed = installManifestPackage(output.package, { managedRoot: path.join(f.root, 'installed') });
  const restored = loadDisplaySystemDirectory(installed.directory);
  assert.equal(restored.ok, true);
  assert.equal(restored.config.sensors[0].type, source.config.sensors[0].type);
  assert.equal(restored.config.sensors[0].matrix.rows, 23);
  assert.equal(restored.config.name, '坐垫优化版');
  assert.equal(f.revisions.create(release(original)).reused, true);
});

test('a newer published Manifest version creates a separate draft and preserves the old one', (t) => {
  const f = fixture(t);
  const source = loadDisplaySystemDirectory(path.resolve(__dirname, '../../../display-systems/seatpad2'));
  assert.equal(source.ok, true);
  const original = exportManifestPackage({ ...source.config, editable: true });
  const oldDraft = f.revisions.create(release(original, 3));
  const newDraft = f.revisions.create(release(original, 4));
  assert.notEqual(newDraft.draftId, oldDraft.draftId);
  assert.equal(f.revisions.create(release(original, 4)).draftId, newDraft.draftId);
  assert.equal(f.revisions.create(release(original, 4)).reused, true);
  assert.deepEqual(f.revisions.list().map((draft) => draft.baseVersion).sort(), [3, 4]);
  assert.equal(f.revisions.exportRevision(oldDraft.draftId).baseVersion, 3);
  assert.equal(f.revisions.exportRevision(newDraft.draftId).baseVersion, 4);
  assert.equal(f.revisions.exportRevision(newDraft.draftId).package.systemId, original.systemId);
});

test('Manifest revision rejects changed sensor shape before replacing a published system', (t) => {
  const f = fixture(t);
  const source = loadDisplaySystemDirectory(path.resolve(__dirname, '../../../display-systems/seatpad2'));
  const created = f.revisions.create(release(exportManifestPackage({ ...source.config, editable: true })));
  const filename = path.join(f.workspace.writableRoot, created.draftId, 'display-system.json');
  const draft = JSON.parse(fs.readFileSync(filename, 'utf8'));
  draft.sensors[0].matrix.rows = 24;
  fs.writeFileSync(filename, JSON.stringify(draft));
  assert.throws(() => f.revisions.exportRevision(created.draftId), { code: 'SYSTEM_REVISION_INPUT_CHANGED' });
});

test('native revision edits locally without a source-type grant and exports the original ID', (t) => {
  const f = fixture(t);
  f.builtinTemplates.create({ id: 'published_hand', name: '发布手部', sourceType: 'hand' });
  const original = exportNativePackage(f.builtinTemplates.get('published_hand'));
  const created = f.revisions.create(release(original, 7));
  assert.equal(f.revisions.inspect(created.draftId).hasChanges, false);
  assert.equal(f.builtinTemplates.resolve(created.draftId, []).sourceType, 'hand');
  const editor = f.builtinTemplates.editor(created.draftId);
  f.builtinTemplates.update(created.draftId, { name: '优化手部', configuration: editor.configuration, expectedRevision: editor.revision });
  assert.equal(f.revisions.inspect(created.draftId).hasChanges, true);
  const output = f.revisions.exportRevision(created.draftId).package;
  assert.equal(output.systemId, 'published_hand');
  assert.equal(output.template.id, 'published_hand');
  assert.equal(output.template.name, '优化手部');
  installNativePackage(output, { managedRoot: path.join(f.root, 'installed-native') });
});

test('a newer published native version does not replace its earlier local draft', (t) => {
  const f = fixture(t);
  f.builtinTemplates.create({ id: 'published_hand', name: '发布手部', sourceType: 'hand' });
  const original = exportNativePackage(f.builtinTemplates.get('published_hand'));
  const oldDraft = f.revisions.create(release(original, 7));
  const newDraft = f.revisions.create(release(original, 8));
  assert.notEqual(newDraft.draftId, oldDraft.draftId);
  assert.equal(f.revisions.create(release(original, 8)).draftId, newDraft.draftId);
  assert.deepEqual(f.revisions.list().map((draft) => draft.baseVersion).sort(), [7, 8]);
  assert.equal(f.revisions.exportRevision(oldDraft.draftId).package.template.id, 'published_hand');
  assert.equal(f.revisions.exportRevision(newDraft.draftId).baseVersion, 8);
});

test('a changed saved release cannot grant draft access while retaining the old signature', (t) => {
  const f = fixture(t);
  f.builtinTemplates.create({ id: 'published_hand', name: '发布手部', sourceType: 'hand' });
  const created = f.revisions.create(release(exportNativePackage(f.builtinTemplates.get('published_hand')), 7));
  const sourceFile = path.join(f.root, 'company-system-revisions', `${created.draftId}.source.json`);
  const saved = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  saved.package.template.name = '伪造的来源';
  fs.writeFileSync(sourceFile, JSON.stringify(saved));
  assert.equal(f.revisions.isDraftId(created.draftId), false);
  assert.deepEqual(f.revisions.list(), []);
  assert.throws(() => f.revisions.exportRevision(created.draftId), { code: 'SYSTEM_REVISION_NOT_FOUND' });
});

test('existing user classifiers block revision creation instead of being silently dropped', (t) => {
  const f = fixture(t);
  const source = loadDisplaySystemDirectory(path.resolve(__dirname, '../../../display-systems/seatpad2'));
  const input = exportManifestPackage({ ...source.config, editable: true });
  input.algorithms = [{ id: 'gesture' }];
  assert.throws(() => f.revisions.create(release(input)), { code: 'SYSTEM_REVISION_ALGORITHMS_UNSUPPORTED' });
  assert.deepEqual(f.revisions.list(), []);
});
