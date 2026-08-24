---
name: sync-sensor-type
description: 桌面端新增（或调整归属）传感器系统后，把分类授权注册表同步到发证服务 E:\key，并完成校验、提交与上线核对。当用户提到「新增传感器类型/系统」「加了个新系统要能发证」「同步注册表到发证服务」「新系统在后台选不到」时使用。
---

# 新增传感器系统 → 同步到发证服务

## 这个 skill 管什么

只管**授权链路**：让新系统能出现在发证后台的分类里、能被密钥授权、能被客户端解锁。

**不管**新系统本身的实现（串口协议、系统切换、渲染、采集回放、CSV）。那部分见
`docs/license-server-modification-guide.md` §8 第 1 步，必须先完成，再走这个 skill。

两个仓库：

- 桌面端 `E:\shroom1`（本仓库）—— 注册表的**源头**
- 发证服务 `E:\key`（key-manager）—— 消费方

## 铁律

1. **同步只走 git 改文件，没有 HTTP 上传接口。** 发证服务刻意不提供「客户端运行时上传注册表」的
   接口（guide §11），不要去找、也不要新加。
2. `E:\key\config\licenseSensorGroups.json` **只能由第 5 步的同步命令写入**，不要手改、不要复制粘贴。
3. `E:\key\shared\crypto-lib.cjs` 里 `BEGIN/END GENERATED REGISTRY SNAPSHOT` 之间的内容
   **只能由 `pnpm registry:snapshot` 生成**，不要手改。
4. `value` 是协议字段，**只增不改名**；同一个 `value` 不能同时属于两个分类（注册表校验会拒绝）。
5. **上线顺序：先发证服务，再桌面端。** 反了会出现「客户端认识新系统但服务端展开不出来」。
6. 不要在服务器上直接改 `config/licenseSensorGroups.json` —— 部署流程里有
   `git reset --hard origin/main`，手改会被下次部署静默覆盖。

## 开工前先确认这几项

没确认就别往下走，这几个值一旦发布就很难改：

- `value`：系统 key，如 `newSystem`
- `groupKey`：归属分类，只能是 `common` / `care` / `lab` / `custom` / `precision` 之一
- 中文名 / 英文名 / 日文名

如果是**把已有系统从一个分类挪到另一个分类**：这会让旧的原分类密钥**失去**该系统（授权范围缩减），
属于高风险变更，先跟用户确认再动手。

## 步骤

### 1. 桌面端注册表

`E:\shroom1\licenseSensorGroups.json` —— 在目标分类的 `items` **末尾追加**（追加而非插入，
避免既有系统的顺序变化）：

```json
{ "labelKey": "sensorNewSystem", "value": "newSystem" }
```

### 2. 桌面端 i18n

- `client/src/i18n/resources.js`：`sensorNewSystem: text('新系统', 'New System'),`
- `client/src/i18n/ja.js`：`"sensorNewSystem": compare("新系统", "新システム"),`

按周边条目的现有写法和位置插入，不要重排文件。

### 3. 桌面端选择器与断网兜底

- `client/src/components/title/Title.jsx`：系统切换列表 `allSensorArr`，加
  `{ label: t('sensorNewSystem'), value: 'newSystem' }`
- `sensorTypeStore.js` 的 `BUILTIN_GROUPS`：对应分组的 `items` 追加 `{ label: '新系统', value: 'newSystem' }`。
  这是断网首次安装、无缓存时的兜底清单，漏了会导致离线环境下看不到新系统。

### 4. 校验桌面端注册表

```bash
cd /e/shroom1
node -e "require('./licenseScopes')"        # 注册表非法会直接抛错
npx vitest run test/licenseScopes.test.js   # 若该测试文件存在
```

### 5. 同步到发证服务

```bash
cd /e/shroom1 && node scripts/sync-license-registry.cjs /e/key/config/licenseSensorGroups.json
```

**记下输出里的 `sha256`**，第 6 步要对。

### 6. 发证服务侧

```bash
cd /e/key
pnpm registry:snapshot
```

它会：重算 SHA-256 → 更新 `shared/crypto-lib.cjs` 的内联快照和 sha256 注释 → 检查
`shared/licenseScopes.ts` 的 `SENSOR_LABELS` 是否覆盖了每个系统。

如果报 `SENSOR_LABELS 缺少 N 个系统的中文名`，按提示在 `shared/licenseScopes.ts` 的
`SENSOR_LABELS` 里补一行（放在对应分类的注释段下），然后**再跑一次** `pnpm registry:snapshot`。
不补也能跑，但后台密钥列表、生成页、飞书审批卡片都会把裸 key 当中文名显示出来。

```bash
pnpm check && pnpm test
```

必须全绿。`server/cryptoLibParity.test.ts` 专门锁死两份注册表逐字一致 —— 它红了就说明
第 5、6 步有一步没做完。

最后核对 `registry:snapshot` 打印的 `sha256` 与第 5 步一致。

> 别用 `sha256sum` 直接比两个工作副本文件。Windows 上 `core.autocrlf` 会让工作副本变 CRLF，
> 哈希与 Linux 生产环境不同。`E:\key` 已用 `.gitattributes` 把注册表钉成 LF，
> 以 `registry:snapshot` 的输出为准。

### 7. 两个仓库分别提交

不要跨仓库混提交。发证服务侧的改动应当**只有**这三个文件：

```
config/licenseSensorGroups.json
shared/crypto-lib.cjs
shared/licenseScopes.ts        # 只有补了中文名才会变
```

出现别的文件说明跑偏了，先查清楚。

### 8. 上线

先发证服务，再桌面端。发证服务重启后核对日志：

```
[License] 注册表已加载（.../config/licenseSensorGroups.json）：5 个分类 / N 个系统，sha256=...
[Init] Sensor types reconciled to authoritative list: +1 inserted, ...
```

`N` 和 `sha256` 要与第 6 步一致。数据库 `sensorTypes` 表由服务启动时幂等自愈，
**不需要写迁移、不需要手动改库**。

### 9. 上线后验收

- `GET /sensorTypes` → `flat` 里有 `newSystem`，`map.newSystem` 是中文名
- 拿一枚**旧的、未过期的** `@group:<该分类>` 密钥，在新版客户端确认能看到 `newSystem`
  —— 这是整套 v3 分类授权机制的核心验收点，必须做
- 拿一枚旧的**固定数组**密钥，确认它**不会**越权拿到 `newSystem`

## 常见坑

| 现象 | 原因 |
| :--- | :--- |
| `cryptoLibParity.test.ts` 红 | 改了注册表但没跑 `pnpm registry:snapshot` |
| 后台把 `newSystem` 当名字显示 | `SENSOR_LABELS` 没补中文名 |
| 两端 sha256 对不上 | 在 Windows 上比了 CRLF 工作副本，见第 6 步注 |
| 新客户端能选、服务端不认 | 上线顺序反了，先发的客户端 |
| 服务器上改完过一阵又没了 | 部署会 `git reset --hard`，必须走 git |
| 旧分类密钥突然少了个系统 | 有人把系统挪了分类，属授权范围缩减 |

## 别做

- 不要为了让某个客户多拿一个系统就改分类归属 —— 那会影响所有持有该分类密钥的客户
- 不要重命名已发布的 `value`
- 不要把新系统同时塞进两个分类
