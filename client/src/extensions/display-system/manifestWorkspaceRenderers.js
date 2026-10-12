import { createMatrixDisplayRenderers, MATRIX_DISPLAY_MODES } from '@shroom/frontend/core/matrixDisplayModes.js';
import { buildDisplayProfileModel } from './displayProfileRuntime.js';

const LEGACY_RENDERERS = new Set(['heatmap', 'matrix', 'raw2d']);

/** 归一化旧视图选择；重复数字别名沿用原生数字，不改配置或数据映射。 */
export function resolveWorkspaceRendererId(rendererId) {
  if (rendererId === 'numMatrix2d') return 'numMatrix';
  return !rendererId || LEGACY_RENDERERS.has(rendererId) ? 'pointGrid' : rendererId;
}

/** 合并原生矩阵和 Agent 渲染器，保留旧方案的算法、图表、点位与窗口配置。 */
export function buildWorkspaceDisplayProfileModel(page, context, apps = []) {
  const model = buildDisplayProfileModel(page);
  const native = createMatrixDisplayRenderers(context);
  const candidates = [
    ...model.renderers.filter((item) => !LEGACY_RENDERERS.has(item.type))
      .sort((a, b) => Number(a.id === 'numMatrix2d') - Number(b.id === 'numMatrix2d')).map((item) => {
      const id = resolveWorkspaceRendererId(item.id);
      const defaults = native.find((mode) => mode.id === id);
      return defaults ? { ...defaults, ...item, id,
        label: id === 'numMatrix' || !item.label || item.label === item.id ? defaults.label : item.label,
        // 重复数字别名沿用原生矩阵；正常模式保留自定义参数。
        params: item.id === 'numMatrix2d' ? { ...item.params, ...defaults.params }
          : { ...defaults.params, ...item.params },
      } : item;
    }),
    ...native,
    ...apps.filter((app) => app.rendererId).map((app) => ({
      id: app.rendererId, type: app.rendererId, label: app.label, params: {},
    })),
  ];
  const renderers = candidates.filter((item, index) => candidates.findIndex((other) => other.id === item.id) === index);
  return { ...model, renderers, profiles: model.profiles.map((profile) => ({
    ...profile,
    label: resolveWorkspaceRendererId(profile.renderer) === 'numMatrix' && /^3D\s*数字$/.test(profile.label)
      ? '2D 数字' : profile.label,
    renderer: renderers.some((item) => item.id === resolveWorkspaceRendererId(profile.renderer))
      ? resolveWorkspaceRendererId(profile.renderer) : 'pointGrid',
  })) };
}

/** 常驻视图条优先显示系统声明的模式；单模式旧系统仍可选择通用矩阵模式。 */
export function buildWorkspaceViewOptions(page, renderers, activeRendererId) {
  const configuredIds = new Set((page?.renderers || []).map((item) => resolveWorkspaceRendererId(item.id)));
  const configured = renderers.filter((item) => configuredIds.has(item.id));
  const preferred = configured.length > 1 ? configured
    : renderers.filter((item) => MATRIX_DISPLAY_MODES.some((mode) => mode.rendererId === item.id));
  const active = renderers.find((item) => item.id === activeRendererId);
  const visible = active && !preferred.includes(active) ? [...preferred, active] : preferred;
  return visible.map((item) => ({ value: item.id,
    label: MATRIX_DISPLAY_MODES.find((mode) => mode.rendererId === item.id)?.label || item.label }));
}
