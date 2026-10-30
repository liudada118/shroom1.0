import { useEffect, useState } from 'react';
import { Button, Checkbox, Modal } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getLanguageLocale } from '../../i18n';
import { trackUsage } from '../../services/usageAnalytics';
import { describeRendererError } from '../../services/errorDiagnostics';

/** Keep the last verified update outcome visible after reopening settings or restarting the app. */
export function FrontendUpdateStatus({ frontend = {} }) {
  const { t, i18n } = useTranslation();
  const development = frontend.source === 'development';
  if (development) return <p role="status">{t('appUi.development')}</p>;
  const failed = !frontend.checking && ['unavailable', 'host-update-required', 'installer-update-required'].includes(frontend.lastCheckResult);
  const message = frontend.checking ? t('appUi.checking')
    : frontend.lastMessage || frontend.message || (frontend.pendingReleaseId ? t('appUi.cached') : t('appUi.unchecked'));
  return <div>
    <p role={failed ? 'alert' : 'status'}>{message}</p>
    {frontend.lastCheckedAt && <p>{t('appUi.lastCheck', { time: new Date(frontend.lastCheckedAt).toLocaleString(getLanguageLocale(i18n.language)) })}</p>}
    {frontend.pendingReleaseId && <p>{t('appUi.pendingRelease', { id: frontend.pendingReleaseId })}</p>}
    {frontend.lastErrorCode && <details><summary>{t('appUi.diagnostics')}</summary><p>{frontend.lastErrorCode}</p></details>}
  </div>;
}

/** Keep development pages out of the signed webpage update flow without hiding production failures. */
export function FrontendUpdateControls({ frontend = {}, pending = false, onCheck }) {
  const { t } = useTranslation();
  const development = frontend.source === 'development';
  return <>
    <h3>{t('appUi.webpageUpdates')}</h3>
    {!development && <p>{t('appUi.webpageScope')}</p>}
    <FrontendUpdateStatus frontend={frontend} />
    <Button disabled={pending || frontend.checking || frontend.updateSupported === false} onClick={onCheck}>
      {development ? t('appUi.developmentCheck') : frontend.checking ? t('appUi.checkingShort') : t('appUi.check')}
    </Button>
  </>;
}

/** Show the installed host and the actual webpage, without treating shell readiness as device acceptance. */
export function RuntimeVersionDetails({ frontend = {}, runtimeVersions = {} }) {
  const { t, i18n } = useTranslation();
  const development = frontend.source === 'development';
  return <dl>
    <dt>{t('appUi.software')}</dt><dd>{frontend.appVersion || t('appUi.unread')} · {t('appUi.hostContract', { version: frontend.hostContract || t('common.unknown') })}</dd>
    <dt>{t('appUi.webpage')}</dt><dd>{development ? t('appUi.developmentSource') : <>{frontend.source === 'cache' ? t('appUi.cacheSource') : frontend.source === 'packaged' ? t('appUi.packagedSource') : t('appUi.unread')} · {t('appUi.build', { id: frontend.activeBuildId || t('common.unknown') })} · {t('appUi.release', { id: frontend.activeReleaseId || (frontend.source === 'packaged' ? t('appUi.bundled') : t('common.unknown')) })}</>}</dd>
    <dt>{t('appUi.bootStatus')}</dt><dd>{development ? t('appUi.developmentBoot') : frontend.bootPending === true ? t('appUi.bootPending') : frontend.bootPending === false ? t('appUi.bootConfirmed') : t('appUi.bootUnread')}</dd>
    {!development && frontend.lastRollbackAt && <><dt>{t('appUi.rollback')}</dt><dd>{new Date(frontend.lastRollbackAt).toLocaleString(getLanguageLocale(i18n.language))} · {frontend.lastRollbackReason}</dd></>}
    {runtimeVersions.systemPackageVersion && <><dt>{t('appUi.systemPackage')}</dt><dd>{runtimeVersions.systemPackageVersion}</dd></>}
    {runtimeVersions.serverContractVersion && <><dt>{t('appUi.serverContract')}</dt><dd>{runtimeVersions.serverContractVersion}</dd></>}
  </dl>;
}

/** Show known telemetry gaps separately from successful upload, without interpreting silence as health. */
export function UsageDeliveryDetails({ usage = {} }) {
  const { t } = useTranslation();
  const quality = usage.quality;
  if (!quality) return null;
  return <div role="status">
    <p>{t('appUi.qualityLoss', { dropped: quality.droppedCount || 0, invalid: quality.invalidCount || 0,
      storage: quality.storageFailureCount || 0 })}</p>
    <p>{t('appUi.qualityLimits')}</p>
    {usage.startupDiagnostics?.removed && <p>{t('appUi.startupQualityLoss', {
      count: Object.values(usage.startupDiagnostics.removed).reduce((sum, count) => sum + (Number.isFinite(count) ? count : 0), 0),
    })}</p>}
  </div>;
}

/** Show webpage update and diagnostic controls together, with persistent status and recoverable errors. */
export default function AppServices({ onAfterDialogClose } = {}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false), [state, setState] = useState({ frontend: {}, usage: {} });
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const api = window.electronAPI?.services;
  useEffect(() => {
    if (!api) return;
    let active = true;
    void api.invoke('status').then(value => { if (active) setState(value); }).catch(() => {});
    void api.invoke('frontendReady').catch(() => {});
    const unsubscribe = api.subscribe(value => { if (active) setState(value); });
    /** Report browser failures while retaining normal browser error behavior. */
    const onError = event => trackUsage('error_reported', describeRendererError(event));
    window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onError);
    return () => { active = false; unsubscribe(); window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onError); };
  }, [api]);

  /** Keep the current setting visible when persistence or IPC fails. */
  async function action(name, input = {}) {
    setPending(true); setError('');
    try {
      const result = await api.invoke(name, input);
      setState(previous => ({ ...previous, [name === 'checkFrontend' ? 'frontend' : 'usage']: result }));
    } catch { setError('appUi.actionFailed'); }
    finally { setPending(false); }
  }

  if (!api) return null;
  return <>
    {/* 说明可直接转入设置，退场时不把焦点从新弹窗抢回旧入口。 */}
    <Modal title={t('appUi.noticeTitle')} open={Boolean(state.usage.noticePending)} onCancel={() => action('acknowledgeUsageNotice')} focusTriggerAfterClose={false} afterClose={onAfterDialogClose} footer={null}>
      <p>{t('appUi.notice', { status: t(state.usage.enabled ? 'appUi.enabled' : 'appUi.disabled') })}</p>
      <Button disabled={pending} onClick={() => action('acknowledgeUsageNotice')}>{t('appUi.acknowledge')}</Button>
      <Button disabled={pending} onClick={() => { void action('acknowledgeUsageNotice'); setOpen(true); }}>{t('appUi.viewSettings')}</Button>
    </Modal>
    <Button className="shroom-app-tool shroom-app-services" icon={<SettingOutlined />} onClick={() => setOpen(true)} aria-label={t('appUi.settingsLabel')}>{t('appUi.settings')}</Button>
    <Modal title={t('appUi.settings')} open={open} onCancel={() => setOpen(false)} afterClose={onAfterDialogClose} footer={null}>
      <FrontendUpdateControls frontend={state.frontend} pending={pending} onCheck={() => action('checkFrontend')} />
      <h3>{t('appUi.runningVersions')}</h3>
      <RuntimeVersionDetails frontend={state.frontend} runtimeVersions={state.runtimeVersions} />
      <h3 style={{ marginTop: 24 }}>{t('appUi.usage')}</h3>
      <Checkbox checked={Boolean(state.usage.enabled)} disabled={pending} onChange={event => action('setUsageEnabled', { enabled: event.target.checked })}>{t('appUi.uploadUsage')}</Checkbox>
      <p>{t('appUi.usageScope')}</p>
      <p>{t('appUi.retention')}</p>
      <p role="status">{t('appUi.queued', { count: state.usage.queued || 0 })}{state.usage.lastSuccessAt ? ` · ${t('appUi.lastUpload', { time: new Date(state.usage.lastSuccessAt).toLocaleString(getLanguageLocale(i18n.language)) })}` : ''}</p>
      <UsageDeliveryDetails usage={state.usage} />
      {(error || state.usage.lastError) && <p role="alert">{error ? t(error) : state.usage.lastError}</p>}
      <Button disabled={pending || !state.usage.enabled} onClick={() => action('retryUsage')}>{t('appUi.retry')}</Button>
    </Modal>
  </>;
}
