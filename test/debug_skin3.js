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
    await win.screenshot({ path: '/tmp/skin3_s1.png' });

    // 通过 width:90 样式精确定位 numMatrixFlag 选择器
    // 或者通过文本 "3D遥操" 定位
    const selectorInfo = await win.evaluate(() => {
      const selects = document.querySelectorAll('.ant-select');
      const info = [];
      for (let i = 0; i < selects.length; i++) {
        const s = selects[i];
        const item = s.querySelector('.ant-select-selection-item');
        const w = s.style.width || getComputedStyle(s).width;
        info.push({
          index: i,
          text: item ? item.textContent : '',
          width: w,
          className: s.className.substring(0, 80)
        });
      }
      return info;
    });
    console.log('[INFO] All selects:', JSON.stringify(selectorInfo, null, 2));

    // 找到 width=90px 的选择器（numMatrixFlag 选择器）
    let targetIdx = -1;
    for (const s of selectorInfo) {
      if (s.text === '3D遥操' || s.text === '3D皮肤' || s.text === '2D数据' || s.width === '90px') {
        targetIdx = s.index;
        console.log(`[INFO] Found numMatrixFlag selector at index ${targetIdx}: "${s.text}" (width: ${s.width})`);
        break;
      }
    }

    if (targetIdx === -1) {
      // 尝试通过最后一个 select 来定位（通常 numMatrixFlag 是最后几个 select 之一）
      console.log('[WARN] Could not find by text/width, trying by position');
      // 在 hand0205 模式下，Title 中的 Select 顺序是：
      // 传感器选择器, 左手串口, 右手串口, numMatrixFlag, 语言
      // 但有些可能被隐藏
      for (const s of selectorInfo) {
        if (['3D遥操', '3D皮肤', '2D数据', '3D数字', '原始数据'].includes(s.text)) {
          targetIdx = s.index;
          break;
        }
      }
    }

    if (targetIdx >= 0) {
      console.log(`[INFO] Clicking selector at index ${targetIdx}`);
      await win.locator('.ant-select').nth(targetIdx).click();
      await win.waitForTimeout(1000);
      await win.screenshot({ path: '/tmp/skin3_s2_dropdown.png' });

      const options = await win.evaluate(() => {
        const items = document.querySelectorAll('.ant-select-item-option-content');
        return Array.from(items).map(i => i.textContent);
      });
      console.log('[INFO] Options:', JSON.stringify(options));

      // 点击 3D皮肤
      const skinIdx = options.findIndex(t => t.includes('皮肤'));
      if (skinIdx >= 0) {
        console.log('[INFO] Clicking 3D皮肤 at option index', skinIdx);
        await win.locator('.ant-select-item-option-content').nth(skinIdx).click();
        await win.waitForTimeout(8000);
        await win.screenshot({ path: '/tmp/skin3_s3_skin.png' });
        console.log('[OK] 3D皮肤 mode screenshot saved');
      } else {
        console.log('[WARN] No 皮肤 option found');
      }
    } else {
      console.log('[ERROR] Cannot find numMatrixFlag selector');
    }

    // 检查 canvas
    const canvasInfo = await win.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      return Array.from(canvases).map(c => ({
        id: c.id,
        w: c.width, h: c.height,
        visible: c.offsetParent !== null,
        parent: c.parentElement?.id || c.parentElement?.className?.substring(0, 50)
      }));
    });
    console.log('[INFO] Canvas:', JSON.stringify(canvasInfo));

    console.log('\n=== ERRORS ===');
    errors.forEach((e, i) => console.log(`  [${i}]`, e.substring(0, 300)));
    console.log('Total errors:', errors.length);

    await app.close();
    console.log('[DONE]');
  } catch(e) {
    console.error('[FATAL]', e.message);
    process.exit(1);
  }
})();
