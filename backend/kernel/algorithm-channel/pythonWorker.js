// pyWorker.js
// Python algorithm bridge for on-bed processing.
/**
 * 常驻 Python worker 桥。
 *
 * **协议**：一个长期存活的子进程，stdin/stdout 上跑 JSON-line —— 每行一个
 * `{id, fn, args}` 请求，Python 回一行 `{id, ok, data|error|trace}`。用 id 配对，所以
 * 请求可以并发在飞、乱序返回。
 *
 * **为什么是常驻进程而不是每次 spawn**：Python 侧要加载 numpy 和原生 onbed_filter，
 * 启动成本在百毫秒到秒级；而算法调用是 20–125ms 一轮的。每次新起进程根本追不上。
 *
 * **Python 版本锁死 3.11**（`probePythonInterpreter` 里是 `assert` 死等号）。原因是原生
 * onbed_filter 是按 3.11 的 ABI 编的，换版本会在 import 时崩或者更糟 —— 静默算错。
 * 所以本文件里所有 `python3.11` 的字样都不是「随手写的默认值」，别顺手升级。
 *
 * **启动目标的选择有优先级**（见 resolvePythonLaunchTarget）：新编译的 exe > 打包内置
 * exe > 解释器 + 源码。开发时能改 .py 立刻生效，打包后走单文件 exe 不依赖用户环境。
 *
 * 本文件用 `console.log/error` 而不是 `common/logger.js`：它可能在 logger 装配之前就被
 * 加载（惰性 require 也只是推迟，不保证顺序），且这些是启动期诊断信息，需要无条件可见。
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
 * **这个「新鲜度检查」是为了开发时不踩一个很难查的坑**：改完 .py 忘了重新 build，
 * 如果无条件用 dist 里的 exe，跑的就还是旧算法 —— 现象是「代码明明改了但行为没变」，
 * 而且没有任何提示。过期就返回 null，退回解释器直跑源码模式（慢一点，但一定是最新的）。
 *
 * 比较基准取三个源的最大 mtime：`app/`（算法代码）、`build_exe.py`（打包脚本）、
 * `requirements.txt`（依赖变了也得重编）。
 *
 * 用 `>=` 而不是 `>`：同秒完成的构建（mtime 相等）应当算新鲜，否则刚 build 完就被判过期。
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
 * `-a` 而不是默认的「只回第一个」：系统上常有多个 python3.11（Homebrew、pyenv、系统自带），
 * 第一个不一定装了 numpy。全拿回来交给 probePythonInterpreter 逐个试。
 *
 * Windows 直接返回空数组：那里没有 `which`，走的是 `py -3.11` 启动器（见
 * pythonInterpreterCandidates）。
 *
 * 探测失败（命令不存在、非零退出）返回空数组而不是抛 —— 找不到只是少几个候选。
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
 * 为什么要专门照顾 conda：算法开发者的机器上 numpy 往往只装在某个 conda 环境里，
 * 而那些环境的 bin 目录**不在 PATH 上**（要 `conda activate` 才进来）。只靠
 * `which` 会一个都找不到，开发者得手动设 `PYTHON_FOR_RUNTIME`。
 *
 * 两类根目录分别处理：
 * - `baseRoots` —— base 环境本身，直接看 `<root>/bin/python3.11`。
 * - `envRoots` —— 命名环境的父目录，要**列目录**再逐个拼。`CONDA_PREFIX/..` 那一项
 *   让「当前已激活的环境」的同级环境也能被找到。
 *
 * 只找 3.11（见文件头：原生库 ABI 锁死）。`readdirSync` 用 try/catch 包起来吞掉错误 ——
 * conda 目录常有权限受限的子项，一个读不了不该让整轮探测失败。
 *
 * 最后 `filter(existingFile)`，所以返回的都是真实存在的可执行文件。Windows 返回空数组
 * （那边的 conda 布局不同，且已有 `py` 启动器）。
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
 * 顺序上优先使用显式配置和本地运行时，再回退到系统命令。
 *
 * **数组顺序就是尝试顺序**，而且第一个探测通过的就赢（见 resolvePythonLaunchTarget）。
 * 所以顺序是这个函数的全部内容：
 * 1. `PYTHON_FOR_RUNTIME` —— 显式配置永远第一。这是用户的逃生门：上面所有自动探测都
 *    不合用时，指一个绝对路径就行。
 * 2. 项目自带的 venv / 内置 Python —— 可控、可复现，优于系统装的。
 * 3. conda 环境、PATH 上的 python3.11 —— 开发机常见位置。
 * 4. 裸命令 `python3.11` / `python3` / `python` —— 最后的兜底。放最后是因为 `python`
 *    在很多机器上是 2.x 或别的 3.x 版本，探测一定会失败，只是白花一次 spawnSync。
 *
 * `label` 与 `command` 通常相同，分开存是为了 `py -3.11` 这种「命令 + 参数」的候选能在
 * 报错信息里显示成人类看得懂的一行。
 *
 * 打包环境**只找内置 Python**，绝不回落到系统 Python：用户机器上的 Python 版本和依赖
 * 完全不可控，跑起来也会因为 numpy 版本不对而算错。
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
 * **判据是「真的 import 一遍」而不是「问版本号」**：`python --version` 对了但没装 numpy
 * 的机器非常多，只查版本会挑中一个跑起来立刻崩的解释器，而且错误发生在 worker 启动之后，
 * 表现成「算法通道时不时挂掉」而不是「环境没装好」。
 *
 * 探测脚本做四件事，缺一不可：
 * - `assert sys.version_info[:2] == (3, 11)` —— **死等号**。见文件头：原生库按 3.11 的
 *   ABI 编的，3.12 能 import numpy 但会在加载 onbed_filter 时崩。
 * - `import numpy` —— 最重的依赖，装不上的概率最高。
 * - `import onbed_filter_example` —— 连业务脚本一起 import，这样它自己的依赖（含原生库）
 *   也一并被验证。为此要先把脚本目录塞进 `sys.path`。
 * - `print(sys.executable)` —— 回报**解释器自己认为的**路径。`py -3.11` 或符号链接的情况下
 *   它和 `candidate.command` 不同，日志里显示真实路径才好排查。
 *
 * `spawnSync` 是**阻塞**的，一个候选一次。只在首次启动跑，代价换来的是「要么能用，要么
 * 明确告诉你哪个候选为什么不行」。
 *
 * 失败时把 stderr/stdout/退出码依次兜底成 `reason`，因为三种失败方式各自只填其中一个。
 * 这些 reason 会被汇总进 resolvePythonLaunchTarget 的错误信息。
 *
 * `stdout` 取**最后一行**（`.pop()`）：import numpy 之类可能往 stdout 打警告，
 * 真正的 `sys.executable` 一定是最后打印的那行。
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
 * 开发环境可使用新编译的可执行文件或 Python 3.11 解释器；打包环境会先查找
 * 内置可执行文件，再查找内置 Python。
 *
 * **优先级（从上往下，第一个成立的就用）：**
 * 1. 开发环境里比源码新的 exe —— 快，且确认是最新代码。
 * 2. 打包内置的 exe —— 打包产物的正常路径，单文件、不依赖用户环境。
 * 3. 解释器 + 源码 —— 兜底，也是唯一能改完 .py 立刻生效的模式。
 *
 * **三种返回值语义不同，调用方要分清：**
 * - 返回对象 —— 找到了。
 * - 返回 `null` —— 连源码脚本都没有，属于「装配不完整」（打包漏了 python 目录）。
 *   startWorker 会把它翻译成一条更具体的错误。
 * - **抛错** —— 源码在、但所有解释器候选都探测失败。错误信息里**逐条列出每个候选和它
 *   失败的原因**，这是排查环境问题唯一有用的输出，不要简化成一句「找不到 Python」。
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
 * 缓存是必需的：解析过程里有一串阻塞 `spawnSync` 探测，而 worker 崩溃后会自动重启
 * （见 startWorker 的 exit 处理），每次重启都重新探测会让「Python 反复崩」变成「整个后端
 * 卡死」。环境在进程生命周期内不会变，探一次就够。
 *
 * ⚠️ **只缓存成功结果。** `resolvePythonLaunchTarget` 抛错时 `resolvedLaunchTarget` 仍是
 * null，所以下一次 `callPy` 会**重新走一遍全部候选的阻塞探测**。在「机器上没有可用
 * Python」的情况下，配合 125ms 的算法定时器，这会变成持续的 spawnSync 风暴 ——
 * 现象是整个后端明显变卡而不是干净地报一次错。要修的话是把失败也缓存下来（附带一个
 * 「允许重试」的显式入口），那是一处真实改动，不在注释这一轮里动。
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
 * exe 模式不需要任何参数（一切都编进去了），直接返回空数组。
 *
 * 解释器模式的两个参数都不是可选的：
 * - **`-u`（不缓冲）是 JSON-line 协议的前提。** Python 默认在管道上做块缓冲，回复会攒在
 *   缓冲区里不发出来 —— 现象是每一次 callPy 都超时，而 Python 侧其实早就算完了。
 *   （`pythonRuntimeEnv` 里的 `PYTHONUNBUFFERED` 是同一件事的双保险。）
 * - **`-X utf8` 只在 Windows 加**：那里的默认编码是系统代码页（中文机器上是 GBK），
 *   JSON 里出现非 ASCII 字符时会编解码失败，表现成「bad JSON line」。
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
 * 五个变量各自挡一类真实事故：
 * - `PYTHONUNBUFFERED` —— 同 `-u`，JSON-line 协议要求立刻吐出回复。exe 模式没法传 `-u`，
 *   所以这个变量是那条路上唯一的保障。
 * - **`PYTHONNOUSERSITE` 是最关键的一条**：不加它，用户 home 下的 `~/.local/lib` 里那份
 *   numpy 会**盖掉**内置 venv 的版本，然后原生库因为 numpy ABI 不匹配而崩。这类问题只在
 *   「某台机器上」出现，极难复现。
 * - `PYTHONUTF8` / `PYTHONIOENCODING` —— Windows 代码页问题的双保险（见 pythonArgs）。
 * - `MPLCONFIGDIR` —— matplotlib 默认往 `$HOME/.matplotlib` 写缓存；打包应用在受限账户
 *   下写不进去，它会往 stderr 打一段警告，而那段警告会混进日志、也曾干扰过启动握手。
 *   指到系统临时目录就没事了。
 *
 * `mkdirSync` 的失败被吞掉：目录建不出来最坏结果是 matplotlib 那条警告回来，不该因此
 * 让算法起不来。
 *
 * 基于 `process.env` 展开（而不是给一个干净环境）：PATH、代理、系统库路径都还得要。
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
 * worker 死掉（error/exit）时必须调：那些请求的回复永远不会来了，不 reject 的话调用方
 * 手里的 Promise 永远挂着 —— 现象是采集界面停住不动、也不报错。
 *
 * 每条都先 `clearTimeout`：否则超时定时器会在几秒后再 reject 一次（已 settle 的 Promise
 * 不受影响，但定时器会一直吊着闭包），而且会往一个已经不存在的 stdin 写 `_cancel`。
 *
 * 最后 `pending.clear()`，把 Map 清空 —— 重启后的 worker 用的是同一个 Map，
 * 残留条目会让新 worker 的回复撞上旧 id。
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
 * 足底分析要加载一个较大的模型，首次调用可能几十秒 —— 用户点了「分析」再等这么久体验很差，
 * 所以在进入足底页面时先触发这个预热。`timeoutMs: 300000`（5 分钟）就是给这个加载留的余量，
 * 不是随便写的大数。
 *
 * **成功后 Promise 一直留着**（不清空），所以后续调用立刻返回，不会重复预热。
 * **失败时清空**，这样下一次调用能重试 —— 预热失败常见于 worker 恰好在重启，不该一次失败
 * 就永久放弃。清空之后仍然 `throw`，让本次调用方知道失败了。
 *
 * worker 退出时这个 Promise 也会被清空（见 startWorker 的 exit 处理）：新 worker 是全新的
 * 进程，模型没加载，缓存「已预热」会让下一次分析卡在一个意料之外的地方。
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
 * worker 异常退出后会自动重启；通过 stopWorker 主动停止时不会自动重启。
 *
 * **幂等**：`if (child || starting) return`。callPy 在 `!child` 时会自己调它，而算法定时器
 * 20ms 一轮 —— 没有这道闸会瞬间起出一堆 Python 进程。`starting` 这个标志覆盖的是「spawn
 * 已经发起但 child 还没赋值」的那个窗口。
 *
 * **stdout 的行拆分是这个函数的核心**：
 * ```
 * buf += 新数据; lines = buf.split(换行); buf = lines.pop()
 * ```
 * `pop()` 拿回的是最后一段 —— 它**可能是不完整的一行**（TCP/管道不保证按行到达），
 * 留在 buf 里等下一批数据接上。少了这一步，一行 JSON 被切成两半就会变成两条
 * 「bad JSON line」，而那一帧的回复永远等不到。
 *
 * 认不出 id 的回复（`if (!rec) continue`）**静默丢弃**：这正是超时之后迟到的回复，
 * 它的 Promise 早已 reject，此时报错只会刷屏。
 *
 * `msg.ok === false` 用严格比较：缺字段的回复应当走成功分支（老版本 Python 不发 `ok`）。
 * 失败时把 `trace` 拼在 message 后面 —— Python 的 traceback 是排查算法错误唯一有用的东西，
 * 不要为了「消息干净」把它丢掉。（要发给前端的时候再裁，见 petCare 的
 * safeAlgorithmErrorMessage。）
 *
 * **`exit` 处理里的自动重启（500ms 后）是这条链路的韧性来源**：原生算法库偶发崩溃时，
 * 用户看到的只是几帧数据缺失，而不是「算法功能从此不可用直到重启软件」。500ms 是防止
 * 崩溃-重启风暴打满 CPU 的最小间隔。`manualStop` 保证正常关闭时不会又拉起来一个。
 * 重启前会清空 `footWarmupPromise`（新进程没预热过）但**不清 `resolvedLaunchTarget`**
 * （环境没变，不必重新做阻塞探测）。
 *
 * 结尾那个 `ping` 是**启动握手**：它把「进程起来了」变成「进程能应答了」。失败只记日志不抛，
 * 因为真正的调用会各自超时报错；这条日志的价值是把「起不来」和「起来但不干活」区分开。
 * 30 秒超时对应首次加载 numpy + 原生库的最坏情况。
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
 * **懒启动**：`!child` 时自己把 worker 拉起来。所以调用方从来不需要显式 startWorker，
 * 也意味着 worker 崩溃后的第一次调用会承担重启成本（并且很可能超时）—— 这是有意的，
 * 换来的是调用方不必关心 worker 状态。
 *
 * **超时时会往 Python 发一条 `_cancel`**，这一步容易被当成多余：请求已经 reject 了，
 * 但 Python 侧还在算。不取消的话，一个算超时的重活会继续占着 worker，后面每一条请求都跟着
 * 超时 —— 一次卡顿会雪崩成持续不可用。写 `_cancel` 的失败被吞掉（管道可能已经断了）。
 *
 * `pending.delete(id)` 在 reject **之前**：先摘掉，迟到的回复才会被 stdout 处理里的
 * `if (!rec)` 静默丢弃，而不是去 resolve 一个已经 reject 的 Promise。
 *
 * `id` 单调递增、不复用：复用会让「超时后迟到的回复」配到一个新请求上，那是最难查的
 * 一类 bug（数据串台）。
 *
 * 默认 10 秒超时对逐帧算法（20/125ms 一轮）来说很宽松；重活（模型加载、足底分析）由调用方
 * 显式传更大的值。
 *
 * 写 stdin 失败时手动清定时器并摘 pending 再 reject —— 三步都要做，漏一步就会留下一个
 * 永远等不到回复的条目和一个会二次 reject 的定时器。
 *
 * 注：这里的 `new Promise(async ...)` 用了 async executor（一般算反模式，因为 executor 内
 * 抛错不会自动变成 rejection）。此处安全，因为**唯一的 await 被 try/catch 完整包住**。
 * 加代码时要保持这个前提。
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
 * `manualStop = true` **必须在 kill 之前设**：kill 会触发 `exit` 处理，而那里判的就是这个
 * 标志。顺序反了就会在关闭流程中又拉起一个 Python，导致 Electron 退不干净（残留子进程）。
 *
 * `child = null` 也是立刻设的，所以 kill 之后到 exit 事件到达之间的任何 callPy 都会走
 * 「重新 startWorker」而不是往一个正在死的管道写。不过此时 `manualStop` 已经是 true，
 * 而 startWorker 会把它重置成 false —— 所以**关闭流程之后不要再调 callPy**，那会把 worker
 * 又拉起来。关闭编排（serverShutdownOrchestrator）负责这个顺序。
 *
 * 在飞的请求不在这里 reject：`exit` 处理里的 rejectAllPending 会统一做掉。
 *
 * 用默认信号（SIGTERM/Windows 上等价终止）而不是 SIGKILL，给 Python 一个正常退出的机会。
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
