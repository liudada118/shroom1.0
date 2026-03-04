# 多 WS → 单 WS 重构分析

## 现状
- server(19999): 坐垫数据 sitData 广播 + 所有控制指令（sitPort/backPort/headPort/file/date 等）
- server1(19998): 靠背数据 backData 广播 + backPort 连接指令（重复）
- server2(19997): 头枕数据 headData 广播

## 问题
1. 前端需要连接 3 个 WS（ws/ws1/ws2），代码冗余
2. backPort 指令在 server 和 server1 中都有处理，逻辑重复
3. 数据按端口分离，但数据格式已通过 sitData/backData/headData 字段区分

## 优化方案
将 server1 和 server2 的广播合并到 server(19999)：
- sitData 已通过 server(19999) 广播
- backData 改为通过 server(19999) 广播（添加 backData 字段）
- headData 改为通过 server(19999) 广播（添加 headData 字段）
- 前端只需连接 ws://127.0.0.1:19999，通过字段名区分数据来源

## 影响范围
### 后端 server.js
- server1.clients.forEach 广播 → 改为 server.clients.forEach（19处）
- server2.clients.forEach 广播 → 改为 server.clients.forEach（9处）
- server1 消息处理中的 backPort 指令 → 已在 server 中有处理，可删除
- 保留 server1/server2 的端口监听（向后兼容），但不再必需

### 前端
- Home.jsx: 删除 ws1/ws2 连接，ws.onmessage 中同时处理 sitData/backData/headData
- Demo1010.jsx: 删除 ws1/ws2
- handDemoPress.jsx: 改为连接 19999
- constants.js: 简化 WS_PORTS
