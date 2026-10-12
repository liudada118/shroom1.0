import React from 'react';

/** 显示来源与采集状态，演示和断流不冒充实时 USB 数据。 */
export default function MobileStreamStatus({ snapshot }) {
  const sourceLabel = snapshot.source === 'demo' ? '演示数据' : snapshot.source === 'usb' ? 'USB 数据' : '尚无数据';
  const statusLabel = snapshot.status === 'waiting' ? '等待数据' : snapshot.status === 'stale' ? '数据已暂停' : '正在接收';
  return <div className={`mobile-stream-status is-${snapshot.status}`} role="status">
    <span className="mobile-status-dot" aria-hidden="true" />
    <strong>{sourceLabel}</strong><span>{statusLabel}</span>
  </div>;
}
