import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Select } from 'antd';
import { PortalDisplayPanel, PortalQuickTools } from '../../page/licensePortal/PortalMonitoringChrome';
import PortalWorkspaceTools from '../../page/licensePortal/PortalWorkspaceTools';
import PortalRendererControls from '../../page/licensePortal/PortalRendererControls';

vi.mock('../onestep/heatmap', () => ({ bthClickHandle: vi.fn() }));
vi.mock('../../i18n', () => ({ getLanguageLocale: () => 'zh-CN' }));
import TranslatedTitle from './Title';

const Title = TranslatedTitle.render({}, null).type.WrappedComponent;

/** 遍历真实标题栏、Portal 和组件插槽，检查用户实际能用到的入口。 */
function entries(node) {
  if (Array.isArray(node)) return node.flatMap(entries);
  if (!node || typeof node !== 'object') return [];
  if (!node.props) return entries(node.children);
  return [node, ...entries(node.props.children), ...entries(node.props.languageControl), ...entries(node.props.deviceControls)];
}

/** 使用隔离实例检验真实事件，不连接设备或挂载渲染场景。 */
function createTitle() {
  const title = new Title();
  title.props = { matrixName: 'hand', history: 'now', numMatrixFlag: 'normal', colFlag: true,
    t: (key) => key, i18n: { language: 'zh', changeLanguage: vi.fn() }, port: [], dataArr: [],
    changeStateData: vi.fn(), com: { current: null }, portalEmbedded: true, portalToolsHost: { nodeType: 1 } };
  return title;
}

describe('监测页常驻显示与语言设置', () => {
  beforeEach(() => localStorage.clear());

  it('工具箱关闭、快捷工具收起时仍保留显示方式和语言选择', () => {
    const title = createTitle();
    title.state.portalToolsCollapsed = true;
    const tree = entries(title.render());
    expect(tree.find((node) => node.type === PortalDisplayPanel)).toBeDefined();
    expect(tree.find((node) => node.type === PortalQuickTools).props.collapsed).toBe(true);
    expect(tree.find((node) => node.type === PortalWorkspaceTools).props.displayContent).toBeUndefined();
    expect(tree.filter((node) => node.type === PortalRendererControls)).toHaveLength(1);
    expect(tree.find((node) => node.type === Select && node.props['aria-label'] === '显示方式')).toBeDefined();
    const language = tree.find((node) => node.type === Select && node.props['aria-label'] === '界面语言');
    language.props.onChange('en');
    expect(localStorage.getItem('language')).toBe('en');
    expect(title.props.i18n.changeLanguage).toHaveBeenCalledWith('en');
  });

  it('数据设置抽屉移除原始数据跳转，原生数字显示方式仍然可选', () => {
    const tree = entries(createTitle().render());
    expect(tree.some((node) => String(node.props.to || '').startsWith('/num/'))).toBe(false);
    const display = tree.find((node) => node.type === Select && node.props['aria-label'] === '显示方式');
    expect(display.props.options).toContainEqual({ value: 'numoriginal', label: 'rawData' });
  });

  it('小床算法设置直接可见，点击打开原有设置页', () => {
    const title = createTitle();
    title.props.matrixName = 'jqbed';
    title.state.portalToolsCollapsed = true;
    title.setState = vi.fn();
    const button = entries(title.render()).find((node) => node.props.className === 'portal-bed-settings');
    expect(button).toBeDefined();
    expect(button.props.disabled).toBe(false);
    button.props.onClick();
    expect(title.setState).toHaveBeenCalledWith({ portalToolsOpen: false, jqbedAlgorithmConfigOpen: true });
  });

  it('回放仍可看到小床设置入口，但不能修改实时算法；其他系统不显示', () => {
    const title = createTitle();
    expect(entries(title.render()).some((node) => node.props.className === 'portal-bed-settings')).toBe(false);
    title.props = { ...title.props, matrixName: 'jqbed', history: 'playback' };
    expect(entries(title.render()).find((node) => node.props.className === 'portal-bed-settings').props.disabled).toBe(true);
  });
});
