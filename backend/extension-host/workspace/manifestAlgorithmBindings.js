const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { validateNativeConfiguration } = require('./builtinSystemConfiguration');

const EMPTY = Object.freeze({ algorithms: [], charts: [] });
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** 为当前用户创建的 Manifest 保存算法绑定，不改动协议、线序或已有采集目录。 */
function createManifestAlgorithmBindings({ root, getSystem, getEditor, listPackages }) {
  const cache = new Map();

  /** 将错误码保留给 HTTP 和 Agent，避免把不兼容输入误报成只读。 */
  function fail(code, message) { throw Object.assign(new Error(message), { code }); }

  /** 输入摘要只覆盖影响算法含义的传感器、协议和映射，显示布局变化不使绑定失效。 */
  function inputDigest(editor) {
    const sensors = editor.manifest.sensors || (editor.manifest.sensor ? [editor.manifest.sensor] : []);
    return createHash('sha256').update(JSON.stringify({ sensors, mappings: editor.definitions?.sensors || editor.definitions })).digest('hex');
  }

  /** 使用同一套包/指标校验原生与 Manifest 算法绑定。 */
  function normalize(configuration, editor, id) {
    if (!configuration || Object.keys(configuration).some((key) => !['algorithms', 'charts'].includes(key))) fail('DISPLAY_SYSTEM_INVALID', 'Manifest 算法配置只能包含 algorithms 和 charts。');
    const sensors = editor.manifest.sensors || (editor.manifest.sensor ? [editor.manifest.sensor] : []);
    const matrices = Object.fromEntries(sensors.filter((sensor) => sensor.id && sensor.matrix).map((sensor) => [sensor.id, {
      rows: sensor.matrix.rows, cols: sensor.matrix.cols, total: sensor.matrix.rows * sensor.matrix.cols,
    }]));
    const checked = validateNativeConfiguration({ ...configuration, showPressure: true, showArea: true }, {
      systemId: id, packages: listPackages(), inputs: { channels: Object.keys(matrices), matrices },
    });
    return { algorithms: checked.algorithms, charts: checked.charts };
  }

  /** 按系统目录对象缓存绑定；发现层重载后才重新核对磁盘输入摘要。 */
  function load(id) {
    if (!SAFE_ID.test(id || '')) fail('DISPLAY_SYSTEM_INVALID', '系统 ID 无效。');
    const system = getSystem(id);
    if (!system) return null;
    if (system.editable !== true) fail('DISPLAY_SYSTEM_READ_ONLY', '只能给用户创建的 Manifest 系统绑定算法。');
    if (cache.get(id)?.system === system) return cache.get(id).value;
    const editor = getEditor(id);
    if (!editor?.manifest || editor.kind === 'builtin-template') fail('DISPLAY_SYSTEM_INVALID', '目标不是 Manifest 系统。');
    const digest = inputDigest(editor);
    const filename = path.join(root, `${id}.json`);
    let saved = null;
    if (fs.existsSync(filename)) {
      try { saved = JSON.parse(fs.readFileSync(filename, 'utf8')); }
      catch { fail('DISPLAY_SYSTEM_BINDING_INVALID', '算法绑定文件损坏，请检查用户数据目录。'); }
      if (saved.inputDigest !== digest) fail('DISPLAY_SYSTEM_INPUT_CHANGED', '系统输入、协议或线序已变化，请核对后重新绑定算法。');
      const checked = normalize(saved.configuration, editor, id);
      const expectedRevision = createHash('sha256').update(JSON.stringify([digest, checked])).digest('hex');
      if (saved.systemId !== id || saved.revision !== expectedRevision) fail('DISPLAY_SYSTEM_BINDING_INVALID', '算法绑定文件内容或版本无效。');
      saved.configuration = checked;
    }
    const configuration = saved?.configuration || EMPTY;
    const revision = saved?.revision || createHash('sha256').update(`empty:${digest}`).digest('hex');
    const value = { systemId: id, revision, inputDigest: digest, configuration };
    cache.set(id, { system, value });
    return value;
  }

  /** 用期望版本原子替换当前系统的算法与图表，防止 Agent 覆盖另一次编辑。 */
  function update(id, { expectedRevision, configuration } = {}) {
    const current = load(id);
    if (!current) return null;
    if (expectedRevision !== current.revision) fail('DISPLAY_SYSTEM_REVISION_CONFLICT', '算法绑定已变化，请重新读取后提交。');
    const editor = getEditor(id);
    const normalized = normalize(configuration, editor, id);
    const revision = createHash('sha256').update(JSON.stringify([current.inputDigest, normalized])).digest('hex');
    const value = { systemId: id, revision, inputDigest: current.inputDigest, configuration: normalized };
    fs.mkdirSync(root, { recursive: true });
    const filename = path.join(root, `${id}.json`);
    const temporary = path.join(root, `${id}.${process.pid}.${Date.now()}.tmp`);
    try { fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { flag: 'wx' }); fs.renameSync(temporary, filename); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    cache.set(id, { system: getSystem(id), value });
    return value;
  }

  /** 帧路径仅读内存；没有绑定或输入已变时不启动分类器。 */
  function getRuntimeConfiguration(id) {
    try { return load(id)?.configuration || null; } catch { return null; }
  }

  return { read: load, update, getRuntimeConfiguration };
}

module.exports = { createManifestAlgorithmBindings };
