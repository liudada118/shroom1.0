import { getBuiltinSystemOptions } from '../../services/displaySystemOptions';

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
      value, label: metadata.name || value, category: 'custom', source: 'manifest',
      matrix: metadata.matrix || runtime.sensorDefinition?.matrix, runtimeDefinition: runtime,
    });
  }
  return systems;
}

/** 读取服务端最新授权范围；未知范围保持 undefined，不能当成全部授权。 */
export function readPortalLicenseScope(message) {
  if (message?.selectFlag === 'all') return null;
  if (Array.isArray(message?.selectFlag)) return message.selectFlag;
  if (typeof message?.selectFlag === 'string') return [message.selectFlag];
  return undefined;
}

/** 自定义系统沿用独立安装入口；内置入口只在已知范围下判断是否可用。 */
export function isPortalSystemAllowed(system, scope) {
  return !!system && (system.source === 'manifest' || scope === null
    || (Array.isArray(scope) && scope.includes(system.value)));
}

/** 分类与检索仅改变预览，不发送切换、串口或采集命令。 */
export function filterPortalSystems(systems, category, query = '') {
  const search = query.trim().toLocaleLowerCase();
  return systems.filter((system) => (
    (category === 'all' || system.category === category)
    && (!search || `${system.label} ${system.value}`.toLocaleLowerCase().includes(search))
  ));
}
