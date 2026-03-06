# 传感器插件分析 - 差异维度提取

## 核心差异维度

### 1. 波特率 (baudRate)
- 921600: hand0205, footVideo, eye, daliegu, smallSample, robot*
- 3000000: bed4096, bed4096num
- 1000000: 其他所有类型（默认）

### 2. 数据帧长度 (buffer.length)
- 1024: 大多数标准传感器（32x32）
- 4096: bed4096, bed4096num（64x64）
- 256: bed1616, footVideo256（16x16）
- 72/144: hand0205 (手套特殊帧)
- 130/142/146/158/262: 各种特殊传感器
- 1025: 特殊标记帧

### 3. 线序映射函数 (lineMapper)
每种传感器有自己的线序映射函数，将原始数据重排为正确的矩阵排列：
- car -> carSitLine
- car10 -> car10Sit
- volvo -> wowSitLine
- smallBed -> jqbed
- hand -> jqbed + 镜像翻转
- gloves -> gloves
- footVideo -> footVideo
- 等等...

### 4. 是否多串口 (isCar)
isCar 组使用多串口（坐垫+靠背+头枕）：
- car, car10, yanfeng10, volvo, footVideo, hand0205, carQX, eye, sofa
非 isCar 组只使用单串口

### 5. WebSocket 通道数
- isCar 组: 使用 3 个 WebSocket (19999, 19998, 19997)
- 非 isCar 组: 只使用 1 个 WebSocket (19999)

### 6. 数据后处理
- 归零校准: 所有类型都支持
- 高斯平滑: 部分类型
- 压力计算: 部分类型 (press6, pressNew1220 等)
- 插值: 部分类型 (interpSmall)

### 7. 前端 3D 组件
每种传感器对应一个独立的 Three.js 组件

## 插件接口设计要点

每个插件需要提供：
1. id: 唯一标识 (如 'hand0205')
2. name: 显示名称 (如 '触觉手套')
3. baudRate: 波特率
4. multiPort: 是否多串口
5. frameSize: 数据帧大小
6. lineMapper(data): 线序映射函数
7. postProcess(data): 数据后处理函数
8. buildPayload(data): 构建 WebSocket 发送数据
9. 3D 组件引用
