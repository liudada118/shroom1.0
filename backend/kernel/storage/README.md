# 应用侧数据库装配

> 最后更新：2026-08-29

只负责"把 SQLite 连接建起来、按传感器类型建对表"。查询、分页、维护在 `history/` 子目录；通用存储能力在 `@shroom/backend/storage/`。

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `dbManager.js` | 数据库初始化与连接管理。`initDb(fileStr, filePath, runtimeResourceRoot)` 按传感器类型创建/打开库文件，`genDb` 建表。从旧 `server.js` 里抽出来的 | 依赖 `legacyDataUtils.isCar` 判断是否需要多通道表结构。`electron` 是 try/catch 里可选 require 的——脱离 Electron 也能跑（测试用） |
| `sqlite3-compat.js` | 用 `better-sqlite3` 顶替 `sqlite3` 的最小兼容层，只实现 `server.js` 实际用到的那部分：`Database` / `run` / `all` / `get` / `close` / `serialize`，以及 `verbose()` 返回自身 | 故意不做全量兼容。回调风格转同步调用，`run` 的 `this.changes` / `this.lastID` 语义要保持——历史代码依赖它们 |

## 为什么有 sqlite3-compat

`sqlite3` 是需要编译的原生模块，跨 Electron 版本重编译很折腾；`better-sqlite3` 更稳，但 API 是同步的，而历史代码全是回调风格。两条路：改几百处调用点，或者写一层 109 行的壳。选了后者。

代价是这层的行为必须和真 `sqlite3` 一致，尤其是错误对象的形状和 `this` 上的 `changes` / `lastID`。改这个文件前先想清楚哪些历史调用点依赖这些细节。

## 边界

- 数据库表结构和磁盘格式属于高风险改动（历史数据兼容性）。改 `genDb` 的建表语句前必须确认真实历史库能读。
- 新代码需要通用存储能力时走 `@shroom/backend/storage/`，不要往这里加。
