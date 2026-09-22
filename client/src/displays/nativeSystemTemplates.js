const templates = new Map();
const listeners = new Set();

/** 注册独立身份、原生来源及算法图表配置，通知当前页面刷新。 */
export function registerNativeSystemTemplate(template) {
  if (template?.id && template?.sourceType && JSON.stringify(templates.get(template.id)) !== JSON.stringify(template)) {
    templates.set(template.id, { ...template });
    for (const listener of listeners) listener();
  }
  return templates.get(template?.id) || null;
}

/** 查询副本声明；内置原系统返回 null。 */
export function getNativeSystemTemplate(id) { return templates.get(id) || null; }

/** 将副本入口还原为原生处理类型，供旧页面的专用分支使用。 */
export function resolveNativeSystemType(id) { return templates.get(id)?.sourceType || id; }

/** 独立系统标识用于串口切换、归零、画布和图表配置；型号只用于选择原生实现。 */
export function selectedNativeSystemId(sourceType) {
  let selected;
  try { selected = globalThis.localStorage?.getItem('file'); } catch { return sourceType; }
  return templates.get(selected)?.sourceType === sourceType ? selected : sourceType;
}

/** 枚举原生模板副本供入口列表展示。 */
export function listNativeSystemTemplates() { return [...templates.values()]; }

/** 监听原生独立系统配置，Agent 保存后正在打开的图表也会更新。 */
export function subscribeNativeSystemTemplates(listener) { listeners.add(listener); return () => listeners.delete(listener); }

/** 删除目录项时同步移除本地注册，避免旧名称仍留在选择器。 */
export function unregisterNativeSystemTemplate(id) { if (templates.delete(id)) for (const listener of listeners) listener(); }

/** 按完整后端目录清理已删除系统，再由原有注册流程载入其余定义。 */
export function syncNativeSystemTemplates(definitions) {
  const ids = new Set(definitions.map((entry) => entry.builtinTemplate?.id).filter(Boolean));
  for (const id of templates.keys()) if (!ids.has(id)) unregisterNativeSystemTemplate(id);
}
