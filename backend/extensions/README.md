# 内置扩展与模板

> 最后更新：2026-08-28

`backend/extensions/` 当前不是可独立安装的插件市场，而是两类随仓库维护的扩展资源：

| 目录 | 当前定位 | 是否进入生产运行 |
| --- | --- | --- |
| `built-in-sensors/` | 随 Electron 发布的复杂传感器兼容运行时 | 是 |
| `examples/` | manifest 校验样例和旧传感器迁移模板 | 否，目前只被测试读取 |

## 生产调用链

```text
kernel/platform/server.js
├─ createServerSensorProcessors
│  ├─ sit1024FrameProcessor
│  └─ backHead1024FrameProcessor
├─ createServerHandRuntime
│  └─ handPacketRuntime
├─ createServerSmallBedRuntime
│  └─ smallBed12BRuntime
└─ bindLegacySerialRuntime
   ├─ legacySerialContextFactory
   └─ legacySerialRuntimeBinding
      ├─ sensorRuntimeRegistry
      ├─ bindSerialSensorRuntimes
      └─ legacySerialFrameRuntime
         ├─ legacySegmentedFrameProcessor
         ├─ legacyGenericMatrixFrameProcessor
         ├─ legacyBigBedFrameProcessor
         └─ legacyGloveFrameProcessor
```

17 个 JavaScript 文件都有生产调用，没有可以直接删除的整文件死代码。它们属于“生产内置扩展”，
不是稳定内核；修改协议处理器仍需要硬件和历史兼容回归。

## `built-in-sensors` 逐文件职责

| 文件 | 作用 | 调用方 | 变更风险 |
| --- | --- | --- | --- |
| `sit1024FrameProcessor.js` | 处理 SIT 1024 字节帧，按传感器类型执行线序、扣零并生成 `sitData` | `sensorProcessorFactory` | 高：硬件与线序 |
| `backHead1024FrameProcessor.js` | 处理 BACK/HEAD 1024 字节帧并生成 `backData/headData` | `sensorProcessorFactory` | 高：硬件与线序 |
| `sensorProcessorFactory.js` | 把 SDK 线序函数、类型常量和状态依赖注入上述处理器 | `server.js` | 中：装配 |
| `handPacketRuntime.js` | 处理完整包/双分包手套协议、左右手、IMU、扣零和实时 payload | `handRuntimeFactory` | 高：协议与 payload |
| `handRuntimeFactory.js` | 装配手套状态、SDK 解析器和发布函数 | `server.js` | 中：装配 |
| `smallBed12BRuntime.js` | 调用 SDK 的 12B 解析能力，完成线序、扣零、标定和输出 | `smallBedRuntimeFactory` | 高：硬件与标定 |
| `smallBedRuntimeFactory.js` | 装配 12B 小床运行时依赖 | `server.js` | 中：装配 |
| `legacySerialFrameRuntime.js` | 五路遗留通道总分发器，按通道、帧长和类型选择处理器 | `legacySerialRuntimeBinding` | 最高：兼容总入口 |
| `legacySegmentedFrameProcessor.js` | 处理分片的手、足、眼、机器人和小采样帧 | `legacySerialFrameRuntime` | 高：分片与线序 |
| `legacyGenericMatrixFrameProcessor.js` | 处理低密度、256 点和 bed4096 通用矩阵帧 | `legacySerialFrameRuntime` | 高：帧长与线序 |
| `legacyBigBedFrameProcessor.js` | 拼接 bigBed 上下分片为 32×64 矩阵 | `legacySerialFrameRuntime` | 高：历史采集路径 |
| `legacyGloveFrameProcessor.js` | 处理旧 262 字节手套帧、姿态和点位映射 | `legacySerialFrameRuntime` | 高：旧协议 |
| `legacySerialContextFactory.js` | 将 `server.js` 的遗留可变状态包装为 getter/setter | `runtimeBindingsFactory` | 中：兼容状态 |
| `legacySerialRuntimeBinding.js` | 创建 legacy runtime，并把 handler 注册到 parser channel | `runtimeBindingsFactory` | 中：绑定生命周期 |
| `runtimeBindingsFactory.js` | 一次完成 legacy context 和 parser 绑定 | `server.js` | 中：总装配入口 |
| `sensorRuntimeRegistry.js` | 保存五个 legacy 通道的 handler 映射 | `legacySerialRuntimeBinding` | 中：名称像动态注册表，实际仍固定 |
| `bindSerialSensorRuntimes.js` | 将 SIT/BACK/HEAD/BIG_BED/SMALL_BED_12B 固定绑定到 parser | `legacySerialRuntimeBinding` | 高：通道兼容 |

## `examples` 的真实作用

| 示例 | 用途 | 当前完整度 |
| --- | --- | --- |
| `byte-matrix-demo` | 展示 schema v2、定长协议、JSON 算法和 renderer/profile | 最接近可运行，但仍是旧 schema |
| `jqbed-manifest-demo` | JQBed manifest 迁移模板 | 点位与协议不完整，不能直接投产 |
| `hand-glove-manifest-demo` | 双通道手套迁移模板 | 缺少混合字段和分包协议 |
| `small-bed-12b-manifest-demo` | 12B 小床迁移模板 | 缺少完整协议，且尚未显式声明 template 模式 |

生产发现只扫描资源目录和用户目录中的 `display-systems/`，不会扫描这里的 `examples/`。
`metadata.sourceRuntime` 与 `metadata.migrationTemplate` 当前也没有运行时消费者，因此这些文件
只能作为测试 fixture 或迁移说明，不能误认为已经注册的插件。

## 新能力应该怎样扩展

| 新能力 | 配置可以覆盖时 | 必须写代码时 |
| --- | --- | --- |
| 新传感器 | 在用户 `display-systems/<id>/` 增加 schema v3 manifest、协议、线序、点序/坐标和算法文件 | 跨帧状态、混合字段、文本协议或复杂握手放入 `built-in-sensors/<sensor>/`，并经过 Electron 发布 |
| 新算法 | JSON 数值算法或现有 JS/Python runner 由 manifest 引用 | 新运行环境或 external runner 需要扩展宿主/内核版本升级 |
| 新渲染方式 | 已注册 renderer 只需 manifest 选择 renderer/profile | 新 renderer 实现在前端注册表增加；采用网页缓存架构后可只更新网页资源 |

可配置协议目前覆盖 delimiter/fixed-length、单一数值类型、帧头、sum8/xor8/crc16-modbus、
JSON 线序/点序和数值后处理。跨帧状态机、压力与 IMU 混合类型、文本协议、复杂握手和动态长度
仍需要内置 runtime。

## 优化建议

1. **P0：先补硬件金丝雀测试。** 覆盖 legacy 分片、BigBed、通用矩阵和手套 payload，再动目录或装配。
2. **P1：按传感器族分目录。** 建议分为 `standard-matrix/`、`hand-glove/`、`small-bed-12b/`、`legacy/`，只移动文件，不合并协议逻辑。
3. **P1：增加 `built-in-sensors/index.js`。** `kernel/platform/server.js` 只依赖一个扩展装配入口，降低内核对具体传感器文件的直接依赖。
4. **P1：重整示例。** 分成 `templates/runnable/`、`templates/migration/` 与测试 fixtures，新增 schema v3 标准示例。
5. **P2：再收敛 legacy 装配层。** `context factory/binding/runtime binding` 可在测试齐全后合成一个 façade。
6. **P2：表驱动 1024 处理器。** 只有在真实样本锁定后，才把大型类型分支改成 sensor profile；不要直接合并四个 legacy processor。

当前最大缺口是 `kernel/platform/server.js` 仍直接导入四组 built-in factory，所以这里只完成了
“源码分目录”，还没有做到真正的插件依赖反转。

## 子目录逐文件说明

> 追加于 2026-08-29。本目录没有直接包含的 `.js` 文件，实现全在两个子目录里。

| 目录 | 内容 | README |
| --- | --- | --- |
| `built-in-sensors/` | 17 个文件、2191 行。8 个帧处理器（按帧长度区分协议）+ 9 个装配层文件 | [built-in-sensors/README.md](./built-in-sensors/README.md) |
| `examples/` | 4 个 Display System 样例目录，每个 4 个 JSON 文件 | [examples/README.md](./examples/README.md) |

`examples/` 下四个目录各自也有 README，因为它们性质不同：

| 目录 | 性质 | 说明 |
| --- | --- | --- |
| [byte-matrix-demo](./examples/byte-matrix-demo/README.md) | schema v2，**完整可跑** | 2×3 六个点，小到能手算。想知道字段怎么写看这个 |
| [jqbed-manifest-demo](./examples/jqbed-manifest-demo/README.md) | schema v1，迁移模板 | 缺 `protocol`；点序只填了 16/1024 个点 |
| [small-bed-12b-manifest-demo](./examples/small-bed-12b-manifest-demo/README.md) | schema v1，迁移模板 | 缺 `protocol` 和量程；点序 8/1024 |
| [hand-glove-manifest-demo](./examples/hand-glove-manifest-demo/README.md) | schema v1，迁移模板 | 占两个串口角色；左右手路由无法在 manifest 表达 |

三个迁移模板的共同状态：**只声明了传感器身份和显示部分，解帧仍走 `built-in-sensors/` 的硬编码实现**（各自 `metadata.sourceRuntime` 指明是哪一个），点序也只填了骨架。启用它们不会得到正确数据。
