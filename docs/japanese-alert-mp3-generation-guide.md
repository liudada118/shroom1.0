# 日文告警 MP3 生成与发布指南

## 1. 当前方案

项目中的日文告警 MP3 不是在软件运行时生成的，而是在开发/发布阶段通过 `edge-tts` 调用 Microsoft 在线语音服务生成，然后作为静态文件随 Electron 软件一起打包。

```text
日文文本
  -> edge-tts 7.2.8（生成时需要联网）
  -> ja-JP-NanamiNeural
  -> MP3 候选文件
  -> 校验文件头、时长和 SHA-256
  -> client/public/audio/alerts/ja/
  -> Vite 构建复制到 build/audio/alerts/ja/
  -> Electron 运行时从本地播放（不需要联网）
```

当前生成链路不需要 Azure 账号或 API Key，也不会把 `edge-tts` 加入项目运行时依赖。生成完成后，软件播放本地 MP3，不依赖 Windows/macOS 是否安装日文语音包。

> 注意：`edge-tts` 使用在线服务，生成阶段必须联网。正式商用、批量生成或对服务可用性有严格要求时，应另行确认服务条款，或评估使用带正式账号和凭据的 Azure Speech 服务。

## 2. 当前音频参数与文件映射

统一参数：

- 工具版本：`edge-tts==7.2.8`
- 日文声音：`ja-JP-NanamiNeural`
- 语速：`-5%`
- 音调：默认值
- 源资源目录：`client/public/audio/alerts/ja/`
- 发布目录：`build/audio/alerts/ja/`

| 告警键 | 生成文本 | 源文件 | 运行时地址 |
| :--- | :--- | :--- | :--- |
| `leftBed` | `離床` | `left-bed.mp3` | `/audio/alerts/ja/left-bed.mp3` |
| `fallRisk` | `端座位` | `edge-seat.mp3` | `/audio/alerts/ja/edge-seat.mp3` |
| `satUp` | `端座位` | `edge-seat.mp3` | `/audio/alerts/ja/edge-seat.mp3` |
| `emergency` | `SOS緊急通報` | `emergency.mp3` | `/audio/alerts/ja/emergency.mp3` |

`fallRisk` 和 `satUp` 共用同一个 `edge-seat.mp3`，因此目前只维护三条音频文件。

## 3. 推荐生成步骤（Windows PowerShell）

以下命令从项目根目录 `E:\shroom1` 执行。推荐先在系统临时目录生成和验证，确认正确后再覆盖项目源资源。

### 3.1 创建隔离环境

```powershell
Set-Location 'E:\shroom1'

$ttsWork = Join-Path $env:TEMP ("shroom-ja-alert-tts-" + [guid]::NewGuid().ToString('N'))
python -m venv $ttsWork
$ttsPython = Join-Path $ttsWork 'Scripts\python.exe'

& $ttsPython -m pip install --disable-pip-version-check `
  'edge-tts==7.2.8' `
  'mutagen==1.47.0'
& $ttsPython -m edge_tts --version
```

预期版本输出为 `edge-tts 7.2.8`。虚拟环境位于系统临时目录，不会修改项目的 `package.json`、锁文件或 Python requirements。

### 3.2 生成三条候选 MP3

```powershell
$candidateDir = Join-Path $ttsWork 'audio'
New-Item -ItemType Directory -Force -Path $candidateDir | Out-Null

& $ttsPython -m edge_tts `
  --voice 'ja-JP-NanamiNeural' `
  --rate='-5%' `
  --text '離床' `
  --write-media (Join-Path $candidateDir 'left-bed.mp3')

& $ttsPython -m edge_tts `
  --voice 'ja-JP-NanamiNeural' `
  --rate='-5%' `
  --text '端座位' `
  --write-media (Join-Path $candidateDir 'edge-seat.mp3')

& $ttsPython -m edge_tts `
  --voice 'ja-JP-NanamiNeural' `
  --rate='-5%' `
  --text 'SOS緊急通報' `
  --write-media (Join-Path $candidateDir 'emergency.mp3')
```

如果只需要修改一条播报，只运行对应命令即可，不要重新生成其余文件。相同文本和参数在不同时间生成的 MP3 不保证二进制哈希完全相同，因此应以试听和格式校验为准，不能用旧哈希判断新生成内容是否正确。

### 3.3 校验候选文件

先检查文件大小、MP3 解码信息和 SHA-256：

```powershell
foreach ($name in @('left-bed.mp3', 'edge-seat.mp3', 'emergency.mp3')) {
  $path = Join-Path $candidateDir $name
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing: $path" }
  if ((Get-Item -LiteralPath $path).Length -le 1024) { throw "MP3 is too small: $path" }

  & $ttsPython -c `
    "from mutagen.mp3 import MP3; import pathlib,sys; p=pathlib.Path(sys.argv[1]); a=MP3(p); print({'file':p.name,'bytes':p.stat().st_size,'seconds':round(a.info.length,3),'sample_rate':a.info.sample_rate}); assert a.info.length > 0" `
    $path

  Get-FileHash -Algorithm SHA256 -LiteralPath $path
}
```

然后逐条试听，重点核对：

1. `left-bed.mp3` 是否只播报「離床」，没有「しました」。
2. `edge-seat.mp3` 是否播报「端座位」。
3. `emergency.mp3` 是否播报「SOS緊急通報」。
4. 音量、语速和开头/结尾是否完整，没有截断、静音或明显杂音。

### 3.4 发布到源资源目录

确认候选文件无误后，再覆盖 `client/public` 中的源资源：

```powershell
$publicDir = 'E:\shroom1\client\public\audio\alerts\ja'
New-Item -ItemType Directory -Force -Path $publicDir | Out-Null

foreach ($name in @('left-bed.mp3', 'edge-seat.mp3', 'emergency.mp3')) {
  Copy-Item -LiteralPath (Join-Path $candidateDir $name) `
    -Destination (Join-Path $publicDir $name) -Force
}
```

`client/public/audio/alerts/ja/` 是源文件的唯一维护入口。正常发布时运行前端构建，让 Vite 将这些资源复制到 `build`：

```powershell
npm --prefix client run build
```

如果当前只做音频调试、不准备重新生成完整前端构建，也可以临时把已验证文件机械复制到 `build/audio/alerts/ja/`；正式提交或发版前仍应执行一次完整构建，并检查 `build/index.html` 引用的产物存在。

### 3.5 验证 public 与 build 一致

```powershell
$publicDir = 'E:\shroom1\client\public\audio\alerts\ja'
$buildDir = 'E:\shroom1\build\audio\alerts\ja'

foreach ($name in @('left-bed.mp3', 'edge-seat.mp3', 'emergency.mp3')) {
  $publicHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $publicDir $name)).Hash
  $buildHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $buildDir $name)).Hash
  if ($publicHash -ne $buildHash) { throw "$name public/build hash mismatch" }
  Write-Output "$name $publicHash"
}
```

### 3.6 清理临时环境（可选）

关闭可能占用虚拟环境的进程后执行：

```powershell
$resolvedWork = [System.IO.Path]::GetFullPath($ttsWork)
$resolvedTemp = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'

if (-not $resolvedWork.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to remove non-temp path: $resolvedWork"
}

Remove-Item -LiteralPath $resolvedWork -Recurse -Force
```

该保护检查确保只删除系统临时目录中的生成环境，不会误删项目目录。

## 4. 软件运行时如何播放

运行时入口是 `client/src/page/home/speechSynthesis.js`：

1. `Home.jsx` 触发告警时传入稳定的 `alertKey`。
2. 当前语言为日文时，模块按上表把告警键映射到本地 `/audio/alerts/ja/*.mp3`。
3. 同一告警键重复触发不会叠加播放。
4. 切换到另一个告警键时，会暂停并归零上一条本地音频，再播放新音频。
5. 如果浏览器不能创建、加载或播放 MP3，才回退到 Web Speech API。
6. 日文回退只接受 `ja` 日文系统 voice；电脑没有日文 voice 时会跳过并记录警告，不会使用中文 voice 误播。
7. 中文和英文仍直接使用 Web Speech API，不走日文 MP3 路径。

因此，MP3 一旦正确进入安装包，正常日文播报不需要联网，也不需要用户安装日文语音包。

## 5. 新增或修改告警

修改现有告警文本时：

1. 在临时目录用相同 voice/rate 生成候选文件。
2. 试听并完成格式校验。
3. 只替换对应的 `client/public` 源文件。
4. 运行 Vite 构建并验证 public/build 哈希一致。
5. 如果文件名或告警键发生变化，同步修改 `speechSynthesis.js` 的映射和对应测试。
6. 同步更新日文 i18n 文案，确保界面文字、回退语音和 MP3 语义一致。

新增一类告警时，还需要为它定义稳定的 `alertKey`，再决定复用已有 MP3 还是新增文件。不要直接把中文显示文本当作资源键，否则翻译调整会破坏播放映射。

## 6. 常见问题

### 6.1 生成时报网络错误或没有输出文件

`edge-tts` 生成阶段依赖网络。先检查代理、防火墙、系统时间和 Microsoft 服务连通性，再重试。不要把零字节或未完成的文件复制到项目中。

### 6.2 找不到 `ja-JP-NanamiNeural`

确认使用固定版本，并查询可用 voice：

```powershell
& $ttsPython -m edge_tts --list-voices | Select-String 'ja-JP-NanamiNeural'
```

如果服务端 voice 清单发生变化，应先试听替代声音并记录参数，不要静默更换项目声音。

### 6.3 `-5%` 被 PowerShell 解析错误

使用本文写法 `--rate='-5%'` 或 `--rate=-5%`，并保持整个参数在同一行。不要把 `%` 放进会被其他 shell 二次解析的字符串中。

### 6.4 日文文本乱码

优先使用 PowerShell 7，并保证脚本文件保存为 UTF-8。旧版 Windows PowerShell/控制台可先执行：

```powershell
chcp 65001
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
```

生成后必须实际试听；命令行没有报错不代表输入文本没有被错误编码。

### 6.5 修改了 public，但软件仍播放旧声音

通常是 `build` 或安装包仍包含旧资源。依次检查：

1. public/build 同名文件 SHA-256 是否一致。
2. 是否执行了最新 Vite 构建。
3. Electron 实际加载的是开发服务器还是 `build`。
4. 打包目录是否来自旧构建缓存。
5. 是否完全退出旧软件进程后再启动。

### 6.6 浏览器提示不允许自动播放

浏览器可能阻止没有用户交互的媒体自动播放。Electron 正式应用通常沿用现有告警播放链路；纯浏览器调试时，先点击页面一次，再触发告警。

## 7. 当前已发布文件校验值

以下是 2026-08-20 工作区中 public/build 两份资源一致时的结果：

| 文件 | 字节数 | 文件头 | SHA-256 |
| :--- | ---: | :--- | :--- |
| `left-bed.mp3` | 9,936 | `FF F3 64 C4` | `967D10BF3EA38A9DB3800B8F59EEF6299B2E772817A938346BFFEEEB0936CA5E` |
| `edge-seat.mp3` | 10,224 | `FF F3 64 C4` | `15F9399F3836BAC395B5FAC322D008628005411737EAE6C2F6820D5B59225055` |
| `emergency.mp3` | 18,720 | `FF F3 64 C4` | `37349106E22F19E6E0E064A43A44BD6DF2ACFC7B49BD65CEF234B49FFD5D0EFF` |

重新生成后哈希可能变化，这是正常现象；新版本应重新记录哈希，并继续保证 public/build 的同名文件完全一致。

## 8. 相关代码与资料

- 运行时播放逻辑：`client/src/page/home/speechSynthesis.js`
- 日文源音频：`client/public/audio/alerts/ja/`
- 当前发布副本：`build/audio/alerts/ja/`
- 原始设计：`docs/superpowers/specs/2026-08-14-japanese-alert-mp3-design.md`
- 离床文本调整设计：`docs/superpowers/specs/2026-08-14-japanese-left-bed-audio-design.md`

