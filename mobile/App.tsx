import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { displayHtml } from './generated/display';
import { FrameDispatcher } from './src/frameDispatcher';
import { parseUsbCommand, serializeHostState, type HostState, type UsbCommand } from './src/hostControl';
import { createDemoFrame, isCurrentUsbFrame, type FrameSource } from './src/pressureContract';
import { describeUsbError, usbBridge, type UsbDevice } from './src/usbBridge';

const colors = { background: '#08101c', error: '#ffb1a8' };
const displaySource = { html: displayHtml, baseUrl: 'https://shroom.mobile.local/' };

/** iPad 数据接入宿主：原生采集经过有界桥送给现有网页渲染器。 */
function PressureWorkspace() {
  useKeepAwake();
  const webView = useRef<WebView>(null);
  const source = useRef<FrameSource | null>(null);
  const session = useRef(0);
  const operation = useRef<number | null>(null);
  const webReady = useRef(false);
  const usbConnection = useRef<string | null>(null);
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const receivedFrames = useRef(0);
  const mounted = useRef(true);
  const dispatcher = useMemo(() => new FrameDispatcher((script) => webView.current?.injectJavaScript(script)), []);
  const [status, setStatus] = useState('等待连接');
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<UsbDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | undefined>();
  const [baudRate, setBaudRate] = useState(1000000);
  const [busy, setBusy] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [loadError, setLoadError] = useState('');
  const hostState: HostState = { status, error, devices, selectedDevice, baudRate, busy, frameCount, source: source.current };
  const latestHostState = useRef(hostState);
  latestHostState.current = hostState;

  /** 网页就绪后同步最新控制状态；重载期间由 ready 消息补发。 */
  const sendHostState = useCallback(() => {
    if (webReady.current) webView.current?.injectJavaScript(serializeHostState(latestHostState.current));
  }, []);

  useEffect(() => { sendHostState(); }, [status, error, devices, selectedDevice, baudRate, busy, frameCount, sendHostState]);

  /** 停止当前来源并清空画布，取消在途连接；重复调用也能安全退出。 */
  const stop = useCallback(async () => {
    const generation = ++session.current;
    operation.current = generation;
    source.current = null;
    usbConnection.current = null;
    if (demoTimer.current) clearInterval(demoTimer.current);
    demoTimer.current = null;
    dispatcher.reset(null);
    receivedFrames.current = 0;
    if (mounted.current) { setStatus('等待连接'); setError(''); setBusy(true); setFrameCount(0); }
    try { await usbBridge?.disconnect(); }
    catch (failure) { if (mounted.current && generation === session.current) setError(describeUsbError(failure)); }
    finally {
      if (generation === session.current) {
        operation.current = null;
        if (mounted.current) setBusy(false);
      }
    }
    return generation;
  }, [dispatcher]);

  /** 网页丢失时先关闭消息桥并取消采集，避免重载回首页后仍占用设备。 */
  const suspendWebSession = useCallback(() => {
    webReady.current = false;
    dispatcher.setNotReady();
    void stop();
  }, [dispatcher, stop]);

  /** 刷新驱动已匹配的真实设备；无驱动或权限不足会显示原生原因。 */
  const refreshDevices = useCallback(async () => {
    if (operation.current !== null) return;
    const generation = session.current;
    operation.current = generation;
    setBusy(true);
    setError('');
    try {
      if (!usbBridge) { setError('当前安装包未包含 USB 模块，请安装 iOS development build。'); return; }
      const capability = await usbBridge.capabilities();
      if (!mounted.current || generation !== session.current) return;
      if (!capability.supported) { setError(capability.reason ?? '此设备尚不支持 USB 采集'); return; }
      const available = await usbBridge.listDevices();
      if (!mounted.current || generation !== session.current) return;
      setDevices(available);
      setSelectedDevice((previous) => available.some((device) => device.id === previous) ? previous : available[0]?.id);
      if (!available.length) setError('未发现可连接的 CH340。请插入传感器，并在 iPad 设置中启用已签名的 USB 驱动。');
    } catch (failure) { if (mounted.current && generation === session.current) setError(describeUsbError(failure)); }
    finally {
      if (generation === session.current) {
        operation.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }, []);

  /** 先断开旧来源，再连接指定设备；取消后的迟到结果不恢复旧采集。 */
  const connectUsb = useCallback(async (command: Extract<UsbCommand, { action: 'connect' }>) => {
    if (operation.current !== null) return;
    if (!usbBridge) { setError('USB 采集需要包含原生模块与 CH340 驱动的安装包。'); return; }
    setBaudRate(command.baudRate);
    setSelectedDevice(command.deviceId);
    const generation = await stop();
    if (!mounted.current || generation !== session.current) return;
    operation.current = generation;
    source.current = 'usb';
    const connectionId = `${Date.now()}-${generation}-${Math.random().toString(36).slice(2)}`;
    usbConnection.current = connectionId;
    dispatcher.reset('usb');
    setError(''); setBusy(true); setStatus('正在连接 USB');
    try {
      await usbBridge.connect({ baudRate: command.baudRate, deviceId: command.deviceId, connectionId });
      if (mounted.current && generation === session.current) setStatus(receivedFrames.current > 0 ? 'USB 数据接收中' : 'USB 已连接，等待压力帧');
    } catch (failure) {
      if (mounted.current && generation === session.current) {
        source.current = null; usbConnection.current = null; dispatcher.reset(null);
        setStatus('USB 连接失败'); setError(describeUsbError(failure));
      }
    } finally {
      if (generation === session.current) {
        operation.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }, [dispatcher, stop]);

  /** 显式开启演示源，经同一数据桥检查显示；界面持续标注演示来源。 */
  const startDemo = useCallback(async () => {
    if (operation.current !== null) return;
    const generation = await stop();
    if (!mounted.current || generation !== session.current) return;
    source.current = 'demo'; dispatcher.reset('demo');
    setError(''); setStatus('演示数据 · 非传感器采集');
    let sequence = 0;
    demoTimer.current = setInterval(() => {
      if (dispatcher.publish(createDemoFrame(sequence++, Date.now()))) receivedFrames.current += 1;
    }, 50);
  }, [dispatcher, stop]);

  useEffect(() => {
    mounted.current = true;
    const frames = usbBridge?.addListener('onFrame', (frame) => {
      if (source.current !== 'usb') return;
      if (frame?.connectionId !== usbConnection.current) return;
      if (!isCurrentUsbFrame(frame, usbConnection.current)) { setError('USB 压力帧不是有效的32×32原始数据'); return; }
      if (dispatcher.publish(frame)) {
        receivedFrames.current += 1;
        if (receivedFrames.current === 1) setStatus('USB 数据接收中');
      }
      else setError('收到的 USB 压力帧无效或序号重复，请检查设备协议。');
    });
    const states = usbBridge?.addListener('onState', (state) => {
      if (source.current !== 'usb') return;
      if (state.connectionId !== usbConnection.current) return;
      if (state.status === 'connected') setStatus(receivedFrames.current > 0 ? 'USB 数据接收中' : 'USB 已连接，等待压力帧');
      if (state.status === 'disconnected' || state.status === 'error') {
        session.current += 1;
        operation.current = null;
        source.current = null; usbConnection.current = null; dispatcher.reset(null); setBusy(false);
        setStatus('USB 已断开');
        if (state.message) setError(state.message);
      }
    });
    const statistics = setInterval(() => setFrameCount(receivedFrames.current), 500);
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void stop();
    });
    return () => {
      mounted.current = false;
      frames?.remove(); states?.remove(); appState.remove(); clearInterval(statistics);
      void stop();
    };
  }, [dispatcher, stop]);

  /** 网页控制仅走校验后的 USB 命令；压力帧回执沿用原有有界桥。 */
  const handleWebMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      if (event.nativeEvent.data.length > 2048) throw new Error('页面回执过长');
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'web.ready' && message.version === 1) {
        webReady.current = true;
        sendHostState();
        dispatcher.setReady();
      }
      else if (message.type === 'web.frame') dispatcher.acknowledge(message.sequence);
      else if (message.type === 'web.error') setError(String(message.message ?? '画布数据接入失败').slice(0, 300));
      else {
        const command = parseUsbCommand(event.nativeEvent.data);
        if (command.action === 'refresh') void refreshDevices();
        else if (command.action === 'connect') void connectUsb(command);
        else if (command.action === 'disconnect') void stop();
        else if (command.action === 'demo') void startDemo();
      }
    } catch (failure) { setError(describeUsbError(failure)); }
  }, [connectUsb, dispatcher, refreshDevices, sendHostState, startDemo, stop]);

  return <SafeAreaView style={styles.workspace} edges={['top', 'right', 'bottom', 'left']}>
    <StatusBar style="light" />
    {loadError ? <Text accessibilityRole="alert" style={styles.error}>{loadError}</Text> : null}
    <WebView ref={webView} style={styles.web} source={displaySource}
      originWhitelist={['*']} javaScriptEnabled scrollEnabled={false} onMessage={handleWebMessage}
      onLoadStart={() => { suspendWebSession(); setLoadError(''); }}
      onLoadEnd={() => webView.current?.injectJavaScript("if(window.ShroomMobileHost && window.ShroomMobile){window.ReactNativeWebView.postMessage(JSON.stringify({type:'web.ready',version:1}));}true;")}
      onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url === 'https://shroom.mobile.local/'}
      onContentProcessDidTerminate={() => { suspendWebSession(); webView.current?.reload(); }}
      onError={(event) => { suspendWebSession(); setLoadError(`显示页面加载失败：${event.nativeEvent.description}`); }} />
  </SafeAreaView>;
}

/** 根组件提供 iPad 安全区域，页面与设备控制统一显示在离线 WebView。 */
export default function App() { return <SafeAreaProvider><PressureWorkspace /></SafeAreaProvider>; }

const styles = StyleSheet.create({
  workspace: { flex: 1, backgroundColor: colors.background },
  error: { color: colors.error, fontSize: 15, lineHeight: 22, paddingHorizontal: 24, paddingVertical: 12 },
  web: { flex: 1, backgroundColor: colors.background },
});
