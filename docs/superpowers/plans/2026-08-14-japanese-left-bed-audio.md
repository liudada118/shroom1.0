# Japanese Left-Bed Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Japanese left-bed alert MP3 wording with exactly `離床` while preserving every runtime mapping and all other alert assets.

**Architecture:** Re-generate one static MP3 with the same Microsoft Japanese voice and rate used by the existing asset, validate it outside the repository, then synchronize it through Vite's public source and current build output. Runtime JavaScript remains unchanged; `ARCHITECTURE.md` records the corrected asset wording.

**Tech Stack:** PowerShell, Python 3.11 temporary virtual environment, `edge-tts==7.2.8`, `mutagen==1.47.0`, Vite 5, Vitest 2, Git.

## Global Constraints

- The spoken text must be exactly `離床`.
- Use voice `ja-JP-NanamiNeural` and rate `-5%`.
- Replace only `client/public/audio/alerts/ja/left-bed.mp3`, `build/audio/alerts/ja/left-bed.mp3`, and the corresponding `ARCHITECTURE.md` documentation.
- Do not modify the `leftBed` alert key, audio URL, fallback speech logic, translations, `edge-seat.mp3`, or `emergency.mp3`.
- Add no application runtime dependency and require no installed Windows/macOS Japanese voice package.

---

### Task 1: Regenerate and synchronize the Japanese left-bed alert

**Files:**
- Modify: `client/public/audio/alerts/ja/left-bed.mp3`
- Modify: `build/audio/alerts/ja/left-bed.mp3`
- Modify: `ARCHITECTURE.md:299`
- Modify: `ARCHITECTURE.md` project-progress table under `## 8. 项目进度`
- Modify: `ARCHITECTURE.md` update-log table under `## 9. 更新日志`
- Test: `client/src/page/home/speechSynthesis.test.js`
- Test: `client/src/i18n/japaneseAlerts.test.js`

**Interfaces:**
- Consumes: runtime mapping `leftBed -> /audio/alerts/ja/left-bed.mp3` from `client/src/page/home/speechSynthesis.js`; Vite public-asset copy from `client/public/` to `build/`.
- Produces: two byte-identical MP3 files containing the same generated `離床` utterance; no JavaScript interface changes.

- [ ] **Step 1: Capture the clean baseline and protect non-target audio assets**

Run from `E:\shroom1`:

```powershell
git status --short --branch
$leftBedProtectedBefore = Get-FileHash client\public\audio\alerts\ja\edge-seat.mp3, client\public\audio\alerts\ja\emergency.mp3, build\audio\alerts\ja\edge-seat.mp3, build\audio\alerts\ja\emergency.mp3 -Algorithm SHA256
$leftBedProtectedBefore | Format-Table Path, Hash
```

Expected: the worktree contains only the already committed plan history and no uncommitted files; four protected hashes are recorded for the final comparison.

- [ ] **Step 2: Generate the candidate outside the repository**

Run:

```powershell
$leftBedWork = Join-Path $env:TEMP ("shroom-left-bed-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $leftBedWork | Out-Null
py -m venv $leftBedWork
& "$leftBedWork\Scripts\python.exe" -m pip install edge-tts==7.2.8 mutagen==1.47.0
& "$leftBedWork\Scripts\python.exe" -m edge_tts --voice ja-JP-NanamiNeural --rate=-5% --text "離床" --write-media "$leftBedWork\left-bed.mp3"
```

Expected: installation succeeds without changing repository dependency files, and `$leftBedWork\left-bed.mp3` exists.

- [ ] **Step 3: Validate the generated candidate before replacing repository files**

Run:

```powershell
& "$leftBedWork\Scripts\python.exe" -c "from mutagen.mp3 import MP3; import pathlib,sys; p=pathlib.Path(sys.argv[1]); a=MP3(p); print({'bytes':p.stat().st_size,'seconds':a.info.length,'sample_rate':a.info.sample_rate}); assert p.stat().st_size > 0 and a.info.length > 0" "$leftBedWork\left-bed.mp3"
Get-FileHash "$leftBedWork\left-bed.mp3" -Algorithm SHA256
```

Expected: byte size and duration are greater than zero, the MP3 decoder reports a valid sample rate, and a SHA-256 hash is printed.

- [ ] **Step 4: Synchronize the validated candidate into public and build assets**

Run:

```powershell
Copy-Item -LiteralPath "$leftBedWork\left-bed.mp3" -Destination client\public\audio\alerts\ja\left-bed.mp3 -Force
Copy-Item -LiteralPath "$leftBedWork\left-bed.mp3" -Destination build\audio\alerts\ja\left-bed.mp3 -Force
$leftBedHashes = Get-FileHash client\public\audio\alerts\ja\left-bed.mp3, build\audio\alerts\ja\left-bed.mp3 -Algorithm SHA256
$leftBedHashes | Format-Table Path, Hash
if (($leftBedHashes.Hash | Select-Object -Unique).Count -ne 1) { throw "left-bed.mp3 copies differ" }
```

Expected: both repository copies have the same SHA-256 hash.

- [ ] **Step 5: Update the architecture record**

Edit `ARCHITECTURE.md` with these exact semantic changes:

```markdown
- In the alert-resource paragraph, change only `left-bed.mp3`（`離床しました`） to `left-bed.mp3`（`離床`）.
- Append project progress: `| 2026-08-14 | 日文离床告警音频精简 | 将 ja-JP-NanamiNeural 离床 MP3 的播报内容由「離床しました」精简为「離床」，同步更新 public 与 build 资源；告警键、路径、回退逻辑及其他音频不变。 |`
- Append update log: `| 2026-08-14 | Revise | 配置变更 | 日文离床本地音频文案由「離床しました」精简为「離床」，保持 ja-JP-NanamiNeural、-5% 语速、leftBed 映射和其他告警资源不变。 |`
```

Do not change `client/src/i18n/ja.js`; its UI/fallback translation remains outside this MP3-only request.

- [ ] **Step 6: Run scoped behavior tests and the production build**

Run:

```powershell
npm --prefix client test -- --run src/page/home/speechSynthesis.test.js src/i18n/japaneseAlerts.test.js
npm --prefix client run build
```

Expected: both Vitest files pass and Vite exits with code 0. Existing Vite warnings may remain, but no new error is accepted.

- [ ] **Step 7: Verify the final asset boundary and repository diff**

Run in the same PowerShell session as Step 1:

```powershell
$leftBedProtectedAfter = Get-FileHash client\public\audio\alerts\ja\edge-seat.mp3, client\public\audio\alerts\ja\emergency.mp3, build\audio\alerts\ja\edge-seat.mp3, build\audio\alerts\ja\emergency.mp3 -Algorithm SHA256
if (Compare-Object ($leftBedProtectedBefore | Sort-Object Path | ForEach-Object { "$($_.Path)|$($_.Hash)" }) ($leftBedProtectedAfter | Sort-Object Path | ForEach-Object { "$($_.Path)|$($_.Hash)" })) { throw "A protected Japanese alert asset changed" }
$leftBedFinal = Get-FileHash client\public\audio\alerts\ja\left-bed.mp3, build\audio\alerts\ja\left-bed.mp3 -Algorithm SHA256
if (($leftBedFinal.Hash | Select-Object -Unique).Count -ne 1) { throw "Final left-bed assets differ" }
git diff --check
git status --short
git diff --stat
```

Expected: protected assets match their baseline hashes, left-bed copies are identical, `git diff --check` reports no error, and the diff is limited to the two left-bed MP3 files plus `ARCHITECTURE.md` and any Vite manifest/bundle file that genuinely changed during the required production build.

- [ ] **Step 8: Commit the verified change**

Run:

```powershell
git add -- client/public/audio/alerts/ja/left-bed.mp3 build/audio/alerts/ja/left-bed.mp3 ARCHITECTURE.md
git diff --cached --check
git commit -m "精简日文离床告警音频"
```

If the production build changed a tracked manifest or bundle, inspect it first and add only the build paths required to keep `build/index.html` references valid. Expected: one implementation commit containing only the approved audio and documentation scope.
