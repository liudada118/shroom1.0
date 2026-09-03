<#
.SYNOPSIS
按改动路径挑选验证任务并执行 —— AGENTS.md 三种工作模式的统一入口。

.DESCRIPTION
三步：算出改动路径 → 归一化后按前缀分成若干「面」（backend / client / sdk / 打包 / 根依赖…）
→ 由 Mode 决定每个面触发哪些任务。

纯文档改动不触发任何任务，直接 0 退出。**无法归类的代码路径会置 `$hasUnknownCode`**，
按「可能影响后端」从严处理 —— 新增顶层文件时宁可多跑，不要静默漏验。

任务默认并行跑（`Start-Job`），标了 Exclusive 的串行跑在最后：性能基线必须独占机器，
和别的任务抢 CPU 会把它的耗时整体抬上去、误报成性能回退。

.PARAMETER Mode
Fast / Standard（默认）/ Full。

.PARAMETER BaseRef
给定时额外并入 `<BaseRef>...HEAD` 的改动，用于按分支整体验证。

.PARAMETER ChangedPath
显式指定路径（支持逗号分隔）。给定后**完全取代**自动探测，不再读 git。

.PARAMETER ListOnly
只打印选中的任务，不执行。

.PARAMETER NoParallel
全部串行，排查任务之间互相干扰时用。
#>

[CmdletBinding()]
param(
  [ValidateSet('Fast', 'Standard', 'Full')]
  [string]$Mode = 'Standard',

  [string]$BaseRef = '',

  [string[]]$ChangedPath = @(),

  [switch]$ListOnly,

  [switch]$NoParallel
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $scriptRoot '..')).Path
$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
$nodeCommand = (Get-Command node -ErrorAction Stop).Source
$electronCommand = Join-Path $projectRoot 'node_modules\.bin\electron.cmd'
$backendTestRunner = Join-Path $projectRoot 'backend\tests\run-tests.js'
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$tempBuildDirectory = Join-Path $tempRoot ("shroom-verify-build-{0}" -f [guid]::NewGuid().ToString('N'))

# 跑一条 git 命令，成功返回输出行，非零退出码抛异常（异常里带完整输出，否则排查时只看到一句 failed）。
#
# ⚠️ 三处不能删的细节：
# `core.quotepath=false` —— 否则中文文件名会被转义成 `\344\270\255` 八进制串，路径匹配全部落空。
# `$ErrorActionPreference='Continue'` —— 全局是 Stop，git 往 stderr 写一行进度就会被当成终止错误。
# 判 `$LASTEXITCODE` 而不是 `$?` —— `2>&1` 合流后 `$?` 恒为真。
#
# @param Arguments 传给 git 的参数数组。
function Invoke-GitLines {
  param([string[]]$Arguments)

  $previousErrorAction = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $lines = @(& git -c core.quotepath=false -c core.safecrlf=false @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorAction
  }
  if ($exitCode -ne 0) {
    throw "git $($Arguments -join ' ') failed:`n$($lines -join [Environment]::NewLine)"
  }
  return @($lines | ForEach-Object { [string]$_ })
}

# 收集本次要验证的改动路径。
#
# 给了 `-ChangedPath` 就完全用它（支持逗号分隔），不再读 git —— CI 上按 PR 文件列表驱动时走这条。
# 否则取三处的并集：`<BaseRef>...HEAD`（仅在给了 BaseRef 时）、工作区相对 HEAD 的改动、未跟踪文件。
# 未跟踪那一支不能少：新增文件还没 `git add` 时，`diff HEAD` 看不见它。
#
# @returns 未归一化、可能重复的路径数组，去重交给调用方。
function Get-ChangedPaths {
  if ($ChangedPath.Count -gt 0) {
    return @(
      foreach ($value in $ChangedPath) {
        foreach ($path in ([string]$value -split ',')) {
          if ($path.Trim()) { $path.Trim() }
        }
      }
    )
  }

  $paths = New-Object System.Collections.Generic.List[string]
  if ($BaseRef) {
    foreach ($path in Invoke-GitLines @('diff', '--name-only', '--diff-filter=ACMRTUXB', "$BaseRef...HEAD", '--')) {
      $paths.Add([string]$path)
    }
  }

  foreach ($path in Invoke-GitLines @('diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD', '--')) {
    $paths.Add([string]$path)
  }
  foreach ($path in Invoke-GitLines @('ls-files', '--others', '--exclude-standard')) {
    $paths.Add([string]$path)
  }
  return @($paths)
}

# 把路径统一成「仓库相对 + 正斜杠 + 无 `./` 前缀」的形式。
# 下面所有分面判断都是写死正斜杠的正则，混进一个反斜杠就整条匹配不上。
#
# @param Path 原始路径（可能来自 git、也可能来自命令行手输）。
function Normalize-RepositoryPath {
  param([string]$Path)

  $normalized = ([string]$Path).Trim() -replace '\\', '/'
  while ($normalized.StartsWith('./')) {
    $normalized = $normalized.Substring(2)
  }
  return $normalized
}

# 任意一条路径命中任意一个正则就返回 $true —— 下面十来个 `$hasXxx` 分面开关都靠它。
#
# @param Paths 归一化后的路径。
# @param Patterns 正则数组（不是通配符）。
function Test-AnyPath {
  param(
    [string[]]$Paths,
    [string[]]$Patterns
  )

  foreach ($path in $Paths) {
    foreach ($pattern in $Patterns) {
      if ($path -match $pattern) { return $true }
    }
  }
  return $false
}

# 判一条路径是不是「纯文档」—— 命中的路径会被排除在所有任务选择之外，全命中就直接 0 退出。
#
# ⚠️ `^docs/` 那条带负向先行断言，是因为 `sdk/*/docs` 下的文档站本身是有构建的 React 应用：
# 它的 `package.json` 与 `src/` 属于**代码**，误判成文档会让文档站构建静默不跑。
# 第二条 `\.md$` 已经覆盖第一条具名的那几个文件，具名那条只是留个可读的白名单。
#
# @param Path 归一化后的路径。
function Test-DocumentationPath {
  param([string]$Path)

  return $Path -match '(^|/)(README|AGENTS|ARCHITECTURE[^/]*)\.md$' `
    -or $Path -match '\.md$' `
    -or $Path -match '^docs/(?!.*(?:package\.json|src/))'
}

$normalizedPaths = @(
  Get-ChangedPaths |
    ForEach-Object { Normalize-RepositoryPath $_ } |
    Where-Object { $_ } |
    Sort-Object -Unique
)

if ($normalizedPaths.Count -eq 0) {
  Write-Host 'No tracked or untracked changes were found; nothing to verify.'
  exit 0
}

$codePaths = @($normalizedPaths | Where-Object { -not (Test-DocumentationPath $_) })
$hasBackend = Test-AnyPath $codePaths @('^backend/', '^sdk/backend/')
$hasSdkBackend = Test-AnyPath $codePaths @('^sdk/backend/')
$hasClient = Test-AnyPath $codePaths @('^client/(?!.*\.md$)')
$hasSdkFrontend = Test-AnyPath $codePaths @('^sdk/frontend/(?!docs/|example/)')
$hasFrontendDocs = Test-AnyPath $codePaths @('^sdk/frontend/docs/')
$hasBackendDocs = Test-AnyPath $codePaths @('^sdk/backend/docs/')
$hasElectronOrPackaging = Test-AnyPath $codePaths @(
  '^app/electron/',
  '^forge\.config\.js$',
  '^scripts/(?:build-|electron-builder-|inject-release-notes|installer|package-hooks|prepare-|sync-pack-resources)'
)
$hasRootDependencies = Test-AnyPath $codePaths @('^package(?:-lock)?\.json$', '^\.npmrc$')
$hasVerificationTooling = Test-AnyPath $codePaths @('^scripts/(?:verify-changed\.ps1|perf-baseline(?:\.mjs|\.json))$')
$hasDisplayDefinitions = Test-AnyPath $codePaths @('^display-systems/', '^agent-resources/')
$hasSharedRuntime = Test-AnyPath $codePaths @(
  '^shared/',
  '^util/',
  '^(?:crypto-lib\.cjs|licenseManager\.js|sensorTypeStore\.js|types\.d\.ts)$'
)
$hasTestInfrastructure = Test-AnyPath $codePaths @('^test/', '^tools/')
$hasClientAssets = Test-AnyPath $codePaths @('^assets/')
$hasUnknownCode = $false

foreach ($path in $codePaths) {
  if ($path -match '^\.gitattributes$') { continue }
  if ($path -match '^(?:backend|client|sdk|app|scripts|shared|util|tools|test|display-systems|agent-resources|assets)/') { continue }
  if ($path -match '^(?:package(?:-lock)?\.json|forge\.config\.js|crypto-lib\.cjs|licenseManager\.js|sensorTypeStore\.js|types\.d\.ts|\.npmrc)$') { continue }
  $hasUnknownCode = $true
}

$tasksByName = @{}

# 往待跑集合里登记一个任务；**Name 已存在就静默返回**，所以多个分面命中同一个任务不必各自去重。
#
# Exclusive 的任务不进并行池，留到最后串行跑 —— 目前只有性能基线用（并行会污染计时）。
# RetryPatterns 是「已知瞬时失败」的正则白名单：只有输出命中才重试，别的失败一次就算数。
#
# @param Name 唯一名，也是去重键与输出里显示的名字。
# @param Executable 可执行文件绝对路径。
# @param Arguments 参数数组。
# @param Environment 只在该任务进程内生效的环境变量。
# @param Exclusive 是否必须独占执行。
# @param RetryPatterns 命中即可重试的输出正则。
# @param MaxAttempts 含首次在内的最大尝试次数。
function Add-VerificationTask {
  param(
    [string]$Name,
    [string]$Executable,
    [string[]]$Arguments,
    [hashtable]$Environment = @{},
    [bool]$Exclusive = $false,
    [string[]]$RetryPatterns = @(),
    [int]$MaxAttempts = 1
  )

  if ($tasksByName.ContainsKey($Name)) { return }
  $tasksByName[$Name] = [pscustomobject]@{
    Name = $Name
    Executable = $Executable
    Arguments = @($Arguments)
    Environment = $Environment
    Exclusive = $Exclusive
    RetryPatterns = @($RetryPatterns)
    MaxAttempts = [math]::Max(1, $MaxAttempts)
  }
}

# 登记后端 SDK 冒烟：只验公开出口能 require、契约常量在，秒级，Fast 模式用它代替全量后端测试。
function Add-BackendSmoke {
  Add-VerificationTask 'Backend SDK smoke' $npmCommand @('--prefix', $projectRoot, 'run', 'sdk:backend-smoke')
}

# 登记前端 SDK 冒烟：同上，验 `@shroom/frontend` 的出口与渲染器契约，不进浏览器。
function Add-FrontendSmoke {
  Add-VerificationTask 'Frontend SDK smoke' $npmCommand @('--prefix', $projectRoot, 'run', 'sdk:frontend-smoke')
}

# 登记后端全量测试。
#
# ⚠️ 必须用项目自带的 Electron 跑（`ELECTRON_RUN_AS_NODE=1` 让它当纯 Node 用）：
# `better-sqlite3` 是按 Electron 的 Node ABI 编译的，用主机 node 跑会在加载原生模块时炸。
# ⚠️ `ENOTEMPTY` 是 Windows 上删测试临时库时的已知瞬时失败（杀毒/索引器占着文件），
# 所以给了一次重试；**别把重试范围放宽**，其余失败都是真失败。
function Add-BackendTests {
  if (-not (Test-Path -LiteralPath $electronCommand)) {
    throw "Electron test runner not found: $electronCommand. Run npm install before verification."
  }
  Add-VerificationTask `
    -Name 'Backend tests (Electron ABI)' `
    -Executable $electronCommand `
    -Arguments @($backendTestRunner) `
    -Environment @{ ELECTRON_RUN_AS_NODE = '1' } `
    -RetryPatterns @('ENOTEMPTY: directory not empty') `
    -MaxAttempts 2
}

# 登记客户端 Vitest。`--run` 关掉 watch，否则任务永远不退出、整个脚本挂死。
function Add-ClientTests {
  Add-VerificationTask 'Client tests' $npmCommand @('--prefix', (Join-Path $projectRoot 'client'), 'test', '--', '--run')
}

# 登记客户端 ESLint（基线是 0 error）。只有客户端源码变了才加，改 SDK 不触发。
function Add-ClientLint {
  Add-VerificationTask 'Client lint' $npmCommand @('--prefix', (Join-Path $projectRoot 'client'), 'run', 'lint')
}

# 登记 `sdk/frontend` 自己那套测试（渲染器契约、core 纯函数），与客户端测试是两套、不重叠。
function Add-SdkFrontendTests {
  Add-VerificationTask 'Frontend SDK tests' $npmCommand @('--prefix', (Join-Path $projectRoot 'sdk\frontend'), 'test')
}

# 登记一次生产构建，只为证明能构建出来，产物跑完即删。
#
# ⚠️ **`--outDir` 指向临时目录这件事是必须的，不是为了整洁**：`client/vite.config.js` 是
# `outDir: "../build"` 加 `emptyOutDir: true`，裸跑 `vite build` 会清空仓库里的 `build/`，
# 连同已入库的 137MB `build/model/*.fbx` 一起删掉 —— 构建照样显示成功，直到打包时才发现模型没了。
function Add-ClientBuild {
  Add-VerificationTask 'Client production build (temporary)' $npmCommand @(
    '--prefix',
    (Join-Path $projectRoot 'client'),
    'run',
    'build',
    '--',
    '--outDir',
    $tempBuildDirectory,
    '--emptyOutDir'
  )
}

# 登记数据面性能基线（`perf-baseline.mjs`），最后一个位置参数 $true 表示**独占执行**。
#
# 没有基线文件时不带 `--check`：让它只跑一遍打印数字并以 2 退出，提示去 `--write`，
# 而不是拿「基线缺失」当性能回退报。
function Add-PerformanceCheck {
  $baselinePath = Join-Path $scriptRoot 'perf-baseline.json'
  $arguments = @((Join-Path $scriptRoot 'perf-baseline.mjs'))
  if (Test-Path -LiteralPath $baselinePath) {
    $arguments += '--check'
  }
  Add-VerificationTask 'Data-plane performance baseline' $nodeCommand $arguments @{} $true
}

if ($Mode -eq 'Fast') {
  if ($hasBackend -or $hasElectronOrPackaging -or $hasRootDependencies -or $hasDisplayDefinitions -or $hasSharedRuntime -or $hasTestInfrastructure -or $hasUnknownCode) {
    Add-BackendSmoke
  }
  if ($hasClient -or $hasDisplayDefinitions -or $hasSharedRuntime -or $hasTestInfrastructure) { Add-ClientTests }
  if ($hasSdkFrontend -or $hasRootDependencies -or $hasSharedRuntime -or $hasUnknownCode) { Add-FrontendSmoke }
  if ($hasVerificationTooling) { Add-PerformanceCheck }
} elseif ($Mode -eq 'Standard') {
  if ($hasBackend -or $hasElectronOrPackaging -or $hasRootDependencies -or $hasDisplayDefinitions -or $hasSharedRuntime -or $hasTestInfrastructure -or $hasUnknownCode) {
    Add-BackendTests
  }
  if ($hasSdkBackend -or $hasRootDependencies) { Add-BackendSmoke }
  if ($hasClient -or $hasSdkFrontend -or $hasRootDependencies -or $hasDisplayDefinitions -or $hasSharedRuntime -or $hasTestInfrastructure -or $hasUnknownCode) {
    Add-ClientTests
  }
  if ($hasClient) { Add-ClientLint }
  if ($hasSdkFrontend -or $hasRootDependencies -or $hasSharedRuntime) {
    Add-SdkFrontendTests
    Add-FrontendSmoke
  }
  if ($hasElectronOrPackaging -or $hasRootDependencies -or $hasDisplayDefinitions -or $hasClientAssets) { Add-ClientBuild }
  if ($hasVerificationTooling) { Add-PerformanceCheck }
} else {
  Add-BackendTests
  Add-BackendSmoke
  Add-ClientTests
  Add-ClientLint
  Add-SdkFrontendTests
  Add-FrontendSmoke
  Add-ClientBuild
  Add-PerformanceCheck
}

if ($hasFrontendDocs) {
  Add-VerificationTask 'Frontend SDK docs build' $npmCommand @('--prefix', $projectRoot, 'run', 'sdk:frontend-docs-build')
}
if ($hasBackendDocs) {
  Add-VerificationTask 'Backend SDK docs check' $npmCommand @('--prefix', $projectRoot, 'run', 'sdk:backend-docs-check')
  Add-VerificationTask 'Backend SDK docs build' $npmCommand @('--prefix', $projectRoot, 'run', 'sdk:backend-docs-build')
}

foreach ($scriptPath in $codePaths | Where-Object { $_ -match '^scripts/.*\.(?:c?js|mjs)$' }) {
  Add-VerificationTask "Syntax: $scriptPath" $nodeCommand @('--check', (Join-Path $projectRoot ($scriptPath -replace '/', '\')))
}

$tasks = @($tasksByName.Values | Sort-Object Name)

Write-Host "Verification mode: $Mode"
Write-Host "Changed paths: $($normalizedPaths.Count)"
foreach ($path in $normalizedPaths) { Write-Host "  - $path" }

if ($tasks.Count -eq 0) {
  Write-Host 'Only documentation or non-runtime text changed; no code task selected.'
  exit 0
}

Write-Host "Selected tasks: $($tasks.Count)"
foreach ($task in $tasks) { Write-Host "  - $($task.Name)" }
if ($ListOnly) { exit 0 }

$taskRunner = {
  param([string]$PayloadJson)

  $task = $PayloadJson | ConvertFrom-Json
  $savedEnvironment = @{}
  try {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [Console]::OutputEncoding = $utf8
    $OutputEncoding = $utf8
    Set-Location -LiteralPath $task.ProjectRoot
    foreach ($property in $task.Environment.PSObject.Properties) {
      $name = [string]$property.Name
      $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
      [Environment]::SetEnvironmentVariable($name, [string]$property.Value, 'Process')
    }

    $startedAt = Get-Date
    $outputLines = New-Object System.Collections.Generic.List[string]
    $attempts = 0
    $exitCode = 1
    while ($attempts -lt [int]$task.MaxAttempts) {
      $attempts += 1
      $previousErrorAction = $ErrorActionPreference
      try {
        $ErrorActionPreference = 'Continue'
        $attemptOutput = @(& $task.Executable @($task.Arguments) 2>&1 | ForEach-Object { [string]$_ })
        $exitCode = $LASTEXITCODE
      } finally {
        $ErrorActionPreference = $previousErrorAction
      }
      foreach ($line in $attemptOutput) { $outputLines.Add($line) }
      if ($exitCode -eq 0) { break }

      $joinedAttemptOutput = $attemptOutput -join [Environment]::NewLine
      $canRetry = $false
      foreach ($pattern in @($task.RetryPatterns)) {
        if ($joinedAttemptOutput -match [string]$pattern) {
          $canRetry = $true
          break
        }
      }
      if (-not $canRetry -or $attempts -ge [int]$task.MaxAttempts) { break }
      $outputLines.Add("[retry] Known transient failure matched; retrying $($task.Name).")
    }
    [pscustomobject]@{
      Name = [string]$task.Name
      ExitCode = [int]$exitCode
      DurationSeconds = [math]::Round(((Get-Date) - $startedAt).TotalSeconds, 2)
      Attempts = $attempts
      Output = ($outputLines -join [Environment]::NewLine)
    }
  } catch {
    [pscustomobject]@{
      Name = [string]$task.Name
      ExitCode = 1
      DurationSeconds = 0
      Attempts = 1
      Output = ($_ | Out-String)
    }
  } finally {
    foreach ($name in $savedEnvironment.Keys) {
      [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process')
    }
  }
}

$payloadRecords = @(
  foreach ($task in $tasks) {
    [pscustomobject]@{
      Exclusive = [bool]$task.Exclusive
      Payload = (@{
        ProjectRoot = $projectRoot
        Name = $task.Name
        Executable = $task.Executable
        Arguments = @($task.Arguments)
        Environment = $task.Environment
        RetryPatterns = @($task.RetryPatterns)
        MaxAttempts = $task.MaxAttempts
      } | ConvertTo-Json -Depth 5 -Compress)
    }
  }
)

$started = Get-Date
$results = @()
try {
  if ($NoParallel -or $tasks.Count -eq 1) {
    foreach ($record in $payloadRecords) {
      $results += & $taskRunner $record.Payload
    }
  } else {
    $parallelRecords = @($payloadRecords | Where-Object { -not $_.Exclusive })
    $exclusiveRecords = @($payloadRecords | Where-Object { $_.Exclusive })
    $jobs = @(
      foreach ($record in $parallelRecords) {
        Start-Job -ScriptBlock $taskRunner -ArgumentList $record.Payload
      }
    )
    if ($jobs.Count -gt 0) {
      Wait-Job -Job $jobs | Out-Null
      foreach ($job in $jobs) {
        $results += Receive-Job -Job $job
        Remove-Job -Job $job -Force
      }
    }
    foreach ($record in $exclusiveRecords) {
      $results += & $taskRunner $record.Payload
    }
  }
} finally {
  if (Test-Path -LiteralPath $tempBuildDirectory) {
    $resolvedTempBuild = [System.IO.Path]::GetFullPath($tempBuildDirectory)
    $isInsideTemp = $resolvedTempBuild.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)
    $hasExpectedName = (Split-Path -Leaf $resolvedTempBuild).StartsWith('shroom-verify-build-')
    if (-not $isInsideTemp -or -not $hasExpectedName) {
      throw "Refusing to remove unexpected build directory: $resolvedTempBuild"
    }
    Remove-Item -LiteralPath $resolvedTempBuild -Recurse -Force
  }
}

$failed = @()
foreach ($result in $results | Sort-Object Name) {
  $status = if ($result.ExitCode -eq 0) { 'PASS' } else { 'FAIL' }
  $attemptSuffix = if ([int]$result.Attempts -gt 1) { ", $($result.Attempts) attempts" } else { '' }
  Write-Host "[$status] $($result.Name) ($($result.DurationSeconds)s$attemptSuffix)"
  if ($result.Output -and ($result.ExitCode -ne 0 -or $VerbosePreference -eq 'Continue')) {
    Write-Host $result.Output
  } elseif ($result.Output) {
    $summaryLines = @(
      $result.Output -split "`r?`n" |
        Where-Object {
          $_ -match '(^All .+ passed$|Test Files\s+\d+ passed|Tests\s+\d+ passed|built in |Baseline updated:|benchmark.+status)'
        } |
        Select-Object -Last 6
    )
    foreach ($line in $summaryLines) { Write-Host "  $line" }
  }
  if ($result.ExitCode -ne 0) { $failed += $result }
}

$elapsedSeconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 2)
if ($failed.Count -gt 0) {
  Write-Error "$($failed.Count) verification task(s) failed after ${elapsedSeconds}s."
  exit 1
}

Write-Host "All $($results.Count) verification task(s) passed in ${elapsedSeconds}s."
