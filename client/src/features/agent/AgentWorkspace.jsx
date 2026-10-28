import { useTranslation } from 'react-i18next';
import { agentUiText as tr, agentUiMessage, agentKnownLabel } from './agentUi';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AgentSettings from './AgentSettings';
import { describeChatSync, ChatUploadNotice } from './AgentSyncSettings';
import AgentConversation from './AgentConversation';
import AgentHistory from './AgentHistory';
import AgentAlgorithmData from './AgentAlgorithmData';
import AgentHistoryData from './AgentHistoryData';
import AgentResults, { collectAgentResults } from './AgentResults';
import { activateSavedAlgorithm } from '../../page/licensePortal/portalPackageRuntime';
import { requestJson } from '../../extensions/display-system/api';
import { attachmentThumbnail, encodePastedFiles } from './agentAttachments';
import useAgentController from './useAgentController';
import { collectAgentTasks, DEFAULT_AGENT_SETTINGS, isTaskBusy, TASK_LABELS } from './agentState';
import './AgentWorkspace.css';
import { trackUsage, trackUsageOperation } from '../../services/usageAnalytics';

const SUGGESTIONS = ['suggestStatus', 'suggestNoData', 'suggestCreate'];
const EMPTY_MESSAGES = [];

/** 绘制与软件控件一致的细线图标。 */
function AgentIcon({ name }) {
  const paths = {
    agent: <><path d="M6 8h12v11H6zM9 5h6M12 3v5M3 12h3M18 12h3" /><path d="M9 12h.01M15 12h.01M9 16h6" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    settings: <><path d="M4 7h16M4 17h16M9 4v6M15 14v6" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" /></>,
    attach: <path d="m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9M6 14l8-8" />,
    send: <><path d="M12 19V5m-6 6 6-6 6 6" /></>,
    stop: <rect x="6" y="6" width="12" height="12" rx="1" />,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.agent}</svg>;
}

/** 将文件大小缩为附件列表中的短标签。 */
function fileSize(size) {
  if (!Number.isFinite(size)) return '';
  return size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/** 提供全局对话入口，以桌面桥执行真实任务和展示配置变更。 */
export default function AgentWorkspace({ bridge: bridgeOverride, initiallyOpen = false }) {
  useTranslation();
  const bridge = bridgeOverride ?? (typeof window !== 'undefined' ? window.electronAPI?.agent : null);
  const { snapshot, drafts, loading, error, invoke, refresh } = useAgentController(bridge);
  /** 模型目录读取失败只由设置面板提示，不覆盖会话和任务错误。 */
  const loadModelCatalog = useCallback(async (input) => {
    const result = await bridge?.invoke('getModelCatalog', input);
    if (!result?.ok) throw new Error(result?.error?.message || tr('modelUnavailable'));
    return result.data;
  }, [bridge]);
  const [open, setOpen] = useState(initiallyOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [algorithmOpen, setAlgorithmOpen] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [text, setText] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [newConversationPending, setNewConversationPending] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
  const [resultsOpen, setResultsOpen] = useState(false);
  const [unseenResults, setUnseenResults] = useState(false);
  const [pendingAlgorithm, setPendingAlgorithm] = useState('');
  const [resultActionFeedback, setResultActionFeedback] = useState(null);
  const dialogRef = useRef(null);
  const entryRef = useRef(null);
  const inputRef = useRef(null);
  const stopRef = useRef(null);
  const scrollRef = useRef(null);
  const followOutput = useRef(true);
  const actionLock = useRef(false);
  const importLock = useRef(false);
  const currentView = useRef(null);
  const seenConversation = useRef(null);
  const seenResults = useRef({ conversationId: null, keys: new Set() });
  const settings = snapshot?.settings || DEFAULT_AGENT_SETTINGS;
  const activeTask = snapshot?.activeTask;
  const busy = Boolean(isTaskBusy(activeTask));
  const configured = Boolean(settings.model && settings.hasApiKey);
  const tasks = useMemo(() => collectAgentTasks(snapshot), [snapshot]);
  const results = useMemo(() => collectAgentResults(tasks), [tasks]);
  const messages = snapshot?.conversation?.messages || EMPTY_MESSAGES;
  const attachments = (snapshot?.attachments || []).filter((attachment) => selectedIds.includes(attachment.id));
  const locked = busy || submitting || Boolean(pendingAction) || newConversationPending;
  const dataTask = tasks.filter((task) => task.status === 'awaiting_data' && task.algorithmDataRequest?.status === 'pending').at(-1);
  currentView.current = { snapshot, locked, importing };

  useEffect(() => {
    if (!open || settingsOpen || historyOpen || algorithmOpen || loading) return undefined;
    const focusFrame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(focusFrame);
  }, [open, settingsOpen, historyOpen, algorithmOpen, loading]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
      entryRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const conversationId = snapshot?.conversation?.id;
    if (seenConversation.current && conversationId !== seenConversation.current) {
      setText(''); setSelectedIds([]); setAlgorithmOpen(false); followOutput.current = true;
    }
    seenConversation.current = conversationId;
  }, [snapshot?.conversation?.id]);

  useEffect(() => {
    const conversationId = snapshot?.conversation?.id;
    if (!conversationId) return;
    const keys = new Set(results.map((result) => result.key));
    if (seenResults.current.conversationId !== conversationId) {
      seenResults.current = { conversationId, keys };
      setUnseenResults(false);
      setResultsOpen(false);
      return;
    }
    const created = results.some((result) => !seenResults.current.keys.has(result.key));
    seenResults.current.keys = keys;
    if (created) { setResultsOpen(true); if (!open) setUnseenResults(true); }
  }, [snapshot?.conversation?.id, results, open]);

  useEffect(() => {
    if (open && followOutput.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [open, messages, drafts, tasks.length, activeTask]);
  useEffect(() => {
    if (open && resultsOpen) trackUsage('feature_exposed', { featureId: 'agent_results', action: 'open' });
  }, [open, resultsOpen]);

  /** 关闭面板只隐藏界面，已开始的任务继续由运行进程管理。 */
  const close = () => { setOpen(false); setSettingsOpen(false); setHistoryOpen(false); };

  /** 明确点击进入时由门户执行授权和系统切换；查看列表只定位，不连接设备。 */
  const openCreatedSystem = (result, enter = false) => {
    trackUsage('feature_attempted', { featureId: 'agent_results', action: enter ? 'enter_system' : 'locate_system' });
    close();
    window.dispatchEvent(new Event('shroom:agent-display-systems-refresh'));
    const query = new URLSearchParams({ category: 'custom', system: result.systemType || result.systemId });
    if (enter) query.set('agentEnter', '1');
    window.location.hash = `/?${query}`;
  };

  /** Export a dependency-closed review package; only the staff website can approve publication. */
  const exportCreatedSystem = async (result) => {
    setResultActionFeedback(null);
    try {
      const payload = await requestJson(`/api/system-packages/export/${encodeURIComponent(result.systemId)}`);
      if (!payload.package) throw new Error(tr('packageMissing'));
      const blob = new Blob([JSON.stringify(payload.package)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${result.systemId}-review.json`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setResultActionFeedback({ key: result.key, message: { key: 'packageExported' } });
    } catch (error) { setResultActionFeedback({ key: result.key, error: true, message: error.message || { key: 'exportFailed' } }); }
  };

  /** Submit the current disk revision through a scoped employee token; receipt means pending review. */
  const submitCreatedSystem = async (result, baseVersion) => {
    setResultActionFeedback(null);
    try {
      const submitted = await requestJson(`/api/system-packages/submit/${encodeURIComponent(result.systemId)}`, {
        method: 'POST', ...(baseVersion === undefined ? {} : { body: JSON.stringify({ baseVersion }) }),
      });
      setResultActionFeedback({ key: result.key, message: submitted.status === 'published'
        ? { key: 'publishedPackage', values: { id: submitted.id } }
        : { key: 'submittedPackage', values: { id: submitted.id } } });
    } catch (error) { setResultActionFeedback({ key: result.key, error: true, message: error.message || { key: 'submissionFailed' },
      updateBaseVersion: error.code === 'SYSTEM_ID_ALREADY_PUBLISHED' && Number.isSafeInteger(error.currentVersion)
        ? error.currentVersion : null }); }
  };

  /** 使用后端算法超市核验目标系统和实时通道，只有确认实例存在才报告启用。 */
  const useCreatedAlgorithm = async (result) => {
    if (pendingAlgorithm) return;
    setPendingAlgorithm(result.key);
    setResultActionFeedback(null);
    try {
      const outcome = await trackUsageOperation('agent_task_result', { featureId: 'agent_results', action: 'activate_algorithm' }, () => activateSavedAlgorithm(result));
      setResultActionFeedback({ key: result.key, message: outcome.alreadyRunning
        ? { key: 'algorithmRunning' }
        : { key: 'algorithmEnabled' } });
    } catch (failure) {
      setResultActionFeedback({ key: result.key, error: true, message: failure.name === 'AbortError'
        ? { key: 'enableTimeout' } : failure.message || { key: 'enableFailed' } });
    } finally { setPendingAlgorithm(''); }
  };

  /** 将下一步任务写入输入框，用户发送后才会产生新的 Agent 操作。 */
  const prepareCreatedAlgorithm = (result) => {
    trackUsage('feature_attempted', { featureId: 'agent_results', action: 'prepare_binding' });
    setText(tr(result.packageId ? 'bindPrompt' : 'completePrompt', { name: result.name, packageId: result.packageId, systemId: result.systemId }));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  /** 提交前锁定本地按钮，防止双击创建两个任务。 */
  const submit = async (event) => {
    event?.preventDefault();
    if (!text.trim() || !configured || locked || importing || importLock.current || actionLock.current) return;
    actionLock.current = true; setSubmitting(true); followOutput.current = true;
    try {
      await invoke('startTask', { text: text.trim(), attachmentIds: attachments.map((attachment) => attachment.id) });
      setText(''); setSelectedIds([]);
    } catch { /* 错误由控制器集中呈现，保留输入供用户修改。 */ }
    finally { actionLock.current = false; setSubmitting(false); requestAnimationFrame(() => (stopRef.current || inputRef.current)?.focus()); }
  };

  /** 统一导入与粘贴的互斥状态，失败时保留已有附件和文字。 */
  const importFiles = async (action = 'importFiles', files = []) => {
    if (importLock.current || actionLock.current || locked) return;
    importLock.current = true; setImporting(true); setAttachmentError('');
    try {
      const payload = action === 'importAttachments' ? { files: await encodePastedFiles(files) } : {};
      const imported = await invoke(action, payload);
      setSelectedIds((previous) => [...new Set([...previous, ...(imported || []).map((attachment) => attachment.id)])]);
    } catch (failure) { setAttachmentError(failure.message || { key: 'attachmentFailed' }); }
    finally { importLock.current = false; setImporting(false); }
  };

  /** 文件粘贴转成待发送附件；普通文字保留浏览器原生粘贴行为。 */
  const onPaste = (event) => {
    const files = Array.from(event.clipboardData?.files || []);
    if (files.length) { event.preventDefault(); void importFiles('importAttachments', files); }
    else if (!event.clipboardData?.getData('text/plain')) { event.preventDefault(); void importFiles('importClipboard'); }
  };

  /** 请求停止当前任务，直到收到真实状态才恢复执行按钮。 */
  const cancel = async () => {
    if (!activeTask || cancelling) return;
    setCancelling(true);
    try { await invoke('cancelTask', { taskId: activeTask.id }); }
    catch { /* 保留停止入口，允许失败后重试。 */ }
    finally { setCancelling(false); requestAnimationFrame(() => inputRef.current?.focus()); }
  };

  /** 归档当前会话并打开一段没有旧附件的新对话。 */
  const newConversation = async () => {
    if (locked || importLock.current || actionLock.current) return;
    actionLock.current = true; setNewConversationPending(true);
    try { await invoke('newConversation'); setText(''); setSelectedIds([]); setSettingsOpen(false); setHistoryOpen(false); setAttachmentError(''); }
    catch { /* 原会话继续显示。 */ }
    finally { actionLock.current = false; setNewConversationPending(false); requestAnimationFrame(() => inputRef.current?.focus()); }
  };

  /** 运行层确认切换成功后关闭历史列表，保留失败时的当前会话。 */
  const openConversation = async (conversationId) => {
    if (locked || importLock.current || actionLock.current) return;
    actionLock.current = true; setNewConversationPending(true);
    try { await invoke('openConversation', { conversationId }); setHistoryOpen(false); setAttachmentError(''); }
    catch { /* 控制器显示失败原因，当前会话保持原样。 */ }
    finally { actionLock.current = false; setNewConversationPending(false); }
  };

  /** 将用户选定的方案交给运行层应用或恢复，不在界面直接改配置。 */
  const proposalAction = async (action, taskId, proposalId) => {
    if (locked || importing || importLock.current || actionLock.current) return;
    actionLock.current = true; setPendingAction(`${taskId}:${proposalId}`);
    try { await invoke(action, { taskId, proposalId }); }
    catch { /* 错误及权威方案状态由运行层返回。 */ }
    finally { actionLock.current = false; setPendingAction(''); requestAnimationFrame(() => inputRef.current?.focus()); }
  };

  /** 中文输入法选词时保留 Enter；普通 Enter 发送，Shift+Enter 换行。 */
  const onComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) submit(event);
  };

  /** 刷新后把键盘焦点还给任务输入，避免错误按钮消失时丢失焦点。 */
  const refreshStatus = async () => {
    await refresh();
    requestAnimationFrame(() => (stopRef.current || inputRef.current)?.focus());
  };

  /** 用当前权威快照校验旧卡身份，切会话或启动新任务后禁止误授权。 */
  const requireDataRequest = (task) => {
    const view = currentView.current;
    if (view.locked || view.importing || importLock.current || actionLock.current) throw new Error(tr('waitOperation'));
    if (task.conversationId !== view.snapshot?.conversation?.id) throw new Error(tr('conversationChanged'));
    const current = collectAgentTasks(view.snapshot).find((item) => item.id === task.id);
    if (current?.status !== 'awaiting_data' || current.algorithmDataRequest?.status !== 'pending'
      || current.algorithmDataRequest.id !== task.algorithmDataRequest?.id) throw new Error(tr('selectionEnded'));
    return current.algorithmDataRequest;
  };

  /** 一次确认数据后恢复原任务，不再要求用户发送“继续”。 */
  const submitAlgorithmData = async (task, selection) => {
    const request = requireDataRequest(task);
    if (selection?.systemId !== request.systemId) throw new Error(tr('systemChanged'));
    actionLock.current = true; setPendingAction(`algorithm-data:${request.id}`); followOutput.current = true;
    try { await invoke(request.kind === 'history' ? 'completeHistoryDataRequest' : 'submitAlgorithmData', { taskId: task.id, requestId: request.id, selection }); }
    finally { actionLock.current = false; setPendingAction(''); }
  };

  /** 明确取消等待中的数据请求，后续刷新不会自动恢复或确认。 */
  const cancelAlgorithmData = async (task) => {
    const request = requireDataRequest(task);
    actionLock.current = true; setPendingAction(`algorithm-data:${request.id}`);
    try { await invoke('cancelTask', { taskId: task.id }); }
    finally { actionLock.current = false; setPendingAction(''); }
  };

  /** 用户确认的资料选择保存到当前会话，保存中禁止切换和执行其他操作。 */
  const saveAlgorithmSelection = async (selection) => {
    if (dataTask && selection) { await submitAlgorithmData(dataTask, selection); setAlgorithmOpen(false); return; }
    if (locked || importing || actionLock.current) throw new Error(tr('waitOperation'));
    actionLock.current = true; setPendingAction('algorithm-selection');
    try {
      await invoke('setAlgorithmSelection', { selection }); setAlgorithmOpen(false);
      if (selection && !text.trim()) setText(tr('algorithmPrompt'));
    } finally { actionLock.current = false; setPendingAction(''); }
  };

  return <div className="shroom-agent-root">
    <button ref={entryRef} className="shroom-agent-entry" type="button" aria-label="Agent" onClick={() => { setOpen(true); setUnseenResults(false); }} aria-haspopup="dialog" aria-expanded={open} aria-controls="shroom-agent-dialog">
      <AgentIcon name="agent" /><span>Agent</span>{unseenResults ? <span className="shroom-agent-entry-new">{tr('newResults')}</span> : busy && <span className="shroom-agent-entry-dot" aria-label={tr('taskRunning')} />}
    </button>
    {!open && unseenResults && <div className="shroom-agent-result-toast" role="status"><span>{tr('resultsCreated')}</span><button type="button" onClick={() => { setOpen(true); setUnseenResults(false); setResultsOpen(true); }}>{tr('viewResults')}</button></div>}
    <dialog ref={dialogRef} id="shroom-agent-dialog" className="shroom-agent-dialog" aria-labelledby="shroom-agent-title" onCancel={close} onClose={close}>
      <div className="shroom-agent-panel">
        <header className="shroom-agent-header">
          <div className="shroom-agent-identity"><span className="shroom-agent-emblem"><AgentIcon name="agent" /></span><div><h2 id="shroom-agent-title">Shroom Agent</h2><p>{busy ? agentKnownLabel(TASK_LABELS[activeTask.status]) || tr('taskRunning') : tr('tagline')}</p></div></div>
          <div className="shroom-agent-header-actions">
            <button type="button" aria-label={tr('history')} title={tr('history')} aria-expanded={historyOpen} onClick={() => { setHistoryOpen((value) => !value); setSettingsOpen(false); }} disabled={!bridge || loading}><AgentIcon name="history" /></button>
            <button type="button" aria-label={tr('newConversation')} title={tr('newConversation')} onClick={newConversation} disabled={!bridge || loading || locked || importing}><AgentIcon name="plus" /></button>
            <button type="button" aria-label={tr('modelSettings')} title={tr('modelSyncSettings')} onClick={() => { setSettingsOpen((value) => !value); setHistoryOpen(false); }} aria-expanded={settingsOpen} disabled={!bridge || loading || importing}><AgentIcon name="settings" /></button>
            <button type="button" aria-label={tr('closeAgent')} title={tr('closeAgent')} onClick={close}><AgentIcon name="close" /></button>
          </div>
        </header>
        {!bridge ? <div className="shroom-agent-empty"><AgentIcon name="agent" /><h3>{tr('desktopAgent')}</h3><p>{tr('desktopHint')}</p></div> : loading ? <div className="shroom-agent-empty" role="status"><p>{tr('loadingAgent')}</p></div> : <>
          {error && <div className="shroom-agent-error" role="alert"><span>{error}</span><button type="button" onClick={refreshStatus}>{tr('refreshStatus')}</button></div>}
          <AgentResults results={results} expanded={resultsOpen} onToggle={() => setResultsOpen((value) => !value)} onOpenSystem={openCreatedSystem} onExportPackage={exportCreatedSystem} onSubmitPackage={submitCreatedSystem} onUseAlgorithm={useCreatedAlgorithm} onPrepareAlgorithm={prepareCreatedAlgorithm} pendingAlgorithm={pendingAlgorithm} actionFeedback={resultActionFeedback} />
          {historyOpen ? <AgentHistory invoke={invoke} disabled={locked || importing} onOpen={openConversation} onClose={() => setHistoryOpen(false)} /> : settingsOpen ? <AgentSettings settings={settings} disabled={locked} onLoadModelCatalog={loadModelCatalog} onSave={(value) => invoke('saveSettings', value)} chatSync={snapshot?.chatSync} onSaveSync={(value) => invoke('saveSyncSettings', value)} onRetrySync={() => invoke('retryChatSync')} onClearSync={(input) => invoke('clearChatSyncQueue', input)} onRestoreSync={(input) => invoke('restoreChatSyncQueue', input)} onClose={() => setSettingsOpen(false)} /> : algorithmOpen ? dataTask?.algorithmDataRequest.kind === 'history' ? <AgentHistoryData invoke={invoke} expectedSystemId={dataTask.algorithmDataRequest.systemId} disabled={locked || importing} onSave={saveAlgorithmSelection} onClose={() => setAlgorithmOpen(false)} /> : <AgentAlgorithmData invoke={invoke} selection={snapshot?.conversation?.algorithmSelection} expectedSystemId={dataTask?.algorithmDataRequest.systemId} submitLabel={dataTask ? tr('useDataContinue') : tr('useData')} disabled={locked || importing} onSave={saveAlgorithmSelection} onClose={() => setAlgorithmOpen(false)} /> : <>
            <div className="shroom-agent-scroll" ref={scrollRef} onScroll={(event) => { const node = event.currentTarget; followOutput.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64; }}>
              {snapshot?.chatSync?.settings?.noticePending && <ChatUploadNotice settings={snapshot.chatSync.settings} disabled={locked || importing} onAcknowledge={() => invoke('saveSyncSettings', { acknowledgeNotice: true })} />}
              {!configured && <div className="shroom-agent-connect-note"><div><strong>{tr('connectModel')}</strong><p>{tr('connectionHint')}</p></div><button type="button" onClick={() => setSettingsOpen(true)}>{tr('configureModel')}</button></div>}
              {messages.length === 0 && <section className="shroom-agent-welcome"><span className="shroom-agent-eyebrow">{tr('startTask')}</span><h3>{tr('welcome')}</h3><p>{tr('welcomeHint')}</p><div className="shroom-agent-suggestions">{SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} disabled={locked} onClick={() => { setText(tr(suggestion)); inputRef.current?.focus(); }}>{tr(suggestion)}<span aria-hidden="true">↗</span></button>)}</div></section>}
              <AgentConversation snapshot={snapshot} drafts={drafts} disabled={locked || importing} pendingAction={pendingAction} onProposalAction={proposalAction}
                invoke={invoke} onSubmitAlgorithmData={submitAlgorithmData} onCancelAlgorithmData={cancelAlgorithmData} />
              {busy && Object.keys(drafts).length === 0 && <p className="shroom-agent-working" role="status"><span aria-hidden="true" />{activeTask.status === 'verifying' ? tr('verifying') : tr('working')}</p>}
            </div>
            <form className="shroom-agent-composer" onSubmit={submit}>
              {snapshot?.conversation?.algorithmSelection && <p className="shroom-agent-send-hint">{tr('algorithmDataPrefix')}{snapshot.conversation.algorithmSelection.records.length}{tr('recordsSuffix')}{snapshot.conversation.algorithmSelection.systemId}</p>}
              {attachmentError && attachmentError !== error && <p className="shroom-agent-error" role="alert">{agentUiMessage(attachmentError)}</p>}
              {attachments.length > 0 && <ul className="shroom-agent-attachments" aria-label={tr('pendingAttachments')}>{attachments.map((attachment) => <li key={attachment.id}>{attachmentThumbnail(attachment) && <img src={attachmentThumbnail(attachment)} alt={tr('previewAttachment', { name: attachment.name })} />}<span title={attachment.name}>{attachment.name}<small>{fileSize(attachment.size)}</small></span><button type="button" aria-label={tr('removeAttachment', { name: attachment.name })} disabled={locked || importing} onClick={() => setSelectedIds((previous) => previous.filter((id) => id !== attachment.id))}><AgentIcon name="close" /></button></li>)}</ul>}
              <label className="shroom-agent-sr-only" htmlFor="shroom-agent-prompt">{tr('prompt')}</label>
              <textarea ref={inputRef} id="shroom-agent-prompt" value={text} onChange={(event) => setText(event.target.value)} onPaste={onPaste} onKeyDown={onComposerKeyDown} rows={3} maxLength={12000} disabled={!snapshot || locked}
                placeholder={configured ? tr('promptPlaceholder') : tr('configureFirst')} aria-describedby="shroom-agent-send-hint" />
              <div className="shroom-agent-composer-tools"><button type="button" onClick={() => importFiles()} disabled={!snapshot || importing || locked} title={tr('attachmentTypes')}><AgentIcon name="attach" />{importing ? tr('importing') : tr('addAttachment')}</button>
                <button type="button" onClick={() => setAlgorithmOpen(true)} disabled={!snapshot || importing || locked}>{tr('algorithmData')}</button>
                {busy ? <button ref={stopRef} type="button" onClick={cancel} disabled={cancelling}><AgentIcon name="stop" />{cancelling ? tr('stopping') : tr('stopTask')}</button> : <button className="shroom-agent-primary" type="submit" disabled={!text.trim() || !configured || locked || importing || !snapshot}><AgentIcon name="send" />{submitting ? tr('sending') : tr('send')}</button>}
              </div>
              <p id="shroom-agent-send-hint" className="shroom-agent-send-hint">{tr('sendHint')}</p>
              {snapshot?.chatSync?.settings?.enabled && <p className="shroom-agent-send-hint" role="status">{tr('syncPrefix')}{describeChatSync(snapshot.chatSync)}{tr('syncSettingsHint')}</p>}
            </form>
          </>}
        </>}
      </div>
    </dialog>
  </div>;
}
