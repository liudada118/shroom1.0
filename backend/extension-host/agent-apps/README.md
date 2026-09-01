# Agent Apps

`agent-apps` 是只读渲染扩展的宿主边界。安装包只写入
`runtimeWritableRoot/agent-apps/<id>`，由 `app.json`（schema v1）声明一个浏览器渲染入口。

- 宿主只校验、发现和静态提供文件，从不 `require` 或执行包内代码。
- 当前唯一可申请权限是 `sensor.read`；实时数据由前端通过受控 `postMessage` 转发。
- 安装接口使用完整文件清单，先写同盘临时目录，再通过目录 rename 切换；默认不覆盖。
- 浏览器安装/reload 只接受 loopback Origin；无 Origin 的本机 CLI/Agent 仍可使用公共 API。
- 静态入口必须放在 sandbox iframe 中，并由 HTTP 层附加严格 CSP；这是受控能力隔离边界，
  仍不能把未经审核的恶意代码当成可信代码。
- electron-builder 和 Electron Forge 都必须把随版本发布的规则复制到
  `resources/agent/`；运行时只把该目录视为打包资源主路径，仓库路径仅供开发回退。

稳定渲染器标识为 `agent:<appId>`，manifest 内部的 `renderer.id` 只用于包内视图命名。
