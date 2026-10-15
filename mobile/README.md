# Shroom iPad 应用

当前面向 iPad Air 11 英寸 M3、CH340 USB 串口和32×32/1024点压力矩阵。首页、系统选择和采集运行页沿用原版 Shroom 的布局、品牌及页面组件；React Native 管理连接与生命周期，离线 WebView 显示三维点图、热力图和原始数字。

## 当前页面与功能范围

- 首页保留 Shroom Vision 品牌、粒子场景、分类和系统列表入口；系统选择页保留分类、搜索、系统清单、预览及进入/返回。
- 10 个预览模型随离线页面打包，预览明确标为非实时数据。当前只有 `hand`（32×32 CH340 压力矩阵）可进入实时运行页；其他原版系统保留目录与预览，标明尚未适配，不能套用同一 USB 协议进入采集。
- 运行页使用原版会话栏、实时观测、中央画布与快捷工具。点击“连接设备”打开设备弹窗，再刷新 USB、选择 CH340、设置波特率并连接；“停止”和显式演示入口也在该弹窗中。原生宿主不再重复显示标题或 USB 工具栏。
- 三维点图、热力图和原始数字共用真实压力帧，切换展示不重新连接设备。只有合法 USB 帧到达才显示正在收数，演示来源持续单独标识。
- 运行页“调节”修改当前画布参数：三维有色带上限、高度、空间/时间平滑、单点过滤和总值门槛；热力图有色带、半径和过滤；原始数字只调色带，保持读数。底部切换视图，参数在本次运行页内分别保留；恢复默认只作用于当前视图。滑块即时生效，数值框失焦或回车后应用，暂停收数也能调整最后一帧。
- 用户已确认本轮先恢复页面与 USB 收数。密钥授权、采集保存、历史回放和算法后续接入；页面禁用相应操作或说明不可用，不把实时连接冒充已保存采集，也不显示虚假的授权或算法结果。

## 当前验证状态

2026-10-13 线序/调参修正版：客户端全量858项、后续小数输入修正7项（含新增2项）、移动18项及类型/lint检查通过；最终离线浏览器验证非对称线序、三种视图实际调参、断流后恢复与逐字输入小数。Full因缺少PowerShell仍未执行。修正版开发IPA已核验签名、profile并安装启动到目标iPad；用户随后确认“线序与调节都正常”，本次两项修复通过真机验收。此前用户确认基本收帧的历史仍保留。

2026-10-13 三页界面对齐：移动端18项测试、客户端190项测试、移动端类型检查和 lint 已通过；宿主命令校验、状态同步以及网页重载停止已有回归覆盖。本机缺少 PowerShell，仓库 Full 入口未能运行。**本轮界面开发 IPA 已导出并通过最终签名/profile 核验，已在目标 iPad 安装并启动；用户已确认“页面已恢复，USB 帧数正常增加”，新版页面与真实 USB 基本收帧联动通过验收。下述记录保留此前驱动修正版的验证历史。**

已验证压力帧契约、切源/重连清理、有界 RN→WebView 数据桥、离线 HTML 的真实浏览器画布、iOS JavaScript 导出及类型检查。演示数据必须手动开启，始终标为“演示”，经过与真实数据相同的展示桥。

原生 CH340 USB 收数代码与 DriverKit 工程位于 `modules/shroom-usb/`、`driverkit/`。**此前驱动修正版的 Release 开发签名归档及 IPA 导出已通过，并已在目标 iPad 安装和启动；用户已确认真实 CH340 数据接收中且帧数增加。** Mac 端接入说明及验收步骤见 [driverkit/README.md](driverkit/README.md)。

2026-10-13 用户已在真机确认驱动开关出现且开启，但接入CH340仍提示未找到运行中的驱动。根据Mac读取的实际USB描述符补齐接口匹配表中的配置号1，并重新签名导出修正版。用户随后确认“USB 数据接收中，帧数增加”，驱动启动及基本收帧通过真机验收；长时间稳定性、拔插恢复及物理点位对应仍待验证。

2026-10-12 Mac 验证：修复工程生成后，Xcode 可识别宿主与驱动 target；DriverKit arm64 未签名构建、宿主 Objective-C++ 的 iOS SDK 语法检查通过。完整 RN/Swift 应用、签名及安装尚未完成；本机 Xcode26.3低于 SDK57要求，CocoaPods 安装遇到 Homebrew 错误，且尚无 iOS 签名证书或 DriverKit profile。

2026-10-13 Mac 进展：安装 Xcode26.6、iOS 平台组件和 CocoaPods1.17.0，完成89个Pods集成；修正 Swift 对 Objective-C throwing 方法返回值的可选绑定后，完整 RN/Swift/DriverKit Release 开发签名归档及 Xcode `debugging` IPA 导出成功。最终包内宿主与驱动的签名、同团队开发证书、目标 iPad 授权和 entitlement 已核对；应用携带离线展示资源，不依赖 Metro。移动端11项测试、类型检查、lint、C++协议测试及两个离线浏览器测试通过；本机缺少 PowerShell，仓库 Full 入口未能运行。目标iPad已安装并由devicectl成功启动，后续查询确认进程存在；真机界面交互、驱动启用及USB连续收数仍待验收。

## 数据链路

```text
CH340 USB → DriverKit CH340 / UserClient
  → iOS 原生模块（串行读、AA550399 分帧、1024 个 uint8）
  → pressure.frame（最多30Hz发布最新帧）
  → RN FrameDispatcher（最多一帧在途、一帧待发）
  → 离线 WebView 校验 → hand USB 线序（jqbed）→ 共用帧总线
  → 原版点图 / SDK RendererHost → 三维点图 / 热力图 / 原始数字
```

网页以白名单 `usb.command` 请求刷新、连接、停止或演示；RN 校验命令大小、请求标识、设备标识和波特率后执行，并通过 `host.state` 同步设备、来源及状态。`pressure.frame` 及原有 ACK 背压契约不变；网页先安装宿主状态入口，再通知压力桥就绪。

协议来自仓库 `sdk/backend/protocol/presets/standard-1024.json`。默认波特率1000000，当前驱动范围115200–1000000；USB 芯片本身不能确定传感器数据协议。当前唯一可运行的 `hand` 系统对 USB 帧应用与桌面 `jqbed` 等价的线序：显示行取原始行 `15…31,14…0`，列不变，仅在发布到帧总线前转换一次。演示帧已经是显示坐标，不重排；原始统计与 ACK 不变。物理角点及安装方向仍须真机确认，不自动推断其他传感器线序，也未迁移压力标定、桌面算法、存储或授权。

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

### Mac 打包前准备

1. 用 `xcodebuild -version` 确认 Xcode 至少为26.4；SDK57的版本要求见 [Expo 官方表](https://docs.expo.dev/versions/latest/)。安装命令行工具不能替代完整 Xcode。
2. 安装 CocoaPods（例如 `brew install cocoapods`）。缺少签名时可先运行 `npm run prebuild:ios -- --no-install` 生成未签名工程；这个命令不安装 Pods、不编译原生代码，也不生成 IPA。
3. 在 Xcode 登录 Apple Developer 账号，准备 iOS 开发证书、宿主应用 profile 和 DriverKit profile。macOS 的 `Developer ID Application` 证书不能用于签名 iPad 应用。
4. 设置真实 `SHROOM_APPLE_TEAM_ID` 后再次执行 `npm run prebuild:ios`，打开 `ios/Shroom.xcworkspace`，分别配置 `Shroom` 和 `ShroomCH340` 的签名。连接已信任且开启开发者模式的 iPad，再构建运行；分发 IPA 另需对应分发证书、profile 和导出方式。

当前 USB 版没有关闭 DriverKit 的构建开关。自己的iPad可先走付费账号公开的development能力，无需等待USB分发审批；仍须配置证书、profile及匹配的开发entitlements。门户“No App IDs are available”的处理、开发/分发配置差异见 [驱动签名准备](driverkit/README.md#签名准备)。

开发设备打包时，在prebuild前同时设置`SHROOM_APPLE_TEAM_ID`和`SHROOM_DRIVERKIT_DEVELOPMENT=1`。驱动将使用独立的开发权限文件；Release构建也可用于开发设备，但不能因此作为商店或Ad Hoc分发包。

本机 Node22.15默认不会直接执行 TypeScript 测试；在该版本上使用 `NODE_OPTIONS=--experimental-strip-types npm test`，浏览器宿主测试使用 `node --experimental-strip-types client/tests/mobile-host-bridge.browser.mjs`（从仓库根目录执行）。

## 接入行为

- 从首页进入系统列表，选择已适配的 `hand` 系统；在运行页“连接设备”弹窗刷新 USB，选择已注册的 CH340 驱动服务，再配置波特率连接。缺驱动、设备、权限及签名错误都会显示具体原因。
- 无合法压力帧时显示等待；超过2秒无新帧显示暂停。网页只接受1024个0–255整数，坏帧不覆盖上一合法画面。
- 停止、切源或设备断开会清除旧画面；退出运行页、切后台、网页重载或加载失败都会取消连接和演示，返回后需重新连接。应用前台显示时保持屏幕唤醒。
- 每次USB连接有独立连接ID，旧连接的迟到帧/状态不能恢复画面；页面就绪握手可重复发送而不清除在途数据。
- 原生读与显示解耦，桥只保留最新待发帧，不用于逐帧采集存储。数字与热力图使用相同原始行列顺序。

本阶段仅加入独立移动入口，桌面 Electron 启动、授权和发布链路仍由原有代码提供。
