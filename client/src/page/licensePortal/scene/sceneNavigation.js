/** 在预览和全屏之间移动同一镜头，保留当前粒子的屏幕位置。 */
export function transitionSceneFraming(root, updateLayout, signal, framing = 'focused') {
  return new Promise((resolve) => {
    let timer;
    /** 完成、取消或降级都清理监听，隐藏窗口不能留下永久等待。 */
    const finish = () => {
      clearTimeout(timer);
      root?.removeEventListener('system-scene:framing-complete', finish);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    if (signal?.aborted) { finish(); return; }
    root?.dispatchEvent(new Event('system-scene:host-settle'));
    root?.dispatchEvent(new Event('system-scene:framing-capture'));
    const from = root?.getBoundingClientRect();
    updateLayout();
    const to = root?.getBoundingClientRect();
    if (!from?.width || !to?.width || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish(); return;
    }
    root.addEventListener('system-scene:framing-complete', finish);
    signal?.addEventListener('abort', finish, { once: true });
    timer = setTimeout(finish, 1500);
    root.dispatchEvent(new CustomEvent('system-scene:framing-transition', {
      detail: { framing, from, to, duration: 1.08 },
    }));
  });
}
