import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { message } from 'antd';
import { commandClient } from '../../services/command/commandClient';
import { serialFeedback } from '../../services/serial/serialFeedback';
vi.mock('../onestep/heatmap', () => ({ bthClickHandle: vi.fn() }));
vi.mock('../../i18n', () => ({ getLanguageLocale: () => 'zh-CN' }));
import TranslatedTitle from './Title';
const Title = TranslatedTitle.render({}, null).type.WrappedComponent;

/** 运行真实 Title 业务方法，只替换 React 调度和设备服务。 */
function createTitle() {
  const title = new Title();
  title.props = { matrixName: 'hand', history: 'now', changeStateData: vi.fn(), t: (key) => key };
  title.setState = (update) => {
    title.state = { ...title.state, ...(typeof update === 'function' ? update(title.state) : update) };
  };
  return title;
}

describe('Title 串口连接结果', () => {
  beforeEach(() => {
    vi.spyOn(commandClient, 'execute').mockResolvedValue({ ok: true });
    vi.spyOn(serialFeedback, 'error').mockImplementation(() => {});
    vi.spyOn(message, 'info').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('普通通道在真实 ACK 前不选中串口，重复点击只发一次请求', async () => {
    let resolve;
    commandClient.execute.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const title = createTitle();
    const pending = title.connectSerialChannel('sit', 'COM3');
    expect(title.getSerialSelectProps('sit').disabled).toBe(true);
    expect(title.props.changeStateData).not.toHaveBeenCalled();
    await title.connectSerialChannel('sit', 'COM3');
    expect(commandClient.execute).toHaveBeenCalledOnce();
    resolve({ ok: true, data: { serial: [{ role: 'sit', path: 'COM3', isOpen: true, status: 'open', updatedAt: 10 }] } });
    await pending;
    expect(title.props.changeStateData).toHaveBeenCalledWith({ portname: 'COM3' });
    expect(title.getSerialSelectProps('sit').disabled).toBe(false);
  });

  it('自定义通道失败展示错误并清空选择，允许重试', async () => {
    const error = Object.assign(new Error('串口被占用'), { code: 'SERIAL_PORT_BUSY' });
    commandClient.execute.mockRejectedValueOnce(error);
    const title = createTitle();
    await title.openManifestSerialChannel({ serialRole: 'armLeft', sensorLabel: '左臂' }, 'COM4');
    expect(serialFeedback.error).toHaveBeenCalledWith(error, { role: 'armLeft', path: 'COM4', label: '左臂' });
    expect(title.state.manifestPortSelections.armLeft).toBe('');
    expect(title.state.serialStates.armLeft.error.code).toBe('SERIAL_PORT_BUSY');
    expect(title.getSerialSelectProps('armLeft')).toMatchObject({ disabled: false, status: 'error' });
  });

  it('断连广播立即清空普通选择，迟到的旧快照不能恢复连接', () => {
    const title = createTitle();
    title.handleSerialStatus({ detail: { role: 'sit', path: 'COM3', isOpen: true, status: 'open', updatedAt: 10 } });
    title.handleSerialStatus({ detail: { role: 'sit', path: 'COM3', isOpen: false, status: 'closed', updatedAt: 20,
      error: { code: 'SERIAL_DISCONNECTED', message: '设备连接已断开' } } });
    title.applySerialStatus({ role: 'sit', path: 'COM3', isOpen: true, status: 'open', updatedAt: 10 });
    expect(title.props.changeStateData.mock.lastCall).toEqual([{ portname: '' }]);
    expect(title.state.serialStates.sit.status).toBe('closed');
  });

  it('切换系统后忽略旧连接 ACK', async () => {
    let resolve;
    commandClient.execute.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const title = createTitle();
    const pending = title.connectSerialChannel('sit', 'COM3');
    title._portalScope = {};
    resolve({ ok: true });
    await pending;
    expect(title.props.changeStateData).not.toHaveBeenCalled();
  });

  it('关闭失败不提前清空仍打开的端口选择', async () => {
    const title = createTitle();
    title.applySerialStatus({ role: 'sit', path: 'COM3', isOpen: true, status: 'open', updatedAt: 10 });
    title.props.changeStateData.mockClear();
    commandClient.execute.mockRejectedValueOnce(new Error('串口关闭失败'));
    await title.closeManifestSerialChannels([{ serialRole: 'sit' }]);
    expect(title.props.changeStateData).not.toHaveBeenCalled();
    expect(title.state.manifestPortSelections.sit).toBe('COM3');
    expect(serialFeedback.error).toHaveBeenCalledOnce();
  });
});
