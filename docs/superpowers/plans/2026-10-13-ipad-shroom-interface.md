# iPad Shroom Interface Implementation Plan

> 执行方式：本会话使用 subagent-driven-development 拆分不重叠的原生桥与页面工作；用户已授权实施，不提交或推送。

**Goal:** 首页、系统选择与运行页沿用 Shroom 界面，并保持已验证的 CH340 USB收数。

**Architecture:** 离线React入口复用门户视觉组件与样式；RN提供经过校验的USB命令和状态桥。保留现有压力帧背压及驱动实现，未迁移功能明确不可用。

**Tech Stack:** React、React Native、WebView、Vite、Three.js、已有 DriverKit。

### 1. 原生控制桥

- [x] 在 `mobile/src/hostControl.ts` 定义命令验证和状态注入，新增Node测试覆盖未知动作、非法波特率、超长ID、转义及有效命令。
- [x] 修改 `mobile/App.tsx` 移除重复可见控制条，用命令桥触发现有USB/停止/演示逻辑；状态变化及web.ready补发host.state。
- [x] 保留在途连接撤销、AppState停止、迟到帧拒绝与FrameDispatcher。运行mobile测试、typecheck、lint。

### 2. 三页离线界面

- [x] `client/src/mobile/MobilePressureApp.jsx` 管理首页→系统选择→监测及返回；独立模块管理原生状态和网页命令。
- [x] 复用 `FiberPortal.css`、`PortalMonitoring.css`、品牌资源、粒子场景、PortalQuickTools与PortalControlDialog；移动专用CSS只适配安全区和尺寸。
- [x] 单独的移动目录保留原版分类/名称，标记当前支持协议；未适配系统不能进入USB运行页，授权状态不伪造。
- [x] 持续复用压力bridge与RendererHost，保留热力图/数字、状态、错误、演示标签和停止清空。
- [x] 打包首页所需模型为离线资源，验证生成页面只含可内联资源。

### 3. 浏览器与集成验证

- [x] 更新现有两个mobile浏览器验收，从真实导航到运行页后验证画布和ACK，不跳过原协议断流/错误/停止断言。
- [x] 新增导航、系统搜索/不可用项、USB控制和状态、横竖屏截图检查。先验证新测试在旧页失败。
- [x] 执行受影响client测试、mobile测试/typecheck/lint、离线生产构建；独立复核USB命令边界及功能范围。
- [x] 按仓库规则尝试Full入口，准确记录缺少PowerShell的环境限制，不将局部检查等同Full通过。

### 4. 打包交付

- [x] 原生二进制及驱动未变时，使用现有正式归档的副本，替换新生成的Hermes JS资源并重新签名，Xcode正式导出独立IPA；如无法保证资源完整性则重新构建。
- [x] 核对最终包签名、profile、驱动配置号1，安装并启动到目标iPad；文稿保存新包、校验值和说明。
- [x] 增量更新ARCHITECTURE与移动README，明确自动验证和用户真机验收的区别。
