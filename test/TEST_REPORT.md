# Shroom1.0 Electron 端到端测试报告

**项目**: Shroom1.0  
**分支**: test (基于 Max)  
**测试时间**: 2026-03-03  
**测试工具**: Playwright + Electron  

---

## 测试总览

| 指标 | 数值 |
|------|------|
| 总测试数 | 41 |
| 通过 | 39 |
| 失败 | 1 |
| 跳过 | 1 |
| **通过率** | **95.1%** |

---

## 分类结果

| 测试类别 | 通过/总计 | 状态 | 备注 |
|----------|-----------|------|------|
| 生命周期 | 6/6 | ✅ 全部通过 | 启动、加载、窗口属性、JS错误、静态服务器、关闭 |
| WebSocket | 3/3 | ✅ 全部通过 | 端口 19999/19998/19997 均连接成功 |
| 数据库 | 2/2 | ✅ 全部通过 | SQLite CRUD 正常，db/ 目录文件存在 |
| UI 导航 | 14/15 | ❌ 1 失败 | /heatmap 页面内容为空（需 WS 数据驱动） |
| 组件交互 | 5/5 | ✅ 全部通过 | Antd 按钮、输入框、Select 组件检测正常 |
| Canvas/3D | 8/9 | ⚠️ 1 跳过 | System 页面 7 个 Canvas 正常，3Dnum 页面无 Canvas |
| 内存检测 | 1/1 | ✅ 全部通过 | 路由切换内存变化 13.08 MB（阈值 50MB） |

---

## 详细结果

### 1. 应用生命周期测试

| 测试项 | 状态 | 详情 |
|--------|------|------|
| 应用启动 | ✅ PASSED | Electron 主窗口已创建并可见 |
| 页面加载 | ✅ PASSED | DOM 节点数: 25 |
| 窗口属性 | ✅ PASSED | 标题: "Shroom - Pressure Sensor System", URL: http://127.0.0.1:12321/ |
| JS 错误检测 | ✅ PASSED | 无未捕获异常 |
| 静态服务器 | ✅ PASSED | HTTP 200 OK |
| 应用关闭 | ✅ PASSED | 进程正常退出 |

### 2. WebSocket 测试

| 测试项 | 状态 | 详情 |
|--------|------|------|
| WS main (19999) | ✅ PASSED | 连接成功 |
| WS back (19998) | ✅ PASSED | 连接成功 |
| WS head (19997) | ✅ PASSED | 连接成功 |

### 3. 数据库测试

| 测试项 | 状态 | 详情 |
|--------|------|------|
| SQLite CRUD 测试 | ✅ PASSED | 建表、插入、查询均成功 |
| 项目数据库文件 | ✅ PASSED | db/ 目录文件: hand0205.db, hand0205back.db, hand0205sit.db, init.db |

### 4. UI 导航测试

| 路由 | 页面名称 | 状态 | 内容长度 |
|------|----------|------|----------|
| `/` | 首页(Date) | ✅ PASSED | 3 |
| `/system` | 系统主页(Home) | ✅ PASSED | 120 |
| `/heatmap` | 热力图 | ❌ FAILED | 0（需 WebSocket 实时数据驱动） |
| `/num/car10` | 数字矩阵(car10) | ✅ PASSED | 4912 |
| `/handReal` | 手部实时演示 | ✅ PASSED | 1148 |
| `/handPoint` | 手部传感点 | ✅ PASSED | 847 |
| `/handPoint32` | 32点手部 | ✅ PASSED | 167 |
| `/line` | 线调整 | ✅ PASSED | 3 |
| `/num1010` | 10x10矩阵 | ✅ PASSED | 2520 |
| `/num1016` | 10x16矩阵 | ✅ PASSED | 427 |
| `/block` | 块显示 | ✅ PASSED | 20 |
| `/log` | 日志 | ✅ PASSED | 813 |
| `/diff` | 矩阵差异 | ✅ PASSED | 6415 |
| `/3Dnum` | 3D数字 | ✅ PASSED | 2047 |
| `/license` | 授权管理 | ✅ PASSED | 555 |

### 5. 组件交互测试

| 测试项 | 状态 | 详情 |
|--------|------|------|
| Antd 按钮检测 | ✅ PASSED | 发现 1 个按钮 |
| Antd 输入框检测 | ✅ PASSED | 发现 1 个输入框 |
| Antd Select 检测 | ✅ PASSED | 首页 0 个 Select |
| System 页面组件 | ✅ PASSED | 4 个 Select 组件 |
| License 页面组件 | ✅ PASSED | 2 个按钮 |

### 6. Canvas / 3D 渲染测试

| 测试项 | 状态 | 详情 |
|--------|------|------|
| System Canvas | ✅ PASSED | 7 个 Canvas 元素 |
| Canvas[0-5] 尺寸 | ✅ PASSED | 300x150（ECharts 图表） |
| Canvas[6] 尺寸 | ✅ PASSED | 800x576（Three.js 3D 模型） |
| 3D数字 Canvas | ⏭️ SKIPPED | 页面无 Canvas（需数据驱动） |

### 7. 内存检测

| 测试项 | 状态 | 详情 |
|--------|------|------|
| 路由切换内存泄漏 | ✅ PASSED | 变化: 13.08 MB（阈值: 50MB） |

---

## 已知问题

1. **`/heatmap` 路由页面为空**：热力图页面依赖 WebSocket 实时传感器数据，在无硬件连接的测试环境中无法渲染内容。建议添加 mock 数据支持。

2. **`/3Dnum` 页面无 Canvas**：3D 数字显示页面可能也依赖实时数据流来创建 Canvas 元素。

---

## 环境搭建记录

测试过程中进行了以下环境修复：

1. **前端构建**：将 `.js` 文件中含 JSX 语法的文件批量重命名为 `.jsx`，以兼容 Vite 构建
2. **Vite 配置**：添加 `assetsInclude` 支持大写扩展名（`.PNG`）资源文件
3. **依赖安装**：安装缺失的 `sqlite3`、`prop-types` 依赖
4. **原生模块**：运行 `electron-rebuild` 重编译原生模块
5. **数据库文件**：创建 `db/init.db` 等必要的 SQLite 数据库文件
6. **配置文件**：创建空的 `config.txt` 以避免启动报错

---

## 截图目录

所有测试截图保存在 `test/screenshots/` 目录下。
