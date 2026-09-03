# Shroom 内置 Python 算法包

这里的每个子目录都是可移植的 `algorithm-package.json + algorithm.py`。开发态从
`agent-resources/algorithm-packages` 发现，打包后从 `Resources/agent/algorithm-packages` 发现；
目录 API 将已校验包公开为 `catalog.algorithmPackages`，Builder 和 Agent 使用同一份列表。

当前可接入 Display System 实时帧链的包：

| id | 输入 | 主要输出 |
| --- | --- | --- |
| `mattress-vitals` | 32×32 / 1024 点 | 呼吸、心率、在离床、告警、压力系数、COP重心 |
| `pet-care` | 32×32 / 1024 点 | 宠物呼吸、姿态、体动、质量、离床 |
| `pet-care-mini` | 32×32 / 1024 点 | Mini 看护呼吸、姿态、体动、质量 |
| `foot-pressure-realtime` | 64×64 / 4096 点 | 左右脚压力、面积、COP 坐标与速度 |

这些适配器保持 `data = normalized_data`，只追加命名指标，避免算法选择改变实时、存储、回放
和 CSV 的标准矩阵真相。原生算法仍由打包的 Python 3.11 worker 提供；`singleton: true` 的包
复用原生全局模型状态，同一时间只应绑定一个活动数据源。

足压峰值帧、批量回放和 PDF 报告仍是报告命令，不属于逐帧 Display System 算法包；不要为了
“出现在下拉框”把文件生成副作用塞进实时数据链。
