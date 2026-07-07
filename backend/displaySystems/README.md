# Display Systems

`backend/displaySystems` 是配置驱动展示系统的后端基础层。

目标不是立刻替换现有传感器 runtime，而是先定义一个稳定边界：以后新增展示系统时，可以把线序、点位顺序、算法数据和展示元数据放到一个目录里，由加载器统一发现、校验和注册。

## 目录约定

一个展示系统目录至少包含：

```text
my-system/
  display-system.json
  line-order.json
  point-order.json
  algorithm-data.json
```

`display-system.json` 示例：

```json
{
  "schemaVersion": 1,
  "id": "seat-64x64-demo",
  "name": "Seat 64x64 Demo",
  "version": "0.1.0",
  "sensor": {
    "type": "seat64x64",
    "matrix": {
      "rows": 64,
      "cols": 64
    },
    "ports": ["sit"]
  },
  "files": {
    "lineOrder": "line-order.json",
    "pointOrder": "point-order.json"
  },
  "algorithm": {
    "type": "none",
    "dataFile": "algorithm-data.json"
  },
  "display": {
    "views": ["heatmap"]
  }
}
```

## 模块职责

| 文件 | 职责 |
| :--- | :--- |
| `displaySystemConfigValidator.js` | 校验 manifest 的最小契约：系统身份、矩阵尺寸、线序文件、点位文件和算法声明。 |
| `displaySystemConfigLoader.js` | 从目录中发现 `display-system.json` 或 `system.json`，解析相对文件路径，并可校验引用文件是否存在。 |
| `displaySystemRegistry.js` | 保存已校验的展示系统配置，提供注册、查询、列表和快照能力。 |
| `index.js` | 对外统一导出 displaySystems 能力。 |

## 后续接入顺序

1. 把现有固定传感器逐步生成对应 manifest。
2. 在 HTTP 层增加展示系统查询接口。
3. 前端根据 manifest 动态生成展示页面。
4. 打包后从外部用户目录加载自定义展示系统。
