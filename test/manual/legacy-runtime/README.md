# Legacy runtime manual fixtures

这些文件是早期串口与 WebSocket 调试脚本，仅用于人工参考或本地实验，不参与 Electron、后端服务或自动化测试的生产调用链。

- `serialport.legacy.js`：早期串口、UDP 与分隔符解析实验。
- `localWs.legacy.js`：本地 WebSocket 数据生成实验。
- `wsHelper.legacy.js`：旧广播辅助函数参考。
- `index.html`：早期手动调试页面。

新增正式能力时不要从这里引用；应分别使用 `sdk/backend`、`backend/kernel` 与 `backend/extension-host` 的稳定入口。
