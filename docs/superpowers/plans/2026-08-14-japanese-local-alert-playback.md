# 日文固定告警本地音频播放 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 日文生命体征告警优先播放随应用分发的固定 MP3，播放失败时回退严格日文 TTS，同时保持中英文现有播报行为。

**Architecture:** 在 `speechSynthesis.js` 中增加按 `alertKey` 驱动的本地音频状态机，并通过 controller factory 隔离活动音频状态以便测试；默认导出继续保持现有 `speakLocalizedMessage()` 调用接口。`Home.jsx` 的四个告警触发条件不变，只补充稳定的 `alertKey`；生产构建继续从现有 `/audio/alerts/ja/*.mp3` 读取静态资源。

**Tech Stack:** React 19、浏览器 HTMLAudioElement、Web Speech API、Vitest 2.1、Vite 5。

## Global Constraints

- 日文 `leftBed`、`fallRisk`、`satUp`、`emergency` 分别映射现有 `left-bed.mp3`、`edge-seat.mp3`、`edge-seat.mp3`、`emergency.mp3`。
- 中文和英文继续使用现有 Web Speech API，不尝试本地日文 MP3。
- 日文 MP3 失败时只回退基础语言为 `ja` 的系统 voice，不得回退中文 voice。
- 同一活动 `alertKey` 的重复请求不叠播；不同 `alertKey` 暂停并归零上一条音频后切换。
- 告警触发状态码、条件、频率和翻译文本保持不变。
- 不修改 MP3 内容，不新增依赖，不接入 Azure Key 或运行时在线 TTS。
- 不修改 12B 压强、采集、回放、CSV 或人体渲染逻辑。
- 完成后增量更新 `ARCHITECTURE.md` 并重新生成生产构建。

---

### Task 1: 日文本地告警播放器与严格 TTS 回退

**Files:**
- Modify: `client/src/page/home/speechSynthesis.test.js`
- Modify: `client/src/page/home/speechSynthesis.js`

**Interfaces:**
- Consumes: `speakLocalizedMessage(text, language, dependencies)` 现有参数；新增 `dependencies.alertKey`、`dependencies.AudioConstructor` 测试/运行边界。
- Produces: `createLocalizedSpeechController()`；默认 `speakLocalizedMessage()`；状态字符串 `playing-local`、`already-playing` 及现有 TTS 状态。

- [ ] **Step 1: 增加本地音频行为测试**

在 `speechSynthesis.test.js` 的 import 中加入 `createLocalizedSpeechController`，并添加可观察真实播放器状态的最小 fake：

```js
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
```

添加以下行为测试；期望路径使用手写字面量，不从生产映射导入：

```js
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
  const dependencies = {
    AudioConstructor: audio.AudioConstructor,
    synthesis: { getVoices: () => [], speak: vi.fn() },
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
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm --prefix client test -- --run src/page/home/speechSynthesis.test.js`

Expected: FAIL，原因是 `createLocalizedSpeechController` 尚未导出，现有实现也不会创建本地 Audio。

- [ ] **Step 3: 实现最小本地音频 controller**

在 `speechSynthesis.js` 中新增固定映射：

```js
const JAPANESE_ALERT_AUDIO_PATHS = Object.freeze({
  leftBed: '/audio/alerts/ja/left-bed.mp3',
  fallRisk: '/audio/alerts/ja/edge-seat.mp3',
  satUp: '/audio/alerts/ja/edge-seat.mp3',
  emergency: '/audio/alerts/ja/emergency.mp3',
});
```

将现有 Web Speech 部分提取为内部函数，保留原有严格日文规则：

```js
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
```

新增 controller factory。活动记录使用对象身份保护，确保被新告警替换的旧音频不会在迟到的 `error`/Promise rejection 中触发回退：

```js
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
```

同步异常返回值必须直接复用 `speakWithSystemVoice()` 的状态，以便无日文 voice 时仍准确返回 `waiting`/`unavailable`；Promise rejection 和 `error` 事件则通过 `fallbackStarted` 保证最多回退一次。

- [ ] **Step 4: 运行 GREEN 与现有翻译测试**

Run: `npm --prefix client test -- --run src/page/home/speechSynthesis.test.js src/i18n/japaneseAlerts.test.js`

Expected: 两个文件全部PASS；本地音频新增测试与原有 voice 延迟/严格日文测试同时通过。

- [ ] **Step 5: 提交 Task 1**

```powershell
git add -- client/src/page/home/speechSynthesis.js client/src/page/home/speechSynthesis.test.js
git diff --cached --check
git commit -m '新增日文告警本地音频播放器'
```

---

### Task 2: Home 告警键接入、文档与发布验证

**Files:**
- Modify: `client/src/page/home/Home.jsx:1786,1796,1804,1814`
- Modify: `ARCHITECTURE.md`
- Modify generated: `build/index.html`
- Modify generated: `build/assets/index-*.js`

**Interfaces:**
- Consumes: Task 1 的 `speakLocalizedMessage(text, language, { alertKey })`。
- Produces: 四个生命体征告警分支的稳定 `alertKey`；日文运行时本地 MP3 优先路径。

- [ ] **Step 1: 为四个现有调用补充稳定告警键**

仅修改调用参数，不调整外围条件：

```js
speakLocalizedMessage(
  this.props.t('home.alerts.leftBed'),
  this.props.i18n.language,
  { alertKey: 'leftBed' },
)

speakLocalizedMessage(
  this.props.t('home.alerts.fallRisk'),
  this.props.i18n.language,
  { alertKey: 'fallRisk' },
)

speakLocalizedMessage(
  this.props.t('home.alerts.satUp'),
  this.props.i18n.language,
  { alertKey: 'satUp' },
)

speakLocalizedMessage(
  this.props.t('home.alerts.emergency'),
  this.props.i18n.language,
  { alertKey: 'emergency' },
)
```

- [ ] **Step 2: 增量更新架构文档**

在 `ARCHITECTURE.md` 的国际化流程中把“MP3 尚未替换运行路径”更新为：日文固定告警按 `alertKey` 优先本地 MP3，同键防叠播、异键切换、失败回退严格日文 TTS；明确中英文 Web Speech 和告警触发条件不变。在项目进度与更新日志末尾追加2026-08-14记录，不删除既有历史。

- [ ] **Step 3: 运行最终专项测试**

Run:

```powershell
npm --prefix client test -- --run src/page/home/speechSynthesis.test.js src/i18n/japaneseAlerts.test.js src/page/home/smallBed12BDisplay.test.js src/components/video/humanBodyRenderSettings.test.js
node --test test/smallBed12B.test.js
```

Expected: 前端四个测试文件全部PASS；后端 smallBed12B 8项PASS。

- [ ] **Step 4: 运行生产构建与静态音频检查**

Run:

```powershell
npm --prefix client run build
foreach ($name in @('left-bed.mp3', 'edge-seat.mp3', 'emergency.mp3')) {
  if (-not (Test-Path -LiteralPath "build/audio/alerts/ja/$name")) {
    throw "Missing built Japanese alert audio: $name"
  }
}
```

Expected: Vite退出码0；允许仓库既有 duplicate-key、Sass legacy API、eval、empty vendor-echarts 和大chunk警告；三个 MP3 均存在于 build。

- [ ] **Step 5: 检查最终差异与提交**

Run:

```powershell
git diff --check -- client/src/page/home/Home.jsx client/src/page/home/speechSynthesis.js client/src/page/home/speechSynthesis.test.js ARCHITECTURE.md
git status --short
git add -- client/src/page/home/Home.jsx ARCHITECTURE.md build
git diff --cached --check -- client/src/page/home/Home.jsx ARCHITECTURE.md
git commit -m '接入日文告警本地音频播放'
git status --short --branch
```

Expected: 源码与文档无空白错误；提交只包含 Home 接入、架构增量和本次 Vite 生成产物；最终工作树干净。
