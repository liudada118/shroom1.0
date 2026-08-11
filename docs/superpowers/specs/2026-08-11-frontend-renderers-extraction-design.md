# 前端 SDK 渲染器目录抽离设计

日期：2026-08-11

## 目标

把 `sdk/frontend/core/` 与 `sdk/frontend/react/` 中分散的渲染器专属文件迁入
`sdk/frontend/renderers/`，让一个渲染器的参数、纯算法、React 实现、后端和测试可以在
同一目录中找到。

本次只调整目录归属、公开出口和内部 import，不修改渲染结果、参数默认值、命令式方法、
帧数据格式或懒加载行为。

## 渲染模式与实现族

用户界面的六种概念模式映射到五个现有实现族：

| 用户模式 | 实现族 | 说明 |
| :--- | :--- | :--- |
| 2D 数字 | `numMatrix` | 使用 `canvas2d` 或 `webgl` backend |
| 3D 数字 | `numMatrix` | 使用 `sprite3d` backend，不复制第二套参数和管线 |
| 3D 点图 | `pointGrid` | 坐标决定 X/Z，数值决定高度和颜色 |
| 模型类点位展示 | `handPoints` | 当前实现是手模加点云，不声明为已经完成的 UV 贴肤热力图 |
| 热力图 Canvas | `blobHeatmap` | Canvas 2D 斑点融合实现 |
| 热力图 WebGL | `webglHeatmap` | WebGL 两遍着色实现 |

真正的“模型 UV 热力图贴肤”不在当前前端 SDK 中，本次不新增渲染算法。未来新增时作为
独立 `modelHeatmap` 实现族接入，不塞进 `handPoints`。

## 目标目录

```text
sdk/frontend/
├─ core/                         # 渲染器无关的零依赖基础设施
│  ├─ contract.js
│  ├─ registry.js
│  ├─ frameBus.js
│  ├─ sceneFrame.js
│  ├─ frameMath.js
│  └─ ...共享配色、阈值和矩阵工具
├─ react/                        # 渲染器无关的 React 宿主
│  ├─ RendererHost.jsx
│  ├─ useSceneFrame.js
│  └─ index.js
├─ renderers/
│  ├─ builtins.js                # 五个内置渲染器的动态注册入口
│  ├─ index.js                   # 渲染器目录公开入口
│  ├─ shared/
│  │  ├─ three/                  # SelectionHelper、pointPick、circle.png
│  │  └─ webgl/                  # glUtil
│  ├─ numMatrix/
│  │  ├─ core/                   # params、pipeline、layouts、robotLayouts、shaders
│  │  └─ react/                  # NumMatrixRenderer 与三个 backend
│  ├─ pointGrid/
│  │  ├─ core/                   # params、pipeline
│  │  └─ react/                  # PointGridRenderer
│  ├─ handPoints/
│  │  ├─ core/                   # params、pipeline、layout、quaternion
│  │  └─ react/                  # HandPointsRenderer
│  ├─ webglHeatmap/
│  │  ├─ core/                   # params、pipeline、shaders
│  │  └─ react/                  # WebglHeatmapRenderer、blobs
│  └─ blobHeatmap/
│     ├─ core/                   # params、pipeline、intensity
│     └─ react/                  # BlobHeatmapRenderer
├─ docs/
└─ example/
```

测试继续与所属实现放在一起，例如
`renderers/pointGrid/core/pipeline.test.js`，而渲染器注册和宿主契约测试继续留在基础设施层。

## 公开 API 与兼容性

新增以下推荐入口：

```js
import { registerBuiltinRenderers } from '@shroom/frontend/renderers';
import * as numMatrix from '@shroom/frontend/renderers/numMatrix/core';
```

现有入口保持可用：

```js
import { NUM_MATRIX_PRESETS } from '@shroom/frontend/core';
import * as numMatrix from '@shroom/frontend/core/numMatrix';
import { registerBuiltinRenderers } from '@shroom/frontend/react';
import WebglCanvas from '@shroom/frontend/react/numMatrix/backends/webgl.js';
```

兼容路径由 `package.json.exports` 直接映射到 `renderers/` 中的新实体文件，不在旧目录保留
大量代理文件。`core/index.js` 和 `react/index.js` 继续提供原顶层别名，但实现 import 改为指向
新目录。

## 依赖规则

1. `core/` 不依赖 React、Three.js、DOM 或任一渲染器 React 实现。
2. `renderers/*/core` 只能依赖共享 `core/` 和同实现族的纯模块。
3. `renderers/*/react` 可以依赖 React、Three.js、共享渲染工具和同实现族的 `core`。
4. `react/RendererHost.jsx` 只依赖契约、注册表和帧总线，不静态 import 具体渲染器。
5. `renderers/builtins.js` 保留静态可分析的 `load: () => import(...)`，确保五个实现继续拆成独立 chunk。
6. 文档 demo 和主应用继续通过公开包入口使用 SDK，不引用 `sdk/frontend/renderers` 的磁盘相对路径。

## 迁移步骤

1. 先增加结构测试，要求新公开路径存在、旧公开路径仍能解析，并验证渲染器只能从
   `renderers/builtins.js` 动态加载。
2. 逐个迁移纯 `core` 文件和测试，修正相对 import，保持每次迁移后测试可运行。
3. 逐个迁移 React 渲染器、后端和共享 Three/WebGL 工具。
4. 迁移 `builtins.js`，更新 `core/index.js`、`react/index.js` 与 `package.json.exports`。
5. 更新文档、example 和客户端兼容引用；删除空的旧渲染器目录。
6. 更新 `README.md` 与根 `ARCHITECTURE.md`。

## 错误处理与回退

- 未知 renderer id 的行为保持为注册表返回 `null`，不改变现有回退策略。
- 动态 import 失败仍由 `RendererHost` 的现有错误状态处理，不新增静默降级。
- 旧子路径若未映射到新文件，结构测试必须失败，不能靠运行到某个页面后才发现。
- 迁移过程中不删除客户端现有兼容壳；本次只整理 SDK 内部目录。

## 验证标准

- 新增结构测试先失败，再迁移实现使其通过。
- SDK Vitest 全量通过。
- `pnpm smoke` 的裸 Node core 检查通过。
- 文档生产构建与全部路由渲染检查通过。
- frontend example 构建通过。
- client 渲染器注册测试和生产构建通过。
- 构建产物中五个渲染器仍是独立懒加载 chunk，没有被 `react/index.js` 静态合并。
- `rg --files sdk/frontend/core sdk/frontend/react` 不再出现五个渲染器的实现目录。

## 不在本次范围

- 不新增真正的模型 UV 热力图贴肤算法。
- 不改变六种展示模式在配置页面上的名称和选择逻辑。
- 不拆成第二个 npm 包，不调整版本发布方式。
- 不重写渲染算法，不处理 WebGL 上下文释放等既有技术债。
- 不删除 `client/src` 中仍用于兼容旧 import 的壳文件。
