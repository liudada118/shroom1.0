import React, { useState } from 'react';
import { Alert, Button, Space } from 'antd';
import { isHistoryOnlyLicense } from '../../services/licenseAccess';
import { describeCollectionSummary } from '../../services/collectionStatus';

/** Keep expiry and final database receipts visible while leaving history and Agent analysis usable. */
export default function RuntimeStatusNotice({ licenseAccess, collectionSummary, onRefreshLicense }) {
  const [dismissedReceipt, setDismissedReceipt] = useState('');
  const historyOnly = isHistoryOnlyLicense(licenseAccess);
  const receiptKey = JSON.stringify(collectionSummary);
  const collectionText = collectionSummary?.phase !== 'collecting' && dismissedReceipt !== receiptKey
    ? describeCollectionSummary(collectionSummary) : '';
  if (!historyOnly && !collectionText) return null;
  return <Space direction="vertical" style={{ position: 'absolute', top: 82, left: '50%', transform: 'translateX(-50%)', zIndex: 30, maxWidth: 'calc(100% - 32px)', pointerEvents: 'auto' }}>
    {historyOnly && <Alert type="info" showIcon message="授权已到期，当前仅使用历史数据"
      description="可以查看、回放及使用 Agent 分析；停止新增采集，数据和分析结果不可导出。"
      action={<Button size="small" onClick={onRefreshLicense}>刷新授权</Button>} />}
    {collectionText && <Alert key={receiptKey} showIcon closable={collectionSummary.phase !== 'finalizing'}
      onClose={() => setDismissedReceipt(receiptKey)}
      type={['save_error', 'interrupted'].includes(collectionSummary.phase) || collectionSummary.result === 'partial' ? 'warning' : 'info'} message={collectionText} />}
  </Space>;
}
