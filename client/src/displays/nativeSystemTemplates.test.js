import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN_SYSTEM_ENTRIES } from '../services/displaySystemOptions';
import { getDisplayDefinition, registerRuntimeDisplayDefinition } from './registry';
import { resolveNativeSystemType, selectedNativeSystemId } from './nativeSystemTemplates';
import { formulaChartStorageKey } from '../components/aside/formulaChartStore';
import { buildPortalSystems, isPortalSystemAllowed } from '../page/licensePortal/portalSystems';
import { buildAccessibleSensorOptions } from '../services/sensorStatus';
import { getPortalScene } from '../page/licensePortal/scene/sceneCatalog';

afterEach(() => vi.unstubAllGlobals());

describe('内置系统模板副本', () => {
  it.each(BUILTIN_SYSTEM_ENTRIES)('%s 副本沿用原生展示并保留独立身份', (sourceType) => {
    const id = `copy-${sourceType}`;
    const runtime = { builtinTemplate: { id, name: '我的副本', sourceType }, sensorDefinition: { type: id }, displayMetadata: { name: '我的副本' } };
    const original = getDisplayDefinition(sourceType);
    const result = registerRuntimeDisplayDefinition(runtime);
    vi.stubGlobal('localStorage', { getItem: () => id });
    expect(resolveNativeSystemType(id)).toBe(sourceType);
    expect(selectedNativeSystemId(sourceType)).toBe(id);
    expect(result.source).toBe('builtin-template');
    expect(getDisplayDefinition(sourceType).displaySystemId).toBe(id);
    expect(result.matrix).toEqual(original?.matrix);
    expect(result.channels).toEqual(original?.channels);
    expect(result.defaultMode).toEqual(original?.defaultMode);
    expect(formulaChartStorageKey(sourceType)).toContain(encodeURIComponent(id));
    const system = buildPortalSystems((key) => key, [runtime]).find((item) => item.value === id);
    expect(isPortalSystemAllowed(system, [])).toBe(false);
    expect(isPortalSystemAllowed(system, [id])).toBe(false);
    expect(isPortalSystemAllowed(system, [sourceType])).toBe(true);
    expect(getPortalScene(system)).toBe(getPortalScene({ value: sourceType }));
  });

  it('副本在类型下拉框中也继承原系统的许可范围', () => {
    const dynamicSensors = [{ value: 'copy-hand', nativeSourceType: 'hand' }, { value: 'custom' }];
    expect(buildAccessibleSensorOptions({ dynamicSensors, allowedTypes: ['normal'] }).map((item) => item.value)).toEqual(['custom']);
  });
});
