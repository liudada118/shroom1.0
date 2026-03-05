const { _electron: electron } = require('playwright');

(async () => {
  try {
    const app = await electron.launch({
      args: ['.', '--no-sandbox', '--disable-gpu'],
      cwd: '/home/ubuntu/shroom1.0',
      env: { ...process.env, DISPLAY: ':99' },
      timeout: 30000
    });
    const win = await app.firstWindow({ timeout: 30000 });
    console.log('[OK] Window opened');

    // 收集所有控制台消息
    const errors = [];
    const warnings = [];
    const logs = [];
    win.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') { errors.push(text); console.log('[CONSOLE ERROR]', text.substring(0, 200)); }
      else if (msg.type() === 'warning') { warnings.push(text); }
      else { logs.push(text); }
    });
    win.on('pageerror', err => {
      errors.push('PAGE_ERROR: ' + err.message);
      console.log('[PAGE ERROR]', err.message.substring(0, 200));
    });

    await win.waitForTimeout(5000);
    await win.screenshot({ path: '/tmp/debug_s1_initial.png' });
    console.log('[OK] Initial screenshot');

    // 通过 WS 发送 file 指令切换到触觉手套
    const WebSocket = require('ws');
    const ws = new WebSocket('ws://127.0.0.1:19999');
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('[OK] WS connected');
        ws.send(JSON.stringify({ file: 'hand0205' }));
        console.log('[OK] Sent file: hand0205');
        resolve();
      });
      ws.on('error', reject);
      setTimeout(reject, 5000);
    });

    await win.waitForTimeout(3000);
    await win.screenshot({ path: '/tmp/debug_s2_hand.png' });
    console.log('[OK] Hand mode screenshot');

    // 查找并点击 3D 选择器
    const allText = await win.evaluate(() => {
      const selects = document.querySelectorAll('.ant-select-selection-item');
      return Array.from(selects).map(s => s.textContent);
    });
    console.log('[INFO] All select items:', JSON.stringify(allText));

    // 查找包含 "3D" 的选择器
    const idx3D = allText.findIndex(t => t && t.includes('3D'));
    if (idx3D >= 0) {
      console.log('[INFO] Found 3D selector at index', idx3D, ':', allText[idx3D]);
      await win.locator('.ant-select').nth(idx3D).click();
      await win.waitForTimeout(500);
      await win.screenshot({ path: '/tmp/debug_s3_dropdown.png' });

      // 获取下拉选项
      const options = await win.evaluate(() => {
        const items = document.querySelectorAll('.ant-select-item-option-content');
        return Array.from(items).map(i => i.textContent);
      });
      console.log('[INFO] Dropdown options:', JSON.stringify(options));

      // 点击 "3D皮肤" 选项
      const skinIdx = options.findIndex(t => t && t.includes('皮肤'));
      if (skinIdx >= 0) {
        console.log('[INFO] Clicking skin option:', options[skinIdx]);
        await win.locator('.ant-select-item-option-content').nth(skinIdx).click();
        await win.waitForTimeout(5000);
        await win.screenshot({ path: '/tmp/debug_s4_skin.png' });
        console.log('[OK] Skin mode screenshot');
      } else {
        console.log('[WARN] No skin option found in dropdown');
      }
    } else {
      console.log('[WARN] No 3D selector found');
    }

    // 检查 canvas 元素
    const canvasInfo = await win.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      return Array.from(canvases).map(c => ({
        id: c.id,
        width: c.width,
        height: c.height,
        visible: c.offsetParent !== null,
        style: c.style.cssText
      }));
    });
    console.log('[INFO] Canvas elements:', JSON.stringify(canvasInfo));

    // 检查 WebGL 上下文
    const webglInfo = await win.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      return Array.from(canvases).map(c => {
        const gl = c.getContext('webgl') || c.getContext('webgl2');
        return { id: c.id, hasGL: !!gl };
      });
    });
    console.log('[INFO] WebGL info:', JSON.stringify(webglInfo));

    console.log('\n=== SUMMARY ===');
    console.log('Errors:', errors.length);
    errors.forEach((e, i) => console.log(`  [${i}]`, e.substring(0, 300)));
    console.log('Warnings:', warnings.length);

    ws.close();
    await app.close();
    console.log('[DONE]');
  } catch(e) {
    console.error('[FATAL]', e.message);
    process.exit(1);
  }
})();
