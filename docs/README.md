# 开发文档导航

> 整理日期：2026-09-11。只想理解当前软件，先读下面三份；不必按文件夹顺序通读。

## 产品功能入口

[本次版本销售公告草稿](销售版本更新公告-2026-10-20.md)：合同关联、电脑数量、Agent、公司系统交付、网页更新及销售答疑；正式生效以客户端和服务端发布验收为准。

[产品功能文档](产品功能文档.md)：面向产品、交付和使用者，按当前工作区代码说明系统目录、使用流程、设备接入、展示分析、采集回放、CSV、配置器和内置 Agent，并列明专项能力及限制。核对日期：2026-09-18；属于静态源码核对，不代表真机验收。

[Shroom 产品整体与客户端服务端协同设计说明](客户端与服务端协同设计说明.md)：统一产品设计入口，当前为[完善版 1.5](客户端与服务端协同设计说明-v1.5.md)。覆盖设备采集、Agent、跨端授权与交付，以及算法交易方向；补充资源投入、平台验证、完整运行组合、结果可读与维护验收，现行说明、已确认政策、拟实施要求及待决策分别标记。

来源追溯：[协同设计 1.3](客户端与服务端协同设计说明-v1.3.md)、[算法交易方向 0.2](PRD-Shroom-算法交易平台-v0.2.md)、[合并版 1.4](客户端与服务端协同设计说明-v1.4.md)。算法独立 PRD 保留原稿用于追溯，后续整体产品维护统一入口；历史快照不随本次修订改写。

## 当前开发入口

概念入门：[Manifest、多串口与内置 Agent 生成规则](manifest-agent-rules.md)，解释配置、业务身份、串口和 WS 的关系，并区分模型指令、工具硬性校验、提案应用及真机验证。

1. [开发者手册](developer-guide.md)：进程、启动/关闭、资源路径、扩展安装、打包与修改边界。
2. [数据与算法链路](chains/data-flow.md)：控制命令、串口、帧处理、算法、采集、回放与 CSV。
3. [界面与渲染链路](chains/interface-flow.md)：首页、选择、进入、实时画面、图表和返回的状态及调用链。
4. [内置 Agent](embedded-agent.md)：模型设置、附件、提案应用、设备连接与任务恢复，以及当前验证边界。
5. [Agent 聊天同步接口](agent-chat-sync-api.md)：客户首次配置、升级保留数据、上传内容、持久队列与服务端接收契约。
   [服务商与模型目录](agent-model-catalog-api.md)：动态下拉选项、离线缓存及服务端热配置；首次需更新兼容客户端。
6. [电脑授权、网页缓存与使用统计](desktop-distribution-services.md)：设备上限、离线签名凭证、独立网页发布、上报开关与部署验收。

代码定位和测试选择用 [ARCHITECTURE_INDEX.md](../ARCHITECTURE_INDEX.md)；追溯旧决策才查
[ARCHITECTURE.md](../ARCHITECTURE.md)。后者是累积台账，不再作为从头学习当前架构的入口。

## 文档状态怎么判断

| 状态 | 用法 |
| --- | --- |
| 当前链路 | 上述三份手册按实际函数和数据流维护；本轮为静态源码核对，不声称真机验证 |
| 专项参考 | 只处理某个模块、契约或发布步骤时查；局部细节仍要核对对应源码 |
| 历史快照 | 保留当时分析，不再作为当前实现依据；不因为文件名含“架构”就优先读取 |
| 设计/计划 | 说明目标或当时拟实施内容，不能仅据此认定功能已经落地 |
| 交付/敏感材料 | 有独立用途，不参与架构合并，不复制真实授权值进新文档 |

冲突时，先核对当前源码与契约，再更新对应手册小节。旧文档的日期、分支和测试结论只属于其记录时点。

## 现有文档分流清单

### 按需查的模块与交付材料

| 文件/目录 | 状态与用途 |
| --- | --- |
| [repository-map.md](repository-map.md) | 专项目录参考；不是完整运行时序，本轮修正旧“三路 WS”描述 |
| [后端地图](../backend/ARCHITECTURE_MAP.md)、[后端架构说明](../backend/BACKEND_ARCHITECTURE.md)、各模块 README | 专项模块说明；完整运行顺序以当前链路手册为入口，不按旧行数/文件数量判断现状 |
| [SDK 入口](../sdk/README.md) | 公共 API 与包边界；具体字段以源码契约和运行中 catalog 为准 |
| [mac_release_flow.md](mac_release_flow.md) | macOS 发版操作参考；不适用于 Windows，不因阅读本文自动执行发布 |
| [japanese-alert-mp3-generation-guide.md](japanese-alert-mp3-generation-guide.md) | 日文告警音频的专项生成/交付步骤，非核心架构 |
| [系统架构图.md](系统架构图.md) | 智能座椅气囊控制专项图，标题不是 Shroom 全仓架构 |
| [license-key-values.md](license-key-values.md) | 授权运维参考，可能含敏感值，不纳入普通技术示例 |
| [EULA.md](EULA.md)、[EULA.txt](EULA.txt)、[EULA.nsis.txt](EULA.nsis.txt)、[EULA copy.md](<EULA copy.md>) | 交付/法律材料；`EULA.nsis.txt` 被安装器配置引用，其他版本需在法律/发布任务单独确认，不能按重复文档直接删除 |
| [patent/三维人体压力数据优化渲染方法_专利交底草案.md](patent/三维人体压力数据优化渲染方法_专利交底草案.md) | 专利交底草案，不是运行实现或性能证明 |

### 历史架构和分析：原路径保留，不再作为主入口

| 历史文件 | 应该改看哪里 |
| --- | --- |
| [architecture.md](architecture.md) | 2026-02 版本快照 → 开发者手册 |
| [architecture_max.md](architecture_max.md) | Max 分支快照 → 开发者手册 |
| [Shroom_Obsidian_架构笔记.md](Shroom_Obsidian_架构笔记.md) | 旧结构笔记 → 当前手册；含已迁移目录 |
| [Shroom_Obsidian_业务架构文档.md](Shroom_Obsidian_业务架构文档.md) | 旧业务到模块映射 → 两条当前链路 |
| [Shroom核心数据流架构图.md](Shroom核心数据流架构图.md) | 历史图解 → 数据与算法链路 |
| [Obsidian架构图.md](Obsidian架构图.md) | 历史功能图解 → 当前手册及链路 |
| [optimization_report.md](optimization_report.md)、[optimization_report_max.md](optimization_report_max.md) | 当时优化报告，只作追溯 |
| [tech_optimization_proposal.md](tech_optimization_proposal.md) | 优化建议，不代表已实施 |

同目录 `architecture_diagram*.png/.mmd`、`data_flow_diagram*.png/.mmd` 是这些历史稿的配套图，
不要单独当作当前架构图。历史正文未删除或迁移，原有链接仍可追溯。

### 产品目标、设计与实施计划

| 文件/目录 | 状态与阅读场景 |
| --- | --- |
| [shroom-product-concept-one-pager.md](shroom-product-concept-one-pager.md) | 产品概念，讨论产品范围时读 |
| [shroom-platform-target-architecture.md](shroom-platform-target-architecture.md) | 目标架构，不是当前代码地图 |
| [system-publishing-design.md](system-publishing-design.md) | Agent 系统提交、管理员发布、客户授权与安装的实现及上线步骤 |
| [shroom-platform-overview-and-guide.md](shroom-platform-overview-and-guide.md) | 产品目标与版本指南混合材料；实现细节转到开发者手册 |
| [superpowers/specs/](superpowers/specs/)、[superpowers/plans/](superpowers/plans/) | 按日期保存的设计及实施计划；前端渲染抽离、人体映射/调节、日文告警、床垫算法配置等专题，仅在追溯该任务时读取 |
| [markdown/PRD-Shroom.md](markdown/PRD-Shroom.md) | 历史需求材料，不作为现状证明 |
| [markdown/QA.md](markdown/QA.md)、[markdown/传感器类型.txt](markdown/传感器类型.txt) | 旧问答及型号笔记，型号能力以运行注册表为准 |
| [markdown/macZIP.md](markdown/macZIP.md) | 旧 Mac 分发笔记，优先核对专项发布文档和脚本 |
| [markdown/csv.md](markdown/csv.md)、[markdown/csv-shroom.md](markdown/csv-shroom.md) | 旧 CSV 讨论，当前导出入口见数据链路 |

## 后续只这样维护

v1.3 已实现能力、证据边界和两库发布顺序：[v1.3-implementation-and-release.md](v1.3-implementation-and-release.md)。原对应产品要求保留于[协同设计 1.3 快照](客户端与服务端协同设计说明-v1.3.md)；整体产品设计转至[统一入口 1.5](客户端与服务端协同设计说明.md)，算法交易方向已合入。生产迁移与真机验收单独记录。

- 当前行为变化：更新三份手册的对应小节和源码链接，不再另起“最新版架构”“Max 架构”。
- 接口字段变化：维护契约定义；手册链接过去，不复制第二份完整 schema。
- 历史原因/验证结果：在根架构台账追加，不能把旧结果写成这次已验证。
- 新计划：显式标注目标/未实施；实现后更新当前链路，而不是让计划自动升格为现状。
- Skill：保留执行规则和按需阅读入口，不把开发手册再次复制进去。

本次只做逻辑归档与入口收敛，没有删除、移动文件，也没有改变安装器、SDK、Agent 规则或程序行为。
