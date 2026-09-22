import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Select } from 'antd';
import { PortalSessionBar } from '../../page/licensePortal/PortalMonitoringChrome';
import { registerRuntimeDisplayDefinition } from '../../displays/registry';
import HalowConnection from './HalowConnection';

vi.mock('../onestep/heatmap', () => ({ bthClickHandle: vi.fn() }));
vi.mock('../../i18n', () => ({ getLanguageLocale: () => 'zh-CN' }));
import TranslatedTitle from './Title';

const Title = TranslatedTitle.render({}, null).type.WrappedComponent;

/** 遍历真实 Title 的元素树，并包含 PortalSessionBar 的设备插槽。 */
function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree?.props) return [];
  return [tree, ...elements(tree.props.children), ...elements(tree.props.deviceControls)];
}

/** 用真实渲染方法校验入口和串口禁用条件，不启动图表与设备。 */
function createTitle(props = {}) {
  const title = new Title();
  title.props = {
    matrixName: 'humanBodyOptimized', history: 'now', colFlag: true,
    t: (key) => key, i18n: { language: 'zh' }, dataArr: [], port: [],
    changeStateData: vi.fn(), ...props,
  };
  return title;
}

describe('人体全身优化 HaLow 入口', () => {
  beforeEach(() => localStorage.clear());

  it.each([true, false])('portalEmbedded=%s 保留 HaLow 和串口两种连接入口', (portalEmbedded) => {
    const title = createTitle({ portalEmbedded, wsConnected: true, halowStatus: { running: false } });
    const tree = title.render();
    const entries = elements(tree);
    const halow = entries.filter((entry) => entry.type === HalowConnection);
    expect(halow).toHaveLength(1);
    expect(halow[0].props).toMatchObject({ connected: true, collecting: false, history: 'now' });
    expect(entries.some((entry) => entry.type === Select && entry.props['aria-label'] === 'chooseSensor')).toBe(true);
    if (portalEmbedded) {
      const session = entries.find((entry) => entry.type === PortalSessionBar);
      expect(elements(session.props.deviceControls).some((entry) => entry.type === HalowConnection)).toBe(true);
    }
  });

  it('原生副本用当前系统 ID 挂载连接器，状态更新不改副本身份', () => {
    const id = 'halow-test-copy';
    registerRuntimeDisplayDefinition({ builtinTemplate: { id, name: '人体副本', sourceType: 'humanBodyOptimized' },
      sensorDefinition: { type: id }, displayMetadata: { name: '人体副本' } });
    const title = createTitle({ systemId: id, portalEmbedded: true });
    const halow = elements(title.render()).find((entry) => entry.type === HalowConnection);
    expect(halow.key).toBe(id);
    halow.props.onStatus({ running: true, selectedDeviceId: 'board-a' });
    expect(title.props.changeStateData).toHaveBeenCalledWith({ halowStatus: { running: true, selectedDeviceId: 'board-a' } });
    expect(title.props.systemId).toBe(id);
  });

  it.each([
    [true, false, true],
    [false, true, true],
    [false, false, false],
  ])('HaLow运行=%s 串口等待=%s 时串口禁用=%s', (running, serialPending, disabled) => {
    const title = createTitle({ halowStatus: { running }, portalEmbedded: true });
    title.state.serialPending = { sit: serialPending };
    const serial = elements(title.render()).find((entry) => entry.type === Select && entry.props['aria-label'] === 'chooseSensor');
    expect(serial.props.disabled).toBe(disabled);
  });

  it('其他系统不暴露人体接收入口', () => {
    const title = createTitle({ matrixName: 'hand', portalEmbedded: true });
    expect(elements(title.render()).some((entry) => entry.type === HalowConnection)).toBe(false);
  });
});
