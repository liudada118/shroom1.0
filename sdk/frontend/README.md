# Shroom Frontend SDK

前端 SDK 只处理浏览器侧能力，不包含 Node 串口、数据库和文件系统依赖。

## 已抽出的能力

- `SensorClient`：统一 WebSocket 连接、消息接收和命令发送
- `FrameStore`：缓存最新实时帧，按 `sensorType:channel` 查询
- `normalizeIncomingMessage()`：把新旧 WebSocket 数据归一化成统一 frame
- `DisplayRegistry`：展示系统注册表
- `DEFAULT_DISPLAY_SYSTEMS`：从现有 `Home.jsx` / `Title.jsx` 抽出的展示系统 metadata
- `sensorCommands`：标准前端命令构造器

## 基础用法

```js
import {
  SensorClient,
  FrameStore,
  createDefaultDisplayRegistry,
  sensorCommands,
} from '../../sdk/frontend/index.js';

const client = new SensorClient({
  url: 'ws://127.0.0.1:19999',
  legacyProtocol: true,
});
const frameStore = new FrameStore();
const registry = createDefaultDisplayRegistry();

client.on('frame', (frame) => {
  frameStore.update(frame);
});

client.connect();

client.send(sensorCommands.serialOpen({
  sensorType: 'hand0205',
  channels: {
    sit: 'COM3',
  },
}));

const system = registry.get('hand0205');
const rendererKey = registry.getRendererKey('hand0205', 'normal');
```

`legacyProtocol: true` 会把标准命令转换成当前老后端仍在使用的消息格式，例如：

```js
{ type: 'serial.open', payload: { channels: { sit: 'COM3' } } }
```

会发送为：

```js
{ sitPort: 'COM3' }
```

## 迁移策略

第一阶段不要重写现有 Three.js 组件。先让页面使用：

- `SensorClient` 替代散落的 WebSocket 命令
- `FrameStore` 替代多个局部数据缓存
- `DisplayRegistry` 替代 `Home.jsx` 中不断增长的 `matrixName === xxx` 分支

单个系统迁移完成后，再逐步把 renderer 从字符串 key 替换成真实组件 adapter。
