import { validateWorkspaceViewSnapshot } from '@shroom/frontend/renderers/shared/three/workspaceViewTools.js';
import { selectedNativeSystemId } from '../displays/nativeSystemTemplates';

const PREFIX = 'shroom.workspaceView.v1:';
const MAX_BYTES = 4096;

/** 用真实系统身份和显示模式隔离视角，原生副本不能覆盖原系统。 */
export function workspaceViewStorageKey({ systemId, sensorType, mode = 'normal' }) {
  const identity = systemId || selectedNativeSystemId(sensorType);
  if (typeof identity !== 'string' || !identity || identity.length > 240
    || typeof mode !== 'string' || !mode || mode.length > 80) return null;
  return `${PREFIX}${JSON.stringify([identity, mode])}`;
}

/** 只保留有限的场景快照，损坏缓存不阻止画布使用。 */
function serializeSnapshot(snapshot) {
  try {
    if (!validateWorkspaceViewSnapshot(snapshot)) return null;
    const value = JSON.stringify(snapshot);
    return value.length <= MAX_BYTES ? value : null;
  } catch { return null; }
}

/** 恢复本系统、本显示模式的镜头和模型变换，不读取传感数据。 */
export function readWorkspaceViewConfig(options) {
  const key = workspaceViewStorageKey(options);
  if (!key) return null;
  try {
    const value = globalThis.localStorage?.getItem(key);
    if (!value || value.length > MAX_BYTES) return null;
    const snapshot = JSON.parse(value);
    return serializeSnapshot(snapshot) ? snapshot : null;
  } catch { return null; }
}

/** 保存已经校验的视角；存储不可用时仍允许旋转、缩放和翻转。 */
export function writeWorkspaceViewConfig(options, snapshot) {
  const key = workspaceViewStorageKey(options), value = serializeSnapshot(snapshot);
  if (!key || !value) return false;
  try {
    if (!globalThis.localStorage) return false;
    globalThis.localStorage.setItem(key, value);
    return true;
  } catch { return false; }
}

/** 绑定异步画布，恢复一次后订阅视角变化；工具栏关闭时也持续保存。 */
export function bindWorkspaceViewPersistence({ rendererRef, ...options }) {
  let view = null, unsubscribe = null, pending = null, lastObserved = null, timer = null, stopped = false;
  /** 保存最新变化，页面退出时不等待防抖计时器。 */
  function flush() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (pending && writeWorkspaceViewConfig(options, pending)) pending = null;
  }
  /** 只在实际变换改变时写缓存，不随压力帧或静止渲染循环落盘。 */
  function changed(snapshot) {
    if (stopped) return;
    const serialized = serializeSnapshot(snapshot);
    if (!serialized || serialized === lastObserved) return;
    lastObserved = serialized; pending = JSON.parse(serialized);
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, 250);
  }
  /** 卸载前保存旧实例，防止下一个模式把默认姿态写回旧模式。 */
  function detach() {
    if (view?.getState?.().available) changed(view.getSnapshot?.());
    unsubscribe?.(); unsubscribe = null;
    flush(); view = null; lastObserved = null;
  }
  /** 渲染器异步就绪或重建时接入新实例，不依赖用户打开工具面板。 */
  function refresh() {
    if (stopped) return;
    const next = rendererRef?.current?.getViewTools?.();
    if (next === view) return;
    detach();
    if (!next?.getState?.().available || typeof next.getSnapshot !== 'function'
      || typeof next.restoreSnapshot !== 'function' || typeof next.subscribe !== 'function') return;
    view = next;
    const saved = readWorkspaceViewConfig(options);
    if (saved) view.restoreSnapshot(saved);
    lastObserved = serializeSnapshot(view.getSnapshot());
    unsubscribe = view.subscribe(changed);
  }
  /** 标签页隐藏或刷新前尽量完成尚未防抖保存的视角。 */
  function pageHidden() {
    if (view?.getState?.().available) changed(view.getSnapshot?.());
    flush();
  }
  refresh();
  const interval = setInterval(refresh, 250);
  globalThis.addEventListener?.('pagehide', pageHidden);
  globalThis.document?.addEventListener('visibilitychange', pageHidden);
  return {
    refresh, flush,
    /** 退出页面后移除计时和监听，晚到的场景回调不能再写入。 */
    dispose() {
      if (stopped) return;
      detach(); stopped = true; clearInterval(interval);
      globalThis.removeEventListener?.('pagehide', pageHidden);
      globalThis.document?.removeEventListener('visibilitychange', pageHidden);
    },
  };
}
