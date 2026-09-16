"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { inspectRelease } = require("../scripts/upload-release");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shroom-upload-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dist = path.join(root, "dist");
  fs.mkdirSync(path.join(dist, "win-unpacked", "resources"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "1.2.3", build: {
    publish: [{ provider: "generic", url: "https://shroom.jq-industries.com/shroom1" }],
  } }));
  const installer = "Shroom Setup 1.2.3.exe";
  const bytes = Buffer.from("test installer");
  fs.writeFileSync(path.join(dist, installer), bytes);
  fs.writeFileSync(path.join(dist, `${installer}.blockmap`), "test blockmap");
  fs.writeFileSync(path.join(dist, "latest.yml"), [
    "version: 1.2.3", `path: ${installer}`,
    `sha512: ${crypto.createHash("sha512").update(bytes).digest("base64")}`, "",
  ].join("\r\n"));
  fs.writeFileSync(path.join(dist, "win-unpacked", "resources", "app-update.yml"),
    "provider: generic\r\nurl: https://shroom.jq-industries.com/shroom1\r\n");
  return { root, dist, installer };
}

test("valid CRLF Windows release selects only the three update files", async (t) => {
  const { root, dist, installer } = fixture(t);
  fs.writeFileSync(path.join(dist, "old.exe"), "old release");
  const result = await inspectRelease(root);
  assert.deepEqual(result.files.map((file) => file.name), [installer, `${installer}.blockmap`, "latest.yml"]);
  assert.ok(result.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
});

test("rejects a build that still points to the previous update server", async (t) => {
  const { root, dist } = fixture(t);
  fs.writeFileSync(path.join(dist, "win-unpacked", "resources", "app-update.yml"),
    "url: http://sensor.bodyta.com/shroom1\n");
  await assert.rejects(inspectRelease(root), /different update URL/);
});

test("rejects modified installer bytes", async (t) => {
  const { root, dist, installer } = fixture(t);
  fs.appendFileSync(path.join(dist, installer), "corrupt");
  await assert.rejects(inspectRelease(root), /SHA-512/);
});

test("rejects missing blockmap before connecting to the server", async (t) => {
  const { root, dist, installer } = fixture(t);
  fs.unlinkSync(path.join(dist, `${installer}.blockmap`));
  await assert.rejects(inspectRelease(root), /ENOENT/);
});

test("rejects metadata from a different release version", async (t) => {
  const { root, dist } = fixture(t);
  const file = path.join(dist, "latest.yml");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("version: 1.2.3", "version: 1.2.2"));
  await assert.rejects(inspectRelease(root), /version differs/);
});
