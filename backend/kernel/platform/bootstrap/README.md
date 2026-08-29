# 启动与关停

> 最后更新：2026-08-29

进程的两头：起来时要做的一次性副作用，退出时要按顺序释放的资源。中间的运行期不在这里。

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `bootstrapServer.js` | 启动期副作用。`scanStartupSerialPorts` 扫一次串口候选、过滤、写入运行时状态、打日志；`startLocalHttpServer` 起本地 HTTP（默认 `127.0.0.1:19245`）。导出这两个函数和两个默认常量 | 只做启动那一次。串口生命周期仍归 `serialManager`，这里扫完就不管了 |
| `serverLifecycleService.js` | 关闭单个资源的辅助函数：`closeSerialPort`、`closeHttpServer`、`closeWsServer`，以及给它们套超时保护的 `closeWithTimeout`（默认 3000ms） | 超时或异常时返回 `false` 而不是抛错。**注意：本文件的中文注释是乱码**，见下面「已知问题」 |
| `serverShutdownOrchestrator.js` | 关停编排。`createServerShutdownOrchestrator` 按顺序调用上面那些关闭函数；`clearManagedInterval` 清定时器并统一返回 `null`（方便调用方重置引用）；`closeDatabase` 关库 | 不决定什么时候关，只决定关的顺序和失败怎么处理 |
| `systemTimeSyncService.js` | 一次性从远端拉系统时间并回写运行态。导出 `syncSystemTime` 和 `DEFAULT_SYSTEM_TIME_URL` | 拉一次就完，不带重试、不带定时。返回 `ClientRequest` 对象让上层能取消。**目前是死代码**，见下面 |

## 为什么关闭要加超时

`closeWithTimeout` 不是防御性编程，是踩过的坑：应用退出或自动更新安装前，如果某个资源（最常见是串口）的关闭 Promise 永远不 resolve，整个退出流程就永久阻塞——用户看到的是"点了关闭没反应"，或者更糟，自动更新装不上。

所以每个关闭动作都有 3 秒上限，超了就当它关了继续往下走。宁可泄漏一个句柄，也不能卡住退出。

## 已知问题（两个，都没动）

**1. `serverLifecycleService.js` 的注释是乱码。**

文件头是 `鏈嶅姟鐢熷懡鍛ㄦ湡杈呭姪鍑芥暟` 这种形态——GBK 编码的中文被当成 UTF-8 存了一遍，而且文件开头还多了个 BOM。原文应该是「服务生命周期辅助函数」。

代码本身没问题（乱码只在注释和字符串字面量之外的注释里），但这个文件现在没法读。修它需要用正确编码重存一遍，属于单独的改动。

**2. `systemTimeSyncService.js` 整个是死代码。**

`syncSystemTime` 在 `server.js:32` 被 require 了，但全仓库搜不到任何调用点——只有 require 那一行。所以这个服务现在一次都不会执行。

而且它的 `DEFAULT_SYSTEM_TIME_URL` 指向 `http://sensor.bodyta.com:8080/...`：明文 HTTP，用的是旧域名，而 `configManager.js` 的 `keyServer` 注释明确写着「替代旧的 sensor.bodyta.com 调用」。校时现在走的是 `keyServer.SERVER_TIME_PATH`（`https://shroom.jq-industries.com/serverTime`）。

两件事一起看，结论是这个文件加上 `server.js:32` 那行 require 可以一起删。但删之前要确认没有别的分支或未提交代码在用它。

## 边界

- 关停顺序有意义（串口 → HTTP → WebSocket → 数据库），改顺序前要想清楚谁还在往谁写数据。
- 启动扫串口的结果只是候选列表，不代表连上了。别把它当成"设备在线"的判据。
