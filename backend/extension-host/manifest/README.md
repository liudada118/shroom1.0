# Manifest：Display System 的声明与校验

> 最后更新：2026-08-29

一个 Display System 就是一个目录加一份 `display-system.json`。这个目录负责**读它、校验它、把它翻译成运行时能用的定义**。

到这一层结束，还没有任何串口被打开、没有任何算法被执行——只有「这份声明合不合法、它想要什么」。

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `displaySystemConfigLoader.js` | 入口，244 行。`discoverDisplaySystems` 扫目录、`findManifestFile` 找 manifest（默认文件名 `display-system.json`）、`loadDisplaySystemDirectory` 加载单个、`resolveDisplaySystemFiles` 解析引用到的外部文件 | 唯一碰 `fs` 的文件之一。校验本身委托给下面两个 validator，自己不判断合法性 |
| `displaySystemConfigValidator.js` | 校验 manifest 主体，276 行。`validateDisplaySystemConfig`；导出 `ALGORITHM_TYPES`、`DISPLAY_SYSTEM_SCHEMA_VERSION`（当前 **3**）、`SUPPORTED_DISPLAY_SYSTEM_SCHEMA_VERSIONS`（**[1,2,3]**） | 协议部分转给 `@shroom/backend/protocol/displaySystemProtocol.js`，页面部分转给 `displaySystemPage.js`。**注意**：采集存储只有 sit/back/head 三张表，其他输出通道只实时下发不入库 |
| `displaySystemConfigFileValidator.js` | 校验 manifest **引用的外部文件**，233 行：算法数据定义、坐标映射、线序、点序 | 和上面那个的分界线是「配置本身」vs「配置指向的文件」。算法操作类型限定为 `scale` / `offset` / `clamp` / `zeroBelow` 四种 |
| `displaySystemDefinitionBuilder.js` | 翻译层，236 行。把已校验的配置变成四种运行时定义：`buildSensorDefinitionFromDisplaySystem`、`buildParserChannelDefinitionsFromDisplaySystem`、`buildDisplayMetadataFromDisplaySystem`、`buildDisplaySystemRuntimeDefinition` | 只做纯转换。同时吃系统级 config（矩阵在 `sensor.matrix`）和单个传感器条目（矩阵在 `matrix`）两种形状 |
| `displaySystemPage.js` | 前端页面配置的规范化与校验，581 行。视图类型、矩阵变换、侧边栏指标、图表卡片、配色 —— 14 个导出 | 后端不渲染任何东西，但要保证前端拿到的配置是完整且合法的。默认数据源在 `DEFAULT_VIEW_SOURCES`（如 `lineChart` → `metrics.totalPressure`） |
| `displaySystemCoordinateMap.js` | 坐标矩阵的读取、归一化、规范化、校验，134 行 | 兼容裸 `rows × cols × [x,y]` 数组和带 `coordinates` 字段的对象两种写法。都不是就抛错 |
| `displaySystemCanvasCatalog.js` | 白名单常量表，55 行。配色（5 种）、画布叠加层、图表叠加层、图表卡片上限 | **只有 id 和中文名，没有色值。** 色值实现在前端 `client/src/extensions/display-system/colormaps.js` |
| `displaySystemAlgorithmPackage.js` | 独立校验/加载 `algorithm-package.json`，冻结 Python API 1/2、运行环境、单/多传感器输入、同步容差、入口与资源路径 | 包内入口和资源必须使用相对路径并留在包目录；多传感器只允许 API V2 |
| `builtinAlgorithmPackageCatalog.js` | 从开发态/打包态只读资源根发现内置算法包，输出可移植 Manifest、源码、兼容范围和指标定义 | 不暴露绝对路径；同 id 按资源根顺序去重，坏包进入诊断而不污染 Builder 下拉框 |

## 白名单为什么放在后端

`displaySystemCanvasCatalog.js` 的文件头把理由写清楚了：Builder 的零件栏按这份目录渲染，manifest 校验按**同一份**目录判合法性。

如果两边各写一套，就会出现「Builder 里能选、装上去校验不通过」，或者反过来「校验放过了但前端渲染不出来」。加一种配色时改这里一处，前端只需要补对应的色值实现。

## Schema 版本兼容 1、2、3

`SUPPORTED_DISPLAY_SYSTEM_SCHEMA_VERSIONS = [1, 2, 3]`，当前写出的是 3。

Display System 是用户可以自己写、自己分发的——已经存在的第三方 manifest 不能因为我们改了 schema 就装不上。加字段时给默认值，不要把新字段设成必填。

## 边界

- 到这一层结束不打开串口、不跑算法。要真跑起来看 `../runtime/`。
- `sensor.algorithm.packageManifest` 是可选增强；未声明时继续使用原来的裸 `entry` V1 契约。
- `ALGORITHM_TYPES` 和四种算法操作类型是对扩展作者的公开契约，删项属破坏性变更。
- 线序、点序、坐标映射直接决定热力图的点位。校验放松一格，后果是画面镜像或错位而**不报错**。
