# Python 健康监测算法

## 当前 Windows 算法（2026-10-15）

- 使用用户提供的“关怀2.0.14.2” `onbed_filter.cp311-win_amd64.pyd`，SHA-256 为 `0650ee61472710df08589a971d9c7c2ec991f23c98a55e658677099d4d8aa349`。
- 小床监测算法配置中的床型 `isLowBed`：`0` 高床/正常床（国内默认），`1` 矮床（日本版通常使用）。切换界面语言不会修改算法配置。
- `head_foot_area` 在该版本无效，不开放调节；原生接口仍要求此键，Python 桥固定补入 `float32[0,0]`。
- 配置升级为 v3，旧 v1/v2 参数在读取时兼容迁移，保存时写入新格式。
- Python 桥按 `health` 区分旧 ABI、仅灵敏度 ABI 与新版床型 ABI，避免新 Windows 参数破坏尚未更新的 macOS 原生库；床型设置需对应原生接口支持。
- 修改算法后执行 `npm run prepare-pack-resources` 重建并同步运行时；其中 `build-python-runtime` 自动运行原生库哈希与真实 JSON-line 健康检查，避免缓存旧包。安装版仍需重新打包安装。

## 目录结构

```
python/
├── app/
│   ├── onbed_filter_example.py          # 算法入口（stdin/stdout JSON 协议）
│   ├── onbed_filter.cp311-win_amd64.pyd # Windows 动态库
│   └── onbed_filter.cpython-311-darwin.so # macOS 动态库
├── build_exe.py                          # PyInstaller 打包脚本
└── README.md                             # 本文件
```

## 开发模式

开发阶段直接使用 Python 源文件运行，无需打包。

### 前提条件

- Python 3.11
- numpy

### 运行方式

`backend/kernel/algorithm-channel/pythonWorker.js` 会自动检测并调用系统 Python 运行 `onbed_filter_example.py`。

Windows 优先查找 `python/Python311/python.exe`，macOS/Linux 优先查找 `python/venv/bin/python`，找不到则回退到系统 Python。

## 打包模式（发布时使用）

```bash
cd python
pip install pyinstaller numpy
python build_exe.py
```

`onbed_filter` 是发布必需项。私有动态库默认放在 `python/app/`（Git 会忽略它）；CI 或其他
构建机也可以设置 `SHROOM_ONBED_FILTER_BINARY` 指向对应平台的 CPython 3.11 动态库。缺失时
构建会直接失败，避免生成表面成功、生命体征实际永久降级的安装包。

打包后将 `dist/onbed_server/` 目录复制到 Electron 项目的 `resources/python/` 目录下。

`backend/kernel/algorithm-channel/pythonWorker.js` 会自动检测 `onbed_server.exe`（Windows）或 `onbed_server`（macOS/Linux），优先使用打包后的可执行文件。

## 通信协议

Python 进程通过 stdin/stdout 与 Node.js 通信，使用 JSON 行协议：

### 请求格式（stdin）

```json
{"id": 1, "fn": "getData", "args": {"data": [0, 1, 2, ...]}}
```

### 响应格式（stdout）

```json
{"id": 1, "ok": true, "data": {"rate": 16, "heart_rate": 72, "stateInBbed": 1, "sosflag": 0}}
```

### 支持的函数

| 函数名 | 参数 | 说明 |
|--------|------|------|
| `ping` | 无 | 握手测试 |
| `getData` | `data`: 1024 个数值的数组 | 处理传感器数据，返回健康监测结果 |
| `run_display_system_algorithm` | `entry/raw_data/context/api_version/algorithm_package` | 调用 Display System V1 或 V2 算法 |
| `reset_display_system_algorithm` | `entry/reason` | 重置已加载 V2 算法的历史状态 |
| `shutdown_display_system_algorithm` | `entry` | 执行 shutdown 并从模块缓存移除 |

## Display System 算法 API

平台内置算法包位于 `agent-resources/algorithm-packages/`，并通过
`GET /api/display-systems/catalog` 的 `algorithmPackages` 字段提供给 Builder 和 Agent。选择后，
包 Manifest 与入口源码会复制到具体展示系统目录，运行时不依赖资源目录绝对路径。

当前注册包：`mattress-vitals`、`pet-care`、`pet-care-mini`、`foot-pressure-realtime`。
足压峰值帧、批量回放和 PDF 报告属于报告命令，不进入逐帧算法包下拉框。

V1 保持兼容：

```python
def calculate(raw_data, context):
    return {"data": context["normalized_data"], "metrics": {}}
```

V2 用于模型、滑动窗口和多传感器融合：

```python
def initialize(config, resources):
    pass

def process(request):
    seat = request["frames"]["seat"]["normalizedData"]
    back = request["frames"]["back"]["normalizedData"]
    return {"data": request["normalized_data"], "metrics": {"sensorCount": 2}}

def reset(reason):
    pass

def shutdown():
    pass
```

V2 的 `frames` 已经完成协议解码和线序/点位映射，键名是 manifest 的稳定 sensorId。算法不得
从 COM 名称、到达顺序或数组位置推断业务身份。`runtime.profile` 当前用于声明和诊断；实际可导入
的第三方库仍必须已经包含在打包的 Python 3.11 runtime 中。

### 返回字段说明

`mattress-vitals` 2.0.0 移除了 1.1.0 的压力代理 `respirationSignal`，原生包装层也不再生成
`respiration_waveform`。当前 `onbed_filter` 接口只有呼吸率等结果，没有明确的呼吸波形输出。
普通呼吸趋势可以将 `respirationRate` 每次返回的单值按时间入队，标题为“呼吸率趋势（次/分）”，
不要求算法返回整段数组。-1 未稳定、88 检测中不作为测量值入队，预热/异常时中断曲线并显示状态。
明确要求呼吸波形但算法不支持时才显示“不支持”；不能用平均压力、滤波矩阵或其趋势替代。
需要波形时应选择或经授权实现真正提供该信号的算法包；CoP 仍独立计算，不受呼吸算法异常影响。
已经安装的展示系统持有算法源码副本，不会随目录版本自动更新：升级时需明确替换该系统算法包，
普通趋势改绑 `respirationRate` 并维护时间队列；明确要求波形的图表才标记为不支持。
重新打包也不能自动迁移用户旧副本。

| 字段 | 类型 | 说明 |
|------|------|------|
| `rate` | float | 呼吸率（88=检测中，-1=未稳定） |
| `heart_rate` | float | 心率 (bpm) |
| `stateInBbed` | int | 在床状态（0=离床, 1=在床, 3=坠床, 4=坐起） |
| `sosflag` | int | SOS 紧急求助标志（0=正常, 1=紧急） |
| `reserved_bytes` | number[] | 完整保留算法预留位数组，缺失时为 `[]`，初始化返回的 `-1` 原样保留 |

`reserved_bytes` 按 1 起编号定义如下，程序读取时减 1：

| 位次 | 数组索引 | 含义 |
| --- | --- | --- |
| 1 | `[0]` | 平滑后 SNR（中值+IIR，乘10取整） |
| 2 | `[1]` | 呼吸信号最高突出度（乘10取整） |
| 3 | `[2]` | 大体动帧上传标志位 |
| 4 | `[3]` | 呼吸阈值调整 |
| 5 | `[4]` | 算法返回的灵敏度档位 |
| 6 | `[5]` | 算法返回的高矮床字段（0高床/正常床，1矮床） |

传输保留原始数值和其余尾部位置。第5/6位来自算法输出，不从当前输入配置补造，也不反向修改配置；此数组随实时 `rate` 消息传递，现有压力矩阵采集/回放/CSV不保存该数组。

小床监测的授权实时连接还会收到独立诊断字段：

```json
{"jqbedAlgorithmDiagnostics":{"sensorType":"jqbed","reserved_bytes":[126,43,1,6,0,1,-1,-1,-1,-1]}}
```

示例数组仅说明格式。正常生命体征结果中诊断字段与 `rate` 同包发送；呼吸率为 `-1` 时单独发送诊断，保留原有生命体征过滤逻辑。125ms是调用间隔，不保证这些字段每次都有有效输出。设置弹窗顶部显示第5位灵敏度（0～3）和第6位床型（0/1）的“算法最近有效返回”，0是有效值；两字段独立更新，中间帧缺失、-1或非法值不覆盖本会话已有有效值，尚无有效值时显示“未返回”。切系统、回放、页面连接断开或算法等待/异常后清空显示，不覆盖可编辑配置；后端仍完整透传原始数组。

### 实时原生返回

`getData(data, config=None, includeRawOutputs=False)` 默认保持原有兼容结果。当有设置页实时Log订阅时，后端按需传入 `includeRawOutputs: true`，结果额外包含 `raw_outputs`，完整保留原生输出字典的字段名、数组长度、0和-1；numpy值转为JSON值，非有限浮点转为null，未来新增字段也自动显示。

当前 Windows 关怀2.0.14.2 算法包独立实测有以下28个字段。数组长度来自该版本样本，不作为客户端裁剪或过滤规则；日志不使用桥中的兼容默认字段冒充原生结果。

| 类型 | 原生字段 |
| --- | --- |
| 呼吸与体动标量 | `rate`, `rate_minute`, `body_movement_data`, `body_movement_flag` |
| 在床与状态标量 | `state_in_bed`, `onbed_ratio`, `onbed_ratio_minute`, `onbed_state`, `awake_state` |
| 告警、阈值与时长标量 | `stroke_risk`, `sos_flag`, `merged_alarm`, `current_threshold`, `sitting_alarm_duration_minutes`, `on_bed_duration_minutes`, `runtime` |
| 1024点float32数组 | `matrix_origin[1024]`, `matrix_filter[1024]` |
| 其它float32数组 | `version_info[6]`, `alarm_counter[4]`, `merged_switch[8]`, `filter_param[6]`, `sos_param[6]`, `sitting_area_out[2]`, `reserved_bytes[10]`, `reserved_bytes20[20]` |
| uint8数组 | `sos_signal_out[159]`, `sos_coord[2]` |

WebSocket 请求 `{ "subscribeJqbedAlgorithmLog": true, "requestId": "..." }` 开启日志，false关闭；订阅应答为 `jqbedAlgorithmLogSubscription`。日志只发给有权查看实时小床监测的订阅客户端，事件格式如下：

```json
{"jqbedAlgorithmLog":{"sensorType":"jqbed","sequence":1,"receivedAt":"2026-10-16T00:00:00.000Z","outputs":{"rate":-1,"reserved_bytes":[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1]}}}
```

此事件仅展示部分字段以说明结构，实际 `outputs` 是完整原生字典。每次调用均发送最新结果，含中间-1帧；旧生命体征和采集协议不携带 `raw_outputs`。设置页“实时 Log”按用户要求逐字段保留最近一次非-1返回，不累积历史；后续-1和缺失字段不覆盖已有值，0正常更新。数组全为-1时跳过，混合有效数组整块替换，不跨帧拼接矩阵。尚无有效值的字段显示等待，数组与对象可展开查看完整内容，展开状态随新回传保持；各字段可能来自不同次回传，面板时间只表示最近接收时间。“当前显示值JSON”包含已获非-1的字段。离开此页停止接收，断线/会话切换清空，无磁盘日志或数据库列变更。

算法方提供的命令表仅更新设置页名称及参考说明，实际配置键、默认值、单位及校验保持不变。原生接口实测要求 `continuous_on_bed_duration_minutes`、`unlock_sitting_alarm_duration_minutes`、`filter_switch`、`sensitivity_threshold`；不能用命令表中的无单位别名、`filter_swtich` 或 `sit_mode` 直接替换调用键。时长仍按分钟传入，灵敏度仍为0～3档位，已确认无效的 `head_foot_area` 仍不开放。
