import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import i18n from '../../i18n';
import { UpdateErrorNotice } from './UpdateNotifier';
import { updaterErrorKey } from './updaterMessage';

describe('安装包更新失败提示', () => {
  it('旧宿主 Mac 404 不显示凭据建议、传输详情或本机路径', () => {
    const raw = 'Cannot find channel latest-mac.yml HttpError: 404 https://private.invalid?token=secret Headers: Bearer secret at /Users/private/app.asar';
    const key = updaterErrorKey({ message: raw });
    expect(key).toBe('update.macUnavailable');
    const html = renderToStaticMarkup(<UpdateErrorNotice error={key} />);
    expect(html).toContain('role="alert"'); expect(html).toContain('macOS');
    expect(html).toContain('网页更新'); expect(html).not.toMatch(/secret|Headers|token|app\.asar|https?:/);
  });

  it('新错误码、Windows 404、网络和未知错误均使用安全文案', () => {
    expect(updaterErrorKey({ code: 'MAC_RELEASE_UNAVAILABLE', message: 'secret' })).toBe('update.macUnavailable');
    expect(updaterErrorKey(new Error('Cannot find channel latest.yml HttpError: 404'))).toBe('update.windowsUnavailable');
    expect(updaterErrorKey(new Error('net::ERR_CONNECTION_RESET secret'))).toBe('update.networkUnavailable');
    expect(updaterErrorKey(new Error('unknown secret'))).toBe('update.genericFailure');
    expect(updaterErrorKey({ code: 'toString' })).toBe('update.genericFailure');
  });

  it('安装包与网页更新有明确边界，不假称网页会升级后端', () => {
    expect(i18n.t('update.action', { lng: 'zh' })).toBe('安装包更新');
    expect(i18n.t('update.installerScope', { lng: 'zh' })).toContain('网页更新不会升级本机后端能力');
    expect(renderToStaticMarkup(<UpdateErrorNotice error={null} />)).toBe('');
  });
});
