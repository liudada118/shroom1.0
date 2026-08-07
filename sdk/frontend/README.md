# @shroom/frontend

压力传感前端 SDK。只处理浏览器侧能力，不含 Node 串口、数据库和文件系统依赖。

给**新项目的开发者**：装上、喂一个数组、画面出来。

```bash
cd example && npm i && npm run dev     # → 32×32 数字矩阵，游动的高斯斑
```

`example/` 是最短可跑路径，也是这个包的验收标准。想看怎么用，直接读
[example/src/main.jsx](example/src/main.jsx) —— 核心只有三行。

### 系统学一遍：开文档站

```bash
npm --prefix docs i && npm --prefix docs run dev      # 或在仓库根上：npm run sdk:frontend-docs
```

[docs/](docs/) 是一个 10 页的在线文档站：讲解 + **能动的实时画面** + 「显示代码」。

它和这份 README 的区别不是篇幅，是**会不会过期**。README 里的参数表、方法清单、预设名
全是**手抄**的 —— `RENDERER_METHODS` 改一行，README 不会有任何报错。文档站里那些表格
**从 `core` 直接 import 渲染**，每段代码样例用 Vite 的 `?raw` 显示**正在上面那块画面里
跑的那个文件本身**（同一份源码 import 两次，一次跑一次显示）。新增一个渲染器 / 配色 /
预设，文档站自动多一项。

| 页 | 有什么 |
| :--- | :--- |
| 快速开始 | 最短路径；显示的源码就是 `example/src/main.jsx` 本身（跨目录 `?raw`） |
| 数字矩阵 / 点阵热力 | 活预览 + 预设 + 7 配色 + 参数面板 |
| 一览 | 预设 × 配色 缩略图墙（WebGL 上下文限流的实测场） |
| **写自己的渲染器** | 一个约 140 行的 Canvas 2D 渲染器，不属于本包，走完整条正式路径。**这一页是这个站真正的产出** —— 在它之前，全仓关于「怎么写自己的渲染器」只有一句「用 `validateRendererDescriptor` 自查」 |
| 帧总线 | `publishFrame` / `useSceneFrame` 的第一个消费者 |
| 契约 / 入参 | 全部从 `core/contract.js` 读，包括下面那三个未声明方法 |
| 坑 | 踩过的账：dedupe / peer / 混淆器 / png loader / tarball 缺陷 / 视口-容器 / WebGL 预算 |

`docs/` 与 `example/` 都**排出装机包**（根 `package.json` 的 `build.files` 与 forge
`packagerConfig.ignore` 各一条），也不进 `npm pack`。

---

## 三行版

```jsx
import { RendererHost, registerBuiltinRenderers } from '@shroom/frontend/react';
import '@shroom/frontend/styles/canvas.css';

registerBuiltinRenderers();          // 注册本包 ships 的渲染器：numMatrix + pointGrid + handPoints

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
| `@shroom/frontend/react` | `RendererHost`、`useSceneFrame`、`registerBuiltinRenderers`，三个渲染器（`numMatrix`，三个后端 `sprite3d` / `canvas2d` / `webgl`；`pointGrid`；`handPoints`）+ `three/{SelectionHelper,pointPick,circle.png}` + `webgl/glUtil.js` | peer: react + three |
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

## 消费者必须做的四件事

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

### 4. 你的打包器要能处理 `.png` import

`pointGrid` 与 `handPoints` 的点精灵贴图是 `import circleUrl from '../three/circle.png'`
出来的打包资源（[react/three/circle.png](react/three/circle.png)，两者共用同一张）。
Vite 原生支持，webpack 5 走 asset modules，Rollup 需要 `@rollup/plugin-url` 之类。

**这条以前不是义务，2026-08-05 `pointGrid` 进包时才变成义务。** 它原来写的是
`new TextureLoader().load('./circle.png')` —— 一个**运行期相对 URL**，靠
`client/public/circle.png` 恰好被 serve 在站点根目录才成立。装进别人的项目就是 404，
现象是**点阵整片全白**（不报错，纹理加载失败 three 只在控制台留一条）。

不想让打包器碰图的话，`params.pointSprite` 传一个你自己的贴图 URL 就行 —— 它直接进
`TextureLoader().load()`，包里那张图只是 `||` 的右侧默认值。

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

### 2026-08-06 第三轮往公开面追加了 11 项

`RENDERER_METHODS` +10（`bthClickHandle` / `calibration` / `handZero` /
`changeHandAngle` / `drawContent` / `changeColor` / `changeType` / `changeBox` /
`cancelSelect` / `changaCamera` —— 最后一个原拼写就少一个 e，照抄不改），
`RENDERER_CAPABILITIES` +1（`ARTICULATED`，关节/骨骼驱动的布局）。
**`RENDERER_PROPS` 一个都没加**，所以下游自研渲染器的契约审计不受影响。

同一轮给描述符加了一个可选字段 **`optionalMethods`**：标出「同一个渲染器换一套参数
就不再暴露」的那几个方法。`numMatrix` 是第一个用它的 —— 壳自己实现的 4 个方法
（`sitData` / `sitValue` / `changeWsData` / `changeWsDataRaw`）任何后端都有，其余
**11 个**按后端而定：`sprite3d` 一个都不给，`canvas2d` 给 10 个，`webgl` 给 4 个
（`changeWsData147` / `changeWsData147R` / `changeWsData256` / `drawContent`，其中
除 `changeWsData147R` 外的三个与 `canvas2d` 重名 —— 重名就意味着语义必须一致，
`builtins.test.js` 有一条断言钉住「重名的确实只有这三个」）。`methods` 写**并集**共 15 个（照常逐个校验
在不在契约里），`optionalMethods` 标出可以缺席的那 11 个，三种后端的审计因此都干净。
约束：**必须是 `methods` 的子集**，否则注册失败（不在 `methods` 里的名字审计根本
看不到）。**别拿它当"懒得实现"的免死金牌。**

> ⚠️ **`optionalMethods` 只能表达「可选」，不能表达「哪个后端有哪几个」。** 契约审计
> 是按渲染器 id 做的，而 `numMatrix` 的方法集是按 `params.backend` 变的 ——
> 结果是走 `webgl` 时那 7 个只有 `canvas2d` 才有的方法也算「合法缺席」，写错后端名
> 导致的缺失审计看不出来。这是积压的一条：要么把审计做成按解析后的参数来判，要么让
> 描述符能声明 per-variant 的方法集。`builtins.test.js` 现在用两个后端 `commandNames`
> 的并集对账，至少保证名单本身不会漂。

### ⚠️ `data.current` 上的三个方法：契约管不着的一块公开面

`RENDERER_PROPS` 里有一项 `data`，说明写的是「宿主注入的 ref」。但 **`data.current` 上
要有哪些方法，没有任何地方声明** —— 而 `pointGrid` 每帧都在调它们：

| 方法 | 谁调 | 参数 | 干什么 |
| :--- | :--- | :--- | :--- |
| `changeData(stats)` | `pointGrid` | `{ meanPres, maxPres, point, totalPres }`（均压两位小数的字符串、最大值、受压点数、总压） | 更新侧栏读数 |
| `handleCharts(series, max)` | `pointGrid` | 总压最近 20 帧的数组 + `findMax(series) + 1000` | 画总压曲线 |
| `handleChartsArea(series, max)` | `pointGrid` | 受压点数最近 20 帧的数组 + `findMax(series) + 100` | 画受压面积曲线 |

后两个在 `props.local` 为真时**跳过**（本地模式没有侧栏图表）。

调用点写的是 `host.data?.current?.changeData({...})` —— **可选链只保住了 `current`，
没保住那三个方法**。所以：传 `data` 就得把三个方法都挂上，或者干脆别传 `data`
（`undefined` 走可选链是安全的）。传一个空的 `useRef({})` 进去是最容易踩的那种：
`current` 存在，方法不存在，第一帧就 `TypeError`。

**这里只补声明，没改代码。** 把它们提进 `RENDERER_METHODS` 那种正式契约是可以做的，
但那会让所有现有渲染器的契约审计立刻开始报「未实现」—— 见上面那段「改它们是 breaking
change」。记进积压。

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

---

## 目录

```
core/                 零依赖层，裸 Node 可 import
  contract.js         RENDERER_PROPS / RENDERER_METHODS / RENDERER_CAPABILITIES + 描述符校验
  registry.js         渲染器注册 / 懒加载 / 从展示系统定义解析
  frameBus.js         帧总线（发布订阅，绕开 React 重渲染）
  sceneFrame.js       帧结构与通道常量
  frameMath.js        findMax / jet / press + addSide / gaussBlur_1 / interpSmall
  colormaps.js        7 条配色 + 采样（每条自带 previewCss，色带条不用自己画）
  jetLadder.js        jet 阶梯（全仓 18 处老配色用的那条）
  greyLadder.js       garyColors + jetgGrey（点阵的灰阶，未选中区域用）
  displayThresholds.js      阈值持久化（用 globalThis.localStorage?.，所以裸 Node 不用垫片）
  coordinatePointLayout.js  物理坐标表 → 布局
  bed4096numParams.js       共享调参对象（模块级单例）
  numMatrix/params.js       参数归一化 + 24 条预设（sprite3d 4：fast256 / fast1024 /
                            fast1024sit / smallBed12B；canvas2d 2：num3dDefault /
                            num3dCarCol；webgl 18：webglNum* 5 + webglRaw* 13）
                            + BACKENDS 白名单
  numMatrix/pipeline.js     量化 / 统计 / 下限过滤 / 纹理尺寸推导
  numMatrix/layouts.js      点位铺排：147 点手套两变体 / 60 点足底散布 + 插值 /
                            POT 取整 / 方阵转置 / 格子边长
  numMatrix/robotLayouts.js 三套机器人分区表 + buildRobotFrame（拼纹理 + 掩码）
  numMatrix/shaders.js      顶点/片元着色器**源码字符串**生成（4 个变体，jet 阶梯
                            从 jetLadder.js 发码 —— 不是第 19 份抄的）
  pointGrid/params.js       参数归一化 + 预设（matCol / carCol）+ deriveGridSize
  pointGrid/pipeline.js     插值 / 补边 / 高斯模糊（纯帧运算，有逐帧一致性测试）
react/                peer: react + three
  RendererHost.jsx    宿主：懒加载 + 契约审计 + 声明式 values / 帧总线两条通道
  useSceneFrame.js    订阅帧总线的 hook —— 二开者消费帧的正式入口
  builtins.js         注册本包 ships 的三个渲染器
  numMatrix/NumMatrixRenderer.jsx
  numMatrix/backends/sprite3d.js   three.js InstancedMesh，一次 draw call 画完整片矩阵
  numMatrix/backends/canvas2d.js   2D canvas 逐格 fillText + CSS perspective 的伪三维
  numMatrix/backends/webgl.js      WebGL 亮度纹理热场 + 2D 叠加层画数字/网格，
                                   两个变体（plain = 原 Num2D，original = 原
                                   Num2Doriginal，多掩码/POT/零值显白/分区布局）
  pointGrid/PointGridRenderer.jsx  three.js Points + TrackballControls，可框选
  handPoints/HandPointsRenderer.jsx three.js Points + GLTF 手模 + IMU 四元数驱动
                                   的手指关节旋转（唯一有 ARTICULATED 能力的）
  three/SelectionHelper.js         拖拽框选的那个 div
  three/pointPick.js               世界坐标 → 屏幕矩形 → 网格下标
  three/circle.png                 点精灵贴图（打包资源，不是运行期相对 URL）。
                                   pointGrid 与 handPoints 共用，所以在 three/
                                   而不是任一渲染器自己的目录下
  webgl/glUtil.js                  createShader / createProgram / 亮度纹理上传 /
                                   资源释放（唯一允许的模块级可变状态：预热过的
                                   着色器源码 Set，说明写在文件头）
styles/canvas.css     6 行
src/client/           SensorClient —— WebSocket + HTTP 控制面
src/store/            FrameStore + 新旧协议归一化
src/display/          DisplayRegistry + 默认展示系统
example/              可跑 demo（不进 npm 包的 files，也排出装机包）
docs/                 在线可预览文档站（同上）
scripts/smoke-core.mjs  零依赖层的裸 Node 守卫（23 项）
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
npm test        # vitest，320 例（core 的纯函数 + 参数归一化 + 逐点比对 + 三个渲染器描述符）
npm run smoke   # 裸 Node 跑一遍 core，28 项
cd example && npm i && npm run dev
cd docs && npm i && npm run dev      # 文档站
cd docs && npm run check             # 逐页 SSR 渲染，10 页
```

在仓库根上也有：`npm run sdk:frontend-test` / `npm run sdk:frontend-smoke` /
`npm run sdk:frontend-docs`。

`docs` 的 `npm run check` 值得单说：`npm run build` 只证明**能打出包**，而页面里那些
`listRenderers()` / `deriveGrid()` / `validateRendererDescriptor()` 是**渲染时**才执行
的 —— 改一个 `core` 常量把某张表读崩了，build 照样绿。它走 Vite 的 SSR 通道逐页
`renderToStaticMarkup`。**但它只替代「逐页点过」的一半**：证明页面不崩、表格能渲染，
证明不了 WebGL 真的画出了东西，那部分仍然要在浏览器里看。

改包内文件时 `example` 的 dev server 会热更新 —— linked 依赖默认不做预构建，源码直接
过转换管线。

---

## 边界

- **`private: true`，不发公共 registry。** 分发走 `npm pack` tarball 或 `file:`。想真
  发布是另一件事（要定 scope 归属与版本承诺）。
- **tarball 里根出口加载不了**，见上面「已知缺口」。渲染器那条路不受影响。
- **ships 三个渲染器：`numMatrix` + `pointGrid` + `handPoints`。** `pointGrid`
  2026-08-05 第二轮搬入；`handPoints` 2026-08-07 第三轮批 3 搬入（原
  `client/src/components/three/hand0205Point.jsx` 993 行 + `...147.jsx` 1037 行，
  **两份合成一个渲染器三条预设** —— 归一化空白与注释后净差 151 行，差的全是参数与
  两张写死的点表。两个原文件已删，原路径没留壳：唯一的 importer 是 `Home.jsx`）。
- **`BACKENDS = ['sprite3d', 'canvas2d', 'webgl']`，三个后端全部到位。**
  `canvas2d` 2026-08-06 第三轮批 1 搬入（原 `client/src/components/num/NumWs.jsx`，
  导出名 `Num3D`，其实是 2D canvas + CSS 透视，不是 WebGL）；`webgl` 同轮批 2 搬入
  （原 `num/Num2D.jsx` 860 行 + `num/Num2Doriginal.jsx` 1203 行，**两份合成一个后端**
  —— 逐行比对后确认 `Num2Doriginal ⊃ Num2D`，多出来的是掩码 / POT 纹理 / 零值显白 /
  分区布局 / 裸数据转置，全部做成了 `params.webgl.*` 开关，两个原文件已删）。
  三个后端的**命令式暴露面不一样**：`sprite3d` 4 个方法，`canvas2d` 14 个，
  `webgl` 8 个 —— 差额由描述符的 `optionalMethods` 声明，见下面「公开面」一节。
- **`webgl` 后端只画 jet，不认 `colormap`。** 两份原实现的片元着色器都把 jet 阶梯写死
  在 GLSL 里，所以在这个后端上换配色画面不动。搬的时候保留了这个行为（改它是看得见的
  画面变化，不是搬家该做的事），但那段 GLSL 现在是从 `core/jetLadder.js` 的断点数据
  **发码**出来的，不是第 19 份手抄 —— 要支持任意配色，改 `core/numMatrix/shaders.js`
  一处即可。已记积压。
- **`sprite3d` / `pointGrid` / `handPoints` 三个渲染器按视口而不是按容器定尺寸**
  （`numMatrix/backends/sprite3d.js:247`、`pointGrid/PointGridRenderer.jsx:319`）。
  主应用里每个展示形式独占整屏，所以这个区别从没暴露过；想把画面嵌进一个小卡片，
  只能用视口尺寸的容器 + CSS `transform: scale()` 绕（文档站就是这么干的），代价是
  `three/pointPick.js` 读的是 `window.innerWidth/Height` —— **缩放态下框选会选错点**。
  新搬的 `canvas2d` / `webgl` 两个后端也照抄了这个行为（`backends/webgl.js` 的
  `bounds()` 是改它时唯一要动的地方，注释已写明）。新写渲染器请按容器画。已记积压。
- **三个渲染器的 dispose 都没有 `forceContextLoss()`。** `renderer.dispose()` 不保证
  立即归还 WebGL 上下文（浏览器同时活的上限约 8–16），同页多块时可能累积到
  "Too many active WebGL contexts"。文档站用 `IntersectionObserver` 懒挂载 + 活跃数上限
  4 绕开而没有改包内代码 —— 加这一行要配一整轮真机回归。已记积压。
- **渲染器是构建期解析的。** `load: () => import()` 由打包器静态分析，所以**装机之后
  加不了新渲染器**。二开的两条路里，本包解决的是「新项目消费」，不是「装机后插件化」。
- **主应用的迁移用 re-export 壳做的**：`client/src` 里搬走的模块原路径都留了一行
  `export * from '@shroom/frontend/...'`，所以主应用的 import 一行没改。改包内文件会
  同时影响主应用，别当成两份代码。
