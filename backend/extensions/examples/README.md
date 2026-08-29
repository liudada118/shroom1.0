# Display System 样例

> 最后更新：2026-08-29

四个目录，每个是一个完整的 Display System。它们有两种性质，别混：

| 目录 | schemaVersion | 性质 |
| --- | --- | --- |
| `byte-matrix-demo/` | 2 | **完整可跑的教学样例**。有 protocol 块，配置写全了 |
| `jqbed-manifest-demo/` | 1 | **迁移模板**。`runtimeMode: "template"` |
| `small-bed-12b-manifest-demo/` | 1 | 迁移模板 |
| `hand-glove-manifest-demo/` | 1 | 迁移模板，`runtimeMode: "template"` |

## 每个目录都是同样的四个文件

| 文件 | 作用 |
| --- | --- |
| `display-system.json` | manifest 本体。传感器类型、矩阵尺寸、占用哪些串口角色、协议、算法、页面配置 |
| `line-order.json` | 线序映射。物理采集顺序 → 逻辑行列顺序 |
| `point-order.json` | 点序映射。带 `matrix` 尺寸和 `points` 坐标列表 |
| `algorithm-data.json` | `algorithm.type: "json"` 时的参数（`scale` / `max` / `zeroBelow` 之类） |

文件名不是固定的——`display-system.json` 的 `files` 段指向它们，改名要同步改。

## 三个迁移模板缺 protocol，是故意的

`jqbed` / `small-bed-12b` / `hand-glove` 三个的 `protocol` 字段是 `undefined`，`metadata.sourceRuntime` 指向 `../built-in-sensors/` 下对应的硬编码实现：

| 模板 | 对应的硬编码实现 |
| --- | --- |
| `jqbed-manifest-demo` | `built-in-sensors/sit1024FrameProcessor.js` |
| `small-bed-12b-manifest-demo` | `built-in-sensors/smallBed12BRuntime.js` |
| `hand-glove-manifest-demo` | `built-in-sensors/handPacketRuntime.js` |

意思是：**这三个只声明了传感器和显示部分，解帧还走旧代码。** 它们是迁移到一半的中间态，用来验证 manifest 这一层能不能表达这些传感器，而不是已经切换过去了。

要真正迁完，得把对应 processor 里的帧长度、字节偏移、线序全部翻译成 `protocol` 块，然后开 parallel 模式逐帧对比两边输出（见 `../../extension-host/runtime/README.md`）。

## byte-matrix-demo 是最小完整例子

只有 2×3 六个点，但把该有的都写了：

```
protocol: 921600 波特率 / 定长 6 字节 / uint8 / offset 0 / 6 个值
algorithm: json，参数 {scale: 2, max: 70, zeroBelow: 30}
lineOrder: [4, 2, 1]
pointOrder: 2×3 矩阵，points [[0,0],[1,1],[1,2]]
display: 2 个 view、2 个 widget、3 种 renderer、4 种可视化算法、3 个 profile、6 个控件开关
```

想知道某个字段该怎么写，看这个目录。六个点意味着可以手算——喂 6 个字节进去，按线序和点序推一遍，结果对不对一眼能看出来。这是它的价值所在，不是规模。

## 边界

- 这几个目录是样例，不要当成生产配置改。要新建系统就 `duplicate` 一份（`extension-host/workspace/`）。
- `hand-glove-manifest-demo` 占了 `sit` 和 `back` 两个串口角色。同时启用多个样例会撞角色。
- schemaVersion 1 的样例留着是为了验证向后兼容（loader 声明支持 [1,2,3]）。别顺手升级它们——升了就没有 v1 的测试样本了。
