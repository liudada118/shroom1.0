# Agent 聊天同步：客户端交付与服务端接口

更新：2026-10-14。默认地址为 `https://shroom.jq-industries.com/api/agent/conversations`。新版客户端首次使用默认自动同步，以软件密钥鉴权，无需另外配置同步地址或上传令牌。服务端对应实现位于 `E:/key`；离线密钥支持需新增 `0021_agent_chat_offline_sources` 迁移并升级两端。2026-09-23 的在线密钥生产 HTTPS 联调曾收到 HTTP 200、匹配 eventId 的 `accepted:true` 回执及队列归零；这是当时的契约确认，不代表本次默认策略及离线支持已经部署。

## 1. 客户首次使用与升级

- 新客户打开 Agent → 模型设置，填写自己的服务地址、模型 ID 和 API Key。安装包不内置共享模型 Key。
- 模型 Key 由 Electron `safeStorage` 加密到 `app.getPath('userData')/agent/settings.json`。同一电脑、同一系统账号、相同应用身份和数据目录下，升级继续读取，无需重复填写。
- 聊天保存在该目录的 `state.json`、`conversations/` 和 `attachments/`；安装版采集库位于 `userData/db/`。升级不替换已有业务数据库。
- 开发版 Agent 也使用 `userData/agent/`；因此同一账号运行安装版看到已有 Key/聊天，可能是复用了本地目录。开发态采集库在项目 `db/`，不与安装态自动合并。
- 打包脚本从运行时 schema 生成全新空 `init.db`，不复制开发数据库；排除仓库根 `agent/`、`userData/`、`builtin-system-copies/`。
- 更换电脑/系统账号可能无法解密 Key，需要重新填写；删除数据目录或改变应用身份不属于原目录升级。发布保持应用 `name`、`productName`、`appId` 与用户数据路径稳定。

## 2. 配置上传与范围

首次使用默认自动同步。主进程复用 `readStoredLicenseKey` 读取当前软件密钥，不回传给页面或模型、不另存至同步配置；客户不需要额外保存同步设置。面板优先显示同步说明、状态和重试按钮，地址、凭证和开关放在折叠的“高级同步设置”中。已有手动关闭和自定义接口配置保留，损坏配置仍暂停上传；已有独立凭证可在高级设置清除后保存，切换为软件密钥鉴权。

首次使用默认填入 `https://shroom.jq-industries.com/api/agent/conversations`。仅此精确 HTTPS 地址可自动接收软件密钥；其他地址必须单独填写上传凭证，旧自定义配置保持原样，切换地址清除旧凭证。手动配置的凭证优先使用 Bearer，不代用模型 API Key。开发版须重启 Electron；安装版须更新安装包。

服务器只允许已登记、未过期且状态为 ISSUED/ACTIVATED/RENEWED 的软件密钥上传；暂停、吊销、异常、软删除、过期及停用/删除的关联客户均拒绝。续期以数据库期限为准；无密钥或未知密钥不允许上传。公司名由服务器关联客户或密钥中保存的公司名称确定，未绑定公司的有效密钥单独显示“未绑定公司 · 密钥 #ID”。

在线密钥沿用原有来源身份。离线 RSA 激活码按已登记记录、签发公钥、签名范围及期限验证，并要求有效客户关联；v2/v3/v4 范围均按对应签名格式解析。离线密钥来源使用唯一 `offline_key_id`，不与同数字 ID 的在线密钥混淆，也不会因客户关联变化修改会话的来源主键。尚未关联客户的离线码需管理员在密钥网站处理，不要求客户填写额外上传凭证。

启用时同步当前会话已有内容，之后同步用户消息、助手最终回复和任务状态变化。流式 token 不逐个上传；同一会话未发送的版本可以合并为包含全部消息的最新快照。打开旧会话也会同步它，不自动遍历全部历史归档。

上传正文、任务状态、引用附件名称；不上传工具入参/结果、算法选数对象、提案配置、密钥配置、附件原文件、缩略图或采集库。正文中被用户或助手写出的采集摘要仍会随聊天上传。客户端遮盖已知当前凭据、常见 Bearer/sk 密钥、内嵌图片及常见绝对路径；不能保证识别用户手动粘贴的所有敏感文本。

界面显示待同步会话数、上次成功时间、重试时间及错误。关闭同步取消在飞请求并停止后续发送，保留本地队列；已送达服务器的请求不能通过本地关闭撤回。超管可在网站 `/agent-chats` 查看；不包含远端恢复、删除和全历史补传接口。

## 3. 请求契约

客户端 POST 用户填写的完整 URL，不自动追加路径：

当前默认完整 URL：`https://shroom.jq-industries.com/api/agent/conversations`。

```http
POST /api/agent/conversations
Authorization: License <当前软件密钥>
Idempotency-Key: 24831a50-f42f-42b8-9ae2-cf47f3c14d2
Content-Type: application/json
```

兼容独立凭证：将 Authorization 改为 `Bearer <服务器签发的 ags_ 凭证>`。两种鉴权不能同时发送。请求正文不包含软件密钥、公司名或归属 ID。

```json
{
  "schemaVersion": 1,
  "eventType": "agent.conversation.upsert",
  "eventId": "24831a50-f42f-42b8-9ae2-cf47f3c14d2",
  "installationId": "249c3777-cff6-44e4-99ea-a812e302a992",
  "conversationId": "conversation-example",
  "revision": 3,
  "occurredAt": "2026-09-22T06:30:00.000Z",
  "appVersion": "1.1.37",
  "conversation": {
    "id": "conversation-example",
    "createdAt": "2026-09-22T06:29:00.000Z",
    "messages": [
      {"id": "message-1", "taskId": "task-1", "role": "user", "text": "帮我分析这组数据", "createdAt": "2026-09-22T06:29:01.000Z", "attachmentIds": ["attachment-1"]},
      {"id": "message-2", "taskId": "task-1", "role": "assistant", "text": "分析已完成。", "createdAt": "2026-09-22T06:30:00.000Z"}
    ],
    "tasks": [{"id": "task-1", "status": "succeeded", "createdAt": "2026-09-22T06:29:01.000Z", "finishedAt": "2026-09-22T06:30:00.000Z"}],
    "attachments": [{"id": "attachment-1", "name": "数据.csv", "kind": "csv", "size": 1024}]
  }
}
```

| 字段 | 语义与校验 |
| --- | --- |
| schemaVersion / eventType | 固定 `1` / `agent.conversation.upsert` |
| eventId | 快照事件 UUID；重试不变，与请求头一致 |
| installationId | 随机安装 UUID，重启保留；不采集 MAC/硬件序列号，不能代替客户鉴权 |
| conversationId / conversation.id | 必须相同；会话、消息、任务和附件 ID 为 1～160 位字母/数字/`_ . : -` |
| revision | 正整数，按目标地址和会话递增；合并会导致序号不连续 |
| occurredAt | 客户端快照 ISO 时间，不能用它决定覆盖顺序 |
| appVersion | 可选软件版本，最长 80 字符 |
| messages | 完整已保存用户/助手文本数组，role 仅 `user` / `assistant`；taskId、createdAt、attachmentIds 可缺省 |
| tasks | ID、status 和可选 createdAt/finishedAt/errorCode；不含错误原文、工具步骤及提案 |
| attachments | 只含消息引用的附件 ID、文件名（最多 255 字符）和可选 kind/size；size 为非负字节数 |

## 4. 确认与重试

服务端成功持久化后返回 HTTP **200、201 或 202**，JSON 必须包含本次请求的 eventId：

```json
{"accepted": true, "eventId": "24831a50-f42f-42b8-9ae2-cf47f3c14d2"}
```

- 仅 HTTP 200、空体、204、错误 eventId 或 `accepted:false` 均不清除待传记录。确认体最多 16 KiB。
- 同一 eventId 重复请求须返回同样成功确认，不能重复新增消息。202 也须已进入可靠存储/队列，不能只留在内存就确认。
- 网络失败、15 秒超时、HTTP 429/5xx 或无效确认：1 秒起始指数退避，最多 5 分钟；重启保留退避。当前不解析 `Retry-After`。
- 其他 HTTP 4xx（例如 400/401/403/413）：保留并阻断队列；修正设置或点击立即重试后继续。
- 禁止重定向，不能用 301/302 跳转登录或其他接口。远程须 HTTPS，本机 `localhost` / `127.0.0.1` / `[::1]` 可 HTTP；URL 不允许用户名、密码、查询参数或片段。
- 事件 JSON 最大 8 MiB，每个目标地址的持久队列最大 64 MiB。服务端/反向代理须允许 8 MiB 请求，并在 15 秒内完成可靠接收确认。
- 容量/磁盘失败在界面报错，不影响本地聊天。未落盘快照仅尝试有界内存暂存，超过限额或重启后可能需恢复空间并重新打开相关会话；错误状态不能视为已备份。已有合法队列仍可排空。

## 5. 服务端最小实现

1. 校验 `License` 软件密钥或旧 `Bearer` 独立凭证，先鉴权再处理请求体。不使用模型 API Key，不记录 Authorization 头。软件密钥必须命中服务器登记，数据库错误不降级放行。
2. 校验版本、事件类型、ID、revision、字段类型/长度/总大小、头部 eventId；拒绝未支持字段。服务端补 receivedAt 和经鉴权的客户身份，不相信客户端自报归属。
3. 事务内记录事件并按 `(tenantId, installationId, conversationId)` 原子更新最新快照。只允许较大 revision 覆盖；迟到旧版已被更新版涵盖时仍成功确认本事件，避免无限重传。
4. `(tenantId, installationId, eventId)` 唯一；记录请求摘要，相同事件身份而内容冲突返回 409 并报警，不能悄悄覆盖。
5. 事务提交后回 ACK。数据库暂不可用返回 503，限流 429，凭证失效 401/403；完整异常只进受控日志。

| 建议表 | 字段与约束 |
| --- | --- |
| upload_credentials | token_hash、tenant_id、权限、有效期/撤销状态；保存不可逆摘要 |
| agent_chat_sources | id、唯一 customer_id、唯一 license_key_id 或唯一 offline_key_id，提供稳定的聊天来源身份 |
| agent_conversations | tenant_id、installation_id、conversation_id 联合主键；revision、snapshot_json、received_at |
| agent_sync_events | tenant_id、installation_id、event_id 联合唯一；conversation_id、revision、payload_hash、accepted_at |

事务流程：鉴权并解析来源 → 校验 → 查询重复事件 → 锁定/原子比较 revision → 写入或忽略旧版 → 记录回执 → 提交 → ACK。会话/回执的 tenant_id 指稳定来源 ID，不是客户端自报的公司 ID。按密钥保留独立来源，绑定公司变化不移动会话和回执。旧独立令牌只能在同一客户内轮换，不得转交其他客户。

## 6. 本地路径与联调

以下相对于 `app.getPath('userData')/agent/`：

| 路径 | 用途 |
| --- | --- |
| settings.json | 模型设置与加密 API Key |
| sync-settings.json | 上传开关、endpoint 与加密上传凭证 |
| chat-sync/installation.json | 随机安装标识 |
| chat-sync/outboxes/\<scope hash\>.json | 按地址、鉴权类型与凭据摘要隔离；不保存密钥明文。旧版仅按地址保存的 Bearer 队列留在本机待核对，不自动上传 |
| state.json / conversations/ / attachments/ | 原有本地聊天和附件 |

切换服务器或凭据不搬移旧队列，也不在保存设置时自动把当前会话重新入队；切回原地址和原凭据可续传。用户之后主动打开或更新会话会按当前启用范围形成新快照。队列含待传聊天正文，是本机数据文件，不是系统加密数据库。配置损坏/令牌解密失败暂停同步并保留原文件；队列损坏不按空队列覆盖。

同一地址更换 Bearer 令牌后也不自动继承旧队列。面板显示待传会话数与起止时间；旧版无归属队列和其他凭据的队列只显示本地不透明标识及数量/时间，不显示正文。用户核对确属当前客户和接收方后，才能显式恢复该队列；恢复保留 eventId，同一会话版本冲突时拒绝并保留原文件。调度发送前重新检查本机授权配置，避免继续使用已移除的旧密钥；服务器每次上传再次校验当前有效性。

暂停会取消在飞请求并保留待传记录，重新开启恢复当前凭据队列。清理待传是独立的确认操作，不删除本机会话，也不撤回已送达内容；会话未来更新或主动打开仍可能产生新快照。首次及接收方/凭据变化后展示范围说明，记录说明版本与归属摘要；记录“已了解”不会改变同步开关，既有手动关闭继续保留。聊天保存目标为 180 天，服务端清理与删除流程需随部署验收，客户端说明不构成已部署证明。

联调至少覆盖：首次无同步配置自动上传、已有关闭选择保留、在线/离线鉴权、完整成功/失败任务、重复事件、迟到版本、断网/503 后重启续传、401 后换凭证、关闭时中止、跳转被拒、大请求、错误 ACK、不同客户会话隔离。仓库已有合成 HTTP 与真实 Electron/ASAR 夹具；实际服务端上线后还需 HTTPS、鉴权和可靠存储联调。

### 2026-09-23 生产接口重新连接

- 当前服务器与客户端字段、`License` 鉴权和 ACK 契约一致，无需修改上传代码。本机此前没有保存同步设置，已按用户要求启用，客户首次安装默认关闭的行为不变。
- 通过正式 `agentSyncSettings`、`chatSync` 和 Electron `net.fetch` 上传当前会话，67 条消息、30 条任务获得匹配回执；未批量扫描历史归档，也未上传附件原文件或采集库。
- 本次成功时间为北京时间 2026-09-23 11:35:54；待传、未落盘数量均为 0，无同步错误。客户端在无采集、回放及活跃 Agent 任务时正常关闭并重启，使后续会话沿已保存配置自动同步。
- 项目 Electron Node ABI 下的同步和主进程 30 项测试通过，覆盖鉴权隔离、失败重试、持久队列及错误 ACK。此次只有运行配置与文档更新，未运行全量构建或发布打包；未核验生产管理页和数据库原表。
