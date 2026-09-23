/**
 * Linux 开发机串口权限修复。
 *
 * Linux 下 /dev/ttyUSB* 属于 root:dialout，非 dialout 成员打开会报「权限不够」。
 * 加入 dialout 组需要重新登录才生效，不适合一次性修复，因此这里改为安装 udev
 * 规则直接放开指定 VID:PID 设备的权限：安装后立即生效，重新插拔依然有效。
 *
 * 规则只针对当前插着的 USB 转串口设备，不会放开系统上其他串口。
 * Windows 与 macOS 无此问题，脚本在这两个平台上直接跳过。
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { SerialPort } = require("serialport");
const { RULE_PATH, buildUdevRule, selectFixableDevices } = require("../server/serialDiagnostics");

const DRY_RUN = process.argv.includes("--dry-run");

function log(message) {
  console.log(`[serial-permission] ${message}`);
}

async function listUsbSerialPorts() {
  // /dev/ttyS* 这类主板虚拟串口没有 vendorId；同时校验 VID/PID 合法性
  return selectFixableDevices(await SerialPort.list());
}

function installRule(content) {
  const tempPath = path.join(os.tmpdir(), "99-shroom-serial.rules");
  fs.writeFileSync(tempPath, content, { mode: 0o644 });

  const command = [
    `install -m 644 ${tempPath} ${RULE_PATH}`,
    "udevadm control --reload-rules",
    "udevadm trigger --subsystem-match=tty",
  ].join(" && ");

  try {
    return spawnSync("sudo", ["sh", "-c", command], { stdio: "inherit" }).status === 0;
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

function canAccess(devicePath) {
  try {
    fs.accessSync(devicePath, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (process.platform !== "linux") {
    log(
      `当前平台 ${process.platform} 无需处理：Windows 的 COM 口与 macOS 的 /dev/cu.* 默认即可打开。`
    );
    return;
  }

  const devices = await listUsbSerialPorts();
  if (devices.length === 0) {
    log("未检测到 USB 转串口设备，请插好设备后重新运行。");
    process.exitCode = 1;
    return;
  }

  log(`检测到 ${devices.length} 个 USB 转串口设备：`);
  for (const device of devices) {
    const state = canAccess(device.path) ? "可访问" : "权限不足";
    log(`  ${device.path}  ${device.vendorId}:${device.productId}  ${state}`);
  }

  const rule = buildUdevRule(devices);
  log(`将安装 udev 规则到 ${RULE_PATH}：`);
  console.log(rule.replace(/^(?=.)/gm, "    "));

  if (DRY_RUN) {
    log("--dry-run：仅预览，未修改系统。");
    return;
  }

  log("安装需要 sudo 授权，请按提示输入密码。");
  if (!installRule(rule)) {
    log("安装失败，规则未生效。");
    process.exitCode = 1;
    return;
  }

  // udevadm trigger 异步下发，给内核一点时间重新应用权限
  await new Promise((resolve) => setTimeout(resolve, 500));

  const blocked = devices.filter((device) => !canAccess(device.path));
  if (blocked.length > 0) {
    log(`以下设备仍无法访问，请重新插拔后确认：${blocked.map((d) => d.path).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  log("完成，设备现在可直接打开，无需重新登录。");
}

main().catch((error) => {
  log(`执行失败：${error.message}`);
  process.exitCode = 1;
});
