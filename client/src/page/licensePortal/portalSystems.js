import { BUILTIN_SYSTEM_ENTRIES, getBuiltinSystemOptions } from '../../services/displaySystemOptions';

export const PORTAL_CATEGORIES = Object.freeze([
  { key: 'care', title: '康养监测', description: '床垫、步态与健康观测', index: '01' },
  { key: 'vehicle', title: '座椅感知', description: '坐姿与多区域压力分布', index: '02' },
  { key: 'embodied', title: '具身触觉', description: '手部、身体与机器人感知', index: '03' },
  { key: 'custom', title: '定制系统', description: '通用矩阵与 Agent 展示系统', index: '04' },
]);

/** 合并真实入口；外部系统按 sensorType 去重，内置重名项不能绕过授权。 */
export function buildPortalSystems(t, runtimeDefinitions = []) {
  const builtin = getBuiltinSystemOptions(t);
  const seen = new Set(builtin.map((item) => item.value));
  const systems = builtin.filter((item) => item.value !== 'hand0205Double');
  for (const runtime of runtimeDefinitions) {
    const metadata = runtime?.displayMetadata || {};
    const value = runtime?.sensorDefinition?.type || metadata.sensorType;
    if (typeof value !== 'string' || !value.trim() || seen.has(value)) continue;
    seen.add(value);
    systems.push({
      value, systemId: runtime.sensorDefinition?.displaySystemId || runtime.sensorDefinition?.id || value,
      managed: metadata.managed === true, revisionDraft: metadata.revisionDraft === true,
      // Native runtime definitions in this list are persisted template copies; their metadata has no editable flag.
      editable: metadata.editable === true || (Boolean(runtime.builtinTemplate) && metadata.source === 'builtin-template'),
      label: metadata.name || value, category: 'custom', source: runtime.builtinTemplate ? 'builtin-template' : 'manifest',
      nativeSourceType: runtime.builtinTemplate?.sourceType,
      matrix: metadata.matrix || runtime.sensorDefinition?.matrix, runtimeDefinition: runtime,
    });
  }
  return systems;
}

/** Offer direct company submission only for a saved, editable local system. */
export function canSubmitPortalSystem(system) {
  return Boolean(system?.systemId && system.editable === true && !system.managed && !system.revisionDraft);
}

/** 读取服务端最新授权范围；未知范围保持 undefined，不能当成全部授权。 */
export function readPortalLicenseScope(message) {
  if (message?.selectFlag === 'all') return null;
  if (Array.isArray(message?.selectFlag)) return message.selectFlag;
  if (typeof message?.selectFlag === 'string') return [message.selectFlag];
  return undefined;
}

/** Only keys that may name a company system need a company-catalog request. */
export function needsCompanySystemSync(scope) {
  if (scope === null) return true;
  if (!Array.isArray(scope)) return false;
  const builtinIds = new Set(BUILTIN_SYSTEM_ENTRIES.map(([id]) => id));
  return scope.some((id) => typeof id === 'string' && !builtinIds.has(id));
}

/** Explain installation failures without hiding the local system that caused an ID collision. */
export function describeCompanySystemSync(result) {
  const errors = result?.errors || [];
  const conflicts = errors.filter((item) => item.code === 'SYSTEM_PACKAGE_CONFLICT');
  if (conflicts.length) {
    const first = conflicts[0];
    return `公司系统 ${first.systemId} 与本机系统冲突，未覆盖本机内容。${first.message}。请为草稿使用新 ID，或请管理员调整发布包。`;
  }
  if (errors.length) {
    const first = errors[0];
    return `公司系统 ${first.systemId} 安装失败：${first.message || '请稍后刷新重试'}${errors.length > 1 ? `；另有 ${errors.length - 1} 个系统失败` : ''}`;
  }
  return result?.installed?.length ? `已安装 ${result.installed.length} 个新系统` : '';
}

/** 已验证的密钥限定内置入口；自定义系统沿用独立安装入口。 */
export function isPortalSystemAllowed(system, scope, managedIds = []) {
  if (system?.revisionDraft) return scope !== undefined && !system.managed;
  // ⚠️ 受管系统同时需要签名目录授权和当前密钥里的系统 ID，不能只靠客户范围显示。
  if (system?.managed) return scope !== undefined && managedIds.includes(system.systemId)
    && (scope === null || (Array.isArray(scope) && scope.includes(system.systemId)));
  return !!system && scope !== undefined && (system.source === 'manifest' || scope === null
    || (Array.isArray(scope) && scope.includes(system.nativeSourceType || system.value)));
}

/** 列表只显示当前已验证密钥可访问的系统，未知授权不回退全量目录。 */
export function getAuthorizedPortalSystems(systems, scope, managedIds = []) {
  return systems.filter((system) => isPortalSystemAllowed(system, scope, managedIds));
}

/** 分类与检索仅改变预览，不发送切换、串口或采集命令。 */
export function filterPortalSystems(systems, category, query = '') {
  const search = query.trim().toLocaleLowerCase();
  return systems.filter((system) => (
    (category === 'all' || system.category === category)
    && (!search || `${system.label} ${system.value}`.toLocaleLowerCase().includes(search))
  ));
}
