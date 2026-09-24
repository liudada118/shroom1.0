import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { getNativeSystemTemplate, selectedNativeSystemId, subscribeNativeSystemTemplates, registerNativeSystemTemplate } from '../../displays/nativeSystemTemplates';
import { requestJson } from '../../extensions/display-system/api';
import { usePortalPackageRuntime } from '../../page/licensePortal/portalPackageRuntime';
import PortalPackageOutputs from '../../page/licensePortal/PortalPackageOutputs';
import '../../page/licensePortal/PortalAlgorithmMarket.css';

/** 在原有图表区显示此系统保存的算法图表；没有输出时显示等待，不替换为压力。 */
function ConfiguredOutputs({ template, onConfigurationChange }) {
  const configuration = template.configuration;
  const market = usePortalPackageRuntime(template.id, Boolean(configuration?.algorithms?.length || configuration?.charts?.length), template.revision);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const snapshot = market.snapshot.sensorType === template.id ? market.snapshot : null;
  const charts = configuration?.charts || [];

  /** 删除前读取当前版本，只移除用户点击的图表，其他配置保持原样。 */
  async function removeChart(id) {
    if (busy) return;
    setBusy(id); setError('');
    try {
      if (template.kind === 'manifest') {
        const route = `/api/display-systems/${encodeURIComponent(template.id)}/algorithm-bindings`;
        const { result: current } = await requestJson(route);
        const { result } = await requestJson(route, { method: 'PATCH', body: JSON.stringify({ expectedRevision: current.revision,
          configuration: { ...current.configuration, charts: current.configuration.charts.filter((entry) => entry.id !== id) } }) });
        onConfigurationChange?.(result);
        window.dispatchEvent(new CustomEvent('shroom-display-systems-updated'));
        return;
      }
      const { editor } = await requestJson(`/api/display-systems/${encodeURIComponent(template.id)}/editor`);
      const { result } = await requestJson(`/api/display-systems/${encodeURIComponent(template.id)}/native`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: editor.revision, name: editor.builtinTemplate.name,
          configuration: { ...editor.configuration, charts: editor.configuration.charts.filter((entry) => entry.id !== id) } }),
      });
      registerNativeSystemTemplate(result.displaySystem.runtimeDefinition.builtinTemplate);
      window.dispatchEvent(new CustomEvent('shroom-display-systems-updated'));
    } catch (cause) { setError(cause.message); }
    finally { setBusy(''); }
  }

  return <>{error && <p role="alert">{error}</p>}{charts.map((chart) => {
    const item = snapshot?.packages.find((entry) => entry.id === chart.packageId);
    if (!item) return <section className="portal-package-output" key={chart.id}><strong>{chart.name}</strong><p>{market.error || (snapshot ? '算法包不可用，请检查系统配置。' : '正在读取算法状态…')}</p></section>;
    const binding = configuration.algorithms.find((entry) => entry.packageId === chart.packageId);
    const configured = snapshot.configuredAlgorithms?.find((entry) => entry.packageId === chart.packageId);
    const running = snapshot.instances.find((entry) => entry.id === chart.packageId && entry.managed);
    const instance = (binding?.enabled && running) || { history: [], status: 'waiting', error: !binding?.enabled ? '算法已停用' : configured?.error || snapshot.reason || '等待兼容实时数据', dropped: 0 };
    return <PortalPackageOutputs key={chart.id} item={item} instance={instance} chart={chart}
      channelLabel={binding?.sensorId} offline={Boolean(market.error)} busy={Boolean(busy)} onRemove={() => removeChart(chart.id)} />;
  })}</>;
}

/** Manifest 监测工作区在相同侧栏显示系统算法图表，系统切换后立即丢弃旧结果。 */
export function ManifestSystemOutputs({ systemId }) {
  const [binding, setBinding] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    /** Agent 应用绑定后重新读取当前系统的图表配置。 */
    const refresh = async () => {
      try {
        const { result } = await requestJson(`/api/display-systems/${encodeURIComponent(systemId)}/algorithm-bindings`);
        if (active) { setBinding(result); setError(''); }
      } catch (cause) { if (active) { setBinding(null); setError([403, 404].includes(cause.status) ? '' : cause.message); } }
    };
    setBinding(null); refresh();
    window.addEventListener('shroom-display-systems-updated', refresh);
    return () => { active = false; window.removeEventListener('shroom-display-systems-updated', refresh); };
  }, [systemId]);
  return <>{error && <p role="alert">{error}</p>}{binding?.configuration?.charts?.length ? <ConfiguredOutputs
    key={`${systemId}:${binding.revision}`} template={{ ...binding, id: systemId, kind: 'manifest' }} onConfigurationChange={setBinding} /> : null}</>;
}

/** 目录更新后按独立 ID 刷新，同一原生型号的两个副本不会共用结果。 */
export default function NativeSystemOutputs({ matrixName }) {
  const template = useSyncExternalStore(subscribeNativeSystemTemplates,
    () => getNativeSystemTemplate(selectedNativeSystemId(matrixName)), () => null);
  return template ? <ConfiguredOutputs key={template.id} template={template} /> : null;
}
