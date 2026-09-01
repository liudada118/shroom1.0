import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  buildAgentRendererFrame,
  buildAgentRendererInit,
  buildAgentRendererReadyMessages,
  getAgentRendererInitSignature,
  readAgentRendererResponse,
  resolveAgentRendererEntryUrl,
} from './agentRendererBridge.js';
import './AgentRendererHost.css';

const LOAD_TIMEOUT_MS = 10000;

export default function AgentRendererHost({
  rendererId,
  app,
  registryLoading = false,
  registryError = '',
  widgetId = '',
  label = '',
  identity = {},
  timestamp = null,
  values = [],
  rawValues = [],
  matrix = {},
  metrics = {},
  algorithmMetrics = {},
  serial = null,
  channels = [],
}) {
  const iframeRef = useRef(null);
  const readyRef = useRef(false);
  const initPostedRef = useRef(false);
  const initSignatureRef = useRef('');
  const initMessageRef = useRef(null);
  const frameMessageRef = useRef(null);
  const [status, setStatus] = useState({ phase: 'loading', message: '正在加载 Agent 渲染器…' });
  const entryUrl = useMemo(
    () => resolveAgentRendererEntryUrl(app?.entryUrl, app?.apiBase || app?.entryUrl, app?.appId),
    [app?.apiBase, app?.appId, app?.entryUrl],
  );
  const initMessage = useMemo(() => buildAgentRendererInit({
    rendererId,
    widgetId,
    label,
    identity,
  }), [identity, label, rendererId, widgetId]);
  const frameMessage = useMemo(() => buildAgentRendererFrame({
    identity,
    timestamp,
    values,
    rawValues,
    matrix,
    metrics,
    algorithmMetrics,
    serial,
    channels,
  }), [algorithmMetrics, channels, identity, matrix, metrics, rawValues, serial, timestamp, values]);
  const hasValues = frameMessage.payload.values.length > 0
    || frameMessage.payload.channels.some((channel) => channel.values.length > 0);

  const postToIframe = useCallback((message) => {
    const target = iframeRef.current?.contentWindow;
    if (!target || !message) return false;
    // 没有 allow-same-origin 的 sandbox 页面拥有 opaque origin，只能用 `*` 投递；
    // 接收方向严格绑定 event.source，消息内容又是白名单 DTO。
    target.postMessage(message, '*');
    return true;
  }, []);

  const postHandshake = useCallback((init, frame, { forceInit = false } = {}) => {
    if (forceInit) initPostedRef.current = false;
    const messages = buildAgentRendererReadyMessages(init, frame, {
      initPosted: initPostedRef.current,
    });
    messages.forEach((message) => {
      const posted = postToIframe(message);
      if (message?.type === 'shroom.renderer.init' && posted) initPostedRef.current = true;
    });
  }, [postToIframe]);

  const initSignature = getAgentRendererInitSignature(initMessage);

  useEffect(() => {
    const identityChanged = Boolean(initSignatureRef.current)
      && initSignatureRef.current !== initSignature;
    initSignatureRef.current = initSignature;
    initMessageRef.current = initMessage;
    if (readyRef.current && identityChanged) {
      postHandshake(initMessage, frameMessage, { forceInit: true });
    }
  }, [frameMessage, initMessage, initSignature, postHandshake]);

  useEffect(() => {
    frameMessageRef.current = frameMessage;
  }, [frameMessage]);

  useEffect(() => {
    readyRef.current = false;
    initPostedRef.current = false;
    if (registryLoading) {
      setStatus({ phase: 'loading', message: '正在读取 Agent 渲染器目录…' });
    } else if (registryError) {
      setStatus({ phase: 'error', message: registryError });
    } else if (!app) {
      setStatus({ phase: 'error', message: `Agent 渲染器不可用：${rendererId}` });
    } else if (!entryUrl) {
      setStatus({ phase: 'error', message: `Agent 渲染器入口无效：${rendererId}` });
    } else {
      setStatus({ phase: 'loading', message: '正在加载 Agent 渲染器…' });
    }
  }, [app, entryUrl, registryError, registryLoading, rendererId]);

  useEffect(() => {
    if (!entryUrl) return undefined;
    const handleWindowMessage = (event) => {
      const response = readAgentRendererResponse(event, iframeRef.current?.contentWindow);
      if (!response) return;
      if (response.status === 'error') {
        readyRef.current = false;
        setStatus({ phase: 'error', message: response.message || 'Agent 渲染器报告错误' });
        return;
      }
      readyRef.current = true;
      setStatus({ phase: 'ready', message: '' });
      postHandshake(initMessageRef.current, frameMessageRef.current);
    };
    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [entryUrl, postHandshake]);

  useEffect(() => {
    if (!entryUrl) return undefined;
    const timeout = window.setTimeout(() => {
      if (!readyRef.current) {
        setStatus({ phase: 'error', message: 'Agent 渲染器加载超时' });
      }
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [entryUrl]);

  useEffect(() => {
    if (readyRef.current && status.phase !== 'error') postToIframe(frameMessage);
  }, [frameMessage, postToIframe, status.phase]);

  const handleLoad = useCallback(() => {
    // 同一个 URL 的 iframe 也可能由页面 reload/崩溃恢复再次触发 load；新 document 已丢失
    // 旧 init 状态，所以每次 load 都必须开启一轮全新握手，不能直接沿用 readyRef 发 frame。
    readyRef.current = false;
    initPostedRef.current = false;
    setStatus({ phase: 'loading', message: '等待 Agent 渲染器就绪…' });
    if (postToIframe(initMessage)) initPostedRef.current = true;
  }, [initMessage, postToIframe]);

  if (!entryUrl) {
    return (
      <div className="agent-renderer-host is-error" role="alert">
        <span>{status.message}</span>
      </div>
    );
  }

  return (
    <div
      className="agent-renderer-host"
      data-agent-renderer={rendererId}
      style={{ '--agent-renderer-height': `${app?.height || 480}px` }}
    >
      <iframe
        key={entryUrl}
        ref={iframeRef}
        src={entryUrl}
        title={label || rendererId}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
        onLoad={handleLoad}
        onError={() => {
          readyRef.current = false;
          initPostedRef.current = false;
          setStatus({ phase: 'error', message: 'Agent 渲染器页面加载失败' });
        }}
      />
      {status.phase === 'loading' ? (
        <div className="agent-renderer-status is-loading" role="status">{status.message}</div>
      ) : null}
      {status.phase === 'error' ? (
        <div className="agent-renderer-status is-error" role="alert">{status.message}</div>
      ) : null}
      {status.phase === 'ready' && !hasValues ? (
        <div className="agent-renderer-status is-empty" role="status">等待传感器数据</div>
      ) : null}
    </div>
  );
}
