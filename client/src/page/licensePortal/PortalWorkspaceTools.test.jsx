import { describe, expect, it } from 'vitest';
import { readWorkspaceToolSupport } from './PortalWorkspaceTools';
import { screenRulerDistance } from './PortalScreenRuler';

describe('工具箱能力与屏幕量尺', () => {
  it('未接入或已卸载的渲染器不冒充支持视角工具', () => {
    expect(readWorkspaceToolSupport(null)).toEqual({ view: null, flipX: false, flipY: false, select: false });
    const disposed = { getState: () => ({ available: false }) };
    expect(readWorkspaceToolSupport({ getViewTools: () => disposed }).view).toBe(null);
  });
  it('镜像状态与框选能力分开读取', () => {
    const view = { getState: () => ({ available: true, flipX: true }) };
    expect(readWorkspaceToolSupport({ getViewTools: () => view, changeSelectFlag() {} }))
      .toEqual({ view, flipX: true, flipY: false, select: true });
  });
  it('屏幕距离仅使用 CSS 像素，不乘 DPR 或冒充 mm', () => {
    expect(screenRulerDistance({ x: 10, y: 20 }, { x: 13, y: 24 })).toBe(5);
    expect(screenRulerDistance(null, { x: 13, y: 24 })).toBe(0);
  });
  it('超出旧式矩形投影假设时禁用框选，避免误报区域数据', () => {
    const renderer = { getViewTools: () => ({ getState: () => ({ available: true, selectionSafe: false }) }), changeSelectFlag() {} };
    expect(readWorkspaceToolSupport(renderer).select).toBe(false);
  });
});
