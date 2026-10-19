import { useEffect, useState } from 'react';
import { Button, Checkbox, Modal } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { trackUsage } from '../../services/usageAnalytics';

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
    <Button className="shroom-app-tool shroom-app-services" icon={<SettingOutlined />} onClick={() => setOpen(true)} aria-label="应用更新与使用统计设置">应用设置</Button>
    <Modal title="应用设置" open={open} onCancel={() => setOpen(false)} footer={null}>
      <h3>网页更新</h3>
      <p>无网时使用本地页面。新版完整缓存并校验后，下次启动使用；采集中保持当前页面。</p>
      <p role="status">{state.frontend.message || (state.frontend.pendingReleaseId ? '新版页面已缓存，下次启动生效。' : '当前使用本地页面。')}</p>
      <Button disabled={pending || state.frontend.checking} onClick={() => action('checkFrontend')}>{state.frontend.checking ? '正在检查…' : '检查网页更新'}</Button>
      <h3 style={{ marginTop: 24 }}>使用统计与错误上报</h3>
      <Checkbox checked={Boolean(state.usage.enabled)} disabled={pending} onChange={event => action('setUsageEnabled', { enabled: event.target.checked })}>上传使用统计与脱敏错误</Checkbox>
      <p>首次使用默认开启，可随时关闭。记录功能使用、操作结果和耗时，不上传聊天正文、附件或原始传感器数据。关闭后清除尚未上传的使用统计，已送达数据按服务器规则保存；升级软件会保留你的开关选择。</p>
      <p role="status">待上传 {state.usage.queued || 0} 条{state.usage.lastSuccessAt ? ` · 最近上传：${new Date(state.usage.lastSuccessAt).toLocaleString()}` : ''}</p>
      {(error || state.usage.lastError) && <p role="alert">{error || state.usage.lastError}</p>}
      <Button disabled={pending || !state.usage.enabled} onClick={() => action('retryUsage')}>立即重试上传</Button>
    </Modal>
  </>;
}
