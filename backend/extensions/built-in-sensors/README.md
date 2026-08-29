# 内置传感器

> 最后更新：2026-08-29

17 个文件、2191 行，是这套硬件历史的沉积层。所有在 Display System 声明式架构之前就存在的传感器协议都在这里，按**帧长度**区分——这是它们唯一可靠的区分特征。

叫 `extensions/` 是因为长期目标是让它们和第三方扩展走同一条路；叫 `legacy*` 的那些是还没迁完的。

## 分组

### 帧处理器（按协议分）

| 文件 | 协议 | 说明 |
| --- | --- | --- |
| `sit1024FrameProcessor.js` | 坐垫 1024 字节 → 32×32 | 最常见的一路。字节读取 → 传感器线序转换 → 零点扣除 → payload |
| `backHead1024FrameProcessor.js` | 靠背 / 头枕 1024 字节 | 同上，但用**区域线序**（`car10Back` 等），因为靠背分区 |
| `legacyBigBedFrameProcessor.js` | bigBed 1025 字节 | 每帧最后 1 字节标记上/下半片，缓存两片拼成 32×64。只拼，不发布不入库 |
| `legacyGenericMatrixFrameProcessor.js` | 72 / 144 / 256 / 4096 | 低密度坐垫、单帧矩阵、大床矩阵。纯字节协议 |
| `legacySegmentedFrameProcessor.js` | 130/142 首包 + 146/158 尾包 | 分片压力帧。手/足/眼部线序映射都在这 325 行里 |
| `legacyGloveFrameProcessor.js` | 手套 262 字节 | 原本写在 `legacySerialFrameRuntime` 的 sit 分支里，拆出来了 |
| `handPacketRuntime.js` | `handGloveFullPacket` / `handGloveDouble` | 分包解析、左右手路由、零点扣除、映射矩阵 |
| `smallBed12BRuntime.js` | 小床 12B | buffer 解析、零点扣除、压力标定、状态同步 |

### 装配层（把上面那些接进 server）

| 文件 | 作用 |
| --- | --- |
| `sensorProcessorFactory.js` | 注入依赖给 sit / backHead 两个 1024 processor |
| `handRuntimeFactory.js` | 装配手套 runtime。`HAND_RUNTIME_SNAPSHOT_KEYS` 列出 9 个要快照的状态键 |
| `smallBedRuntimeFactory.js` | 装配小床 runtime |
| `legacySerialFrameRuntime.js` | 405 行，**按帧长度分发**给上面 4 个 legacy processor |
| `legacySerialContextFactory.js` | 把 server.js 传来的 getter/setter 描述包装成 legacy runtime 能挂载的 accessor |
| `legacySerialRuntimeBinding.js` | 创建 legacy runtime + 注册五路 handler + 绑 parser manager |
| `runtimeBindingsFactory.js` | 上面两个的统一入口，`bindLegacySerialRuntime` |
| `bindSerialSensorRuntimes.js` | 维护 `serialParserManager.channels` ↔ 业务处理器的对应关系 |
| `sensorRuntimeRegistry.js` | 业务通道名 → 处理函数的注册表，替代 server.js 里手写的对象字面量 |

## 为什么按帧长度分发

`legacySerialFrameRuntime` 的核心是一个按 `data.length` 分支的分发器：72、130、142、144、146、158、256、262、1024、1025、4096……

这不是好设计，但它反映的是真实约束：**这些协议没有类型字段**。硬件直接吐一串字节，长度是唯一能用来判断「这是什么」的东西。要改成有类型标识的协议，得同时改固件，而已经出货的设备改不了。

所以两个帧长度撞车是真实风险。加新协议时先确认长度没被占用。

## 零点扣除必须在线序之后

几乎每个处理器的注释都写着同一个顺序：`字节读取 → 线序转换 → 零点扣除 → payload`。

顺序反了不会报错，但零点会扣到错误的点位上——热力图看起来正常，只是某些点的基线不对。这是这个项目里最难发现的一类 bug：数据全程有效、无异常、能存能回放能导出，只是值不对。

## Display System 里有对照实现

`../examples/` 下的四个 demo（`jqbed-manifest-demo`、`small-bed-12b-manifest-demo`、`hand-glove-manifest-demo`、`byte-matrix-demo`）就是把这里的几种协议改写成声明式 manifest 的样板。

配合 `extension-host/runtime/` 的 parallel 模式，可以让声明式版本和这里的硬编码版本同时收同一份串口数据，逐帧比对输出。迁移这类协议必须这么验——出错的表现是数据静默不对，不是崩溃。

## 边界

- **所有帧长度、字节偏移、线序、标定系数都属硬件协议范畴。** 改动影响历史数据兼容性（旧库里的记录按旧解析存的），必须人工确认。
- `legacy*` 是待迁移标记，不是「随便改」。它们对应的是真实在用的硬件。
- 新传感器优先写成 Display System manifest，不要往这里加文件。
