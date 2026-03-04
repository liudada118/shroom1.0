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

    // 收集控制台错误
    const errors = [];
    win.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.log('[CONSOLE ERROR]', msg.text().substring(0, 300));
      }
    });
    win.on('pageerror', err => {
      errors.push('PAGE_ERROR: ' + err.message);
      console.log('[PAGE ERROR]', err.message.substring(0, 300));
    });

    await win.waitForTimeout(5000);
    await win.screenshot({ path: '/tmp/skin_s1_initial.png' });
    console.log('[OK] Initial screenshot');

    // 检查当前 matrixName 和 numMatrixFlag
    const state1 = await win.evaluate(() => {
      const selects = document.querySelectorAll('.ant-select-selection-item');
      const texts = Array.from(selects).map(s => s.textContent);
      return { selectTexts: texts };
    });
    console.log('[INFO] Selects:', JSON.stringify(state1));

    // 查找包含 "3D" 的选择器并点击
    const selectCount = await win.locator('.ant-select').count();
    console.log('[INFO] Total ant-select count:', selectCount);

    for (let i = 0; i < selectCount; i++) {
      const text = await win.locator('.ant-select-selection-item').nth(i).textContent().catch(() => '');
      console.log(`[INFO] Select[${i}]: "${text}"`);
    }

    // 找到 3D 相关的选择器（应该是 "3D遥操" 或 "3D皮肤"）
    let found3D = false;
    for (let i = 0; i < selectCount; i++) {
      const text = await win.locator('.ant-select-selection-item').nth(i).textContent().catch(() => '');
      if (text.includes('3D') || text.includes('遥操') || text.includes('皮肤') || text.includes('数字') || text.includes('2D')) {
        console.log(`[INFO] Found 3D selector at index ${i}: "${text}"`);
        found3D = true;

        // 点击打开下拉
        await win.locator('.ant-select').nth(i).click();
        await win.waitForTimeout(500);
        await win.screenshot({ path: '/tmp/skin_s2_dropdown.png' });

        // 获取下拉选项
        const options = await win.evaluate(() => {
          const items = document.querySelectorAll('.ant-select-item-option-content');
          return Array.from(items).map(i => i.textContent);
        });
        console.log('[INFO] Dropdown options:', JSON.stringify(options));

        // 点击 "3D皮肤" 选项
        const skinOpt = options.findIndex(t => t.includes('皮肤'));
        if (skinOpt >= 0) {
          console.log('[INFO] Clicking skin option at', skinOpt);
          await win.locator('.ant-select-item-option-content').nth(skinOpt).click();
          await win.waitForTimeout(5000);
          await win.screenshot({ path: '/tmp/skin_s3_skin.png' });
          console.log('[OK] Skin mode screenshot');
        }
        break;
      }
    }

    if (!found3D) {
      console.log('[WARN] No 3D selector found! Trying to find sensor selector...');
      // 可能需要先选择传感器类型
      for (let i = 0; i < selectCount; i++) {
        const text = await win.locator('.ant-select-selection-item').nth(i).textContent().catch(() => '');
        console.log(`[DEBUG] Select[${i}] text: "${text}"`);
      }
      
      // 尝试点击第一个 Select（传感器选择器）
      if (selectCount > 0) {
        await win.locator('.ant-select').first().click();
        await win.waitForTimeout(500);
        const allOpts = await win.evaluate(() => {
          const items = document.querySelectorAll('.ant-select-item-option-content');
          return Array.from(items).map(i => i.textContent);
        });
        console.log('[INFO] First select options:', JSON.stringify(allOpts));
        await win.screenshot({ path: '/tmp/skin_s2_first_dropdown.png' });
        
        // 点击触觉手套
        const handIdx = allOpts.findIndex(t => t.includes('触觉手套'));
        if (handIdx >= 0) {
          console.log('[INFO] Clicking 触觉手套');
          await win.locator('.ant-select-item-option-content').nth(handIdx).click();
          await win.waitForTimeout(3000);
          await win.screenshot({ path: '/tmp/skin_s3_hand_selected.png' });
          
          // 现在查找 3D 选择器
          const newSelectCount = await win.locator('.ant-select').count();
          console.log('[INFO] New select count after hand:', newSelectCount);
          for (let i = 0; i < newSelectCount; i++) {
            const t = await win.locator('.ant-select-selection-item').nth(i).textContent().catch(() => '');
            console.log(`[INFO] New Select[${i}]: "${t}"`);
            if (t.includes('3D') || t.includes('遥操')) {
              await win.locator('.ant-select').nth(i).click();
              await win.waitForTimeout(500);
              const opts2 = await win.evaluate(() => {
                const items = document.querySelectorAll('.ant-select-item-option-content');
                return Array.from(items).map(i => i.textContent);
              });
              console.log('[INFO] 3D dropdown options:', JSON.stringify(opts2));
              const skinIdx = opts2.findIndex(t => t.includes('皮肤'));
              if (skinIdx >= 0) {
                await win.locator('.ant-select-item-option-content').nth(skinIdx).click();
                await win.waitForTimeout(5000);
                await win.screenshot({ path: '/tmp/skin_s4_skin_mode.png' });
                console.log('[OK] Skin mode screenshot after hand selection');
              }
              break;
            }
          }
        }
      }
    }

    // 检查 canvas 和 WebGL
    const canvasInfo = await win.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      return Array.from(canvases).map(c => ({
        id: c.id,
        width: c.width,
        height: c.height,
        visible: c.offsetParent !== null,
        parent: c.parentElement?.id || c.parentElement?.className?.substring(0, 50)
      }));
    });
    console.log('[INFO] Canvas elements:', JSON.stringify(canvasInfo));

    console.log('\n=== ERRORS ===');
    console.log('Total errors:', errors.length);
    errors.forEach((e, i) => console.log(`  [${i}]`, e.substring(0, 300)));

    await app.close();
    console.log('[DONE]');
  } catch(e) {
    console.error('[FATAL]', e.message);
    process.exit(1);
  }
})();
