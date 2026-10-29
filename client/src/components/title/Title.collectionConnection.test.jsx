import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { message } from 'antd';
import { commandClient } from '../../services/command/commandClient';
import { hasCollectionDevice, collectionStartBlock } from '../../services/collectionConnection';
import { getDisplayDefinition } from '../../displays/registry';
import { PortalSessionBar } from '../../page/licensePortal/PortalMonitoringChrome';
vi.mock('../onestep/heatmap', () => ({ bthClickHandle: vi.fn() }));
vi.mock('../../i18n', async load => ({ ...await load(), getLanguageLocale: () => 'zh-CN' }));
import TranslatedTitle from './Title';
const Title = TranslatedTitle.render({}, null).type.WrappedComponent;

/** 运行真实 Title 的采集入口，仅替换 React 调度和 HTTP 命令边界。 */
function createTitle(props = {}) {
  const title = new Title();
  title.props = { matrixName: 'hand', history: 'now', wsConnected: true, colFlag: true,
    collectionLocalFrameReady: true,
    t: key => key, i18n: { language: 'zh' }, dataArr: [], port: [], portalEmbedded: true,
    wsSendObj: vi.fn(), changeStateData: vi.fn(), setColValueFlag: vi.fn(), ...props };
  title.setState = patch => Object.assign(title.state, typeof patch === 'function' ? patch(title.state) : patch);
  return title;
}

/** 遍历真实渲染树以检查门户实际收到的采集限制。 */
function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree?.props) return [];
  return [tree, ...elements(tree.props.children)];
}

describe('采集连接前置条件与启动 ACK', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(message, 'warning').mockImplementation(() => {});
    vi.spyOn(commandClient, 'executeEnvelope').mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(['missing', 'opening', 'closed', 'error'])('%s 状态即使有旧端口名称也不能打开或确认采集', async status => {
    const title = createTitle({ portname: 'COM_OLD' });
    if (status !== 'missing') title.state.serialStates.sit = { status, isOpen: status === 'error' };
    title.openCollectionModal(); await title.startCollectionWithOptions();
    expect(title.state.collectionModalOpen).toBe(false);
    expect(commandClient.executeEnvelope).not.toHaveBeenCalled();
    expect(title.props.setColValueFlag).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith('monitorUi.collectionConnectFirst');
    const session = elements(title.render()).find(node => node.type === PortalSessionBar);
    expect(session.props.deviceReady).toBe(false);
  });

  it('只允许当前系统角色，多通道保持部分连接可采，支持右手和大床专用通道', () => {
    const open = { status: 'open', isOpen: true };
    const check = (id, serialStates) => hasCollectionDevice({ definition: getDisplayDefinition(id), serialStates, wsConnected: true });
    expect(check('hand', { back: open })).toBe(false);
    expect(check('handR', { back: open })).toBe(true);
    expect(check('bigBed', { head: open })).toBe(true);
    expect(check('hand0205Double', { back: open })).toBe(true);
    expect(hasCollectionDevice({ definition: { source: 'manifest', sensors: [{ sensorId: 'arm', serialRole: 'armLeft' }] },
      serialStates: { armLeft: open }, wsConnected: true })).toBe(true);
  });

  it('HaLow 仅监听或选中设备已掉线不能采集，当前设备真实连接可采', () => {
    const title = createTitle({ matrixName: 'humanBodyOptimized', halowStatus: { running: true, phase: 'listening', clients: [] } });
    expect(title.hasCollectionDevice()).toBe(false);
    title.props.halowStatus.selectedDeviceId = 'board';
    expect(title.hasCollectionDevice()).toBe(false);
    title.props.halowStatus.clients = [{ deviceId: 'board' }];
    expect(title.hasCollectionDevice()).toBe(true);
    title.props.matrixName = 'hand';
    expect(title.hasCollectionDevice()).toBe(false);
  });

  it('新宿主的实际帧就绪优先，其他系统或仅有旧显示帧不能绕过缺数据状态', () => {
    const input = { history: 'now', wsConnected: true, systemId: 'hand', deviceConnected: true, localFrameReady: true,
      sourceStatus: { systemId: 'hand', connected: true, ready: false, code: 'COLLECTION_DATA_NOT_READY' } };
    expect(collectionStartBlock(input)).toBe('monitorUi.collectionWaitingForData');
    expect(collectionStartBlock({ ...input, sourceStatus: { ...input.sourceStatus, systemId: 'other', ready: true } })).toBe('monitorUi.collectionWaitingForData');
    expect(collectionStartBlock({ ...input, sourceStatus: { ...input.sourceStatus, ready: true } })).toBeNull();
    expect(collectionStartBlock({ ...input, sourceStatus: null, localFrameReady: false })).toBe('monitorUi.collectionWaitingForData');
  });

  it('后台断连与回放均阻止启动，停止采集不受影响', async () => {
    const title = createTitle({ wsConnected: false, colFlag: false });
    title.state.serialStates.sit = { status: 'open', isOpen: true };
    await title.startCollectionWithOptions();
    expect(commandClient.executeEnvelope).not.toHaveBeenCalled();
    title.stopCollection();
    expect(title.props.wsSendObj).toHaveBeenCalledWith(expect.objectContaining({ flag: false }));
    title.props.wsConnected = true; title.props.history = 'playback';
    await title.startCollectionWithOptions();
    expect(message.warning).toHaveBeenLastCalledWith('monitorUi.collectionExitPlayback');
  });

  it('开始等待成功 ACK，重复点击不重发；拒绝时弹窗保留且不启动秒表', async () => {
    const title = createTitle(); title.state.serialStates.sit = { status: 'open', isOpen: true };
    title.openCollectionModal();
    let reject;
    commandClient.executeEnvelope.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    const pending = title.startCollectionWithOptions();
    await title.startCollectionWithOptions();
    expect(commandClient.executeEnvelope).toHaveBeenCalledOnce();
    expect(title.props.setColValueFlag).not.toHaveBeenCalled();
    reject(new Error('请先连接传感器，再开始采集。')); await pending;
    expect(title.state).toMatchObject({ collectionModalOpen: true, collectionStarting: false });
    expect(title.props.changeStateData).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenLastCalledWith('monitorUi.collectionConnectFirst');
    await title.startCollectionWithOptions();
    expect(title.props.setColValueFlag).toHaveBeenCalledWith(true);
    expect(title.state.collectionModalOpen).toBe(false);
  });

  it.each(['unmount', 'disconnect', 'close', 'switch'])('%s 后迟到成功 ACK 不启动计时', async action => {
    const title = createTitle(); title.state.serialStates.sit = { status: 'open', isOpen: true };
    title.openCollectionModal(); let resolve;
    commandClient.executeEnvelope.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const pending = title.startCollectionWithOptions();
    if (action === 'unmount') title._portalUnmounted = true;
    if (action === 'disconnect') title.state.serialStates.sit = { status: 'closed', isOpen: false };
    if (action === 'close') title.closeCollectionModal();
    if (action === 'switch') title.props.systemId = 'another-system';
    resolve({ ok: true }); await pending;
    expect(title.props.setColValueFlag).not.toHaveBeenCalled();
    expect(title.props.changeStateData).not.toHaveBeenCalled();
  });
});
