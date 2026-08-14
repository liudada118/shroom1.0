# 日文生命体征告警 MP3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 `ja-JP-NanamiNeural` 生成三条可随 Electron 应用离线分发的日文生命体征告警 MP3。

**Architecture:** 在系统临时目录创建隔离 Python 虚拟环境，仅用 `edge-tts==7.2.8` 制作音频；生成结果写入 `client/public/audio/alerts/ja/`，并机械复制到当前可发布的 `build/audio/alerts/ja/`。应用运行时不依赖生成工具、网络、Azure Key 或系统日文 voice，本轮不修改现有播报代码。

**Tech Stack:** Python venv、edge-tts 7.2.8、Microsoft `ja-JP-NanamiNeural`、MP3、PowerShell、Git。

## Global Constraints

- 只生成 `left-bed.mp3`、`edge-seat.mp3`、`emergency.mp3` 三个日文文件。
- 文本分别固定为 `離床しました`、`端座位`、`SOS緊急通報`。
- voice 固定为 `ja-JP-NanamiNeural`，rate 固定为 `-5%`，pitch 使用默认值。
- 不修改 `Home.jsx`、`speechSynthesis.js` 或任何运行时播报路径。
- 不修改项目 `package.json`、锁文件或 Python requirements。
- 不安装 Windows/macOS 系统日文语音包，不接入 Azure Key。
- 生成阶段允许联网；生成后的 MP3 必须可作为普通本地静态资源离线分发。
- 代码库改动完成后增量更新 `ARCHITECTURE.md`。

---

### Task 1: 生成、验证并发布日文告警 MP3

**Files:**
- Create: `client/public/audio/alerts/ja/left-bed.mp3`
- Create: `client/public/audio/alerts/ja/edge-seat.mp3`
- Create: `client/public/audio/alerts/ja/emergency.mp3`
- Create: `build/audio/alerts/ja/left-bed.mp3`
- Create: `build/audio/alerts/ja/edge-seat.mp3`
- Create: `build/audio/alerts/ja/emergency.mp3`
- Modify: `ARCHITECTURE.md`

**Interfaces:**
- Consumes: `edge-tts==7.2.8` CLI、voice `ja-JP-NanamiNeural`、固定三条日文文本。
- Produces: 六个二进制 MP3 文件；`client/public` 与 `build` 中同名文件的 SHA-256 必须完全一致。

- [ ] **Step 1: 运行资源存在性检查并确认 RED**

```powershell
$expected = @(
  'client/public/audio/alerts/ja/left-bed.mp3',
  'client/public/audio/alerts/ja/edge-seat.mp3',
  'client/public/audio/alerts/ja/emergency.mp3'
)
$missing = $expected | Where-Object { -not (Test-Path -LiteralPath $_) }
if ($missing.Count -gt 0) {
  Write-Error "Missing expected Japanese alert MP3: $($missing -join ', ')"
  exit 1
}
```

Expected: FAIL，明确列出三个尚不存在的 MP3。

- [ ] **Step 2: 在临时虚拟环境安装固定版本生成工具**

```powershell
$ttsVenv = Join-Path $env:TEMP 'shroom-ja-alert-tts-7.2.8'
python -m venv $ttsVenv
$ttsPython = Join-Path $ttsVenv 'Scripts/python.exe'
& $ttsPython -m pip install --disable-pip-version-check 'edge-tts==7.2.8'
& $ttsPython -m edge_tts --version
```

Expected: 安装成功且版本输出为 `edge-tts 7.2.8`；项目依赖文件无变化。

- [ ] **Step 3: 生成三条 Nanami 日文 MP3**

```powershell
$outputDir = 'client/public/audio/alerts/ja'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
& $ttsPython -m edge_tts --voice 'ja-JP-NanamiNeural' --rate='-5%' --text '離床しました' --write-media "$outputDir/left-bed.mp3"
& $ttsPython -m edge_tts --voice 'ja-JP-NanamiNeural' --rate='-5%' --text '端座位' --write-media "$outputDir/edge-seat.mp3"
& $ttsPython -m edge_tts --voice 'ja-JP-NanamiNeural' --rate='-5%' --text 'SOS緊急通報' --write-media "$outputDir/emergency.mp3"
```

Expected: 三个命令退出码均为0，输出文件均非空。

- [ ] **Step 4: 验证 MP3 文件头、大小和文件集合**

```powershell
@'
from pathlib import Path

root = Path('client/public/audio/alerts/ja')
expected = {'left-bed.mp3', 'edge-seat.mp3', 'emergency.mp3'}
actual = {path.name for path in root.glob('*.mp3')}
assert actual == expected, (actual, expected)
for name in sorted(expected):
    path = root / name
    payload = path.read_bytes()
    assert len(payload) > 1024, (name, len(payload))
    assert payload.startswith(b'ID3') or payload[:1] == b'\xff', (name, payload[:4])
    print(f'{name}: {len(payload)} bytes, header={payload[:4].hex()}')
'@ | python -
```

Expected: 三个文件全部通过，输出各自字节数与 MP3/ID3 文件头。

- [ ] **Step 5: 同步当前发布目录并验证 SHA-256 一致**

```powershell
$publicDir = Resolve-Path 'client/public/audio/alerts/ja'
$buildDir = Join-Path (Resolve-Path 'build') 'audio/alerts/ja'
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
Copy-Item -LiteralPath (Join-Path $publicDir 'left-bed.mp3') -Destination $buildDir -Force
Copy-Item -LiteralPath (Join-Path $publicDir 'edge-seat.mp3') -Destination $buildDir -Force
Copy-Item -LiteralPath (Join-Path $publicDir 'emergency.mp3') -Destination $buildDir -Force
foreach ($name in @('left-bed.mp3', 'edge-seat.mp3', 'emergency.mp3')) {
  $publicHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $publicDir $name)).Hash
  $buildHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $buildDir $name)).Hash
  if ($publicHash -ne $buildHash) { throw "$name hash mismatch" }
  Write-Output "$name $publicHash"
}
```

Expected: 每个同名文件的两个 SHA-256 完全一致。

- [ ] **Step 6: 清理隔离生成环境**

```powershell
$resolvedVenv = [System.IO.Path]::GetFullPath($ttsVenv)
$resolvedTemp = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
if (-not $resolvedVenv.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to remove non-temp path: $resolvedVenv"
}
Remove-Item -LiteralPath $resolvedVenv -Recurse -Force
```

Expected: 只删除系统临时目录中的生成环境，项目文件保持不变。

- [ ] **Step 7: 增量更新架构文档**

在 `ARCHITECTURE.md` 的国际化/语音数据流中追加固定告警音频目录、三条文件与 `ja-JP-NanamiNeural`；在项目进度和更新日志末尾追加2026-08-14记录。明确这些资源当前尚未接入运行时，现有 Web Speech 逻辑不变。

- [ ] **Step 8: 运行最终资源与工作树验证**

```powershell
@'
from hashlib import sha256
from pathlib import Path

names = ('left-bed.mp3', 'edge-seat.mp3', 'emergency.mp3')
for name in names:
    public = Path('client/public/audio/alerts/ja') / name
    built = Path('build/audio/alerts/ja') / name
    assert public.exists() and built.exists(), name
    assert public.stat().st_size > 1024, name
    assert sha256(public.read_bytes()).digest() == sha256(built.read_bytes()).digest(), name
print('Japanese alert MP3 assets verified: 3/3')
'@ | python -
git diff --check -- ARCHITECTURE.md
git status --short
```

Expected: `3/3` 验证通过；除六个 MP3 和 `ARCHITECTURE.md` 外没有实现文件、依赖文件或构建 bundle 变化。

- [ ] **Step 9: 提交音频资源**

```powershell
git add -- client/public/audio/alerts/ja build/audio/alerts/ja ARCHITECTURE.md
git diff --cached --check
git commit -m '新增日文告警离线音频'
```

Expected: 提交成功；生成的 MP3 和文档进入 `Revise`，工作树干净。
