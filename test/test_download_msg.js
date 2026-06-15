const WebSocket = require('ws');

// 连接到 Electron 的 WS 服务器
const ws = new WebSocket('ws://127.0.0.1:19999');

ws.on('open', () => {
  console.log('WS 已连接');
  
  // 先切换到 smallSample
  ws.send(JSON.stringify({ file: 'smallSample' }));
  console.log('已发送切换到 smallSample');
  
  // 等待 2 秒后发送 download 消息（模拟 server 发送）
  setTimeout(() => {
    // 直接通过 WS 广播 download 消息
    // 但这里我们是客户端，不能广播。需要触发 server 的 download 逻辑
    // 发送 download 请求
    ws.send(JSON.stringify({ download: '1234567890' }));
    console.log('已发送 download 请求');
  }, 2000);
  
  // 等待 5 秒后关闭
  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, 5000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  // 只打印 download 相关消息
  if (msg.download != null) {
    console.log('[收到 download 响应]:', JSON.stringify(msg));
  } else {
    // 打印消息的 key
    console.log('[收到消息] keys:', Object.keys(msg).join(', '));
  }
});

ws.on('error', (err) => {
  console.error('WS 错误:', err.message);
});
