# Mac 打包与更新发布流程

这份文档描述当前仓库正式 mac 发版的完整链路，起点从 `update` 准备开始，一直到产物上传后客户端自动更新生效。

适用范围:

- 正式 mac 发版命令: `npm run build-mac-release`
- 内部分发测试命令: `npm run build-mac-share`
- 当前更新源: `http://sensor.bodyta.com/shroom1`

不适用范围:

- Windows 打包流程
- 开发态调试流程

## 1. Update 阶段

正式发版前，先把更新相关输入准备好。这个项目的 mac 自动更新不是只看版本号，它依赖版本号、发布说明和更新服务器上的元数据一起工作。

需要确认的内容:

1. 更新应用版本号  
   在根目录 `package.json` 中修改 `version`。

2. 补充本次发布说明  
   默认新建或更新 `release-notes/windows/<version>.md`。  
   mac 正式打包会优先复用这份 Windows 发布说明写入 `latest-mac.yml`，只有历史版本缺少 Windows 说明时才回退到 `release-notes/mac/<version>.md`。

3. 确认更新源地址  
   `package.json > build.publish` 当前配置的是 generic provider:

   ```json
   {
     "provider": "generic",
     "url": "http://sensor.bodyta.com/shroom1"
   }
   ```

4. 确认本次代码和前端资源都已准备好  
   正式发版脚本会重新构建前端和同步打包资源，所以这里不需要手动产出 `build/`，但要确保仓库内容已经是准备发布的状态。

## 2. 发版前提

`build-mac-release` 只能在 macOS 上执行，并依赖本机已有签名和公证环境。

需要具备:

- `Developer ID Application` 证书，且私钥已导入当前钥匙串
- Xcode Command Line Tools，可用到 `codesign`、`xcrun`、`stapler`、`spctl`、`hdiutil`、`ditto`
- Node 依赖已安装
- Python 打包环境可用

Python 相关说明:

- 脚本会优先复用现成的 `python/dist/onbed_server`
- 如果运行时过期或不存在，会自动尝试重新构建
- 构建时要求 Python 3.11，且能导入 `numpy` 和 `PyInstaller`

公证凭据支持三种方式，满足任意一种即可:

1. `APPLE_KEYCHAIN_PROFILE` 或 `NOTARYTOOL_PROFILE`
2. `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`
3. `APPLE_API_KEY` + `APPLE_API_KEY_ID` + 可选 `APPLE_API_ISSUER`

如果机器上有多个签名身份，也可以显式传 `CSC_NAME`。

## 3. 正式打包主流程

正式命令:

```bash
APPLE_KEYCHAIN_PROFILE="your-notary-profile" \
npm run build-mac-release
```

如果不用 keychain profile，也可以用 Apple ID 方式:

```bash
APPLE_ID="you@example.com" \
APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx" \
APPLE_TEAM_ID="TEAMID" \
npm run build-mac-release
```

脚本内部的实际执行顺序如下。

### 3.1 构建前端

先执行:

```bash
npm run build-client
```

这一步会重新生成根目录 `build/`，保证 Electron 打包进去的是最新前端资源。

### 3.2 准备 Python runtime

脚本会检查 `python/dist/onbed_server` 是否新鲜。

- 如果已是最新，直接复用
- 如果不是最新，自动执行 `python/build_exe.py` 重新构建

最终目标是让打包态使用 `Resources/python/onbed_server/...`，而不是访问 `app.asar` 里的 Python 源码。

### 3.3 同步打包资源

执行:

```bash
node scripts/sync-pack-resources.js
```

这一步会把下面两类资源同步到 `pack-resources/`:

- `db/init.db` -> `pack-resources/db/init.db`
- `python/dist/onbed_server` -> `pack-resources/python/onbed_server`

其中 Python runtime 的符号链接会被保留，避免后续签名结构被破坏。

### 3.4 先用 electron-builder 产出未签名 app

执行:

```bash
npx electron-builder --mac dir --publish never
```

这里故意只产出 `mac dir`，不直接让 `electron-builder` 完成整套签名和发布。原因是这个项目对签名链、Python runtime 和更新文件有额外控制，所以后续由 `scripts/build-mac-release.js` 接手。

产物位置通常是:

```text
dist/mac-arm64/Shroom.app
```

### 3.5 写入包内更新配置 `app-update.yml`

脚本会在应用内部生成:

```text
Shroom.app/Contents/Resources/app-update.yml
```

内容来自 `package.json > build.publish`，主要告诉打包后的客户端去哪个更新服务器拉取 `latest-mac.yml`。

这个文件是客户端运行时用的。

### 3.6 手动重签名

脚本会对 `Shroom.app` 内部的可执行文件、framework、xpc、runtime 资源逐层签名，然后再对整个 `.app` 做最终签名。

关键点:

- 使用 `Developer ID Application` 身份
- 主 app 和需要 runtime 的 bundle 会带 `scripts/entitlements.mac.plist`
- 先签内部，再签外层 app

签名完成后会执行:

```bash
codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Shroom.app
```

如果这里只是想做本地签名验证，不走 Apple 公证，可以这样执行:

```bash
SKIP_NOTARIZATION=1 \
APPLE_KEYCHAIN_PROFILE="your-notary-profile" \
npm run build-mac-release
```

### 3.7 公证 app，并回贴 stapler

脚本会先把 `.app` 打成一个仅用于提交公证的 zip:

```text
dist/Shroom-<version>-arm64-mac-notary.zip
```

然后执行:

1. `xcrun notarytool submit`
2. `xcrun notarytool wait`
3. `xcrun stapler staple dist/mac-arm64/Shroom.app`
4. `spctl -a -t exec -vv dist/mac-arm64/Shroom.app`

如果 `wait` 阶段断网，但 submit 已成功，可以复用 submission id 续跑:

```bash
NOTARY_SUBMISSION_ID="<submission-id>" \
APPLE_KEYCHAIN_PROFILE="your-notary-profile" \
npm run build-mac-release
```

### 3.8 生成更新 zip

在 app 已签名并完成 stapling 后，脚本会重新打出正式更新包:

```text
dist/Shroom-<version>-arm64-mac.zip
```

这个 zip 才是给 `electron-updater` 使用的正式 mac 更新包。

### 3.9 生成 DMG，并单独公证

脚本会临时创建一个 DMG staging 目录，把 `.app` 和 `/Applications` 链接放进去，再执行 `hdiutil create` 生成:

```text
dist/Shroom-<version>-arm64.dmg
```

随后会对 DMG 再做一次单独公证和 stapling。

如果 DMG 的公证已 submit 成功，也可以通过 `DMG_NOTARY_SUBMISSION_ID` 续跑。

### 3.10 生成 `latest-mac.yml`

最后脚本会读取正式更新 zip，计算:

- 文件名
- `sha512`
- 文件大小
- `releaseDate`
- `releaseNotes`

并生成:

```text
dist/latest-mac.yml
```

其中 `releaseNotes` 默认来自 `release-notes/windows/<version>.md`，旧版本缺失时才回退到 `release-notes/mac/<version>.md`。

这个文件是更新服务器对客户端暴露的入口元数据。

## 4. 最终产物与用途

正式 mac 发版完成后，核心产物如下:

- `dist/Shroom-<version>-arm64-mac.zip`
  用于客户端自动更新，也可以作为 zip 分发包

- `dist/latest-mac.yml`
  `electron-updater` 读取的 mac 更新描述文件

- `dist/Shroom-<version>-arm64.dmg`
  给用户手动下载安装的标准 mac 安装介质

- `dist/Shroom-<version>-arm64-mac-notary.zip`
  仅用于提交 app 公证的中间产物，不需要上传给用户

- `dist/mac-arm64/Shroom.app`
  本地验证签名、公证、启动问题时使用

## 5. 发布到更新服务器

如果目标是让已安装的 mac 客户端收到自动更新，至少要上传这两个文件到更新源目录:

- `dist/Shroom-<version>-arm64-mac.zip`
- `dist/latest-mac.yml`

当前仓库配置下，上传位置对应:

```text
http://sensor.bodyta.com/shroom1
```

如果只想给用户一个手动安装包，再额外上传 DMG 即可。

## 6. 客户端收到更新的运行流程

服务端文件上传完成后，打包版客户端会按下面的链路生效。

1. 应用启动后，`index.js` 只在 `app.isPackaged` 时初始化 `AppUpdater`
2. `AppUpdater.startAutoCheck()` 在启动 30 秒后做第一次检查，之后每 4 小时检查一次
3. 客户端通过包内的 `app-update.yml` 知道更新服务器地址
4. `electron-updater` 从服务器读取 `latest-mac.yml`
5. 如果发现更高版本，就把 `version`、`releaseDate`、`releaseNotes` 推送给前端
6. 前端 `UpdateNotifier.jsx` 弹出“发现新版本”通知
7. 用户点击下载后，主进程执行 `downloadUpdate()`
8. 下载进度通过 IPC 通道 `update-status` 持续推送给前端
9. 下载完成后，主进程提示用户是否立即安装；若确认，则执行 `quitAndInstall(false, true)`

对应 IPC:

- 前端 -> 主进程: `update-command`
- 主进程 -> 前端: `update-status`

## 7. 相关文件分工

- `package.json`
  版本号、`build.publish`、mac 打包配置、脚本入口

- `scripts/build-mac-release.js`
  正式 mac 发版主脚本，串起构建、签名、公证、DMG、`latest-mac.yml`

- `scripts/build-mac-share.js`
  只用于内部测试分发的 adhoc zip 流程，不是正式更新发布流程

- `scripts/sync-pack-resources.js`
  同步 `db` 和 Python runtime 到 `pack-resources/`

- `scripts/entitlements.mac.plist`
  mac Electron 运行和重签名需要的 entitlements

- `autoUpdater.js`
  主进程自动更新逻辑

- `preload.js`
  暴露 `update-command` / `update-status` IPC 能力

- `client/src/components/updater/UpdateNotifier.jsx`
  前端更新提示、下载进度、安装按钮

- `release-notes/windows/<version>.md`
  当前版本的统一更新说明，Windows 和 mac 打包都会优先使用这份内容

## 8. 内部分发测试流程

如果只是把 app 发给另一台 Mac 测试，不想走完整正式发版链路，可以用:

```bash
npm run build-mac-share
```

这个流程会:

1. 执行 `prepare-build-assets`
2. 用 `electron-builder --mac zip --publish never` 生成 app
3. 用 ad-hoc 方式补签名
4. 输出 `dist/*-mac-adhoc.zip`

注意:

- 这不是正式公证发布流程
- 不适合作为自动更新源
- 收包方仍可能遇到系统安全提示

## 9. 一次正式发版的最小操作清单

1. 修改 `package.json` 版本号
2. 新建 `release-notes/windows/<version>.md`
3. 确认更新源地址无需调整
4. 执行 `npm run build-mac-release`
5. 验证 `dist/` 下 zip、dmg、`latest-mac.yml` 已生成
6. 上传 `*-mac.zip` 和 `latest-mac.yml` 到更新服务器
7. 如需手动下载安装，再上传 DMG
