# 后端公共壳层

> 最后更新：2026-08-29

这个目录只放 Electron 主进程固定依赖的兼容壳，不放任何业务实现。真实实现全部在 `sdk/backend/`。

存在的唯一理由是**路径稳定**：Electron 侧代码写死了 `require('../common/logger')` 这类相对路径，SDK 内部怎么重构都不该逼着上层跟着改。

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `logger.js` | 一行转发到 `@shroom/backend/logger.js`。带时间戳和级别的统一日志，`LOG_LEVEL` / `LOG_FILE` 两个环境变量的行为和搬迁前完全一致 | 不加逻辑、不做包装。新代码直接写 `require('@shroom/backend/logger.js')`，不要再从这里取 |

## 改动约束

- 这个文件的**路径和导出形状不能变**。它是 Electron 的固定入口之一（另一个是 `backend/runtime/index.js`），改了就要同步改主进程，属于超出目录整理范围的动作。
- 想扩展日志能力，改 `sdk/backend/logger.js`，不要在这里叠一层。
