import { describe, expect, it } from 'vitest';
import React from 'react';
import TranslatedAside from './Aside';

const Aside = TranslatedAside.render({}, null).type.WrappedComponent;

/** 检查真实侧栏的元素树，不挂载设备、图表或订阅。 */
function findElements(node, predicate) {
  return React.Children.toArray(node).flatMap((child) => !React.isValidElement(child) ? []
    : [...(predicate(child) ? [child] : []), ...findElements(child.props.children, predicate)]);
}

/** 提供已有状态的实际侧栏渲染，翻译保持可断言的指标标识。 */
function renderBedAside(matrixName, state) {
  const aside = new Aside();
  aside.props = { matrixName, i18n: { t: (key) => key }, t: (key) => key };
  aside.state = { ...aside.state, ...state };
  return aside.render();
}

describe('矩阵系统共用手部监测图表模板', () => {
  it('生成的配置侧栏按手部监测顺序显示面积、压力和可扩展图表', () => {
    const aside = new Aside();
    aside.props = { matrixName: 'new-matrix-sit', displaySystemId: 'new-matrix', t: (key) => key, i18n: { t: (key) => key } };
    const children = aside.renderConfigurableSidebar({ pressure: {}, area: {} }).props.children;
    expect(children[0].props.children[0].props.children[0].props.children).toBe('sensorPanel.pressureArea');
    expect(children[1].props.children[0].props.children[0].props.children).toBe('sensorPanel.pressureData');
    expect(children[0].props.children[2]).toHaveLength(2);
    expect(children[1].props.children[5]).toHaveLength(3);
    expect(children[3].props.systemId).toBe('new-matrix');
  });
});

describe('床监测侧栏状态', () => {
  it.each(['smallBed', 'jqbed'])('没有可显示状态时，%s不生成空白色块，生命体征仍保留', (matrixName) => {
    for (const stateInBbed of [null, undefined, 2, 99]) {
      const tree = renderBedAside(matrixName, { stateInBbed });
      expect(findElements(tree, (node) => node.props.className?.includes('bedStatusCard'))).toHaveLength(0);
      expect(findElements(tree, (node) => node.type === 'h2' && node.props.children === 'vitalSigns')).toHaveLength(1);
    }
  });

  it('有效状态保留名称、计时和风险强调，不再注入旧卡片背景', () => {
    const normal = renderBedAside('smallBed', { stateInBbed: 1, onBedTime: 65 });
    const card = findElements(normal, (node) => node.props.className?.includes('bedStatusCard'))[0];
    expect(card.props.style?.backgroundColor).toBeUndefined();
    expect(findElements(card, (node) => node.props.className === 'bedStatusDuration')[0].props.children).toContain('00:01:05');
    const warning = renderBedAside('smallBed', { stateInBbed: 3 });
    expect(findElements(warning, (node) => node.props.className?.includes('bedStatusCard--warning'))).toHaveLength(1);
    expect(findElements(warning, (node) => node.props.className === 'bedStatusHeading')[0].props.children).toContain('fallBed');
  });

  it('宠物无状态时不误报离床，有实际离床结果时仍强调', () => {
    for (const petInBed of [null, '--', 2, NaN]) {
      const empty = renderBedAside('petCare', { petInBed, posture_state: '--' });
      expect(findElements(empty, (node) => node.props.className?.includes('bedStatusCard'))).toHaveLength(0);
    }
    const offBed = renderBedAside('petCare', { petInBed: 0, posture_state: 0 });
    expect(findElements(offBed, (node) => node.props.className?.includes('bedStatusCard--warning'))).toHaveLength(1);
  });
});
