const net = require('node:net');
const os = require('node:os');
const { EventEmitter } = require('node:events');

const DATA_HEADER = Buffer.from([0xaa, 0x55, 0x03, 0x99]);
const PAYLOAD_LENGTH = 1024;

// One parser per TCP connection. ID is mandatory and belongs to this connection only.
class HalowFrameParser {
  constructor() {
    this.buffer = Buffer.alloc(0);
    this.deviceId = null;
    this.skippedBytes = 0;
  }

  feed(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.deviceId === null) {
      if (this.buffer.length < 4) return [];
      const length = this.buffer[3];
      if (this.buffer[0] !== 0xaa || this.buffer[1] !== 0x55 || this.buffer[2] !== 0 || length < 1 || length > 64) {
        throw new Error('设备首帧应为 AA 55 00 LL + 1～64 字节 ASCII ID');
      }
      if (this.buffer.length < 4 + length) return [];
      const id = this.buffer.subarray(4, 4 + length);
      if (id.some(value => value < 32 || value > 126)) throw new Error('设备 ID 包含非可显示 ASCII 字节');
      this.deviceId = id.toString('ascii');
      this.buffer = this.buffer.subarray(4 + length);
    }
    const frames = [];
    while (this.buffer.length) {
      const offset = this.buffer.indexOf(DATA_HEADER);
      if (offset < 0) {
        const discard = Math.max(0, this.buffer.length - 3);
        this.skippedBytes += discard;
        this.buffer = this.buffer.subarray(discard);
        break;
      }
      if (offset) {
        this.skippedBytes += offset;
        this.buffer = this.buffer.subarray(offset);
      }
      if (this.buffer.length < 4 + PAYLOAD_LENGTH) break;
      frames.push(Buffer.from(this.buffer.subarray(4, 4 + PAYLOAD_LENGTH)));
      this.buffer = this.buffer.subarray(4 + PAYLOAD_LENGTH);
    }
    return frames;
  }
}

function listLocalAddresses() {
  const addresses = [];
  for (const [name, rows] of Object.entries(os.networkInterfaces())) {
    for (const row of rows || []) {
      if (row.family === 'IPv4' || row.family === 4) {
        addresses.push({ address: row.address, name, internal: row.internal });
      }
    }
  }
  return addresses.sort((a, b) => Number(b.address === '192.168.100.2') - Number(a.address === '192.168.100.2')
    || Number(a.internal) - Number(b.internal));
}

class HalowReceiver extends EventEmitter {
  constructor({ getAddresses = listLocalAddresses, onFrame = () => {}, isAllowed = () => true } = {}) {
    super();
    this.getAddresses = getAddresses;
    this.onFrame = onFrame;
    this.isAllowed = isAllowed;
    this.listener = null;
    this.clients = new Map();
    this.config = { host: '', port: 12345 };
    this.phase = 'stopped';
    this.error = '';
    this.selectedDeviceId = null;
    this.nextClientId = 0;
    this.receivedFrames = 0;
    this.receivedBytes = 0;
    this.timer = null;
    this.operations = Promise.resolve();
    this.generation = 0;
  }

  get active() { return this.phase === 'starting' || this.phase === 'listening'; }

  snapshot() {
    const now = Date.now();
    return {
      phase: this.phase, running: this.active, ...this.config,
      selectedDeviceId: this.selectedDeviceId,
      receivedFrames: this.receivedFrames, receivedBytes: this.receivedBytes, error: this.error,
      addresses: this.getAddresses(),
      clients: [...this.clients.values()].map(client => {
        client.rate = client.rate.filter(event => event.at > now - 1000);
        return { clientId: client.id, deviceId: client.parser.deviceId, address: client.address,
          frames: client.frames, bytes: client.bytes, skippedBytes: client.parser.skippedBytes,
          fps: client.rate.reduce((sum, event) => sum + event.count, 0),
          ageMs: client.lastFrameAt ? now - client.lastFrameAt : null };
      }),
    };
  }

  publish() { this.emit('status', this.snapshot()); }

  enqueue(action) {
    const result = this.operations.then(action);
    this.operations = result.catch(() => {});
    return result;
  }

  start(options = {}) {
    const generation = this.generation;
    return this.enqueue(async () => {
      if (generation !== this.generation || !this.isAllowed()) throw new Error('当前展示系统或授权状态不允许开启 HaLow');
      if (this.active) throw new Error('HaLow 接收已开启，请先停止');
      const host = options.host;
      const port = Number(options.port);
      if (!net.isIPv4(host) || !this.getAddresses().some(item => item.address === host)) {
        throw new Error('请选择电脑连接网关的本机 IPv4 地址');
      }
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口范围为 1～65535');
      this.config = { host, port };
      this.phase = 'starting';
      this.error = '';
      this.receivedFrames = this.receivedBytes = 0;
      this.selectedDeviceId = null;
      const listener = net.createServer(socket => this.accept(socket));
      this.listener = listener;
      this.publish();
      try {
        await new Promise((resolve, reject) => {
          listener.once('error', reject);
          listener.listen({ host, port, exclusive: true }, () => {
            listener.removeListener('error', reject);
            resolve();
          });
        });
        if (generation !== this.generation || !this.isAllowed()) {
          await this.closeListener();
          throw new Error('启动已取消：展示系统或授权状态已改变');
        }
        listener.on('error', error => {
          this.error = error.message;
          this.stop().catch(() => {});
        });
        this.phase = 'listening';
        this.timer = setInterval(() => {
          if (!this.isAllowed()) { this.stop().catch(() => {}); return; }
          this.publish();
        }, 500);
        this.timer.unref?.();
        this.publish();
      } catch (error) {
        if (this.listener === listener) this.listener = null;
        this.phase = 'stopped';
        this.error = error.code === 'EADDRINUSE'
          ? `${host}:${port} 已被占用，请先停止 Python 试用页或原厂软件的接收服务`
          : error.message;
        this.publish();
        throw new Error(this.error);
      }
    });
  }

  async closeListener() {
    clearInterval(this.timer);
    this.timer = null;
    const listener = this.listener;
    this.listener = null;
    for (const client of this.clients.values()) {
      clearTimeout(client.idTimeout);
      client.socket.destroy();
    }
    this.clients.clear();
    if (listener) await new Promise(resolve => listener.close(() => resolve()));
  }

  stop() {
    this.generation += 1;
    this.phase = 'stopping';
    return this.enqueue(async () => {
      await this.closeListener();
      this.phase = 'stopped';
      this.emit('clear');
      this.publish();
    });
  }

  select(deviceId) {
    if (!this.active || ![...this.clients.values()].some(c => c.parser.deviceId === deviceId)) {
      throw new Error('所选设备当前不在线');
    }
    this.selectedDeviceId = deviceId;
    this.emit('clear');
    this.publish();
  }

  accept(socket) {
    if (!this.isAllowed() || !this.active || this.clients.size >= 16) { socket.destroy(); return; }
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 5000);
    const client = { id: ++this.nextClientId, socket, parser: new HalowFrameParser(), frames: 0, bytes: 0,
      lastFrameAt: 0, rate: [], address: `${socket.remoteAddress}:${socket.remotePort}` };
    this.clients.set(client.id, client);
    client.idTimeout = setTimeout(() => {
      this.error = `设备 ${client.address} 在 10 秒内没有发送完整 ID 帧`;
      socket.destroy();
    }, 10000);
    client.idTimeout.unref?.();
    socket.on('data', chunk => {
      if (!this.isAllowed() || !this.active) { socket.destroy(); return; }
      try {
        const wasIdentified = client.parser.deviceId !== null;
        client.bytes += chunk.length;
        this.receivedBytes += chunk.length;
        const frames = client.parser.feed(chunk);
        if (!wasIdentified && client.parser.deviceId !== null) {
          clearTimeout(client.idTimeout);
          const duplicate = [...this.clients.values()].find(c => c !== client && c.parser.deviceId === client.parser.deviceId);
          if (duplicate) throw new Error(`设备 ID 重复：${client.parser.deviceId}，请为每块 B 板配置独立 ID`);
          if (this.selectedDeviceId === null) this.selectedDeviceId = client.parser.deviceId;
          this.publish();
        }
        if (frames.length) {
          const now = Date.now();
          client.lastFrameAt = now;
          client.frames += frames.length;
          this.receivedFrames += frames.length;
          client.rate.push({ at: now, count: frames.length });
          if (client.rate.length > 4096) client.rate.splice(0, client.rate.length - 4096);
          if (client.parser.deviceId === this.selectedDeviceId) {
            for (const frame of frames) this.onFrame(frame, { deviceId: client.parser.deviceId, clientId: client.id });
          }
        }
      } catch (error) {
        this.error = error.message;
        socket.destroy();
      }
    });
    socket.on('error', error => { this.error = `${client.address}：${error.message}`; });
    socket.on('close', () => {
      clearTimeout(client.idTimeout);
      this.clients.delete(client.id);
      if (client.parser.deviceId === this.selectedDeviceId
          && ![...this.clients.values()].some(c => c.parser.deviceId === this.selectedDeviceId)) this.emit('clear');
      this.publish();
    });
    this.publish();
  }
}

function createHalowProtocol({ receiver, getContext, sendJson }) {
  return async function handle(message, client) {
    const request = message.halow;
    const action = request?.action;
    const requestId = request?.requestId;
    try {
      const context = getContext();
      if (action === 'status') {
        if (!context.licenseValid) throw new Error('请先完成软件授权');
      } else if (action === 'stop') {
        // Stopping an existing listener remains available if a license expires.
        await receiver.stop();
      } else {
        if (!context.licenseValid || context.file !== 'humanBodyOptimized') throw new Error('仅假人全身优化系统可使用 HaLow 接收');
        if (context.playback || context.collecting) throw new Error('请先退出回放或停止采集，再调整 HaLow 连接');
        if (action === 'start') {
          if (context.serialOpen) throw new Error('请先关闭串口，避免串口和 HaLow 数据混用');
          await receiver.start(request);
        } else if (action === 'select') receiver.select(request.deviceId);
        else throw new Error('未知 HaLow 操作');
      }
      sendJson(client, { halowStatus: receiver.snapshot(), halowResult: { ok: true, action, requestId } });
    } catch (error) {
      sendJson(client, { halowStatus: receiver.snapshot(), halowResult: { ok: false, action, requestId, message: error.message } });
    }
  };
}

module.exports = { HalowFrameParser, HalowReceiver, listLocalAddresses, createHalowProtocol, PAYLOAD_LENGTH };
