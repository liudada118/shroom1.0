// 首页装饰点阵迁移自 fiber-sensor；不是传感器数据。
import { jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
/** 将装饰透明度与波动强度限制在合法范围。 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
/** 绘制首页底部装饰点阵，并在卸载时清理动画和观察器。 */
function PressureParticleField({
  className,
  style
}) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: -1e3, y: -1e3, active: false };
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let animationFrame = 0;
    let isVisible = true;
    let disposed = false;
    /** 从独立容器计算尺寸和 DPR。 */
    const resize = () => {
      const parent = canvas.parentElement ?? canvas;
      const bounds = parent.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width || window.innerWidth));
      height = Math.max(1, Math.round(bounds.height || window.innerHeight));
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };
    /** 绘制一帧装饰点阵，最多保持一条动画循环。 */
    const draw = (time = 0) => {
      animationFrame = 0;
      if (disposed) return;
      context.clearRect(0, 0, width, height);
      const startY = Math.max(0, height * 0.58);
      const spacing = width < 700 ? 24 : 22;
      const waveX = width * (0.5 + Math.sin(time * 12e-5) * 0.16);
      const waveY = height * (0.88 + Math.cos(time * 16e-5) * 0.04);
      const secondX = width * (0.22 + Math.cos(time * 1e-4) * 0.1);
      const secondY = height * 0.96;
      for (let y = startY; y <= height + spacing; y += spacing) {
        const fade = clamp((y - startY) / Math.max(1, height - startY), 0, 1);
        for (let x = 0; x <= width + spacing; x += spacing) {
          const waveDistance = Math.hypot((x - waveX) * 0.72, y - waveY);
          const secondDistance = Math.hypot((x - secondX) * 0.8, y - secondY);
          const pointerDistance = pointer.active ? Math.hypot(x - pointer.x, y - pointer.y) : 1e3;
          const wave = Math.max(0, 1 - waveDistance / 410);
          const secondWave = Math.max(0, 1 - secondDistance / 300);
          const pointerWave = Math.max(0, 1 - pointerDistance / 220);
          const energy = clamp(
            wave * 0.72 + secondWave * 0.42 + pointerWave * 0.72,
            0,
            1
          );
          const radius = 0.65 + energy * 1.15;
          const alpha = (0.05 + energy * 0.42) * fade;
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fillStyle = `rgba(${Math.round(35 + energy * 20)}, ${Math.round(
            112 + energy * 84
          )}, 255, ${alpha})`;
          context.fill();
        }
      }
      if (!reducedMotion.matches && isVisible) {
        animationFrame = window.requestAnimationFrame(draw);
      }
    };
    /** 恢复可见时的动画循环，避免重复调度。 */
    const requestDraw = () => {
      if (animationFrame || reducedMotion.matches || !isVisible) return;
      animationFrame = window.requestAnimationFrame(draw);
    };
    /** 记录指针位置，用于装饰高亮。 */
    const onPointerMove = (event) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
      pointer.active = true;
    };
    /** 移除指针高亮。 */
    const onPointerLeave = () => {
      pointer.active = false;
    };
    /** 响应减少动画设置，重新绘制静态帧。 */
    const onMotionChange = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      draw(0);
      requestDraw();
    };
    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(animationFrame);
      resize();
      draw(0);
    });
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) requestDraw();
      },
      { threshold: 0.01 }
    );
    resizeObserver.observe(canvas.parentElement ?? canvas);
    intersectionObserver.observe(canvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("mouseleave", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);
    reducedMotion.addEventListener("change", onMotionChange);
    resize();
    draw(0);
    requestDraw();
    return () => {
      disposed = true;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("mouseleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      reducedMotion.removeEventListener("change", onMotionChange);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);
  return /* @__PURE__ */ jsx(
    "canvas",
    {
      ref: canvasRef,
      className,
      style,
      "aria-hidden": "true"
    }
  );
}
export {
  PressureParticleField as default
};
