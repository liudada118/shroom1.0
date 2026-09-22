# 人体全身优化：HaLow 数据接入

此功能在原展示系统中替换数据入口。人体模型、点位、左右方向、热力/水晶、原始数字、统计、清零、采集回放和 CSV 使用同一套现有逻辑。

## 使用

1. 网关、A/B 板通电，电脑连接网关。已能用原软件收数据的网关和 B 板可沿用原配置，无需重新初始化。
2. 停止原厂软件或 Python 试用页的 TCP 接收，释放 `192.168.100.2:12345`。同时只能由一个接收服务监听该地址和端口。
3. 在项目目录运行 `npm start`，进入已授权的“人体全身传感”（内部 key 为 humanBodyOptimized）系统或其独立副本，在“实时”页点击工具栏 **HaLow 连接**。
4. 监听地址选电脑连接网关的网卡 IP，默认是 `192.168.100.2`，端口默认 `12345`。这两个值应与 B 板已保存的服务器目标一致。不要填写网关 IP `192.168.100.1`；`127.0.0.1` 只用于电脑本机模拟测试。
5. 点击 **开启 TCP 接收**，等待 B 板主动连接。首个合法 ID 自动成为当前展示设备；表格显示在线设备、帧数，收到数据后显示实时帧率。关闭此弹窗即可操作原人体展示。
6. 原“采集”按钮继续录制；回放和 CSV 读取原数据库中的1024点数组。采集或回放期间不能启动接收或换设备，须先结束采集或返回实时。进入回放后停止实时接收，不向历史画面或采集库写入实时数据；返回实时后重新开启接收。
7. **停止接收**释放端口；需要换回串口时先停止 HaLow。程序退出或切到其它展示系统也会停止监听。再次启动软件后需要手动开启 TCP 接收。

## 数据路径

```text
A 板原始采集 → UART → B 板 → HaLow 网关 → 电脑的 TCP 接收器
→ 识别设备 ID / 缓存拆帧 → 1024 字节 payload
→ backend/kernel/transport/halowService.js
→ legacySerialFrameRuntime.handleSitSerialFrame → 原有 1024 点处理/归零/采集管线
→ SQLite 原生数组记录 / canonical sensor.frame → Home.jsx 人体渲染、原始数字和统计
```

这里的网络端口用于接收设备推送，浏览器本身不读取 TCP。Shroom 后端负责 TCP 接收及 WebSocket 推送；不再依赖 `8787` Python 试用页。网关无线名称、密码和 B 板服务器目标仍由原工具配置，连接弹窗只设置电脑接收端。

## 协议与边界

- 每次连接首先发送 `AA 55 00 LL`，随后 `LL` 字节 ASCII 设备 ID，长度1～64。
- 数据帧为 `AA 55 03 99` 加1024字节原始负载，按既有人体协议处理为1024个字节值；不是自动推断采样格式或校准单位。
- 每条 TCP 连接独立缓存；按固定帧长消费负载，不把负载内出现的帧头误认为边界。
- 可接入多个独立 ID，但一次只展示/记录所选板；采集不合并不同 B 板，也不改变数据库格式。所选 ID 断开后等待同 ID 重连，不自动选另一个板。
- 多块 B 板必须使用不同 ID。首帧格式错误、超过10秒没有完整 ID 或重复在线 ID 将断开该连接。
- 端口占用会明确报错；已监听但无设备时检查网卡、B 板保存的目标地址和电脑对 Shroom/Electron 的网络访问权限。

## 当前控制接口

`POST /api/commands` 使用 `{type: "halow.control", requestId, payload: {action}}`，action 支持 status/start/stop/select。start 额外传 host/port，select 传 deviceId；异步绑定或停止完成后才返回回执，状态位于 `data.data.results` 的 `halow-control` 项中。

WebSocket 只推送低频 `halowStatus` 与 `halowClear`；不接收新增控制命令，也不把清屏转换成传感器零帧。每条连接独立拆帧，上限 16 条连接。设备 ID 用于选流，原生副本的 displaySystemId/channelId 和数据库身份保持不变。

开始接收前检查授权、当前原生型号、采集/回放以及全部串口的打开/启动/重连状态；绑定结束再检查一次。串口编排器同样拒绝与启动、接收或停止中的 HaLow 混用。

## 当前合并验证

- `backend/tests/serial/halowReceiver.test.js`：7 项本机 TCP/协议测试。
- `backend/tests/http/halowControlApi.test.js`：5 项真实 HTTP/TCP 测试，覆盖启动与停止回执、保护条件、异步取消、原生处理链、采集开关、规范副本身份和 1024 点存储格式。
- `Title.halow.test.jsx`、串口/门户生命周期、commandClient 定向测试 31 项通过。
- 统一验证入口：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-changed.ps1 -Mode Full`，10/10 通过（后端 92 文件、客户端 775 项、前端 SDK 512 项）；构建输出仅写入系统临时目录。
- `node scripts/tests/halow-connection.mjs`：Chrome 合成设备操作通过，覆盖状态、开启/停止、设备选择、HTTP 错误与重试和采集/回放禁用条件。
- 本轮使用本机模拟设备；尚未重测真实 B 板、网关与安装包自动更新。

## Revise 原分支历史验证（不代表本轮重测）

- `node --test test/halowReceiver.test.js`：9项，覆盖拆包/粘包、实际TCP连接、设备选流、重复ID、停止/重启/取消、占用端口和授权/采集/回放/串口约束。
- `node --test test/collectionInsertQueue.test.js test/licenseDisplaySwitch.test.js test/csvUtf8.test.js`：9项通过。
- `cd client` 后执行 `npx vitest run src/components/video/humanBodyOrientation.test.js src/components/num/humanBodyRawLayout.test.js src/page/home/websocketTransport.test.js`：31项通过。
- `npm run build-client`：生产构建通过。
- 2026-09-09 实机验证：Shroom 接收 `STA_002`（`192.168.100.127`），约97～99fps；原人体热力、Hz与压力统计随真实帧更新。
- 使用原采集按钮录制 `HaLow联调验证_20260909_2026-9-9-16-28-30-198` 共1252帧；在原回放界面成功播放，并通过原下载入口导出1252行 CSV，输出位于 `test-results/halow-live/`。验证后已返回实时展示，测试记录保留供复核。
