#!/usr/bin/env node
/**
 * Shroom1.0 集成测试脚本
 * 
 * 用法: node test/integration_test.js
 * 
 * 功能:
 * 1. 模块引用链验证 — 确保所有 require/import 路径正确
 * 2. 端口管理测试 — 检测、分配、冲突处理
 * 3. 前端文件完整性检查
 * 4. 新增工具模块验证
 */

const http = require('http');
const net = require('net');
const path = require('path');
const fs = require('fs');

const PROJECT_DIR = path.join(__dirname, '..');
process.chdir(PROJECT_DIR);

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// ========== 测试执行 ==========

async function run() {
  console.log('\n=== 1. 工具模块引用链测试 ===');
  
  const MODULE_PATHS = [
    'util/portFinder',
    'util/processGuard',
    'util/constant',
    'logger',
    'wsHelper',
    'dbHelper',
    'serialHelper',
    'aes_ecb',
    'util',
    'utilMatrix',
  ];

  for (const mod of MODULE_PATHS) {
    test(`require(${mod})`, () => {
      const fullPath = path.join(PROJECT_DIR, mod);
      if (fs.existsSync(fullPath + '.js') || fs.existsSync(fullPath + '/index.js')) {
        const m = require(fullPath);
        assert(m !== undefined, '模块为 undefined');
      } else {
        throw new Error(`文件不存在: ${fullPath}.js`);
      }
    });
  }

  console.log('\n=== 2. 端口管理测试 ===');
  
  const portFinder = require(path.join(PROJECT_DIR, 'util/portFinder'));
  
  await testAsync('isPortAvailable — 空闲端口检测', async () => {
    const available = await portFinder.isPortAvailable(54321);
    assert(available === true, `端口 54321 应该可用，实际: ${available}`);
  });

  await testAsync('isPortAvailable — 占用端口检测', async () => {
    const blocker = net.createServer();
    await new Promise(r => blocker.listen(54322, '127.0.0.1', r));
    try {
      const available = await portFinder.isPortAvailable(54322);
      assert(available === false, `端口 54322 应该被占用，实际: ${available}`);
    } finally {
      blocker.close();
    }
  });

  await testAsync('listenWithRetry — 正常绑定', async () => {
    const server = http.createServer();
    const port = await portFinder.listenWithRetry(server, 54323);
    assert(typeof port === 'number', `返回值应该是数字，实际: ${typeof port}`);
    assert(port === 54323, `应该绑定到 54323，实际: ${port}`);
    server.close();
  });

  await testAsync('listenWithRetry — 冲突自动递增', async () => {
    const blocker = net.createServer();
    await new Promise(r => blocker.listen(54324, '127.0.0.1', r));
    try {
      const server = http.createServer();
      const port = await portFinder.listenWithRetry(server, 54324);
      assert(port > 54324, `应该 > 54324, 实际 ${port}`);
      server.close();
    } finally {
      blocker.close();
    }
  });

  await testAsync('findAvailablePort — 查找可用端口', async () => {
    const port = await portFinder.findAvailablePort(54330);
    assert(typeof port === 'number', `返回值应该是数字`);
    assert(port >= 54330, `应该 >= 54330, 实际 ${port}`);
  });

  console.log('\n=== 3. disposeThree 工具验证 ===');
  
  test('disposeThree.js 文件存在', () => {
    const filePath = path.join(PROJECT_DIR, 'client/src/components/three/disposeThree.js');
    assert(fs.existsSync(filePath), '文件不存在');
  });

  test('disposeThree.js 导出 cleanupThree 函数', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_DIR, 'client/src/components/three/disposeThree.js'), 'utf8'
    );
    assert(content.includes('export function cleanupThree'), '未找到 cleanupThree 导出');
  });

  console.log('\n=== 4. Three.js 组件清理验证 ===');
  
  const threeDir = path.join(PROJECT_DIR, 'client/src/components/three');
  const threeFiles = fs.readdirSync(threeDir)
    .filter(f => f.endsWith('.js') && !f.includes('disposeThree') && 
            !f.includes('SelectionBox') && !f.includes('SelectionHelper') &&
            !f.includes('threeUtil') && !f.includes('.scss'));
  
  let cleanupCount = 0;
  let totalThreeComponents = 0;
  
  for (const file of threeFiles) {
    const content = fs.readFileSync(path.join(threeDir, file), 'utf8');
    if (content.includes('WebGLRenderer') || content.includes('renderer')) {
      totalThreeComponents++;
      if (content.includes('cleanupThree')) {
        cleanupCount++;
      }
    }
  }
  
  test(`Three.js 组件 cleanupThree 覆盖率 (${cleanupCount}/${totalThreeComponents})`, () => {
    const coverage = cleanupCount / totalThreeComponents;
    assert(coverage >= 0.9, `覆盖率 ${(coverage * 100).toFixed(0)}% 低于 90%`);
  });

  console.log('\n=== 5. 前端文件完整性检查 ===');
  
  test('ECharts barrel file 存在', () => {
    const filePath = path.join(PROJECT_DIR, 'client/src/assets/util/echarts.js');
    assert(fs.existsSync(filePath), '文件不存在');
  });

  test('useWebSocket hook 存在', () => {
    const filePath = path.join(PROJECT_DIR, 'client/src/hooks/useWebSocket.js');
    assert(fs.existsSync(filePath), '文件不存在');
  });

  test('usePressureData hook 存在', () => {
    const filePath = path.join(PROJECT_DIR, 'client/src/hooks/usePressureData.js');
    assert(fs.existsSync(filePath), '文件不存在');
  });

  test('useSerialControl hook 存在', () => {
    const filePath = path.join(PROJECT_DIR, 'client/src/hooks/useSerialControl.js');
    assert(fs.existsSync(filePath), '文件不存在');
  });

  console.log('\n=== 6. server.js 代码质量检查 ===');
  
  const serverContent = fs.readFileSync(path.join(PROJECT_DIR, 'server.js'), 'utf8');
  
  test('无 var 声明残留', () => {
    const varMatches = serverContent.match(/\bvar\b/g);
    const count = varMatches ? varMatches.length : 0;
    assert(count === 0, `仍有 ${count} 处 var 声明`);
  });

  test('无重复 JSON.parse(message) 调用（除定义外）', () => {
    const lines = serverContent.split('\n');
    let parseCount = 0;
    for (const line of lines) {
      if (line.includes('JSON.parse(message)') && !line.includes('const getMessage')) {
        parseCount++;
      }
    }
    assert(parseCount === 0, `仍有 ${parseCount} 处重复 JSON.parse(message)`);
  });

  test('SQLite WAL 模式已配置', () => {
    assert(serverContent.includes('PRAGMA journal_mode=WAL'), '未找到 WAL 配置');
  });

  test('进程守护已集成', () => {
    assert(serverContent.includes('installGuard'), '未找到 installGuard 调用');
  });

  test('端口动态分配已集成', () => {
    assert(serverContent.includes('findAvailablePort'), '未找到 findAvailablePort 调用');
  });

  // 汇总
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  总计: ${passed + failed} | 通过: ${passed} | 失败: ${failed}`);
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
