import { describe, expect, it } from 'vitest';
import { createInstance } from 'i18next';
import resources, { bilingualConfig } from './resources';
import japaneseTranslations from './ja';
import { translateBackendMessage } from './translateBackendMessage';

/** 枚举词条而非源文件中的注释、数据值或用户内容。 */
function entries(value, path = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const next = path ? `${path}.${key}` : key;
    return Object.hasOwn(child, 'zh') && Object.hasOwn(child, 'en') ? [[next, child]] : entries(child, next);
  });
}

/** 提取插值变量，防止译文丢掉帧数、名称或错误详情。 */
function placeholders(value) {
  return [...value.matchAll(/{{\s*([^}]+?)\s*}}/g)].map(match => match[1]).sort();
}

describe('complete UI translation catalog', () => {
  it('has explicit Japanese and matching interpolation fields for every entry', () => {
    const invalid = [];
    for (const [key, source] of entries(bilingualConfig)) {
      const ja = source.ja ?? japaneseTranslations[key]?.ja;
      if (!ja || !source.en || /\p{Script=Han}/u.test(source.en)
        || JSON.stringify(placeholders(source.zh)) !== JSON.stringify(placeholders(source.en))
        || JSON.stringify(placeholders(source.zh)) !== JSON.stringify(placeholders(ja))) invalid.push(key);
    }
    expect(invalid).toEqual([]);
  });

  it.each(['en', 'ja'])('translates known collection errors in %s without changing unknown messages', async language => {
    const i18n = createInstance();
    await i18n.init({ resources, lng: language, fallbackLng: false });
    const t = i18n.t.bind(i18n);
    expect(translateBackendMessage('请先停止采集，再切换系统。', t)).toBe(t('runtimeUi.stopBeforeSwitch'));
    expect(translateBackendMessage('无法确认采集状态，请重试。', t)).toBe(t('runtimeUi.statusUnknown'));
    expect(translateBackendMessage('设备自定义错误 123', t)).toBe('设备自定义错误 123');
  });
});
