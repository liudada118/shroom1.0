import { useEffect, useState } from 'react';
import { Button, Checkbox, Modal } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { trackUsage } from '../../services/usageAnalytics';

/** Keep the last verified update outcome visible after reopening settings or restarting the app. */
export function FrontendUpdateStatus({ frontend = {} }) {
  const development = frontend.source === 'development';
  if (development) return <p role="status">当前为开发版，页面由本地开发服务更新，无需检查网页更新。</p>;
  const failed = !frontend.checking && ['unavailable', 'host-update-required', 'installer-update-required'].includes(frontend.lastCheckResult);
  const message = frontend.checking ? '正在检查网页版本，请稍候…'
    : frontend.lastMessage || frontend.message || (frontend.pendingReleaseId ? '新版页面已缓存，下次启动生效。' : '尚未检查网页更新，当前使用本地页面。');
  return <div>
    <p role={failed ? 'alert' : 'status'}>{message}</p>
    {frontend.lastCheckedAt && <p>最近检查：{new Date(frontend.lastCheckedAt).toLocaleString()}</p>}
    {frontend.pendingReleaseId && <p>待启用发布：{frontend.pendingReleaseId}。请在结束采集后关闭并重新打开软件。</p>}
    {frontend.lastErrorCode && <details><summary>更新诊断信息</summary><p>{frontend.lastErrorCode}</p></details>}
  </div>;
}

/** Keep development pages out of the signed webpage update flow without hiding production failures. */
export function FrontendUpdateControls({ frontend = {}, pending = false, onCheck }) {
  const development = frontend.source === 'development';
  return <>
    <h3>网页更新</h3>
    {!development && <p>仅更新页面，本机后端能力需通过“安装包更新”升级。无网时使用本地页面；新版完整缓存并校验后，下次启动使用，采集中保持当前页面。</p>}
    <FrontendUpdateStatus frontend={frontend} />
    <Button disabled={pending || frontend.checking || frontend.updateSupported === false} onClick={onCheck}>
      {development ? '开发版无需网页更新' : frontend.checking ? '正在检查…' : '检查网页更新'}
    </Button>
  </>;
}

/** Show the installed host and the actual webpage, without treating shell readiness as device acceptance. */
export function RuntimeVersionDetails({ frontend = {}, runtimeVersions = {} }) {
  const development = frontend.source === 'development';
  return <dl>
    <dt>软件</dt><dd>{frontend.appVersion || '待读取'} · 宿主契约 {frontend.hostContract || '未知'}</dd>
    <dt>网页</dt><dd>{development ? '本地开发服务 · 无需网页缓存发布' : <>{frontend.source === 'cache' ? '验证缓存' : frontend.source === 'packaged' ? '安装包页面' : '待读取'} · 构建 {frontend.activeBuildId || '未知'} · 发布 {frontend.activeReleaseId || (frontend.source === 'packaged' ? '随安装包' : '未知')}</>}</dd>
    <dt>启动状态</dt><dd>{development ? '开发服务提供页面；设备功能需另行验收' : frontend.bootPending === true ? '候选页面等待外壳启动确认' : frontend.bootPending === false ? '外壳启动已确认；设备功能需另行验收' : '待读取；设备功能需另行验收'}</dd>
    {!development && frontend.lastRollbackAt && <><dt>最近回退</dt><dd>{new Date(frontend.lastRollbackAt).toLocaleString()} · {frontend.lastRollbackReason}</dd></>}
    {runtimeVersions.systemPackageVersion && <><dt>系统包</dt><dd>{runtimeVersions.systemPackageVersion}</dd></>}
    {runtimeVersions.serverContractVersion && <><dt>服务端契约</dt><dd>{runtimeVersions.serverContractVersion}</dd></>}
  </dl>;
}

/** Show webpage update and diagnostic controls together, with persistent status and recoverable errors. */
export default function AppServices() {
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
    const onError = event => trackUsage('error_reported', { module: 'renderer', errorType: event.type,
      severity: 'error', message: String(event.message || event.reason?.message || '页面运行异常'), stack: String(event.error?.stack || event.reason?.stack || '') });
    window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onError);
    return () => { active = false; unsubscribe(); window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onError); };
  }, [api]);

  /** Keep the current setting visible when persistence or IPC fails. */
  async function action(name, input = {}) {
    setPending(true); setError('');
    try {
      const result = await api.invoke(name, input);
      setState(previous => ({ ...previous, [name === 'checkFrontend' ? 'frontend' : 'usage']: result }));
    } catch { setError('操作未完成，请稍后重试。'); }
    finally { setPending(false); }
  }

  if (!api) return null;
  return <>
    <Modal title="使用统计与错误上报说明" open={Boolean(state.usage.noticePending)} onCancel={() => action('acknowledgeUsageNotice')} footer={null}>
      <p>使用统计与错误上报{state.usage.enabled ? '默认开启' : '已关闭'}，接收方为 shroom.jq-industries.com。只上传功能事件、耗时和脱敏错误，不包含聊天正文、附件或原始传感器数据；聊天同步与模型请求各自独立设置。</p>
      <Button disabled={pending} onClick={() => action('acknowledgeUsageNotice')}>已了解上报范围</Button>
      <Button disabled={pending} onClick={() => { void action('acknowledgeUsageNotice'); setOpen(true); }}>查看设置</Button>
    </Modal>
    <Button className="shroom-app-tool shroom-app-services" icon={<SettingOutlined />} onClick={() => setOpen(true)} aria-label="应用更新与使用统计设置">应用设置</Button>
    <Modal title="应用设置" open={open} onCancel={() => setOpen(false)} footer={null}>
      <FrontendUpdateControls frontend={state.frontend} pending={pending} onCheck={() => action('checkFrontend')} />
      <h3>当前运行版本</h3>
      <RuntimeVersionDetails frontend={state.frontend} runtimeVersions={state.runtimeVersions} />
      <h3 style={{ marginTop: 24 }}>使用统计与错误上报</h3>
      <Checkbox checked={Boolean(state.usage.enabled)} disabled={pending} onChange={event => action('setUsageEnabled', { enabled: event.target.checked })}>上传使用统计与脱敏错误</Checkbox>
      <p>首次使用默认开启，可随时关闭。记录功能使用、操作结果和耗时，不上传聊天正文、附件或原始传感器数据。关闭后清除尚未上传的使用统计，已送达数据按服务器规则保存；升级软件会保留你的开关选择。</p>
      <p>约定的使用统计保存目标为 90 天；实际清理执行状态请向管理员确认。</p>
      <p role="status">待上传 {state.usage.queued || 0} 条{state.usage.lastSuccessAt ? ` · 最近上传：${new Date(state.usage.lastSuccessAt).toLocaleString()}` : ''}</p>
      {(error || state.usage.lastError) && <p role="alert">{error || state.usage.lastError}</p>}
      <Button disabled={pending || !state.usage.enabled} onClick={() => action('retryUsage')}>立即重试上传</Button>
    </Modal>
  </>;
}
