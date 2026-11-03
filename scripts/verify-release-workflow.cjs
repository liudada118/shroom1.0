const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { loadAsar, verifyPackagedDependencies } = require('./pack-runtime-dependencies');
const { verifyPackagedFrontendBuild } = require('./verify-frontend-build');
const { getCurrentFuseWire, FuseV1Options } = require('@electron/fuses');

/** 读取验收参数；交付包和源码模式必须明确选择，未知参数直接报错。 */
function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (['--source', '--skip-ui', '--help'].includes(arg)) options[arg.slice(2)] = true;
    else if (['--app-dir', '--electron', '--output'].includes(arg)) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      options[arg.slice(2)] = path.resolve(value);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.help && Boolean(options.source) === Boolean(options['app-dir'])) throw new Error('Choose exactly one: --app-dir <unpacked application> or --source');
  return options;
}

/** 为指定目标计算流式SHA-256，报告用于识别实际受测包。 */
async function hashFile(filename) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

/** 启动隔离模块验收；不启动正式主进程，不接触正式用户目录和固定服务端口。 */
async function runComponents({ electron, appRoot, outputDir }) {
  const fuse = await getCurrentFuseWire(electron);
  // 禁用 RunAsNode 的交付exe会忽略环境变量并打开正式应用，必须在启动前拒绝。
  if (fuse[FuseV1Options.RunAsNode] !== 49) throw new Error('ACCEPTANCE_RUN_AS_NODE_DISABLED: use a build-machine Electron runtime with RunAsNode enabled');
  const log = fs.createWriteStream(path.join(outputDir, 'components.log'));
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(__dirname, 'acceptance/worker.cjs'), appRoot, outputDir], {
      cwd: outputDir, windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: '', NODE_PATH: '',
        APPDATA: outputDir, LOCALAPPDATA: outputDir, HOME: outputDir, USERPROFILE: outputDir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 90000);
    child.once('error', error => { clearTimeout(timer); log.end(); reject(error); });
    child.once('close', code => {
      clearTimeout(timer); log.end();
      if (timedOut) reject(new Error('Component workflow timed out after 90 seconds'));
      else resolve(code);
    });
  });
  const reportPath = path.join(outputDir, 'components.json');
  if (!fs.existsSync(reportPath)) throw new Error(`Component worker exited ${exitCode} without a report; see components.log`);
  const result = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (exitCode !== 0 || result.status !== 'passed') throw Object.assign(new Error(result.error?.message || `Component worker exited ${exitCode}`), { details: result });
  return result;
}

/** 执行单项并保留失败，其他独立层仍继续取证。 */
async function check(report, name, callback) {
  const started = Date.now();
  try {
    const details = await callback();
    report.checks.push({ name, status: 'passed', durationMs: Date.now() - started, details });
  }
  catch (error) { report.checks.push({ name, status: 'failed', durationMs: Date.now() - started, error: error.message, details: error.details }); }
  const last = report.checks.at(-1);
  console.log(`[${last.status.toUpperCase()}] ${name}${last.error ? `: ${last.error}` : ''}`);
  return last;
}

/** 将各层覆盖单独报告，未运行的安装/真机/在线授权不能算通过。 */
async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node scripts/verify-release-workflow.cjs --app-dir <win-unpacked or installed app directory> [--electron <build-machine electron.exe>] [--output <new directory>] [--skip-ui]\n       node scripts/verify-release-workflow.cjs --source\nTests target modules with simulated serial and temporary SQLite; packaged UI uses isolated HTTP/WS fixtures. Does not install, launch the full app, or access real licenses/devices.');
    return;
  }
  const outputDir = options.output || fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-release-acceptance-'));
  if (options.output) fs.mkdirSync(outputDir, { recursive: false });
  const report = { schemaVersion: 1, startedAt: new Date().toISOString(), mode: options.source ? 'source-components' : 'artifact-components-and-webpage',
    outputDir, checks: [], notRun: ['NSIS install/upgrade/uninstall', 'full Electron main process and IPC', 'physical USB/serial hardware', 'live company authorization service', 'collection frequency sampling and sustained high-rate acquisition', 'sensor models other than the cases explicitly listed'] };
  const resources = options['app-dir'] && path.join(options['app-dir'], 'resources');
  const appRoot = options.source ? path.resolve(__dirname, '..') : path.join(resources, 'app.asar');
  const electron = options.electron || require('electron');
  let version;
  const identity = await check(report, 'target-identity', async () => {
    const manifest = options.source ? JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'))
      : JSON.parse(loadAsar().extractFile(appRoot, 'package.json').toString('utf8'));
    version = manifest.version;
    report.target = { appRoot, version, ...(options.source ? {} : { sha256: await hashFile(appRoot) }) };
    return report.target;
  });
  if (!options.source && identity.status === 'passed') {
    await check(report, 'packaged-dependencies', () => verifyPackagedDependencies(appRoot));
    await check(report, 'packaged-frontend-identity', () => verifyPackagedFrontendBuild(resources, version));
  }
  if (identity.status === 'passed') await check(report, 'connection-collection-playback', () => runComponents({ electron, appRoot, outputDir }));
  else report.notRun.push('dependent checks (invalid target)');
  if (!options.source && !options['skip-ui'] && identity.status === 'passed') {
    await check(report, 'packaged-webpage', async () => {
      const { runPackagedPage } = await import(pathToFileURL(path.join(__dirname, 'acceptance/packaged-page.mjs')).href);
      return runPackagedPage({ resources, outputDir });
    });
    await check(report, 'packaged-company-directory', async () => {
      const { runPackagedCompany } = await import(pathToFileURL(path.join(__dirname, 'acceptance/packaged-page.mjs')).href);
      return runPackagedCompany({ resources, outputDir });
    });
    const fixturePath = path.join(outputDir, 'fast256_glove_segments/page-frames.json');
    if (fs.existsSync(fixturePath)) await check(report, 'packaged-fast256-glove', async () => {
      const { runPackagedFast256 } = await import(pathToFileURL(path.join(__dirname, 'acceptance/packaged-page.mjs')).href);
      return runPackagedFast256({ resources, outputDir, fixturePath });
    });
    else report.notRun.push('fast256 webpage (component workflow did not produce serial/replay evidence)');
  } else report.notRun.push(options.source ? 'packaged webpage (source mode)'
    : options['skip-ui'] ? 'packaged webpage (--skip-ui)' : 'packaged webpage (invalid target)');
  if (!options.source && identity.status === 'passed') await check(report, 'artifact-unchanged', async () => {
    const sha256 = await hashFile(appRoot);
    if (sha256 !== report.target?.sha256) throw new Error('Artifact changed during verification; rerun against a frozen build');
    return { sha256 };
  });
  report.status = report.checks.some(item => item.status === 'failed') ? 'failed' : 'passed_for_listed_scope';
  report.completedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  const component = report.checks.find(item => item.name === 'connection-collection-playback')?.details;
  const evidence = component?.details || component?.error?.details || {};
  const cases = evidence.cases || [];
  const sensors = evidence.sensors || [];
  fs.writeFileSync(path.join(outputDir, 'report.md'), `# Shroom 验收报告\n\n状态：${report.status}\n\n目标：${appRoot}\n\n版本：${version || 'unknown'}\n\n`
    + report.checks.map(item => `- ${item.status}: ${item.name}${item.error ? ` — ${item.error.replaceAll('\n', ' ')}` : ''}`).join('\n')
    + '\n\n模拟设备（仅列已完成配置）：\n\n' + (sensors.length ? sensors.map(sensor => `- ${sensor.id || sensor.sensorType}: ${sensor.framesCompared} 帧，${sensor.pointsCompared} 点逐项比对`).join('\n') : '暂无已完成配置。')
    + '\n\n数据链路明细：\n\n' + (cases.length ? cases.map(item => `- ${item.status}: ${item.id}`).join('\n') : '未完成，详见 components.json / components.log。')
    + '\n\n组件验收限制：\n\n' + (evidence.limitations || []).map(item => `- ${item}`).join('\n')
    + '\n\n未执行（不计入通过）：\n\n' + report.notRun.map(item => `- ${item}`).join('\n') + '\n');
  console.log(`Report: ${path.join(outputDir, 'report.md')}`);
  process.exitCode = report.status === 'failed' ? 1 : 0;
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { parseArgs, hashFile, runComponents };
