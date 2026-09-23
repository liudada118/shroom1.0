/**
 * 串口打开失败的原因分类与 Linux 权限修复。
 *
 * 分类不解析 error.message：其中的 strerror（「权限不够」/「Permission denied」）跟随系统语言，
 * 按关键字匹配会在其他语言的客户机器上失效。改为探测设备实际状态，与语言无关。
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const RULE_PATH = '/etc/udev/rules.d/99-shroom-serial.rules';
// USB 自报的 VID/PID 会被拼进以 root 执行的命令行，只接受四位十六进制
const USB_ID = /^[0-9a-f]{4}$/i;

const HINTS = {
  deviceMissing: {
    win32: '设备未出现在系统中。请确认数据线已插好；若是新电脑，多半是 USB 转串口驱动未安装，请安装 CH340 驱动后重新插拔。',
    darwin: '设备未出现在系统中。请确认数据线已插好；若始终不出现，请安装对应的 USB 转串口驱动。',
    linux: '设备未出现在系统中。请确认数据线已插好，然后重新插拔设备。',
  },
  permissionDenied: {
    linux: '当前用户没有该串口设备的读写权限。点击「修复权限」授权一次即可，无需重新登录。',
    darwin: '当前用户没有该串口设备的读写权限，请检查设备文件权限。',
    win32: '当前账户没有该串口的访问权限，请尝试以管理员身份运行。',
  },
  portBusy: {
    win32: '串口已被其他程序占用。请关闭串口调试助手等占用该端口的程序；若上次未正常退出，重启电脑可释放端口。',
    darwin: '串口已被其他程序占用，请关闭占用该端口的程序后重试。',
    linux: '串口已被其他程序占用，请关闭占用该端口的程序后重试。',
  },
};

function hintFor(kind, platform) {
  const byPlatform = HINTS[kind];
  if (!byPlatform) return '';
  return byPlatform[platform] || byPlatform.linux || '';
}

/** 从 serialport 的错误信息里取设备路径；路径本身不随系统语言变化。 */
function extractPath(message) {
  const match = /cannot open (.+)$/.exec(String(message ?? '').trim());
  return match ? match[1].trim() : '';
}

function isAccessible(devicePath, access = fs.accessSync) {
  try {
    access(devicePath, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 判断串口打开失败的原因。
 * @param {object} options
 * @param {string} options.path      目标设备路径，缺省时从 error 中提取
 * @param {Error}  options.error     serialport 抛出的错误
 * @param {Array}  options.ports     SerialPort.list() 的结果
 * @param {string} [options.platform] 默认取 process.platform
 * @param {Function} [options.access] 注入点，便于测试
 */
function classifyOpenFailure({ path: devicePath, error, ports = [], platform = process.platform, access }) {
  const target = devicePath || extractPath(error?.message);
  const known = ports.some(port => port.path === target);

  let kind;
  if (!target || !known) kind = 'deviceMissing';
  else if (platform !== 'win32' && !isAccessible(target, access)) kind = 'permissionDenied';
  else kind = 'portBusy';

  return {
    kind,
    path: target,
    platform,
    hint: hintFor(kind, platform),
    detail: error?.message ? String(error.message) : '',
  };
}

/** 只保留带合法 VID/PID 的真实 USB 转串口设备；/dev/ttyS* 这类主板虚拟串口没有 vendorId。 */
function selectFixableDevices(ports = []) {
  return ports.filter(port => USB_ID.test(port.vendorId || '') && USB_ID.test(port.productId || ''));
}

function buildUdevRule(devices) {
  const seen = new Set();
  const lines = [
    '# Shroom USB 转串口设备权限规则',
    '# 由 Shroom 自动生成，重新修复会覆盖。',
  ];

  for (const device of selectFixableDevices(devices)) {
    const vendorId = device.vendorId.toLowerCase();
    const productId = device.productId.toLowerCase();
    const key = `${vendorId}:${productId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // MODE="0666" 而非 GROUP="dialout"：后者要重新登录才生效，做不成一键修复
    lines.push(
      `SUBSYSTEM=="tty", ATTRS{idVendor}=="${vendorId}", ATTRS{idProduct}=="${productId}", MODE="0666"`
    );
  }

  return `${lines.join('\n')}\n`;
}

function runPrivileged(command, runner = spawn) {
  return new Promise((resolve, reject) => {
    const child = runner('pkexec', ['/bin/sh', '-c', command], { stdio: 'ignore' });
    child.on('error', error => reject(new Error(`无法调起授权对话框：${error.message}`)));
    child.on('exit', code => {
      if (code === 0) resolve();
      // pkexec 用 126 表示用户取消或授权失败
      else if (code === 126) reject(new Error('授权被取消'));
      else reject(new Error(`权限修复失败（退出码 ${code}）`));
    });
  });
}

/**
 * 安装 udev 规则并立即生效。仅 Linux 可用。
 * @param {Array} ports SerialPort.list() 的结果
 */
async function applyPermissionFix(ports, { platform = process.platform, runner, writeFile = fs.writeFileSync, removeFile = fs.rmSync } = {}) {
  if (platform !== 'linux') throw new Error('仅 Linux 需要修复串口权限');

  const devices = selectFixableDevices(ports);
  if (devices.length === 0) throw new Error('未检测到 USB 转串口设备，请插好设备后重试');

  const tempPath = path.join(os.tmpdir(), 'shroom-serial.rules');
  writeFile(tempPath, buildUdevRule(devices), { mode: 0o644 });

  const command = [
    `install -m 644 ${tempPath} ${RULE_PATH}`,
    'udevadm control --reload-rules',
    'udevadm trigger --subsystem-match=tty',
  ].join(' && ');

  try {
    await runPrivileged(command, runner);
  } finally {
    removeFile(tempPath, { force: true });
  }

  return devices.map(device => device.path);
}

/**
 * 把同一设备同一原因的重复告警压到每 30 秒一条，避免重连循环刷屏。
 */
function createThrottle(windowMs = 30000, now = () => Date.now()) {
  const seen = new Map();
  return function allow(key) {
    const last = seen.get(key);
    const current = now();
    if (last != null && current - last < windowMs) return false;
    seen.set(key, current);
    return true;
  };
}

function createSerialDiagnosticsProtocol({ sendJson, listPorts, applyFix = applyPermissionFix, platform = process.platform }) {
  return async function handle(message, client) {
    const request = message.serialDiag;
    const action = request?.action;
    const requestId = request?.requestId;

    try {
      const ports = await listPorts();
      if (action === 'inspect') {
        sendJson(client, {
          serialDiagResult: { ok: true, action, requestId, devices: selectFixableDevices(ports).map(p => p.path) },
        });
      } else if (action === 'fixPermission') {
        const fixed = await applyFix(ports, { platform });
        sendJson(client, {
          serialDiagResult: { ok: true, action, requestId, message: `已修复 ${fixed.join('、')} 的访问权限` },
        });
      } else {
        throw new Error('未知串口诊断操作');
      }
    } catch (error) {
      sendJson(client, { serialDiagResult: { ok: false, action, requestId, message: error.message } });
    }
  };
}

module.exports = {
  RULE_PATH,
  classifyOpenFailure,
  extractPath,
  selectFixableDevices,
  buildUdevRule,
  applyPermissionFix,
  createThrottle,
  createSerialDiagnosticsProtocol,
};
