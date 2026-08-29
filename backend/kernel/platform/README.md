# 平台层：启动编排与路径配置

> 最后更新：2026-08-29

`platform/` 是后端的装配层。子目录各管一件事（启动、命令、HTTP、WebSocket、授权、运行态），本目录这两个文件把它们串起来。

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `server.js` | 后端启动编排入口，1829 行。创建 HTTP / WebSocket 服务和运行时上下文；装配串口、传感器 runtime、Display Systems 和实时输出管线；保留 legacy 前端和旧 WebSocket 命令的兼容桥接。只导出一个 `openServer`（= `attachWebSocketHandlers`） | 应该只做装配和状态回写。业务逻辑要下沉到 `commands/`、`serial/`、`realtime/`、`playback/` 或 `extension-host/`——文件头的注释就是这么写的，但目前还有 50 多个顶层函数没搬完，见下面「现状」 |
| `serverPathConfig.js` | 计算后端运行期资源路径，确保可写目录存在。导出 `PROJECT_ROOT` 和 `createServerPathConfig` | 复用 `license/licenseHelper` 的配置文件路径解析，不自己实现一套 |

## server.js 装配了什么

按执行顺序，大约 30 个 factory 调用：

| 阶段 | 装配的东西 |
| --- | --- |
| 路径与配置 | `createServerPathConfig`、`createJqbedAlgorithmConfigStore`、`createAppRuntime` |
| 状态容器 | `createZeroStateStore`、`createRuntimeStateStore`（回放态、采集态各一个）、`createServerRuntimeStateStore` |
| 采集链路 | `createCollectionDiskSpaceGuard`、`createCollectionInsertQueueService`、`createCollectionStorageClock` |
| 回放链路 | `createHistoryFrameTransformService`、`createPlaybackFrameService`、`createPlaybackTimerService` |
| 串口 | `createSerialRuntime`、`createSerialPortOrchestrator`、`createSerialPortFilterService` |
| 传输 | `createWebSocketRuntime`、`createWebSocketHandlerContext`、`createWebSocketHandlerAttacher`、`createHttpApp` |
| 命令 | `createControlCommandRouter`、`createControlCommandService`、`createZeroCommandService`、`createRuntimeStatePatchers` |
| 算法 | `createJqbedAlgorithmProtocol`、`createPetCareRuntimeService` |
| 传感器 | `createServerSensorProcessors`、`createServerSmallBedRuntime`、`createServerHandRuntime`、`createServerFramePipeline` |
| 导出与维护 | `createCsvDownloadService`、`createHistoryMaintenanceService` |
| 关停 | `createServerShutdownOrchestrator`（懒加载，见 `getShutdownOrchestrator`） |

## 现状：还没搬完

文件头写着「业务处理逻辑应优先下沉」，但目前 `server.js` 里还留着 50 多个顶层函数，其中确实属于业务的至少这几类：

- **敏枕文本传感器**：`handleMinzhenSensorPortData`、`openMinzhenSensorPort`、`closeMinzhenSensorPort`、`bindBackPortParser`
- **整椅帧归一化**：`normalizeWholeChairFrame`
- **采集落盘判定**：`shouldStoreCollectionFrame`、`hasEnoughCollectionDiskSpace`、`handleCollectionDbError`、`stopCollectionForStorageError`
- **回放**：`loadSelectedHistory`、`publishPlaybackFrame`、`buildZeroPlaybackPayload`、`calcDetectedInterval`
- **授权**：`getStoredLicenseKey`、`activateSubmittedLicenseKey`、`getSelectFlagFromLicense`、`getDefaultFileFromLicense`
- **三路实时帧入口**：`colOrSendData`、`colOrSendData1`、`colOrSendData2`（:1676、:1682、:1692）—— 分别是坐面 / 靠背 / 头枕，遗留命名。`realtime/realtimeFrameDispatchService.js` 已经把这三个名字收敛到 `frameOutputPipeline` 上了，这里的三份属于没搬完的部分

动它们之前先确认调用链，这个文件是所有实时数据的汇聚点。

## 一处确认过的重复代码

`getSelectFlagFromLicense`（:835）和 `getDefaultFileFromLicense`（:848）在 `license/licenseValidationService.js` 里各有一份**逐字符相同**的实现，而且那个模块已经被 `server.js:154` require 了（取的是 `validateLicenseKey`）。

也就是说删掉这两个本地定义、改成从 require 里一起取出来，是零行为变化的改动。

之所以现在还留着：这两个函数决定前端能选哪些传感器类型（`selectFlag`），属于授权判定链路，按项目约定要人工确认后才动。

## 边界

- `openServer` 是对 `backend/runtime/index.js` 的契约，不能改名或改签名。
- 授权相关函数属高风险改动，即便是上面这种零行为变化的去重，也要人工确认。
