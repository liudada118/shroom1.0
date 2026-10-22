# Agent 服务商与模型目录

客户端通过公开接口读取“模型服务商”和“模型名称”选项。服务器更改目录后，兼容客户端可刷新获得新选项，无需重新打包。已有连接仍由客户自己保存，不因目录变化自动切换地址或模型。

## 接口

`GET https://shroom.jq-industries.com/api/agent/model-catalog`

不传软件密钥、模型 API Key、聊天内容或 Cookie；响应直接为以下 JSON，不包在 `data` 中：

```json
{
  "schemaVersion": 1,
  "version": "2026-10-20.1",
  "providers": [
    {
      "id": "example",
      "label": "示例兼容服务",
      "baseUrl": "https://api.example.com/v1",
      "defaultModel": "model-a",
      "hint": "请使用该服务商的 API 密钥。",
      "models": [{ "id": "model-a", "label": "模型 A" }]
    },
    {
      "id": "custom",
      "label": "自定义地址／中转站",
      "baseUrl": "",
      "defaultModel": "model-a",
      "models": [{ "id": "model-a", "label": "模型 A" }]
    }
  ]
}
```

示例域名及模型只用于说明字段，不代表实际服务。目录里的接口必须支持现有 Responses API、流式输出和函数工具调用；新增目录项不等于新增了一种模型协议。

| 字段 | 约束 |
| --- | --- |
| `schemaVersion` | 固定为 `1`；不支持的结构不会替换缓存 |
| `version` | 1–100字符的版本标识，变更时由维护者修改 |
| `providers` | 1–32项，ID唯一；必须有一个 `custom` |
| 服务商 `id` | 1–40字符，小写字母开头，后续仅小写字母、数字、`_`、`-` |
| `label` | 服务商和模型显示名，各1–100字符 |
| `baseUrl` | 最长1000字符，HTTPS基础地址，不含账号密码、查询参数或片段；不要追加 `/responses`；`custom` 必须为空 |
| `models` | 每服务商1–100项，模型ID在该服务商内唯一，模型ID最长120字符 |
| `defaultModel` | 必须是该服务商 `models` 中一个模型ID |
| `hint` | 可选纯文本，最长500字符；不支持HTML |

文本不能包含控制符。响应最大128KiB；不允许配置任何API密钥、员工令牌或其他私密字段。服务端配置无效时返回503及有限错误码，客户端继续使用默认/缓存；服务器不回传文件内容和绝对路径。

## 客户端行为

- 打开模型设置时读取目录，正常自动刷新间隔为6小时；“刷新模型列表”立即请求接口，并发刷新共用一个请求。
- 成功后将经过校验的公开目录写入 `userData/agent/model-catalog.json`，下次启动可离线使用。首次无缓存时使用随包 `shared/agent-model-catalog.json`。
- 请求最多等待5秒，HTML、超限、非法JSON、网络失败或不兼容结构均保留最近有效选项；不影响已配置模型的聊天。
- 更新目录只更新下拉选项。正在编辑和已保存的服务地址、模型ID不会被远程静默替换；移除的旧连接可继续按自定义填写。
- 只有明确选择另一服务商时才回填其地址及默认模型，并清空本次输入的API密钥。地址变化仍需填写新Key，不复用旧地址凭据。
- 主进程 `getModelCatalog` 只接受 `refresh` 布尔参数，网页不能借该动作任意指定请求地址，也不会启动Agent模型任务。

缓存是公开元数据，不进入聊天或模型输入。目录提供候选项，模型实际可用性仍由客户的API账户权限决定。

## 服务端维护与首次交付

现有授权服务源码位于 `E:/key`。新增路由模块 `server/agentModelCatalog.ts`；默认文件 `config/agent-model-catalog.json` 与客户端随包默认清单一致，部署构建会复制该文件。无需数据库迁移。

生产可设置 `SHROOM_AGENT_MODEL_CATALOG_PATH=/data/agent/model-catalog.json`，将配置放在发布目录之外。先将完整合法JSON写到临时文件，再同目录原子替换正式文件；服务每次请求重新读取，无需重启或重打客户端。配置路径属于服务端部署设置，客户端不需要填写。

新增模型时，修改对应服务商的 `models`；新增服务商时，新增整项及其默认模型；同步更新 `version`，保留 `custom`。HTTP响应使用 `Cache-Control: no-cache`，代理不得长期缓存这一路径。具体服务端校验和发布步骤见 `E:/key/docs/agent-model-catalog.md`。

首次上线需要部署新的授权服务路由，并让客户安装一次包含目录读取能力的客户端；只有网页更新无法增加旧主进程缺少的IPC动作。完成这次交付后，兼容服务商和模型列表的增删改只需更新服务端配置。本次源码实现和隔离测试不代表生产接口已部署。
