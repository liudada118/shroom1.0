import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PortalSessionBar, PortalQuickTools } from './PortalMonitoringChrome';

describe('门户最新监测控制层', () => {
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
    const actions = { onCharts: vi.fn(), onAlgorithms: vi.fn(), onSettings: vi.fn(), onZero: vi.fn() };
    const tree = PortalQuickTools({ chartsVisible: true, algorithmsOpen: true, ...actions });
    Object.values(actions).forEach((action) => expect(action).not.toHaveBeenCalled());
    expect(tree.props.className).toBe('portal-quick-tools-anchor');
    const card = tree.props.children;
    expect(card.props.className).toBe('portal-quick-tools');
    const buttons = card.props.children[1].props.children;
    expect(buttons.map((button) => button.props['aria-label'])).toEqual(['算法', '图表', '调节', '清零']);
    buttons.forEach((button) => button.props.onClick());
    Object.values(actions).forEach((action) => expect(action).toHaveBeenCalledOnce());
    expect(buttons[1].props['aria-pressed']).toBe(true);
    expect(buttons[0].props['aria-expanded']).toBe(true);
    expect(buttons[0].props['aria-controls']).toBe('portal-algorithm-market');
  });
});
