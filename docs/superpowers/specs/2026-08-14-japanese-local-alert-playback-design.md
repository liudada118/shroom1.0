# 日文固定告警本地音频播放设计

**日期：** 2026-08-14
**目标分支：** `Revise`

## 目标

将生命体征告警的日文播报从“优先依赖系统日文 voice”替换为“优先播放随应用分发的固定 MP3”。中英文继续使用当前 Web Speech API；日文 MP3 加载或播放失败时，回退到当前严格日文 TTS，且永不使用中文 voice 代读。

## 告警映射

运行时按稳定的告警类型 `alertKey` 映射，不根据翻译文本猜测文件：

| `alertKey` | 日文资源 | 文本语义 |
| :--- | :--- | :--- |
| `leftBed` | `/audio/alerts/ja/left-bed.mp3` | `離床しました` |
| `fallRisk` | `/audio/alerts/ja/edge-seat.mp3` | `端座位` |
| `satUp` | `/audio/alerts/ja/edge-seat.mp3` | `端座位` |
| `emergency` | `/audio/alerts/ja/emergency.mp3` | `SOS緊急通報` |

## 接口与数据流

- `Home.jsx` 的四个现有告警分支保留原触发条件，只在调用 `speakLocalizedMessage(text, language, options)` 时增加对应 `alertKey`。
- `speechSynthesis.js` 维护只读告警资源映射并负责本地音频生命周期。
- 当语言标准化结果为 `ja` 且 `alertKey` 有映射时，创建浏览器 `Audio` 实例并登记为当前活动音频，优先播放本地 MP3。
- 中文、英文或没有映射的普通文本继续走现有 Web Speech 路径。
- 公共接口继续同步返回状态字符串；本地音频开始请求后返回 `playing-local`，同一告警仍在播放时返回 `already-playing`，无法创建本地音频时立即返回严格日文 TTS 的现有状态。

## 播放并发规则

- 模块同一时间只维护一条活动日文告警音频。
- 同一 `alertKey` 在活动记录尚未结束或失败时再次触发，忽略重复请求，防止 SOS 连续数据造成叠播；不依赖 `play()` Promise 完成前可能不稳定的 `paused` 属性判断。
- 不同 `alertKey` 到达时，暂停并归零上一条音频，然后播放新告警。
- 音频自然结束后清除活动状态；同一告警随后再次触发可以重新播放。

## 失败回退

- `Audio` 不可用、构造失败、`play()` 同步抛错或 Promise 拒绝时，清除本地活动状态并调用原有严格日文 TTS 路径。
- 回退调用禁止再次尝试本地音频，避免递归。
- 回退仍遵循当前 voice 规则：只选择基础语言为 `ja` 的 voice；voice 列表延迟时监听一次 `voiceschanged`，仍不可用则跳过，不回退中文。
- 本地 MP3 成功播放时不创建 `SpeechSynthesisUtterance`，也不调用 `speechSynthesis.speak()`。

## 可测试性

- `Audio` 构造器、Web Speech API 和 Utterance 继续通过依赖注入测试，不依赖真实浏览器音频设备。
- 测试覆盖四个告警键映射、日文优先本地 MP3、中英文不受影响、同键防叠播、不同键打断切换、音频结束后允许重播、同步/异步播放失败回退严格日文 TTS。
- 测试必须验证行为结果和调用边界，不通过扫描源码字符串判断。

## 非目标

- 不修改四类生命体征告警的状态码、触发条件或频率。
- 不生成新音频，不修改现有 MP3 内容。
- 不修改中文、英文翻译或播报方式。
- 不安装系统日文语音包，不接入 Azure Key 或在线运行时 TTS 服务。
- 不修改 12B 压强、采集、回放、CSV 或人体渲染逻辑。

## 文档与发布

实现完成后增量更新 `ARCHITECTURE.md`，把三条 MP3 从“已准备但未接入”更新为实际日文告警优先路径，并记录失败回退和防叠播语义。重新运行语音专项测试、日文翻译测试、12B/人体关键回归和生产构建，再提交源码、测试、文档和生成的构建产物。
