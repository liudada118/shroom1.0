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

await client.getContract();
await client.displaySystems.register(registry);

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

Manifest v2 的 `display.profiles` 可以组合 `renderers`、`visualizationAlgorithms` 和 widgets。SDK 可通过 `registry.getProfiles(sensorType)` 与 `registry.getProfile(sensorType, profileId)` 获取可选择方案，再由产品实验室或独立客户端映射到自己的菜单和渲染组件。

`SensorClient.displaySystems` 还提供 `catalog()`、`editor(id)`、`save(input)` 和 `reload()`，产品实验室可以复用主项目相同的页面配置与热加载接口。

`client.displaySystems.register(registry)` 会读取 `/api/display-systems` 的 runtime definitions，并通过 `DisplayRegistry.registerManifest()` 注册打包后新增的展示系统。注册结果包含页面 layout、widgets、controls、协议摘要、算法声明和可选的 `coordinateMap` 物理点坐标，可供主项目或产品实验室使用同一份 manifest 构建真实形状点图。

`legacyProtocol: true` 会把标准命令转换成当前老后端仍在使用的消息格式，例如：

```js
{ type: 'serial.open', payload: { channels: { sit: 'COM3' } } }
```

会发送为：

```js
{ sitPort: 'COM3' }
```

## 后端契约

新版后端提供：

```text
GET /api/sdk/contract
```

`SensorClient.getContract()` 会读取这个契约，并同步更新 HTTP 路由、WebSocket 订阅消息类型和 telemetry 元信息。这样前端 SDK 不需要读取 `server.js`、`controlRoutes.js` 或后端 runtime 内部状态。

## 迁移策略

第一阶段不要重写现有 Three.js 组件。先让页面使用：

- `SensorClient` 替代散落的 WebSocket 命令
- `FrameStore` 替代多个局部数据缓存
- `DisplayRegistry` 替代 `Home.jsx` 中不断增长的 `matrixName === xxx` 分支

单个系统迁移完成后，再逐步把 renderer 从字符串 key 替换成真实组件 adapter。
