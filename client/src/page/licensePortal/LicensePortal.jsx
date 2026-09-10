import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowRightOutlined, AppstoreOutlined, SafetyCertificateOutlined, HeartOutlined, CarOutlined, RobotOutlined, ExperimentOutlined, KeyOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useMainWebSocket from '../../services/ws/useMainWebSocket';
import { getLicenseKeyFromMessage, isObjectMessage } from '../../services/ws/messages';
import { commandClient } from '../../services/command/commandClient';
import { requestJson } from '../../extensions/display-system/api';
import { registerRuntimeDisplayDefinition } from '../../displays/registry';
import BRAND_LOGO_SRC from '../../assets/开屏IMG/shroom-vision-logo.png';
import { FeedbackWidget } from './LicensePortalWidgets';
import { PORTAL_CATEGORIES, buildPortalSystems, readPortalLicenseScope } from './portalSystems';
import { createPortalEntry } from './portalEntry';
import PortalSystemSelector from './PortalSystemSelector';
import './PortalFeedback.css';
import SystemScenePreview from './scene/SystemScenePreview';
import PressureParticleField from './scene/PressureParticleField';
import { getPortalScene } from './scene/sceneCatalog';
import { transitionSceneFraming } from './scene/sceneNavigation';
import { usePortalEntrance } from './usePortalMotion';
import PortalMonitoringLayer from './PortalMonitoringLayer';
import { loadMonitoringPage } from '../home/loadMonitoringPage';
import './FiberPortal.css';
import './PortalLauncher.css';
const CATEGORY_ICONS = { care: HeartOutlined, vehicle: CarOutlined, embodied: RobotOutlined, custom: ExperimentOutlined };

/** 首页只选择入口；授权、系统切换和真实数据仍使用原有后端链路。 */
export default function LicensePortal({ prepareSystem = loadMonitoringPage }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [accessKey, setAccessKey] = useState('');
  const [scope, setScope] = useState(undefined);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [runtimeDefinitions, setRuntimeDefinitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [reload, setReload] = useState(0);
  const keyRef = useRef('');
  const entryRef = useRef(null);
  const headingRef = useRef(null);
  const returnFocusRef = useRef(null);
  const hadSelectorOpenRef = useRef(false);
  const [homeHost, setHomeHost] = useState(null);
  const [previewHost, setPreviewHost] = useState(null);
  const [previewSystem, setPreviewSystem] = useState(null);
  const [sceneStatus, setSceneStatus] = useState({ state: 'loading', key: 'shroom' });
  const [sceneExpanded, setSceneExpanded] = useState(false);
  const [monitoringModule, setMonitoringModule] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [directEntry, setDirectEntry] = useState(false);
  const portalRef = useRef(null);
  usePortalEntrance(portalRef);
  const sceneRootRef = useRef(null);
  const navigationRef = useRef(null);
  const category = params.get('category');
  const selectorOpen = category !== null;
  const activeCategory = PORTAL_CATEGORIES.some((item) => item.key === category) ? category : 'all';
  const systems = useMemo(() => buildPortalSystems(t, runtimeDefinitions), [t, runtimeDefinitions]);

  /** 退出或断线只取消前端过渡，不宣称撤回后端已经确认的系统切换。 */
  const cancelNavigation = useCallback(() => {
    navigationRef.current?.abort();
    navigationRef.current = null;
    setMonitoringModule(null);
    setPreviewVisible(true);
    setSceneExpanded(false);
    setDirectEntry(false);
  }, []);

  /** 手部先在后台准备真实画布，直接接续列表点阵；其他系统保留原有镜头过渡。 */
  const enterMonitoringPage = useCallback(async (system) => {
    const controller = new AbortController();
    navigationRef.current?.abort();
    navigationRef.current = controller;
    try {
      if (system.runtimeDefinition) registerRuntimeDisplayDefinition(system.runtimeDefinition);
      localStorage.setItem('file', system.value);
      const direct = ['hand', 'hand0205', 'handGlove115200', 'handGloveFullPacket'].includes(system.value);
      setDirectEntry(direct);
      setPhase('entering');
      const [module] = await Promise.all([
        prepareSystem(),
        direct ? undefined : transitionSceneFraming(sceneRootRef.current, () => flushSync(() => {
          setSceneExpanded(true);
          setPreviewVisible(true);
          setPhase('entering');
        }), controller.signal),
      ]);
      if (controller.signal.aborted) return;
      if (!module?.default) throw new Error('Missing monitoring component');
      setMonitoringModule(module);
      if (!direct) setPhase('idle');
    } catch {
      if (controller.signal.aborted) return;
      cancelNavigation();
      setPhase('idle');
      setError('监测页面加载失败，系统切换已确认，请重试进入。');
    }
  }, [prepareSystem, cancelNavigation]);

  /** 直接交接返回原位，不再追加镜头缩小；未完成的页面加载也可取消。 */
  const returnToSelector = () => {
    if (directEntry) {
      cancelNavigation();
      setPhase('idle');
      requestAnimationFrame(() => previewHost?.closest('.system-selector-panel')?.querySelector('.system-option.is-active')?.focus({ preventScroll: true }));
      return;
    }
    navigationRef.current?.abort();
    const controller = new AbortController();
    navigationRef.current = controller;
    void transitionSceneFraming(sceneRootRef.current, () => flushSync(() => {
      setMonitoringModule(null);
      setPreviewVisible(true);
      setSceneExpanded(false);
      setPhase('idle');
    }), controller.signal, 'preview');
  };

  useEffect(() => {
    entryRef.current = createPortalEntry({
      activate: (key) => commandClient.execute('license.activate', { key, startTime: Date.now() }),
      switchSystem: (sensorType) => commandClient.execute('sensor.switch', { sensorType }),
      onPhase: setPhase,
      onError: setError,
      onEntered: enterMonitoringPage,
    });
    return () => { entryRef.current?.cancel(); entryRef.current = null; navigationRef.current?.abort(); };
  }, [enterMonitoringPage]);

  const handleMessage = useCallback((data) => {
    if (!isObjectMessage(data)) return;
    const key = getLicenseKeyFromMessage(data);
    if (key && !keyRef.current.trim()) { keyRef.current = key; setAccessKey(key); }
    const nextScope = readPortalLicenseScope(data);
    if (nextScope !== undefined) setScope(nextScope);
    if (data.displaySystemsUpdated) setReload((value) => value + 1);
    entryRef.current?.receive(data);
  }, []);

  const handleDisconnect = useCallback(() => {
    cancelNavigation();
    entryRef.current?.cancel();
    setError('与应用的连接已断开，请等待重新连接后重试');
  }, [cancelNavigation]);

  const { connected } = useMainWebSocket({ onMessage: handleMessage, onClose: handleDisconnect, onError: handleDisconnect });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setCatalogError(false);
    requestJson('/api/display-systems', { signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(payload?.displaySystems?.runtimeDefinitions)) throw new Error('系统目录格式不正确');
        setRuntimeDefinitions(payload.displaySystems.runtimeDefinitions);
      })
      .catch(() => {
        if (!controller.signal.aborted) { setRuntimeDefinitions([]); setCatalogError(true); }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload, connected]);

  useEffect(() => {
    if (!selectorOpen) { entryRef.current?.cancel(); cancelNavigation(); }
    if (selectorOpen) hadSelectorOpenRef.current = true;
    if (!selectorOpen && hadSelectorOpenRef.current) {
      const target = returnFocusRef.current?.isConnected ? returnFocusRef.current : headingRef.current;
      const frame = requestAnimationFrame(() => target?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }
  }, [selectorOpen, cancelNavigation]);

  /** 将输入立即同步到 ref，防止后端回填覆盖刚输入的密钥。 */
  const changeKey = (key) => { keyRef.current = key; setAccessKey(key); setError(''); };

  /** 浏览器返回可回到首页；分类选择不会切换运行系统。 */
  const openCategory = (nextCategory) => {
    returnFocusRef.current = document.activeElement;
    setParams({ category: nextCategory, system: localStorage.getItem('file') || '' });
  };

  /** 配置器或后端确认切换系统后，让常驻模型同步真实系统身份。 */
  const syncMonitoringSystem = useCallback((system) => {
    setParams({ category: 'all', system }, { replace: true });
  }, [setParams]);

  /** 捕获列表原位投影；传入返回进度时同帧推进隐藏预览，接续其浮动相位。 */
  const capturePreview = useCallback((resumeProgress) => {
    const detail = { snapshot: null, resumeProgress };
    sceneRootRef.current?.dispatchEvent(new CustomEvent('system-scene:capture-particles', { detail }));
    return detail.snapshot;
  }, []);

  /** 首帧真正交接时才隐藏列表并结束准备态，慢加载不能先露出全屏预览。 */
  const changePreview = useCallback((visible) => {
    setPreviewVisible(visible);
    if (!visible) setPhase('idle');
  }, []);


  return <div ref={portalRef} className="fiber-portal">
    <main className="portal-page" inert={selectorOpen} aria-hidden={selectorOpen}>
      <PressureParticleField className="pressure-field" />
      <div ref={setHomeHost} className="portal-mushroom-ambient" aria-hidden="true" />
      <header className="portal-topbar">
        <div className="portal-brand"><img alt="Shroom" className="portal-logo" draggable={false} src={BRAND_LOGO_SRC} /></div>
        <div className="portal-topbar-actions">
          <div className={`portal-status ${connected ? 'is-online' : 'is-offline'}`} role="status">
            <span className="portal-status-dot" aria-hidden="true" />{connected ? '本机服务已连接' : '正在连接本机服务'}
          </div>
          <button type="button" className="portal-sdk-button" onClick={() => openCategory('all')} aria-haspopup="dialog"><AppstoreOutlined aria-hidden="true" /> 系统列表</button>
        </div>
      </header>
      <div className="portal-split">
        <div className="portal-content-column">
          <section className="portal-hero">
            <div className="portal-hero-tag"><SafetyCertificateOutlined aria-hidden="true" /> 柔性压力感知解决方案</div>
            <h1 tabIndex={-1} ref={headingRef}>Shroom Vision</h1>
            <p className="portal-hero-desc">让柔性压力数据实时可见，快速接入康养、座椅与具身触觉场景。</p>
          </section>
          <form className="portal-access" onSubmit={(event) => { event.preventDefault(); openCategory('all'); }}>
            <label className="portal-access-title" htmlFor="portal-home-key"><KeyOutlined aria-hidden="true" /> 访问密钥</label>
            <div className="portal-access-main">
              <input id="portal-home-key" value={accessKey} onChange={(event) => changeKey(event.target.value)} placeholder="输入密钥，或先浏览系统" autoComplete="off" />
              <button type="submit" className="portal-enter-button" aria-haspopup="dialog">选择系统 <ArrowRightOutlined aria-hidden="true" /></button>
            </div>
            <p className="portal-access-hint">进入所选系统时验证密钥；已保存密钥由本机服务回填。</p>
          </form>
          <section className="portal-grid" aria-label="场景分类">
            {PORTAL_CATEGORIES.map((item) => {
              const Icon = CATEGORY_ICONS[item.key];
              return <article key={item.key} className="portal-card">
                <button type="button" className="portal-card-action" onClick={() => openCategory(item.key)} aria-haspopup="dialog">
                  <span className="portal-card-icon"><Icon aria-hidden="true" /></span>
                  <span className="portal-card-title"><strong>{item.title}</strong><small>{item.description}</small></span>
                  <ArrowRightOutlined className="portal-card-arrow" aria-hidden="true" />
                </button>
              </article>;
            })}
          </section>
        </div>
        <div className="portal-visual-column" aria-hidden="true" />
      </div>
      <span className="portal-home-scene-status" role="status">{sceneStatus.state === 'unavailable' ? '当前设备无法显示 3D 预览，仍可选择系统' : sceneStatus.state === 'error' ? '场景模型加载失败，仍可选择系统' : '粒子场景预览 · 非实时数据'}</span>
      {!selectorOpen && <FeedbackWidget accessKey={accessKey} activeSolution="care" />}
    </main>
    <PortalSystemSelector open={selectorOpen} systems={systems} category={activeCategory} selectedId={params.get('system')}
      scope={scope} phase={phase} error={error} loading={loading} catalogError={catalogError} accessKey={accessKey}
      sceneStatus={sceneStatus} onPreview={setPreviewSystem} onHost={setPreviewHost} expanded={sceneExpanded} onReturnToSelector={returnToSelector}
      monitoring={Boolean(monitoringModule)} dataView={!previewVisible} directEntry={directEntry}
      runtime={monitoringModule && <PortalMonitoringLayer component={monitoringModule.default}
        system={previewSystem} directEntry={directEntry} capturePreview={capturePreview} onPreviewChange={changePreview} onBack={returnToSelector} onSystemChange={syncMonitoringSystem} />}
      onKeyChange={changeKey} onReload={() => setReload((value) => value + 1)}
      onBack={() => setParams({})}
      onCategory={(next) => setParams({ category: next }, { replace: true })}
      onSelect={(system) => { setError(''); setParams({ category: activeCategory, system }, { replace: true }); }}
      onEnter={(system) => entryRef.current?.begin({ system, key: accessKey, connected })} />
    <SystemScenePreview activeScene={selectorOpen ? getPortalScene(previewSystem) : 'shroom'}
      active={directEntry ? previewVisible : !sceneExpanded || previewVisible}
      host={selectorOpen ? previewHost : homeHost} framing={selectorOpen ? sceneExpanded ? 'focused' : 'preview' : 'home'} onStatus={setSceneStatus}
      onRootReady={(root) => { sceneRootRef.current = root; }} />
  </div>;
}
