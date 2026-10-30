import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { createCollectionNoticeTracker } from '../../services/collectionNotice';

vi.mock('react-i18next', async importOriginal => ({
  ...await importOriginal(), useTranslation: () => ({ t: i18n.t.bind(i18n) }),
}));

const hook = vi.hoisted(() => ({ dismissed: '', effect: null, notices: null }));
vi.mock('../../services/collectionNotice', async importOriginal => ({
  ...await importOriginal(),
  collectionNotices: { remaining: value => hook.notices.remaining(value), dismiss: key => hook.notices.dismiss(key) },
}));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, useState: () => [hook.dismissed, value => { hook.dismissed = value; }],
    useEffect: effect => { hook.effect = effect; } };
});
vi.mock('antd', () => ({ Alert: () => null, Button: () => null, Space: () => null }));
import RuntimeStatusNotice from './RuntimeStatusNotice';

/** 用单个状态槽调用真实提示组件，保留点击关闭后跨广播的状态。 */
function collectionAlert(summary) {
  return RuntimeStatusNotice({ collectionSummary: summary })?.props.children[1] || null;
}

describe('采集终态提示', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hook.dismissed = ''; hook.effect = null;
    hook.notices = createCollectionNoticeTracker({ storage: null });
    i18n.changeLanguage('zh');
  });
  afterEach(() => vi.useRealTimers());

  it('已保存的中断回执可以关闭，同一回执重复广播不会重新出现，下一条仍可展示', () => {
    const receipt = { id: 'capture-a', phase: 'interrupted', result: 'saved', channels: {} };
    const alert = collectionAlert(receipt);
    expect(alert.props.closable).toBe(true);
    expect(alert.props.message).toContain('已接收的数据保存完成');
    alert.props.onClose();
    expect(collectionAlert({ ...receipt })).toBeNull();
    expect(collectionAlert({ ...receipt, id: 'capture-b' }).props.message).toContain('采集已中断');
  });

  it('保存中不可隐藏，保存失败可关闭且不会显示保存成功', () => {
    expect(collectionAlert({ phase: 'finalizing', result: 'pending', channels: {} }).props.closable).toBe(false);
    const alert = collectionAlert({ phase: 'save_error', result: 'partial', channels: {} });
    expect(alert.props.closable).toBe(true);
    expect(alert.props.type).toBe('warning');
    expect(alert.props.message).toContain('仅部分保存');
    expect(alert.props.message).not.toContain('保存完成');
  });

  it('切换语言重新描述真实计数，同时保留终态关闭状态', () => {
    const receipt = { id: 'language-test', phase: 'interrupted', result: 'saved', channels: { sit: { committed: 12, pending: 0 } } };
    i18n.changeLanguage('en');
    const english = collectionAlert(receipt);
    expect(english.props.message).toContain('12 frames committed');
    expect(english.props.message).not.toMatch(/\p{Script=Han}/u);
    i18n.changeLanguage('ja');
    expect(collectionAlert(receipt).props.message).toContain('12 フレーム保存済み');
    english.props.onClose();
    expect(collectionAlert(receipt)).toBeNull();
  });

  it('已保存提示自动关闭并取消卸载计时器，历史旧回执不会闪现', () => {
    const receipt = { id: 'timed', phase: 'interrupted', result: 'saved', completedAt: Date.now(), channels: {} };
    expect(collectionAlert(receipt)).not.toBeNull();
    const cleanup = hook.effect();
    vi.advanceTimersByTime(5999);
    expect(hook.dismissed).toBe('');
    vi.advanceTimersByTime(1);
    expect(collectionAlert(receipt)).toBeNull();
    cleanup();
    hook.dismissed = '';
    expect(collectionAlert(receipt)).toBeNull();
    expect(collectionAlert({ ...receipt, id: 'old', completedAt: Date.now() - 86400000 })).toBeNull();
    expect(collectionAlert({ ...receipt, id: 'next', completedAt: Date.now() })).not.toBeNull();
    const cancel = hook.effect();
    cancel();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('保存中和部分保存不创建自动隐藏计时器', () => {
    for (const phase of ['finalizing', 'save_error']) {
      collectionAlert({ phase, result: 'partial', channels: {} });
      expect(hook.effect()).toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
    }
  });
});
