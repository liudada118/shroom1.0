import { describe, expect, it } from 'vitest';
import { buildPortalSystems, canSubmitPortalSystem, describeCompanySystemSync, filterPortalSystems, getAuthorizedPortalSystems, isPortalSystemAllowed, needsCompanySystemSync, readPortalLicenseScope } from './portalSystems';
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
  it('仅为本机可编辑系统显示直接提交入口，原生副本使用其真实系统 ID', () => {
    const manifest = { sensorDefinition: { type: 'seatpad-sit', displaySystemId: 'seatpad2' },
      displayMetadata: { name: '坐垫2', editable: true } };
    const nativeCopy = { sensorDefinition: { type: 'hand_copy' }, builtinTemplate: { sourceType: 'hand' },
      displayMetadata: { id: 'hand_copy', name: '手部副本', source: 'builtin-template' } };
    const managed = { sensorDefinition: { type: 'managed-sit', displaySystemId: 'managed' },
      displayMetadata: { editable: true, managed: true } };
    const draft = { sensorDefinition: { type: 'revision_draft', displaySystemId: 'revision_draft' },
      displayMetadata: { editable: true, revisionDraft: true } };
    const readonly = { sensorDefinition: { type: 'readonly-sit', displaySystemId: 'readonly' }, displayMetadata: {} };
    const items = buildPortalSystems((key) => key, [manifest, nativeCopy, managed, draft, readonly]);
    expect(items.filter(canSubmitPortalSystem).map((item) => item.systemId)).toEqual(['seatpad2', 'hand_copy']);
    expect(canSubmitPortalSystem(items.find((item) => item.value === 'managed-sit'))).toBe(false);
    expect(canSubmitPortalSystem(items.find((item) => item.value === 'revision_draft'))).toBe(false);
    expect(canSubmitPortalSystem(items.find((item) => item.value === 'readonly-sit'))).toBe(false);
    expect(canSubmitPortalSystem(items.find((item) => item.value === 'hand'))).toBe(false);
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
  it('列表仅包含授权内置系统和已安装自定义系统，换密钥时清空', () => {
    const systems = buildPortalSystems((key) => key, [runtime('custom-mat')]);
    expect(getAuthorizedPortalSystems(systems, ['wholeChair']).map((item) => item.value)).toEqual(['wholeChair', 'custom-mat']);
    expect(getAuthorizedPortalSystems(systems, undefined)).toEqual([]);
    expect(getAuthorizedPortalSystems(systems, []).map((item) => item.value)).toEqual(['custom-mat']);
    expect(getAuthorizedPortalSystems(systems, null)).toEqual(systems);
  });
  it('受管系统必须在当前密钥的签名目录中，普通本地系统保持原有入口', () => {
    const managed = { sensorDefinition: { id: 'seatpad', type: 'seatpad-sit' }, displayMetadata: { name: '公司坐垫', managed: true } };
    const systems = buildPortalSystems((key) => key, [runtime('local-mat'), managed]);
    expect(getAuthorizedPortalSystems(systems, null).map((item) => item.value)).toContain('local-mat');
    expect(getAuthorizedPortalSystems(systems, null).map((item) => item.value)).not.toContain('seatpad-sit');
    expect(getAuthorizedPortalSystems(systems, null, ['seatpad']).map((item) => item.value)).toContain('seatpad-sit');
    expect(getAuthorizedPortalSystems(systems, [], ['seatpad']).map((item) => item.value)).not.toContain('seatpad-sit');
    expect(getAuthorizedPortalSystems(systems, ['seatpad'], ['seatpad']).map((item) => item.value)).toContain('seatpad-sit');
    expect(getAuthorizedPortalSystems(systems, ['hand'], ['seatpad']).map((item) => item.value)).not.toContain('seatpad-sit');
    expect(getAuthorizedPortalSystems(systems, undefined, ['seatpad'])).toEqual([]);
  });
  it('签名发布包派生的本机修订草稿无需目标系统或原生来源的逐系统授权', () => {
    const draft = { sensorDefinition: { type: 'revision_abc', displaySystemId: 'revision_abc' },
      builtinTemplate: { sourceType: 'hand' }, displayMetadata: { name: '手部修订草稿', revisionDraft: true } };
    const system = buildPortalSystems((key) => key, [draft]).at(-1);
    expect(system.revisionDraft).toBe(true);
    expect(isPortalSystemAllowed(system, [])).toBe(true);
    expect(isPortalSystemAllowed(system, undefined)).toBe(false);
    expect(isPortalSystemAllowed({ ...system, managed: true }, [])).toBe(false);
  });
  it('只有可能包含公司系统的授权才触发公司目录同步', () => {
    expect(needsCompanySystemSync(['jqbed', 'petCare', 'petCareMini'])).toBe(false);
    expect(needsCompanySystemSync(['hand', 'seatpad'])).toBe(true);
    expect(needsCompanySystemSync(null)).toBe(true);
    expect(needsCompanySystemSync(undefined)).toBe(false);
  });
  it('系统 ID 冲突会说明本机内容保留和处理办法', () => {
    expect(describeCompanySystemSync({ installed: [], errors: [{ systemId: 'seatpad', code: 'SYSTEM_PACKAGE_CONFLICT',
      message: '系统 ID 已被现有系统占用' }] })).toContain('未覆盖本机内容');
    expect(describeCompanySystemSync({ installed: [], errors: [{ systemId: 'seatpad2',
      code: 'SYSTEM_PACKAGE_ALGORITHM_INVALID', message: '算法包所属系统、契约或 ID 无效' }] }))
      .toContain('公司系统 seatpad2 安装失败：算法包所属系统、契约或 ID 无效');
    expect(describeCompanySystemSync({ installed: [], errors: [] })).toBe('');
  });
});
