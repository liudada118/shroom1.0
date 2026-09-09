# Python 健康监测算法

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

`pyWorker.js` 会自动检测并调用系统 Python 运行 `onbed_filter_example.py`。

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

`pyWorker.js` 会自动检测 `onbed_server.exe`（Windows）或 `onbed_server`（macOS/Linux），优先使用打包后的可执行文件。

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
