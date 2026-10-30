import React, { useEffect, useState } from 'react';
import { Alert, Button, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { isHistoryOnlyLicense } from '../../services/licenseAccess';
import { describeCollectionSummary } from '../../services/collectionStatus';
import { collectionNotices, getCollectionNoticeKey } from '../../services/collectionNotice';

/** 展示授权限制与采集回执，已保存提示限时收起，保存中和失败结果保留。 */
export default function RuntimeStatusNotice({ licenseAccess, collectionSummary, onRefreshLicense }) {
  const { t } = useTranslation();
  const [dismissedReceipt, setDismissedReceipt] = useState('');
  const historyOnly = isHistoryOnlyLicense(licenseAccess);
  const receiptKey = getCollectionNoticeKey(collectionSummary);
  const remaining = collectionNotices.remaining(collectionSummary);
  useEffect(() => {
    if (!receiptKey || !Number.isFinite(remaining) || remaining <= 0) return;
    const timer = setTimeout(() => {
      collectionNotices.dismiss(receiptKey);
      setDismissedReceipt(receiptKey);
    }, remaining);
    return () => clearTimeout(timer);
  }, [receiptKey, remaining]);
  const collectionText = remaining > 0 && dismissedReceipt !== receiptKey
    ? describeCollectionSummary(collectionSummary, t) : '';
  if (!historyOnly && !collectionText) return null;
  return <Space direction="vertical" style={{ position: 'absolute', top: 82, left: '50%', transform: 'translateX(-50%)', zIndex: 30, maxWidth: 'calc(100% - 32px)', pointerEvents: 'auto' }}>
    {historyOnly && <Alert type="info" showIcon message={t('runtimeUi.historyTitle')}
      description={t('runtimeUi.historyDescription')}
      action={<Button size="small" onClick={onRefreshLicense}>{t('runtimeUi.refreshLicense')}</Button>} />}
    {collectionText && <Alert key={receiptKey} showIcon closable={collectionSummary.phase !== 'finalizing'}
      onClose={() => { collectionNotices.dismiss(receiptKey); setDismissedReceipt(receiptKey); }}
      type={['save_error', 'interrupted'].includes(collectionSummary.phase) || collectionSummary.result === 'partial' ? 'warning' : 'info'} message={collectionText} />}
  </Space>;
}
