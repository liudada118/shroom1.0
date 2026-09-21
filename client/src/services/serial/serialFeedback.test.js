import { describe, expect, it, vi } from 'vitest';
import { createSerialFeedback, serialErrorText } from './serialFeedback';

describe('串口异常提示', () => {
  it('HTTP 和广播只提示一次，新的手动连接允许重新提示', () => {
    const notify = { error: vi.fn() };
    const feedback = createSerialFeedback(notify);
    const error = { code: 'SERIAL_PORT_BUSY', message: '串口被占用', role: 'sit', path: 'COM3' };
    feedback.status({ role: 'sit', path: 'COM3', status: 'error', error });
    feedback.error(error);
    expect(notify.error).toHaveBeenCalledOnce();
    expect(notify.error.mock.calls[0][0].content).toContain('COM3');
    feedback.status({ role: 'sit', path: 'COM3', status: 'opening', retryAttempt: 0 });
    feedback.error(error);
    expect(notify.error).toHaveBeenCalledTimes(2);
  });

  it('后台重试不刷屏，耗尽时提示停止重连', () => {
    const notify = { error: vi.fn() };
    const feedback = createSerialFeedback(notify);
    const status = { role: 'armLeft', path: 'COM4', status: 'error', retryAttempt: 1, reconnect: true,
      error: { code: 'SERIAL_OPEN_FAILED', message: '串口打开失败', stage: 'open' } };
    feedback.status(status);
    feedback.status({ ...status, retryAttempt: 2 });
    expect(notify.error).not.toHaveBeenCalled();
    feedback.status({ ...status, retryAttempt: 3, reconnect: false });
    expect(notify.error.mock.calls[0][0].content).toContain('自动重连已停止');
  });

  it('取消连接不提示错误，授权和网络错误有中文操作说明', () => {
    const notify = { error: vi.fn() };
    createSerialFeedback(notify).error({ code: 'SERIAL_CONNECT_CANCELLED' });
    expect(notify.error).not.toHaveBeenCalled();
    expect(serialErrorText({ code: 'LICENSE_REQUIRED' })).toContain('授权');
    expect(serialErrorText({ code: 'COMMAND_REQUEST_TIMEOUT' })).toContain('超时');
  });
});
