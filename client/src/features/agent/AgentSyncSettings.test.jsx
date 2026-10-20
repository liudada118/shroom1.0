import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AgentSyncSettings, { ChatUploadNotice } from './AgentSyncSettings';

describe('聊天同步归属与待传交互', () => {
  it('首次说明绑定实际接收方，已阅读后不重复展示', () => {
    const settings = { enabled: false, endpoint: 'https://tenant.example.test/chat', noticePending: true };
    const html = renderToStaticMarkup(<ChatUploadNotice settings={settings} onAcknowledge={() => {}} />);
    expect(html).toContain('tenant.example.test');
    expect(html).toContain('当前同步已暂停');
    expect(html).toContain('暂停聊天同步不影响它们');
    expect(renderToStaticMarkup(<ChatUploadNotice settings={{ ...settings, noticePending: false }} />)).toBe('');
  });

  it('旧归属待传只提供明确确认后的恢复，不泄露正文', () => {
    const html = renderToStaticMarkup(<AgentSyncSettings sync={{ settings: { enabled: true, endpoint: 'https://tenant.example.test/chat' },
      status: { pendingRange: { count: 2, oldestAt: '2026-10-01T00:00:00Z' }, recoverableQueues: [{ queueId: 'a'.repeat(64), legacy: true, count: 1 }] } }}
      onClear={() => {}} onRestore={() => {}} />);
    expect(html).toContain('当前凭据待传范围：2 个会话');
    expect(html).toContain('旧版归属待核对');
    expect(html).toContain('已留在本机，不会自动上传');
    expect(html).toContain('我已核对这些内容属于当前客户和当前接收方');
    expect(html).toMatch(/disabled="">恢复此队列/);
    expect(html).toMatch(/disabled="">清理待传队列/);
  });

  it('暂停和清理的区别可见，自定义接口不冒称公司默认服务', () => {
    const html = renderToStaticMarkup(<AgentSyncSettings sync={{ settings: { enabled: false, endpoint: 'https://tenant.example.test/chat', hasToken: true } }} />);
    expect(html).toContain('暂停会保留队列');
    expect(html).toContain('清理不删除本机聊天');
    expect(html).toContain('自定义接口使用独立上传凭证');
    expect(html).not.toContain('聊天默认自动同步到公司服务器');
    expect(html).toContain('实际服务端保存与删除执行状态请向管理员确认');
  });
});
