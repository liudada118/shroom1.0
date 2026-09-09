import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, InputNumber, Modal, Select, Space, Table, Tag } from 'antd';
import { useTranslation } from 'react-i18next';

export default function HalowConnection({ status, result, connected, connectionEpoch, history, collecting, send }) {
  const { i18n } = useTranslation();
  const english = i18n.language?.startsWith('en');
  const text = (zh, en) => english ? en : zh;
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState(12345);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const applied = useRef(null);
  const running = Boolean(status?.running);
  const locked = !connected || Boolean(pending) || collecting || history !== 'now';
  const clients = status?.clients || [];
  const selected = clients.find(client => client.deviceId === status?.selectedDeviceId);

  function request(action, options = {}) {
    const requestId = `halow-${Date.now()}-${++sequence.current}`;
    setError('');
    if (!connected || !send({ halow: { action, ...options, requestId } })) {
      setError(text('与本地后台的连接已断开', 'Local backend disconnected'));
      return;
    }
    setPending({ requestId, action });
  }

  useEffect(() => {
    if (open && connected) request('status');
    // Only opening/reconnecting triggers a request; a status update must not loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, connected, connectionEpoch]);

  useEffect(() => {
    if (!connected) {
      setPending(null);
      applied.current = null;
    }
  }, [connected]);

  useEffect(() => {
    if (result?.requestId !== pending?.requestId || !pending) return;
    setPending(null);
    if (!result.ok) setError(result.message || text('操作失败', 'Operation failed'));
    if (result.ok && result.action === 'status') {
      setHost(status?.host || status?.addresses?.[0]?.address || '');
      setPort(status?.port || 12345);
    }
  }, [result, pending, status]);

  useEffect(() => {
    if (!pending) return undefined;
    const timer = setTimeout(() => {
      setPending(null);
      setError(text('后台响应超时，请重新读取状态', 'Backend timeout; refresh status'));
    }, 10000);
    return () => clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    if (!status) return;
    const key = `${status.phase}|${status.host}|${status.port}`;
    if (key === applied.current) return;
    applied.current = key;
    setHost(status.host || status.addresses?.[0]?.address || '');
    setPort(status.port || 12345);
  }, [status]);

  const statusText = !connected ? text('后台未连接', 'Backend disconnected')
    : !running ? text('未开启', 'Stopped')
      : !selected ? text('等待 B 板连接', 'Waiting for B board')
        : selected.ageMs === null ? text('ID 已识别，等待采集数据', 'ID received; waiting for data')
          : selected.ageMs > 2000 ? text('已连接，数据暂停', 'Connected; data paused')
            : text('正在接收', 'Receiving');

  return <>
    <Button className="titleButton" onClick={() => setOpen(true)}>
      {running && connected ? `HaLow · ${selected?.deviceId || text('等待连接', 'Waiting')}` : text('HaLow 连接', 'HaLow connection')}
    </Button>
    <Modal title={text('假人全身优化 · HaLow 数据连接', 'Full body · HaLow connection')}
      open={open} onCancel={() => setOpen(false)} footer={null} width={740} destroyOnClose={false}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert type="info" showIcon message={text('B 板主动连接电脑，渲染方式保持不变', 'B board connects to this computer; rendering stays unchanged')}
          description={text('选择网关对应的电脑 IP，端口须与 B 板一致。默认 192.168.100.2:12345。开启前请停止 Python 试用页或原厂软件的接收服务。',
            'Select the computer IP connected to the gateway and the port configured on the B board (default 192.168.100.2:12345). Stop other receivers first.')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 130px', gap: 12 }}>
          <label>{text('监听地址', 'Listen address')}
            <Select aria-label={text('HaLow 监听地址', 'HaLow listen address')} style={{ width: '100%' }}
              value={host || undefined} onChange={setHost} disabled={locked || running}
              options={(status?.addresses || []).map(item => ({ value: item.address,
                label: `${item.address} · ${item.name}${item.internal ? text('（仅本机测试）', ' (local test only)') : ''}` }))} />
          </label>
          <label>{text('TCP 端口', 'TCP port')}
            <InputNumber aria-label={text('HaLow TCP 端口', 'HaLow TCP port')} min={1} max={65535} precision={0}
              style={{ width: '100%' }} value={port} onChange={setPort} disabled={locked || running} />
          </label>
        </div>
        {host === '127.0.0.1' && <Alert type="warning" showIcon message={text('127.0.0.1 只能本机测试，真实 B 板无法连接此地址', '127.0.0.1 is for local tests; a real B board cannot connect to it')} />}
        {(collecting || history !== 'now') && <Alert type="warning" message={text('采集或回放期间不能启动连接或切换设备；停止接收始终可用', 'Starting or switching devices is disabled during recording/playback; stopping remains available')} />}
        {(error || status?.error) && <Alert type="error" showIcon message={error || status.error} />}
        <Space wrap>
          <Button type="primary" disabled={locked || running || !host || !port} loading={pending?.action === 'start'}
            onClick={() => request('start', { host, port })}>{text('开启 TCP 接收', 'Start TCP receiver')}</Button>
          <Button danger disabled={!connected || !running || Boolean(pending)} onClick={() => request('stop')}>{text('停止接收', 'Stop receiver')}</Button>
          <Button disabled={!connected || Boolean(pending)} onClick={() => request('status')}>{text('刷新状态', 'Refresh')}</Button>
          <Tag color={connected && selected && selected.ageMs !== null && selected.ageMs < 2000 ? 'success' : 'default'}>{statusText}</Tag>
        </Space>
        <div aria-live="polite">
          {text('累计接收', 'Received')}：{status?.receivedFrames || 0} {text('帧', 'frames')} · {status?.receivedBytes || 0} B
          {selected && ` · ${selected.fps} fps`}
        </div>
        <Table size="small" pagination={false} rowKey="clientId" dataSource={clients} scroll={{ x: 520 }}
          locale={{ emptyText: text('暂无连接，请让 B 板联网并连接上述地址', 'No connections; connect the B board to the address above') }}
          columns={[
            { title: text('设备 ID', 'Device ID'), dataIndex: 'deviceId', render: value => value || text('等待 ID', 'Waiting for ID') },
            { title: text('来源地址', 'Peer address'), dataIndex: 'address' },
            { title: text('帧数', 'Frames'), dataIndex: 'frames' },
            { title: text('展示', 'Display'), render: (_, client) => client.deviceId === status?.selectedDeviceId
              ? <Tag color="blue">{text('当前设备', 'Selected')}</Tag>
              : <Button size="small" disabled={locked || !client.deviceId} onClick={() => request('select', { deviceId: client.deviceId })}>{text('选择', 'Select')}</Button> },
          ]} />
        <div style={{ color: '#667085', fontSize: 12 }}>
          {text('协议：AA 55 00 LL + ASCII ID；AA 55 03 99 + 1024 字节。一次展示一块 B 板的数据，继续使用现有模型映射、采集回放和 CSV 导出。网关及 B 板无线参数沿用原配置。',
            'Protocol: AA 55 00 LL + ASCII ID; AA 55 03 99 + 1024 bytes. One B board drives the existing rendering, recording, playback and CSV pipeline. Gateway and B-board wireless settings are unchanged.')}
        </div>
      </Space>
    </Modal>
  </>;
}
