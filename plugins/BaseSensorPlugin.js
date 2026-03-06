/**
 * BaseSensorPlugin - 传感器插件基类
 * 
 * 所有传感器插件都必须继承此基类并实现其抽象方法。
 * 主应用通过此统一接口与所有传感器交互，消除了 if/else 分支。
 * 
 * 使用方式:
 *   const { BaseSensorPlugin } = require('./plugins/BaseSensorPlugin');
 *   class Hand0205Plugin extends BaseSensorPlugin { ... }
 */

class BaseSensorPlugin {
  /**
   * @param {object} config - 插件配置
   * @param {string} config.id - 唯一标识符，如 'hand0205'
   * @param {string} config.name - 显示名称，如 '触觉手套'
   * @param {number} config.baudRate - 串口波特率
   * @param {boolean} config.multiPort - 是否使用多串口（坐垫+靠背+头枕）
   * @param {number[]} config.frameSizes - 支持的数据帧长度数组，如 [1024] 或 [72, 144, 1024]
   * @param {number} config.matrixWidth - 矩阵宽度，如 32
   * @param {number} config.matrixHeight - 矩阵高度，如 32
   * @param {string} [config.group] - 传感器分组，如 'car', 'bed', 'hand', 'foot', 'robot', 'other'
   * @param {string} [config.threeComponent] - 前端 3D 组件名称
   */
  constructor(config) {
    if (new.target === BaseSensorPlugin) {
      throw new Error('BaseSensorPlugin 是抽象类，不能直接实例化');
    }

    // 必填字段校验
    const required = ['id', 'name', 'baudRate', 'multiPort', 'frameSizes', 'matrixWidth', 'matrixHeight'];
    for (const field of required) {
      if (config[field] === undefined) {
        throw new Error(`插件 ${config.id || 'unknown'} 缺少必填配置: ${field}`);
      }
    }

    this.id = config.id;
    this.name = config.name;
    this.baudRate = config.baudRate;
    this.multiPort = config.multiPort;
    this.frameSizes = config.frameSizes;
    this.matrixWidth = config.matrixWidth;
    this.matrixHeight = config.matrixHeight;
    this.group = config.group || 'other';
    this.threeComponent = config.threeComponent || null;
  }

  /**
   * 线序映射 - 将原始串口数据重排为正确的矩阵排列
   * 这是每个传感器最核心的差异点
   * 
   * @param {number[]} rawData - 原始数据数组
   * @returns {number[]} 映射后的数据数组
   */
  mapLineOrder(rawData) {
    // 默认不做映射，子类必须覆盖
    return rawData;
  }

  /**
   * 数据后处理 - 在线序映射之后、发送之前的额外处理
   * 例如：分压、翻转、特殊变换等
   * 
   * @param {number[]} mappedData - 线序映射后的数据
   * @param {object} context - 上下文信息
   * @param {number[]} context.zeroData - 归零基准数据（如果有）
   * @param {object} context.config - 当前运行时配置
   * @returns {number[]} 处理后的数据
   */
  postProcess(mappedData, context) {
    // 默认不做额外处理，子类可选覆盖
    return mappedData;
  }

  /**
   * 构建 WebSocket 发送数据包
   * isCar 组需要包含 sitFlag/backFlag，非 isCar 组只需 sitData
   * 
   * @param {object} params
   * @param {number[]} params.sitData - 坐垫/主数据
   * @param {number[]} [params.backData] - 靠背数据（多串口时）
   * @param {number[]} [params.headData] - 头枕数据（多串口时）
   * @param {boolean} [params.sitFlag] - 坐垫串口是否连接
   * @param {boolean} [params.backFlag] - 靠背串口是否连接
   * @param {number} params.hz - 采集频率
   * @param {object} [params.extra] - 额外数据（如手套的旋转数据）
   * @returns {string} JSON 字符串
   */
  buildPayload(params) {
    if (this.multiPort) {
      return JSON.stringify({
        sitData: params.sitData,
        sitFlag: params.sitFlag || false,
        backFlag: params.backFlag || false,
        hz: params.hz,
        ...(params.extra || {}),
      });
    }
    return JSON.stringify({
      sitData: params.sitData,
      hz: params.hz,
      ...(params.extra || {}),
    });
  }

  /**
   * 构建数据库存储数据
   * 不同传感器存储的数据格式可能不同（如手套需要额外存储旋转数据）
   * 
   * @param {object} params
   * @param {number[]} params.sitData - 主数据
   * @param {object} [params.extra] - 额外数据
   * @returns {string} 要存入数据库的 JSON 字符串
   */
  buildStorageData(params) {
    return JSON.stringify(params.sitData);
  }

  /**
   * 处理靠背数据的线序映射（仅多串口类型需要覆盖）
   * 
   * @param {number[]} rawData - 原始靠背数据
   * @returns {number[]} 映射后的靠背数据
   */
  mapBackLineOrder(rawData) {
    return rawData;
  }

  /**
   * 处理头枕数据的线序映射（仅多串口类型需要覆盖）
   * 
   * @param {number[]} rawData - 原始头枕数据
   * @returns {number[]} 映射后的头枕数据
   */
  mapHeadLineOrder(rawData) {
    return rawData;
  }

  /**
   * 判断该插件是否能处理指定长度的数据帧
   * 
   * @param {number} frameLength - 数据帧长度
   * @returns {boolean}
   */
  canHandleFrame(frameLength) {
    return this.frameSizes.includes(frameLength);
  }

  /**
   * 获取插件的元数据（用于前端展示）
   * 
   * @returns {object}
   */
  getMeta() {
    return {
      id: this.id,
      name: this.name,
      group: this.group,
      multiPort: this.multiPort,
      matrixWidth: this.matrixWidth,
      matrixHeight: this.matrixHeight,
      threeComponent: this.threeComponent,
    };
  }
}

module.exports = { BaseSensorPlugin };
