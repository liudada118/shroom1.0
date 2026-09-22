import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal } from 'antd';
import { commandClient } from '../../services/command/commandClient';

// 报告热图在模块加载时创建 Canvas；本测试只验证 Title 的真实业务方法，不加载绘图环境。
vi.mock('../onestep/heatmap', () => ({ bthClickHandle: vi.fn() }));
vi.mock('../../i18n', () => ({ getLanguageLocale: () => 'zh-CN' }));

import TranslatedTitle from './Title';

// withRef 在翻译 HOC 外多包了一层 forwardRef；只展开这层纯 createElement，取实际类组件。
const Title = TranslatedTitle.render({}, null).type.WrappedComponent;

/** 为实际类组件提供同步 setState 与轻量 props，不复制受测方法的实现。 */
function createTitle(state = {}) {
  const title = new Title();
  title.props = {
    matrixName: 'hand', history: 'playback',
    dataArr: [{ value: 'record-a' }, { value: 'record-b' }],
    changeStateData: vi.fn(), onPortalResetPlayback: vi.fn(), onPortalPlaybackStarted: vi.fn(),
    t: (key) => key,
  };
  title.state = { ...title.state, ...state };
  title.setState = vi.fn((update) => {
    const next = typeof update === 'function' ? update(title.state, title.props) : update;
    title.state = { ...title.state, ...next };
  });
  return title;
}

/** 让暂停命令停在真实 await 边界，模拟确认期间页面离开。 */
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

describe('Title 门户操作生命周期', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('window', { removeEventListener: vi.fn() });
    vi.spyOn(Modal, 'confirm').mockImplementation(() => ({ destroy: vi.fn() }));
    vi.spyOn(commandClient, 'execute').mockResolvedValue({ ok: true });
    vi.spyOn(commandClient, 'executeEnvelope').mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('载入完成后请求首帧并播放，播放 ACK 前不关闭弹窗或显示播放中', async () => {
    const title = createTitle({ portalPlaybackOpen: true });
    const start = deferred();
    commandClient.execute.mockResolvedValueOnce({ ok: true }).mockReturnValueOnce(start.promise);
    const pending = title.loadPortalPlayback('record-a');
    await vi.waitFor(() => expect(commandClient.execute).toHaveBeenCalledWith('playback.control', { value: 0, play: true }));
    expect(commandClient.executeEnvelope.mock.calls.map(([cmd]) => cmd.type)).toEqual(['history.load']);
    expect(title.props.changeStateData).toHaveBeenCalledWith(expect.objectContaining({ dataTime: 'record-a', local: true }));
    expect(title.props.onPortalResetPlayback).toHaveBeenCalledOnce();
    expect(title.props.onPortalPlaybackStarted).not.toHaveBeenCalled();
    expect(title.state.portalPlaybackOpen).toBe(true);
    start.resolve({ ok: true });
    await pending;
    expect(title.props.onPortalPlaybackStarted).toHaveBeenCalledOnce();
    expect(title.state).toMatchObject({ portalPlaybackOpen: false, portalBusy: false, dataTime: 'record-a' });
  });

  it.each(['load', 'start'])('%s 命令失败保留弹窗和错误，不显示播放中', async (stage) => {
    const title = createTitle({ portalPlaybackOpen: true });
    if (stage === 'load') commandClient.executeEnvelope.mockRejectedValueOnce(new Error('读取失败'));
    else commandClient.execute.mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error('启动失败'));
    await title.loadPortalPlayback('record-a');
    expect(title.state).toMatchObject({ portalPlaybackOpen: true, portalBusy: false });
    expect(title.state.portalError).toContain('失败');
    expect(title.props.onPortalPlaybackStarted).not.toHaveBeenCalled();
    if (stage === 'load') expect(commandClient.execute).toHaveBeenCalledTimes(1);
  });

  it.each([['sit', true], ['back', false]])('单手记录 %s 在请求首帧前切到对应模型', async (channel, hand) => {
    const title = createTitle();
    title.props = { ...title.props, matrixName: 'hand0205', com: { current: { changeModal: vi.fn() } } };
    commandClient.executeEnvelope.mockResolvedValueOnce({ ok: true, data: { results: [
      { name: 'history-load-date', length: 428, availableChannels: [channel] },
    ] } });
    await title.loadPortalPlayback('record-a');
    expect(title.props.changeStateData).toHaveBeenCalledWith(expect.objectContaining({ hand }));
    expect(title.props.com.current.changeModal).toHaveBeenCalledWith(hand);
    expect(title.props.com.current.changeModal.mock.invocationCallOrder[0]).toBeLessThan(commandClient.execute.mock.invocationCallOrder[1]);
  });

  it('载入等待期间切换系统，迟到 ACK 不能启动旧记录', async () => {
    const title = createTitle();
    const load = deferred();
    commandClient.executeEnvelope.mockReturnValueOnce(load.promise);
    const pending = title.loadPortalPlayback('record-a');
    await vi.waitFor(() => expect(commandClient.executeEnvelope).toHaveBeenCalledOnce());
    title._portalScope = {};
    load.resolve({ ok: true });
    await pending;
    expect(commandClient.execute).toHaveBeenCalledTimes(1);
    expect(title.props.changeStateData).not.toHaveBeenCalled();
    expect(title.props.onPortalPlaybackStarted).not.toHaveBeenCalled();
  });

  it.each(['scope', 'unmount'])('删除等待暂停 ACK 期间 %s 失效，不能继续发删除命令', async (reason) => {
    const title = createTitle({ dataTime: 'record-a' });
    const pause = deferred();
    commandClient.execute.mockReturnValueOnce(pause.promise);
    title.deletePortalHistory('record-a');
    expect(Modal.confirm).toHaveBeenCalledOnce();
    expect(commandClient.execute).not.toHaveBeenCalled();
    const onOk = Modal.confirm.mock.lastCall[0].onOk;
    const pending = onOk();
    expect(commandClient.execute).toHaveBeenCalledWith('playback.control', { play: false });
    if (reason === 'scope') title._portalScope = {};
    else title.componentWillUnmount();
    pause.resolve({ ok: true });
    await pending;
    expect(commandClient.execute).toHaveBeenCalledTimes(1);
    expect(commandClient.executeEnvelope).not.toHaveBeenCalled();
    expect(title.props.onPortalResetPlayback).not.toHaveBeenCalled();
    expect(title.props.changeStateData).not.toHaveBeenCalled();
  });

  it('删除未载入记录只更新列表选择，不暂停或重置正在播放的记录', async () => {
    const title = createTitle({ dataTime: 'record-a', portalPlaybackValue: 'record-b',
      portalDownloadValues: ['record-a', 'record-b'] });
    title.deletePortalHistory('record-b');
    await Modal.confirm.mock.lastCall[0].onOk();
    expect(commandClient.execute.mock.calls).toEqual([['history.delete', { date: 'record-b' }]]);
    expect(commandClient.executeEnvelope).toHaveBeenCalledWith(expect.objectContaining({
      type: 'history.mode', payload: { local: true, history: false },
    }));
    expect(title.state.dataTime).toBe('record-a');
    expect(title.state.portalDownloadValues).toEqual(['record-a']);
    expect(title.state.portalBusy).toBe(false);
    expect(title.props.onPortalResetPlayback).not.toHaveBeenCalled();
    expect(title.props.changeStateData).not.toHaveBeenCalled();
  });

  it('换系统终止旧导出会话并清 exporting，迟到的 CSV 进度或终态不会重开弹窗', () => {
    const title = createTitle({ csvDownloadStage: 'exporting', csvDownloadModalOpen: true,
      csvBatchDates: ['record-a'], csvBatchCompleted: 1, portalBusy: true });
    title._csvActive = true;
    title._csvStarting = true;
    const previousScope = title._portalScope;
    const batch = { dispose: vi.fn(), handleStatus: vi.fn() };
    title._csvBatch = batch;
    const previousProps = title.props;
    title.props = { ...title.props, matrixName: 'foot' };
    title.componentDidUpdate(previousProps);
    expect(batch.dispose).toHaveBeenCalledOnce();
    expect(title._csvBatch).toBeNull();
    expect(title._portalScope).not.toBe(previousScope);
    expect(title._csvActive).toBe(false);
    expect(title._csvStarting).toBe(false);
    expect(title.state).toMatchObject({ csvDownloadStage: 'config', csvDownloadModalOpen: false,
      portalBusy: false, csvBatchDates: [], csvBatchCompleted: 0 });
    const apply = vi.spyOn(title, 'applyCsvDownloadStatus');
    title.handleCsvDownloadStatus({ detail: { csvDownloadProgress: { percent: 99 } } });
    title.handleCsvDownloadStatus({ detail: { download: 'export csv success', downloadFiles: ['old.csv'] } });
    expect(apply).not.toHaveBeenCalled();
    expect(title.state.csvDownloadModalOpen).toBe(false);
    expect(title.state.csvDownloadStage).toBe('config');
  });
});
