import { getLanguageLocale, normalizeLanguage } from '../../i18n';

const FEMALE_VOICE_KEYWORDS = [
  'xiaoxiao', 'huihui', 'yaoyao', 'female', 'woman',
  'tingting', 'meijia', 'sinji', 'zira', 'hazel', 'susan',
  'linda', 'nanami', 'haruka', 'kyoko', 'otoya', 'google',
];

const JAPANESE_ALERT_AUDIO_PATHS = Object.freeze({
  leftBed: '/audio/alerts/ja/left-bed.mp3',
  fallRisk: '/audio/alerts/ja/edge-seat.mp3',
  satUp: '/audio/alerts/ja/edge-seat.mp3',
  emergency: '/audio/alerts/ja/emergency.mp3',
});

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

function speakWithSystemVoice(text, language, dependencies = {}) {
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
        speakWithSystemVoice(text, language, {
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

export function createLocalizedSpeechController() {
  let activeJapaneseAlert = null;

  const clearIfActive = (record) => {
    if (activeJapaneseAlert === record) activeJapaneseAlert = null;
  };

  const speakLocalizedMessage = (text, language = 'zh', dependencies = {}) => {
    if (!text) return 'empty';

    const normalizedLanguage = normalizeLanguage(language);
    const audioPath = normalizedLanguage === 'ja'
      ? JAPANESE_ALERT_AUDIO_PATHS[dependencies.alertKey]
      : null;

    if (!audioPath) return speakWithSystemVoice(text, language, dependencies);

    if (activeJapaneseAlert?.alertKey === dependencies.alertKey) {
      return 'already-playing';
    }

    if (activeJapaneseAlert) {
      activeJapaneseAlert.cancelled = true;
      activeJapaneseAlert.audio.pause?.();
      activeJapaneseAlert.audio.currentTime = 0;
      activeJapaneseAlert = null;
    }

    const AudioConstructor = dependencies.AudioConstructor || globalThis.Audio;
    if (typeof AudioConstructor !== 'function') {
      return speakWithSystemVoice(text, language, dependencies);
    }

    let audio;
    try {
      audio = new AudioConstructor(audioPath);
    } catch (_error) {
      return speakWithSystemVoice(text, language, dependencies);
    }

    const record = {
      alertKey: dependencies.alertKey,
      audio,
      cancelled: false,
      fallbackStarted: false,
    };
    activeJapaneseAlert = record;

    const fallbackOnce = () => {
      if (record.cancelled || record.fallbackStarted) return null;
      record.fallbackStarted = true;
      clearIfActive(record);
      return speakWithSystemVoice(text, language, dependencies);
    };

    audio.addEventListener?.('ended', () => clearIfActive(record), { once: true });
    audio.addEventListener?.('error', fallbackOnce, { once: true });

    try {
      const playResult = audio.play();
      playResult?.catch?.(fallbackOnce);
      return 'playing-local';
    } catch (_error) {
      return fallbackOnce() || 'unavailable';
    }
  };

  return { speakLocalizedMessage };
}

const defaultController = createLocalizedSpeechController();

export const speakLocalizedMessage = (...args) => (
  defaultController.speakLocalizedMessage(...args)
);
