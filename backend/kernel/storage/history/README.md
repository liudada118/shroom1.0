# 历史数据查询与会话

> 最后更新：2026-08-29

`matrix` 表的所有读写都收在这三个文件里。存在的直接原因是：旧代码在 WebSocket handler 里直接拼 SQL 字符串，既不安全也没法测。

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `historyQueryService.js` | 查询主体。索引保障（`ensureHistoryIndexes`）、prepared statement 缓存、日期列表（`queryHistoryDates`）、分页取行（`queryHistoryRows` / `queryHistoryRowsFromId`）、统计（`getHistoryStats`）、时间戳采样，以及大数据懒加载代理（`createLazyHistoryRows`） | 只读。全部走参数化查询，不拼字符串。statement 缓存挂在 `WeakMap` 上，按数据库句柄索引——库关掉就自动回收 |
| `historySessionService.js` | 回放会话编排。承接历史日期列表、历史数据加载、趋势曲线，以及切历史时要推给前端的空白帧 payload | 纯依赖注入：数据库、运行态 getter/setter、推送能力全部由 `server.js` 传入，自己不 require 任何一样 |
| `historyMaintenanceService.js` | 按 `date` 删除历史记录，仅此一项 | 参数化 `DELETE FROM matrix WHERE date = ?`。`dbRef` 或 `dateLabel` 为空时 resolve `false` 而不是抛错——静默跳过比误删安全 |

## 三个值得知道的细节

**`getNativeDb` 存在是因为有两层包装。** 上层拿到的可能是 `sqlite3-compat` 的包装对象，也可能是原生连接。这个函数试 `_db` 再试 `db`，都没有就返回 `null`。加新查询时用它，不要假设传进来的是哪一种。

**懒加载代理不是优化，是必需的。** `createLazyHistoryRows` 返回的是个代理对象，只在真正访问某一行时才去查库。一天的历史帧可以有几十万条，全量读进内存会直接把 Electron 渲染进程拖死。

**`historySessionService` 一个 require 都没有。** 所有依赖（`getDatabases`、`getPlaybackState`、`isCar`、`dedupli`、`formatMatrixTotalForFile`……）都从参数进来。这是刻意的：它是回放链路最复杂的一环，不注入就没法在没有真实数据库的情况下测。

## 边界

- 删除历史数据属于高风险操作。`historyMaintenanceService` 只按日期删，不提供按范围或条件批删的接口——需要的话必须人工评审。
- 表结构和字段语义不在这里定义，见 `../dbManager.js`。改字段会同时影响这三个文件和回放、CSV 导出。
