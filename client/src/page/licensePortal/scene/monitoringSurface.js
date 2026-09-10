/** 等待实际渲染节点获得尺寸再交接；超时展示原生加载/错误状态，不假装已有数据。 */
export function waitForMonitoringSurface(root, signal, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let frame;
    let timer;
    let previousSurface = null;
    let paintedFrames = 0;
    /** 所有出口都清理轮询、计时器与取消监听。 */
    const finish = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    /** 只检查主渲染区域，侧栏图表不能冒充主画布就绪。 */
    const check = () => {
      const surface = root.querySelector('.portal-data-renderer canvas, .portal-data-renderer svg, .portal-data-renderer iframe');
      const bounds = surface?.getBoundingClientRect();
      if (surface && surface.dataset?.modelState !== 'loading' && bounds.width > 0 && bounds.height > 0) {
        paintedFrames = surface === previousSurface ? paintedFrames + 1 : 1;
        previousSurface = surface;
        if (paintedFrames >= 2) { finish(); return; }
      } else { previousSurface = null; paintedFrames = 0; }
      frame = requestAnimationFrame(check);
    };
    if (signal?.aborted) { finish(); return; }
    signal?.addEventListener('abort', finish, { once: true });
    timer = setTimeout(finish, timeoutMs);
    frame = requestAnimationFrame(check);
  });
}
