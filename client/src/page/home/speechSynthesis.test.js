import { describe, expect, it, vi } from 'vitest';
import {
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
});
