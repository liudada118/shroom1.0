const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/** Read an OS installation identifier; raw values never leave this function or enter logs. */
function systemIdentity(platform = process.platform) {
  if (platform === 'win32') {
    const output = execFileSync('reg.exe', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true, timeout: 3000 });
    return /MachineGuid\s+REG_SZ\s+(\S+)/i.exec(output)?.[1];
  }
  if (platform === 'darwin') {
    const output = execFileSync('/usr/sbin/ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf8', timeout: 3000 });
    return /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(output)?.[1];
  }
  for (const file of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
    try { const value = fs.readFileSync(file, 'utf8').trim(); if (value) return value; } catch { /* Try the next OS source. */ }
  }
  return null;
}

/** Return a stable, namespaced computer digest; upgrades and different app installs share the OS identity. */
function getDeviceId(root, { readSystem = systemIdentity } = {}) {
  let identity;
  try { identity = readSystem(); } catch { /* Restricted systems use a persistent local identifier. */ }
  if (!identity) {
    fs.mkdirSync(root, { recursive: true });
    const file = path.join(root, 'device-identity');
    try { identity = fs.readFileSync(file, 'utf8').trim(); } catch { /* First use. */ }
    if (!/^[a-f0-9-]{36}$/i.test(identity || '')) {
      identity = randomUUID();
      fs.writeFileSync(file, identity, { encoding: 'utf8', mode: 0o600 });
    }
  }
  return createHash('sha256').update(`shroom.computer.v1\0${String(identity).trim().toLowerCase()}`).digest('hex');
}

module.exports = { getDeviceId, systemIdentity };
