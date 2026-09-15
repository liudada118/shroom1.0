import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PortalSessionBar, PortalQuickTools } from './PortalMonitoringChrome';

describe('门户最新监测控制层', () => {
  it('实时串口直接放进会话栏，支持多个下拉而不产生设备弹窗入口', () => {
    const html = renderToStaticMarkup(<PortalSessionBar mode="now" deviceControls={
      <div role="group" aria-label="连接设备"><select aria-label="座椅串口" /><select aria-label="靠背串口" /></div>
    } />);
    expect(html).toContain('aria-label="座椅串口"');
    expect(html).toContain('aria-label="靠背串口"');
    expect(html).not.toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('portal-device-launch');
    const playback = renderToStaticMarkup(<PortalSessionBar mode="playback" deviceControls={<select />} />);
    expect(playback).toContain('aria-haspopup="dialog"');
    expect(playback).toContain('选择回放');
    expect(playback).not.toContain('<select');
  });

  it('串口选中不冒充已连接，开始和结束按钮反映原采集状态', () => {
    const idle = renderToStaticMarkup(<PortalSessionBar mode="now" selectedPorts collecting={false} />);
    expect(idle).toContain('串口已选择');
    expect(idle).not.toContain('已连接');
    expect(idle).toMatch(/aria-label="开始采集"(?! disabled)/);
    expect(idle).toMatch(/aria-label="结束采集" disabled=""/);
    const active = renderToStaticMarkup(<PortalSessionBar mode="now" collecting />);
    expect(active).toMatch(/aria-label="开始采集" disabled=""/);
    expect(active).toMatch(/aria-label="结束采集"(?! disabled)/);
  });

  it('回放模式禁用实时采集入口', () => {
    const html = renderToStaticMarkup(<PortalSessionBar mode="playback" collecting={false} />);
    expect(html).toContain('选择回放');
    expect(html).toMatch(/aria-label="开始采集" disabled=""/);
    expect(html).toMatch(/aria-label="结束采集" disabled=""/);
  });

  it('四个工具只在点击时调用各自的原生动作', () => {
    const actions = { onCharts: vi.fn(), onAlgorithms: vi.fn(), onSettings: vi.fn(), onTools: vi.fn() };
    const tree = PortalQuickTools({ chartsVisible: true, algorithmsOpen: true, toolsOpen: true, ...actions });
    Object.values(actions).forEach((action) => expect(action).not.toHaveBeenCalled());
    expect(tree.props.className).toBe('portal-quick-tools-anchor');
    const card = tree.props.children.props.children[1];
    expect(card.props.className).toBe('portal-quick-tools');
    const buttons = card.props.children[1].props.children;
    expect(buttons.map((button) => button.props['aria-label'])).toEqual(['算法', '图表', '调节', '工具']);
    buttons.forEach((button) => button.props.onClick());
    Object.values(actions).forEach((action) => expect(action).toHaveBeenCalledOnce());
    expect(buttons[1].props['aria-pressed']).toBe(true);
    expect(buttons[0].props['aria-expanded']).toBe(true);
    expect(buttons[0].props['aria-controls']).toBe('portal-algorithm-market');
    expect(buttons[3].props['aria-expanded']).toBe(true);
    expect(buttons[3].props['aria-controls']).toBe('portal-utility-panel');
  });

  it('收起是受控动作，保留原定位层和卡片内容但禁用隐藏控件', () => {
    const onCollapse = vi.fn();
    const expanded = PortalQuickTools({ collapsed: false, onCollapse });
    const expandedSlide = expanded.props.children;
    const expandedButton = expandedSlide.props.children[0];
    expect(expandedButton.props['aria-label']).toBe('收起快捷工具');
    expect(expandedButton.props['aria-expanded']).toBe(true);
    expandedButton.props.onClick();
    expect(onCollapse).toHaveBeenCalledWith(true);

    const collapsed = PortalQuickTools({ collapsed: true, onCollapse });
    const collapsedSlide = collapsed.props.children;
    const collapsedCard = collapsedSlide.props.children[1];
    const collapsedButton = collapsedSlide.props.children[0];
    expect(collapsed.props.className).toBe(expanded.props.className);
    expect(collapsedSlide.props.className).toContain('is-collapsed');
    expect(collapsedCard.props.inert).toBe(true);
    expect(collapsedCard.props.children[1].props.children).toHaveLength(4);
    expect(collapsedCard.props.children[1].props.inert).toBe(true);
    expect(collapsedCard.props.children[1].props['aria-hidden']).toBe(true);
    expect(collapsedButton.props['aria-label']).toBe('展开快捷工具');
    expect(collapsedButton.props['aria-expanded']).toBe(false);
    expect(collapsedButton.props.className).toBe('portal-quick-tools-handle');
    expect(renderToStaticMarkup(collapsed)).toContain('portal-drawer-grip');
    expect(renderToStaticMarkup(collapsed)).not.toContain('aria-label="left"');
    collapsedButton.props.onClick();
    expect(onCollapse).toHaveBeenLastCalledWith(false);
  });
});
