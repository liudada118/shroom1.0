import React, { useState } from 'react';
import { Alert, Button, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { isHistoryOnlyLicense } from '../../services/licenseAccess';
import { describeCollectionSummary } from '../../services/collectionStatus';

/** Keep expiry and final database receipts visible while leaving history and Agent analysis usable. */
export default function RuntimeStatusNotice({ licenseAccess, collectionSummary, onRefreshLicense }) {
  const { t } = useTranslation();
  const [dismissedReceipt, setDismissedReceipt] = useState('');
  const historyOnly = isHistoryOnlyLicense(licenseAccess);
  const receiptKey = JSON.stringify(collectionSummary);
  const collectionText = collectionSummary?.phase !== 'collecting' && dismissedReceipt !== receiptKey
    ? describeCollectionSummary(collectionSummary, t) : '';
  if (!historyOnly && !collectionText) return null;
  return <Space direction="vertical" style={{ position: 'absolute', top: 82, left: '50%', transform: 'translateX(-50%)', zIndex: 30, maxWidth: 'calc(100% - 32px)', pointerEvents: 'auto' }}>
    {historyOnly && <Alert type="info" showIcon message={t('runtimeUi.historyTitle')}
      description={t('runtimeUi.historyDescription')}
      action={<Button size="small" onClick={onRefreshLicense}>{t('runtimeUi.refreshLicense')}</Button>} />}
    {collectionText && <Alert key={receiptKey} showIcon closable={collectionSummary.phase !== 'finalizing'}
      onClose={() => setDismissedReceipt(receiptKey)}
      type={['save_error', 'interrupted'].includes(collectionSummary.phase) || collectionSummary.result === 'partial' ? 'warning' : 'info'} message={collectionText} />}
  </Space>;
}
