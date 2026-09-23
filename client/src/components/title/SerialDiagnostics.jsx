import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const TITLES = {
  deviceMissing: ['未找到串口设备', 'Serial device not found'],
  permissionDenied: ['串口权限不足', 'No permission to open serial port'],
  portBusy: ['串口被占用', 'Serial port is busy'],
  unknown: ['串口打开失败', 'Failed to open serial port'],
};

export default function SerialDiagnostics({ diagnostic, result, connected, send, onFixed }) {
  const { i18n } = useTranslation();
  const english = i18n.language?.startsWith('en');
  const text = (zh, en) => english ? en : zh;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const [fixed, setFixed] = useState('');
  const [resolved, setResolved] = useState(false);
  const sequence = useRef(0);
  const autoShownKey = useRef(null);

  const kind = diagnostic?.kind || 'unknown';
  const [zhTitle, enTitle] = TITLES[kind] || TITLES.unknown;
  // 权限修复只对 Linux 有意义：Windows 的 COM 口与 macOS 的 /dev/cu.* 没有这套权限模型
  const canFix = kind === 'permissionDenied' && diagnostic?.platform === 'linux';
  const diagnosticKey = diagnostic ? `${diagnostic.path}|${diagnostic.kind}` : null;

  function requestFix() {
    const requestId = `serial-diag-${Date.now()}-${++sequence.current}`;
    setError('');
    setFixed('');
    if (!connected || !send({ serialDiag: { action: 'fixPermission', requestId } })) {
      setError(text('与本地后台的连接已断开', 'Local backend disconnected'));
      return;
    }
    setPending({ requestId });
  }

  useEffect(() => {
    if (!connected) setPending(null);
  }, [connected]);

  // 新的故障到达时清掉上一次的修复结果，避免旧提示残留
  useEffect(() => {
    setFixed('');
    setError('');
    setResolved(false);
  }, [diagnosticKey]);

  // 权限问题需要用户动手才能继续，主动弹窗，避免只有一个按钮被忽略。
  // 同一个故障只自动弹一次：用户关掉后缩回按钮，不再反复打扰。
  useEffect(() => {
    // 故障消失后重置记录，同样的问题日后重犯时仍会主动提示
    if (!diagnosticKey) {
      autoShownKey.current = null;
      return;
    }
    if (!canFix || autoShownKey.current === diagnosticKey) return;
    autoShownKey.current = diagnosticKey;
    setOpen(true);
  }, [canFix, diagnosticKey]);

  useEffect(() => {
    if (!pending || result?.requestId !== pending.requestId) return;
    setPending(null);
    if (result.ok) {
      setFixed(result.message || text('权限已修复', 'Permission fixed'));
      // 权限已确认，后续不再显示告警按钮；若实际仍打不开，后端会推来新的故障
      setResolved(true);
      onFixed?.();
    } else {
      setError(result.message || text('修复失败', 'Fix failed'));
    }
  }, [result, pending, onFixed]);

  useEffect(() => {
    if (!pending) return undefined;
    const timer = setTimeout(() => {
      setPending(null);
      setError(text('后台响应超时，请重试', 'Backend timeout; please retry'));
    }, 60000);
    return () => clearTimeout(timer);
  }, [pending]);

  // 修复成功后弹窗自行关闭即彻底收起；未确认权限则始终留一个按钮可以重新打开
  if (!diagnostic || (resolved && !open)) return null;

  return <>
    <Button className="titleButton" danger onClick={() => setOpen(true)}>
      {text(zhTitle, enTitle)}
    </Button>
    <Modal title={text('串口连接诊断', 'Serial connection diagnostics')}
      open={open} onCancel={() => setOpen(false)} footer={null} width={560} destroyOnClose={false}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert type="warning" showIcon
          message={`${text(zhTitle, enTitle)}${diagnostic.path ? ` · ${diagnostic.path}` : ''}`}
          description={diagnostic.hint} />

        {canFix && <Space wrap>
          <Button type="primary" loading={Boolean(pending)} disabled={!connected || Boolean(pending)}
            onClick={requestFix}>{text('修复权限', 'Fix permission')}</Button>
          <Typography.Text type="secondary">
            {text('会弹出系统授权框，需要输入一次密码', 'A system authorization dialog will ask for your password once')}
          </Typography.Text>
        </Space>}

        {fixed && <Alert type="success" showIcon message={fixed}
          description={text('串口列表已刷新，可重新选择设备。', 'The port list has been refreshed; select the device again.')} />}
        {error && <Alert type="error" showIcon message={error} />}

        {canFix && !fixed && <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {text('暂不处理可以关闭本窗口，标题栏会保留一个按钮随时重新打开。',
            'You can close this dialog for now; a button stays in the title bar to reopen it.')}
        </Typography.Text>}

        {diagnostic.detail && <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {text('原始错误', 'Raw error')}：{diagnostic.detail}
        </Typography.Text>}
      </Space>
    </Modal>
  </>;
}
