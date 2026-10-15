# iPad CH340 DriverKit 接入

目标是 iPad Air 11 英寸 M3，USB CH340，32×32/1024 点。源码包含真实 USB 控制请求与 bulk 读取，不通过网络中转，不假设 iPad 有 `/dev/tty`。**此前驱动修正版的 Release 开发签名归档、IPA 导出和目标 iPad 安装启动已通过；用户已确认真实 CH340 数据接收中且帧数增加；长时间稳定性、拔插恢复和物理点位对应仍待验证。** 本轮三页界面对齐不修改驱动或 USB 字节协议，新界面版本已重新生成 JS、签名导出，并安装到目标 iPad；用户已于2026-10-13确认“页面已恢复，USB 帧数正常增加”，新版界面与真实 USB 基本收帧联动通过验收。

## 应用中的连接入口

2026-10-13 线序/调参修正版已重新导出并安装启动到目标iPad，驱动及宿主原生机器码未变。网页补齐hand线序和当前视图参数，自动验证与签名/profile核验通过；用户随后确认“线序与调节都正常”，本次修复通过现场验收。

首页、系统选择和运行页沿用原版 Shroom 布局，10 个模型供离线粒子预览。当前只有 `hand` 系统接入已验证的 CH340 32×32协议；其他系统可在目录中预览，但标记为尚未适配，不开放实时运行。

从首页进入系统列表，选择 `hand` 并进入运行页，点击“连接设备”打开弹窗。按“刷新 USB”→选择 CH340→配置波特率→“连接 USB”操作；停止和显式演示入口位于同一弹窗。运行页可切换三维点图、热力图和原始数字，不影响当前 USB 连接。

USB 帧在离线网页发布前应用桌面 `hand` 的 `jqbed` 线序，原生分帧和驱动不重排；三个视图共用映射后的矩阵。“调节”调整当前视图的显示参数，底部按钮切换视图；显示过滤不会改变已接收原始统计。线序、参数及物理角点验收边界见 [移动端说明](../README.md)。

停止、离开运行页、切后台，以及 WebView 重载、内容进程终止或加载失败都会取消会话，旧连接的迟到帧不能恢复采集。密钥授权、采集保存、历史回放和算法由用户明确留待后续接入，当前连接仅用于实时展示。

2026-10-13 本轮自动验证：移动端18项测试、客户端190项测试、移动端类型检查和 lint 通过；本机缺少 PowerShell，Full 检查未运行。本轮 IPA 的严格签名、目标设备 profile、安装和启动已核验；新版页面与 USB 基本收帧另经用户现场反馈确认，不以浏览器合成帧代替真机证据。

## 必要条件

- Mac、Xcode 26.4或更高版本、iPadOS 16.4或更高版本，以及 M 系列 iPad（本项目Expo SDK57的最低版本）。Expo Go 不包含该原生模块或驱动，必须使用自建应用。
- 付费 Apple Developer 团队及匹配构建用途的 DriverKit/USB profile。开发签名可启用公开的 development 能力；USB 分发能力需要另行申请。驱动匹配表只匹配 `VID=0x1A86 / PID=0x7523 / configuration=1 / interface=0`；更换硬件时先核对实际描述符。
- 驱动 entitlement：`com.apple.developer.driverkit=true`、`com.apple.developer.driverkit.transport.usb` 内的 VID/PID；应用 entitlement：`com.apple.developer.driverkit.communicates-with-drivers=true`。
- 驱动与宿主应用由同一团队签名，驱动 bundle ID 为宿主 bundle ID 加 `.driver`。UserClient 再检查调用方的 `application-identifier`，只允许指定 `TEAMID.appBundleID`，不申请第三方任意客户端访问。

开发调试与分发审批应分开处理：Apple DTS明确说明付费账号可以使用development能力，无需专门审批；USB分发仍需获批的能力和匹配profile。参见 [Apple最新签名说明](https://developer.apple.com/forums/thread/809202)、[iPadOS DriverKit](https://developer.apple.com/documentation/driverkit/creating-drivers-for-ipados)。本项目已完成实际账号的开发签名及 IPA 导出，未验证分发签名。

## 签名准备

先由 Apple Developer 团队的 Account Holder / Admin 为应用和驱动配置能力及 profile；[Apple 的 DriverKit profile 步骤](https://developer.apple.com/help/account/provisioning-profiles/create-a-driverkit-development-provisioning-profile)要求驱动 App ID 已启用相应 entitlement。仓库当前配置如下，最终必须与账号中的实际标识一致：

| 项目 | 当前值 |
| --- | --- |
| 宿主 bundle ID | `com.shroom.pressure-sensor.mobile` |
| 驱动 bundle ID | `com.shroom.pressure-sensor.mobile.driver` |
| 宿主能力 | `com.apple.developer.driverkit.communicates-with-drivers` |
| 驱动能力 | `com.apple.developer.driverkit`、`com.apple.developer.driverkit.transport.usb` |
| USB 匹配范围 | VID `0x1A86`（6790）、PID `0x7523`（29987）、configuration `1`、interface `0` |
| 用途 | iPad 通过 CH340 读取32×32压力矩阵，应用离线展示热力图和原始数值 |

USB VID 属于芯片厂商；申请时按实际硬件关系填写，不能声明为本团队自有 VID。开发 profile 需要选择开发证书和测试设备；分发需要另外匹配所选分发方式的 profile。不要把私钥、证书密码或 profile 提交到仓库。

若创建DriverKit development profile时显示“No App IDs are available”，回到Identifiers，创建或编辑驱动的显式App ID `com.shroom.pressure-sensor.mobile.driver`，启用`DriverKit (development)`和`DriverKit USB Transport (development)`后保存，再回来生成profile。宿主ID `com.shroom.pressure-sensor.mobile`使用`DriverKit Communicates with Drivers`及独立的iOS App Development profile。

开发签名还需匹配开发entitlement：Apple说明USB开发配置使用字符串`idVendor: "*"`。为自己的测试iPad打包时，设置`SHROOM_DRIVERKIT_DEVELOPMENT=1`再执行prebuild；生成器会为驱动的Debug和Release配置启用自动开发签名，并使用独立的`ShroomCH340.development.entitlements`。Release优化不等于分发签名；此模式只能配开发证书和开发profile，不能导出App Store或Ad Hoc分发包。

未启用此选项时，生成器仍使用手动签名及固定VID/PID的原entitlements。两种模式都保持Info.plist中的CH340精确硬件匹配和UserClient身份约束。Xcode账号登录不可用时，可手动生成并下载两份开发profile，再在对应target选择手动签名及该profile；驱动仍需使用development entitlement文件。

Xcode26.6手动签名导出开发IPA时，本机实测需要区分归档和导出所用的驱动profile：

| 用途 | 宿主 profile | 驱动 profile |
| --- | --- | --- |
| Release archive | 宿主 ID 的 iOS App Development | `.driver` ID 的 DriverKit Development |
| `-exportArchive`，`method=debugging` | 同一宿主 profile | `.driver` ID 的 iOS App Development |

三个profile都应包含目标iPad、同一开发证书和相应能力。驱动的iOS导出profile仍须含DriverKit及USB development entitlement。`ExportOptions.plist`的`provisioningProfiles`按两个bundle ID分别指定UUID，`signingStyle=manual`；不要修改驱动target的DriverKit SDK。将DriverKit profile直接用于iOS导出会报平台不匹配；改用上述iOS profile后正式导出通过。下载的profile安装在用户的Xcode配置目录，不提交仓库；手动选择profile后不要重新执行开发模式prebuild，否则生成器会切回自动签名并清除显式profile。

## 生成并嵌入应用

在 Mac 的仓库中执行：

```sh
npm --prefix client ci --ignore-scripts
cd mobile
npm ci
export SHROOM_APPLE_TEAM_ID=YOURTEAMID
export SHROOM_DRIVERKIT_DEVELOPMENT=1
npm run prebuild:ios
```

`YOURTEAMID` 替换为 Apple 团队的十位 ID。`app.json` 的 `plugins` 中应包含 `./driverkit/withShroomDriverKit.cjs`；插件每次 prebuild 新增 DriverKit target、依赖、USBDriverKit/DriverKit 链接和 `.dext` 的嵌入阶段。未设置team时允许生成未签名工程，真机驱动访问仍会被拒绝；真实编译签名时必须配置。不要手工维护生成的 `ios/`。

已经生成的工程也可使用 `node driverkit/integrate-ios.cjs ios/Shroom.xcodeproj --team YOURTEAMID` 添加，`.xcodeproj` 名称以 `ios/` 实际名称为准。脚本首轮保存原始pbxproj备份，`--check` 只准备转换不写入文件；已有目标不重复添加。团队或bundle ID变化后重新prebuild会更新驱动签名设置及UserClient限制；Xcode里的手工签名profile仍需选择正确版本。

已有工程切换开发签名时，在上述CLI命令后加`--development-signing`；不带此选项再次运行会恢复驱动的手动签名及固定VID/PID entitlement。该开关只配置驱动，宿主仍需同团队的iOS开发profile。

打开 `ios/*.xcworkspace`，为宿主和 ShroomCH340 target 选择相应团队、签名身份与匹配的 provisioning profile。主应用使用 iPhoneOS SDK，驱动使用 DriverKit SDK；不要把 dext 改成普通 iOS framework。DriverKit 目标里的 `SHROOM_CLIENT_APPLICATION_ID` 编译值必须等于实际签名 `application-identifier`；老开发账号的 App ID Prefix 若不等于 Team ID，要用实际 Prefix 调整这个值。

选择真实 iPad 构建/运行宿主应用。首次安装后，在 iPad「设置」的驱动列表中启用 Shroom 驱动，再接 CH340。iPadOS 自动发现应用内驱动，不调用 macOS 的 `OSSystemExtensionRequest`。不同系统版本的设置入口可能不同，以系统显示的 Drivers/驱动列表为准。

Apple当前[示例说明](https://developer.apple.com/documentation/driverkit/communicating-between-a-driverkit-extension-and-a-client-app)列出「设置 → 隐私与安全性 → 驱动程序」；[概述文档](https://developer.apple.com/documentation/driverkit/creating-drivers-for-ipados)仍列出「设置 → 通用 → 驱动程序」。在系统实际显示的入口开启ShroomCH340后，接入匹配硬件才会启动驱动。已安装和启动宿主不代表驱动已启用或硬件已连接。

也可单独生成 DriverKit 工程检查驱动：

```sh
cd mobile/driverkit
xcodegen generate
xcodebuild -project ShroomDriverKit.xcodeproj -scheme ShroomCH340 -sdk driverkit \
  DEVELOPMENT_TEAM=YOURTEAMID SHROOM_APP_BUNDLE_ID=com.shroom.pressure-sensor.mobile \
  PROVISIONING_PROFILE_SPECIFIER="Approved DriverKit Profile" build
```

XcodeGen 仅生成工程；单独构建 dext 不会自动安装到 iPad。最终仍通过嵌入它的 iPad 应用交付。默认团队为空，需由开发者配置。

## 数据与失败边界

`listDevices()` 列出**已经匹配、运行的 Shroom DriverKit 服务**，不是扫描整个 iPad USB 总线。未安装驱动、未启用、签名不匹配、设备不存在均不能据此显示已连接。`connect` 在 `IOServiceOpen` 和 CH340 初始化全部成功后才发送 connected。

2026-10-13 用户已确认驱动开关开启，但连接传感器仍提示未找到运行中的驱动。Mac `ioreg` 实测当前 CH340 为上述 VID/PID、配置1、接口0；接口匹配表补齐原先遗漏的 `bConfigurationValue=1`，对应回归测试先失败后通过（移动端共12项通过）。修正版已重新签名并通过 Xcode 导出、安装和启动。用户随后在iPad上确认“USB 数据接收中，帧数增加”，驱动启动与基本收帧通过真机验收；尚未完成长时间、拔插恢复及物理点位对应检查。

`capabilities().supported`仅表示真机iPad平台可尝试该接口，不检测芯片型号，不证明驱动安装成功；本项目的目标M3已由用户确认，其他iPad仍须人工核对M系列芯片。

驱动执行 CH340 vendor 初始化、8N1、波特率配置，默认由宿主传 `1000000`，允许 `115200–1000000`；921600 使用芯片专用 divisor。bulk IN 端点从当前接口描述符读取。每次同步读取最多 2048 字节，100ms 超时；保留超时返回的部分数据，拔出与其他错误报错。包大小2056字节，保持在 IOKit 的结构输出内联范围内；USB、UserClient 和模块使用有界内存。

宿主在独立串行队列读取，按帧尾 `AA 55 03 99` 同步。启动的首个不完整片段丢弃，只接受两个分隔符之间正好1024字节的帧。输出 `pressure.frame` 的32行/32列、0–255整数，`sequence` 对每个完整帧递增；跨 JS 桥每秒最多30帧，只发最新帧，适合本阶段展示。切后台主动断开，回到前台需重新连接。没有采集文件、授权迁移、桌面算法或多设备同步功能。

拔插、超时部分读、CH340不同固件版本、1000000波特率误差、USB-C线缆供电和真实连续采集都需要真机验证。不要用演示帧判定 USB 链路已通。

## 真机验收

1. 无驱动/未启用/缺 USB 时连接明确失败；模拟器明确说明不支持。
2. 配置1000000波特率，连续收到1024点真实帧，按压位置与展示位置一致。
3. 连续接收至少10分钟，断线后状态恢复可操作；重复连接不启动多个读取循环。
4. 拔出设备后报错，后台停止读取，重新连接后重新同步帧边界。
5. 检查应用签名 ID 与驱动配置一致，其他应用不能打开UserClient。

初始 Windows 验证已用 MSVC 编译运行生产分帧器、CH340波特率寄存器和有界ABI测试；通用C++测试不依赖Apple SDK。2026-10-12在Mac补充验证：Expo prebuild、Apple `plutil` 和 `xcodebuild -list` 通过；DriverKit/IIG arm64 未签名构建成功，宿主 Objective-C++ 通过 iOS SDK 语法检查。2026-10-13使用Xcode26.6完成完整RN/Swift/DriverKit Release开发签名归档及IPA导出，最终解包后的宿主和dext通过`codesign --verify --strict`，宿主同时通过`--deep`核验；嵌入profile包含目标iPad，签名entitlement与profile相符。目标iPad已安装并由devicectl成功启动，后续查询确认进程存在；真机界面交互、驱动启用及上述USB检查仍待完成。

平台无关的原生协议测试使用生产framer和baud计算头文件，覆盖所有USB切分位置、无分隔符噪声、有界缓存、重新同步及921600/1000000寄存器。在具有C++编译器的Mac/Linux/Windows环境执行：

```sh
c++ -std=c++17 -Wall -Wextra -pedantic mobile/driverkit/tests/nativeProtocol.test.cpp -o /tmp/shroom-native-protocol-test
/tmp/shroom-native-protocol-test
```

该测试不验证DriverKit签名/USB硬件行为。
