import { createMatrixDisplayRenderers } from '@shroom/frontend/core/matrixDisplayModes.js';
import { buildDisplayProfileModel } from './displayProfileRuntime.js';

const LEGACY_RENDERERS = new Set(['heatmap', 'matrix', 'raw2d']);

/** 把旧二维矩阵选择回落到原生点图；仅适配外观，不改已签名配置或数据映射。 */
export function resolveWorkspaceRendererId(rendererId) {
  return !rendererId || LEGACY_RENDERERS.has(rendererId) ? 'pointGrid' : rendererId;
}

/** 合并原生矩阵和 Agent 渲染器，保留旧方案的算法、图表、点位与窗口配置。 */
export function buildWorkspaceDisplayProfileModel(page, context, apps = []) {
  const model = buildDisplayProfileModel(page);
  const native = createMatrixDisplayRenderers(context);
  const candidates = [
    ...model.renderers.filter((item) => !LEGACY_RENDERERS.has(item.type)).map((item) => {
      const defaults = native.find((mode) => mode.id === item.id);
      return defaults ? { ...defaults, ...item, label: !item.label || item.label === item.id ? defaults.label : item.label,
        params: { ...defaults.params, ...item.params } } : item;
    }),
    ...native,
    ...apps.filter((app) => app.rendererId).map((app) => ({
      id: app.rendererId, type: app.rendererId, label: app.label, params: {},
    })),
  ];
  const renderers = candidates.filter((item, index) => candidates.findIndex((other) => other.id === item.id) === index);
  return { ...model, renderers, profiles: model.profiles.map((profile) => ({
    ...profile,
    renderer: renderers.some((item) => item.id === profile.renderer) ? profile.renderer : 'pointGrid',
  })) };
}
