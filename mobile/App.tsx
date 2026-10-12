import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { displayHtml } from './generated/display';
import { FrameDispatcher } from './src/frameDispatcher';
import { createDemoFrame, isCurrentUsbFrame, type FrameSource } from './src/pressureContract';
import { describeUsbError, usbBridge, type UsbDevice } from './src/usbBridge';

const colors = { background: '#08101c', panel: '#101d2c', text: '#edf5ff', muted: '#a8bacd', accent: '#65ded1', border: '#2a3f54', error: '#ffb1a8' };

/** 有按压反馈及足够触摸范围的采集控制按钮。 */
function Action({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

/** iPad 数据接入宿主：原生采集经过有界桥送给现有网页渲染器。 */
function PressureWorkspace() {
  useKeepAwake();
  const webView = useRef<WebView>(null);
  const source = useRef<FrameSource | null>(null);
  const session = useRef(0);
  const usbConnection = useRef<string | null>(null);
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const receivedFrames = useRef(0);
  const mounted = useRef(true);
  const dispatcher = useMemo(() => new FrameDispatcher((script) => webView.current?.injectJavaScript(script)), []);
  const [status, setStatus] = useState('等待连接');
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<UsbDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | undefined>();
  const [baudRate, setBaudRate] = useState('1000000');
  const [busy, setBusy] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  /** 停止当前来源并清空画布，取消在途连接；重复调用也能安全退出。 */
  const stop = useCallback(async () => {
    const generation = ++session.current;
    source.current = null;
    usbConnection.current = null;
    if (demoTimer.current) clearInterval(demoTimer.current);
    demoTimer.current = null;
    dispatcher.reset(null);
    receivedFrames.current = 0;
    if (mounted.current) { setStatus('等待连接'); setBusy(false); setFrameCount(0); }
    try { await usbBridge?.disconnect(); }
    catch (failure) { if (mounted.current) setError(describeUsbError(failure)); }
    return generation;
  }, [dispatcher]);

  /** 刷新驱动已匹配的真实设备；无驱动或权限不足会显示原生原因。 */
  const refreshDevices = useCallback(async () => {
    setError('');
    if (!usbBridge) { setError('当前安装包未包含 USB 模块，请安装 iOS development build。'); return; }
    try {
      const capability = await usbBridge.capabilities();
      if (!mounted.current) return;
      if (!capability.supported) { setError(capability.reason ?? '此设备尚不支持 USB 采集'); return; }
      const available = await usbBridge.listDevices();
      if (!mounted.current) return;
      setDevices(available);
      setSelectedDevice((previous) => available.some((device) => device.id === previous) ? previous : available[0]?.id);
      if (!available.length) setError('未发现可连接的 CH340。请插入传感器，并在 iPad 设置中启用已签名的 USB 驱动。');
    } catch (failure) { if (mounted.current) setError(describeUsbError(failure)); }
  }, []);

  /** 先断开旧来源，再连接指定设备；取消后的迟到结果不恢复旧采集。 */
  const connectUsb = useCallback(async () => {
    const baud = Number(baudRate);
    if (!Number.isSafeInteger(baud) || baud < 115200 || baud > 1000000) { setError('波特率应为 115200–1000000 的整数'); return; }
    if (!usbBridge) { setError('USB 采集需要包含原生模块与 CH340 驱动的安装包。'); return; }
    const generation = await stop();
    if (!mounted.current || generation !== session.current) return;
    source.current = 'usb';
    const connectionId = `${Date.now()}-${generation}-${Math.random().toString(36).slice(2)}`;
    usbConnection.current = connectionId;
    dispatcher.reset('usb');
    setError(''); setBusy(true); setStatus('正在连接 USB');
    try {
      await usbBridge.connect({ baudRate: baud, deviceId: selectedDevice, connectionId });
      if (mounted.current && generation === session.current) setStatus(receivedFrames.current > 0 ? 'USB 数据接收中' : 'USB 已连接，等待压力帧');
    } catch (failure) {
      if (mounted.current && generation === session.current) {
        source.current = null; usbConnection.current = null; dispatcher.reset(null);
        setStatus('USB 连接失败'); setError(describeUsbError(failure));
      }
    } finally { if (mounted.current && generation === session.current) setBusy(false); }
  }, [baudRate, dispatcher, selectedDevice, stop]);

  /** 显式开启演示源，经同一数据桥检查显示；界面持续标注演示来源。 */
  const startDemo = useCallback(async () => {
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
      if (state.status === 'connected') setStatus('USB 已连接，等待压力帧');
      if (state.status === 'disconnected' || state.status === 'error') {
        session.current += 1;
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

  /** 页面仅可报告就绪、帧回执或显示错误；不通过网页请求设备权限。 */
  const handleWebMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      if (event.nativeEvent.data.length > 2048) throw new Error('页面回执过长');
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'web.ready' && message.version === 1) dispatcher.setReady();
      else if (message.type === 'web.frame') dispatcher.acknowledge(message.sequence);
      else if (message.type === 'web.error') setError(String(message.message ?? '画布数据接入失败').slice(0, 300));
    } catch { setError('显示页面返回了无效的数据回执'); }
  }, [dispatcher]);

  return <SafeAreaView style={styles.workspace} edges={['top', 'right', 'bottom', 'left']}>
    <StatusBar style="light" />
    <View style={styles.header}>
      <View><Text style={styles.title}>Shroom · 压力监测</Text><Text style={styles.subtitle}>32 × 32 / 1024 点 · 原始压力</Text></View>
      <View><Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text><Text style={styles.subtitle}>{frameCount} 帧已接入</Text></View>
    </View>
    <ScrollView horizontal style={styles.toolbar} contentContainerStyle={styles.actions}>
      <Action label="刷新 USB" onPress={() => void refreshDevices()} disabled={busy} />
      <View style={styles.baud}><Text style={styles.subtitle}>波特率</Text><TextInput accessibilityLabel="串口波特率" value={baudRate}
        onChangeText={setBaudRate} keyboardType="number-pad" editable={!busy && source.current !== 'usb'} style={styles.input} /></View>
      <Action label="连接 USB" onPress={() => void connectUsb()} disabled={busy || source.current === 'usb'} />
      <Action label="停止" onPress={() => void stop()} />
      <Action label="演示数据" onPress={() => void startDemo()} disabled={busy} />
    </ScrollView>
    {devices.length > 0 && <ScrollView horizontal style={styles.devices} contentContainerStyle={styles.actions}>
      {devices.map((device) => <Pressable key={device.id} accessibilityRole="radio" accessibilityState={{ selected: selectedDevice === device.id }}
        onPress={() => setSelectedDevice(device.id)} disabled={busy || source.current === 'usb'} style={[styles.button, selectedDevice === device.id && styles.selected]}>
        <Text style={styles.buttonText}>{device.name}</Text>
      </Pressable>)}
    </ScrollView>}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <WebView ref={webView} style={styles.web} source={{ html: displayHtml, baseUrl: 'https://shroom.mobile.local/' }}
      originWhitelist={['*']} javaScriptEnabled scrollEnabled={false} onMessage={handleWebMessage}
      onLoadStart={() => dispatcher.setNotReady()}
      onLoadEnd={() => webView.current?.injectJavaScript("if(window.ShroomMobile){window.ReactNativeWebView.postMessage(JSON.stringify({type:'web.ready',version:1}));}true;")}
      onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url === 'https://shroom.mobile.local/'}
      onContentProcessDidTerminate={() => { dispatcher.setNotReady(); webView.current?.reload(); }}
      onError={(event) => { dispatcher.setNotReady(); setError(`显示页面加载失败：${event.nativeEvent.description}`); }} />
  </SafeAreaView>;
}

/** 根组件提供 iPad 安全区域，网页显示与 RN 控件共享同一工作区。 */
export default function App() { return <SafeAreaProvider><PressureWorkspace /></SafeAreaProvider>; }

const styles = StyleSheet.create({
  workspace: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 20, paddingHorizontal: 24, paddingVertical: 16 },
  title: { color: colors.text, fontSize: 22, fontWeight: '600' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  status: { color: colors.accent, fontSize: 16, lineHeight: 26 },
  toolbar: { flexGrow: 0, backgroundColor: colors.panel, maxHeight: 86 },
  actions: { alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 12 },
  button: { minHeight: 44, minWidth: 84, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  buttonText: { color: colors.text, fontSize: 16 },
  selected: { borderColor: colors.accent },
  disabled: { opacity: 0.4 }, pressed: { opacity: 0.65 },
  baud: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { minHeight: 44, width: 112, color: colors.text, fontSize: 16, padding: 10, backgroundColor: colors.background, borderRadius: 8 },
  devices: { flexGrow: 0, maxHeight: 74 },
  error: { color: colors.error, fontSize: 15, lineHeight: 22, paddingHorizontal: 24, paddingVertical: 12 },
  web: { flex: 1, backgroundColor: colors.background },
});
