# 展示系统 MVP 输入模板

如果只做单垫 MVP，不需要填写本目录全部文件，直接使用上一级的
`展示系统简易需求模板.md` 即可。本目录保留给多传感器、算法包或正式验收场景。

这是一份交给 Agent 的“需求输入包”，不是最终的 `display-system.json`。复制整个目录、按实际设备
填写后，把目录路径交给 Agent 即可。Agent 应读取运行中软件公开的契约、协议预设和组件目录，生成
并安装最终展示系统，不修改软件永久后端。

打包后的默认位置：

```text
<软件安装目录>\resources\agent\templates\display-system-mvp-input\
```

## 最小必填文件

1. `01-system.json`：展示系统名称、功能范围及是否授权 Agent 生成代码。
2. `02-sensors.csv`：每个物理传感器的业务身份、矩阵、串口和文件对应关系。
3. `sensors/<sensor-id>/protocol.json`，或把原始协议文档放进 `attachments/`。
4. `sensors/<sensor-id>/line-order.csv`：线序；恒等线序也要明确写出或注明。
5. `sensors/<sensor-id>/sample-frames.csv`：至少一帧真实原始数据，推荐无压力与有压力各一帧。
6. `03-display.json`：希望使用的展示、图表和配色。

算法不是必填。只有需要滤波、标定、特征计算或多传感器融合时填写 `04-algorithm.md`。

## 使用方法

1. 复制本目录并改名，例如 `my-seat-cushion-20260901`。
2. 每增加一个传感器，就复制一份 `sensors/cushion/`，目录名改成稳定的 sensor id。
3. 在 `02-sensors.csv` 增加对应行，文件路径必须指向该传感器自己的目录。
4. 把厂家协议、线序表、照片、模型等原文件放入 `attachments/`，不要覆盖模板文件。
5. 启动打包软件并接好设备。
6. 将 `给Agent的任务说明.md` 的内容和本目录绝对路径一起交给 Agent。

## 必须遵守的填写规则

- `displaySystem.id`、`sensor_id` 使用稳定英文标识，只能用字母、数字和连字符，不使用冒号。
- `business_label` 明确写“座椅、靠背、左手、右手”等业务含义，不能让 Agent 根据 COM 号猜。
- `output_channel` 在同一系统内唯一；建议与 sensor id 相同。
- COM 口只是本次探测入口，换电脑可能变化，不会保存为业务身份。
- `line-order.csv` 的 `source_position_1_based` 从 **1** 开始。
- `output_row/output_col` 从 **0** 开始。
- 协议解码点数与最终展示点数可以不同，不要为了匹配矩阵而修改真实协议帧长度。
- 原始协议文档优先保留，不要只给截图；如果只有截图，也要同时提供一帧原始十六进制数据。
- 不要在输入包中放密码、授权密钥或其它账号凭据。

## 多传感器

多串口时 `02-sensors.csv` 每个物理传感器一行，每路使用独立目录。业务身份始终来自该表，不能来自
串口顺序、协议类型或数据到达顺序。需要融合算法时，在 `04-algorithm.md` 明确输入 sensor id、触发
sensor 和允许的软件时间偏差。

## 完成标准

最终验收使用 `05-acceptance.md`。至少要证明实时展示、采集、回放和 CSV 在相同 canonical channelId
下使用同一份处理后数组，并完成一次断开重连测试。
