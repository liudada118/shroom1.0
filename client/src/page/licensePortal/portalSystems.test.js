import { describe, expect, it } from 'vitest';
import { buildPortalSystems, filterPortalSystems, isPortalSystemAllowed, readPortalLicenseScope } from './portalSystems';
import { getBuiltinSystemOptions } from '../../services/displaySystemOptions';

/** 构造目录中的真实 runtimeDefinition 结构，不依赖运行后端。 */
const runtime = (value, name = value) => ({ sensorDefinition: { type: value }, displayMetadata: { name, matrix: { rows: 32, cols: 32 } } });
describe('首页系统目录', () => {
  it('和运行页共用入口，保持顺序，仅隐藏旧双手重复类型', () => {
    const items = buildPortalSystems((key) => key);
    expect(items.map((item) => item.value)).toEqual(getBuiltinSystemOptions((key) => key).filter((item) => item.value !== 'hand0205Double').map((item) => item.value));
  });
  it('追加实际安装系统，排除缺身份项、重复项和伪造内置同名项', () => {
    const items = buildPortalSystems((key) => key, [runtime('custom-mat', '定制垫'), runtime('custom-mat'), runtime('hand0205'), {}]);
    expect(items.filter((item) => item.source === 'manifest')).toHaveLength(1);
    expect(items.at(-1)).toMatchObject({ value: 'custom-mat', label: '定制垫', category: 'custom' });
  });
  it('按分类和名称搜索，不改动源列表', () => {
    const items = buildPortalSystems((key) => key, [runtime('custom-mat', '定制垫')]);
    expect(filterPortalSystems(items, 'custom', '定制垫')).toHaveLength(1);
    expect(filterPortalSystems(items, 'care', '定制垫')).toEqual([]);
    expect(filterPortalSystems(items, 'all', 'missing')).toEqual([]);
    expect(filterPortalSystems(items, 'all', ' CUSTOM-MAT ')).toHaveLength(1);
  });
  it('未知授权不冒充 all，空授权不冒充不受限', () => {
    const system = { value: 'hand', source: 'builtin' };
    expect(readPortalLicenseScope({})).toBeUndefined();
    expect(readPortalLicenseScope({ selectFlag: 'all' })).toBeNull();
    expect(isPortalSystemAllowed(system, undefined)).toBe(false);
    expect(isPortalSystemAllowed(system, [])).toBe(false);
    expect(isPortalSystemAllowed(system, ['hand'])).toBe(true);
    expect(isPortalSystemAllowed(system, null)).toBe(true);
  });
});
