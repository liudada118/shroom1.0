const { _electron: electron } = require('playwright');
(async () => {
  try {
    const app = await electron.launch({
      args: ['.', '--no-sandbox'],
      cwd: '/home/ubuntu/shroom1.0',
      env: { ...process.env, DISPLAY: ':99' },
      timeout: 30000
    });
    const win = await app.firstWindow({ timeout: 30000 });
    console.log('Window opened');
    
    const errors = [];
    win.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    win.on('pageerror', err => errors.push('PAGE_ERROR: ' + err.message));
    
    await win.waitForTimeout(4000);
    await win.screenshot({ path: '/tmp/s1_initial.png' });
    console.log('Initial screenshot taken');
    
    // 找到 3D 模式选择器并切换到 skin
    const selectCount = await win.locator('.ant-select').count();
    console.log('Select count:', selectCount);
    
    // 列出所有 select 的文本
    for (let i = 0; i < selectCount; i++) {
      const t = await win.locator('.ant-select-selection-item').nth(i).textContent().catch(() => '');
      console.log('  Select ' + i + ': "' + t + '"');
    }
    
    // 找到包含 "3D" 的 select
    const items = await win.locator('.ant-select-selection-item').allTextContents();
    console.log('All select items:', items);
    
    let targetIdx = items.findIndex(t => t.includes('3D'));
    if (targetIdx >= 0) {
      console.log('Clicking select ' + targetIdx + ' with text "' + items[targetIdx] + '"');
      await win.locator('.ant-select').nth(targetIdx).click();
      await win.waitForTimeout(500);
      await win.screenshot({ path: '/tmp/s2_dropdown.png' });
      
      // 找到皮肤选项
      const options = await win.locator('.ant-select-item-option-content').allTextContents();
      console.log('Dropdown options:', options);
      
      const skinIdx = options.findIndex(t => t.includes('皮肤') || t.includes('skin'));
      if (skinIdx >= 0) {
        console.log('Clicking skin option: "' + options[skinIdx] + '"');
        await win.locator('.ant-select-item-option-content').nth(skinIdx).click();
        await win.waitForTimeout(3000);
        await win.screenshot({ path: '/tmp/s3_skin.png' });
      } else {
        console.log('No skin option found');
      }
    } else {
      console.log('No 3D select found');
    }
    
    console.log('Errors:', errors.length ? errors : 'none');
    await app.close();
    console.log('Done');
  } catch(e) {
    console.error('Fatal:', e.message);
    process.exit(1);
  }
})();
