import { useTranslation } from 'react-i18next';
import { agentUiText as tr } from './agentUi';
import React, { useState } from 'react';
import AgentAlgorithmData from './AgentAlgorithmData';
import AgentHistoryData from './AgentHistoryData';

/** 在所属任务中展示一次性数据授权，历史记录只保留确认状态。 */
export default function AgentAlgorithmDataRequest({ task, expanded, disabled, invoke, onSubmit, onCancel }) {
  useTranslation();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const request = task.algorithmDataRequest;
  if (!request) return null;
  const pending = request.status === 'pending' && task.status === 'awaiting_data';
  const history = request.kind === 'history';
  /** 取消只关闭本次授权请求，不清除采集数据。 */
  const cancel = async () => {
    if (disabled || cancelling) return;
    setError(''); setCancelling(true);
    try { await onCancel(task); }
    catch (cause) { setError(cause.message); }
    finally { setCancelling(false); }
  };
  return <div className="shroom-agent-data-request" data-request-id={request.id}>
    {pending && expanded ? <>
      {request.message && <p className="shroom-agent-data-request-message">{request.message}</p>}
      {disabled && <p className="shroom-agent-send-hint" role="status">{tr('waitSelection')}</p>}
      {error && <p className="shroom-agent-error" role="alert">{error}</p>}
      {history ? <AgentHistoryData key={request.id} invoke={invoke} expectedSystemId={request.systemId} disabled={disabled || cancelling}
        onSave={(selection) => onSubmit(task, selection)} onClose={cancel} /> : <AgentAlgorithmData key={request.id} inline invoke={invoke} expectedSystemId={request.systemId}
        disabled={disabled || cancelling} submitLabel={tr('useDataContinue')}
        onSave={(selection) => onSubmit(task, selection)} onClose={cancel} />}
    </> : <p className="shroom-agent-data-request-result" role="status">{['submitted', 'fulfilled'].includes(request.status)
      ? history ? tr('historyConfirmed') : tr('algorithmConfirmed')
      : pending ? tr('useLatestSelection') : tr('selectionCancelled')}</p>}
  </div>;
}
