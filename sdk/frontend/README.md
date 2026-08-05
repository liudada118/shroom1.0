# @shroom/frontend

压力传感前端 SDK。只处理浏览器侧能力，不含 Node 串口、数据库和文件系统依赖。

给**新项目的开发者**：装上、喂一个数组、画面出来。

```bash
cd example && npm i && npm run dev     # → 32×32 数字矩阵，游动的高斯斑
```

`example/` 是最短可跑路径，也是这个包的验收标准。想看怎么用，直接读
[example/src/main.jsx](example/src/main.jsx) —— 核心只有三行。

---

## 三行版

```jsx
import { RendererHost, registerBuiltinRenderers } from '@shroom/frontend/react';
import '@shroom/frontend/styles/canvas.css';

registerBuiltinRenderers();          // 注册本包 ships 的渲染器（当前只有 numMatrix）

<RendererHost rendererId="numMatrix" params={params} values={frame} channel="sit" />
```

`values` 是**声明式**入口：给了它就不订阅帧总线，宿主内部转成
`api.sitData({ wsPointData })` 推给渲染器。喂数据不需要碰 ref，也不需要认识渲染器
的命令式接口。

高频场景（每秒几十帧、不想触发 React 重渲染）改走帧总线：`publishFrame()` 发，
`<RendererHost frameChannel="sit" />` 收，或者用 `useSceneFrame()` 自己订阅。两条路
二选一，别同时给。

---

## 四个入口

| 入口 | 内容 | 依赖 |
| :--- | :--- | :--- |
| `@shroom/frontend` | 传输（`SensorClient`）、帧存储（`FrameStore`）、展示系统定义（`DisplayRegistry`），**并全量转出 `core`** | 无 |
| `@shroom/frontend/core` | 契约、渲染器注册表、帧管线、配色、阈值、坐标布局 | 无 |
| `@shroom/frontend/react` | `RendererHost`、`useSceneFrame`、`registerBuiltinRenderers` | peer: react + three |
| `@shroom/frontend/styles/canvas.css` | 6 行 canvas 样式（`.canvasNum`） | 无 |

**根出口刻意不含 `react/`。** 一旦含了，`SensorClient` 的裸 Node 消费者（后端测试里
就有一个）连 import 都做不到。需要 React 那层的人都在浏览器里，走子路径。

`core/` 的性质是**零依赖、裸 Node 可直接 import**，由
[scripts/smoke-core.mjs](scripts/smoke-core.mjs) 守着（`npm run smoke`）：无打包器、
无 `localStorage` 垫片、无 vitest。这三样在测试环境里都会把「装到新项目里就崩」那类
错遮住 —— 少写 `.js` 扩展名、模块顶层读 `localStorage`、悄悄引入 react/three。

`core/numMatrix` 也可单独取：`import { deriveGrid } from '@shroom/frontend/core/numMatrix'`。

> ### ⚠️ 已知缺口：根出口在 `npm pack` 装出来的包里加载不了
>
> `src/client/commands.js` 第一行是
> `import schema from '../../../../shared/commandSchema.json'` —— 四级向上，**跑出了
> 包的根目录**。在仓库里（`file:` / `npm link`）它解析到 `<repo>/shared/`，所以主应用
> 和 [example](example/src/main.jsx) 都正常；但 tarball 装出来之后，四级向上是
> `node_modules/`，那里没有 `shared/`，于是**整个根 barrel 在 import 时就抛**。
>
> | 入口 | `file:` / monorepo | `npm pack` tarball |
> | :--- | :---: | :---: |
> | `@shroom/frontend/core`（含全部子路径） | ✓ | ✓ |
> | `@shroom/frontend/react` | ✓ | ✓（需打包器，裸 Node 认不了 `.jsx`） |
> | `@shroom/frontend/styles/canvas.css` | ✓ | ✓ |
> | `@shroom/frontend`（根，含 `SensorClient`） | ✓ | ✗ |
>
> 这是拆包之前就存在的问题（`src/client/` 本轮没动），暴露出来是因为加了「从零装
> tarball」这一步验证。**绕法**：需要传输层就用 `file:` 依赖或直接从
> `@shroom/frontend/core` + 自己的 WebSocket 代码起步；渲染器那条路（`/core` + `/react`）
> 完全不受影响。
>
> **真正的修法是一个归属决定，不是一行补丁**：`shared/commandSchema.json` 现在有 5 个
> 消费者（`backend/contracts/commandProtocol.js`、`backend/contracts/sdkApiContract.js`、
> `client/src/services/command/commandClient.js`、
> `client/src/services/command/commandSchema.js`，以及这里），得先定「这份契约归后端还
> 是归 SDK」，再决定谁 import 谁。记进积压。

---

## 消费者必须做的三件事

### 1. `resolve.dedupe`（不做会崩，不是优化项）

```js
// vite.config.js
resolve: { dedupe: ['react', 'react-dom', 'three'] }
```

用 `file:` / `npm link` 装本包时，node_modules 里是个 symlink，真实路径在你的项目
之外。Node/打包器从真实路径向上找 `node_modules`，找不到你那份 react 和 three。
dedupe 一条解决两件事：

1. 让包内的裸 `react` / `three` import **能解析到**；
2. 保证全应用只有**一份** —— 两份 React 会让 hooks 直接崩，两份 three 会让
   `instanceof THREE.Xxx` 全部失效（sprite3d 后端到处在用）。

webpack 用 `resolve.alias` 指到你那份，rollup 用 `@rollup/plugin-node-resolve` 的
`dedupe`。抄 [example/vite.config.js](example/vite.config.js) 最省事。

### 2. peer 依赖

```json
"peerDependencies": { "react": ">=18", "react-dom": ">=18", "three": ">=0.127" }
```

三个都标了 `optional: true` —— 只用 `core` 的 Node 消费者不该被逼装 three。但用
`/react` 就**必须**装齐，否则 import 直接失败。

`three` 的范围宽到 `>=0.127` 是因为主应用 pin 的是 `^0.127.0`（2021 年的版本）。写
`^0.170` 会让主应用装不上。

### 3. 如果你用代码混淆器

把本包整个目录排进 `exclude`。渲染器走 `load: () => import('./xxx.jsx')` 懒加载，
`stringArray` / `splitStrings` 会把那个路径字面量改写成运行时表达式，打包器随即无法
静态分析，**懒加载 chunk 拆不出来、被内联回主包**。注意匹配的是 symlink 解析后的
真实路径，`node_modules/**` 一条挡不住。主应用那条写法在
[client/vite.config.js](../../client/vite.config.js) 的 `obfuscatorPlugin` 里。

---

## ⚠️ 公开面：`RENDERER_PROPS` 与 `RENDERER_METHODS`

[core/contract.js](core/contract.js) 里这两个对象**是本包的公开 API**。

**改它们是 breaking change。** 往 `RENDERER_PROPS` 里补一个 prop，看着像纯追加，实际
上下游所有自研渲染器的契约审计都会开始报「未实现」；从 `RENDERER_METHODS` 里删一个
方法名，下游声明了它的描述符会直接注册失败。

**这里有一个明说的缺口：前端契约目前没有版本号。** 后端有
`SDK_CONTRACT_VERSION = '2026-07-14'` 和「纯追加不升版本」的规矩，前端一个都没有。
这是拆包比内部收敛多出来的真实成本 —— 本轮不定版本策略，但改这两个对象之前请先确认
下游，别指望有机制拦住你。

写自己的渲染器时用 `validateRendererDescriptor(descriptor)` 自查；`RendererHost` 挂载
时也会跑一遍 `auditRendererContract`，声明了没实现、实现了没声明都会在控制台点出来
（同一个渲染器只报一次）。注册失败**不抛错**，只记录原因并返回 `false` —— 坏插件不该
让整个应用起不来。

---

## 两层注册表，别搞混

这是最容易踩的一处概念混淆，两者可以合法共存：

| | `DisplayRegistry`（`src/display/`） | 渲染器注册表（`core/registry.js`） |
| :--- | :--- | :--- |
| 管什么 | **一台设备的完整定义**：协议、矩阵尺寸、通道、视图 | **把一帧数据画出来的那段实现** |
| 单位 | 展示系统（`matCol`、`carCol`、`smallBed12B`…） | 渲染器（`numMatrix`、`pointGrid`…） |
| 关系 | 多个展示系统**共用**同一个渲染器，只是参数不同 | ← 所以要拆开 |

例：`matCol` 与 `carCol` 是两个展示系统，渲染器是同一个，差别仅在 `sit.num1` 和
`sit.order` 两个数字。

`resolveRendererFromDefinition(definition)` 是两层之间的桥：从展示系统定义里解析出
渲染器 id 与参数，**解析不出来时返回 `null`**（不抛）。这个回落是绞杀者模式的关键 ——
新渲染器覆盖不到的展示系统继续走旧路径，迁移可以一次一个。

> **已知积压**：`src/display/DisplayRegistry.js` 的 `VIEW_RENDERERS` 里
> `matrix: 'Num2D'` 与 `raw2d: 'Num2DOriginal'` 是**失效的组件名字符串** —— 那两个组件
> 已经参数化进 `numMatrix` 了。这张表只在 manifest 没显式写 `view.renderer` 时兜底，
> 所以目前不影响任何在跑的通路，但它是过期信息，别照着它写新代码。

---

## 目录

```
core/                 零依赖层，裸 Node 可 import
  contract.js         RENDERER_PROPS / RENDERER_METHODS / RENDERER_CAPABILITIES + 描述符校验
  registry.js         渲染器注册 / 懒加载 / 从展示系统定义解析
  frameBus.js         帧总线（发布订阅，绕开 React 重渲染）
  sceneFrame.js       帧结构与通道常量
  frameMath.js        findMax / jet / press 三个纯函数
  colormaps.js        7 条配色 + 采样
  jetLadder.js        jet 阶梯（全仓 18 处老配色用的那条）
  displayThresholds.js      阈值持久化（用 globalThis.localStorage?.，所以裸 Node 不用垫片）
  coordinatePointLayout.js  物理坐标表 → 布局
  bed4096numParams.js       共享调参对象（模块级单例）
  numMatrix/params.js       参数归一化 + 预设（fast256 / fast1024 / fast1024sit / smallBed12B）
  numMatrix/pipeline.js     量化 / 统计 / 下限过滤 / 纹理尺寸推导
react/                peer: react + three
  RendererHost.jsx    宿主：懒加载 + 契约审计 + 声明式 values / 帧总线两条通道
  useSceneFrame.js    订阅帧总线的 hook —— 二开者消费帧的正式入口
  builtins.js         注册本包 ships 的渲染器
  numMatrix/NumMatrixRenderer.jsx
  numMatrix/backends/sprite3d.js   three.js InstancedMesh，一次 draw call 画完整片矩阵
styles/canvas.css     6 行
src/client/           SensorClient —— WebSocket + HTTP 控制面
src/store/            FrameStore + 新旧协议归一化
src/display/          DisplayRegistry + 默认展示系统
example/              可跑 demo（不进 npm 包的 files）
scripts/smoke-core.mjs  零依赖层的裸 Node 守卫
```

---

## 传输层：SensorClient / FrameStore / DisplayRegistry

这一层比渲染器层早一轮，管的是「怎么连上后端、怎么认识设备」。**注意上面那条已知缺口：
这一层目前只在 `file:` / monorepo 下可用，tarball 装出来加载不了。**

```js
import {
  SensorClient,
  FrameStore,
  createDefaultDisplayRegistry,
  sensorCommands,
} from '@shroom/frontend';

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
  channels: { sit: 'COM3' },
}));

const system = registry.get('hand0205');
const rendererKey = registry.getRendererKey('hand0205', 'normal');
```

`on('frame')` 拿到的是**归一化后**的帧：`{ sensorType, channel, mode, timestamp,
matrix, data, raw, stats, extra }`。不管后端发的是新协议还是 legacy 字段名，到这里
都是同一个形状 —— 归一化在 `src/store/normalizeFrame.js` 里做完了。`frame.data` 就是
可以直接喂给 `RendererHost` 的 `values` 的那个数组（[example](example/src/main.jsx)
里的「连真后端」开关就是这么接的）。

Manifest v2 的 `display.profiles` 可以组合 `renderers`、`visualizationAlgorithms` 和
widgets。用 `registry.getProfiles(sensorType)` 与 `registry.getProfile(sensorType,
profileId)` 获取可选方案，再映射到自己的菜单和渲染组件。

`SensorClient.displaySystems` 还提供 `catalog()`、`editor(id)`、`save(input)` 和
`reload()`，可以复用主项目相同的页面配置与热加载接口。

`client.displaySystems.register(registry)` 会读取 `/api/display-systems` 的 runtime
definitions，并通过 `DisplayRegistry.registerManifest()` 注册打包后新增的展示系统。
注册结果包含页面 layout、widgets、controls、协议摘要、算法声明和可选的
`coordinateMap` 物理点坐标 —— 后者可以直接传给 `RendererHost` 的 `coordinateMap`
prop，按实际点位布局而不是规则矩阵。

`legacyProtocol: true` 会把标准命令转换成老后端仍在使用的消息格式：

```js
{ type: 'serial.open', payload: { channels: { sit: 'COM3' } } }   // 标准
{ sitPort: 'COM3' }                                              // 实际发出
```

### 后端契约

```text
GET /api/sdk/contract
```

`SensorClient.getContract()` 会读取这个契约，并同步更新 HTTP 路由、WebSocket 订阅消息
类型和 telemetry 元信息。这样前端 SDK 不需要读取 `server.js`、`controlRoutes.js` 或
后端 runtime 内部状态。后端侧的版本号是 `SDK_CONTRACT_VERSION`（见上面「公开面」一节
里关于前端还没有版本号的说明）。

---

## 本地开发

```bash
npm test        # vitest，121 例（core 的纯函数 + 参数归一化 + 逐点比对）
npm run smoke   # 裸 Node 跑一遍 core，12 项
cd example && npm i && npm run dev
```

在仓库根上也有：`npm run sdk:frontend-test` / `npm run sdk:frontend-smoke`。

改包内文件时 `example` 的 dev server 会热更新 —— linked 依赖默认不做预构建，源码直接
过转换管线。

---

## 边界

- **`private: true`，不发公共 registry。** 分发走 `npm pack` tarball 或 `file:`。想真
  发布是另一件事（要定 scope 归属与版本承诺）。
- **tarball 里根出口加载不了**，见上面「已知缺口」。渲染器那条路不受影响。
- **当前只 ships 一个渲染器 `numMatrix`。** `pointGrid`（框选 / 点位拾取 / 视角旋转）
  还在主应用里，第二轮再搬。
- **`BACKENDS = ['sprite3d']`。** canvas2d 与 webgl 两个后端没搬。
- **渲染器是构建期解析的。** `load: () => import()` 由打包器静态分析，所以**装机之后
  加不了新渲染器**。二开的两条路里，本包解决的是「新项目消费」，不是「装机后插件化」。
- **主应用的迁移用 re-export 壳做的**：`client/src` 里搬走的模块原路径都留了一行
  `export * from '@shroom/frontend/...'`，所以主应用的 import 一行没改。改包内文件会
  同时影响主应用，别当成两份代码。
