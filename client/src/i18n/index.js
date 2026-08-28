import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resources from './resources';

const supportedLanguages = new Set(['zh', 'en', 'ja']);

const languageLocales = Object.freeze({
  zh: 'zh-CN',
  en: 'en-US',
  ja: 'ja-JP',
});

const normalizeLanguage = (language) => {
  const baseLanguage = String(language || '').toLowerCase().split('-')[0];
  return supportedLanguages.has(baseLanguage) ? baseLanguage : 'zh';
};

const readInitialLanguage = () => {
  if (typeof window === 'undefined') return 'zh';

  try {
    return normalizeLanguage(window.localStorage.getItem('language'));
  } catch (error) {
    return 'zh';
  }
};

const mergeResourceBundles = () => {
  Object.entries(resources).forEach(([language, namespaces]) => {
    i18n.addResourceBundle(
      language,
      'translation',
      namespaces.translation,
      true,
      true,
    );
  });
};

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: readInitialLanguage(),
      fallbackLng: 'zh',
      supportedLngs: [...supportedLanguages],
      interpolation: { escapeValue: false },
      returnNull: false,
    });
} else {
  // Vite 热更新会复用已经初始化的 i18n 实例。显式合并新资源，避免新增文案
  // 在开发预览中直接显示成 `humanBodyRaw.peak` 之类的翻译键。
  mergeResourceBundles();
}

const syncDocumentLanguage = (language) => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = languageLocales[normalizeLanguage(language)];
};

syncDocumentLanguage(i18n.language);
i18n.on('languageChanged', (language) => {
  const normalizedLanguage = normalizeLanguage(language);
  syncDocumentLanguage(normalizedLanguage);
  try {
    window.localStorage.setItem('language', normalizedLanguage);
  } catch (error) {
    // Language switching still works when storage is unavailable.
  }
});

const getLanguageLocale = (language) => languageLocales[normalizeLanguage(language)];

export { getLanguageLocale, normalizeLanguage };
export default i18n;
