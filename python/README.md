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

| 字段 | 类型 | 说明 |
|------|------|------|
| `rate` | float | 呼吸率（88=检测中，-1=未稳定） |
| `heart_rate` | float | 心率 (bpm) |
| `stateInBbed` | int | 在床状态（0=离床, 1=在床, 3=坠床, 4=坐起） |
| `sosflag` | int | SOS 紧急求助标志（0=正常, 1=紧急） |
