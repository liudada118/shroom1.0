import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowRightOutlined, AppstoreOutlined, SafetyCertificateOutlined, HeartOutlined, CarOutlined, RobotOutlined, ExperimentOutlined, KeyOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useMainWebSocket from '../../services/ws/useMainWebSocket';
import { getLicenseKeyFromMessage, hasValidLicenseDate, isExpiredLicenseMessage, isObjectMessage } from '../../services/ws/messages';
import { readLicenseAccess, isHistoryOnlyLicense } from '../../services/licenseAccess';
import { commandClient } from '../../services/command/commandClient';
import { requestJson } from '../../extensions/display-system/api';
import { registerRuntimeDisplayDefinition } from '../../displays/registry';
import { syncNativeSystemTemplates } from '../../displays/nativeSystemTemplates';
import BRAND_LOGO_SRC from '../../assets/开屏IMG/shroom-vision-logo.png';
import { FeedbackWidget } from './LicensePortalWidgets';
import { PORTAL_CATEGORIES, buildPortalSystems, describeCompanySystemSync, needsCompanySystemSync, readPortalLicenseScope } from './portalSystems';
import { createPortalEntry } from './portalEntry';
import PortalSystemSelector from './PortalSystemSelector';
import './PortalFeedback.css';
import SystemScenePreview from './scene/SystemScenePreview';
import PressureParticleField from './scene/PressureParticleField';
import { getPortalScene, supportsDirectSceneEntry } from './scene/sceneCatalog';
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
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [accessKey, setAccessKey] = useState('');
  const [scope, setScope] = useState(undefined);
  const [licenseAccess, setLicenseAccess] = useState(undefined);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [runtimeDefinitions, setRuntimeDefinitions] = useState([]);
  const [managedIds, setManagedIds] = useState([]);
  const [staffConfigured, setStaffConfigured] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncAttempt, setSyncAttempt] = useState(0);
  const syncedKeyRef = useRef('');
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [reload, setReload] = useState(0);
  const keyRef = useRef('');
  const keyEditedRef = useRef(false);
  const savedLicenseRef = useRef({ key: '', message: null, bootstrapped: false });
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

  /** 支持粒子交接的原生画布直接接续列表点阵；其他系统保留镜头过渡。 */
  const enterMonitoringPage = useCallback(async (system) => {
    const controller = new AbortController();
    navigationRef.current?.abort();
    navigationRef.current = controller;
    try {
      if (system.runtimeDefinition) registerRuntimeDisplayDefinition(system.runtimeDefinition);
      localStorage.setItem('file', system.value);
      const direct = supportsDirectSceneEntry(system);
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
      /** 进入公司系统前读取后端已验签、未过期且与当前密钥绑定的目录。 */
      getManagedIds: async (payload) => {
        const status = await requestJson('/api/system-packages/status');
        if (isHistoryOnlyLicense(readLicenseAccess(payload)) && isHistoryOnlyLicense(readLicenseAccess(status))) return status.historyAvailable || [];
        return (status.available || []).map((item) => item.systemId);
      },
      onPhase: setPhase,
      onError: setError,
      onEntered: enterMonitoringPage,
      onValidated: (nextScope, key, access) => {
        if (key === keyRef.current.trim()) { savedLicenseRef.current.bootstrapped = true; setScope(nextScope); setLicenseAccess(access); }
      },
      onInvalidated: () => { savedLicenseRef.current.message = null; setScope(undefined); setLicenseAccess(undefined); },
    });
    return () => { entryRef.current?.cancel(); entryRef.current = null; navigationRef.current?.abort(); };
  }, [enterMonitoringPage]);

  const handleMessage = useCallback((data) => {
    if (!isObjectMessage(data)) return;
    const key = getLicenseKeyFromMessage(data);
    if (key) {
      savedLicenseRef.current.key = key;
      if (!keyEditedRef.current && !keyRef.current.trim()) { keyRef.current = key; setAccessKey(key); }
    }
    const nextAccess = readLicenseAccess(data);
    if (nextAccess !== undefined) setLicenseAccess(nextAccess);
    const historyOnly = isHistoryOnlyLicense(nextAccess);
    const invalid = data.licenseLocked || (!historyOnly && (data.licenseError || data.valid === false || isExpiredLicenseMessage(data)))
      || (nextAccess !== undefined && !nextAccess.canReadHistory);
    if (invalid) {
      savedLicenseRef.current.message = null;
      setScope(undefined);
    } else if (!savedLicenseRef.current.bootstrapped && !keyEditedRef.current
      && hasValidLicenseDate(data) && readPortalLicenseScope(data) !== undefined) {
      savedLicenseRef.current.message = data;
    }
    // ⚠️ 用户编辑后只接受该次验证回执，后台旧密钥广播不能恢复已清空的列表。
    const saved = savedLicenseRef.current;
    if (!saved.bootstrapped && !keyEditedRef.current && saved.key && saved.key === keyRef.current.trim() && saved.message) {
      saved.bootstrapped = true;
      setScope(readPortalLicenseScope(saved.message));
    }
    if (data.displaySystemsUpdated) setReload((value) => value + 1);
    if (data.managedSystemAccessError) {
      setManagedIds([]);
      setSyncStatus(data.managedSystemAccessError);
      setError(data.managedSystemAccessError);
    }
    entryRef.current?.receive(data);
  }, []);

  const handleDisconnect = useCallback(() => {
    savedLicenseRef.current = { key: '', message: null, bootstrapped: false };
    setScope(undefined);
    setLicenseAccess(undefined);
    cancelNavigation();
    entryRef.current?.cancel();
    setError('与应用的连接已断开，请等待重新连接后重试');
  }, [cancelNavigation]);

  const { connected } = useMainWebSocket({ onMessage: handleMessage, onClose: handleDisconnect, onError: handleDisconnect });

  /** 员工维护入口只随本机令牌状态显示，客户使用系统仍走软件密钥授权。 */
  useEffect(() => {
    setStaffConfigured(false);
    if (!connected) return undefined;
    const controller = new AbortController();
    requestJson('/api/system-packages/staff-credential', { signal: controller.signal })
      .then((status) => { if (!controller.signal.aborted) setStaffConfigured(status.configured === true); })
      .catch(() => {});
    return () => controller.abort();
  }, [connected, selectorOpen, reload]);

  /** On a validated key, refresh the signed company catalog without blocking local systems. */
  useEffect(() => {
    const requestId = `${accessKey.trim()}:${syncAttempt}:${licenseAccess?.state || 'legacy'}`;
    if (scope === undefined || !connected || !accessKey.trim() || syncedKeyRef.current === requestId) return undefined;
    if (!needsCompanySystemSync(scope)) {
      syncedKeyRef.current = '';
      setManagedIds([]);
      setSyncStatus('');
      return undefined;
    }
    syncedKeyRef.current = requestId;
    let stopped = false;
    if (isHistoryOnlyLicense(licenseAccess)) {
      requestJson('/api/system-packages/status').then(status => {
        if (!stopped && isHistoryOnlyLicense(readLicenseAccess(status))) setManagedIds(status.historyAvailable || []);
      }).catch(() => {});
      setSyncStatus('授权已到期，仅可查看本机已有系统的历史数据；不下载更新。');
      return () => { stopped = true; };
    }
    requestJson('/api/system-packages/status').then((status) => {
      if (!stopped) setManagedIds((status.available || []).map((item) => item.systemId));
    }).catch(() => {});
    setSyncStatus('');
    requestJson('/api/system-packages/sync', { method: 'POST' }).then((result) => {
      if (stopped) return;
      setManagedIds((result.available || []).map((item) => item.systemId));
      setSyncStatus(describeCompanySystemSync(result));
      setReload((value) => value + 1);
    }).catch((failure) => {
      if (stopped) return;
      setSyncStatus(failure.code === 'SYSTEM_SYNC_HTTP_ERROR'
        ? '公司系统暂未同步；已授权的内置系统仍可使用。需要公司系统时，请检查发布与密钥授权。'
        : `公司系统暂未同步：${failure.message || '请稍后刷新重试'}。已授权的内置系统仍可使用。`);
    });
    return () => { stopped = true; };
  }, [scope, connected, accessKey, syncAttempt, licenseAccess]);

  useEffect(() => {
    const timer = setInterval(() => setSyncAttempt((value) => value + 1), 6 * 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    /** Agent 定位刚创建的系统时刷新已打开的目录；其他路由进入本页会自行加载。 */
    const refreshCreatedSystems = () => setReload((value) => value + 1);
    window.addEventListener('shroom:agent-display-systems-refresh', refreshCreatedSystems);
    return () => window.removeEventListener('shroom:agent-display-systems-refresh', refreshCreatedSystems);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setCatalogError(false);
    requestJson('/api/display-systems', { signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(payload?.displaySystems?.runtimeDefinitions)) throw new Error('系统目录格式不正确');
        syncNativeSystemTemplates(payload.displaySystems.runtimeDefinitions);
        setRuntimeDefinitions(payload.displaySystems.runtimeDefinitions);
      })
      .catch(() => {
        if (!controller.signal.aborted) { setRuntimeDefinitions([]); setCatalogError(true); }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload, connected]);

  /** Agent 的“进入系统”只触发一次，仍经密钥验证和现有切换命令；缺少密钥时留在目标列表。 */
  useEffect(() => {
    if (params.get('agentEnter') !== '1' || loading) return;
    const targetId = params.get('system');
    const target = systems.find((item) => item.value === targetId);
    if (!target) {
      setError('刚创建的系统暂未出现在列表，请刷新系统列表后重试。');
      setParams({ category: 'custom', system: targetId || '' }, { replace: true });
      return;
    }
    if (!accessKey.trim()) { setError('请输入访问密钥，验证后可进入该系统。'); return; }
    if (!connected) { setError('与应用的连接已断开，请等待重新连接后重试。'); return; }
    setParams({ category: 'custom', system: target.value }, { replace: true });
    entryRef.current?.begin({ system: target, key: accessKey, connected });
  }, [params, loading, systems, accessKey, connected, setParams]);

  useEffect(() => {
    if (!selectorOpen) { entryRef.current?.cancel(); cancelNavigation(); }
    if (selectorOpen) hadSelectorOpenRef.current = true;
    if (!selectorOpen && hadSelectorOpenRef.current) {
      const target = returnFocusRef.current?.isConnected ? returnFocusRef.current : headingRef.current;
      const frame = requestAnimationFrame(() => target?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }
  }, [selectorOpen, cancelNavigation]);

  /** 编辑密钥立即撤回旧目录，并使在途验证结果失效。 */
  const changeKey = (key) => {
    keyEditedRef.current = true;
    if (key.trim() !== keyRef.current.trim()) {
      entryRef.current?.cancel();
      savedLicenseRef.current.message = null;
      setScope(undefined);
      setLicenseAccess(undefined);
      setManagedIds([]);
      syncedKeyRef.current = '';
    }
    keyRef.current = key;
    setAccessKey(key);
    setError('');
  };

  /** 浏览器返回可回到首页；分类选择不会切换运行系统。 */
  const openCategory = (nextCategory) => {
    returnFocusRef.current = document.activeElement;
    setParams({ category: nextCategory, system: localStorage.getItem('file') || '' });
    if (scope === undefined && accessKey.trim()) entryRef.current?.validate({ key: accessKey, connected });
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
              <input id="portal-home-key" value={accessKey} onChange={(event) => changeKey(event.target.value)} placeholder="输入访问密钥" autoComplete="off" />
              <button type="submit" className="portal-enter-button" aria-haspopup="dialog">选择系统 <ArrowRightOutlined aria-hidden="true" /></button>
            </div>
            <p className="portal-access-hint">系统列表按密钥授权显示；已保存密钥由本机服务回填。</p>
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
      scope={scope} managedIds={managedIds} syncStatus={syncStatus} phase={phase} error={error} loading={loading} catalogError={catalogError} accessKey={accessKey}
      sceneStatus={sceneStatus} onPreview={setPreviewSystem} onHost={setPreviewHost} expanded={sceneExpanded} onReturnToSelector={returnToSelector}
      monitoring={Boolean(monitoringModule)} dataView={!previewVisible} directEntry={directEntry}
      runtime={monitoringModule && <PortalMonitoringLayer component={monitoringModule.default}
        licenseAccess={licenseAccess}
        system={previewSystem} directEntry={directEntry} capturePreview={capturePreview} onPreviewChange={changePreview} onBack={returnToSelector} onSystemChange={syncMonitoringSystem} />}
      onKeyChange={changeKey} onReload={() => { setReload((value) => value + 1); setSyncAttempt((value) => value + 1); }}
      onValidate={() => entryRef.current?.validate({ key: accessKey, connected })}
      onBack={() => setParams({})}
      onCategory={(next) => setParams({ category: next }, { replace: true })}
      onSelect={(system) => { setError(''); setParams({ category: activeCategory, system }, { replace: true }); }}
      onEnter={(system) => entryRef.current?.begin({ system, key: accessKey, connected })}
      onSubmit={(system) => navigate(`/display-systems?submitSystem=${encodeURIComponent(system.systemId)}`)}
      onRevise={staffConfigured ? (system) => navigate(`/display-systems?companySystem=${encodeURIComponent(system.systemId)}`) : undefined} />
    <SystemScenePreview activeScene={selectorOpen ? getPortalScene(previewSystem) : 'shroom'}
      active={directEntry ? previewVisible : !sceneExpanded || previewVisible}
      host={selectorOpen ? previewHost : homeHost} framing={selectorOpen ? sceneExpanded ? 'focused' : 'preview' : 'home'} onStatus={setSceneStatus}
      onRootReady={(root) => { sceneRootRef.current = root; }} />
  </div>;
}
