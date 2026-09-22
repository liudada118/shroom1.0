const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { LICENSE_SENSOR_GROUPS } = require('../../../licenseScopes');
const { nativeInputs, validateNativeConfiguration } = require('./builtinSystemConfiguration');

const BUILTIN_TEMPLATES = Object.freeze(LICENSE_SENSOR_GROUPS.flatMap((group) => group.items.map((item) => ({
  id: item.value, name: item.label, labelKey: item.labelKey,
  sourceType: item.value, group: group.label,
  inheritance: ['serial-protocol', 'line-order', 'native-display', 'native-controls'],
}))));
const TYPES = new Set(BUILTIN_TEMPLATES.map((item) => item.id));
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** 生成模板操作的稳定错误，供 HTTP 和 Agent 共用。 */
function templateError(code, message) { return Object.assign(new Error(message), { code }); }

/** 校验原生模板声明；声明只能引用随软件发布的运行时，不能注入路径或代码。 */
function validateBuiltinTemplate(input) {
  if (!input || Object.keys(input).some((key) => !['id', 'name', 'sourceType'].includes(key))
    || typeof input.id !== 'string' || !SAFE_ID.test(input.id) || TYPES.has(input.id)
    || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100
    || !TYPES.has(input.sourceType)) throw templateError('DISPLAY_SYSTEM_INVALID', '请选择有效内置模板，并填写独立标识（字母、数字、下划线、短横线，最多 64 位）和名称。');
  return { id: input.id, name: input.name.trim(), sourceType: input.sourceType };
}

/** 提供原生系统副本的持久化目录与运行期选择；协议处理始终交回原系统。 */
function createBuiltinSystemTemplates({ root, isOccupied = () => false, listPackages = () => [], logger } = {}) {
  const systems = new Map();
  let selected = null;

  /** 每次读写都使用磁盘版本，外部编辑不能绕过提案的版本检查。 */
  function stored(id) {
    if (!SAFE_ID.test(id || '') || TYPES.has(id)) return null;
    const filename = path.join(root, `${id}.json`);
    if (!fs.existsSync(filename)) return null;
    const raw = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const { configuration, ...identity } = raw;
    const template = validateBuiltinTemplate(identity);
    if (template.id !== id) throw templateError('DISPLAY_SYSTEM_INVALID', '配置文件和系统 ID 不一致。');
    return { ...template, configuration: validateNativeConfiguration(configuration, { sourceType: template.sourceType, validatePackages: false }) };
  }

  /** 标识保留原有形状，独立配置单独暴露给编辑器与运行时。 */
  function identity(template) { const { id, name, sourceType } = template; return { id, name, sourceType }; }

  /** 修订号覆盖算法、图表和名称，防止两个编辑器覆盖彼此。 */
  function revision(template) { return crypto.createHash('sha256').update(JSON.stringify(template)).digest('hex'); }

  /** 重读可写目录；坏文件单独报告，不阻塞其他模板。 */
  function reload() {
    systems.clear();
    if (!fs.existsSync(root)) return;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      try {
        const value = stored(entry.name.slice(0, -5));
        if (!value) throw new Error('无效系统文件');
        if (entry.name !== `${value.id}.json` || isOccupied(value.id)) throw new Error('模板标识与现有系统冲突');
        systems.set(value.id, value);
      } catch (error) { logger?.warn?.('[builtinTemplates]', entry.name, error.message); }
    }
  }

  /** 返回前端目录可识别的原生模板定义，不将它注册为通用 Manifest 渲染器。 */
  function definition(template) {
    return { id: template.id, name: template.name, kind: 'builtin-template', builtinTemplate: identity(template), configuration: template.configuration, editable: true,
      runtimeDefinition: { builtinTemplate: { ...template, revision: revision(template) }, sensorDefinition: { type: template.id },
        displayMetadata: { id: template.id, name: template.name, source: 'builtin-template', nativeSourceType: template.sourceType } } };
  }

  /** 读取副本或内置来源，供配置器和 Agent 核实复制对象。 */
  function get(id) {
    const template = systems.get(id);
    return template ? definition(template) : null;
  }

  /** 返回稳定的可审阅声明及修订号，避免伪造可编辑的通用 Manifest。 */
  function editor(id) {
    const original = BUILTIN_TEMPLATES.find((item) => item.id === id);
    const template = stored(id) || (original && { id, name: original.name, sourceType: id, configuration: validateNativeConfiguration() });
    return template ? { kind: 'builtin-template', builtinTemplate: identity(template), configuration: template.configuration,
      inputs: nativeInputs(template.sourceType), editable: !original, writable: !original,
      revision: revision(template),
      inheritance: original?.inheritance || ['serial-protocol', 'line-order', 'native-display', 'native-controls'] } : null;
  }

  /** 独占创建新系统；只写声明，原系统及其采集文件不变。 */
  function create(input) {
    const { configuration, ...declaration } = input;
    const template = { ...validateBuiltinTemplate(declaration), configuration: validateNativeConfiguration(configuration, { sourceType: declaration.sourceType, systemId: declaration.id, packages: listPackages() }) };
    const trash = path.join(root, '.trash');
    if (fs.existsSync(trash) && fs.readdirSync(trash).some((name) => name.startsWith(`${template.id}.`))) throw templateError('DISPLAY_SYSTEM_EXISTS', '此 ID 的历史数据仍保留，请为新系统使用新的 ID。');
    if (systems.has(template.id) || isOccupied(template.id)) throw templateError('DISPLAY_SYSTEM_EXISTS', '这个系统标识已存在。');
    fs.mkdirSync(root, { recursive: true });
    try { fs.writeFileSync(path.join(root, `${template.id}.json`), JSON.stringify(template, null, 2) + '\n', { flag: 'wx', encoding: 'utf8' }); }
    catch (error) { if (error.code === 'EEXIST') throw templateError('DISPLAY_SYSTEM_EXISTS', '这个系统标识已存在。'); throw error; }
    systems.set(template.id, template);
    return { id: template.id, displaySystem: definition(template) };
  }

  /** 校验完整编辑结果；预览不写盘，应用必须带读回的修订号。 */
  function preview(id, input) {
    const previous = stored(id);
    if (!previous) throw templateError('DISPLAY_SYSTEM_READ_ONLY', '只有用户创建的独立系统可以修改。');
    if (!input || !Object.hasOwn(input, 'configuration') || Object.keys(input).some((key) => !['name', 'configuration', 'expectedRevision'].includes(key))) throw templateError('DISPLAY_SYSTEM_INVALID', '编辑请求需包含名称、完整配置和修订号。');
    if (input.expectedRevision !== revision(previous)) throw templateError('DISPLAY_SYSTEM_REVISION_CONFLICT', '系统配置已变化，请重新读取后修改。');
    return { ...validateBuiltinTemplate({ ...identity(previous), name: input.name }),
      configuration: validateNativeConfiguration(input.configuration, { sourceType: previous.sourceType, systemId: id, packages: listPackages() }) };
  }

  /** 原子保存系统配置；原系统、副本采集数据和其他副本不受影响。 */
  function update(id, input) {
    const next = preview(id, input);
    const temporary = path.join(root, `.${id}-${crypto.randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temporary, JSON.stringify(next, null, 2) + '\n', { flag: 'wx', encoding: 'utf8' });
      fs.renameSync(temporary, path.join(root, `${id}.json`));
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    systems.set(id, next);
    return { id, editor: editor(id), displaySystem: definition(next) };
  }

  /** 将未运行的系统配置移入回收目录；保留全部采集文件。 */
  function remove(id, expectedRevision) {
    const previous = stored(id);
    if (!previous) throw templateError('DISPLAY_SYSTEM_READ_ONLY', '只能删除用户创建的系统。');
    if (selected?.id === id) throw templateError('DISPLAY_SYSTEM_ACTIVE', '请先切换到其他系统，再删除此系统。');
    if (expectedRevision !== revision(previous)) throw templateError('DISPLAY_SYSTEM_REVISION_CONFLICT', '系统配置已变化，请重新读取后删除。');
    const trash = path.join(root, '.trash');
    fs.mkdirSync(trash, { recursive: true });
    fs.renameSync(path.join(root, `${id}.json`), path.join(trash, `${id}.${crypto.randomUUID()}.json`));
    systems.delete(id);
    return { id, deleted: true, dataRetained: true };
  }

  /** 切换前检查原系统授权；新名称不能绕过原系统的许可范围。 */
  function resolve(id, scope) {
    const template = stored(id);
    if (!template) return { id, sourceType: id, template: false };
    const allowed = scope === 'all' || (Array.isArray(scope) ? scope : [scope]).includes(template.sourceType);
    if (!allowed) throw Object.assign(templateError('LICENSE_SCOPE_REQUIRED', '当前授权不包含此模板的原系统。'), { httpStatus: 403 });
    return { ...template, template: true };
  }

  /** 激活已校验的选择；只在串口切换和数据库准备完成之后调用。 */
  function activate(selection) { selected = selection.template ? { ...selection } : null; }

  /** 对外使用副本身份，内部处理继续使用原系统类型。 */
  function currentId(sourceType) { return selected?.sourceType === sourceType ? selected.id : sourceType; }

  reload();
  return { catalog: BUILTIN_TEMPLATES, create, get, editor, reload, resolve, activate, currentId, preview, update, remove,
    getRuntimeConfiguration: (id) => systems.get(id)?.configuration || null,
    list: () => [...systems.values()].map(definition) };
}

module.exports = { BUILTIN_TEMPLATES, validateBuiltinTemplate, createBuiltinSystemTemplates };
