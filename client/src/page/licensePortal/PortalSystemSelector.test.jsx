import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PortalSystemSelector from './PortalSystemSelector';

vi.mock('./usePortalMotion', () => ({ useSelectorMotion: vi.fn(), useSceneCopyMotion: vi.fn() }));

const props = {
  open: true, systems: [
    { value: 'hand', label: '手部检测', category: 'embodied', source: 'builtin' },
    { value: 'bed', label: '床垫监测', category: 'care', source: 'builtin' },
  ], category: 'embodied', selectedId: 'hand', sceneStatus: { state: 'ready', key: 'matrix' },
  accessKey: '', scope: null, phase: 'entering', directEntry: true, monitoring: true, expanded: false,
  runtime: <div data-testid="actual-canvas" />,
};

describe('手部单段直达的选择器宿主', () => {
  it('准备时挂载全视口运行层，不要求先展开选择器，列表仍可取消', () => {
    const html = renderToStaticMarkup(<PortalSystemSelector {...props} />);
    expect(html).toContain('data-testid="actual-canvas"');
    expect(html).not.toContain('is-scene-expanded');
    expect(html).toContain('取消进入');
    expect(html).toContain('正在准备监测画布');
    expect(html).not.toMatch(/<section[^>]*class="system-selector-panel[^>]*inert/);
  });

  it('真实画布交接后选择面板不可操作，原位预览仍保留', () => {
    const html = renderToStaticMarkup(<PortalSystemSelector {...props} dataView phase="idle" />);
    expect(html).toMatch(/<section[^>]*class="system-selector-panel[^>]*inert=""[^>]*aria-hidden="true"/);
    expect(html).toContain('system-scene-particle-host');
    expect(html).toContain('data-testid="actual-canvas"');
    expect(html).not.toContain('取消进入');
  });

  it('监测中同步系统不受保留的列表筛选限制', () => {
    const html = renderToStaticMarkup(<PortalSystemSelector {...props} selectedId="bed" dataView phase="idle" />);
    expect(html).toContain('>床垫监测</h3>');
    expect(html).not.toContain('>手部检测</h3>');
  });
  it('按密钥过滤列表、数量和选中预览，URL 中的未授权系统不能成为选中项', () => {
    const html = renderToStaticMarkup(<PortalSystemSelector {...props} category="all" selectedId="hand" scope={['bed']} phase="idle" monitoring={false} directEntry={false} />);
    expect(html).toContain('data-system="bed"');
    expect(html).not.toContain('data-system="hand"');
    expect(html).toContain('>床垫监测</h3>');
    expect(html).toContain('1 个可用系统');
  });
  it('尚未验证或更换密钥时隐藏所有系统，并提供验证入口', () => {
    const html = renderToStaticMarkup(<PortalSystemSelector {...props} scope={undefined} phase="idle" monitoring={false} directEntry={false} />);
    expect(html).not.toContain('data-system=');
    expect(html).toContain('验证密钥后显示系统');
    expect(html).not.toContain('>手部检测</h3>');
  });

  it('本机系统在进入操作旁显示提交入口，受管系统仍走更新草稿', () => {
    const local = { value: 'seatpad2-sit', systemId: 'seatpad2', label: '坐垫2', category: 'custom',
      source: 'manifest', editable: true };
    const managed = { value: 'company-sit', systemId: 'company', label: '公司坐垫', category: 'custom',
      source: 'manifest', managed: true };
    const localHtml = renderToStaticMarkup(<PortalSystemSelector {...props} systems={[local]} category="all"
      selectedId={local.value} phase="idle" monitoring={false} directEntry={false} />);
    expect(localHtml).toContain('本机系统');
    expect(localHtml).toContain('提交公司审核');
    const managedHtml = renderToStaticMarkup(<PortalSystemSelector {...props} systems={[managed]} category="all"
      selectedId={managed.value} managedIds={['company']} phase="idle" monitoring={false} directEntry={false} onRevise={() => {}} />);
    expect(managedHtml).toContain('从此系统创建更新草稿');
    expect(managedHtml).not.toContain('提交公司审核');
    const customerHtml = renderToStaticMarkup(<PortalSystemSelector {...props} systems={[managed]} category="all"
      selectedId={managed.value} managedIds={['company']} phase="idle" monitoring={false} directEntry={false} />);
    expect(customerHtml).toContain('进入该系统');
    expect(customerHtml).not.toContain('从此系统创建更新草稿');
  });
});
