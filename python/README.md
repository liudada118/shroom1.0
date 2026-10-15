# Python 健康监测算法

## 当前 Windows 算法（2026-10-15）

- 使用用户提供的“关怀2.0.14.2” `onbed_filter.cp311-win_amd64.pyd`，SHA-256 为 `0650ee61472710df08589a971d9c7c2ec991f23c98a55e658677099d4d8aa349`。
- 小床监测算法配置中的床型 `isLowBed`：`0` 高床/正常床（国内默认），`1` 矮床（日本版通常使用）。切换界面语言不会修改算法配置。
- `head_foot_area` 在该版本无效，不开放调节；原生接口仍要求此键，Python 桥固定补入 `float32[0,0]`。
- 配置升级为 v3，旧 v1/v2 参数在读取时兼容迁移，保存时写入新格式。
- 修改算法后执行 `npm run prepare-pack-resources` 重建并同步运行时；再执行 `npm run check-python-runtime-health`。构建和开发启动都会校验源码与运行时 PYD 的实际哈希，避免缓存旧包。安装版仍需重新打包安装。

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

### 返回字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `rate` | float | 呼吸率（88=检测中，-1=未稳定） |
| `heart_rate` | float | 心率 (bpm) |
| `stateInBbed` | int | 在床状态（0=离床, 1=在床, 3=坠床, 4=坐起） |
| `sosflag` | int | SOS 紧急求助标志（0=正常, 1=紧急） |
