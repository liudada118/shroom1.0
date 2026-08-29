# 应用侧串口控制与编排

> 最后更新：2026-08-29

物理串口的生命周期由 `@shroom/backend/serial/serialManager.js` 管，这里只管**应用怎么用它**：业务角色映射到哪个口、哪个波特率、收到数据交给谁、前端发来的串口命令怎么处理。

分层是：`serialRuntimeFactory`（装配）→ `serialPortOrchestrator`（角色映射）→ `serialControlService`（命令入口）。

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `serialRuntimeFactory.js` | 装配层。建 parser manager、serial manager 和串口端口状态；`server.js` 只注入两个帧分隔符（普通帧、小床 12B）和 logger | 两个 factory 都可替换（`parserManagerFactory` / `serialManagerFactory` 默认参数），所以能用假串口测。不含任何业务判断 |
| `serialPortOrchestrator.js` | 角色映射层。把业务角色（sit / back / head / sensor）映射到 parser channel、波特率、自动重连策略和特殊数据 handler。敏枕文本传感器和小床 12B 的特殊分帧走这里 | 不碰物理串口的开关。配置来自 manifest（`getSerialConfig`），不维护固定的端口表 |
| `serialControlService.js` | 命令入口。向 `CommandRouter` 注册 7 个 handler，见下表 | 每个 handler 都是 `{ name, when, handle }` 三元组——`when` 判断消息形状，不靠命令字符串匹配。写操作前先调 `requireAuthorizedRuntime()` |

## 注册的 7 个命令

| handler | 触发条件 | 干什么 |
| --- | --- | --- |
| `history-load-date` | `message.getTime != null` | 切到指定日期的历史 |
| `sensor-file-switch` | `message.file != null` | 换传感器类型（换库、换表结构、换通道） |
| `serial-port-control` | `sitPort` / `headPort` / `sensorPort` 等任一存在 | 开关指定角色的串口 |
| `local-playback-switch` | `message.local === true/false` | 实时 / 本地回放切换 |
| `exchange-sit-back-ports` | `message.exchange != null` | 坐垫和靠背两个口对调 |
| `serial-port-list-refresh` | `message.serialReset != null` | 重新枚举串口 |
| `auto-connect-hand-glove-double` | `autoConnectHand0205Double === true` | 双手套自动连接 |

其中 `sensor-file-switch`、`local-playback-switch`、`exchange-sit-back-ports` 都会先过授权检查。

## 回到实时模式要推空白帧

`createZeroPayloads` 构造的是一组全 0 数组，长度按传感器类型算（`bigBed` 固定 2048，其余用 `sitTotal`；`isCar` 为真时追加 `backData`，三口设备再追加 100 长度的 `headData`）。

不推的话，旧前端页面会残留上一帧历史数据——画面停在那儿不动，看起来像是实时数据卡住了。这又是一个静默失败：没有报错，只是显示的东西是错的。

## 边界

- 帧分隔符字节、波特率、点序属于硬件协议范畴，改动影响历史数据兼容性，必须人工确认。
- 串口底层（打开、重连、分帧）在 `@shroom/backend/serial/`，不要在这里重新实现。
