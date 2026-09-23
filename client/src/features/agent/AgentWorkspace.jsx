import React, { useEffect, useRef, useState } from 'react';
import AgentSettings from './AgentSettings';
import { describeChatSync } from './AgentSyncSettings';
import AgentConversation from './AgentConversation';
import AgentHistory from './AgentHistory';
import AgentAlgorithmData from './AgentAlgorithmData';
import { attachmentThumbnail, encodePastedFiles } from './agentAttachments';
import useAgentController from './useAgentController';
import { collectAgentTasks, DEFAULT_AGENT_SETTINGS, isTaskBusy, TASK_LABELS } from './agentState';
import './AgentWorkspace.css';

const SUGGESTIONS = ['当前有哪些展示系统，设备是什么状态？', '帮我检查设备为什么没有数据。', '根据附件帮我创建一个展示系统。'];
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
  const bridge = bridgeOverride ?? (typeof window !== 'undefined' ? window.electronAPI?.agent : null);
  const { snapshot, drafts, loading, error, invoke, refresh } = useAgentController(bridge);
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
  const dialogRef = useRef(null);
  const entryRef = useRef(null);
  const inputRef = useRef(null);
  const stopRef = useRef(null);
  const scrollRef = useRef(null);
  const followOutput = useRef(true);
  const actionLock = useRef(false);
  const importLock = useRef(false);
  const seenConversation = useRef(null);
  const settings = snapshot?.settings || DEFAULT_AGENT_SETTINGS;
  const activeTask = snapshot?.activeTask;
  const busy = Boolean(isTaskBusy(activeTask));
  const configured = Boolean(settings.model && settings.hasApiKey);
  const tasks = collectAgentTasks(snapshot);
  const messages = snapshot?.conversation?.messages || EMPTY_MESSAGES;
  const attachments = (snapshot?.attachments || []).filter((attachment) => selectedIds.includes(attachment.id));
  const locked = busy || submitting || Boolean(pendingAction) || newConversationPending;

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
    if (open && followOutput.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [open, messages, drafts, tasks.length, activeTask]);

  /** 关闭面板只隐藏界面，已开始的任务继续由运行进程管理。 */
  const close = () => { setOpen(false); setSettingsOpen(false); setHistoryOpen(false); };

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
    } catch (failure) { setAttachmentError(failure.message || '附件导入失败，请重试。'); }
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

  /** 用户确认的资料选择保存到当前会话，保存中禁止切换和执行其他操作。 */
  const saveAlgorithmSelection = async (selection) => {
    if (locked || importing || actionLock.current) throw new Error('请等待当前操作结束。');
    actionLock.current = true; setPendingAction('algorithm-selection');
    try {
      await invoke('setAlgorithmSelection', { selection }); setAlgorithmOpen(false);
      if (selection && !text.trim()) setText('请根据所选采集数据编写分类算法，先分析开发集、测试并改进，最后生成包含源码和测试报告的离线算法保存提案。');
    } finally { actionLock.current = false; setPendingAction(''); }
  };

  return <div className="shroom-agent-root">
    <button ref={entryRef} className="shroom-agent-entry" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-controls="shroom-agent-dialog">
      <AgentIcon name="agent" /><span>Agent</span>{busy && <span className="shroom-agent-entry-dot" aria-label="任务执行中" />}
    </button>
    <dialog ref={dialogRef} id="shroom-agent-dialog" className="shroom-agent-dialog" aria-labelledby="shroom-agent-title" onCancel={close} onClose={close}>
      <div className="shroom-agent-panel">
        <header className="shroom-agent-header">
          <div className="shroom-agent-identity"><span className="shroom-agent-emblem"><AgentIcon name="agent" /></span><div><h2 id="shroom-agent-title">Shroom Agent</h2><p>{busy ? TASK_LABELS[activeTask.status] || '任务执行中' : '创建展示 · 修改配置 · 设备诊断'}</p></div></div>
          <div className="shroom-agent-header-actions">
            <button type="button" aria-label="历史会话" title="历史会话" aria-expanded={historyOpen} onClick={() => { setHistoryOpen((value) => !value); setSettingsOpen(false); }} disabled={!bridge || loading}><AgentIcon name="history" /></button>
            <button type="button" aria-label="新会话" title="新会话" onClick={newConversation} disabled={!bridge || loading || locked || importing}><AgentIcon name="plus" /></button>
            <button type="button" aria-label="模型设置" title="模型与同步设置" onClick={() => { setSettingsOpen((value) => !value); setHistoryOpen(false); }} aria-expanded={settingsOpen} disabled={!bridge || loading || importing}><AgentIcon name="settings" /></button>
            <button type="button" aria-label="关闭 Agent" title="关闭 Agent" onClick={close}><AgentIcon name="close" /></button>
          </div>
        </header>
        {!bridge ? <div className="shroom-agent-empty"><AgentIcon name="agent" /><h3>在桌面软件中使用 Agent</h3><p>请打开 Shroom 桌面软件，即可连接模型、读取设备状态并创建展示系统。</p></div> : loading ? <div className="shroom-agent-empty" role="status"><p>正在加载 Agent…</p></div> : <>
          {error && <div className="shroom-agent-error" role="alert"><span>{error}</span><button type="button" onClick={refreshStatus}>刷新状态</button></div>}
          {historyOpen ? <AgentHistory invoke={invoke} disabled={locked || importing} onOpen={openConversation} onClose={() => setHistoryOpen(false)} /> : settingsOpen ? <AgentSettings settings={settings} disabled={locked} onSave={(value) => invoke('saveSettings', value)} chatSync={snapshot?.chatSync} onSaveSync={(value) => invoke('saveSyncSettings', value)} onRetrySync={() => invoke('retryChatSync')} onClose={() => setSettingsOpen(false)} /> : algorithmOpen ? <AgentAlgorithmData invoke={invoke} selection={snapshot?.conversation?.algorithmSelection} disabled={locked || importing} onSave={saveAlgorithmSelection} onClose={() => setAlgorithmOpen(false)} /> : <>
            <div className="shroom-agent-scroll" ref={scrollRef} onScroll={(event) => { const node = event.currentTarget; followOutput.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64; }}>
              {!configured && <div className="shroom-agent-connect-note"><div><strong>连接你的模型</strong><p>配置服务地址、模型名称和密钥后即可开始。</p></div><button type="button" onClick={() => setSettingsOpen(true)}>配置模型</button></div>}
              {messages.length === 0 && <section className="shroom-agent-welcome"><span className="shroom-agent-eyebrow">从一个具体任务开始</span><h3>告诉我，你想完成什么？</h3><p>查询设备、排查数据问题，或根据协议和点位表生成展示方案。</p><div className="shroom-agent-suggestions">{SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} disabled={locked} onClick={() => { setText(suggestion); inputRef.current?.focus(); }}>{suggestion}<span aria-hidden="true">↗</span></button>)}</div></section>}
              <AgentConversation snapshot={snapshot} drafts={drafts} disabled={locked || importing} pendingAction={pendingAction} onProposalAction={proposalAction} />
              {busy && Object.keys(drafts).length === 0 && <p className="shroom-agent-working" role="status"><span aria-hidden="true" />{activeTask.status === 'verifying' ? '正在检查执行结果…' : '正在处理你的任务…'}</p>}
            </div>
            <form className="shroom-agent-composer" onSubmit={submit}>
              {snapshot?.conversation?.algorithmSelection && <p className="shroom-agent-send-hint">算法数据：{snapshot.conversation.algorithmSelection.records.length} 条记录 · {snapshot.conversation.algorithmSelection.systemId}</p>}
              {attachmentError && attachmentError !== error && <p className="shroom-agent-error" role="alert">{attachmentError}</p>}
              {attachments.length > 0 && <ul className="shroom-agent-attachments" aria-label="待发送附件">{attachments.map((attachment) => <li key={attachment.id}>{attachmentThumbnail(attachment) && <img src={attachmentThumbnail(attachment)} alt={`预览 ${attachment.name}`} />}<span title={attachment.name}>{attachment.name}<small>{fileSize(attachment.size)}</small></span><button type="button" aria-label={`移除附件 ${attachment.name}`} disabled={locked || importing} onClick={() => setSelectedIds((previous) => previous.filter((id) => id !== attachment.id))}><AgentIcon name="close" /></button></li>)}</ul>}
              <label className="shroom-agent-sr-only" htmlFor="shroom-agent-prompt">任务内容</label>
              <textarea ref={inputRef} id="shroom-agent-prompt" value={text} onChange={(event) => setText(event.target.value)} onPaste={onPaste} onKeyDown={onComposerKeyDown} rows={3} maxLength={12000} disabled={!snapshot || locked}
                placeholder={configured ? '描述你的任务，可直接粘贴图片或文件…' : '先配置模型连接，再开始任务'} aria-describedby="shroom-agent-send-hint" />
              <div className="shroom-agent-composer-tools"><button type="button" onClick={() => importFiles()} disabled={!snapshot || importing || locked} title="添加图片、文本、CSV、JSON 或 XLSX 文件"><AgentIcon name="attach" />{importing ? '正在导入…' : '添加附件'}</button>
                <button type="button" onClick={() => setAlgorithmOpen(true)} disabled={!snapshot || importing || locked}>算法数据</button>
                {busy ? <button ref={stopRef} type="button" onClick={cancel} disabled={cancelling}><AgentIcon name="stop" />{cancelling ? '正在停止…' : '停止任务'}</button> : <button className="shroom-agent-primary" type="submit" disabled={!text.trim() || !configured || locked || importing || !snapshot}><AgentIcon name="send" />{submitting ? '正在发送…' : '发送'}</button>}
              </div>
              <p id="shroom-agent-send-hint" className="shroom-agent-send-hint">消息、所选附件和任务所需的软件状态将发送至你配置的模型服务。Shift + Enter 换行。</p>
              {snapshot?.chatSync?.settings?.enabled && <p className="shroom-agent-send-hint" role="status">聊天同步：{describeChatSync(snapshot.chatSync)}。可在设置中查看服务器地址或关闭。</p>}
            </form>
          </>}
        </>}
      </div>
    </dialog>
  </div>;
}
