# 敏枕文本协议（ASCII）

**JSON 预设**：❌ 没有。这不是二进制帧协议 —— 现有 schema 只能按字节偏移解，
没有文本协议入口，见 [schema 缺口](#schema-缺口)。

敏枕的**传感器通道**（`sensor`）发的是人可读的 ASCII 文本，不是压力矩阵。
压力矩阵走另一条通道（`sit`），用[标准 1024 帧](standard-1024.md)。
也就是说这个传感器**同时用两种协议**，别只配一个。

## 一帧长什么样

```
gyroscope: 123 -45 678 12 34 56  thermistor0: 25.3  thermistor1: 25.1  thermistor2: 24.9  humidity: 48.2
```

| 项 | 值 |
| :--- | :--- |
| 编码 | ASCII 文本 |
| 波特率 | **115200** —— 全系统最低，和所有压力协议都不同 |
| 帧头识别 | 正则 `/yroscope\s*:/i`（**故意少了首字母 g**，见下） |
| 帧尾识别 | 下一个帧头出现的位置；找不到时退而用 `/humidity\s*:\s*-?\d+(\.\d+)?/i` 的结尾 |
| 校验 | 无。靠必需字段是否齐全来决定收不收 |

## 帧头正则为什么少一个字母

`FRAME_START_PATTERN = /yroscope\s*:/i` 匹配的是 `yroscope:` 而不是 `gyroscope:`。
这不是笔误 —— **首字节丢失是这条链路的常态**（上电瞬间、缓冲截断都会吃掉第一个字符），
少匹配一个字母让 `gyroscope` 和残缺的 `yroscope` 都能被认出来。改成完整单词会开始丢帧。

## 必需字段：缺一个就整帧丢弃

`parseSensorFrame()` 有两道硬门槛，任何一条不满足就返回 `null`：

1. `gyroscope` 必须解出**至少 6 个数**（按 `[\t,\s]+` 切，取前 6 个）。
2. `thermistor0`、`thermistor1`、`thermistor2`、`humidity` **四个都必须存在**。

所以「文本看着来了但界面没数据」几乎总是某个字段没发或者名字对不上。

## 字段表

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `gyroscope` | 数字 × 6 | 原始陀螺仪值 |
| `angle_fb` | 派生 | `gyroscope[2] / 15000`，保留 2 位小数 |
| `angle_lr` | 派生 | `gyroscope[0] / 15000`，保留 2 位小数 |
| `thermistor0/1/2` | 数字 | 三路热敏温度 |
| `humidity` | 数字 | 湿度 |
| 其它键 | 字符串 | 原样 `trim()` 后透传，不做数值化 |

`/15000` 这个系数是硬编码的标定值，没有可配置入口。

## 文本缓冲的两个上限

| 常量 | 值 | 作用 |
| :--- | ---: | :--- |
| `TEXT_BUFFER_MAX_LENGTH` | 4096 | 缓冲超过就只保留末尾 4096 字符 |
| `TEXT_BUFFER_TAIL_LENGTH` | 64 | 找不到帧头时只留末尾 64 字符 |

意思是：**没找到帧头的垃圾数据会被丢掉，只留 64 字符做跨包拼接的余量**。
如果单帧文本可能超过 4096 字符，会被截断 —— 现在的字段量离这个上限很远。

## 压力矩阵那一路的两个额外处理

敏枕的 `sit` 通道是普通 1024 帧，但后端多做两步（不属于协议层）：

- `ZERO_POINT_INDEXES = [384, 416]` —— 这两个点**强制置零**，是已知的不稳定点。
- `BACKEND_GAUSS_RADIUS = 0.5` —— 后端先做一次半径 0.5 的高斯平滑，平滑后再置零一次。

也就是说敏枕的 384 / 416 号点在数据库里永远是 0，做分析时别当成真实读数。

## schema 缺口

| 缺什么 | 具体挡在哪 |
| :--- | :--- |
| **文本协议入口** | `framing` 只有 `delimiter` 和 `fixedLength`，都是按字节切 |
| 按键名取值 | `decoding` 是「偏移 + 类型」，没有「字段名 + 正则」的表达 |
| 派生字段 | `angle_fb` / `angle_lr` 是算出来的，schema 里没有计算表达式 |

补法：加 `framing.type: "text"`（帧头/帧尾正则）+ `decoding.fields: [{name, pattern, type}]`。
派生字段可以先不做，交给算法层。

## 代码位置

| 想看什么 | 位置 |
| :--- | :--- |
| 全部常量和解析 | `backend/sensors/minzhen.js` |
| 帧提取器 | 同文件 `createTextFrameExtractor()` / `takeNextTextFrame()` |
| 传感器定义 | `backend/sensors/registry.js` 的 `MINZHEN_TYPE` 条目（`channels: ['sit', 'sensor']`） |
| 波特率注入 | `backend/server/server.js` 的 `MINZHEN_SENSOR_BAUD_RATE` |

## 排错

| 现象 | 一般原因 |
| :--- | :--- |
| 串口有数据但全是乱码 | 波特率不是 115200 |
| 文本正常但界面无数据 | 四个必需字段缺了一个，或 `gyroscope` 不足 6 个数 |
| 角度值差了几个数量级 | `/15000` 这个系数与硬件量程不匹配（硬编码，要改代码） |
| 384 / 416 号点永远是 0 | 正常，是 `ZERO_POINT_INDEXES` 故意置零的 |
| 压力矩阵收不到 | `sit` 通道要按标准 1024 帧配（1000000 波特率），和 `sensor` 通道不是一套 |
