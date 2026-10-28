import i18n from '../../i18n';
import React, { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { waitForMonitoringSurface } from './scene/monitoringSurface';
import { returnPreviewBlend } from './scene/sceneMotionClock';
import './PortalMonitoring.css';
import { trackUsage, setUsageSystemContext } from '../../services/usageAnalytics';

/** 真实画布从当前预览投影接续；直接模式保持列表原位，不先放大装饰场景。 */
export default function PortalMonitoringLayer({ component: MonitoringPage, system, directEntry = false, capturePreview, onPreviewChange, onBack, onSystemChange, licenseAccess }) {
  const [chartsVisible, setChartsVisible] = useState(true);
  const [toolsHost, setToolsHost] = useState(null);
  const [sceneOnly, setSceneOnly] = useState(false);
  const [exitPending, setExitPending] = useState(false);
  const [exitError, setExitError] = useState('');
  const sceneOnlyAvailable = system?.value === 'smallBedNoAlg';
  const sceneOnlyActive = sceneOnlyAvailable && sceneOnly;
  const sceneOnlyButtonRef = useRef(null);
  const rootRef = useRef(null);
  const contentRef = useRef(null);
  const exitRef = useRef(null);
  const leaveGuardRef = useRef(null);
  const leaveAttemptRef = useRef(null);
  const callbacksRef = useRef({ capturePreview, onPreviewChange, onBack });
  callbacksRef.current = { capturePreview, onPreviewChange, onBack };
  useLayoutEffect(() => {
    if (!sceneOnlyActive) return undefined;
    const root = rootRef.current;
    root?.focus({ preventScroll: true });
    /** 纯点图隐藏全部按钮；Escape恢复界面，Tab不落到隐藏控件或背后页面。 */
    const handleSceneKey = (event) => {
      if (rootRef.current?.dataset.handoff === 'leaving') return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation();
        setSceneOnly(false);
        requestAnimationFrame(() => sceneOnlyButtonRef.current?.focus({ preventScroll: true }));
      } else if (event.key === 'Tab') {
        event.preventDefault(); event.stopImmediatePropagation(); root?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', handleSceneKey, true);
    return () => document.removeEventListener('keydown', handleSceneKey, true);
  }, [sceneOnlyActive]);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const controller = new AbortController();
    let leaving = false;
    let revealed = false;
    let entrance;
    let particleSession;
    let restorePreviewBlend;
    let monitoringStartedAt = null;
    const usageProperties = { featureId: 'monitoring', systemType: system.systemId || system.value,
      systemOrigin: system.source === 'builtin-template' ? 'copy' : system.source === 'manifest' ? 'custom' : 'builtin' };
    const releaseUsageContext = setUsageSystemContext(usageProperties);
    const backdrop = root.closest('.system-selector-backdrop');
    if (!directEntry) root.querySelector('.portal-monitor-navigation button')?.focus({ preventScroll: true });
    const media = gsap.matchMedia();
    media.add({ motion: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)' }, (context) => {
      const surfaceController = new AbortController();
      /** 形变或降级淡入结束后统一交还真实页面的交互。 */
      const complete = () => {
        if (leaving || controller.signal.aborted || surfaceController.signal.aborted) return;
        root.dataset.handoff = 'complete';
        if (!revealed) { trackUsage('system_entered', { ...usageProperties, result: 'success' }); monitoringStartedAt = performance.now(); }
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
        const panel = directEntry ? backdrop?.querySelector(':scope > .system-selector-panel') : null;
        const previewHost = panel?.querySelector('.system-scene-particle-host');
        const panelOpacity = panel ? getComputedStyle(panel).opacity : 0;
        root.dataset.handoff = 'leaving';
        root.inert = true;
        contentRef.current.inert = true;
        // ⚠️ 面板保持 inert；点位贴合前预览仍隐藏，末段才接续实际预览的柔光材质。
        if (panel) backdrop.dataset.monitorReturn = 'true';
        const exit = gsap.timeline({ defaults: { ease: 'power3.out' } });
        const hud = root.querySelectorAll('.portal-monitor-navigation, .title, .portal-observatory, .portal-quick-tools, .portal-monitor-floor, .portal-algorithm-market, .portal-utility-panel, .portal-sample-rate, .canvas-overlay-bar, .canvas-draft-bar, .setIcons, .progressContent');
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
        // ⚠️ 实时/回放可重建画布；返回要接当前渲染器，不能继续使用入场时已销毁的 API。
        const returnCanvas = root.querySelector('.portal-data-renderer canvas');
        const returnApi = returnCanvas?.shroomParticleEntrance;
        const source = directEntry ? callbacksRef.current.capturePreview?.() || particleSession?.source : particleSession?.source;
        if (returnApi && source) {
          let liveSource = false;
          if (previewHost) {
            const previousVisibility = previewHost.style.visibility;
            const previousOpacity = previewHost.style.opacity;
            const canvas = returnCanvas;
            const previousCanvasOpacity = canvas.style.opacity;
            /** 卸载或切换动画偏好时收回临时混合样式，不留透明/静止的下一次预览。 */
            restorePreviewBlend = () => {
              previewHost.style.visibility = previousVisibility;
              previewHost.style.opacity = previousOpacity;
              canvas.style.opacity = previousCanvasOpacity;
            };
          }
          const playing = returnApi.play(source, { reverse: true, signal: surfaceController.signal,
            reducedMotion: !context.conditions.motion,
            /** 与本帧新投影一起提交混合权重，不逐帧创建 GSAP tween。 */
            onProgress: (progress) => {
              if (!previewHost || !context.conditions.motion) return;
              const blend = liveSource ? returnPreviewBlend(progress) : 0;
              previewHost.style.visibility = blend > 0 ? 'visible' : 'hidden';
              previewHost.style.opacity = String(blend);
              returnCanvas.style.opacity = String(1 - blend);
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
      releaseUsageContext();
      if (monitoringStartedAt !== null) trackUsage('monitoring_usage_summary', { ...usageProperties,
        durationMs: Math.min(86400000, Math.max(0, performance.now() - monitoringStartedAt)) });
      leaveAttemptRef.current?.abort(); leaveAttemptRef.current = null;
      controller.abort(); exitRef.current = null; media.revert();
      if (backdrop) delete backdrop.dataset.monitorReturn;
    };
  }, [directEntry]);

  /** 注册当前监测页的停止采集与保存入口，不在卸载后补发设备命令。 */
  const registerLeaveGuard = (guard) => { leaveGuardRef.current = guard; };

  /** 先等待采集封闭与尾部保存，再退场；失败保留当前页供重试。 */
  const leave = async () => {
    if (leaveAttemptRef.current || rootRef.current?.dataset.handoff === 'leaving') return;
    if (!leaveGuardRef.current) { exitRef.current?.(); return; }
    const attempt = new AbortController();
    leaveAttemptRef.current = attempt;
    setExitError(''); setExitPending(true);
    const contentWasInert = contentRef.current?.inert;
    if (contentRef.current) contentRef.current.inert = true;
    try {
      await leaveGuardRef.current({ signal: attempt.signal });
      if (leaveAttemptRef.current !== attempt || attempt.signal.aborted) return;
      exitRef.current?.();
    } catch (error) {
      if (leaveAttemptRef.current !== attempt || attempt.signal.aborted) return;
      if (contentRef.current) contentRef.current.inert = contentWasInert;
      setExitError(error?.message || i18n.t('monitorUi.stopFailed'));
    } finally {
      if (leaveAttemptRef.current === attempt) {
        leaveAttemptRef.current = null; setExitPending(false);
      }
    }
  };
  const sceneOnlyControl = sceneOnlyAvailable ? <button ref={sceneOnlyButtonRef} type="button" className="portal-scene-only-toggle"
    aria-label={i18n.t('monitorUi.sceneOnly')} aria-pressed={sceneOnlyActive} aria-controls="portal-monitor-content"
    title={i18n.t('monitorUi.sceneOnlyHint')}
    onClick={() => setSceneOnly(true)}>{i18n.t('monitorUi.sceneOnly')}</button> : null;

  return <div ref={rootRef} tabIndex={-1} className={`portal-runtime-monitor is-data-view ${directEntry ? 'is-direct-entry' : ''} ${chartsVisible ? '' : 'is-chart-hidden'}${sceneOnlyActive ? ' is-scene-only' : ''}`} data-handoff="preparing" inert={directEntry}>
    <nav className="portal-monitor-navigation" aria-label={i18n.t('monitorUi.systemView')} inert={sceneOnlyActive}>
      <div className="portal-monitor-identity-group">
        <button type="button" disabled={exitPending} onClick={leave}>{exitPending ? i18n.t('monitorUi.stoppingSaving') : i18n.t('monitorUi.backSystems')}</button>
        <div className="portal-monitor-identity"><small>SENSOR WORKSPACE</small><strong title={system?.label}>{system?.label || i18n.t('monitorUi.sensorDisplay')}</strong></div>
      </div>
      <button className="portal-monitor-close" type="button" aria-label={i18n.t('monitorUi.exitMonitoring')} disabled={exitPending} onClick={leave}>×</button>
    </nav>
    <div id="portal-monitor-content" ref={contentRef} className="portal-monitor-content" style={{ opacity: 0 }} inert>
      <div className="portal-monitor-floor" aria-hidden="true" />
      <MonitoringPage portalEmbedded onPortalBack={leave} onPortalLeaveGuard={registerLeaveGuard} onPortalSystemChange={onSystemChange} licenseAccess={licenseAccess}
        portalToolsHost={toolsHost} portalChartsVisible={chartsVisible && !sceneOnlyActive} portalSceneOnly={sceneOnlyActive}
        portalSceneOnlyControl={sceneOnlyControl}
        onPortalChartsToggle={() => setChartsVisible((value) => !value)} />
      <div ref={setToolsHost} className="portal-tools-host" inert={sceneOnlyActive} />
    </div>
    {exitError && <div className="portal-exit-error" role="alert"><span>{exitError}</span>
      <button type="button" aria-label={i18n.t('monitorUi.closeExitError')} onClick={() => setExitError('')}>×</button></div>}
  </div>;
}
