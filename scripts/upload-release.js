"use strict";

// Windows NSIS releases only. Uses local OpenSSH; no npm upload dependency.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const quote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;

// Read the simple top-level scalar fields emitted by electron-builder.
// Do not try to interpret arbitrary YAML, nested structures or release notes.
function scalar(text, key) {
  const matches = [...text.replace(/\r\n/g, "\n").matchAll(new RegExp(`^${key}: ([^\\r\\n]+)$`, "gm"))];
  if (matches.length !== 1) throw new Error(`Missing or ambiguous ${key}`);
  const value = matches[0][1].trim();
  if (value.startsWith('"')) return JSON.parse(value);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

async function hash(file, algorithm, encoding) {
  const digest = crypto.createHash(algorithm);
  for await (const chunk of fs.createReadStream(file)) digest.update(chunk);
  return digest.digest(encoding);
}

async function inspectRelease(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const url = pkg.build.publish.find((entry) => entry.provider === "generic").url;
  const dist = path.join(root, "dist");
  const metadata = fs.readFileSync(path.join(dist, "latest.yml"), "utf8");
  const version = scalar(metadata, "version");
  if (version !== pkg.version) throw new Error("dist version differs from package.json; run npm run build first.");
  const installer = scalar(metadata, "path");
  if (!/^Shroom Setup [0-9A-Za-z.+-]+\.exe$/.test(installer)) {
    throw new Error("Unsupported installer filename; expected a single Shroom NSIS installer.");
  }
  const feedFile = path.join(dist, "win-unpacked", "resources", "app-update.yml");
  const feed = fs.readFileSync(feedFile, "utf8");
  if (scalar(feed, "url").replace(/\/$/, "") !== url.replace(/\/$/, "")) {
    throw new Error("Existing build contains a different update URL. Rebuild with npm run build before uploading.");
  }
  if (await hash(path.join(dist, installer), "sha512", "base64") !== scalar(metadata, "sha512")) {
    throw new Error("Installer SHA-512 does not match latest.yml; rebuild before uploading.");
  }
  const names = [installer, `${installer}.blockmap`, "latest.yml"];
  const files = [];
  for (const name of names) {
    const file = path.join(dist, name);
    if (!fs.statSync(file).size) throw new Error(`Empty release file: ${name}`);
    files.push({ name, file, sha256: await hash(file, "sha256", "hex") });
  }
  return { version, url, files };
}

function remoteScript(dir, stage, files) {
  const checks = files.map((file) => `${file.sha256}  ${file.name}`).join("\n") + "\n";
  return [
    "set -eu",
    `cd ${quote(stage)}`,
    `printf %s ${quote(checks)} | sha256sum -c -`,
    // Serialize publication. The temporary upload itself does not hold this lock.
    `mkdir ${quote(`${dir}/.publish-lock`)}`,
    `trap ${quote(`rmdir ${quote(`${dir}/.publish-lock`)}`)} EXIT`,
    // Never replace an existing version with different binary contents.
    ...files.slice(0, -1).map((file) =>
      `if [ -e ${quote(`${dir}/${file.name}`)} ]; then cmp -s ${quote(file.name)} ${quote(`${dir}/${file.name}`)}; fi`),
    ...files.map((file) => `chmod 644 ${quote(file.name)}`),
    ...files.slice(0, -1).map((file) => `mv -f ${quote(file.name)} ${quote(`${dir}/${file.name}`)}`),
    // Rename metadata last, on the same filesystem: clients see a complete release.
    `mv -f latest.yml ${quote(`${dir}/latest.yml`)}`,
    "cd /",
    `rmdir ${quote(stage)}`,
  ].join("\n");
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}); publication stopped.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--dry-run")) throw new Error("Usage: npm run upload [-- --dry-run]");
  const dir = process.env.SHROOM_UPLOAD_DIR || "/data/shroom1";
  if (!dir || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(dir)) {
    throw new Error("Set SHROOM_UPLOAD_DIR to the server directory, e.g. /data/shroom1 (not a URL).");
  }
  const release = await inspectRelease(projectRoot);
  const host = "root@shroom.jq-industries.com";
  const port = "20202";
  const stage = `${dir}/.upload-${crypto.randomUUID()}`;
  const options = ["-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3"];
  if (process.env.SHROOM_SSH_KEY) {
    const key = path.resolve(process.env.SHROOM_SSH_KEY);
    if (!fs.statSync(key).isFile()) throw new Error("SHROOM_SSH_KEY must point to a private key file.");
    options.push("-i", key, "-o", "IdentitiesOnly=yes");
  }
  console.log(`Release ${release.version} -> ${host}:${dir}`);
  for (const file of release.files) console.log(`  ${file.name}`);
  console.log(`Update URL: ${release.url}`);
  if (args.includes("--dry-run")) {
    console.log("Validation passed. Dry run: no server connections or uploads.");
    return;
  }
  console.log(process.env.SHROOM_SSH_KEY
    ? "Authenticating with the SSH key configured in SHROOM_SSH_KEY."
    : "Using default OpenSSH authentication; set SHROOM_SSH_KEY if a private key is required.");
  run("ssh", ["-p", port, ...options, host,
    `set -eu; test -d ${quote(dir)}; test -w ${quote(dir)}; umask 077; mkdir ${quote(stage)}`]);
  try {
    run("scp", ["-P", port, ...options, ...release.files.map((file) => file.file), `${host}:${stage}/`]);
    run("ssh", ["-p", port, ...options, host, remoteScript(dir, stage, release.files)]);
  } catch (error) {
    console.error(`Temporary files may remain in ${stage}. Inspect that directory before removing it.`);
    throw error;
  }
  console.log(`Published. Verify the public endpoint: ${release.url}/latest.yml`);
}

if (require.main === module) {
  main().catch((error) => { console.error(`[upload] ${error.message}`); process.exitCode = 1; });
}
module.exports = { scalar, inspectRelease, remoteScript };
