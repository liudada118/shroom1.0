import React from 'react';
import { Select } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../onestep/heatmap', () => ({ bthClickHandle: vi.fn() }));
vi.mock('../../i18n', () => ({ getLanguageLocale: () => 'zh-CN' }));
import TranslatedTitle from './Title';
import WorkspaceViewPersistence from './WorkspaceViewPersistence';
import TuningNumberInput from './TuningNumberInput';
const Title = TranslatedTitle.render({}, null).type.WrappedComponent;

/** 遍历真实标题栏及插槽，调用实际滑块与模式选择事件。 */
function entries(node) {
  if (Array.isArray(node)) return node.flatMap(entries);
  if (!node || typeof node !== 'object') return [];
  if (!node.props) return entries(node.children);
  return [node, ...entries(node.props.children), ...entries(node.props.languageControl), ...entries(node.props.deviceControls)];
}

/** 用新实例模拟重新进入，既不复制缓存逻辑，也不连接串口。 */
function createTitle(matrixName, systemId = matrixName) {
  const title = new Title();
  title.props = { matrixName, systemId, history: 'now', numMatrixFlag: 'normal', colFlag: true,
    t: key => key, i18n: { language: 'zh', changeLanguage: vi.fn() }, port: [], dataArr: [],
    wsSendObj: vi.fn(), changeStateData: vi.fn(), com: { current: { sitValue: vi.fn(), changeColor: vi.fn() } },
    portalEmbedded: true, portalToolsHost: { nodeType: 1 } };
  return title;
}

describe('真实调节滑块的持久化往返', () => {
  beforeEach(() => localStorage.clear());

  it('两种床型保存后分别恢复，原始数据和3D模式独立，初始值0仍生效', () => {
    for (const [type, color] of [['smallBed', 330], ['smallBedNoAlg', 770]]) {
      const title = createTitle(type);
      const sliders = entries(title.renderSettingSliders(title.props.t));
      const threshold = sliders.find(node => node.props.usageFeature === 'tuning_initial_value');
      expect(threshold.props.min).toBe(0);
      threshold.props.onChange(0);
      sliders.find(node => node.props.usageFeature === 'tuning_color_range').props.onChange(color);
    }
    for (const [type, color] of [['smallBed', 330], ['smallBedNoAlg', 770]]) {
      const title = createTitle(type);
      const display = entries(title.render()).find(node => node.type === Select && node.props['aria-label'] === 'monitorUi.displayMode');
      display.props.onChange('normal');
      expect(title.props.changeStateData).toHaveBeenCalledWith(expect.objectContaining({ valuej1: color, valuelInit1: 0 }));
      display.props.onChange('numoriginal');
      expect(title.props.changeStateData.mock.lastCall[0].valuej1).not.toBe(color);
      display.props.onChange('normal');
      expect(title.props.changeStateData.mock.lastCall[0]).toMatchObject({ valuej1: color, valuelInit1: 0 });
    }
  });

  it('手部副本按systemId保存，不修改原系统与其他副本', () => {
    const title = createTitle('hand', 'customer-hand-a');
    entries(title.renderSettingSliders(title.props.t)).find(node => node.props.usageFeature === 'tuning_initial_value').props.onChange(2300);
    expect(JSON.parse(localStorage.getItem('valueConfig'))).toHaveProperty('customer-hand-a__normal.valuelInit1', 2300);
    for (const [id, expected] of [['customer-hand-a', 2300], ['customer-hand-b', 500], ['hand', 500]]) {
      const entered = createTitle('hand', id);
      entries(entered.render()).find(node => node.type === Select && node.props['aria-label'] === 'monitorUi.displayMode').props.onChange('normal');
      expect(entered.props.changeStateData.mock.lastCall[0].valuelInit1).toBe(expected);
    }
  });

  it('工具箱关闭或纯点图状态仍挂载本系统本模式的视角恢复', () => {
    const title = createTitle('smallBedNoAlg', 'customer-bed');
    title.props.portalSceneOnly = true;
    title.props.numMatrixFlag = 'normal';
    const persistence = entries(title.render()).find(node => node.type === WorkspaceViewPersistence);
    expect(persistence.props).toMatchObject({ systemId: 'customer-bed', sensorType: 'smallBedNoAlg', mode: 'normal', history: 'now' });
    expect(persistence.props.rendererRef).toBe(title.props.com);
  });

  it('颜色上限扩大可选范围，降低时同步渲染值，重新进入仍恢复且不串模式', () => {
    const title = createTitle('smallBedNoAlg');
    title.props.valuej1 = 1205;
    let controls = entries(title.renderSettingSliders(title.props.t));
    expect(controls.find(node => node.props.usageFeature === 'tuning_color_range').props.max).toBe(1205);
    controls.find(node => node.type === TuningNumberInput).props.onCommit(6000);
    expect(title.props.changeStateData.mock.lastCall[0]).toEqual({ colorSliderMax: 6000, valuej1: 1205 });
    Object.assign(title.props, title.props.changeStateData.mock.lastCall[0]);
    controls = entries(title.renderSettingSliders(title.props.t));
    expect(controls.find(node => node.props.usageFeature === 'tuning_color_range').props.max).toBe(6000);
    controls.find(node => node.type === TuningNumberInput).props.onCommit(500);
    expect(title.props.com.current.sitValue).toHaveBeenLastCalledWith({ valuej: 500 });
    expect(title.props.com.current.changeColor).toHaveBeenLastCalledWith({ max: 500 });
    const entered = createTitle('smallBedNoAlg');
    const display = entries(entered.render()).find(node => node.type === Select && node.props['aria-label'] === 'monitorUi.displayMode');
    display.props.onChange('normal');
    expect(entered.props.changeStateData.mock.lastCall[0]).toMatchObject({ colorSliderMax: 500, valuej1: 500 });
    display.props.onChange('numoriginal');
    expect(entered.props.changeStateData.mock.lastCall[0].colorSliderMax).toBeUndefined();
  });

  it('只有支持边框的渲染器显示缓冲滑块，0会传到渲染器且能恢复', () => {
    const title = createTitle('smallBedNoAlg', 'bed-buffer-copy');
    expect(entries(title.renderSettingSliders(title.props.t)).some(node => node.props.usageFeature === 'tuning_edge_buffer')).toBe(false);
    const controls = { showColor: true, showEdgeBuffer: true, edgeBufferDefault: 2 };
    const slider = entries(title.renderSettingSliders(title.props.t, controls)).find(node => node.props.usageFeature === 'tuning_edge_buffer');
    expect(slider.props.value).toBe(2);
    slider.props.onChange(0);
    expect(title.props.com.current.sitValue).toHaveBeenLastCalledWith({ edgeBuffer: 0 });
    const entered = createTitle('smallBedNoAlg', 'bed-buffer-copy');
    const display = entries(entered.render()).find(node => node.type === Select && node.props['aria-label'] === 'monitorUi.displayMode');
    display.props.onChange('normal');
    expect(entered.props.changeStateData.mock.lastCall[0].edgeBuffer1).toBe(0);
    display.props.onChange('numoriginal');
    expect(entered.props.changeStateData.mock.lastCall[0].edgeBuffer1).toBeUndefined();
  });
});
