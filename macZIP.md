# mac ZIP 打包记录

## 时间

- 记录日期: 2026-03-21
- 目标版本: `1.1.3`

## 目标

生成一版可对外分发、可远程更新、已完成 `Developer ID` 签名和 Apple notarization 的 mac 安装包。

最终正式产物:

- `dist/Shroom-1.1.3-arm64-mac.zip`
- `dist/Shroom-1.1.3-arm64.dmg`
- `dist/latest-mac.yml`

## 本次遇到的问题

### 1. 打包后 Python 无法启动

现象:

- 日志报错 `spawn ENOTDIR`
- 后续连续报 `stdin write failed: worker not running`

根因:

- Python 运行时被错误打进了 `app.asar`
- `pyWorker` 在打包态误走了开发态路径，尝试执行 `app.asar/python/...`

处理:

- 打包态优先从 `Resources/python/onbed_server/onbed_server` 启动
- `python/**` 不再打进 `app.asar`
- 统一改为通过 `extraResources -> Resources/python` 分发

### 2. mac 签名 / 公证不稳定

现象:

- notarization 初次失败
- Python runtime 相关文件签名校验不过

根因:

- PyInstaller 产物里有框架符号链接
- 资源同步时如果把符号链接展开成普通文件，签名结构会被破坏

处理:

- `scripts/sync-pack-resources.js` 保留符号链接
- Python runtime 只打生成后的运行时，不打整份源码和 `venv`

### 3. zip 解压后打开即闪退

现象:

- 双击 `Shroom.app` 直接退出
- 崩溃日志出现:

```text
Fatal process out of memory: Failed to reserve virtual memory for CodeRange
```

根因:

- 手动重签名时丢失了 Electron 在 Apple Silicon 上启动所需的 entitlements
- 缺少 `allow-jit` 等权限，导致 Electron 主进程在 V8 初始化阶段崩溃

处理:

- 新增 `scripts/entitlements.mac.plist`
- 主 app 和 helper app 重签名时显式带上 entitlements

### 4. 别的电脑上运行时写入包内目录失败

现象:

- 其他 Mac 上启动时弹主进程错误
- 日志包含 `ENOENT` / `mkdir`
- 路径落在:
  - `AppTranslocation/.../Shroom.app/Contents/Resources/...`
  - 或 `app.asar/...`

根因:

- 打包态仍把运行时可写目录放在 `process.resourcesPath`
- 其他电脑从 zip 解压或被 App Translocation 运行时，包内目录是只读的
- 程序试图在只读目录里创建 `db/data/config.txt`，启动即报错

处理:

- 打包态资源读取仍走 `process.resourcesPath`
- 运行时写目录改为 `app.getPath('userData')`
- `db` 写入路径改到 `userData/db`
- CSV 导出路径改到 `userData/data`
- `config.txt` 默认也落到 `userData/config.txt`
- 如果包内存在只读 `config.txt`，首次启动会复制到可写目录再使用

### 5. 首次启动时 `init.db` 模板库查找路径错误

现象:

- 其他 Mac 上启动时报:
  - `init.db not found`
- 报错堆栈落在 `server/dbManager.js`

根因:

- `init.db` 实际被打进了 `Contents/Resources/db/init.db`
- 代码只查了:
  - `userData/db/init.db`
  - `Contents/Resources/init.db`
  - `app.asar/db/init.db`
- 少查了真正的打包路径 `Contents/Resources/db/init.db`

处理:

- `server/dbManager.js` 增加模板库候选路径:
  - `path.join(runtimeResourceRoot, "db", "init.db")`

验证:

- 最终 zip 内确认存在 `Shroom.app/Contents/Resources/db/init.db`
- 本地复制测试确认生成的 `probe.db` 与包内 `init.db` 完全一致

## 代码修改点

- `pyWorker.js`
  修正打包态 Python 路径解析，避免访问 `app.asar` 内的 Python

- `scripts/sync-pack-resources.js`
  同步 `pack-resources/python` 时保留符号链接

- `package.json`
  - 增加 `build-mac-release` 脚本
  - `mac` 配置增加:
    - `hardenedRuntime: true`
    - `gatekeeperAssess: false`
    - `entitlements`
    - `entitlementsInherit`
  - `extraResources` 只保留生成后的 Python runtime

- `scripts/build-mac-release.js`
  新增正式 mac 发版脚本，负责:
  - 构建前端
  - 构建 / 同步 Python runtime
  - 生成 `mac dir`
  - 重签名
  - notarization
  - stapling
  - 输出更新 zip
  - 输出可拖入 `Applications` 的 dmg
  - 生成 `latest-mac.yml`
  - 支持 `NOTARY_SUBMISSION_ID` 续跑

- `scripts/entitlements.mac.plist`
  增加 Electron arm64 启动必需权限:
  - `com.apple.security.cs.allow-jit`
  - `com.apple.security.cs.allow-unsigned-executable-memory`
  - `com.apple.security.cs.disable-library-validation`

- `licenseHelper.js`
  `config.txt` 优先使用 `userData` 可写路径，必要时从只读包内路径复制一份

- `server.js`
  打包态运行时写目录改为 `userData`，不再向 `Contents/Resources` 或 `app.asar` 写入。
  其中 mac 打包版的 CSV 导出目录单独改到桌面 `~/Desktop/data`

- `configManager.js`
  `DB_DIR` 基于 `APP_DATA_DIR`，mac 打包版的 `DATA_DIR` 改为基于桌面目录

- `server/dbManager.js`
  首启建库时补查 `Resources/db/init.db`

## 正式打包命令

不要把真实账号密码写进仓库，发版时通过环境变量传入:

```bash
APPLE_ID="你的 Apple ID 邮箱" \
APPLE_APP_SPECIFIC_PASSWORD="你的 app 专用密码" \
APPLE_TEAM_ID="你的 Team ID" \
npm run build-mac-release
```

如果 notarization 上传已成功，但轮询阶段断网，可以复用 submission 继续跑:

```bash
NOTARY_SUBMISSION_ID="Apple 返回的 submission id" \
APPLE_ID="你的 Apple ID 邮箱" \
APPLE_APP_SPECIFIC_PASSWORD="你的 app 专用密码" \
APPLE_TEAM_ID="你的 Team ID" \
npm run build-mac-release
```

如果只想做本地签名和启动验证，不走 Apple 公证:

```bash
SKIP_NOTARIZATION=1 \
APPLE_ID="你的 Apple ID 邮箱" \
APPLE_APP_SPECIFIC_PASSWORD="你的 app 专用密码" \
APPLE_TEAM_ID="你的 Team ID" \
npm run build-mac-release
```

## 最终验证结果

本次正式包已验证通过:

- `codesign --verify --deep --strict` 通过
- `spctl -a -t exec -vv dist/mac-arm64/Shroom.app` 返回:
  - `accepted`
  - `source=Notarized Developer ID`
- 实际启动 `dist/mac-arm64/Shroom.app`，应用可正常存活，不再闪退
- 包内 Python worker `ping` 正常
- 最终 app 启动日志确认:
  - `resourceRoot` 仍为 `Contents/Resources`
  - `writableRoot` 已切换为 `~/Library/Application Support/shroom`
  - `db` 实际写入 `~/Library/Application Support/shroom/db`
  - `configCandidates` 首选 `~/Library/Application Support/shroom/config.txt`

## 远程更新文件

mac 客户端远程更新只需要上传:

- `dist/Shroom-1.1.3-arm64-mac.zip`
- `dist/latest-mac.yml`

服务器目录当前配置为:

- `http://sensor.bodyta.com/shroom1`

## 产物说明

- `dist/Shroom-1.1.3-arm64-mac.zip`
  正式可发给用户、可用于远程更新的 mac 包

- `dist/latest-mac.yml`
  `electron-updater` 的 mac 更新描述文件

- `dist/Shroom-1.1.3-arm64-mac-notary.zip`
  提交 Apple notarization 用的中间包，不需要上传给用户

- `dist/mac-arm64/Shroom.app`
  本地签名、公证、启动验证使用的 app bundle

## 下次发版注意事项

### 1. 不要长期复用同版本号覆盖

虽然本次仍然是 `1.1.3`，但如果旧的坏包已经发出去，下一次正式发布建议直接升到 `1.1.4`，避免客户端和服务器缓存混淆。

### 2. Windows 流程不走这套 mac 脚本

- Windows 仍然走 `npm run build`
- mac 正式发版走 `npm run build-mac-release`

### 3. Python 运行时必须先存在

如果清过 `python/dist/onbed_server`，先执行:

```bash
python/venv/bin/python python/build_exe.py
```

再执行 mac 正式打包。

### 4. 默认不要把 `config.txt` 打进安装包

推荐保持当前策略:

- `config.txt` 不参与打包
- 用户授权文件运行时写入 `userData/config.txt`

这样更适合:

- 多机器分发
- App Translocation 场景
- 后续自动更新

## 本次结论

本次 mac 正式包的关键修复不是业务代码，而是打包结构和签名链:

1. Python runtime 不能放进 `app.asar`
2. PyInstaller 的符号链接必须保留
3. Electron arm64 重签名必须带 JIT entitlements
4. 公证通过后还需要 stapling，才能作为正式可发版本交付
