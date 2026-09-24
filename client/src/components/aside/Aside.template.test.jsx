import { describe, expect, it } from 'vitest';
import TranslatedAside from './Aside';

const Aside = TranslatedAside.render({}, null).type.WrappedComponent;

describe('矩阵系统共用手部监测图表模板', () => {
  it('生成的配置侧栏按手部监测顺序显示面积、压力和可扩展图表', () => {
    const aside = new Aside();
    aside.props = { matrixName: 'new-matrix-sit', displaySystemId: 'new-matrix', i18n: { t: (key) => key } };
    const children = aside.renderConfigurableSidebar({ pressure: {}, area: {} }).props.children;
    expect(children[0].props.children[0].props.children[0].props.children).toBe('sensorPanel.pressureArea');
    expect(children[1].props.children[0].props.children[0].props.children).toBe('sensorPanel.pressureData');
    expect(children[0].props.children[2]).toHaveLength(2);
    expect(children[1].props.children[5]).toHaveLength(3);
    expect(children[3].props.systemId).toBe('new-matrix');
  });
});
