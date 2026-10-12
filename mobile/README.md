# Shroom iPad 数据展示原型

第一阶段面向 iPad Air 11 英寸 M3、CH340 USB 串口和32×32/1024点压力矩阵。React Native 管理连接与生命周期，WebView 复用现有前端 SDK 的热力图及数字矩阵。

## 当前验证状态

已验证压力帧契约、切源/重连清理、有界 RN→WebView 数据桥、离线 HTML 的真实浏览器画布、iOS JavaScript 导出及类型检查。演示数据必须手动开启，始终标为“演示”，经过与真实数据相同的展示桥。

原生 CH340 USB 收数代码与 DriverKit 工程位于 `modules/shroom-usb/`、`driverkit/`。**当前 Windows 环境无法完成 Xcode 编译、Apple 签名或 iPad USB 真机测试，源码原型不代表真实 USB 已通。** Mac 端接入说明及验收步骤见 [driverkit/README.md](driverkit/README.md)。

## 数据链路

```text
CH340 USB → DriverKit CH340 / UserClient
  → iOS 原生模块（串行读、AA550399 分帧、1024 个 uint8）
  → pressure.frame（最多30Hz发布最新帧）
  → RN FrameDispatcher（最多一帧在途、一帧待发）
  → 离线 WebView → 既有 SDK RendererHost → 热力图 / 原始数字
```

协议来自仓库 `sdk/backend/protocol/presets/standard-1024.json`。默认波特率1000000，当前驱动范围115200–1000000；USB 芯片本身不能确定传感器数据协议。矩阵按接收点序显示，本阶段没有自动推断物理线序、压力标定、桌面算法、存储或授权迁移。

## 安装与开发

需要 Node 22.13或更高版本；当前采用 Expo SDK57、React Native0.86。先在仓库根目录执行 `npm --prefix client ci --ignore-scripts` 安装网页构建依赖，再在 `mobile/` 中执行：

```sh
npm ci
npm start
```

`prestart` 会先构建移动显示页。Vite 产物写入系统临时目录，最终离线 HTML 写入 Git 忽略的 `generated/display.ts` 供 Metro 打包；不覆盖仓库桌面 `build/`，没有本机 HTTP/WS 服务或远程页面依赖。

Expo Go 可检查演示数据和展示界面，不能读取自定义 DriverKit USB 模块。真实 USB 必须使用已嵌入驱动并正确签名的 iPad 应用；首次安装后要在 iPad 设置中启用驱动。

## 验证命令

```sh
# 移动端数据桥与类型检查
npm test
npm run typecheck
npm run lint
npm run build:display

# 从仓库根目录验证宿主注入和离线显示页面
node client/tests/mobile-host-bridge.browser.mjs
node client/tests/mobile-display.browser.mjs --generated-html mobile/generated/display.ts

# 根项目要求的验证入口
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-changed.ps1 -Mode Full
```

iOS JS 包验证：`npm run export:ios -- --output-dir <系统临时目录>`。它仅证明 Metro/Hermes 打包通过，不会编译原生模块或制作可安装 IPA。

Windows 不能执行 iOS prebuild。换到 Mac 后安装 Xcode26.4或更高版本，在 `mobile/` 设置 `SHROOM_APPLE_TEAM_ID` 并运行 `npm run prebuild:ios`，随后在生成的 workspace 中选择签名 profile 和真实 iPad。具体步骤见驱动说明。

## 接入行为

- 先刷新 USB，选择已注册的 CH340 驱动服务，再配置波特率连接。缺驱动、设备、权限及签名错误都会显示具体原因。
- 无合法压力帧时显示等待；超过2秒无新帧显示暂停。网页只接受1024个0–255整数，坏帧不覆盖上一合法画面。
- 停止、切源或设备断开会清除旧画面；切后台主动断开，返回后重新连接。应用前台显示时保持屏幕唤醒。
- 每次USB连接有独立连接ID，旧连接的迟到帧/状态不能恢复画面；页面就绪握手可重复发送而不清除在途数据。
- 原生读与显示解耦，桥只保留最新待发帧，不用于逐帧采集存储。数字与热力图使用相同原始行列顺序。

本阶段仅加入独立移动入口，桌面 Electron 启动、授权和发布链路仍由原有代码提供。
