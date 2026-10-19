import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../onestep/heatmap', () => ({ bthClickHandle: vi.fn() }));
vi.mock('../../i18n', () => ({ getLanguageLocale: () => 'zh-CN' }));

import TranslatedTitle from './Title';
const Title = TranslatedTitle.render({}, null).type.WrappedComponent;

/** 收集真实设置树的滑块，直接执行其事件而不复制调参逻辑。 */
function sliders(node, found = []) {
  if (!React.isValidElement(node)) return found;
  if (node.props.usageFeature) found.push(node);
  React.Children.forEach(node.props.children, (child) => sliders(child, found));
  return found;
}

/** 创建隔离 Title 实例，保留真实滑块配置和转发方法。 */
function titleFor(matrixName, getTuningControls) {
  const title = new Title();
  title.props = { matrixName, numMatrixFlag: 'normal', t: (key) => key, changeStateData: vi.fn(),
    com: { current: { getTuningControls, sitValue: vi.fn(), backValue: vi.fn(), changeColor: vi.fn() } } };
  return title;
}

describe('Title 生成系统动态调参', () => {
  beforeEach(() => localStorage.clear());

  it('未知系统 ID 从已挂载渲染器读取六项矩阵调节能力', () => {
    const title = titleFor('agent-seat-new', () => ({ showGuass: true, showColor: true, showFilter: true,
      showHeight: true, showConsis: true, showInit: true, showSize: false, showSpeed: false }));
    const controls = sliders(title.renderSettingSliders(title.props.t));
    expect(controls.map((slider) => slider.props.usageFeature)).toEqual([
      'tuning_gaussian', 'tuning_color_range', 'tuning_filter', 'tuning_height', 'tuning_consistency', 'tuning_initial_value',
    ]);
    controls.find((slider) => slider.props.usageFeature === 'tuning_filter').props.onChange(0);
    expect(title.props.com.current.sitValue).toHaveBeenCalledWith({ valuef: 0 });
    expect(title.props.changeStateData).toHaveBeenCalledWith({ valuef1: 0 });
  });

  it('动态能力随渲染器切换缩减，不保留上一种模式的高度与平滑项', () => {
    const title = titleFor('agent-seat-new');
    const controls = sliders(title.renderSettingSliders(title.props.t,
      { showColor: true, showFilter: true, showGuass: false, showHeight: false, showConsis: false, showInit: false }));
    expect(controls.map((slider) => slider.props.usageFeature)).toEqual(['tuning_color_range', 'tuning_filter']);
  });

  it('原生 hand 仍保留原有六项调节，不要求实现新的能力接口', () => {
    const title = titleFor('hand');
    expect(sliders(title.renderSettingSliders(title.props.t))).toHaveLength(6);
  });
});
