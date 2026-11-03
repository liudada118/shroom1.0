import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { message } from 'antd';
import { commandClient } from '../../services/command/commandClient';
import { serialFeedback } from '../../services/serial/serialFeedback';
import { detectSerialConnection, waitForSerialConnectionData } from '../../services/serial/serialConnectionDetection';
vi.mock('../../services/serial/serialConnectionDetection', async (importOriginal) => ({
  ...await importOriginal(), detectSerialConnection: vi.fn(), waitForSerialConnectionData: vi.fn(),
}));
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
  title.loadDynamicSensors = vi.fn();
  return title;
}

describe('Title 串口连接结果', () => {
  beforeEach(() => {
    detectSerialConnection.mockReset().mockResolvedValue({ status: 'unsupported' });
    waitForSerialConnectionData.mockReset().mockResolvedValue('ready');
    let connectionId = 0;
    vi.spyOn(commandClient, 'execute').mockImplementation(async (type, payload) => ({ ok: true, data: {
      serial: type === 'serial.open' ? [{ ...payload, connectionId: ++connectionId, isOpen: true, status: 'open', updatedAt: Date.now() }] : [],
    } }));
    vi.spyOn(serialFeedback, 'error').mockImplementation(() => {});
    vi.spyOn(message, 'info').mockImplementation(() => {});
    vi.spyOn(message, 'warning').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('普通通道在真实 ACK 前不选中串口，重复点击只发一次请求', async () => {
    let resolve;
    commandClient.execute.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const title = createTitle();
    const pending = title.connectSerialChannel('sit', 'COM3');
    await Promise.resolve();
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
    await Promise.resolve();
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

  it('先默认打开，收到有效数据后持续读取，不发任何探测请求', async () => {
    const title = createTitle(); title.props.matrixName = 'fast256';
    expect(await title.connectSerialChannel('sit', 'COM3')).toBe(true);
    expect(commandClient.execute).toHaveBeenCalledOnce();
    expect(commandClient.execute).toHaveBeenCalledWith('serial.open', { role: 'sit', path: 'COM3' });
    expect(waitForSerialConnectionData).toHaveBeenCalledWith(expect.objectContaining({ role: 'sit', path: 'COM3', connectionId: 1, systemId: 'fast256' }));
    expect(detectSerialConnection).not.toHaveBeenCalled();
  });

  it('默认值来自当前系统，旧系统和已关闭连接不能覆盖输入', async () => {
    const title = createTitle(); title.props.matrixName = 'bed4096';
    title.applySerialDefaults({ systemId: 'bed4096', sensorType: 'bed4096', baudRate: 3000000 });
    title.applySerialDefaults({ systemId: 'fast256', sensorType: 'fast256', baudRate: 921600 });
    title.applySerialStatus({ role: 'sit', path: 'COM1', status: 'closed', baudRate: 1000000 });
    expect(title.state.serialDefaults.baudRate).toBe(3000000);
    await title.connectSerialChannel('sit', 'COM3');
    expect(commandClient.execute).toHaveBeenCalledWith('serial.open', { role: 'sit', path: 'COM3' });
  });

  it('旧宿主没有defaults也预填默认数字，只有手动修改才覆盖连接参数', async () => {
    const title = createTitle(); title.props.matrixName = 'bed4096';
    title.applySerialDefaults(undefined);
    expect(title.getSerialDefaultBaudRate()).toBe(3000000);
    await title.connectSerialChannel('sit', 'COM3');
    expect(commandClient.execute).toHaveBeenCalledWith('serial.open', { role: 'sit', path: 'COM3' });
    title.applySerialDefaults({ systemId: 'bed4096', baudRate: 6000000 });
    expect(title.getSerialDefaultBaudRate()).toBe(6000000);
    title.state.serialBaudRate = '';
    title.commitSerialBaudRate();
    expect(title.state.serialBaudRate).toBe('6000000');
  });

  it('编辑不发送命令，下一次连接才使用该波特率；同一端口改值后允许重连', async () => {
    const title = createTitle();
    title.applySerialStatus({ role: 'sit', path: 'COM3', isOpen: true, status: 'open', baudRate: 921600 });
    title.state.serialBaudRate = '1500000';
    title.commitSerialBaudRate();
    expect(commandClient.execute).not.toHaveBeenCalled();
    await title.connectSerialChannel('sit', 'COM3');
    expect(commandClient.execute).toHaveBeenCalledWith('serial.open', { role: 'sit', path: 'COM3', baudRate: 1500000 });
    expect(detectSerialConnection).not.toHaveBeenCalled();
  });

  it.each(['', 'abc', '1234', '0', '1e6'])('非法编辑值 %s 不发送串口打开命令', async (value) => {
    const title = createTitle(); title.state.serialBaudRate = value;
    expect(await title.connectSerialChannel('sit', 'COM3')).toBe(false);
    expect(commandClient.execute).not.toHaveBeenCalled();
  });

  it('清空后恢复默认并保留旧115200设备；切系统清除手动值并刷新默认', () => {
    const title = createTitle(); title.props.matrixName = 'handGlove115200';
    title.applySerialDefaults({ systemId: 'handGlove115200', baudRate: 115200 });
    title.state.serialBaudRate = '';
    title.commitSerialBaudRate();
    expect(title.state.serialBaudRate).toBe('115200');
    expect(title.isSerialBaudRateValid('115200')).toBe(true);
    const previous = title.props;
    title.props = { ...previous, matrixName: 'bed4096' };
    title.componentDidUpdate(previous, title.state);
    expect(title.state.serialDefaults).toBeNull();
    expect(title.state.serialBaudRate).toBeNull();
    expect(title.loadDynamicSensors).toHaveBeenCalledOnce();
    title.applySerialDefaults({ systemId: 'bed4096', baudRate: 3000000 });
    expect(title.state.serialDefaults.baudRate).toBe(3000000);
    expect(title.isSerialBaudRateValid('115200')).toBe(false);
  });

  it('原生副本使用独立身份的默认；manifest连接继续使用自己的通道配置', async () => {
    const title = createTitle(); title.props.systemId = 'copy-bed'; title.props.matrixName = 'bed4096';
    title.applySerialDefaults({ systemId: 'copy-bed', sensorType: 'bed4096', baudRate: 3000000 });
    expect(title.state.serialDefaults.baudRate).toBe(3000000);
    title.state.serialBaudRate = '1500000';
    await title.openManifestSerialChannel({ serialRole: 'armLeft', baudRate: 115200 }, 'COM4');
    expect(commandClient.execute).toHaveBeenCalledWith('serial.open', { role: 'armLeft', path: 'COM4', baudRate: 115200 });
  });

  it('默认没有有效数据才探测，识别成功后正式重开并核对新连接的数据', async () => {
    waitForSerialConnectionData.mockResolvedValueOnce('no-data');
    detectSerialConnection.mockResolvedValue({ status: 'matched', defaultBaudRate: 921600, compatible: true,
      match: { id: 'glove-segmented', protocol: { baudRate: 921600 } } });
    const title = createTitle();
    title.props.matrixName = 'fast256';
    expect(await title.connectSerialChannel('sit', 'COM3')).toBe(true);
    expect(detectSerialConnection).toHaveBeenCalledWith({ path: 'COM3', sensorType: 'fast256', role: 'sit', connectionId: 1, signal: expect.any(AbortSignal) });
    expect(commandClient.execute.mock.calls[0]).toEqual(['serial.open', { role: 'sit', path: 'COM3' }]);
    expect(commandClient.execute).toHaveBeenCalledWith('serial.open', { role: 'sit', path: 'COM3', baudRate: 921600 });
    expect(waitForSerialConnectionData.mock.calls[1][0].connectionId).toBe(2);
    expect(title.state.serialDetectionDialog).toBeNull();
  });

  it('非默认波特率只在确认识别结果后连接', async () => {
    waitForSerialConnectionData.mockResolvedValueOnce('no-data');
    detectSerialConnection.mockResolvedValue({ status: 'matched', defaultBaudRate: 921600, compatible: true,
      match: { id: 'matrix-256', protocol: { baudRate: 1500000 } } });
    const title = createTitle();
    const pending = title.connectSerialChannel('sit', 'COM3');
    await vi.waitFor(() => expect(title.state.serialDetectionDialog).not.toBeNull());
    expect(commandClient.execute).toHaveBeenCalledOnce();
    expect(title.state.serialDetectionDialog.action).toBe('confirm');
    title.finishSerialDetectionDialog(true);
    expect(await pending).toBe(true);
    expect(commandClient.execute).toHaveBeenCalledWith('serial.open', { role: 'sit', path: 'COM3', baudRate: 1500000 });
  });

  it('识别结果弹窗使用已注册的取消翻译词条', () => {
    const title = createTitle();
    title.props.t = vi.fn(key => key);
    title.state.serialDetectionDialog = { result: { status: 'unknown' }, action: 'notice', path: 'COM3' };
    title.renderSerialDetectionDialog();
    expect(title.props.t).toHaveBeenCalledWith('common.cancel');
    expect(title.props.t).not.toHaveBeenCalledWith('cancel');
  });

  it.each([
    { status: 'unknown' },
    { status: 'ambiguous', candidates: [{ id: 'matrix-256' }, { id: 'glove-segmented' }] },
    { status: 'matched', compatible: false, match: { protocol: { baudRate: 921600 } } },
  ])('$status 在默认读取失败后只展示结果，不盲目重开', async (result) => {
    waitForSerialConnectionData.mockResolvedValueOnce('no-data');
    detectSerialConnection.mockResolvedValue(result);
    const title = createTitle();
    const pending = title.connectSerialChannel('sit', 'COM3');
    await vi.waitFor(() => expect(title.state.serialDetectionDialog).not.toBeNull());
    expect(title.state.serialDetectionDialog.action).toBe('notice');
    expect(commandClient.execute).toHaveBeenCalledOnce();
    title.finishSerialDetectionDialog(false);
    expect(await pending).toBe(false);
    expect(commandClient.execute).toHaveBeenCalledOnce();
  });

  it('取消结果确认后不连接，下一次用户选择才重新识别', async () => {
    waitForSerialConnectionData.mockResolvedValueOnce('no-data');
    detectSerialConnection.mockResolvedValue({ status: 'matched', defaultBaudRate: 921600, compatible: true,
      match: { protocol: { baudRate: 1000000 } } });
    const title = createTitle();
    const pending = title.connectSerialChannel('sit', 'COM3');
    await vi.waitFor(() => expect(title.state.serialDetectionDialog).not.toBeNull());
    title.finishSerialDetectionDialog(false);
    expect(await pending).toBe(false);
    expect(detectSerialConnection).toHaveBeenCalledOnce();
    expect(commandClient.execute).toHaveBeenCalledOnce();
    expect(title.state.serialPending.sit).toBe(false);
  });

  it('重复选择不并发识别，离开后忽略迟到结果', async () => {
    waitForSerialConnectionData.mockResolvedValueOnce('no-data');
    let resolve;
    detectSerialConnection.mockReturnValue(new Promise(done => { resolve = done; }));
    const title = createTitle();
    const pending = title.connectSerialChannel('sit', 'COM3');
    await title.connectSerialChannel('sit', 'COM3');
    await vi.waitFor(() => expect(detectSerialConnection).toHaveBeenCalledOnce());
    expect(detectSerialConnection).toHaveBeenCalledOnce();
    title.cancelSerialDetections();
    title._portalScope = {};
    expect(detectSerialConnection.mock.calls[0][0].signal.aborted).toBe(true);
    resolve({ status: 'matched', defaultBaudRate: 921600, compatible: true, match: { protocol: { baudRate: 921600 } } });
    expect(await pending).toBe(false);
    expect(commandClient.execute).toHaveBeenCalledOnce();
    expect(title.state.serialDetectionDialog).toBeNull();
  });

  it.each(['collecting', 'finalizing'])('%s 期间不探测或连接', async (phase) => {
    const title = createTitle();
    title.props.collectionSummary = { phase };
    expect(await title.connectSerialChannel('sit', 'COM3')).toBe(false);
    expect(detectSerialConnection).not.toHaveBeenCalled();
    expect(commandClient.execute).not.toHaveBeenCalled();
  });

  it('已打开的同一串口复用连接，不打开临时探测句柄', async () => {
    const title = createTitle();
    const changeModal = vi.fn();
    title.props.com = { current: { changeModal } };
    title.applySerialStatus({ role: 'sit', path: 'COM3', status: 'open', isOpen: true });
    expect(await title.connectSerialChannel('sit', 'COM3', { hand: true })).toBe(true);
    expect(changeModal).toHaveBeenCalledWith(true);
    expect(title.props.changeStateData).toHaveBeenCalledWith({ hand: true });
    expect(detectSerialConnection).not.toHaveBeenCalled();
    expect(commandClient.execute).not.toHaveBeenCalled();
  });

  it('manifest 保留声明参数且不进入原生协议识别', async () => {
    const title = createTitle();
    await title.openManifestSerialChannel({ serialRole: 'left', baudRate: 1500000 }, 'COM4');
    expect(detectSerialConnection).not.toHaveBeenCalled();
    expect(commandClient.execute).toHaveBeenCalledWith('serial.open', { role: 'left', path: 'COM4', baudRate: 1500000 });
  });

  it('识别中关闭串口会取消请求，迟到结果不能重新开口', async () => {
    waitForSerialConnectionData.mockResolvedValueOnce('no-data');
    let resolve;
    detectSerialConnection.mockReturnValue(new Promise(done => { resolve = done; }));
    const title = createTitle();
    const pending = title.connectSerialChannel('sit', 'COM3');
    await vi.waitFor(() => expect(detectSerialConnection).toHaveBeenCalledOnce());
    await title.closeManifestSerialChannels([{ serialRole: 'sit' }]);
    expect(detectSerialConnection.mock.calls[0][0].signal.aborted).toBe(true);
    resolve({ status: 'unsupported' });
    expect(await pending).toBe(false);
    expect(commandClient.execute.mock.calls.map(([type]) => type)).toEqual(['serial.open', 'serial.close']);
  });

  it.each([
    { history: 'playback' },
    { wsConnected: false },
    { licenseAccess: { canAcquire: false } },
    { systemId: 'another-system' },
  ])('页面来源或权限变化会取消待确认结果 %j', async (nextProps) => {
    waitForSerialConnectionData.mockResolvedValueOnce('no-data');
    detectSerialConnection.mockResolvedValue({ status: 'matched', defaultBaudRate: 921600, compatible: true,
      match: { protocol: { baudRate: 1500000 } } });
    const title = createTitle();
    title.props.wsConnected = true;
    const pending = title.connectSerialChannel('sit', 'COM3');
    await vi.waitFor(() => expect(title.state.serialDetectionDialog).not.toBeNull());
    const previousProps = title.props;
    title.props = { ...previousProps, ...nextProps };
    title.componentDidUpdate(previousProps, title.state);
    expect(await pending).toBe(false);
    expect(commandClient.execute).toHaveBeenCalledOnce();
    expect(title.state.serialDetectionDialog).toBeNull();
  });

  it.each(['unavailable', 'unsupported', 'ready'])('默认数据状态为 %s 时保留连接，不探测或关闭', async (status) => {
    waitForSerialConnectionData.mockResolvedValue(status);
    const title = createTitle();
    expect(await title.connectSerialChannel('sit', 'COM3')).toBe(true);
    expect(detectSerialConnection).not.toHaveBeenCalled();
    expect(commandClient.execute).toHaveBeenCalledOnce();
  });

  it('等待数据时已换连接，不识别新端口；宿主确认数据恢复也不重开', async () => {
    waitForSerialConnectionData.mockResolvedValueOnce('changed');
    const title = createTitle();
    expect(await title.connectSerialChannel('sit', 'COM3')).toBe(false);
    expect(detectSerialConnection).not.toHaveBeenCalled();
    title.state.serialStates = {};
    waitForSerialConnectionData.mockResolvedValueOnce('no-data');
    detectSerialConnection.mockResolvedValue({ status: 'reading' });
    expect(await title.connectSerialChannel('sit', 'COM3')).toBe(true);
    expect(commandClient.execute).toHaveBeenCalledTimes(2);
  });

  it('识别后正式连接仍没数据只提示一次，保持连接等待，不循环探测', async () => {
    waitForSerialConnectionData.mockResolvedValue('no-data');
    detectSerialConnection.mockResolvedValue({ status: 'matched', defaultBaudRate: 921600, compatible: true,
      match: { protocol: { baudRate: 921600 } } });
    const title = createTitle();
    expect(await title.connectSerialChannel('sit', 'COM3')).toBe(true);
    expect(detectSerialConnection).toHaveBeenCalledOnce();
    expect(commandClient.execute).toHaveBeenCalledTimes(2);
    expect(message.warning).toHaveBeenCalledWith('monitorUi.serialDetectionNoDataAfterConnect');
    expect(title.state.serialStates.sit.isOpen).toBe(true);
  });
});
