import React, { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { waitForMonitoringSurface } from './scene/monitoringSurface';
import { returnPreviewBlend } from './scene/sceneMotionClock';
import './PortalMonitoring.css';

/** 真实画布从当前预览投影接续；直接模式保持列表原位，不先放大装饰场景。 */
export default function PortalMonitoringLayer({ component: MonitoringPage, system, directEntry = false, capturePreview, onPreviewChange, onBack, onSystemChange }) {
  const [chartsVisible, setChartsVisible] = useState(true);
  const [toolsHost, setToolsHost] = useState(null);
  const rootRef = useRef(null);
  const contentRef = useRef(null);
  const exitRef = useRef(null);
  const callbacksRef = useRef({ capturePreview, onPreviewChange, onBack });
  callbacksRef.current = { capturePreview, onPreviewChange, onBack };
  useLayoutEffect(() => {
    const root = rootRef.current;
    const controller = new AbortController();
    let leaving = false;
    let revealed = false;
    let entrance;
    let particleSession;
    let restorePreviewBlend;
    const backdrop = root.closest('.system-selector-backdrop');
    if (!directEntry) root.querySelector('.portal-monitor-navigation button')?.focus({ preventScroll: true });
    const media = gsap.matchMedia();
    media.add({ motion: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)' }, (context) => {
      const surfaceController = new AbortController();
      /** 形变或降级淡入结束后统一交还真实页面的交互。 */
      const complete = () => {
        if (leaving || controller.signal.aborted || surfaceController.signal.aborted) return;
        root.dataset.handoff = 'complete';
        revealed = true;
        contentRef.current.inert = false;
        callbacksRef.current.onPreviewChange(false);
      };
      /** 真实页面仍挂载并渲染，完成淡入才暂停背后的装饰粒子。 */
      context.add('reveal', () => {
        if (controller.signal.aborted || surfaceController.signal.aborted || leaving) return;
        root.dataset.handoff = 'entering';
        const canvas = root.querySelector('.portal-data-renderer canvas');
        const api = canvas?.shroomParticleEntrance;
        const source = api && callbacksRef.current.capturePreview?.();
        root.inert = false;
        root.querySelector('.portal-monitor-navigation button')?.focus({ preventScroll: true });
        if (source) {
          const playing = api.play(source, { signal: surfaceController.signal, reducedMotion: !context.conditions.motion,
            onStart: () => {
              root.dataset.presentation = 'particle-morph';
              gsap.set(contentRef.current, { opacity: 1 });
              callbacksRef.current.onPreviewChange(false);
              if (context.conditions.motion) {
                entrance = gsap.timeline({ defaults: { ease: 'power3.out' } });
                for (const [selector, vars] of [['.title', { y: -14 }], ['.portal-observatory', { x: -16 }], ['.portal-quick-tools', { x: 12 }]]) {
                  const node = root.querySelector(selector);
                  if (node) entrance.fromTo(node, { ...vars, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: .48, clearProps: 'opacity,transform' }, .68);
                }
              }
            } });
          if (playing) {
            particleSession = { api, source, canvas };
            void playing.then(complete);
            return;
          }
        }
        root.dataset.presentation = 'crossfade';
        if (directEntry) callbacksRef.current.onPreviewChange(false);
        entrance = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: complete });
        entrance.to(contentRef.current, { opacity: 1, duration: context.conditions.motion ? .72 : 0 }, 0);
        if (context.conditions.motion) {
          const title = root.querySelector('.title');
          const aside = root.querySelector('.portal-observatory');
          if (title) entrance.from(title, { y: -14, opacity: 0, duration: .58 }, .07);
          if (aside) entrance.fromTo(aside, { x: -16, opacity: 0 }, { x: 0, opacity: 1, duration: .52, clearProps: 'opacity,transform' }, .18);
        }
      });
      /** 直接模式回到列表投影；其他入口仍交回已放大的预览。 */
      context.add('leave', () => {
        if (leaving) return;
        leaving = true;
        entrance?.kill();
        const backgroundOpacity = directEntry ? getComputedStyle(root, '::before').opacity : 1;
        const panel = directEntry && backdrop?.querySelector(':scope > .system-selector-panel');
        const previewHost = panel?.querySelector('.system-scene-particle-host');
        const panelOpacity = panel ? getComputedStyle(panel).opacity : 0;
        root.dataset.handoff = 'leaving';
        root.inert = true;
        contentRef.current.inert = true;
        // ⚠️ 面板保持 inert；点位贴合前预览仍隐藏，末段才接续实际预览的柔光材质。
        if (panel) backdrop.dataset.monitorReturn = 'true';
        const exit = gsap.timeline({ defaults: { ease: 'power3.out' } });
        const hud = root.querySelectorAll('.portal-monitor-navigation, .title, .portal-observatory, .portal-quick-tools, .portal-monitor-floor, .portal-algorithm-market, .portal-sample-rate, .canvas-overlay-bar, .canvas-draft-bar, .setIcons, .progressContent');
        exit.to(hud, { opacity: 0, duration: context.conditions.motion ? .3 : 0 }, 0);
        if (panel) {
          exit.fromTo(root, { '--portal-return-background': backgroundOpacity },
            { '--portal-return-background': 0, duration: context.conditions.motion ? .72 : 0 }, 0);
          exit.fromTo(backdrop, { '--portal-return-opacity': panelOpacity },
            { '--portal-return-opacity': 1, duration: context.conditions.motion ? .62 : 0 }, context.conditions.motion ? .12 : 0);
        }
        /** 点云和弹窗都归位后再卸载，沿用末段已恢复的浮动相位。 */
        const finishReturn = () => {
          if (controller.signal.aborted || surfaceController.signal.aborted) return;
          callbacksRef.current.onPreviewChange(true);
          callbacksRef.current.onBack();
        };
        if (particleSession?.canvas.isConnected && particleSession.canvas.shroomParticleEntrance === particleSession.api) {
          const source = directEntry ? callbacksRef.current.capturePreview?.() || particleSession.source : particleSession.source;
          let liveSource = false;
          if (previewHost) {
            const previousVisibility = previewHost.style.visibility;
            const previousOpacity = previewHost.style.opacity;
            const canvas = particleSession.canvas;
            const previousCanvasOpacity = canvas.style.opacity;
            /** 卸载或切换动画偏好时收回临时混合样式，不留透明/静止的下一次预览。 */
            restorePreviewBlend = () => {
              previewHost.style.visibility = previousVisibility;
              previewHost.style.opacity = previousOpacity;
              canvas.style.opacity = previousCanvasOpacity;
            };
          }
          const playing = particleSession.api.play(source, { reverse: true, signal: surfaceController.signal,
            reducedMotion: !context.conditions.motion,
            /** 与本帧新投影一起提交混合权重，不逐帧创建 GSAP tween。 */
            onProgress: (progress) => {
              if (!previewHost || !context.conditions.motion) return;
              const blend = liveSource ? returnPreviewBlend(progress) : 0;
              previewHost.style.visibility = blend > 0 ? 'visible' : 'hidden';
              previewHost.style.opacity = String(blend);
              particleSession.canvas.style.opacity = String(1 - blend);
            },
            resolveSource: directEntry && context.conditions.motion
              ? (progress) => {
                const snapshot = callbacksRef.current.capturePreview?.(1 - progress);
                liveSource = Boolean(snapshot);
                return snapshot;
              } : undefined });
          if (playing) {
            void Promise.all([playing, exit.then()]).then(finishReturn);
            return;
          }
        }
        if (!directEntry) callbacksRef.current.onPreviewChange(true);
        exit.to(contentRef.current, { opacity: 0, duration: context.conditions.motion ? .52 : 0, ease: 'power3.inOut' }, 0);
        void exit.then(finishReturn);
      });
      exitRef.current = context.leave;
      // 已进入后改变动画偏好不能把数据画布重新隐藏并播放入场。
      if (revealed && !leaving) gsap.set(contentRef.current, { opacity: 1 });
      else void waitForMonitoringSurface(root, surfaceController.signal).then(context.reveal);
      return () => {
        surfaceController.abort();
        restorePreviewBlend?.(); restorePreviewBlend = null;
        if (particleSession && !leaving && !controller.signal.aborted) {
          revealed = true;
          root.dataset.handoff = 'complete';
          contentRef.current.inert = false;
        }
        // ⚠️ 动画偏好在退场中改变时仍要完成返回，不能停在不可操作的半透明页面。
        if (leaving && !controller.signal.aborted) callbacksRef.current.onBack();
      };
    }, rootRef);
    return () => {
      controller.abort(); exitRef.current = null; media.revert();
      if (backdrop) delete backdrop.dataset.monitorReturn;
    };
  }, [directEntry]);

  /** 导航和原生页的返回入口共用同一段退场，重复点击不会触发多次系统操作。 */
  const leave = () => exitRef.current?.();

  return <div ref={rootRef} className={`portal-runtime-monitor is-data-view ${directEntry ? 'is-direct-entry' : ''} ${chartsVisible ? '' : 'is-chart-hidden'}`} data-handoff="preparing" inert={directEntry}>
    <nav className="portal-monitor-navigation" aria-label="系统视图">
      <div className="portal-monitor-identity-group">
        <button type="button" onClick={leave}>← 返回系统列表</button>
        <div className="portal-monitor-identity"><small>SENSOR WORKSPACE</small><strong>{system?.label || '传感器展示'}</strong></div>
      </div>
      <button className="portal-monitor-close" type="button" aria-label="退出监测返回系统列表" onClick={leave}>×</button>
    </nav>
    <div id="portal-monitor-content" ref={contentRef} className="portal-monitor-content" style={{ opacity: 0 }} inert>
      <div className="portal-monitor-floor" aria-hidden="true" />
      <MonitoringPage portalEmbedded onPortalBack={leave} onPortalSystemChange={onSystemChange}
        portalToolsHost={toolsHost} portalChartsVisible={chartsVisible} onPortalChartsToggle={() => setChartsVisible((value) => !value)} />
      <div ref={setToolsHost} className="portal-tools-host" />
    </div>
  </div>;
}
