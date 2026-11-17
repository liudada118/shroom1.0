// 首页装饰点阵迁移自 fiber-sensor；不是传感器数据。
import { jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
/** 将装饰透明度与波动强度限制在合法范围。 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
// 圆点位置固定，只有亮度和半径随波纹缓慢变化，100ms 内不到一个色阶，空闲时降频重画看不出差别；
// 指针高亮要跟手，移动时提到约 30 帧。阈值略小于整数帧间隔，避免被刷新抖动多拖一帧。
const IDLE_REDRAW_MS = 98;
const POINTER_REDRAW_MS = 31;

/**
 * 绘制首页底部装饰点阵，并在卸载时清理动画和观察器。
 * ⚠️ 被系统列表或监测页盖住时必须传 paused：画布仍在视口内，可见性观察器不会停它。
 * ⚠️ 不要改回每帧重画：一帧约两千个圆点，会占满显卡进程（现象：首页显卡占用高、监测页掉帧）。
 *
 * @param {boolean} [paused=false] 为 true 时停在当前画面，恢复后接着原相位走。
 */
function PressureParticleField({
  className,
  style,
  paused = false
}) {
  const canvasRef = useRef(null);
  const pausedRef = useRef(paused);
  const resumeRef = useRef(null);
  pausedRef.current = paused;
  useEffect(() => {
    if (!paused) resumeRef.current?.();
  }, [paused]);
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
    // 暂停期间不推进波纹相位，恢复时不会跳到别处。
    let pausedAt = 0;
    let pausedTotal = 0;
    let lastDrawAt = -Infinity;
    let phase = 0;
    let pointerMoved = false;
    /** 安排下一帧；暂停时记下时刻，供恢复后扣除。 */
    const scheduleNext = () => {
      if (pausedRef.current) {
        if (!pausedAt) pausedAt = performance.now();
      } else if (!reducedMotion.matches && isVisible) {
        animationFrame = window.requestAnimationFrame(draw);
      }
    };
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
    /** 绘制一帧装饰点阵，最多保持一条动画循环；不带时间戳的调用（尺寸变化）立即重画。 */
    const draw = (frameTime = 0) => {
      animationFrame = 0;
      if (disposed) return;
      if (frameTime && frameTime - lastDrawAt < (pointerMoved ? POINTER_REDRAW_MS : IDLE_REDRAW_MS)) {
        scheduleNext();
        return;
      }
      if (frameTime) {
        lastDrawAt = frameTime;
        phase = frameTime - pausedTotal;
      }
      pointerMoved = false;
      // 尺寸变化触发的重画沿用上一帧相位，降频后不会让波纹跳一下再跳回来。
      const time = phase;
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
      scheduleNext();
    };
    /** 恢复可见时的动画循环，避免重复调度。 */
    const requestDraw = () => {
      if (animationFrame || reducedMotion.matches || !isVisible || pausedRef.current) return;
      if (pausedAt) {
        pausedTotal += performance.now() - pausedAt;
        pausedAt = 0;
      }
      animationFrame = window.requestAnimationFrame(draw);
    };
    resumeRef.current = requestDraw;
    /** 记录指针位置，用于装饰高亮。 */
    const onPointerMove = (event) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
      pointer.active = true;
      pointerMoved = true;
    };
    /** 移除指针高亮。 */
    const onPointerLeave = () => {
      pointer.active = false;
      pointerMoved = true;
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
      resumeRef.current = null;
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
