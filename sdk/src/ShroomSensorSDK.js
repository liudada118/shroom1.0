const { SerialPort } = require('serialport');
const path = require('path');
const { ProtocolRegistry } = require('./protocol/ProtocolRegistry');
const { CaptureStore } = require('./storage/CaptureStore');
const { CsvExporter } = require('./export/CsvExporter');
const { SensorSession } = require('./serial/SensorSession');
const { DEFAULT_SENSOR_PROFILES } = require('./profiles');
const { createProjectLineOrderRegistry } = require('./line/projectLineOrders');
const { ZeroCalibrator } = require('./processing/ZeroCalibrator');
const { ReplayService } = require('./replay/ReplayService');
const { BackendCommandRouter } = require('./backend/BackendCommandRouter');
const { LicenseService } = require('./license/LicenseService');
const { PathService } = require('./config/PathService');
const { ReportService } = require('./report/ReportService');
const { createPortProbe, formatProbeResult } = require('./serial/PortProbe');
const { coverage: sensorCoverage, getSensor } = require('./sensors');

function hasWchSignature(port = {}) {
  const source = [
    port.path,
    port.manufacturer,
    port.friendlyName,
    port.pnpId,
    port.vendorId,
    port.productId,
  ].filter(Boolean).join(' ').toUpperCase();

  return source.includes('WCH') ||
    source.includes('CH34') ||
    source.includes('USB-SERIAL') ||
    source.includes('USB-ENHANCED-SERIAL') ||
    source.includes('1A86');
}

function summarizePort(port = {}) {
  return {
    path: port.path || '',
    manufacturer: port.manufacturer || '',
    serialNumber: port.serialNumber || '',
    pnpId: port.pnpId || '',
    vendorId: port.vendorId || '',
    productId: port.productId || '',
    friendlyName: port.friendlyName || '',
    locationId: port.locationId || '',
    isLikelySensorPort: hasWchSignature(port),
  };
}

class ShroomSensorSDK {
  constructor(options = {}) {
    this.options = options;
    this.dbDir = options.dbDir || path.join(process.cwd(), 'db');
    this.exportDir = options.exportDir || path.join(process.cwd(), 'data');
    this.registry = new ProtocolRegistry({
      ...DEFAULT_SENSOR_PROFILES,
      ...(options.profiles || {}),
    }, {
      lineOrders: options.lineOrders || createProjectLineOrderRegistry(options.extraLineOrders || {}),
    });
    this.store = options.store || null;
    this.exporter = options.exporter || null;
    this.zeroCalibrator = options.zeroCalibrator || new ZeroCalibrator();
    this.pathService = options.pathService || new PathService({
      dbDir: this.dbDir,
      exportDir: this.exportDir,
      imageDir: options.imageDir,
      reportDir: options.reportDir,
    });
    this.licenseService = options.licenseService || new LicenseService(options.license || {});
    this.commandRouter = options.commandRouter || new BackendCommandRouter();
    this.reportService = options.reportService || new ReportService({
      store: this.store,
      pythonClient: options.pythonClient,
    });
  }

  getStore() {
    if (!this.store) {
      this.store = new CaptureStore({
        dbDir: this.dbDir,
        dbPath: this.options.dbPath,
      });
      if (this.reportService && !this.reportService.store) {
        this.reportService.store = this.store;
      }
    }
    return this.store;
  }

  getExporter() {
    if (!this.exporter) {
      this.exporter = new CsvExporter({
        store: this.getStore(),
        exportDir: this.exportDir,
      });
    }
    return this.exporter;
  }

  /**
   * 查一个传感器的技术定义（矩阵、通道、波特率、协议）。
   * 未知类型返回 null —— 不要瞎猜，猜错的形状比报错难查得多。
   */
  describeSensor(sensorType) {
    return getSensor(sensorType);
  }

  registerProfile(sensorType, profile) {
    return this.registry.registerProfile(sensorType, profile);
  }

  registerLineOrder(name, handler) {
    return this.registry.lineOrders.register(name, handler);
  }

  listLineOrders() {
    return this.registry.lineOrders.list();
  }

  applyLineOrder(name, data, context = {}) {
    return this.registry.lineOrders.apply(name, data, context);
  }

  /**
   * 列出串口。
   *
   * options.probe 为 true 时会真去每个口上采一小段数据，把「插上了但不通」
   * 这类沉默故障变成结论 —— 见 diagnose()。probe 会独占串口，
   * 所以不要在已经 open() 的会话上同时调。
   */
  async listPorts(options = {}) {
    const ports = await SerialPort.list();
    const summarized = ports.map(summarizePort);
    const filtered = options.onlyLikelySensorPorts
      ? summarized.filter((port) => port.isLikelySensorPort)
      : summarized;
    if (!options.probe) {
      return filtered;
    }
    const probe = this.getPortProbe();
    const results = [];
    // 串行探测：两个探针同时抢同一根 USB 转串口芯片会互相干扰。
    for (const port of filtered) {
      results.push({
        ...port,
        probe: await probe.probePort(port.path, options),
      });
    }
    return results;
  }

  getPortProbe() {
    if (!this.portProbe) {
      this.portProbe = createPortProbe(this.options.probe || {});
    }
    return this.portProbe;
  }

  /**
   * 接入自检 —— 客户拿到 SDK 第一条该跑的命令。
   *
   * 回答的是「我插的东西到底通没通、是什么」，而不是「有哪些 COM 口」。
   * lines 可以直接打印给客户或贴进工单，比让人截图 DevTools 强。
   */
  async diagnose(options = {}) {
    const ports = await this.listPorts({
      ...options,
      probe: true,
      onlyLikelySensorPorts: options.onlyLikelySensorPorts !== false,
    });
    const lines = ports.map((port) => formatProbeResult(port.path, port.probe));
    const identified = ports.filter((port) => port.probe && port.probe.verdict === 'identified');
    if (ports.length === 0) {
      lines.push('没有发现疑似传感器串口。检查 USB 是否插好、CH34x 驱动是否装了；'
        + '如果确认插了，用 listPorts() 看全部串口，或 diagnose({ onlyLikelySensorPorts: false })。');
    }
    return {
      portCount: ports.length,
      identifiedCount: identified.length,
      ports,
      lines,
      coverage: sensorCoverage(),
    };
  }

  async open(options = {}) {
    const sensorType = options.sensorType || 'default';
    const profile = this.registry.getProfile(sensorType, options.profile || {});
    const channels = options.channels || {};
    const session = new SensorSession({
      sensorType,
      profile,
      registry: this.registry,
      channels,
      frameProcessor: (frame) => this.zeroCalibrator.apply(frame),
    });
    await session.open();
    return session;
  }

  startCapture(session, options = {}) {
    return session.startCapture({
      store: this.getStore(),
      ...options,
    });
  }

  stopCapture(session) {
    return session.stopCapture();
  }

  listCaptures(filter = {}) {
    return this.getStore().listCaptures(filter);
  }

  replay(options = {}) {
    const replayService = new ReplayService({ store: this.getStore() });
    return replayService.buildTimeline(options);
  }

  exportCsv(options = {}) {
    return this.getExporter().exportCapture(options);
  }

  close() {
    if (this.store) {
      this.store.close();
    }
  }
}

module.exports = {
  ShroomSensorSDK,
  summarizePort,
  hasWchSignature,
  formatProbeResult,
};
