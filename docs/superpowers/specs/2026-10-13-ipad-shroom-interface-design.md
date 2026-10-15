# iPad Shroom 界面对齐

用户确认：首页、系统选择、采集运行页保持原版 Shroom 的界面；本轮恢复全部页面和现有 USB 收数，密钥授权、采集保存、历史回放和算法功能后续完成。

## 已选方案

复用现有 React 页面视觉组件、CSS、品牌素材和粒子场景，在离线 WebView 中显示。RN 只负责原生 USB、生命周期、状态同步和原有有界压力帧桥。相比重写成 RN 控件，此方案直接沿用原版布局；不把 Electron/Node 后端塞入 iPad。

- 首页沿用 Shroom Vision 标识、粒子背景、分类卡片和系统列表入口。
- 系统页保留分类、搜索、系统清单、预览和进入/返回。只对已支持的 32×32 CH340 协议开放实时工作区，其他系统可预览并明确标注尚未适配；不能把同一压力帧套给其他硬件协议。
- 运行页沿用原版顶部会话栏、左观测区、中央真实画布及右快捷工具。USB刷新/选择/波特率/连接/停止放在原版设备设置中，移除重复RN标题栏。
- 授权未迁移，不显示“密钥已验证”或伪造授权范围。采集保存、回放、算法和依赖未提供的渲染能力以不可用状态或说明呈现；实时连接不冒充保存采集。
- 原生驱动、签名、1024点帧协议及背压不变。停止、返回列表、后台和换源清空/中断当前连接；只有收到真实USB有效帧才显示接收状态。
- 模型/品牌资源离线打包，不依赖开发服务器或外部网络。横屏、竖屏及窄屏保持可操作；预览动画不代表实时压力数据。

## 桥契约

网页发 `{type:'usb.command',version:1,requestId,action,deviceId?,baudRate?}`，action仅refresh/connect/disconnect/demo；connect校验整数波特率115200–1000000和设备ID。宿主发到 `window.ShroomMobileHost.receive` 的消息为 `{type:'host.state',version:1,status,error,devices,selectedDevice,baudRate,busy,frameCount,source}`。网页压力入口 `window.ShroomMobile.receive` 及其ready/ACK契约保持不变。未知、过大或非法命令拒绝执行。

## 验收

生产离线页面从首页进入列表再进入真实运行页，可返回；测试USB命令、宿主状态、错误、真实帧ACK、停止和切源；确认没有网络资源请求。既有驱动匹配回归继续通过。浏览器截图核对三页和iPad方向布局；更新IPA签名并安装后由用户确认界面及USB收数。
