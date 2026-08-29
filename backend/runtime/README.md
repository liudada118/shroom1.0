# Electron 固定后端桥

> 最后更新：2026-08-29

Electron 主进程只认这一个入口来启停后端、下发命令和取运行状态。目录里的实现可以随便重构，但**这个文件的路径和导出的 7 个名字不能动**。

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `index.js` | 桥本体。持有一个 `CommandRouter`；把 `serial`、`license-check`、`export-csv`、`db-query`、`ws-send` 五类命令注册成转发到旧 server 的 handler；导出 `openServer` / `shutdownServer` / `handleCommand` / `getWsServer` / `broadcastRealtime` / `getRuntimeStatus` / `commandRouter` | 不实现业务。每个函数都是"取旧 server → 检查方法存在 → 调用"，方法不存在时打 warn 并返回安全值（`null` / `0` / `Promise.resolve()`），不抛错崩主进程 |

## 两个关键设计

**旧 server 是懒加载的。** `getLegacyServer()` 只在真正调用时才 `require('../kernel/platform/server')`。这不是性能优化——早期版本在模块顶层 require，形成 `server → runtime → server` 的隐式循环，初始化阶段会拿到半成品导出。想在这里加新依赖前先确认不会重新引入这个环。

**降级而不是崩溃。** `broadcastRealtime` 在 `publishRealtimeFrame` 缺失时返回 `0`（发出去 0 个客户端），`getWsServer` 返回 `null`，`getRuntimeStatus` 里每个字段都单独判存在。原因是这层跑在 Electron 主进程里，抛错的代价是整个应用起不来，而它转发的东西没有一个是启动必需的。

`getRuntimeStatus()` 汇总的是：各通道客户端数、通道列表（过滤掉 `standard === true` 的标准通道）、ChannelBus 状态、WebSocket 订阅状态。

## 改动约束

- 路径 `backend/runtime/index.js` 和 7 个导出名是对 Electron 的契约，不因内部重构改变。
- 仓库根目录还有一个 `runtime/`，那是被 gitignore 的运行产物，和这里没有任何关系，别混用。
