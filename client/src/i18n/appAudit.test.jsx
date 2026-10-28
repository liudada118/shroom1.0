import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import i18n, { getLanguageLocale } from './index';
import { appUi } from './appAuditTranslations';
import { FrontendUpdateControls, FrontendUpdateStatus, RuntimeVersionDetails } from '../components/appTools/AppServices';
import License from '../page/license/License';

afterEach(() => i18n.changeLanguage('zh'));

describe('application settings and license translations', () => {
  it.each(['en', 'ja'])('renders actual update and license controls in %s', async language => {
    await i18n.changeLanguage(language);
    const controls = renderToStaticMarkup(<FrontendUpdateControls frontend={{ source: 'packaged', pendingReleaseId: 42 }} />);
    expect(controls).toContain(i18n.t('appUi.webpageUpdates'));
    expect(controls).toContain(i18n.t('appUi.pendingRelease', { id: 42 }));
    expect(controls).not.toContain('网页更新');
    const license = renderToStaticMarkup(<License />);
    for (const key of ['title', 'inputKey', 'parsePreview', 'writeToApp', 'emptyPreview']) {
      expect(license).toContain(i18n.t(`licenseAdmin.${key}`));
    }
    expect(license).not.toMatch(/密钥配置中心|解析预览|请在左侧输入密钥|licenseAdmin\./);
    if (language === 'en') expect(controls + license).not.toMatch(/\p{Script=Han}/u);
  });

  it('formats dates in the selected locale while retaining external diagnostic details', async () => {
    const timestamp = '2026-10-19T04:00:00Z';
    const detail = '客户自定义错误详情';
    for (const language of ['en', 'ja']) {
      await i18n.changeLanguage(language);
      const status = renderToStaticMarkup(<FrontendUpdateStatus frontend={{ lastCheckResult: 'unavailable', lastMessage: detail,
        lastCheckedAt: timestamp, lastErrorCode: 'FRONTEND_RELEASE_UNAVAILABLE' }} />);
      expect(status).toContain(detail);
      expect(status).toContain('FRONTEND_RELEASE_UNAVAILABLE');
      expect(status).toContain(new Date(timestamp).toLocaleString(getLanguageLocale(language)));
      const runtime = renderToStaticMarkup(<RuntimeVersionDetails frontend={{ source: 'cache', appVersion: '1.1.40',
        activeBuildId: 42, bootPending: true }} />);
      expect(runtime).toContain(i18n.t('appUi.bootPending'));
      expect(runtime).toContain(i18n.t('appUi.build', { id: 42 }));
      expect(runtime).toContain('1.1.40');
    }
  });

  it('provides all three languages with matching interpolation fields', () => {
    for (const [key, values] of Object.entries(appUi)) {
      // 比较插值字段，避免语言切换丢失版本号、时间或计数。
      const tokens = text => [...text.matchAll(/{{(\w+)}}/g)].map(match => match[1]).sort();
      for (const language of ['zh', 'en', 'ja']) {
        expect(values[language], `${key}.${language}`).toBeTruthy();
        expect(tokens(values[language])).toEqual(tokens(values.zh));
        expect(i18n.getResource(language, 'translation', `appUi.${key}`)).toBe(values[language]);
      }
    }
  });
});
