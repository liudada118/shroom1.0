# 算法通道

> 最后更新：2026-08-29

后端和算法之间的那道边界。算法本身（Python 或 JS）不在这里，这里管**怎么调它、多久调一次、参数从哪来、结果怎么发出去**。

两条独立的通道：

- **Python 通道**：`pythonWorker` 起一个常驻 Python 子进程，用 stdio 收发 JSON。生命体征和宠物看护走这条。
- **Display System 通道**：`displaySystemAlgorithmRunner` 按扩展 manifest 声明的方式跑算法，JS 走 `vm` 沙箱，Python 转给上面那个 worker。

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `pythonWorker.js` | Python 子进程桥，651 行。`startWorker` / `stopWorker` 管生命周期，`callPy(fn, args, {timeoutMs})` 发一次调用，`warmFootAnalysis` 预热足部分析 | 常驻进程，不是每次调用起一个。打包后和开发时的解释器路径不同，靠 `electronApp` 是否存在判断。默认超时 10s；`ping` 探活 30s；足部预热 **300s**（模型加载真的慢） |
| `petCareRuntimeService.js` | 定时调 Python 算法并发布结果，557 行。`startVitalSignsTimer`（jqbed / smallBed，**125ms**）、`startPetCareTimer`（petCare / petCareMini，**20ms**）。同时维护宠物在床状态的稳定窗口、模拟/补齐心率 | 两个定时器都是「够条件才跑」：点阵有效、类型匹配、串口已开，缺一就直接 return。jqbed 探测期间用 `jqbedConfigProbePromise` 挡住新任务，防止 125ms 节奏把等待任务堆起来 |
| `jqbedAlgorithmConfig.js` | jqbed 算法的 13 个参数配置，含默认值、校验、归一化和落盘 store。导出 `JQBED_ALGORITHM_CONFIG_VERSION`（当前 **2**）、`DEFAULT_JQBED_ALGORITHM_VALUES`、`JqbedAlgorithmConfigValidationError`、`normalizeJqbedAlgorithmValues`、`createJqbedAlgorithmConfigStore` | 落盘位置由调用方给（`server.js:316` 传 `runtimeWritableRoot/jqbed-algorithm-config.json`），本文件不猜路径。**v1 配置能自动升到 v2**：缺的键用默认值补 |
| `jqbedAlgorithmProtocol.js` | 上面那份配置的前后端协议。`isJqbedAlgorithmConfigMessage` 判形状，`createJqbedAlgorithmProtocol` 处理读/写/重置三个命令，`buildJqbedGetDataArgs` 决定调算法时带不带 config | 只有 `activeFile === 'jqbed'` 且配置非空时才把 config 传给算法——其他传感器类型不吃这套参数，传了会被 Python 侧当未知字段 |
| `displaySystemAlgorithmRunner.js` | Display System 声明式算法的两种执行器。`createJavaScriptAlgorithmRunner` 用 `vm` 沙箱跑 JS（默认超时 **1000ms**）；`createPythonAlgorithmRunner` 转给 `pythonWorker.callPy` | `fsLike` / `vmLike` / Python caller 都可注入，所以能测。JS 沙箱不是安全边界——扩展代码是本地信任的，超时只是防死循环 |

## 配置文件带版本号的原因

`JQBED_ALGORITHM_CONFIG_VERSION` 现在是 2，而 `load()` 里明确接受 `[1, 2]` 两个版本：读到 v1 就按键名逐个从默认值补齐，写回时统一成 v2。

这不是过度设计。算法参数存在用户可写目录里，用户升级应用之后那个文件还是旧的——不兼容就意味着用户的调参全丢，而且是静默丢（配置读失败会 `fallBackToDefaults`，只打一条 warn）。加参数时记得同时加默认值，不然老配置升级上来那个键是 `undefined`。

## 两个定时器为什么差 6 倍

- 生命体征 **125ms**：呼吸率和心率是慢变量，8Hz 足够，而且 Python 那侧一次推理开销不小。
- 宠物看护 **20ms**：要判断「宠物有没有离床」这种瞬时事件，慢了就漏。

`startPetCareTimer` 开头有一句 `if (system.runtime.processing) return;`——20ms 一次的节奏下 Python 大概率来不及，这行是丢帧而不是排队。丢帧是对的：算法要的是当前状态，不是历史队列。

## 边界

- 算法参数的语义、量纲、取值范围由算法侧定义。改 `DEFAULT_JQBED_ALGORITHM_VALUES` 之前要和算法确认，这些值直接进推理。
- `callPy` 的默认 10s 超时对交互式调用是合理的，但批处理类调用要显式传大一点的值（参考 `warmFootAnalysis` 的 300s）。
- 定时器周期改动会同时影响 CPU 占用和事件检出率，属性能与行为的双向权衡，不要单方面调。
