import { useEffect, useRef, useState } from 'react';

const ENDPOINT = 'http://127.0.0.1:19245/api/algorithm-market';
export const EMPTY_MARKET = { packages: [], channels: [], instances: [], allowed: false };

/** 先解释禁用原因再展示开关，实际输入还会由后端再次校验。 */
export function packageDisabledReason(item, channel, snapshot) {
  if (!snapshot.allowed) return snapshot.reason || '当前不可启用';
  if (item.reserved) return '当前系统已内置运行';
  if (!channel?.live) return '请先连接传感器并接收数据';
  if (channel.inputError) return channel.inputError;
  if (!channel.matrix) return '已收到数据，但缺少矩阵尺寸；请检查传感器定义或线序配置';
  const totals = item.compatibility?.matrixTotals || [];
  if (totals.length && !totals.includes(channel.matrix.total)) return `需要 ${totals.join('/')} 点，当前 ${channel.matrix.total} 点`;
  const shapes = item.compatibility?.recommendedMatrices || [];
  if (shapes.length && !shapes.some((shape) => shape.rows === channel.matrix.rows && shape.cols === channel.matrix.cols)) return `需要 ${shapes.map((shape) => `${shape.rows}×${shape.cols}`).join('/')} 矩阵`;
  return '';
}

/** 呼吸哨兵和算法故障是状态，不作为负呼吸率或假波形画进队列。 */
export function packageMetricValue(packageId, metricId, metrics = {}) {
  const value = metrics[metricId];
  if (!Number.isFinite(value)) return { value: null, label: '等待算法输出' };
  if (packageId === 'mattress-vitals' && /respiration|heartRate/i.test(metricId) && metrics.onbedFilterHealthy === 0) return { value: null, label: '生命体征算法不可用' };
  if (/respirationRate|breathRate/i.test(metricId) && (value < 0 || (packageId === 'mattress-vitals' && value === 88))) return { value: null, label: value === 88 ? '检测中' : '尚未稳定' };
  return { value, label: '' };
}

/** 单请求有超时；轮询串行，慢后端不叠加请求。 */
async function requestMarket(body, signal) {
  const response = await fetch(ENDPOINT, { signal, ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '算法服务暂不可用');
  return data;
}

/** 会话开关只在后端确认后显示已启用；快照包含有界真实算法结果，不另建压力代理。 */
export function usePortalPackageRuntime(matrixName, open, configurationRevision = '') {
  const [snapshot, setSnapshot] = useState(EMPTY_MARKET);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const mounted = useRef(true);
  const mutation = useRef(null);
  const revision = useRef(0);
  const active = snapshot.instances.length > 0;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; mutation.current?.abort(); }; }, []);
  useEffect(() => {
    let stopped = false; let timer; let request;
    /** 关闭超市但算法仍启用时继续读取结果；卸载或换系统后忽略迟到响应。 */
    const poll = async () => {
      const requestRevision = revision.current;
      request = new AbortController();
      const timeout = setTimeout(() => request.abort(), 4000);
      try {
        const result = await requestMarket(null, request.signal);
        if (!stopped && requestRevision === revision.current && !mutation.current) {
          setSnapshot(result.sensorType === matrixName ? result : { ...EMPTY_MARKET, packages: result.packages, reason: '系统正在切换' });
          setError('');
        }
      } catch { if (!stopped) setError('算法服务未连接，请检查后端；不会使用压力趋势代替'); }
      finally { clearTimeout(timeout); if (!stopped && (open || active)) timer = setTimeout(poll, 500); }
    };
    poll();
    return () => { stopped = true; clearTimeout(timer); request?.abort(); };
  }, [matrixName, open, active, configurationRevision]);

  /** 只传包 ID 和通道身份，不能通过超市执行任意路径或 Python 代码。 */
  const toggle = async (packageId, channelId, enabled) => {
    if (mutation.current) return false;
    const controller = new AbortController(); mutation.current = controller;
    revision.current++;
    setBusy(packageId); setError('');
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const result = await requestMarket({ sensorType: matrixName, packageId, channelId, enabled }, controller.signal);
      if (mounted.current && result.sensorType === matrixName) setSnapshot(result);
      return true;
    } catch (problem) { if (mounted.current) setError(problem.name === 'AbortError' ? '操作超时，请刷新确认启用状态' : problem.message); return false; }
    finally { clearTimeout(timeout); mutation.current = null; if (mounted.current) setBusy(''); }
  };
  return { snapshot, error, busy, toggle };
}
