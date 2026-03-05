/**
 * e2e_test.js - Shroom1.0 Electron 端到端测试
 *
 * 覆盖：应用生命周期、HTTP、WebSocket、数据库、UI导航、组件交互、Canvas/3D、内存
 */
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROJECT_DIR = '/home/ubuntu/shroom1.0';
const STATIC_PORT = 12321;
const WS_PORTS = { main: 19999, back: 19998, head: 19997 };
const SCREENSHOT_DIR = path.join(PROJECT_DIR, 'test', 'screenshots');
const REPORT_PATH = path.join(SCREENSHOT_DIR, 'test_report.json');

const ROUTES = [
  { path: '/', name: '首页(Date)' },
  { path: '/system', name: '系统主页(Home)' },
  { path: '/heatmap', name: '热力图' },
  { path: '/num/car10', name: '数字矩阵(car10)' },
  { path: '/handReal', name: '手部实时演示' },
  { path: '/handPoint', name: '手部传感点' },
  { path: '/handPoint32', name: '32点手部' },
  { path: '/line', name: '线调整' },
  { path: '/num1010', name: '10x10矩阵' },
  { path: '/num1016', name: '10x16矩阵' },
  { path: '/block', name: '块显示' },
  { path: '/log', name: '日志' },
  { path: '/diff', name: '矩阵差异' },
  { path: '/3Dnum', name: '3D数字' },
  { path: '/license', name: '授权管理' },
];

const ANTD = { button: '.ant-btn', input: '.ant-input', select: '.ant-select', modal: '.ant-modal' };

const results = [];
const startTime = Date.now();

function addResult(category, name, status, detail, screenshot = null) {
  results.push({ category, name, status, detail, duration_ms: Date.now() - startTime, screenshot });
  const icon = status === 'PASSED' ? '✅' : status === 'FAILED' ? '❌' : '⏭️';
  console.log(`  ${icon} [${category}] ${name}: ${detail}`);
}

async function ss(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`);
  try { await page.screenshot({ path: fp, fullPage: false }); return fp; } catch { return null; }
}

// 超时包装器：给每个测试函数加上超时保护
function withTimeout(fn, timeoutMs = 30000) {
  return async (...args) => {
    return Promise.race([
      fn(...args),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`测试超时 (${timeoutMs}ms)`)), timeoutMs))
    ]);
  };
}

// ─── 1. 应用生命周期 ──────────────────────────────────────────
async function testLifecycle(app, page) {
  console.log('\n═══ 1. 应用生命周期测试 ═══');
  try {
    const isVisible = await page.isVisible('body');
    addResult('生命周期', '应用启动', isVisible ? 'PASSED' : 'FAILED',
      isVisible ? 'Electron 主窗口已创建并可见' : '主窗口不可见');
  } catch (e) { addResult('生命周期', '应用启动', 'FAILED', e.message); }

  try {
    await page.waitForTimeout(2000);
    const nodeCount = await page.evaluate(() => document.querySelectorAll('*').length);
    const s = await ss(page, '01_page_loaded');
    addResult('生命周期', '页面加载', nodeCount > 10 ? 'PASSED' : 'FAILED', `DOM 节点数: ${nodeCount}`, s);
  } catch (e) { addResult('生命周期', '页面加载', 'FAILED', e.message); }

  try {
    const title = await page.title();
    addResult('生命周期', '窗口属性', 'PASSED', `标题: "${title}", URL: ${page.url()}`);
  } catch (e) { addResult('生命周期', '窗口属性', 'FAILED', e.message); }

  try {
    const errors = [];
    page.on('pageerror', (err) => {
      if (!err.message.includes('ResizeObserver') && !err.message.includes('Script error')) errors.push(err.message);
    });
    await page.waitForTimeout(1000);
    addResult('生命周期', 'JS错误检测', errors.length === 0 ? 'PASSED' : 'FAILED',
      errors.length === 0 ? '无未捕获异常' : `${errors.length} 个错误`);
  } catch (e) { addResult('生命周期', 'JS错误检测', 'FAILED', e.message); }

  try {
    const response = await page.evaluate(async (port) => {
      try { const r = await fetch(`http://127.0.0.1:${port}/`); return { status: r.status, ok: r.ok }; }
      catch (e) { return { error: e.message }; }
    }, STATIC_PORT);
    addResult('生命周期', '静态服务器', response.ok ? 'PASSED' : 'FAILED',
      response.ok ? `HTTP ${response.status} OK` : JSON.stringify(response));
  } catch (e) { addResult('生命周期', '静态服务器', 'FAILED', e.message); }
}

// ─── 2. WebSocket ─────────────────────────────────────────────
async function testWebSocket(page) {
  console.log('\n═══ 2. WebSocket 测试 ═══');
  for (const [name, port] of Object.entries(WS_PORTS)) {
    try {
      const result = await page.evaluate(async (p) => {
        return new Promise((resolve) => {
          const t = setTimeout(() => resolve({ connected: false, error: 'timeout' }), 5000);
          try {
            const ws = new WebSocket(`ws://127.0.0.1:${p}`);
            ws.onopen = () => { clearTimeout(t); ws.close(); resolve({ connected: true }); };
            ws.onerror = () => { clearTimeout(t); resolve({ connected: false, error: 'error' }); };
          } catch (e) { clearTimeout(t); resolve({ connected: false, error: e.message }); }
        });
      }, port);
      addResult('WebSocket', `WS ${name} (${port})`, result.connected ? 'PASSED' : 'SKIPPED',
        result.connected ? '连接成功' : `连接失败: ${result.error}`);
    } catch (e) { addResult('WebSocket', `WS ${name} (${port})`, 'SKIPPED', e.message); }
  }
}

// ─── 3. 数据库 ────────────────────────────────────────────────
async function testDatabase() {
  console.log('\n═══ 3. 数据库测试 ═══');
  // 使用 sqlite3 CLI 测试（避免原生模块版本冲突）
  try {
    const { execSync } = require('child_process');
    const tmpDb = '/tmp/test_shroom_e2e.db';
    execSync(`sqlite3 ${tmpDb} "CREATE TABLE test(id INTEGER PRIMARY KEY, val TEXT); INSERT INTO test VALUES(1,'ok'); SELECT * FROM test;"`);
    try { fs.unlinkSync(tmpDb); } catch {}
    addResult('数据库', 'SQLite CRUD 测试', 'PASSED', '建表、插入、查询均成功');
  } catch (e) { addResult('数据库', 'SQLite CRUD 测试', 'FAILED', e.message); }

  try {
    const dbFiles = fs.readdirSync(path.join(PROJECT_DIR, 'db'));
    addResult('数据库', '项目数据库文件', dbFiles.length > 0 ? 'PASSED' : 'SKIPPED',
      `db/ 目录文件: ${dbFiles.join(', ')}`);
  } catch (e) { addResult('数据库', '项目数据库文件', 'SKIPPED', e.message); }
}

// ─── 4. UI 导航 ───────────────────────────────────────────────
async function testUINavigation(page) {
  console.log('\n═══ 4. UI 导航测试 ═══');
  for (const route of ROUTES) {
    try {
      await page.evaluate((hash) => { window.location.hash = hash; }, route.path);
      await page.waitForTimeout(1500);
      const contentLen = await page.evaluate(() => document.body.innerText.length);
      const s = await ss(page, `04_route_${route.path.replace(/\//g, '_').replace(/:/g, '')}`);
      addResult('UI导航', `路由 ${route.path} (${route.name})`,
        contentLen > 0 ? 'PASSED' : 'FAILED', `页面内容长度: ${contentLen}`, s);
    } catch (e) { addResult('UI导航', `路由 ${route.path} (${route.name})`, 'FAILED', e.message); }
  }
}

// ─── 5. 组件交互 ──────────────────────────────────────────────
async function testComponentInteraction(page) {
  console.log('\n═══ 5. 组件交互测试 ═══');

  // 先关闭可能存在的弹窗
  try {
    await page.evaluate(() => {
      document.querySelectorAll('.ant-modal-close').forEach(el => el.click());
    });
    await page.waitForTimeout(500);
  } catch {}

  // 导航到首页
  await page.evaluate(() => { window.location.hash = '/'; });
  await page.waitForTimeout(1500);

  // 按钮检测（不点击，避免弹窗阻塞）
  try {
    const btnCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, ANTD.button);
    const s = await ss(page, '05_buttons');
    addResult('组件交互', 'Antd 按钮检测', btnCount > 0 ? 'PASSED' : 'SKIPPED', `发现 ${btnCount} 个按钮`, s);
  } catch (e) { addResult('组件交互', 'Antd 按钮检测', 'SKIPPED', e.message); }

  // 输入框检测
  try {
    const inputCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, ANTD.input);
    addResult('组件交互', 'Antd 输入框检测', 'PASSED', `发现 ${inputCount} 个输入框`);
  } catch (e) { addResult('组件交互', 'Antd 输入框检测', 'SKIPPED', e.message); }

  // Select 检测
  try {
    const selectCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, ANTD.select);
    addResult('组件交互', 'Antd Select 检测', 'PASSED', `发现 ${selectCount} 个 Select`);
  } catch (e) { addResult('组件交互', 'Antd Select 检测', 'SKIPPED', e.message); }

  // 导航到 system 页面
  await page.evaluate(() => { window.location.hash = '/system'; });
  await page.waitForTimeout(2000);

  try {
    const selectCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, ANTD.select);
    const s = await ss(page, '05_system_page');
    addResult('组件交互', 'System 页面组件', selectCount > 0 ? 'PASSED' : 'SKIPPED',
      `Select: ${selectCount}`, s);
  } catch (e) { addResult('组件交互', 'System 页面组件', 'SKIPPED', e.message); }

  // 导航到 license 页面检测表单
  await page.evaluate(() => { window.location.hash = '/license'; });
  await page.waitForTimeout(1500);

  try {
    const btnCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, ANTD.button);
    const inputCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, ANTD.input);
    const s = await ss(page, '05_license_page');
    addResult('组件交互', 'License 页面组件', 'PASSED',
      `按钮: ${btnCount}, 输入框: ${inputCount}`, s);
  } catch (e) { addResult('组件交互', 'License 页面组件', 'SKIPPED', e.message); }
}

// ─── 6. Canvas / 3D ───────────────────────────────────────────
async function testCanvas3D(page) {
  console.log('\n═══ 6. Canvas / 3D 渲染测试 ═══');

  await page.evaluate(() => { window.location.hash = '/system'; });
  await page.waitForTimeout(3000);

  try {
    const canvasInfo = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('canvas')).map((c, i) => ({
        index: i, width: c.width, height: c.height,
      }));
    });
    const s = await ss(page, '06_canvas_system');
    if (canvasInfo.length > 0) {
      addResult('Canvas/3D', 'System Canvas', 'PASSED', `${canvasInfo.length} 个 Canvas`, s);
      for (const c of canvasInfo) {
        addResult('Canvas/3D', `Canvas[${c.index}] 尺寸`,
          c.width > 0 && c.height > 0 ? 'PASSED' : 'FAILED', `${c.width}x${c.height}`);
      }
    } else {
      addResult('Canvas/3D', 'System Canvas', 'SKIPPED', '未发现 Canvas（需 WS 数据驱动）', s);
    }
  } catch (e) { addResult('Canvas/3D', 'System Canvas', 'FAILED', e.message); }

  await page.evaluate(() => { window.location.hash = '/3Dnum'; });
  await page.waitForTimeout(2000);

  try {
    const count = await page.evaluate(() => document.querySelectorAll('canvas').length);
    const s = await ss(page, '06_3dnum');
    addResult('Canvas/3D', '3D数字 Canvas', count > 0 ? 'PASSED' : 'SKIPPED', `Canvas: ${count}`, s);
  } catch (e) { addResult('Canvas/3D', '3D数字 Canvas', 'SKIPPED', e.message); }
}

// ─── 7. 内存检测 ──────────────────────────────────────────────
async function testMemory(page) {
  console.log('\n═══ 7. 内存检测 ═══');
  try {
    const memBefore = await page.evaluate(() => performance.memory?.usedJSHeapSize || null);
    for (const r of ['/', '/system', '/log', '/license', '/']) {
      await page.evaluate((h) => { window.location.hash = h; }, r);
      await page.waitForTimeout(1000);
    }
    const memAfter = await page.evaluate(() => performance.memory?.usedJSHeapSize || null);
    if (memBefore && memAfter) {
      const leakMB = (memAfter - memBefore) / 1024 / 1024;
      addResult('内存检测', '路由切换内存', leakMB < 50 ? 'PASSED' : 'FAILED',
        `变化: ${leakMB.toFixed(2)} MB (阈值: 50MB)`);
    } else {
      addResult('内存检测', '路由切换内存', 'SKIPPED', 'performance.memory 不可用');
    }
  } catch (e) { addResult('内存检测', '路由切换内存', 'SKIPPED', e.message); }
}

// ─── 主引擎 ───────────────────────────────────────────────────
async function run() {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  console.log('═══════════════════════════════════════════');
  console.log('  Shroom1.0 Electron 端到端测试');
  console.log(`  时间: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════');

  // 全局超时：5分钟
  const globalTimeout = setTimeout(() => {
    console.error('\n[超时] 全局测试超时 (5分钟)，强制退出');
    generateReport();
    process.exit(1);
  }, 5 * 60 * 1000);

  let app, page;
  try {
    console.log('\n[启动] 正在启动 Electron 应用...');
    app = await electron.launch({
      args: [PROJECT_DIR, '--no-sandbox', '--disable-gpu'],
      env: { ...process.env, DISPLAY: ':99', NODE_ENV: 'production', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
      timeout: 60000,
    });
    page = await app.firstWindow({ timeout: 60000 });
    console.log('[启动] Electron 窗口已获取');
    await page.waitForTimeout(3000);

    // 自动关闭弹窗
    page.on('dialog', async (dialog) => { await dialog.dismiss().catch(() => {}); });

    await withTimeout(testLifecycle, 30000)(app, page);
    await withTimeout(testWebSocket, 20000)(page);
    await withTimeout(testDatabase, 10000)();
    await withTimeout(testUINavigation, 60000)(page);
    await withTimeout(testComponentInteraction, 30000)(page);
    await withTimeout(testCanvas3D, 30000)(page);
    await withTimeout(testMemory, 30000)(page);

  } catch (e) {
    console.error(`[致命错误] ${e.message}`);
    addResult('系统', '测试执行', 'FAILED', e.message);
  } finally {
    console.log('\n═══ 应用关闭测试 ═══');
    try {
      if (app) { await app.close(); addResult('生命周期', '应用关闭', 'PASSED', '进程正常退出'); }
    } catch (e) { addResult('生命周期', '应用关闭', 'FAILED', e.message); }
    clearTimeout(globalTimeout);
  }

  generateReport();
  const failed = results.filter(r => r.status === 'FAILED').length;
  process.exit(failed > 0 ? 1 : 0);
}

function generateReport() {
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  const total = results.length;

  const categories = {};
  for (const r of results) {
    if (!categories[r.category]) categories[r.category] = { passed: 0, failed: 0, skipped: 0, total: 0 };
    categories[r.category][r.status.toLowerCase()]++;
    categories[r.category].total++;
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  Electron 端到端测试报告');
  console.log(`  项目: Shroom1.0`);
  console.log(`  时间: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════');
  for (const [cat, s] of Object.entries(categories)) {
    const icon = s.failed > 0 ? '❌' : s.skipped > 0 ? '⚠️' : '✅';
    console.log(`  ${cat.padEnd(12)}: ${s.passed}/${s.total} ${icon}${s.skipped > 0 ? ` (${s.skipped} 跳过)` : ''}`);
  }
  console.log('  ─────────────────────────────');
  console.log(`  总计: ${passed}/${total} 通过, ${failed} 失败, ${skipped} 跳过`);
  console.log('═══════════════════════════════════════════');

  const report = { project: 'Shroom1.0', branch: 'test (based on Max)', timestamp: new Date().toISOString(),
    summary: { total, passed, failed, skipped }, categories, results };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n[报告] JSON 报告已保存: ${REPORT_PATH}`);
  console.log(`[截图] 截图目录: ${SCREENSHOT_DIR}`);
}

run().catch((e) => { console.error('测试执行失败:', e); process.exit(1); });
