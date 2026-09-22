import React, { useEffect, useState } from 'react';
import { Alert, Button, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch } from 'antd';
import { requestJson } from './api';
import { unregisterNativeSystemTemplate } from '../../displays/nativeSystemTemplates';
import './NativeSystemEditor.css';

/** 编辑独立系统的持久配置；保存、进入和删除分别反馈结果。 */
export default function NativeSystemEditor({ system, packages = [], onSaved, onDeleted, onActivate, onClose }) {
  const [editor, setEditor] = useState(null);
  const [name, setName] = useState(system.name);
  const [configuration, setConfiguration] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedSystem, setSavedSystem] = useState(system);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    let stopped = false;
    requestJson(`/api/display-systems/${encodeURIComponent(system.id)}/editor`).then(({ editor: value }) => {
      if (stopped) return;
      setEditor(value); setName(value.builtinTemplate.name); setConfiguration(value.configuration);
    }).catch((cause) => { if (!stopped) setError(cause.message); });
    return () => { stopped = true; };
  }, [system.id]);

  /** 单次修改保留其他字段，未保存状态明确提示。 */
  function change(patch) { setConfiguration((value) => ({ ...value, ...patch })); setSaved(false); }

  /** 保存完整配置并接收新修订号，冲突时保留用户输入。 */
  async function save() {
    if (busy) return;
    setBusy('save'); setError('');
    try {
      const { result } = await requestJson(`/api/display-systems/${encodeURIComponent(system.id)}/native`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, configuration, expectedRevision: editor.revision }),
      });
      setEditor(result.editor); setConfiguration(result.editor.configuration); setName(result.editor.builtinTemplate.name); setSaved(true);
      setSavedSystem(result.displaySystem);
      await onSaved(result.displaySystem);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(''); }
  }

  /** 仅移除这个系统的配置；服务端拒绝删除当前正在使用的系统。 */
  async function remove() {
    if (busy) return;
    setBusy('delete'); setError('');
    try {
      await requestJson(`/api/display-systems/${encodeURIComponent(system.id)}/native`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: editor.revision }) });
      unregisterNativeSystemTemplate(system.id);
      await onDeleted(system.id); onClose();
    } catch (cause) { setError(cause.message); }
    finally { setConfirmDelete(false); setBusy(''); }
  }

  const algorithms = configuration?.algorithms || [];
  const charts = configuration?.charts || [];
  const dirty = editor && (name !== editor.builtinTemplate.name || JSON.stringify(configuration) !== JSON.stringify(editor.configuration));
  const eligible = packages.filter((item) => item.attachable !== false && item.packageManifest?.input?.mode !== 'multi-sensor'
    && (!item.systemId || item.systemId === system.id)
    && (!item.compatibility?.matrixTotals?.length || item.compatibility.matrixTotals.includes(editor?.inputs?.matrix?.total))
    && (!item.compatibility?.recommendedMatrices?.length || item.compatibility.recommendedMatrices.some((shape) => shape.rows === editor?.inputs?.matrix?.rows && shape.cols === editor?.inputs?.matrix?.cols)));

  /** 添加一个独立算法绑定；不要求设备在线，运行时仍会校验真实帧。 */
  function addAlgorithm() {
    const item = eligible.find((entry) => !algorithms.some((binding) => binding.packageId === entry.id));
    if (item && editor.inputs.channels[0]) change({ algorithms: [...algorithms, { packageId: item.id, sensorId: editor.inputs.channels[0], enabled: true }] });
  }

  /** 为已配置算法添加真实输出图表。 */
  function addChart() {
    const binding = algorithms.find((entry) => packages.some((item) => item.id === entry.packageId && item.metricDefinitions?.length));
    if (!binding) return;
    const metric = packages.find((item) => item.id === binding.packageId).metricDefinitions[0];
    change({ charts: [...charts, { id: `chart-${crypto.randomUUID()}`, name: `${metric.label}趋势`, packageId: binding.packageId, metricId: metric.id, color: '#20B486', decimals: metric.decimals }] });
  }

  /** 修改一个图表，保持 ID、顺序及其他图表不变。 */
  function changeChart(id, patch) { change({ charts: charts.map((chart) => chart.id === id ? { ...chart, ...patch } : chart) }); }

  return <Modal className="display-builder-modal native-system-editor" open width={760} title={`编辑系统 · ${system.name}`} onCancel={() => !busy && onClose()} maskClosable={!busy}
    footer={<Space wrap>
      <Popconfirm title="删除这个系统？" description="系统将从列表移除，采集数据保留。正在使用的系统需先切换。" open={confirmDelete} onOpenChange={(open) => !busy && setConfirmDelete(open)} onConfirm={remove} okText="删除系统" cancelText="取消" okButtonProps={{ loading: busy === 'delete' }}><Button danger disabled={!editor || Boolean(busy)}>删除系统</Button></Popconfirm>
      <Button onClick={onClose} disabled={Boolean(busy)}>关闭</Button>
      <Button disabled={!editor || Boolean(busy) || dirty} onClick={async () => { setBusy('enter'); try { await onActivate(savedSystem); onClose(); } catch (cause) { setError(cause.message); } finally { setBusy(''); } }}>进入系统</Button>
      <Button type="primary" loading={busy === 'save'} disabled={!editor || Boolean(busy)} onClick={save}>保存更改</Button>
    </Space>}>
    <p>系统 ID：{system.id}。算法和图表独立保存，修改后点击“保存更改”。</p>
    {error && <Alert type="error" showIcon message={error} />}
    {saved && !dirty && <Alert type="success" showIcon message="已保存，当前系统会更新算法和图表配置。" />}
    {!configuration ? <p role="status">正在读取系统配置…</p> : <fieldset disabled={Boolean(busy)}>
      <label>系统名称<Input aria-label="系统名称" value={name} maxLength={100} onChange={(event) => { setName(event.target.value); setSaved(false); }} /></label>
      <Space wrap><label>压力图表 <Switch aria-label="显示压力图表" checked={configuration.showPressure} onChange={(showPressure) => change({ showPressure })} /></label><label>面积图表 <Switch aria-label="显示面积图表" checked={configuration.showArea} onChange={(showArea) => change({ showArea })} /></label></Space>
      <h3>算法</h3>
      <p>选择输入通道后，算法在收到兼容实时数据时运行。删除算法会同时删除绑定的图表。</p>
      {algorithms.map((binding) => {
        const item = packages.find((entry) => entry.id === binding.packageId);
        return <div className="native-system-editor-row" key={binding.packageId}>
          <div><strong>{item?.name || binding.packageId}</strong><small>{item?.sampleRateHz ? `参考采样率 ${item.sampleRateHz} Hz` : ''}</small></div>
          <Select disabled={Boolean(busy)} aria-label={`${binding.packageId}输入通道`} value={binding.sensorId} options={(editor.inputs?.channels || []).map((id) => ({ value: id, label: id }))} onChange={(sensorId) => change({ algorithms: algorithms.map((entry) => entry.packageId === binding.packageId ? { ...entry, sensorId } : entry) })} />
          <Switch aria-label={`启用${binding.packageId}`} checked={binding.enabled} onChange={(enabled) => change({ algorithms: algorithms.map((entry) => entry.packageId === binding.packageId ? { ...entry, enabled } : entry) })} />
          <Button danger onClick={() => change({ algorithms: algorithms.filter((entry) => entry.packageId !== binding.packageId), charts: charts.filter((chart) => chart.packageId !== binding.packageId) })}>删除算法</Button>
        </div>;
      })}
      <Space wrap><Select aria-label="添加算法包" placeholder="选择要添加的算法" value={null} style={{ minWidth: 240 }} disabled={Boolean(busy) || !editor.inputs?.channels?.length || algorithms.length >= 8}
        options={eligible.filter((item) => !algorithms.some((entry) => entry.packageId === item.id)).map((item) => ({ value: item.id, label: item.name }))}
        onChange={(packageId) => change({ algorithms: [...algorithms, { packageId, sensorId: editor.inputs.channels[0], enabled: true }] })} />
        {!eligible.length && <span>当前目录没有匹配此输入尺寸的算法。</span>}
        <Button onClick={addAlgorithm} disabled={!editor.inputs?.channels?.length || !eligible.some((item) => !algorithms.some((entry) => entry.packageId === item.id)) || algorithms.length >= 8}>添加兼容算法</Button></Space>
      <h3>算法图表</h3>
      {charts.map((chart) => {
        const item = packages.find((entry) => entry.id === chart.packageId);
        return <div className="native-system-chart-editor" key={chart.id}>
          <label>图表名称<Input aria-label={`${chart.id}图表名称`} value={chart.name} maxLength={100} onChange={(event) => changeChart(chart.id, { name: event.target.value })} /></label>
          <label>算法<Select disabled={Boolean(busy)} aria-label={`${chart.id}算法`} value={chart.packageId} options={algorithms.map((entry) => ({ value: entry.packageId, label: packages.find((candidate) => candidate.id === entry.packageId)?.name || entry.packageId }))} onChange={(packageId) => changeChart(chart.id, { packageId, metricId: packages.find((entry) => entry.id === packageId)?.metricDefinitions?.[0]?.id || '' })} /></label>
          <label>输出指标<Select disabled={Boolean(busy)} aria-label={`${chart.id}输出指标`} value={chart.metricId} options={(item?.metricDefinitions || []).map((entry) => ({ value: entry.id, label: `${entry.label}${entry.unit ? `（${entry.unit}）` : ''}` }))} onChange={(metricId) => changeChart(chart.id, { metricId })} /></label>
          <label>颜色<Input aria-label={`${chart.id}颜色`} type="color" value={chart.color} onChange={(event) => changeChart(chart.id, { color: event.target.value })} /></label>
          <label>小数位<InputNumber aria-label={`${chart.id}小数位`} min={0} max={6} value={chart.decimals} onChange={(decimals) => changeChart(chart.id, { decimals })} /></label>
          <Button danger onClick={() => change({ charts: charts.filter((entry) => entry.id !== chart.id) })}>删除图表</Button>
        </div>;
      })}
      <Button onClick={addChart} disabled={!algorithms.length || charts.length >= 12}>添加算法图表</Button>
      {!charts.length && <p>图表支持连续显示算法标量，例如“呼吸率趋势（次/分）”。</p>}
      {dirty && <p role="status">有未保存的修改。</p>}
    </fieldset>}
  </Modal>;
}
