/**
 * 常驻 Python worker 桥（on-bed 算法）：一个长期存活的子进程，stdin/stdout 上跑 JSON-line
 * —— 每行一个 `{id, fn, args}`，Python 回一行 `{id, ok, data|error|trace}`，用 id 配对，
 * 所以请求可以并发在飞、乱序返回。
 *
 * 常驻而不是每次 spawn：Python 要加载 numpy 和原生 onbed_filter，启动成本百毫秒到秒级，而
 * 算法调用是 20–125ms 一轮。启动目标有优先级（见 `resolvePythonLaunchTarget`）：新编译 exe
 * > 打包内置 exe > 解释器 + 源码。用 `console.log/error` 而非 `common/logger.js`，因为可能
 * 在 logger 装配前就被加载。
 *
 * ⚠️ **Python 版本锁死 3.11**（`probePythonInterpreter` 里是死等号），原生 onbed_filter
 * 按 3.11 的 ABI 编的 —— 换版本会在 import 时崩，或者更糟：静默算错。本文件所有
 * `python3.11` 字样都不是随手写的默认值，别顺手升级。
 */
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PROJECT_ROOT = path.resolve(__dirname, "../../..");

// electron 只在 Electron 主进程里存在。后端也会被纯 Node 起（测试、命令行工具），
// 所以 require 失败必须静默吞掉 —— 拿不到就靠 isPackaged 环境变量判断。
let electronApp = null;
try {
  ({ app: electronApp } = require('electron'));
} catch {}

/**
 * 判断当前进程是否应该使用打包后的运行时路径。
 *
 * 环境变量**优先于** Electron 的真实状态，是为了能在开发环境里强制走打包路径来验证
 * 打包产物（反之亦然）。判的是字符串 `'true'`/`'false'` 而不是真值 —— 环境变量永远是
 * 字符串，`'false'` 是真值。
 *
 * 兜底返回 false（当成开发环境）：猜错成开发环境只是多探测几个本地路径，猜错成打包环境
 * 会直接放弃解释器模式而报「找不到内置运行时」。
 *
 * @returns {boolean} 打包后的 Electron 应用中返回 true。
 */
function isPackagedApp() {
  if (process.env.isPackaged === 'true') return true;
  if (process.env.isPackaged === 'false') return false;

  if (electronApp && typeof electronApp.isPackaged === 'boolean') {
    return electronApp.isPackaged;
  }

  return false;
}

/**
 * 路径存在**且是文件**。
 *
 * 用 `statSync` + try/catch 而不是 `existsSync`，因为还要判类型：候选路径里有同名目录时
 * `existsSync` 会返回 true，然后 spawn 一个目录，报出来的错跟「找不到 Python」完全不像。
 * 异常一律当「不存在」—— 权限不足和真的没有，对候选筛选来说是同一件事。
 *
 * @param {string} filePath 待检查路径。
 * @returns {boolean} 是否是一个可 stat 到的文件。
 */
function existingFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * 路径存在**且是目录**。理由同 existingFile。
 *
 * @param {string} dirPath 待检查路径。
 * @returns {boolean} 是否是一个可 stat 到的目录。
 */
function existingDir(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 去重并**丢掉所有假值**。
 *
 * 丢假值是关键：调用方靠它才能写 `process.env.X ? path.join(...) : null` 这种内联条件项，
 * 不用先攒一个数组再 filter。同一个候选路径出现两次会导致重复的 spawnSync 探测，
 * 那是实打实的启动延迟。
 *
 * @param {Array<string|null|undefined|false>} items 候选项。
 * @returns {string[]} 去重且非空的候选项，保持首次出现的顺序（顺序即优先级）。
 */
function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

/**
 * 返回打包产物中可能存在的 Python 运行时根目录。
 *
 * @returns {string[]} Electron resources 下的候选目录。
 */
function packagedPythonRoots() {
  if (!isPackagedApp()) return [];

  return unique([
    process.resourcesPath ? path.join(process.resourcesPath, 'python') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'python') : null,
  ]);
}

/**
 * 获取开发环境使用的 Python 工作区目录。
 *
 * @returns {string} 项目 python 目录的绝对路径。
 */
function devPythonRoot() {
  return path.join(PROJECT_ROOT, 'python');
}

/**
 * 内置算法服务可执行文件的文件名（随平台带 .exe）。
 *
 * @returns {string} 可执行文件名。
 */
function executableName() {
  return process.platform === 'win32' ? 'onbed_server.exe' : 'onbed_server';
}

/**
 * 在打包资源中查找内置的 onbed_server 可执行文件。
 *
 * @returns {string | null} 找到时返回可执行文件路径。
 */
function resolvePackagedExe() {
  const exeName = executableName();
  const candidates = [];

  for (const root of packagedPythonRoots()) {
    candidates.push(path.join(root, exeName));
    candidates.push(path.join(root, 'onbed_server', exeName));
    candidates.push(path.join(root, 'dist', 'onbed_server', exeName));
  }

  return candidates.find(existingFile) || null;
}

/**
 * 递归求路径下的**最新**修改时间。
 *
 * 只服务一个目的：判断「已编译的 exe 是不是比 Python 源码新」（见 resolveFreshDevExe）。
 * 所以要的是整棵树的最大值，改动任何一个源文件都必须让时间戳变新。
 *
 * 不存在返回 0 而不是抛：调用方是在拿它做比较，0 天然表示「没有这个东西，比什么都旧」。
 *
 * 递归遍历只在开发环境的启动期跑一次（`python/app` 是个小目录），不在热路径上。
 *
 * @param {string} targetPath 文件或目录路径。
 * @returns {number} 最新 mtime（毫秒）；路径不存在时为 0。
 */
function latestMtime(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return stat.mtimeMs;
  }

  let latest = stat.mtimeMs;
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    latest = Math.max(latest, latestMtime(path.join(targetPath, entry.name)));
  }
  return latest;
}

/**
 * 优先使用比源码更新的开发环境可执行文件。
 *
 * 基准取三个源的最大 mtime（`app/` 算法代码、`build_exe.py`、`requirements.txt`），
 * 用 `>=` 而不是 `>` —— 同秒完成的构建应当算新鲜。过期返回 null，退回解释器直跑源码。
 *
 * ⚠️ 这个新鲜度检查挡的是一个很难查的坑：改完 .py 忘了 build，无条件用 dist 里的 exe
 * 就还在跑旧算法 —— 现象是「代码明明改了但行为没变」，且毫无提示。
 *
 * @returns {string | null} 可用的开发环境可执行文件路径；缺失或过期时返回 null。
 */
function resolveFreshDevExe() {
  if (isPackagedApp()) return null;

  const runtimeDir = path.join(devPythonRoot(), 'dist', 'onbed_server');
  const runtimeExe = path.join(runtimeDir, executableName());
  if (!existingFile(runtimeExe)) {
    return null;
  }

  const sourceStamp = Math.max(
    latestMtime(path.join(devPythonRoot(), 'app')),
    latestMtime(path.join(devPythonRoot(), 'build_exe.py')),
    latestMtime(path.join(devPythonRoot(), 'requirements.txt'))
  );

  return latestMtime(runtimeDir) >= sourceStamp ? runtimeExe : null;
}

/**
 * 查找没有可执行文件时使用的 Python 源码入口。
 *
 * @returns {string | null} Python 服务脚本路径。
 */
function resolveServerPy() {
  const candidates = isPackagedApp()
    ? packagedPythonRoots().map((root) => path.join(root, 'app', 'onbed_filter_example.py'))
    : [path.join(devPythonRoot(), 'app', 'onbed_filter_example.py')];

  return candidates.find(existingFile) || null;
}

/**
 * resolveServerPy 的别名。
 *
 * 保留这层转发是历史调用点的兼容（旧代码里到处写的是 `serverPy()`），删掉要改一圈。
 * 新代码直接用 resolveServerPy。
 *
 * @returns {string | null} Python 服务脚本路径。
 */
function serverPy() {
  return resolveServerPy();
}

/**
 * 用 `which -a` 找 PATH 里**所有**同名命令。
 *
 * `-a` 而不是只回第一个：系统上常有多个 python3.11（Homebrew、pyenv、自带），第一个不一定
 * 装了 numpy，全拿回来交给 `probePythonInterpreter` 逐个试。Windows 返回空数组（没有
 * `which`，走 `py -3.11` 启动器）。探测失败返回空数组而不抛 —— 找不到只是少几个候选。
 *
 * @param {string} command 命令名，例如 `'python3.11'`。
 * @returns {string[]} 去重后的绝对路径列表；失败或 Windows 上为空。
 */
function pathCommandCandidates(command) {
  if (process.platform === 'win32') return [];

  const result = spawnSync('which', ['-a', command], {
    encoding: 'utf8',
  });

  if (result.error || result.status !== 0) {
    return [];
  }

  return unique((result.stdout || '').split(/\r?\n/));
}

/**
 * 在常见的 conda/miniconda 安装位置里翻 python3.11。
 *
 * 专门照顾 conda 是因为算法开发者的 numpy 往往只装在某个 conda 环境里，而那些环境的 bin
 * **不在 PATH 上**（要 `conda activate` 才进来），只靠 `which` 一个都找不到。
 * `baseRoots` 直接看 `<root>/bin/python3.11`；`envRoots` 是命名环境的父目录，要列目录再拼，
 * `CONDA_PREFIX/..` 那一项让「已激活环境的同级环境」也能被找到。
 * `readdirSync` 包 try/catch（conda 常有权限受限子项），末尾 `filter(existingFile)` 保证
 * 返回的都真实存在。只找 3.11（原生库 ABI 锁死，见文件头）。Windows 返回空数组。
 *
 * @returns {string[]} 存在的 python3.11 路径列表。
 */
function condaPython311Candidates() {
  if (process.platform === 'win32') return [];

  const home = os.homedir();
  const candidates = [];
  const baseRoots = unique([
    process.env.CONDA_PREFIX || null,
    '/opt/miniconda3',
    path.join(home, 'miniconda3'),
    '/opt/anaconda3',
    path.join(home, 'anaconda3'),
  ]);
  const envRoots = unique([
    process.env.CONDA_PREFIX ? path.join(process.env.CONDA_PREFIX, '..') : null,
    '/opt/miniconda3/envs',
    path.join(home, 'miniconda3', 'envs'),
    '/opt/anaconda3/envs',
    path.join(home, 'anaconda3', 'envs'),
  ]);

  for (const root of baseRoots) {
    if (existingDir(root)) {
      candidates.push(path.join(root, 'bin', 'python3.11'));
    }
  }

  for (const envRoot of envRoots) {
    if (!existingDir(envRoot)) continue;
    try {
      for (const entry of fs.readdirSync(envRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        candidates.push(path.join(envRoot, entry.name, 'bin', 'python3.11'));
      }
    } catch {}
  }

  return unique(candidates.filter(existingFile));
}

/**
 * 构建源码模式启动时可尝试的 Python 解释器列表。
 *
 * **数组顺序就是尝试顺序，第一个探测通过的就赢**（见 `resolvePythonLaunchTarget`），所以
 * 顺序是这个函数的全部内容：① `PYTHON_FOR_RUNTIME`（显式配置永远第一，是自动探测都不合用
 * 时的逃生门）→ ② 项目自带 venv / 内置 Python（可控可复现）→ ③ conda 环境与 PATH 上的
 * python3.11 → ④ 裸命令 `python3.11`/`python3`/`python`（`python` 常是 2.x 或别的 3.x，
 * 探测必失败，放最后只白花一次 spawnSync）。`label` 与 `command` 分开存，是为了 `py -3.11`
 * 这种「命令 + 参数」的候选在报错信息里能显示成人看得懂的一行。
 *
 * ⚠️ 打包环境**只找内置 Python，绝不回落到系统 Python** —— 用户机器上的版本和依赖不可控，
 * 跑起来也会因为 numpy 版本不对而算错。
 *
 * @returns {{ command: string, args: string[], label: string }[]} 候选解释器列表，
 *          顺序即优先级。
 */
function pythonInterpreterCandidates() {
  const candidates = [];

  if (process.env.PYTHON_FOR_RUNTIME) {
    candidates.push({
      command: process.env.PYTHON_FOR_RUNTIME,
      args: [],
      label: process.env.PYTHON_FOR_RUNTIME,
    });
  }

  if (!isPackagedApp()) {
    if (process.platform === 'win32') {
      const localPy = path.join(devPythonRoot(), 'Python311', 'python.exe');
      candidates.push(
        { command: localPy, args: [], label: localPy },
        { command: 'py', args: ['-3.11'], label: 'py -3.11' },
        { command: 'python', args: [], label: 'python' }
      );
      return candidates;
    }

    const localPyCandidates = [
      path.join(devPythonRoot(), 'venv', 'bin', 'python3.11'),
      path.join(devPythonRoot(), 'venv', 'bin', 'python3'),
      path.join(devPythonRoot(), 'venv', 'bin', 'python'),
      ...pathCommandCandidates('python3.11'),
      ...condaPython311Candidates(),
      'python3.11',
      'python3',
      'python',
    ];

    for (const candidate of unique(localPyCandidates)) {
      candidates.push({ command: candidate, args: [], label: candidate });
    }
    return candidates;
  }

  for (const root of packagedPythonRoots()) {
    if (process.platform === 'win32') {
      candidates.push(
        { command: path.join(root, 'Python311', 'python.exe'), args: [], label: path.join(root, 'Python311', 'python.exe') },
        { command: path.join(root, 'venv', 'Scripts', 'python.exe'), args: [], label: path.join(root, 'venv', 'Scripts', 'python.exe') }
      );
      continue;
    }

    const pyExeCandidates = [
      path.join(root, 'venv', 'bin', 'python3.11'),
      path.join(root, 'venv', 'bin', 'python3'),
      path.join(root, 'venv', 'bin', 'python'),
    ];

    for (const candidate of pyExeCandidates) {
      candidates.push({ command: candidate, args: [], label: candidate });
    }
  }

  return candidates;
}

/**
 * 检查某个解释器是否能运行算法服务所需依赖。
 *
 * 探测脚本四件事缺一不可：`assert version_info == (3, 11)`（死等号，3.12 能 import numpy 但
 * 加载 onbed_filter 时崩）、`import numpy`、`import onbed_filter_example`（连业务脚本一起
 * import，原生依赖一并验证，为此先把脚本目录塞进 `sys.path`）、`print(sys.executable)`（回报
 * 解释器**自己认为的**路径，`py -3.11` 或符号链接下与 `candidate.command` 不同）。失败时
 * stderr/stdout/退出码依次兜底成 `reason`（三种失败方式各只填一个），汇总进抛错信息。
 *
 * ⚠️ 判据是**真的 import 一遍**而不是问版本号：`--version` 对了但没装 numpy 的机器非常多，
 * 只查版本会挑中一个跑起来立刻崩的解释器，且崩在 worker 启动之后 —— 表现成「算法通道时不时
 * 挂掉」而不是「环境没装好」。`stdout` 取**最后一行**，因为 numpy 可能先打警告。
 *
 * @param {{ command: string, args: string[], label: string }} candidate 解释器候选项。
 * @param {string | null} serverScript 用于导入探测的 Python 服务脚本。
 * @returns {{ ok: boolean, executable?: string, reason?: string }} 探测结果。
 */
function probePythonInterpreter(candidate, serverScript) {
  const probeCode = [
    'import sys',
    "assert sys.version_info[:2] == (3, 11), f'Expected Python 3.11, got {sys.version.split()[0]}'",
    'import numpy',
    serverScript ? `sys.path.insert(0, ${JSON.stringify(path.dirname(serverScript))})` : '',
    serverScript ? 'import onbed_filter_example' : '',
    'print(sys.executable)',
  ].filter(Boolean).join('; ');

  const result = spawnSync(
    candidate.command,
    [...candidate.args, '-c', probeCode],
    {
      cwd: serverScript ? path.dirname(serverScript) : process.cwd(),
      env: pythonRuntimeEnv(),
      encoding: 'utf8',
    }
  );

  if (result.error) {
    return { ok: false, reason: result.error.message };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      reason: (result.stderr || result.stdout || `exit ${result.status}`).trim(),
    };
  }

  return {
    ok: true,
    executable: (result.stdout || '').trim().split(/\r?\n/).pop(),
  };
}

let resolvedLaunchTarget = null;

/**
 * 为 Python worker 选择最终启动目标。
 *
 * 优先级从上往下、第一个成立的就用：① 开发环境里比源码新的 exe（快且确认是最新代码）
 * → ② 打包内置 exe（打包产物的正常路径）→ ③ 解释器 + 源码（兜底，也是唯一能改完 .py
 * 立刻生效的模式）。
 *
 * ⚠️ 三种返回值语义不同，调用方要分清：**对象**＝找到了；**`null`**＝连源码脚本都没有，
 * 属于装配不完整（打包漏了 python 目录），`startWorker` 会翻成更具体的错误；**抛错**＝源码
 * 在但所有解释器候选都探测失败。抛错信息里**逐条列出每个候选及其失败原因**，那是排查环境
 * 问题唯一有用的输出，别简化成一句「找不到 Python」。
 *
 * @returns {{ command: string, args: string[], label: string, serverScript: string | null, useExe: boolean, resolvedExecutable?: string } | null}
 *          启动目标；无可用源码时为 null。
 * @throws {Error} 有源码但没有任何可用解释器，错误信息含全部候选的失败原因。
 */
function resolvePythonLaunchTarget() {
  const serverScript = serverPy();

  if (!isPackagedApp()) {
    const devExe = resolveFreshDevExe();
    if (devExe) {
      return {
        command: devExe,
        args: [],
        label: devExe,
        serverScript: null,
        useExe: true,
      };
    }
  }

  const packagedExe = resolvePackagedExe();
  if (packagedExe) {
    return {
      command: packagedExe,
      args: [],
      label: packagedExe,
      serverScript: null,
      useExe: true,
    };
  }

  if (!serverScript) {
    return null;
  }

  const failures = [];
  for (const candidate of pythonInterpreterCandidates()) {
    const probe = probePythonInterpreter(candidate, serverScript);
    if (probe.ok) {
      return {
        command: candidate.command,
        args: candidate.args,
        label: candidate.label,
        resolvedExecutable: probe.executable,
        serverScript,
        useExe: false,
      };
    }
    failures.push(`${candidate.label}: ${probe.reason}`);
  }

  throw new Error(
    [
      '[PY] no usable Python 3.11 runtime found',
      ...failures.map((failure) => `- ${failure}`),
    ].join('\n')
  );
}

/**
 * 取启动目标，**结果缓存到进程结束**。
 *
 * 必须缓存：解析过程里有一串阻塞 `spawnSync` 探测，而 worker 崩溃会自动重启，每次都重探
 * 会让「Python 反复崩」变成「整个后端卡死」。环境在进程生命周期内不变，探一次就够。
 *
 * ⚠️ **只缓存成功结果** —— 抛错时 `resolvedLaunchTarget` 仍是 null，下一次 `callPy` 会重走
 * 全部候选的阻塞探测。机器上没有可用 Python 时，配合 125ms 的算法定时器就是持续的
 * spawnSync 风暴，现象是后端明显变卡而不是干净报一次错。修法是把失败也缓存（附一个显式
 * 重试入口），那是真实改动，不在注释这一轮里动。
 *
 * @returns {object|null} 启动目标；见 resolvePythonLaunchTarget。
 * @throws {Error} 同 resolvePythonLaunchTarget。
 */
function pythonLaunchTarget() {
  if (!resolvedLaunchTarget) {
    resolvedLaunchTarget = resolvePythonLaunchTarget();
  }
  return resolvedLaunchTarget;
}

/**
 * 拼解释器模式下的命令行参数。
 *
 * exe 模式一切都编进去了，直接返回空数组。
 *
 * ⚠️ 解释器模式的两个参数都不可选：**`-u`（不缓冲）是 JSON-line 协议的前提** —— Python 默认
 * 在管道上块缓冲，回复攒着不发，现象是每次 callPy 都超时而 Python 侧早就算完了
 * （`pythonRuntimeEnv` 的 `PYTHONUNBUFFERED` 是双保险）；**`-X utf8` 只在 Windows 加**，
 * 那里默认编码是系统代码页（中文机器上 GBK），JSON 含非 ASCII 就编解码失败，表现成
 * 「bad JSON line」。
 *
 * @param {string|null} serverScript Python 服务脚本路径（exe 模式下未使用）。
 * @param {boolean} useExe 是否是内置可执行文件模式。
 * @returns {string[]} 命令行参数。
 */
function pythonArgs(serverScript, useExe) {
  if (useExe) return [];

  const args = [];
  if (process.platform === 'win32') {
    args.push('-X', 'utf8');
  }
  args.push('-u', serverScript);
  return args;
}

/**
 * 创建 Python 子进程运行环境。
 *
 * 五个变量各挡一类真实事故：`PYTHONUNBUFFERED`（同 `-u`，exe 模式没法传 `-u`，这里是那条路
 * 上唯一的保障）、`PYTHONUTF8`/`PYTHONIOENCODING`（Windows 代码页问题的双保险，见
 * `pythonArgs`）、`MPLCONFIGDIR`（matplotlib 默认往 `$HOME/.matplotlib` 写缓存，受限账户下
 * 写不进去会往 stderr 打警告，混进日志、也曾干扰过启动握手）。基于 `process.env` 展开而不是
 * 给干净环境，PATH/代理/系统库路径都还得要；`mkdirSync` 失败被吞掉（最坏只是警告回来）。
 *
 * ⚠️ **`PYTHONNOUSERSITE` 是最关键的一条**：不加它，用户 home 下 `~/.local/lib` 那份 numpy
 * 会盖掉内置 venv 的版本，原生库随即因 ABI 不匹配而崩 —— 只在某台机器上出现，极难复现。
 *
 * @returns {NodeJS.ProcessEnv} 启用 UTF-8 并隔离 user-site 的环境变量集合。
 */
function pythonRuntimeEnv() {
  const mplConfigDir = path.join(os.tmpdir(), 'shroom-mplconfig');
  try {
    fs.mkdirSync(mplConfigDir, { recursive: true });
  } catch {}

  return {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    PYTHONNOUSERSITE: '1',
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    MPLCONFIGDIR: mplConfigDir,
  };
}

// ── worker 生命周期状态 ──────────────────────────────────────────────
// 这些是**模块级单例状态**：全后端共用一个 Python worker。这与仓库里「模块不持有可变
// 状态」的一般约定相反，是刻意的 —— worker 是进程级独占资源（一个子进程、一对管道），
// 做成工厂反而会让两个实例各起一个 Python，内存翻倍且原生库可能不支持并存。
let child = null;          // 子进程句柄；null 表示没在跑
let buf = '';              // stdout 的行缓冲，存放尚未收到换行的尾巴
const pending = new Map(); // id → {resolve, reject, timer}，在飞的请求
let nextId = 1;            // 请求 id，单调递增，不复用（复用会让超时后的迟到回复配错请求）
let starting = false;      // 防止 startWorker 重入
let manualStop = false;    // 区分「崩了要重启」和「主动停的别重启」
let stderrTail = '';       // stderr 的尾部环形缓冲，退出时用来说明死因
let footWarmupPromise = null; // 足底分析预热的共享 Promise

/**
 * 往 stderr 尾部缓冲追加内容，**只保留最后 4000 字符**。
 *
 * 存在的意义全在 exit 处理里：Python 崩溃时真正的原因（traceback）在 stderr 上，
 * 而退出码只有一个数字。有这段尾巴，日志里就能直接看到死因。
 *
 * 必须有上界 —— 一个话多的 Python（比如每帧打警告）会让这个字符串无界增长。
 * 4000 足够装下一整段 traceback。
 *
 * @param {string} s 新的 stderr 片段。
 * @returns {void}
 */
function pushErr(s) {
  stderrTail = (stderrTail + s).slice(-4000);
}

/**
 * 拒绝所有在飞的请求。
 *
 * ⚠️ worker 死掉（error/exit）时**必须调**：那些回复永远不会来了，不 reject 调用方的 Promise
 * 就永远挂着 —— 现象是采集界面停住不动、也不报错。三步都不能省：先 `clearTimeout`（否则超时
 * 定时器会几秒后吊着闭包再 reject 一次，还会往已不存在的 stdin 写 `_cancel`），最后
 * `pending.clear()`（重启后的 worker 用同一个 Map，残留条目会让新回复撞上旧 id）。
 *
 * @param {Error} error 拒绝原因。
 * @returns {void}
 */
function rejectAllPending(error) {
  for (const [, rec] of pending) {
    clearTimeout(rec.timer);
    rec.reject(error);
  }
  pending.clear();
}

/**
 * 预热较重的足底分析 Python 逻辑，并复用并发调用的同一个 Promise。
 *
 * 足底分析要加载一个较大的模型，首次调用可能几十秒，所以进入足底页面时先触发预热。
 * `timeoutMs: 300000`（5 分钟）是给这个加载留的余量，不是随手写的大数。
 * **成功后 Promise 留着**（后续调用立刻返回，不重复预热）；**失败时清空**再 `throw`，好让
 * 下一次能重试 —— 预热失败常见于 worker 恰好在重启，不该一次失败就永久放弃。
 *
 * ⚠️ worker 退出时这个 Promise 也必须被清空（见 `startWorker` 的 exit 处理）：新进程模型没
 * 加载，缓存「已预热」会让下一次分析卡在一个意料之外的地方。
 *
 * @returns {Promise<boolean>} 预热完成后返回 true。
 * @throws {Error} 预热失败（已清空缓存，可重试）。
 */
function warmFootAnalysis() {
  if (footWarmupPromise) {
    return footWarmupPromise;
  }

  footWarmupPromise = callPy('warm_foot_analysis', {}, { timeoutMs: 300000 })
    .then(() => true)
    .catch((error) => {
      footWarmupPromise = null;
      throw error;
    });

  return footWarmupPromise;
}

/**
 * 造一条「打包产物里缺 Python 运行时」的错误。
 *
 * 单独提出来是因为这条错误信息**要能自证**：把实际搜过的目录列出来，而不是只说
 * 「找不到」。打包配置漏了 `python` 目录时，这段输出是唯一能指出「你以为打进去了但没有」
 * 的东西。搜索路径为空时退回显示 `process.resourcesPath`，那意味着连
 * `packagedPythonRoots` 都没算出候选。
 *
 * @returns {Error} 带搜索路径的错误。
 */
function missingPackagedRuntimeError() {
  const roots = packagedPythonRoots();
  const searched = roots.length > 0 ? roots.join(", ") : (process.resourcesPath || "<unknown>");

  return new Error(
    `[PY] packaged runtime missing: expected bundled onbed_server or embedded Python under ${searched}`
  );
}

/**
 * 启动常驻 Python worker，并绑定 JSON-line 请求/响应处理。
 *
 * 异常退出 500ms 后自动重启（`manualStop` 保证主动停止时不重启），这是这条链路的韧性来源：
 * 原生算法库偶发崩溃时用户只看到几帧数据缺失，而不是「算法功能从此不可用」。重启前清空
 * `footWarmupPromise`（新进程没预热过）但**不清 `resolvedLaunchTarget`**（环境没变，不必重做
 * 阻塞探测）。结尾那个 `ping` 是启动握手，把「进程起来了」变成「进程能应答了」，失败只记
 * 日志不抛 —— 它的价值是把「起不来」和「起来但不干活」区分开，30 秒超时对应首次加载
 * numpy + 原生库的最坏情况。
 *
 * ⚠️ **幂等必须留着**（`if (child || starting) return`）：`callPy` 在 `!child` 时会自己调它，
 * 而算法定时器 20ms 一轮 —— 没有这道闸会瞬间起出一堆 Python 进程。`starting` 覆盖的是
 * 「spawn 已发起但 child 还没赋值」那个窗口。
 *
 * ⚠️ **stdout 的行拆分（`buf += 数据; lines = buf.split(换行); buf = lines.pop()`）是核心**：
 * `pop()` 拿回的最后一段可能是**不完整的一行**（管道不保证按行到达），留在 buf 里等下一批
 * 接上。少了这一步，一行 JSON 被切两半就变成两条「bad JSON line」，那一帧的回复永远等不到。
 *
 * ⚠️ 认不出 id 的回复静默丢弃（那正是超时后迟到的回复，Promise 早已 reject，报错只会刷屏）；
 * `msg.ok === false` 用严格比较（老版本 Python 不发 `ok`，缺字段应走成功分支）；失败时把
 * `trace` 拼在 message 后面 —— traceback 是排查算法错误唯一有用的东西，别为了「消息干净」丢
 * 掉（发给前端前再裁，见 petCare 的 `safeAlgorithmErrorMessage`）。
 *
 * @returns {void}
 * @throws {Error} 找不到可用运行时（错误已打日志后原样抛出）。
 */
function startWorker() {
  if (child || starting) return;
  starting = true;
  manualStop = false;

  try {
    const target = pythonLaunchTarget();
    const py = target?.command;
    const useExe = Boolean(target?.useExe);
    const serverScript = target?.serverScript;

    if (isPackagedApp() && !py) {
      throw missingPackagedRuntimeError();
    }

    if (!useExe && !serverScript) {
      throw new Error('[PY] start aborted: no python runtime script found');
    }

    const args = [...(target?.args || []), ...pythonArgs(serverScript, useExe)];
    const cwd = useExe ? path.dirname(py) : (serverScript ? path.dirname(serverScript) : process.cwd());

    console.log('[PY] start:', py, args.join(' '), 'cwd=', cwd, 'packaged=', isPackagedApp(), 'useExe=', useExe);
    if (target?.resolvedExecutable && target.resolvedExecutable !== py) {
      console.log('[PY] resolved executable:', target.resolvedExecutable);
    }
    if (py && py.includes(path.sep) && !fs.existsSync(py)) console.error('[PY] pythonBin NOT FOUND:', py);
    if (!useExe && (!serverScript || !fs.existsSync(serverScript))) console.error('[PY] serverPy NOT FOUND:', serverScript);

    child = spawn(py, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: pythonRuntimeEnv(),
      windowsHide: true,
      cwd,
    });
    buf = '';
    stderrTail = '';
  } catch (error) {
    console.error(error.message);
    throw error;
  } finally {
    starting = false;
  }

  child.stdout.on('data', (d) => {
    buf += d.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        console.error('[PY] bad JSON line:', line);
        continue;
      }

      const rec = pending.get(msg.id);
      if (!rec) continue;

      clearTimeout(rec.timer);
      pending.delete(msg.id);

      if (msg.ok === false) {
        const detail = msg.trace
          ? `${msg.error || 'python worker error'}\n${msg.trace}`
          : (msg.error || 'python worker error');
        rec.reject(new Error(detail));
      } else {
        rec.resolve(msg.data);
      }
    }
  });

  child.stderr.on('data', (d) => {
    const s = d.toString();
    pushErr(s);
    console.error('[PY:stderr]', s.trim());
  });

  child.on('error', (err) => {
    pushErr(String(err.stack || err));
    console.error(`[PY] worker ERROR: ${err.message}`);
    rejectAllPending(err);
    child = null;
  });

  child.on('exit', (code, sig) => {
    console.error(`[PY] worker EXIT code=${code} sig=${sig}\n[PY] stderr tail:\n${stderrTail}`);
    rejectAllPending(new Error(`python worker exited (code=${code} sig=${sig})`));
    child = null;
    footWarmupPromise = null;

    if (!manualStop) {
      setTimeout(startWorker, 500);
    }
  });

  callPy('ping', {}, { timeoutMs: 30000 })
    .then(() => {
      console.log('[PY] ready');
    })
    .catch((e) => console.error('[PY] handshake failed:', e.message));
}

/**
 * 往 worker 的 stdin 写一行，**处理背压**。
 *
 * `stdin.write` 返回 false 表示内核缓冲区满了 —— 此时继续写会在 Node 内部无界排队。
 * 所以这里等 `drain` 再 resolve，让调用方（callPy）天然被节流。算法定时器 20ms 一轮而
 * Python 处理更慢时，这条背压是防止内存增长的那道闸。
 *
 * ⚠️ **`drain` 那条路径没有 reject 也没有超时**：管道永远不排空的话这个 Promise 会一直挂着。
 * 目前靠 callPy 自己的 `timeoutMs` 兜住（超时会 reject 调用方的 Promise），所以现象上不会
 * 卡死；但这个 Promise 本身和它的 `once('drain')` 监听会残留到进程/管道结束。
 * 要彻底修得在这里也加超时并 `removeListener`。
 *
 * 没有 child 时立刻 reject（而不是静默丢弃）：调用方必须知道这次调用没发出去。
 *
 * @param {string} line 已带换行的一行 JSON。
 * @returns {Promise<true>} 写入被接受（或缓冲区已排空）后 resolve。
 */
function writeLine(line) {
  return new Promise((resolve, reject) => {
    if (!child || !child.stdin) return reject(new Error('worker not running'));
    const ok = child.stdin.write(line);
    if (ok) return resolve(true);
    child.stdin.once('drain', resolve);
  });
}

/**
 * 通过 JSON-line 协议调用 Python worker 内的函数。
 *
 * 懒启动（`!child` 时自己拉起 worker），所以调用方从不需要显式 `startWorker`，代价是崩溃后
 * 第一次调用承担重启成本、很可能超时。默认 10 秒对逐帧算法（20/125ms 一轮）很宽松，重活
 * （模型加载、足底分析）由调用方显式传更大的值。写 stdin 失败时清定时器 + 摘 pending + reject
 * 三步都要做，漏一步会留下永远等不到回复的条目和会二次 reject 的定时器。
 *
 * ⚠️ **超时时那条 `_cancel` 不是多余的**：请求已 reject 但 Python 侧还在算，不取消的话一个
 * 超时的重活会继续占着 worker，后面每条请求跟着超时 —— 一次卡顿雪崩成持续不可用。
 *
 * ⚠️ `pending.delete(id)` 必须在 reject **之前**（先摘掉，迟到回复才会被 stdout 那边的
 * `if (!rec)` 静默丢弃）；`id` 单调递增**不复用**（复用会让迟到回复配到新请求上，是最难查的
 * 数据串台）。
 *
 * ⚠️ `new Promise(async ...)` 一般算反模式（executor 内抛错不变成 rejection），此处安全**仅
 * 因为唯一的 await 被 try/catch 完整包住** —— 加代码要保持这个前提。
 *
 * @param {string} fn Python 函数名。
 * @param {unknown} args 可序列化的参数载荷。
 * @param {{ timeoutMs?: number }} [options] 超时配置，默认 10 秒。
 * @returns {Promise<unknown>} Python 返回的数据。
 */
function callPy(fn, args, { timeoutMs = 10000 } = {}) {
  if (!child) {
    try {
      startWorker();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  if (!child) {
    return Promise.reject(new Error('python worker not running'));
  }

  const id = nextId++;

  return new Promise(async (resolve, reject) => {
    const rec = { resolve, reject };
    rec.timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout ${timeoutMs}ms`));
      try {
        child?.stdin.write(JSON.stringify({ id, fn: '_cancel' }) + '\n');
      } catch {}
    }, timeoutMs);

    pending.set(id, rec);

    try {
      await writeLine(JSON.stringify({ id, fn, args }) + '\n');
    } catch (e) {
      clearTimeout(rec.timer);
      pending.delete(id);
      reject(new Error('stdin write failed: ' + e.message));
    }
  });
}

/**
 * 停止 Python worker，并阻止自动重启。
 *
 * 用默认信号（SIGTERM）而不是 SIGKILL，给 Python 一个正常退出的机会。在飞的请求不在这里
 * reject —— `exit` 处理里的 `rejectAllPending` 统一做掉。
 *
 * ⚠️ `manualStop = true` **必须在 kill 之前设**：kill 会触发 `exit` 处理，那里判的就是这个
 * 标志，顺序反了会在关闭流程中又拉起一个 Python，Electron 退不干净（残留子进程）。
 *
 * ⚠️ **关闭流程之后不要再调 `callPy`**：`child` 已置 null，`callPy` 会重新 `startWorker`，而
 * `startWorker` 又把 `manualStop` 重置成 false，等于把 worker 拉回来。顺序由
 * `serverShutdownOrchestrator` 负责。
 *
 * @returns {void}
 */
function stopWorker() {
  manualStop = true;
  if (child) {
    child.kill();
    child = null;
  }
}

module.exports = { startWorker, callPy, stopWorker, warmFootAnalysis };
