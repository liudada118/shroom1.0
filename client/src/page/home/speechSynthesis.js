import { getLanguageLocale, normalizeLanguage } from '../../i18n';

const FEMALE_VOICE_KEYWORDS = [
  'xiaoxiao', 'huihui', 'yaoyao', 'female', 'woman',
  'tingting', 'meijia', 'sinji', 'zira', 'hazel', 'susan',
  'linda', 'nanami', 'haruka', 'kyoko', 'otoya', 'google',
];

export const normalizeVoiceLanguageTag = (value) => (
  String(value || '').trim().toLowerCase().replaceAll('_', '-')
);

export function findVoiceForLanguage(voices, language) {
  const targetBase = normalizeVoiceLanguageTag(language).split('-')[0];
  const matches = (Array.isArray(voices) ? voices : []).filter((candidate) => (
    normalizeVoiceLanguageTag(candidate?.lang).split('-')[0] === targetBase
  ));

  return matches.find((candidate) => FEMALE_VOICE_KEYWORDS.some((keyword) => (
    String(candidate?.name || '').toLowerCase().includes(keyword)
  ))) || matches[0] || null;
}

export function speakLocalizedMessage(text, language = 'zh', dependencies = {}) {
  if (!text) return 'empty';

  const normalizedLanguage = normalizeLanguage(language);
  const locale = getLanguageLocale(normalizedLanguage);
  const synthesis = dependencies.synthesis || globalThis.speechSynthesis;
  const Utterance = dependencies.Utterance || globalThis.SpeechSynthesisUtterance;
  const onUnavailable = dependencies.onUnavailable || ((message) => console.warn(message));
  const allowWait = dependencies.allowWait !== false;

  if (!synthesis || typeof Utterance !== 'function') return 'unsupported';

  const selectedVoice = findVoiceForLanguage(synthesis.getVoices?.() || [], locale);
  if (normalizedLanguage === 'ja' && !selectedVoice) {
    if (allowWait && typeof synthesis.addEventListener === 'function') {
      const retry = () => {
        synthesis.removeEventListener?.('voiceschanged', retry);
        speakLocalizedMessage(text, language, {
          ...dependencies,
          synthesis,
          Utterance,
          onUnavailable,
          allowWait: false,
        });
      };
      synthesis.addEventListener('voiceschanged', retry, { once: true });
      return 'waiting';
    }

    onUnavailable('Japanese text-to-speech voice is unavailable');
    return 'unavailable';
  }

  const utterance = new Utterance(text);
  utterance.lang = locale;
  if (selectedVoice) utterance.voice = selectedVoice;
  synthesis.speak(utterance);
  return 'spoken';
}
