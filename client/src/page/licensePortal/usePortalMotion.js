import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

/** 迁移参考首页的分段入场与细指针卡片倾斜，卸载时撤回全部动画和监听。 */
export function usePortalEntrance(rootRef) {
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.portal-topbar', { y: -18, autoAlpha: 0, duration: .62 })
        .from('.portal-hero > *', { y: 22, autoAlpha: 0, duration: .68, stagger: .08 }, '-=.32')
        .from('.portal-access', { y: 28, scale: .988, autoAlpha: 0, duration: .78 }, '-=.4')
        .from('.portal-card', { y: 30, autoAlpha: 0, duration: .72, stagger: .085 }, '-=.44');
    }, rootRef);
    media.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
      const cleanups = [...rootRef.current.querySelectorAll('.portal-card')].map((card) => {
        gsap.set(card, { transformPerspective: 1100 });
        const rotateX = gsap.quickTo(card, 'rotationX', { duration: .42, ease: 'power3.out' });
        const rotateY = gsap.quickTo(card, 'rotationY', { duration: .42, ease: 'power3.out' });
        /** 用卡片局部指针位置调整轻微倾斜。 */
        const move = (event) => {
          const bounds = card.getBoundingClientRect();
          rotateX(-((event.clientY - bounds.top) / bounds.height - .5) * 5);
          rotateY(((event.clientX - bounds.left) / bounds.width - .5) * 5);
        };
        /** 离开卡片时回到平面。 */
        const reset = () => { rotateX(0); rotateY(0); };
        card.addEventListener('pointermove', move);
        card.addEventListener('pointerleave', reset);
        return () => { card.removeEventListener('pointermove', move); card.removeEventListener('pointerleave', reset); };
      });
      return () => cleanups.forEach((dispose) => dispose());
    }, rootRef);
    return () => media.revert();
  }, [rootRef]);
}

/** 选择弹层使用可反向播放的时间线；快速开关从当前进度接续。 */
export function useSelectorMotion(rootRef, open, itemsKey) {
  const timelineRef = useRef(null);
  const playbackRef = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;
  useLayoutEffect(() => {
    const root = rootRef.current;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const list = root.querySelector('.system-options');
      const bounds = list.getBoundingClientRect();
      const items = [...list.querySelectorAll('.portal-system-option')].filter((item) => {
        const rect = item.getBoundingClientRect();
        return rect.bottom > bounds.top && rect.top < bounds.bottom;
      });
      /** 隐藏由真实倒放完成驱动，不按固定毫秒截断最后几帧。 */
      const hide = () => { if (!openRef.current) root.style.visibility = 'hidden'; };
      const timeline = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' },
        onReverseComplete: hide,
      });
      timeline.fromTo(root, { opacity: 0 }, { opacity: 1, duration: .3 }, 0)
        .fromTo('.system-selector-panel', { y: 26, scale: .985, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: .62 }, 0)
        .fromTo('.system-scene-chrome', { x: 26, opacity: 0 }, { x: 0, opacity: 1, duration: .58 }, .14)
        .fromTo('.system-close-ring', { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: .38, ease: 'back.out(1.7)' }, .34)
        .fromTo('.system-close-line-a', { scaleX: 0, rotation: 0 }, { scaleX: 1, rotation: 45, duration: .28 }, .48)
        .fromTo('.system-close-line-b', { scaleX: 0, rotation: 0 }, { scaleX: 1, rotation: -45, duration: .28 }, .52);
      // 仅错峰屏幕内的系统项；长目录不能让屏幕外项目拖长整段退场。
      if (items.length) timeline.fromTo(items, { x: -18, opacity: 0 }, { x: 0, opacity: 1, duration: .48, stagger: .055 }, .18);
      timelineRef.current = timeline;
      const previous = playbackRef.current;
      if (previous) timeline.time(previous.finished ? timeline.duration() : Math.min(previous.time, timeline.duration()));
      root.style.visibility = openRef.current || timeline.time() > 0 ? 'visible' : 'hidden';
      if (openRef.current) timeline.play(); else timeline.reverse();
      return () => {
        timelineRef.current = null;
      };
    }, rootRef);
    media.add('(prefers-reduced-motion: reduce)', () => {
      root.style.visibility = openRef.current ? 'visible' : 'hidden';
      playbackRef.current = { time: 0, finished: openRef.current };
    }, rootRef);
    return () => {
      const timeline = timelineRef.current;
      if (timeline) playbackRef.current = { time: timeline.time(), finished: timeline.progress() === 1 };
      media.revert();
      root.style.removeProperty('visibility');
    };
  }, [rootRef, itemsKey]);
  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    if (open) { rootRef.current.style.visibility = 'visible'; timeline?.play(); }
    else if (timeline?.time() > 0) timeline.reverse();
    else rootRef.current.style.visibility = 'hidden';
  }, [open, rootRef]);
}

/** 随系统切换重播说明卡和扫描线，动画仅作用于文字，不干扰粒子宿主测量。 */
export function useSceneCopyMotion(rootRef, selectedId, open) {
  useLayoutEffect(() => {
    if (!open) return undefined;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('[data-scene-copy]', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .42, stagger: .055, ease: 'power3.out' });
      gsap.fromTo('.system-scene-scan', { xPercent: -110, opacity: 0 }, { xPercent: 110, opacity: .62, duration: .8, ease: 'power2.inOut' });
    }, rootRef);
    return () => media.revert();
  }, [rootRef, selectedId, open]);
}
