# 日文生命体征语音与状态翻译修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 日文界面只使用日文系统 voice 播报生命体征告警，并把“已坐起”和“坠床风险”的日文界面及语音文本统一为“端座位”。

**Architecture:** 将 Web Speech voice 匹配与延迟加载处理从 `Home.jsx` 提取到纯前端模块，通过可注入的 `speechSynthesis` 与 `SpeechSynthesisUtterance` 边界进行 Vitest 测试。i18next 仍负责生成播报文本，日文目录的界面键和告警键同步修改，`Home.jsx` 只调用统一播报接口。

**Tech Stack:** React 19、i18next、Web Speech API、Vitest、Vite。

## Global Constraints

- 当前分支为 `Revise`，不得修改生命体征状态码、触发条件或播报频率。
- 日文模式只能选择基础语言为 `ja` 的系统 voice，不得回退中文 voice。
- 首次无日文 voice 时只监听一次 `voiceschanged` 并重试；重试仍无日文 voice 时跳过播报。
- 不自动安装或下载 Windows/macOS 日文语音包。
- `fallBed`、`sitUp`、`home.alerts.fallRisk`、`home.alerts.satUp` 的日文值统一为 `端座位`；中文和英文保持不变。
- 不新增第三方依赖。
- 代码完成后增量更新 `ARCHITECTURE.md`。

---

### Task 1: 提取并修正跨平台日文 voice 选择

**Files:**
- Create: `client/src/page/home/speechSynthesis.js`
- Create: `client/src/page/home/speechSynthesis.test.js`
- Modify: `client/src/page/home/Home.jsx:717-754,1800-1830`

**Interfaces:**
- Consumes: `normalizeLanguage(language)`、`getLanguageLocale(language)`、浏览器 `speechSynthesis` 与 `SpeechSynthesisUtterance`。
- Produces: `normalizeVoiceLanguageTag(value)`、`findVoiceForLanguage(voices, language)`、`speakLocalizedMessage(text, language, dependencies?)`。

- [ ] **Step 1: 写 voice 匹配、严格日文和延迟加载失败测试**

```js
// client/src/page/home/speechSynthesis.test.js
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

const voice = (name, lang) => ({ name, lang, default: false, localService: true });

describe('localized speech synthesis', () => {
  it('normalizes underscore and region variants', () => {
    expect(normalizeVoiceLanguageTag('JA_jp')).toBe('ja-jp');
    expect(findVoiceForLanguage([voice('Kyoko', 'ja_JP')], 'ja-JP').name).toBe('Kyoko');
  });

  it('never selects a Chinese voice for Japanese', () => {
    expect(findVoiceForLanguage([voice('Xiaoxiao', 'zh-CN')], 'ja')).toBeNull();
  });

  it('waits for voiceschanged once and then speaks with Japanese voice', () => {
    let voices = [];
    let listener;
    const spoken = [];
    const synthesis = {
      getVoices: () => voices,
      speak: (utterance) => spoken.push(utterance),
      addEventListener: (_event, callback) => { listener = callback; },
      removeEventListener: vi.fn(),
    };
    expect(speakLocalizedMessage('端座位', 'ja', {
      synthesis,
      Utterance: FakeUtterance,
    })).toBe('waiting');
    voices = [voice('Kyoko', 'ja-JP')];
    listener();
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toMatchObject({ text: '端座位', lang: 'ja-JP', voice: voices[0] });
  });

  it('does not speak when Japanese voice remains unavailable', () => {
    let listener;
    const synthesis = {
      getVoices: () => [voice('Xiaoxiao', 'zh-CN')],
      speak: vi.fn(),
      addEventListener: (_event, callback) => { listener = callback; },
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
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm --prefix client test -- --run src/page/home/speechSynthesis.test.js`

Expected: FAIL，原因是 `./speechSynthesis` 模块不存在。

- [ ] **Step 3: 实现最小语音模块**

```js
// client/src/page/home/speechSynthesis.js
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
```

- [ ] **Step 4: 让 `Home.jsx` 使用新接口**

在 i18n import 附近新增：

```js
import { speakLocalizedMessage } from './speechSynthesis';
```

删除 `Home.jsx` 内联 `speakMessage()`，四个告警调用统一改为：

```js
speakLocalizedMessage(this.props.t('home.alerts.leftBed'), this.props.i18n.language)
speakLocalizedMessage(this.props.t('home.alerts.fallRisk'), this.props.i18n.language)
speakLocalizedMessage(this.props.t('home.alerts.satUp'), this.props.i18n.language)
speakLocalizedMessage(this.props.t('home.alerts.emergency'), this.props.i18n.language)
```

- [ ] **Step 5: 运行 GREEN 和既有 Home 相关专项测试**

Run: `npm --prefix client test -- --run src/page/home/speechSynthesis.test.js src/page/home/smallBed12BDisplay.test.js`

Expected: 语音测试4项和12B显示测试5项全部PASS。

- [ ] **Step 6: 提交 Task 1**

```powershell
git add -- client/src/page/home/speechSynthesis.js client/src/page/home/speechSynthesis.test.js client/src/page/home/Home.jsx
git commit -m "修复日文告警语音选择"
```

---

### Task 2: 统一“端座位”日文翻译并完成发布验证

**Files:**
- Create: `client/src/i18n/japaneseAlerts.test.js`
- Modify: `client/src/i18n/ja.js:104-105,551-552`
- Modify: `ARCHITECTURE.md`
- Modify generated files: `build/index.html`, `build/assets/*`

**Interfaces:**
- Consumes: `resources.ja.translation` 运行时资源树。
- Produces: `fallBed`、`sitUp`、`home.alerts.fallRisk`、`home.alerts.satUp` 的日文值 `端座位`。

- [ ] **Step 1: 写界面、语音和中英文不变的失败测试**

```js
// client/src/i18n/japaneseAlerts.test.js
import { describe, expect, it } from 'vitest';
import resources from './resources';

describe('Japanese vital-sign alerts', () => {
  it('uses 端座位 for both displayed and spoken alert keys', () => {
    const ja = resources.ja.translation;
    expect(ja.fallBed).toBe('端座位');
    expect(ja.sitUp).toBe('端座位');
    expect(ja.home.alerts.fallRisk).toBe('端座位');
    expect(ja.home.alerts.satUp).toBe('端座位');
  });

  it('does not change the Chinese or English alert text', () => {
    expect(resources.zh.translation.home.alerts.fallRisk).toBe('坠床风险');
    expect(resources.zh.translation.home.alerts.satUp).toBe('已坐起');
    expect(resources.en.translation.home.alerts.fallRisk).toBe('Risk of falling from bed');
    expect(resources.en.translation.home.alerts.satUp).toBe('Sat up');
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm --prefix client test -- --run src/i18n/japaneseAlerts.test.js`

Expected: FAIL，当前四个日文值分别为旧翻译而不是 `端座位`。

- [ ] **Step 3: 修改四个日文目录值**

```js
// client/src/i18n/ja.js
"fallBed": compare("坠床风险", "端座位"),
"sitUp": compare("已坐起", "端座位"),
"home.alerts.fallRisk": compare("坠床风险", "端座位"),
"home.alerts.satUp": compare("已坐起", "端座位"),
```

- [ ] **Step 4: 运行翻译和语音组合测试**

Run: `npm --prefix client test -- --run src/i18n/japaneseAlerts.test.js src/page/home/speechSynthesis.test.js`

Expected: 2个测试文件共6项全部PASS。

- [ ] **Step 5: 增量更新架构文档**

在 `ARCHITECTURE.md` 中追加2026-08-14项目进度与更新日志，并记录：日文生命体征告警按基础语言严格选择 `ja` voice、`voiceschanged` 单次重试、缺失日文 voice 时不回退中文、四个状态键统一为 `端座位`。不修改或删除既有记录。

- [ ] **Step 6: 运行最终专项验证和生产构建**

Run: `npm --prefix client test -- --run src/i18n/japaneseAlerts.test.js src/page/home/speechSynthesis.test.js src/page/home/smallBed12BDisplay.test.js src/components/video/humanBodyRenderSettings.test.js`

Run: `npm --prefix client run build`

Run: `git diff --check`

Expected: 所有专项测试PASS；Vite构建退出码0；只允许既有 duplicate-key、Sass legacy API、eval、empty vendor-echarts 和大chunk警告。

- [ ] **Step 7: 提交 Task 2**

```powershell
git add -- client/src/i18n/ja.js client/src/i18n/japaneseAlerts.test.js ARCHITECTURE.md build
git commit -m "统一日文告警翻译与语音文本"
```

- [ ] **Step 8: 核对工作树和提交**

Run: `git status --short --branch`

Run: `git log -4 --oneline`

Expected: 工作树干净；`Revise` 包含设计、计划、语音修复和翻译/构建提交。
