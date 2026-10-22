import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Button, Modal, Select } from 'antd';
import { PortalDisplayPanel, PortalQuickTools } from '../../page/licensePortal/PortalMonitoringChrome';
import PortalControlDialog from '../../page/licensePortal/PortalControlDialog';

vi.mock('../onestep/heatmap', () => ({ bthClickHandle: vi.fn() }));
vi.mock('../../i18n', () => ({ getLanguageLocale: () => 'zh-CN' }));
import TranslatedTitle from './Title';

const Title = TranslatedTitle.render({}, null).type.WrappedComponent;

/** 遍历真实渲染树和 Portal 插槽，保留控件与所属面板的关系。 */
function entries(node) {
  if (Array.isArray(node)) return node.flatMap(entries);
  if (!node || typeof node !== 'object') return [];
  if (!node.props) return entries(node.children);
  return [node, ...entries(node.props.children), ...entries(node.props.languageControl), ...entries(node.props.deviceControls)];
}

/** 构建同步更新状态的标题栏实例，直接执行真实控件事件。 */
function createTitle(props = {}) {
  const title = new Title();
  title.props = {
    matrixName: 'hand0205', history: 'now', numMatrixFlag: 'normal', colFlag: true,
    hand: true, calibration: false, t: (key) => key,
    i18n: { language: 'zh', changeLanguage: vi.fn() }, port: [], dataArr: [],
    changeStateData: vi.fn(), changeCalibration: vi.fn(), colFingerData: vi.fn(),
    com: { current: { changeModal: vi.fn(), calibration: vi.fn(), calibrationRight: vi.fn(), handZero: vi.fn() } },
    portalEmbedded: true, portalToolsHost: { nodeType: 1 }, ...props,
  };
  title.setState = vi.fn((update) => {
    const next = typeof update === 'function' ? update(title.state, title.props) : update;
    title.state = { ...title.state, ...next };
  });
  return title;
}

/** 只读取显示面板，避免把其他弹窗里的同名控件误当成入口。 */
function displayEntries(title) {
  const panel = entries(title.render()).find((node) => node.type === PortalDisplayPanel);
  return entries(panel);
}

/** 用翻译键查找实际按钮，不依赖组件内部变量。 */
function button(nodes, label) {
  return nodes.find((node) => node.type === Button && node.props.children === label);
}

/** 用可访问名称查找实际选择器。 */
function select(nodes, label) {
  return nodes.find((node) => node.type === Select && node.props['aria-label'] === label);
}

describe('触觉手套显示面板的校准与左右手控制', () => {
  beforeEach(() => localStorage.clear());

  it.each(['hand0205', 'hand0205Double', 'handGlove115200', 'handGloveFullPacket'])('%s 可选择两个新增手套展示模式', (matrixName) => {
    const title = createTitle({ matrixName });
    const display = select(displayEntries(title), '显示方式');
    expect(display.props.options).toContainEqual({ value: 'gloveMotion', label: 'gloveMotion' });
    expect(display.props.options).toContainEqual({ value: 'gloveTerrain', label: 'gloveTerrain' });
  });

  it('快捷工具收起时同步收回显示面板，展开后仍可切手并校准', () => {
    const title = createTitle();
    title.state.portalToolsCollapsed = true;
    const tree = entries(title.render());
    expect(tree.find((node) => node.type === PortalQuickTools).props.collapsed).toBe(true);
    expect(tree.find((node) => node.type === PortalDisplayPanel).props.collapsed).toBe(true);
    tree.find((node) => node.type === PortalQuickTools).props.onCollapse(false);
    expect(entries(title.render()).find((node) => node.type === PortalDisplayPanel).props.collapsed).toBe(false);
    const panel = displayEntries(title);
    const hand = select(panel, 'displayHand');
    expect(hand.props.value).toBe(true);
    hand.props.onChange(false);
    expect(title.props.changeStateData).toHaveBeenCalledWith({ hand: false });
    expect(title.props.com.current.changeModal).toHaveBeenCalledWith(false);

    title.props = { ...title.props, hand: false };
    const calibration = button(displayEntries(title), 'calib');
    expect(calibration.props.disabled).toBe(false);
    calibration.props.onClick();
    expect(title.props.changeCalibration).toHaveBeenCalledOnce();
    expect(title.props.com.current.handZero).toHaveBeenCalledOnce();
    expect(title.state.calibHand).toBe('right');
    expect(select(displayEntries(title), 'calibrationHand').props.value).toBe('right');
  });

  it('单手校准同步模型方向，按当前手和姿态采集并可关闭弹窗', () => {
    const title = createTitle({ calibration: true });
    const modal = displayEntries(title).find((node) => node.type === Modal && node.props.className === 'calibModal');
    expect(modal.props.open).toBe(true);
    select(entries(modal), 'calibrationHand').props.onChange('right');
    expect(title.props.changeStateData).toHaveBeenCalledWith({ hand: false });
    expect(title.props.com.current.changeModal).toHaveBeenCalledWith(false);
    title.props = { ...title.props, hand: false };
    select(displayEntries(title), 'calibrationPose').props.onChange(1);
    expect(title.props.com.current.calibration).toHaveBeenCalledWith([1, 1, 1, 1, 1]);
    expect(title.props.com.current.calibrationRight).not.toHaveBeenCalled();
    button(displayEntries(title), 'colData').props.onClick();
    expect(title.props.colFingerData).toHaveBeenCalledWith(1, 'right');
    select(displayEntries(title), 'calibrationPose').props.onChange(0);
    expect(title.props.com.current.calibration).toHaveBeenLastCalledWith([0, 0, 0, 0, 0]);

    modal.props.onOk();
    modal.props.onCancel();
    expect(title.props.changeStateData).toHaveBeenLastCalledWith({ calibration: false });
  });

  it.each(['hand0205Double', 'handGlove115200'])('%s 校准右手时预览和采集均使用右手', (matrixName) => {
    const title = createTitle({ matrixName, calibration: true });
    expect(select(displayEntries(title), 'displayHand')).toBeUndefined();
    select(displayEntries(title), 'calibrationHand').props.onChange('right');
    expect(title.props.com.current.changeModal).not.toHaveBeenCalled();
    select(displayEntries(title), 'calibrationPose').props.onChange(1);
    expect(title.props.com.current.calibrationRight).toHaveBeenCalledWith([1, 1, 1, 1, 1]);
    expect(title.props.com.current.calibration).not.toHaveBeenCalled();
    button(displayEntries(title), 'colData').props.onClick();
    expect(title.props.colFingerData).toHaveBeenCalledWith(1, 'right');

    select(displayEntries(title), 'calibrationHand').props.onChange('left');
    select(displayEntries(title), 'calibrationPose').props.onChange(0);
    expect(title.props.com.current.calibration).toHaveBeenCalledWith([0, 0, 0, 0, 0]);
    button(displayEntries(title), 'colData').props.onClick();
    expect(title.props.colFingerData).toHaveBeenLastCalledWith(0, 'left');
  });

  it.each([true, false])('炫酷摇操单手校准跟随显示手 %s，关闭时解除预览', (hand) => {
    const title = createTitle({ numMatrixFlag: 'gloveMotion', hand });
    const setCalibration = vi.fn();
    title.props.com.current.setCalibration = setCalibration;
    const side = hand ? 'left' : 'right';
    const open = button(displayEntries(title), 'calib');
    expect(open.props.disabled).toBe(false);
    open.props.onClick();
    expect(setCalibration).toHaveBeenLastCalledWith({ active: true, side, pose: 0 });
    expect(title.props.com.current.handZero).not.toHaveBeenCalled();
    expect(title.props.changeCalibration).toHaveBeenCalledOnce();
    select(displayEntries(title), 'calibrationPose').props.onChange(1);
    expect(setCalibration).toHaveBeenLastCalledWith({ active: true, side, pose: 1 });
    button(displayEntries(title), 'colData').props.onClick();
    expect(title.props.colFingerData).toHaveBeenLastCalledWith(1, side);
    displayEntries(title).find((node) => node.type === Modal).props.onCancel();
    expect(setCalibration).toHaveBeenLastCalledWith({ active: false });
    expect(title.props.changeStateData).toHaveBeenLastCalledWith({ calibration: false });
  });

  it('炫酷双手按校准手切换预览，模式切换会退出校准', () => {
    const title = createTitle({ matrixName: 'hand0205Double', numMatrixFlag: 'gloveMotion', calibration: true });
    const setCalibration = vi.fn();
    title.props.com.current.setCalibration = setCalibration;
    select(displayEntries(title), 'calibrationHand').props.onChange('right');
    expect(setCalibration).toHaveBeenLastCalledWith({ active: true, side: 'right', pose: 0 });
    select(displayEntries(title), 'calibrationPose').props.onChange(1);
    expect(setCalibration).toHaveBeenLastCalledWith({ active: true, side: 'right', pose: 1 });
    select(displayEntries(title), 'calibrationHand').props.onChange('left');
    expect(setCalibration).toHaveBeenLastCalledWith({ active: true, side: 'left', pose: 1 });
    expect(title.props.com.current.changeModal).not.toHaveBeenCalled();
    select(displayEntries(title), '显示方式').props.onChange('gloveTerrain');
    expect(setCalibration).toHaveBeenLastCalledWith({ active: false });
    expect(title.props.changeStateData).toHaveBeenCalledWith({ calibration: false });
  });

  it('清除校准转发给Home，同步清除运行中的基准', () => {
    const clearFingerCalibration = vi.fn();
    const title = createTitle({ numMatrixFlag: 'gloveMotion', calibration: true, clearFingerCalibration });
    button(displayEntries(title), 'clearCalibrationData').props.onClick();
    expect(clearFingerCalibration).toHaveBeenCalledOnce();
  });

  it.each(['num', 'skin', 'gloveTerrain'])('%s 模式保留校准入口和模式提示，固定仅在 skin 可用', (numMatrixFlag) => {
    const title = createTitle({ numMatrixFlag });
    const panel = displayEntries(title);
    const calibration = button(panel, 'calib');
    expect(calibration.props.disabled).toBe(true);
    expect(calibration.props.title).toBe('calibrationModeHint');
    expect(panel.find((node) => node.props.className === 'portal-glove-hint').props.children).toBe('calibrationModeHint');
    expect(select(panel, 'displayHand')).toBeDefined();
    const fixed = button(panel, 'display.fixed');
    if (numMatrixFlag === 'skin') {
      expect(fixed).toBeDefined();
      fixed.props.onClick();
      expect(title.props.com.current.handZero).toHaveBeenCalledOnce();
    } else {
      expect(fixed).toBeUndefined();
    }
  });

  it.each(['hand', 'jqbed', 'handGloveFullPacket'])('%s 不显示不支持的手套校准控件', (matrixName) => {
    const panel = displayEntries(createTitle({ matrixName }));
    expect(select(panel, 'displayHand')).toBeUndefined();
    expect(select(panel, 'calibrationHand')).toBeUndefined();
    expect(button(panel, 'calib')).toBeUndefined();
    expect(panel.some((node) => node.props.className === 'portal-glove-controls')).toBe(false);
  });

  it('专用工具不重复承载手套控件，提示用户使用右侧常驻入口', () => {
    const title = createTitle();
    const tree = entries(title.render());
    const dialog = tree.find((node) => node.type === PortalControlDialog && node.props.title === '系统专用工具');
    const special = entries(dialog);
    expect(button(special, 'calib')).toBeUndefined();
    expect(select(special, 'displayHand')).toBeUndefined();
    expect(special.some((node) => node.props.children === 'gloveControlsLocation')).toBe(true);
    expect(tree.filter((node) => node.type === Select && node.props['aria-label'] === 'displayHand')).toHaveLength(1);
    expect(tree.filter((node) => node.type === Button && node.props.children === 'calib')).toHaveLength(1);
  });
});
