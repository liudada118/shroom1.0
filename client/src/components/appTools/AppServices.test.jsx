import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FrontendUpdateControls, FrontendUpdateStatus, RuntimeVersionDetails } from './AppServices';

describe('网页更新结果', () => {
  it('服务未发布的原因在重新打开设置后保留，并以可访问错误提示显示', () => {
    const html = renderToStaticMarkup(<FrontendUpdateStatus frontend={{ lastCheckResult: 'unavailable',
      lastMessage: '服务器尚未提供可用的网页版本，请管理员完成网页发布。', lastErrorCode: 'FRONTEND_RELEASE_UNAVAILABLE', lastCheckedAt: '2026-10-19T04:00:00Z' }} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('请管理员完成网页发布');
    expect(html).toContain('最近检查');
    expect(html).toContain('更新诊断信息');
    expect(html).not.toContain('已是最新');
  });
  it('区分检查中、待启用与尚未检查，不把下载完成冒充正在运行', () => {
    const pending = renderToStaticMarkup(<FrontendUpdateStatus frontend={{ pendingReleaseId: 42, lastCheckResult: 'ready' }} />);
    expect(pending).toContain('待启用发布：42');
    expect(pending).toContain('结束采集后关闭并重新打开');
    expect(renderToStaticMarkup(<FrontendUpdateStatus frontend={{ checking: true, lastCheckResult: 'unavailable', lastMessage: '旧错误' }} />)).not.toContain('旧错误');
    expect(renderToStaticMarkup(<FrontendUpdateStatus />)).toContain('尚未检查网页更新');
  });

  it('开发版以中性状态解释更新来源，禁用检查且不显示旧缓存与安装包错误', () => {
    const frontend = { source: 'development', updateSupported: false, lastCheckResult: 'development',
      lastMessage: '当前为开发版，页面由本地开发服务更新，无需检查网页更新。', bootPending: null };
    const html = renderToStaticMarkup(<FrontendUpdateControls frontend={frontend} />);
    expect(html).toContain('role="status"'); expect(html).toContain('本地开发服务更新');
    expect(html).toContain('开发版无需网页更新'); expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).not.toMatch(/role="alert"|缺少|已是最新|待启用发布|候选页面/);
    const stale = renderToStaticMarkup(<FrontendUpdateStatus frontend={{ ...frontend,
      pendingReleaseId: 42, lastErrorCode: 'FRONTEND_PACKAGED_BUILD_MISSING', lastCheckedAt: '2026-10-19T00:00:00Z' }} />);
    expect(stale).not.toMatch(/待启用发布|FRONTEND_PACKAGED_BUILD_MISSING|最近检查|更新诊断信息/);
  });

  it('生产和旧宿主仍可检查，生产失败保持可访问诊断，不把能力缺失误称开发版', () => {
    const production = renderToStaticMarkup(<FrontendUpdateControls frontend={{ source: 'packaged', updateSupported: true,
      lastCheckResult: 'unavailable', lastMessage: '网页发布暂不可用', lastErrorCode: 'FRONTEND_RELEASE_UNAVAILABLE' }} />);
    expect(production).toContain('检查网页更新'); expect(production).toContain('role="alert"');
    expect(production).toContain('FRONTEND_RELEASE_UNAVAILABLE'); expect(production).not.toMatch(/disabled=""|开发版无需/);
    const legacy = renderToStaticMarkup(<FrontendUpdateControls frontend={{ source: 'cache' }} />);
    expect(legacy).toContain('检查网页更新'); expect(legacy).not.toContain('disabled=""');
    const unavailable = renderToStaticMarkup(<FrontendUpdateControls frontend={{ source: 'packaged', updateSupported: false }} />);
    expect(unavailable).toMatch(/<button[^>]*disabled=""/); expect(unavailable).not.toContain('开发版');
  });
});

describe('运行版本诊断', () => {
  it('准确区分候选缓存、宿主与系统包，显示回退原因', () => {
    const html = renderToStaticMarkup(<RuntimeVersionDetails frontend={{ appVersion: '1.1.37', hostContract: 1, activeBuildId: 42,
      activeReleaseId: 7, source: 'cache', bootPending: true, lastRollbackAt: '2026-10-19T00:00:00Z', lastRollbackReason: 'FRONTEND_BOOT_FAILED' }}
      runtimeVersions={{ systemPackageVersion: '12', serverContractVersion: '1.3' }} />);
    for (const value of ['1.1.37', '验证缓存', '构建 42', '发布 7', '候选页面等待外壳启动确认', 'FRONTEND_BOOT_FAILED', '系统包', '12', '1.3']) expect(html).toContain(value);
  });

  it('安装包页面与未知版本不冒充设备功能验收通过', () => {
    const html = renderToStaticMarkup(<RuntimeVersionDetails frontend={{ source: 'packaged' }} />);
    expect(html).toContain('安装包页面');
    expect(html).toContain('未知');
    expect(html).toContain('设备功能需另行验收');
    expect(html).not.toContain('启动已确认');
    const confirmed = renderToStaticMarkup(<RuntimeVersionDetails frontend={{ source: 'packaged', bootPending: false }} />);
    expect(confirmed).toContain('外壳启动已确认');
    const unread = renderToStaticMarkup(<RuntimeVersionDetails />);
    expect(unread).toContain('待读取');
    expect(unread).not.toContain('安装包页面');
    expect(unread).not.toContain('随安装包');
    expect(unread).not.toContain('启动已确认');
  });

  it('开发服务不借用旧发布号、回退信息或外壳确认描述', () => {
    const html = renderToStaticMarkup(<RuntimeVersionDetails frontend={{ source: 'development', bootPending: false,
      activeBuildId: 42, activeReleaseId: 7, lastRollbackAt: '2026-10-19T00:00:00Z', lastRollbackReason: 'FRONTEND_BOOT_FAILED' }} />);
    expect(html).toContain('本地开发服务'); expect(html).toContain('无需网页缓存发布');
    expect(html).toContain('设备功能需另行验收');
    expect(html).not.toMatch(/安装包页面|验证缓存|候选页面|外壳启动已确认|构建 42|发布 7|最近回退|FRONTEND_BOOT_FAILED/);
  });
});
