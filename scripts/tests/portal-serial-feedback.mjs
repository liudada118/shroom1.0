import assert from 'node:assert/strict';
import { join } from 'node:path';

/** 用合成 HTTP/WS 结果验证真实 Home/Title 的失败、恢复与窄屏提示。 */
export async function verifyPortalSerialFeedback({ page, sockets, screenshots }) {
  const device = page.getByRole('group', { name: '连接设备', exact: true });
  const statusLine = page.locator('.serial-connection-status:visible');
  const url = 'http://127.0.0.1:19245/api/commands';
  let mode = 'failure';
  let releaseOpen;
  let revision = 1000;
  /** 模拟单通道状态广播，不发送或记录任何真实硬件数据。 */
  function publish(status, error = null) {
    const value = { role: 'sit', path: 'COM_TEST_2', connectionId: 100, updatedAt: Date.now(),
      revision: ++revision, status, isOpen: status === 'open', error, reconnect: false };
    for (const peer of sockets) peer.send(JSON.stringify({ serialStatus: value }));
    return value;
  }
  /** 仅接管串口命令，其他请求继续使用现有隔离夹具。 */
  const routeSerial = async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const command = route.request().postDataJSON();
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (command.type === 'serial.open') {
      publish('opening');
      if (mode === 'failure') {
        const error = { code: 'SERIAL_PORT_BUSY', message: '串口被占用，请关闭其他程序后重试', role: 'sit', path: 'COM_TEST_2', stage: 'open' };
        publish('error', error);
        return route.fulfill({ status: 409, headers, json: { code: 1, data: { ok: false, ...error, data: error } } });
      }
      await new Promise((resolve) => { releaseOpen = resolve; });
      const status = publish('open');
      return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { serial: [status] } } } });
    }
    if (command.type === 'serial.close') {
      const status = publish('closed');
      return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { serial: [status] } } } });
    }
    return route.fallback();
  };
  await page.route(url, routeSerial);
  try {
    await device.locator('.ant-select-selector').click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').getByText('COM_TEST_2', { exact: true }).click();
    await statusLine.filter({ hasText: '串口被占用' }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.portal-device-port-fields .ant-select-selection-item'));
    const errorToast = page.locator('.ant-message-error').filter({ hasText: '串口被占用' });
    await errorToast.first().waitFor();
    assert.equal(await errorToast.count(), 1, 'HTTP 和 WS 同一故障只显示一个提示');
    await page.screenshot({ path: join(screenshots, 'serial-open-failed.png') });
    await page.setViewportSize({ width: 375, height: 812 });
    const box = await statusLine.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 376, '长错误文案在窄屏内换行');
    await page.screenshot({ path: join(screenshots, 'serial-error-narrow.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    mode = 'success';
    await device.locator('.ant-select-selector').click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').getByText('COM_TEST_2', { exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.portal-device-port-fields .ant-select-loading'));
    assert.equal(await device.getByRole('combobox').isDisabled(), true, '连接中禁止重复选择');
    releaseOpen();
    await device.locator('.ant-select-selection-item').filter({ hasText: 'COM_TEST_2' }).waitFor();
    publish('open', { code: 'SERIAL_NO_DATA', message: '串口已打开，但未收到数据，请检查设备是否开始发送', role: 'sit', path: 'COM_TEST_2', stage: 'data' });
    await statusLine.filter({ hasText: '未收到数据' }).waitFor();
    assert.equal(await device.locator('.ant-select-selection-item').count(), 1, '无数据告警不能冒充物理断开');
    publish('closed', { code: 'SERIAL_DISCONNECTED', message: '设备连接已断开，请检查 USB 连接', role: 'sit', path: 'COM_TEST_2', stage: 'runtime' });
    await statusLine.filter({ hasText: '设备连接已断开' }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.portal-device-port-fields .ant-select-selection-item'));
    await device.getByRole('button').click();
    await page.locator('.serial-connection-status').waitFor({ state: 'hidden' });
    // 恢复连接供后续采集/工作区回归继续使用。
    publish('open');
    await device.locator('.ant-select-selection-item').filter({ hasText: 'COM_TEST_2' }).waitFor();
    console.log('PORTAL_SERIAL_FEEDBACK_PASS');
  } finally {
    releaseOpen?.();
    await page.unroute(url, routeSerial);
  }
}
