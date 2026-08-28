import { describe, expect, it, vi } from 'vitest';
import {
  createLocalizedSpeechController,
  findVoiceForLanguage,
  normalizeVoiceLanguageTag,
  speakLocalizedMessage,
} from './speechSynthesis';

class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.lang = '';
    this.voice = null;
  }
}

const voice = (name, lang) => ({
  name,
  lang,
  default: false,
  localService: true,
});

const createAudioHarness = ({ constructError = null, playError = null, rejectPlay = null } = {}) => {
  const instances = [];

  class FakeAudio {
    constructor(src) {
      if (constructError) throw constructError;
      this.src = src;
      this.currentTime = 0;
      this.paused = true;
      this.listeners = new Map();
      instances.push(this);
    }

    addEventListener(event, callback) {
      this.listeners.set(event, callback);
    }

    play() {
      if (playError) throw playError;
      this.paused = false;
      return rejectPlay ? Promise.reject(rejectPlay) : Promise.resolve();
    }

    pause() {
      this.paused = true;
    }

    emit(event) {
      this.listeners.get(event)?.();
    }
  }

  return { AudioConstructor: FakeAudio, instances };
};

describe('localized speech synthesis', () => {
  it('normalizes voice locale separators and letter case', () => {
    expect(normalizeVoiceLanguageTag('JA_jp')).toBe('ja-jp');
  });

  it('matches Japanese voices by base language across locale variants', () => {
    expect(findVoiceForLanguage([voice('Kyoko', 'ja_JP')], 'ja-JP')).toEqual(
      voice('Kyoko', 'ja_JP'),
    );
  });

  it('never selects a Chinese voice for Japanese', () => {
    expect(findVoiceForLanguage([voice('Xiaoxiao', 'zh-CN')], 'ja-JP')).toBeNull();
  });

  it('waits once for delayed voices and then speaks with a Japanese voice', () => {
    let voices = [];
    let listener;
    const spoken = [];
    const synthesis = {
      getVoices: () => voices,
      speak: (utterance) => spoken.push(utterance),
      addEventListener: vi.fn((_event, callback) => { listener = callback; }),
      removeEventListener: vi.fn(),
    };

    expect(speakLocalizedMessage('端座位', 'ja', {
      synthesis,
      Utterance: FakeUtterance,
    })).toBe('waiting');
    expect(synthesis.addEventListener).toHaveBeenCalledWith(
      'voiceschanged',
      expect.any(Function),
      { once: true },
    );

    voices = [voice('Kyoko', 'ja-JP')];
    listener();

    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toMatchObject({
      text: '端座位',
      lang: 'ja-JP',
      voice: voices[0],
    });
    expect(synthesis.removeEventListener).toHaveBeenCalledWith(
      'voiceschanged',
      listener,
    );
  });

  it('skips speech instead of falling back when Japanese remains unavailable', () => {
    let listener;
    const synthesis = {
      getVoices: () => [voice('Xiaoxiao', 'zh-CN')],
      speak: vi.fn(),
      addEventListener: vi.fn((_event, callback) => { listener = callback; }),
      removeEventListener: vi.fn(),
    };
    const onUnavailable = vi.fn();

    expect(speakLocalizedMessage('端座位', 'ja', {
      synthesis,
      Utterance: FakeUtterance,
      onUnavailable,
    })).toBe('waiting');
    listener();

    expect(synthesis.speak).not.toHaveBeenCalled();
    expect(onUnavailable).toHaveBeenCalledOnce();
  });

  it.each([
    ['leftBed', '/audio/alerts/ja/left-bed.mp3'],
    ['fallRisk', '/audio/alerts/ja/edge-seat.mp3'],
    ['satUp', '/audio/alerts/ja/edge-seat.mp3'],
    ['emergency', '/audio/alerts/ja/emergency.mp3'],
  ])('plays local Japanese audio for %s', (alertKey, expectedSrc) => {
    const controller = createLocalizedSpeechController();
    const audio = createAudioHarness();
    const synthesis = { getVoices: vi.fn(), speak: vi.fn() };

    expect(controller.speakLocalizedMessage('日本語', 'ja', {
      alertKey,
      AudioConstructor: audio.AudioConstructor,
      synthesis,
      Utterance: FakeUtterance,
    })).toBe('playing-local');
    expect(audio.instances).toHaveLength(1);
    expect(audio.instances[0].src).toBe(expectedSrc);
    expect(synthesis.speak).not.toHaveBeenCalled();
  });

  it.each([
    ['已离床', 'zh', 'zh-CN', voice('Xiaoxiao', 'zh-CN')],
    ['Left bed', 'en', 'en-US', voice('Samantha', 'en-US')],
  ])('keeps %s on Web Speech', (text, language, locale, selectedVoice) => {
    const controller = createLocalizedSpeechController();
    const audio = createAudioHarness();
    const spoken = [];
    const synthesis = {
      getVoices: () => [selectedVoice],
      speak: (utterance) => spoken.push(utterance),
    };

    expect(controller.speakLocalizedMessage(text, language, {
      alertKey: 'leftBed',
      AudioConstructor: audio.AudioConstructor,
      synthesis,
      Utterance: FakeUtterance,
    })).toBe('spoken');
    expect(audio.instances).toHaveLength(0);
    expect(spoken[0]).toMatchObject({ text, lang: locale, voice: selectedVoice });
  });

  it('does not overlap the same active alert and switches different alerts', () => {
    const controller = createLocalizedSpeechController();
    const audio = createAudioHarness();
    const synthesis = { getVoices: () => [], speak: vi.fn() };
    const dependencies = {
      AudioConstructor: audio.AudioConstructor,
      synthesis,
      Utterance: FakeUtterance,
    };

    expect(controller.speakLocalizedMessage('端座位', 'ja', {
      ...dependencies,
      alertKey: 'satUp',
    })).toBe('playing-local');
    expect(controller.speakLocalizedMessage('端座位', 'ja', {
      ...dependencies,
      alertKey: 'satUp',
    })).toBe('already-playing');
    expect(audio.instances).toHaveLength(1);

    expect(controller.speakLocalizedMessage('SOS緊急通報', 'ja', {
      ...dependencies,
      alertKey: 'emergency',
    })).toBe('playing-local');
    expect(audio.instances[0].paused).toBe(true);
    expect(audio.instances[0].currentTime).toBe(0);
    expect(audio.instances).toHaveLength(2);

    audio.instances[0].emit('error');
    expect(synthesis.speak).not.toHaveBeenCalled();
  });

  it('allows the same alert to play again after it ends', () => {
    const controller = createLocalizedSpeechController();
    const audio = createAudioHarness();
    const dependencies = {
      alertKey: 'leftBed',
      AudioConstructor: audio.AudioConstructor,
      synthesis: { getVoices: () => [], speak: vi.fn() },
      Utterance: FakeUtterance,
    };

    expect(controller.speakLocalizedMessage('離床しました', 'ja', dependencies)).toBe('playing-local');
    audio.instances[0].emit('ended');
    expect(controller.speakLocalizedMessage('離床しました', 'ja', dependencies)).toBe('playing-local');
    expect(audio.instances).toHaveLength(2);
  });

  it('falls back to a Japanese voice when local play throws', () => {
    const controller = createLocalizedSpeechController();
    const audio = createAudioHarness({ playError: new Error('decode failed') });
    const spoken = [];
    const japaneseVoice = voice('Kyoko', 'ja-JP');
    const synthesis = {
      getVoices: () => [japaneseVoice, voice('Xiaoxiao', 'zh-CN')],
      speak: (utterance) => spoken.push(utterance),
    };

    expect(controller.speakLocalizedMessage('端座位', 'ja', {
      alertKey: 'fallRisk',
      AudioConstructor: audio.AudioConstructor,
      synthesis,
      Utterance: FakeUtterance,
    })).toBe('spoken');
    expect(spoken).toHaveLength(1);
    expect(spoken[0].voice).toBe(japaneseVoice);
  });

  it('falls back to a Japanese voice when Audio construction fails', () => {
    const controller = createLocalizedSpeechController();
    const audio = createAudioHarness({ constructError: new Error('unsupported source') });
    const spoken = [];
    const japaneseVoice = voice('Kyoko', 'ja-JP');

    expect(controller.speakLocalizedMessage('離床しました', 'ja', {
      alertKey: 'leftBed',
      AudioConstructor: audio.AudioConstructor,
      synthesis: {
        getVoices: () => [japaneseVoice, voice('Xiaoxiao', 'zh-CN')],
        speak: (utterance) => spoken.push(utterance),
      },
      Utterance: FakeUtterance,
    })).toBe('spoken');
    expect(spoken[0].voice).toBe(japaneseVoice);
  });

  it('falls back once when the local audio emits an error', () => {
    const controller = createLocalizedSpeechController();
    const audio = createAudioHarness();
    const spoken = [];

    expect(controller.speakLocalizedMessage('端座位', 'ja', {
      alertKey: 'fallRisk',
      AudioConstructor: audio.AudioConstructor,
      synthesis: {
        getVoices: () => [voice('Kyoko', 'ja-JP')],
        speak: (utterance) => spoken.push(utterance),
      },
      Utterance: FakeUtterance,
    })).toBe('playing-local');
    audio.instances[0].emit('error');
    audio.instances[0].emit('error');
    expect(spoken).toHaveLength(1);
  });

  it('falls back once when the local play promise rejects', async () => {
    const controller = createLocalizedSpeechController();
    const audio = createAudioHarness({ rejectPlay: new Error('blocked') });
    const spoken = [];
    const synthesis = {
      getVoices: () => [voice('Kyoko', 'ja-JP')],
      speak: (utterance) => spoken.push(utterance),
    };

    expect(controller.speakLocalizedMessage('端座位', 'ja', {
      alertKey: 'satUp',
      AudioConstructor: audio.AudioConstructor,
      synthesis,
      Utterance: FakeUtterance,
    })).toBe('playing-local');
    await Promise.resolve();
    await Promise.resolve();
    expect(spoken).toHaveLength(1);
    audio.instances[0].emit('error');
    expect(spoken).toHaveLength(1);
  });
});
