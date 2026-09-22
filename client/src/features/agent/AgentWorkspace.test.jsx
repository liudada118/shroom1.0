import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AgentWorkspace from './AgentWorkspace';
import AgentSettings from './AgentSettings';
import AgentTaskCard from './AgentTaskCard';

/** 渲染一个方案供安全和操作边界断言使用。 */
function proposalMarkup(kind, status, overrides = {}) {
  return renderToStaticMarkup(<AgentTaskCard task={{ id: 'task-a', status: 'awaiting_action', steps: [], proposals: [{ id: 'proposal-a', kind, status, summary: '准备更新图表', ...overrides }] }} />);
}

describe('Agent 工作区界面边界', () => {
  it('普通浏览器只显示桌面使用说明，不生成虚假的设备状态', () => {
    const html = renderToStaticMarkup(<AgentWorkspace />);
    expect(html).toContain('在桌面软件中使用 Agent');
    expect(html).toContain('aria-label="关闭 Agent"');
    expect(html).toContain('aria-labelledby="shroom-agent-title"');
    expect(html).not.toContain('设备已连接');
    expect(html).not.toContain('任务执行中');
  });

  it('设置使用带标签的密码输入且不会回显主进程密钥', () => {
    const html = renderToStaticMarkup(<AgentSettings settings={{ baseUrl: 'https://example.com/v1', model: 'model-a', hasApiKey: true, apiKey: 'must-not-render' }} />);
    expect(html).toContain('type="password"');
    expect(html).toContain('for="shroom-agent-api-key"');
    expect(html).toContain('留空以保留当前密钥');
    expect(html).toContain('Responses API');
    expect(html).not.toContain('must-not-render');
  });

  it('模型生成的配置和说明按文本转义，不执行 HTML', () => {
    const html = proposalMarkup('update_display', 'pending', { summary: '<img src=x onerror=alert(1)>', after: { title: '<script>alert(1)</script>' } });
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('查看配置内容');
    expect(html).toContain('应用此方案');
  });

  it('只允许已应用的展示配置恢复，创建系统不出现删除撤销入口', () => {
    expect(proposalMarkup('update_display', 'applied')).toContain('恢复此项更改');
    expect(proposalMarkup('create_system', 'applied')).not.toContain('恢复此项更改');
    expect(proposalMarkup('update_display', 'uncertain')).not.toContain('恢复此项更改');
    expect(proposalMarkup('update_display', 'uncertain')).not.toContain('应用此方案');
    expect(proposalMarkup('update_display', 'applied')).toContain('设备数据是否正常以连接后的检查结果为准');
  });

  it('执行中的方案操作不可重复提交，并向读屏报告错误', () => {
    const html = renderToStaticMarkup(<AgentTaskCard task={{ id: 'task-a', status: 'failed', error: { message: '目标系统不存在' }, steps: [{ id: 'step-a', name: '读取系统', status: 'failed', message: '请先选择一个系统' }], proposals: [{ id: 'proposal-a', kind: 'update_display', status: 'pending', summary: '准备更新图表' }] }} disabled />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('目标系统不存在');
    expect(html).toMatch(/disabled=""[^>]*>应用此方案/);
    expect(html).toContain('请先选择一个系统');
  });

  it('连接提案展示实际证据，端口打开不等于实时验证，也不提供恢复按钮', () => {
    const html = proposalMarkup('connect_device', 'applied', { result: { connected: true, liveVerified: false } });
    expect(html).toContain('连接设备');
    expect(html).toContain('尚未验证有效实时数据');
    expect(html).toContain('查看实际执行与核验结果');
    expect(html).not.toContain('恢复此项更改');
    expect(proposalMarkup('connect_device', 'applied', { result: { connected: true, liveVerified: true } })).toContain('实际画面与物理标定仍需检查');
  });
});
