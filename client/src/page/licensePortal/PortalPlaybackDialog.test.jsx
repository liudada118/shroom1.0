import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PortalPlaybackDialog from './PortalPlaybackDialog';

const modalState = vi.hoisted(() => ({ props: null }));

vi.mock('antd', () => ({
  /** 在 Node 测试中保留真实内容与操作，Modal 焦点和挂载由 antd 自己承担。 */
  Modal: (props) => {
    modalState.props = props;
    return props.open ? <section role="dialog">{props.title}{props.children}</section> : null;
  },
}));

const records = [
  { value: 'first', label: '第一条采集' },
  { value: 'second', label: '第二条采集' },
];

/** 找到 JSX 里的原生控件，用于验证被用户点击时传出的受控值。 */
function findElements(node, predicate) {
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, predicate));
  if (!React.isValidElement(node)) return [];
  return [...(predicate(node) ? [node] : []), ...findElements(node.props.children, predicate)];
}

/** 渲染一次受控快照，返回本次 Modal 内的原生输入和按钮。 */
function renderDialog(extra = {}) {
  const html = renderToStaticMarkup(<PortalPlaybackDialog open records={records} {...extra} />);
  return { html, elements: findElements(modalState.props.children, (element) => ['button', 'input'].includes(element.type)) };
}

describe('门户回放弹窗', () => {
  it('提供独立单选和多选，radio 改选不加载数据', () => {
    const onPlaybackChange = vi.fn();
    const onDownloadsChange = vi.fn();
    const onPlay = vi.fn();
    const { html, elements } = renderDialog({ playbackValue: 'first', downloadValues: ['second'], onPlaybackChange, onDownloadsChange, onPlay });
    const radios = elements.filter((element) => element.props.type === 'radio');
    const checks = elements.filter((element) => element.props.type === 'checkbox');
    expect(html).toContain('回放与下载');
    expect(radios.map((element) => element.props.checked)).toEqual([true, false]);
    expect(checks.map((element) => element.props.checked)).toEqual([false, true]);
    expect(radios[0].props.name).toBe(radios[1].props.name);
    radios[1].props.onChange();
    expect(onPlaybackChange).toHaveBeenCalledWith('second');
    expect(onPlay).not.toHaveBeenCalled();
    expect(onDownloadsChange).not.toHaveBeenCalled();
    checks[0].props.onChange({ target: { checked: true } });
    expect(onDownloadsChange).toHaveBeenCalledWith(['second', 'first']);
  });

  it('执行按钮分别提交单条回放和多条下载，不在渲染时请求操作', () => {
    const onPlay = vi.fn();
    const onDownload = vi.fn();
    const onRefresh = vi.fn();
    const downloadValues = ['second'];
    const { html, elements } = renderDialog({ playbackValue: 'first', downloadValues, onPlay, onDownload, onRefresh });
    expect(html).toContain('载入回放');
    [onPlay, onDownload, onRefresh].forEach((callback) => expect(callback).not.toHaveBeenCalled());
    elements.find((element) => element.props.className === 'is-primary').props.onClick();
    elements.find((element) => element.props.onClick?.name === 'downloadSelected').props.onClick();
    expect(onPlay).toHaveBeenCalledWith('first');
    expect(onDownload).toHaveBeenCalledWith(['second']);
    expect(onDownload.mock.calls[0][0]).not.toBe(downloadValues);
  });

  it.each([
    { records: [] },
    { playbackValue: 'deleted', downloadValues: ['deleted'] },
    { playbackValue: 'first', downloadValues: ['second'], loading: true },
    { playbackValue: 'first', downloadValues: ['second'], busy: true },
  ])('空记录、失效选择或忙碌期间禁用动作 %j', (state) => {
    const onPlay = vi.fn();
    const onDownload = vi.fn();
    const { elements } = renderDialog({ onPlay, onDownload, ...state });
    const actions = elements.filter((element) => ['playSelected', 'downloadSelected'].includes(element.props.onClick?.name));
    expect(actions).toHaveLength(2);
    actions.forEach((element) => {
      expect(element.props.disabled).toBe(true);
      element.props.onClick();
    });
    expect(onPlay).not.toHaveBeenCalled();
    expect(onDownload).not.toHaveBeenCalled();
  });

  it('大量记录按页呈现，全选回调覆盖全部筛选而不是当前页', () => {
    const manyRecords = Array.from({ length: 95 }, (_, value) => ({ value, label: `采集 ${value}` }));
    const onDownloadsChange = vi.fn();
    const { html, elements } = renderDialog({ records: manyRecords, onDownloadsChange });
    expect(elements.filter((element) => element.props.type === 'checkbox')).toHaveLength(30);
    expect(html).toContain('第 1 / 4 页');
    elements.find((element) => element.props.children === '全选筛选结果').props.onClick();
    expect(onDownloadsChange.mock.calls[0][0]).toHaveLength(95);
  });

  it('保留关闭回调、异常提示和居中 Modal，不把内容塞回场景布局', () => {
    const onClose = vi.fn();
    const { html } = renderDialog({ onClose, error: '列表刷新失败，请重试' });
    expect(modalState.props.centered).toBe(true);
    expect(modalState.props.className).toBe('portal-playback-dialog');
    expect(html).toContain('role="alert"');
    expect(html).toContain('列表刷新失败，请重试');
    modalState.props.onCancel();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
