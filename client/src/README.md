# 前端源码目录

前端源码按职责边界归类，新功能优先放到对应区域，不再继续堆进通用 `components/`。

- `visualization/`：按业务对象组织的可视化，例如 `human-body/`。
- `extensions/`：可新增、可替换的产品能力，例如展示系统和 JQBed 配置 UI。
- `legacy/`：仍需兼容的历史演示页面，不作为新功能模板。
- `components/`：尚未迁移的共享或旧业务组件，后续按引用面分批处理。
- `runtime/`、`renderers/`、`displays/`：带单例、注册或模块加载副作用的稳定渲染基础设施。
- `services/ws/`、`services/command/`：与稳定后端交互的通信边界。
- `page/`：路由页和兼容入口；展示系统 Builder 的实现已与扩展放在一起，原路由文件仅负责转发。

目录移动不得复制运行时单例，不得改变传感器 ID、路由、localStorage 键、帧格式或渲染器注册时机。
完整仓库分层见 `docs/repository-map.md`。
