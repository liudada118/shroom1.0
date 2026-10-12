# iPad CH340 DriverKit 接入

目标是 iPad Air 11 英寸 M3，USB CH340，32×32/1024 点。源码包含真实 USB 控制请求与 bulk 读取，不通过网络中转，不假设 iPad 有 `/dev/tty`。**当前在 Windows 完成源码准备；尚未经过 Xcode 编译、签名或 USB 真机验证，不能把它视为已验证的采集驱动。**

## 必要条件

- Mac、Xcode 26.4或更高版本、iPadOS 16.4或更高版本，以及 M 系列 iPad（本项目Expo SDK57的最低版本）。Expo Go 不包含该原生模块或驱动，必须使用自建应用。
- Apple Developer 团队与获准的 DriverKit/USB transport provisioning profile。驱动声明只匹配 `VID=0x1A86 / PID=0x7523 / interface=0`；CH340 的实际 VID/PID 不同则先核对再修改匹配及申请范围。
- 驱动 entitlement：`com.apple.developer.driverkit=true`、`com.apple.developer.driverkit.transport.usb` 内的 VID/PID；应用 entitlement：`com.apple.developer.driverkit.communicates-with-drivers=true`。
- 驱动与宿主应用由同一团队签名，驱动 bundle ID 为宿主 bundle ID 加 `.driver`。UserClient 再检查调用方的 `application-identifier`，只允许指定 `TEAMID.appBundleID`，不申请第三方任意客户端访问。

Apple 授权有实际审批和签名检查；在文件中写 entitlement 不等于获得授权。需要先申请，不能在 iPad 上以关闭系统保护的方式跳过。官方说明：[iPadOS DriverKit](https://developer.apple.com/documentation/driverkit/creating-drivers-for-ipados)、[申请授权](https://developer.apple.com/documentation/driverkit/requesting-entitlements-for-driverkit-development)、[用户客户端示例](https://developer.apple.com/documentation/driverkit/communicating-between-a-driverkit-extension-and-a-client-app)。

## 生成并嵌入应用

在 Mac 的仓库中执行：

```sh
npm --prefix client ci --ignore-scripts
cd mobile
npm ci
export SHROOM_APPLE_TEAM_ID=YOURTEAMID
npm run prebuild:ios
```

`YOURTEAMID` 替换为 Apple 团队的十位 ID。`app.json` 的 `plugins` 中应包含 `./driverkit/withShroomDriverKit.cjs`；插件每次 prebuild 新增 DriverKit target、依赖、USBDriverKit/DriverKit 链接和 `.dext` 的嵌入阶段。未设置team时允许生成未签名工程，真机驱动访问仍会被拒绝；真实编译签名时必须配置。不要手工维护生成的 `ios/`。

已经生成的工程也可使用 `node driverkit/integrate-ios.cjs ios/Shroom.xcodeproj --team YOURTEAMID` 添加，`.xcodeproj` 名称以 `ios/` 实际名称为准。脚本首轮保存原始pbxproj备份，`--check` 只准备转换不写入文件；已有目标不重复添加。团队或bundle ID变化后重新prebuild会更新驱动签名设置及UserClient限制；Xcode里的手工签名profile仍需选择正确版本。

打开 `ios/*.xcworkspace`，为宿主和 ShroomCH340 target 选择相应团队、签名身份与批准的 provisioning profile。主应用使用 iPhoneOS SDK，驱动使用 DriverKit SDK；不要把 dext 改成普通 iOS framework。DriverKit 目标里的 `SHROOM_CLIENT_APPLICATION_ID` 编译值必须等于实际签名 `application-identifier`；老开发账号的 App ID Prefix 若不等于 Team ID，要用实际 Prefix 调整这个值。

选择真实 iPad 构建/运行宿主应用。首次安装后，在 iPad「设置」的驱动列表中启用 Shroom 驱动，再接 CH340。iPadOS 自动发现应用内驱动，不调用 macOS 的 `OSSystemExtensionRequest`。不同系统版本的设置入口可能不同，以系统显示的 Drivers/驱动列表为准。

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

本机已用 MSVC 编译运行生产分帧器、CH340波特率寄存器和有界ABI测试；通用C++测试不依赖Apple SDK。Objective-C++/Swift/DriverKit和IIG的整体编译、真实签名及上述USB真机检查仍需要Mac。Windows不能运行Expo的iOS prebuild，工程变换目前只通过隔离Xcode工程夹具检查。

平台无关的原生协议测试使用生产framer和baud计算头文件，覆盖所有USB切分位置、无分隔符噪声、有界缓存、重新同步及921600/1000000寄存器。在具有C++编译器的Mac/Linux/Windows环境执行：

```sh
c++ -std=c++17 -Wall -Wextra -pedantic mobile/driverkit/tests/nativeProtocol.test.cpp -o /tmp/shroom-native-protocol-test
/tmp/shroom-native-protocol-test
```

该测试不验证DriverKit签名/USB硬件行为。
