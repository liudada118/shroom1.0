import gsap from 'gsap';

/** 按透视视口高度等比移动画布，并保持屏幕中心连续；横纵比变化不能拉伸模型。 */
export function getSceneHostTransform(from, to) {
  if (![from, to].every((rect) => rect && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
    && rect.width > 0 && rect.height > 0)) return null;
  const scale = from.height / to.height;
  return {
    x: from.x + from.width / 2 - to.x - to.width * scale / 2,
    y: from.y - to.y,
    scale,
  };
}

/** 将同一个 Canvas 从当前屏幕位置连续移动到目标宿主，避免被弹窗边界裁断。 */
export function createSceneHostBridge(root) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let layer = null;
  let animation = null;
  let destination = null;
  let generation = 0;

  /** 结束飞行后把原节点归还目标；旧动画的回调不得覆盖新目标。 */
  const settle = (version) => {
    if (version !== generation) return;
    animation?.kill();
    animation = null;
    if (destination?.isConnected) destination.appendChild(root);
    layer?.remove();
    layer = null;
    root.dataset.hostTransition = 'idle';
    root.dispatchEvent(new Event('system-scene:viewport-resize'));
  };

  /** 从正在显示的位置接续动画；快速开关时不回到上一次起点。 */
  const move = (host) => {
    if (!host || (destination === host && (animation || root.parentElement === host))) return;
    const from = root.isConnected ? root.getBoundingClientRect() : null;
    const fromStyle = root.isConnected ? getComputedStyle(layer || root) : null;
    const oldOpacity = fromStyle?.opacity || '1';
    const oldFilter = fromStyle?.filter || 'none';
    const version = ++generation;
    animation?.kill();
    animation = null;
    destination = host;
    host.appendChild(root);
    layer?.remove();
    layer = null;
    // 目标以弹层落位后的尺寸测量，不能把入场中的 scale/y 再算进飞行终点。
    const panel = host.closest('.system-selector-panel');
    const panelTransform = panel?.style.transform;
    if (panel) panel.style.transform = 'none';
    const to = root.getBoundingClientRect();
    if (panel) panel.style.transform = panelTransform;
    root.dataset.hostTransition = 'idle';
    const transform = getSceneHostTransform(from, to);
    if (!transform || motion.matches) {
      root.dispatchEvent(new Event('system-scene:viewport-resize'));
      return;
    }
    const targetStyle = getComputedStyle(root);
    const opacity = targetStyle.opacity;
    const filter = targetStyle.filter;
    layer = document.createElement('div');
    layer.className = 'portal-particle-flight';
    layer.setAttribute('aria-hidden', 'true');
    Object.assign(layer.style, { left: `${to.x}px`, top: `${to.y}px`, width: `${to.width}px`, height: `${to.height}px` });
    (host.closest('.fiber-portal') || document.body).appendChild(layer);
    layer.appendChild(root);
    root.dataset.hostTransition = 'flying';
    // ⚠️ 换宿主后必须同步更新相机与背板，否则首帧仍会把旧横纵比的图像撑进新容器。
    root.dispatchEvent(new Event('system-scene:viewport-resize'));
    const flight = { progress: 0 };
    /** 用单个 scale 写入两个轴，避免矩阵分解和取整把等比缩放拆成不同的起点。 */
    const renderFlight = () => {
      const remaining = 1 - flight.progress;
      layer.style.transform = `translate(${transform.x * remaining}px, ${transform.y * remaining}px) scale(${1 + (transform.scale - 1) * remaining})`;
    };
    renderFlight();
    animation = gsap.timeline({ defaults: { duration: 1.08, ease: 'power3.inOut' }, onComplete: () => settle(version) })
      .to(flight, { progress: 1, onUpdate: renderFlight }, 0)
      .fromTo(layer, { opacity: oldOpacity, filter: oldFilter }, { opacity, filter }, 0);
  };

  /** 改变窗口或减少动画设置时直接归位，防止遗留错位的浮层。 */
  const onResize = () => { if (animation) settle(generation); };
  /** 系统切换到减少动画模式后立即归位。 */
  const onMotion = () => { if (motion.matches) settle(generation); };
  window.addEventListener('resize', onResize);
  motion.addEventListener('change', onMotion);
  root.addEventListener('system-scene:host-settle', onResize);

  /** 卸载时取消回调并释放临时层；不复制、不重建 WebGL Canvas。 */
  const dispose = () => {
    ++generation;
    animation?.kill();
    layer?.remove();
    root.remove();
    window.removeEventListener('resize', onResize);
    motion.removeEventListener('change', onMotion);
    root.removeEventListener('system-scene:host-settle', onResize);
  };
  return { move, dispose };
}
