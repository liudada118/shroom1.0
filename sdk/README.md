# Shroom SDK

这个目录下有**两个可安装的包**，管的是二开的两侧：

| | [`sdk/backend/`](backend/README.md) | [`sdk/frontend/`](frontend/README.md) |
| :--- | :--- | :--- |
| 包名 | `@shroom/backend` | `@shroom/frontend` |
| 管什么 | **拿到数据**：串口、协议解码、线序、采集入库、CSV 导出；也能连一个已跑起来的后端 | **画画面**：渲染器、帧管线、配色、阈值 |
| 跑在哪 | Node（Electron 主进程侧） | 浏览器（`/core` 也可裸 Node） |
| 模块格式 | CommonJS | ESM |
| 最短路径 | `npm run sdk:quickstart -- --mock` | `cd sdk/frontend/example && npm i && npm run dev` |
| 文档 | [`backend/README.md`](backend/README.md) | `npm run sdk:frontend-docs` → **在线可预览文档站**，10 页 |

两个都是 `private: true`，不发公共 registry；分发走 `file:` 依赖或 `npm pack` tarball。
主仓自己就是第一个消费者（根 `package.json` 装 `@shroom/backend`，`client/package.json`
装 `@shroom/frontend`），所以包里的代码和主应用跑的是**同一份**，不是副本。

```bash
npm run sdk:quickstart -- --mock    # 后端：串口→采集→导出 CSV，没硬件也能跑完
npm run sdk:frontend-docs           # 前端：文档站，讲解 + 活预览 + 「显示代码」
```

---

## 该用哪个包、哪一层

**只想把数据读出来存下来** → `@shroom/backend/session`，一条链已经装好了。

**只想用算法**（线序、压力换算、协议校验）→ `@shroom/backend/processing` +
`@shroom/backend/protocol`，**零依赖**，什么 peer 都不用装。

**主应用已经在跑，只想连上去** → `@shroom/backend/client`。这是对外集成的**推荐边界**：
只依赖 HTTP 控制 API、WebSocket 实时订阅和标准 telemetry 数据模型，不碰
`server.js`、串口 parser、legacy runtime、采集内部状态，所以主仓重构不会波及你。
契约入口是 `GET /api/sdk/contract`。

**要画画面** → `@shroom/frontend/react`，三行出画面。

后端包的十二个入口、依赖分层、已知妥协，全在 [`backend/README.md`](backend/README.md)。

---

## 前端包 `@shroom/frontend`（速览）

```bash
cd frontend/example && npm i && npm run dev     # → 32×32 数字矩阵，游动的高斯斑
```

四个入口，按「有没有 React / three / DOM」分层 —— 这条线同时决定谁能消费和能不能在裸 Node
里加载：

| 入口 | 内容 | 依赖 |
| :--- | :--- | :--- |
| `@shroom/frontend` | 传输（`SensorClient`）、帧存储（`FrameStore`）、展示系统定义（`DisplayRegistry`），并全量转出 `core` | 无 |
| `@shroom/frontend/core` | 契约、渲染器注册表、帧管线、配色、阈值、坐标布局 | 无 |
| `@shroom/frontend/react` | `RendererHost`、`useSceneFrame`、`registerBuiltinRenderers`、`numMatrix` + `pointGrid` | peer: react ≥18 + three **≥0.127** |
| `@shroom/frontend/styles/canvas.css` | 6 行 | 无 |

根出口**刻意不含 `react/`**：一旦含了，`SensorClient` 的裸 Node 消费者（本仓
`backend/tests/sdk/` 里就有一个）连 import 都做不到。

**`three` 的 peer 范围必须宽到 `>=0.127`** —— 主应用 pin 的是 `^0.127.0`（2021 年的版本），
写 `^0.170` 会让主应用装不上。

三行就能出画面：

```jsx
import { RendererHost, registerBuiltinRenderers } from '@shroom/frontend/react';
import '@shroom/frontend/styles/canvas.css';

registerBuiltinRenderers();
<RendererHost rendererId="numMatrix" params={params} values={frame} channel="sit" />
```

**想看到画面的，先开文档站**：

```bash
npm run sdk:frontend-docs     # 在仓库根上跑，10 页：讲解 + 活预览 + 「显示代码」
```

它比 README 多的不是篇幅，是**不会过期**：契约表、7 条配色、8 条预设、8 条帧通道全部从
`core` **直接 import 渲染**，每段代码样例用 Vite 的 `?raw` 显示**正在上面那块画面里跑的
那个文件本身**。README 里的表格是手抄的 —— `RENDERER_METHODS` 改一行，README 不会有任何报错。
文档站会跟着变。

其中「写自己的渲染器」那一页是重点：一个约 140 行的 Canvas 2D 渲染器，不属于包，走完整条正式
路径（`forwardRef` → `registerRenderer` → `validateRendererDescriptor` → `RendererHost`），
源码就在页面里。「坑」那一页是踩过的账。

> **⚠️ 前端包已知缺口：根出口在 `npm pack` 装出来的包里加载不了。**
> `frontend/src/client/commands.js` 有一条
> `import ... from '../../../../shared/commandSchema.json'` —— 四级向上跑出了包根。仓库里
> （`file:` / `npm link`）它解析到 `<repo>/shared/`，所以主应用和 demo 都正常；tarball 装出来
> 之后四级向上是 `node_modules/`，于是整个根 barrel 在 import 时就抛。**`/core` 与 `/react`
> （也就是画画面那条路）不受影响。** 后端包用「包内自带一份 + 漂移测试」绕开了同一个坑，
> 见 [`backend/README.md`](backend/README.md) 的「已知妥协」；两边最终要统一
> `shared/commandSchema.json` 的归属。

---

## 在仓库根上跑它们的检查

```bash
npm test                      # 后端全量测试，39 个文件（含两个包边界不变量）
npm run sdk:backend-smoke     # 后端包边界守卫，10 项
npm run sdk:frontend-test     # vitest 144 例
npm run sdk:frontend-smoke    # 裸 Node 跑一遍前端 core，18 项
npm run sdk:quickstart -- --mock
npm run sdk:serial-demo -- --mock
npm run sdk:demo              # 需要后端在跑；只读
```

两个 smoke 都不是补充测试，是**包边界的守卫** —— 无打包器、无垫片、无测试框架，
专抓「在主仓里跑得好，装到新项目里就崩」那一类错。
