import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tooltip } from 'antd';
import { describe, expect, it, vi } from 'vitest';
import PortalUtilityPanel, { bindPortalUtilityPanelFocus, PortalUtilityItem } from './PortalUtilityPanel';

/** 用最小 DOM 协议验证非模态焦点边界，不引入新的浏览器测试依赖。 */
function focusFixture() {
  const owner = { body: {}, activeElement: null };
  const opener = { isConnected: true, focus: vi.fn(() => { owner.activeElement = opener; }) };
  const closeButton = { focus: vi.fn(() => { owner.activeElement = closeButton; }) };
  const inner = {};
  const listeners = new Map();
  const root = {
    ownerDocument: owner,
    contains: (element) => element === root || element === inner || element === closeButton,
    querySelector: vi.fn(() => closeButton),
    addEventListener: vi.fn((name, listener) => listeners.set(name, listener)),
    removeEventListener: vi.fn((name, listener) => {
      if (listeners.get(name) === listener) listeners.delete(name);
    }),
  };
  owner.activeElement = opener;
  return { owner, opener, closeButton, inner, listeners, root };
}

/** 构造可观测键盘事件，避免调用时隐含取消或传播状态。 */
function keyboardEvent(target, key = 'Escape') {
  return { target, key, defaultPrevented: false, preventDefault: vi.fn(), stopPropagation: vi.fn() };
}

describe('门户实用工具箱', () => {
  it('分类明确，初始只显示视角工具，不混入清零或系统配置', () => {
    const html = renderToStaticMarkup(<PortalUtilityPanel open items={[
      { id: 'rotate', category: 'view', label: 'X 轴 +30°' },
      { id: 'zero', category: 'processing', label: '压力清零' },
      { id: 'display', label: '显示与语言' },
    ]} />);
    for (const label of ['视角调节', '数据分析', '数据处理', '系统设置']) expect(html).toContain(label);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('X 轴 +30°');
    expect(html).not.toContain('压力清零');
    expect(html).not.toContain('显示与语言');
  });
  it('只展示宿主提供的工具，渲染不会执行动作，禁用和启用状态有文字语义', () => {
    const onClick = vi.fn();
    const html = renderToStaticMarkup(<PortalUtilityPanel open items={[
      { id: 'zero', label: '压力清零', description: '将当前压力作为零点', onClick },
      { id: 'restore', label: '恢复零点', description: '尚未设置零点', disabled: true, onClick },
      { id: 'grid', label: '网格', description: '显示参考网格', active: true, onClick },
    ]} />);
    expect(onClick).not.toHaveBeenCalled();
    expect(html).toContain('id="portal-utility-panel"');
    expect(html).toContain('aria-labelledby="portal-utility-title"');
    expect(html).toContain('aria-hidden="false"');
    expect(html).not.toContain('aria-modal');
    expect(html).toMatch(/aria-label="恢复零点"[^>]*disabled=""/);
    expect(html).toContain('暂不可用');
    expect(html).toMatch(/aria-label="网格" aria-pressed="true"/);
    expect(html).toContain('已启用');
    expect(html).not.toContain('连接设备');
    expect(html).not.toContain('将当前压力作为零点');
    expect(html).not.toContain('portal-utility-card-description');
    expect(html).not.toContain('portal-utility-card-action');
    expect(html).toMatch(/tabindex="0" role="group" aria-label="恢复零点，暂不可用"/);
  });

  it('说明使用受控 hover/focus Tooltip，挂 body 避免横向滚动裁剪', () => {
    const onOpenChange = vi.fn();
    const item = { id: 'zero', label: '压力清零', description: '以当前压力作为零点基准', onClick: vi.fn() };
    const hint = PortalUtilityItem({ item, hintOpen: true, onHintOpenChange: onOpenChange });
    expect(hint.type).toBe(Tooltip);
    expect(hint.props).toMatchObject({ title: item.description, trigger: ['hover', 'focus'], placement: 'top', open: true, destroyOnHidden: true });
    expect(hint.props).toMatchObject({ arrow: false, align: { offset: [0, -96] } });
    const body = {};
    expect(hint.props.getPopupContainer({ ownerDocument: { body } })).toBe(body);
    expect(hint.props.children.type).toBe('button');
    expect(hint.props.children.props.onClick).toBe(item.onClick);
    hint.props.onOpenChange(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('禁用工具仍有可聚焦说明入口，内部按钮保持原生禁用状态', () => {
    const hint = PortalUtilityItem({ item: { id: 'restore', label: '恢复零点', description: '尚未设置零点', disabled: true }, hintOpen: false });
    const target = hint.props.children;
    expect(target.type).toBe('span');
    expect(target.props).toMatchObject({ tabIndex: 0, role: 'group', 'aria-label': '恢复零点，暂不可用' });
    expect(target.props.children.type).toBe('button');
    expect(target.props.children.props.disabled).toBe(true);
  });

  it('关闭时从可访问树和键盘操作中移除工具，空列表有说明', () => {
    const html = renderToStaticMarkup(<PortalUtilityPanel open={false} />);
    expect(html).toContain('aria-hidden="true" inert=""');
    expect(html).not.toContain('is-open');
    expect(html).toContain('当前系统没有可用工具');
  });

  it('栏内 Escape 关闭当前工具箱并还焦点，不捕获外部或子控件已处理的事件', () => {
    const fixture = focusFixture();
    const onClose = vi.fn();
    const cleanup = bindPortalUtilityPanelFocus(fixture.root, onClose);
    expect(fixture.closeButton.focus).toHaveBeenCalledWith({ preventScroll: true });
    const handler = fixture.listeners.get('keydown');
    handler(keyboardEvent({}, 'Escape'));
    handler(keyboardEvent(fixture.inner, 'Enter'));
    handler({ ...keyboardEvent(fixture.inner), defaultPrevented: true });
    expect(onClose).not.toHaveBeenCalled();
    const escape = keyboardEvent(fixture.inner);
    handler(escape);
    expect(onClose).toHaveBeenCalledOnce();
    expect(escape.preventDefault).toHaveBeenCalledOnce();
    expect(escape.stopPropagation).toHaveBeenCalledOnce();
    cleanup();
    expect(fixture.opener.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(fixture.listeners.size).toBe(0);
  });

  it('工具打开其他弹窗时不夺焦点，触发器卸载时也不尝试聚焦', () => {
    const otherDialog = focusFixture();
    const releaseDialog = bindPortalUtilityPanelFocus(otherDialog.root, vi.fn());
    otherDialog.owner.activeElement = {};
    releaseDialog();
    expect(otherDialog.opener.focus).not.toHaveBeenCalled();

    const removed = focusFixture();
    const releaseRemoved = bindPortalUtilityPanelFocus(removed.root, vi.fn());
    removed.opener.isConnected = false;
    releaseRemoved();
    expect(removed.opener.focus).not.toHaveBeenCalled();
  });

  it('栏内 Escape 先关闭说明，再次 Escape 关闭工具条；外部 Escape 不被消费', () => {
    const fixture = focusFixture();
    const onClose = vi.fn();
    const dismissHint = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    const cleanup = bindPortalUtilityPanelFocus(fixture.root, onClose, dismissHint);
    const handler = fixture.listeners.get('keydown');
    const outside = keyboardEvent({});
    handler(outside);
    expect(dismissHint).not.toHaveBeenCalled();
    expect(outside.preventDefault).not.toHaveBeenCalled();
    handler(keyboardEvent(fixture.inner));
    expect(onClose).not.toHaveBeenCalled();
    expect(fixture.opener.focus).not.toHaveBeenCalled();
    handler(keyboardEvent(fixture.inner));
    expect(onClose).toHaveBeenCalledOnce();
    cleanup();
  });
});
