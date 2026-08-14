# 小床监测算法参数配置设计

**日期：** 2026-08-14

**目标分支：** `Revise`

**目标系统：** `jqbed`（小床监测 / Small Bed Monitor / 小型ベッドモニター）

## 1. 背景与目标

当前小床监测实时链路在 `server.js` 中读取压力帧，经 `pyWorker.js` 调用 `python/app/onbed_filter_example.py`，再由 `onbed_filter.pyd` 输出在床状态、呼吸、心率和 `sosflag` 等结果。算法输入参数目前由 Python 每帧创建固定默认值，软件界面无法调整，也无法在重启后保留调整结果。

本次为 `jqbed` 增加一套与现有页面风格一致的算法配置弹窗，使用户可以在正式软件内查看、修改、校验、保存和恢复算法参数。保存成功后，新配置从下一帧实时数据开始生效，并由后端持久化，软件重启后继续使用。

新增的 `python/app/serial_monitor_updated2.0(1).py` 仅作为参数字段及调用方式的参考资料。该文件不修改、不提交、不参与运行，也不进入安装包；最终用户只使用正式软件中的配置功能。

## 2. 范围

### 2.1 本次包含

- 仅为 `matrixName === 'jqbed'` 的“小床监测”增加算法配置入口。
- 在标题栏现有设置齿轮的左侧增加调节图标。
- 使用大尺寸深色模态弹窗展示全部 18 个算法参数。
- 前端通过 WebSocket 读取、保存和恢复后端配置。
- 后端统一负责默认值、校验、内存快照、原子持久化和广播同步。
- Python 算法入口接收经过校验的配置，并将其传给 `onbed_filter.pyd`。
- SOS 参数只影响 PYD 的计算输入；现有前端告警仍只消费 PYD 返回的 `sosflag`，不新增第二套前端 SOS 判断。
- 增加中文、英文、日文界面文案。

### 2.2 本次不包含

- 不为 `smallBed`、`smallBedNoAlg`、`smallBed12B` 或其他展示系统开放该配置。
- 不修改原始压力矩阵显示、采集、回放或 CSV 数据格式。
- 不用新配置重新计算历史数据。
- 不改变现有告警展示、音频播放和 `sosflag` 消费逻辑。
- 不把 Tkinter 调参工具或其界面代码复制进正式软件。
- 不把 `serial_monitor_updated2.0(1).py` 加入 Git 或安装包。

## 3. 当前链路与目标架构

当前实时链路：

```text
jqbed
  → server.js 周期读取压力帧
  → jqbedOppo(pointArr)
  → callPy('getData', { data })
  → pyWorker.js JSON Lines RPC
  → onbed_filter_example.py:getData(data)
  → create_default_inputs()
  → onbed_filter.pyd:ncz.step(inputs)
  → server 广播 rate
  → Home / Aside 使用 sosflag 等结果
```

目标链路：

```text
Title 调节图标
  → jqbed 算法配置弹窗
  → WebSocket 读取 / 保存
  → server.js
  → jqbedAlgorithmConfig 配置模块
      ├─ 默认值与校验
      ├─ 当前不可变配置快照
      └─ jqbed-algorithm-config.json 原子持久化
  → callPy('getData', { data, config })
  → onbed_filter_example.py:getData(data, config=None)
  → onbed_filter.pyd:ncz.step(inputs)
```

配置只在 `file === 'jqbed'` 的实时帧处理中传给 Python。`smallBed` 即使复用相同的展示组件或 Python worker，也继续使用原有默认输入，不读取本配置。

## 4. 参数模型

弹窗展示全部 18 个参数，并按以下四组组织。

### 4.1 基础参数

| 参数 | 默认值 | 类型 |
| --- | ---: | --- |
| `threshold_factor` | `0.0` | 非负有限数 |
| `continuous_on_bed_duration_minutes` | `0.0` | 非负有限数 |
| `unlock_sitting_alarm_duration_minutes` | `0.0` | 非负有限数 |

### 4.2 SOS 参数

| 参数 | 默认值 | 类型 |
| --- | ---: | --- |
| `sos_peak_threshold` | `0.0` | 非负有限数 |
| `points_threshold_in` | `0.0` | 非负有限数 |
| `sos_disable_area` | `[6.0, 10.0]` | 两元素范围数组 |
| `min_sos_sequence` | `0.0` | 非负整数 |

### 4.3 过滤参数

| 参数 | 默认值 | 类型与特殊语义 |
| --- | ---: | --- |
| `filter_switch` | `1.0` | 开关，传输为 `0` 或 `1` |
| `strel_switch` | `1.0` | 开关，传输为 `0` 或 `1` |
| `leave_bed_disable_area` | `[0.0, 0.0]` | 两元素范围数组；`0,0` 保留 PYD 内部默认值 `(6,8)` 的语义 |
| `small_object_size` | `[0.0, 0.0]` | 两元素尺寸数组；`0,0` 保留 PYD 内部默认值 `(3,4)` 的语义 |

### 4.4 高级参数

| 参数 | 默认值 | 类型与特殊语义 |
| --- | ---: | --- |
| `breath_detect_mode` | `0.0` | 非负整数 |
| `sitting_area` | `[0.0, 0.0]` | 两元素范围数组；`0,0` 使用内部默认 `(4,12)`，`255,255` 关闭识别 |
| `body_movement_threshold` | `30.0` | 非负有限数 |
| `step_leavebed_trigger` | `50.0` | 非负有限数 |
| `edge_align_ratio` | `0.0` | 非负有限数 |
| `head_foot_area` | `[0.0, 0.0]` | 两元素范围数组；`0,0` 使用内部默认 `(2,2)` |
| `breath_th` | `0.0` | 非负有限数 |

## 5. 校验规则

- 后端是最终校验边界，前端校验只用于即时反馈。
- 所有标量必须是有限数，禁止 `NaN`、无穷、空字符串和隐式字符串值进入 Python。
- 阈值和时长必须大于等于零。
- 计数、模式和序列类字段必须是大于等于零的整数。
- 开关字段只能是 `0` 或 `1`。
- 二元素字段必须长度为 2，元素均为有限数；普通矩阵行列值限制在 `0` 到 `32`。
- `sitting_area` 额外允许完整的 `255,255` 哨兵值；不接受单边为 `255` 的组合。
- `0,0` 的特殊语义必须原样保存和传递，不能擅自展开成内部默认值。
- 保存采用整份配置校验：任何字段失败时整次保存失败，不允许部分字段先行生效。
- 前端在字段旁展示错误信息，并在存在错误时禁用“保存并立即生效”。

## 6. 后端配置与持久化

新增独立的 jqbed 算法配置模块，负责：

- 定义冻结的默认配置和当前 schema 版本。
- 仅接收允许的 18 个键，拒绝未知键、缺失键及类型不符的数据。
- 返回复制后的不可变配置快照，避免帧处理期间出现部分修改。
- 启动时加载持久化文件；没有文件时使用默认值。
- 保存时先完整校验和标准化，再写临时文件，最后通过同目录重命名原子替换正式文件。
- 只有磁盘写入成功后才替换内存中的当前配置，避免界面显示已生效但重启后丢失。
- 保存成功后广播最新配置及保存时间，使多个软件窗口保持同步。

配置文件名固定为：

```text
jqbed-algorithm-config.json
```

路径规则：

- 打包环境：Electron `userData` 目录。
- 开发环境：项目运行目录下的开发配置位置，避免写入打包资源目录。

文件结构：

```json
{
  "version": 1,
  "values": {
    "threshold_factor": 0.0
  },
  "savedAt": "2026-08-14T00:00:00.000Z"
}
```

示例只省略了其余字段；正式文件的 `values` 必须包含完整的 18 个参数。

异常策略：

- 文件不存在：使用默认值，不视为错误。
- JSON 损坏、版本不兼容或字段非法：记录清晰日志并使用默认值，不阻断串口、Python worker 或监测页面启动。
- 写入失败：不更新当前内存配置，向前端返回失败原因。
- 恢复默认：用户二次确认后，将完整默认配置按同一原子流程持久化并立即应用。

## 7. WebSocket 协议与并发语义

使用现有前后端 WebSocket 通道增加以下消息，字段名称在实现时保持集中定义：

```js
// 读取
{ getJqbedAlgorithmConfig: true }

// 返回或广播
{
  jqbedAlgorithmConfig: {
    version: 1,
    values: { /* 完整 18 项 */ },
    savedAt: "2026-08-14T00:00:00.000Z"
  }
}

// 保存完整配置
{ setJqbedAlgorithmConfig: { /* 完整 18 项 */ } }

// 操作结果
{
  jqbedAlgorithmConfigResult: {
    ok: true,
    errors: null
  }
}
```

- 配置读写沿用现有许可证有效状态下的 WebSocket 处理边界。
- 保存请求仅在当前展示系统为 `jqbed` 时接受；其他系统返回明确拒绝结果。
- 每次保存都是完整快照，最后一个通过校验且成功落盘的请求获胜。
- 正在调用 Python 的帧继续使用调用开始时取得的旧快照；下一次定时帧读取新快照，不重启 PYD。
- 广播的配置是后端事实来源，前端收到后覆盖已保存状态。

## 8. Python 与 PYD 接入

Python RPC 入口调整为兼容形式：

```python
def getData(data, config=None):
    ...
```

- `config is None` 时保持原有 `create_default_inputs()` 行为，确保非 `jqbed` 调用兼容。
- 有配置时，先创建默认输入，只覆盖支持的 18 个键。
- 二元素数组转换为 PYD 期望的 `numpy.float32` 数组，并再次防御性检查长度和有限性。
- 标量转换为 PYD 当前契约所需的数字类型。
- 不改变 `frame_data`、返回结构、`sosflag`、`merged_alarm`、心率、呼吸或矩阵字段。
- Python 侧的防御性校验与 Node 规则一致；异常参数不得直接传入 PYD。
- 保存配置不重新初始化 `onbed_filter.pyd`，下一帧调用 `ncz.step(inputs)` 时自然应用新参数。

`server.js` 的帧调用语义为：

```js
const config = file === 'jqbed'
  ? getCurrentJqbedAlgorithmConfig()
  : undefined;

callPy('getData', { data: newArr, config });
```

## 9. 前端交互设计

### 9.1 入口

- 仅在 `matrixName === 'jqbed'` 时展示调节图标。
- 图标位于 Title 标题栏现有设置齿轮的左侧。
- 使用滑杆/调节类图标，悬停提示“算法配置”，并提供中、英、日三语文案。
- 历史回放期间图标保留但置灰禁用，提示“算法参数仅对实时监测生效”。

### 9.2 弹窗

- 使用覆盖当前监测画面的模态弹窗，不跳转独立页面。
- 背景遮罩使当前监测界面轻微变暗，但保留上下文。
- 弹窗宽度约 `920px`，最大高度约 `80vh`。
- 风格复用现有界面：标题背景 `#191932`、黑色控件、`#55aaff` 与 `#5A5A89` 蓝紫边框。
- 左侧或顶部提供“基础、SOS、过滤、高级”四类导航；SOS 默认展开或选中。
- 只让表单内容区域滚动，标题和底部操作区保持固定。
- 底部固定展示“恢复默认”“取消”“保存并立即生效”。
- 展示 PYD/算法服务状态和最后保存时间。
- 数组参数使用两个清晰的数字输入框；开关参数使用 Switch；其他字段使用数字输入框并展示说明。
- 保存过程中防止重复提交；成功后更新后端返回值和保存时间，失败时保留用户输入并显示错误。

前端组件应拆分为专用配置弹窗、字段元数据与纯校验/序列化辅助函数，避免继续扩大 `Title.jsx` 的业务体积。Title 只负责入口显示及弹窗打开状态。

## 10. SOS 行为边界

配置页可以修改四个 SOS 输入参数，但不在 JavaScript 中重新实现 SOS 算法：

```text
配置参数
  → onbed_filter.pyd
  → 返回 sosflag
  → 现有 Home / Aside 告警与音频逻辑
```

这保证显示、声音和算法只有一个最终判定来源。配置变化导致的 SOS 行为差异应来自 PYD 返回结果，而不是前端自行计算。

## 11. 打包与运行

- 正式修改落在现有 `python/app/onbed_filter_example.py`，由当前 Python runtime 构建脚本生成打包运行时。
- 按项目现有流程运行 `build-python-runtime` 和 `prepare-pack-resources`，确保 `pack-resources/python` 中的正式服务包含新接口。
- Electron 安装包继续从 `pack-resources/python` 携带 Python 服务。
- Tkinter 调参文件不参与 PyInstaller 入口、资源同步或 Electron `extraResources`。
- 运行配置写入 Electron `userData`，不会因升级或替换安装目录而丢失。
- 不提交本地生成的、已被忽略的大型 Python runtime 产物，除非仓库现有发布规则明确要求对应的受跟踪文件。

## 12. 测试与验收

### 12.1 后端单元测试

- 18 项默认值完整且不可被调用方修改。
- 标量、开关、整数、数组和特殊哨兵值校验正确。
- 未知键、缺失键、非有限数、越界值和非法数组整体拒绝。
- 无配置文件时使用默认值。
- 合法文件成功加载。
- 损坏、版本不兼容和字段非法的文件安全回退。
- 原子保存成功后替换当前快照；写入失败时旧快照保持不变。
- 恢复默认会落盘并广播。

### 12.2 Python 测试

- 使用假的 `ncz.step` 验证无配置时继续使用原默认输入。
- 验证有配置时只覆盖允许字段。
- 验证二元素数组的形状和 `numpy.float32` 类型。
- 验证非法配置不进入 PYD。
- 验证返回结构及 `sosflag` 不变。

### 12.3 前端测试

- 字段分组、默认值、校验和保存 payload 正确。
- 仅 `jqbed` 显示入口。
- 回放状态入口禁用并展示正确提示。
- SOS 默认选中，四类导航可切换。
- 非法输入禁用保存并显示字段错误。
- 保存成功、失败、恢复默认确认及服务状态展示正确。
- 优先使用纯函数和项目现有测试能力，不为此功能无必要地引入新的 DOM 测试体系。

### 12.4 构建与手工验收

- 运行新增的 Node、Python 和前端专项测试。
- 完成前端构建和 Python runtime 构建。
- 在小床监测实时页面确认图标位置、模态样式、滚动和固定底栏。
- 修改参数后确认下一帧开始使用新值，无需重启 PYD。
- 重启软件确认参数仍存在。
- 恢复默认并重启，确认默认值持久化。
- 输入非法值时确认后端不落盘、不生效。
- 切换到回放时确认入口置灰。
- 切换到其他展示系统时确认入口消失且算法配置不传入 Python。
- 调节 SOS 参数后，确认告警仍由 PYD 返回的 `sosflag` 驱动。
- 确认采集、回放、CSV 和原始压力矩阵没有行为变化。

## 13. 完成标准

满足以下条件后视为完成：

- `jqbed` 用户可在正式软件内配置全部 18 项参数。
- 配置通过后端完整校验、原子保存并从下一帧生效。
- 软件重启后恢复最后一次成功保存的配置。
- 恢复默认可立即生效并持久化。
- 回放和非 `jqbed` 系统不使用该配置。
- SOS 最终判定仍只有 PYD 返回的 `sosflag` 一个来源。
- 正式安装包不依赖或包含 `serial_monitor_updated2.0(1).py`。
- 专项测试、前端构建、Python runtime 构建和人工验收通过。
