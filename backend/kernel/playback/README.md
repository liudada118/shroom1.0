# 历史回放

> 最后更新：2026-08-29

把数据库里的历史帧变回前端能画的画面。分工按「谁只做一件事」切：

```
playbackTimerService   何时推下一帧（只管定时器）
historyFrameTransformService  一行 DB 记录 → 规范化的帧（只管格式）
playbackFrameService   规范化的帧 → 前端 payload（只管组包）
historyPlaybackService 多路同步长度、趋势抽样、空白帧
historyAnalysisService 框选统计、跳帧、历史曲线（旧 WS 遗留逻辑）
```

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `playbackTimerService.js` | 回放定时器，66 行。`createPlaybackTimerService({getInterval, onTick, onStop})` | **不关心帧内容、数据库和 WebSocket**。周期由 `getInterval` 每次现取，所以变速回放不用重建定时器。`clearTimer` 只清句柄不改播放状态——两者分开是故意的 |
| `historyFrameTransformService.js` | 格式转换主体，544 行。解析 matrix 行、压力帧归一化、CSV 表头和文件名前缀、回放 payload、带清零信息的采集存储 payload | 依赖全注入（各传感器类型常量、`isHandGloveType`、`smallBed12B`……）。这是「同一份历史数据要同时喂给回放、CSV 导出和趋势图」的汇聚点，所以格式统一收在这里 |
| `playbackFrameService.js` | 组 payload，285 行。DB 历史行 → 前端 WebSocket payload | 明确**不**负责定时器、WebSocket 发送、数据库查询和播放状态。足部（`footL`/`footR`/`footVideo`）和手套（`handGloveFullPacket`）的特殊结构在这里处理 |
| `historyPlaybackService.js` | 三件小事，157 行。`getHistoryLengthFromCounts` 取多路同步长度、`getHistorySeries` 给趋势图抽样（上限 **2000** 点）、`buildZeroPlaybackFrame` / `buildZeroPlaybackPayload` 构造空白帧 | 抽样上限是画图上限不是数据上限。一天几十万帧全画出来图是黑的，浏览器也卡 |
| `historyAnalysisService.js` | 旧主 WebSocket 里还没搬走的历史逻辑，187 行：历史差值、回放跳帧、坐面/靠背框选统计、历史曲线统计 | 文件头写明「连接层只负责解析消息」。这里是过渡产物，长期应该拆进上面几个 |

## 多路同步取最短

`getHistoryLengthFromCounts(...counts)` 取所有正数通道里的**最小值**。

三口设备（坐面 / 靠背 / 头枕）三个通道的历史条数经常不一样——串口断了一路、某一路启动晚了、采集中途换过传感器。按最长播就会有通道越界，按各自长度播就会越播越不同步。取最短是唯一不会出错的选择，代价是尾部数据看不到。

零和负数被过滤掉，所以「某一路完全没数据」不会把整段历史的长度拉成 0。

## 切历史要先推空白帧

`buildZeroPlaybackPayload` 存在的原因和 `serial/createZeroPayloads` 一样：不推的话前端画面停在上一段历史的最后一帧，用户看到的是有数据的画面，但那是错的数据。

这是项目里反复出现的那类问题——没有报错，只是显示的东西不对。

## 边界

- 帧格式（点序、矩阵尺寸、字段名）改动直接影响历史数据兼容性：旧库里的记录是按旧格式存的。必须人工确认。
- 回放不写库。任何往 `matrix` 表写的动作都不属于这个目录。
- `historyAnalysisService` 是待拆解的遗留代码，新逻辑不要往里加。
