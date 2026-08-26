const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractLocalViteUrl,
  stripAnsi,
} = require("../devServerUrl");

test("uses the actual auto-incremented Vite port on the IPv4 loopback", () => {
  const output = "\u001b[32m➜\u001b[39m  Local:   http://localhost:3007/";
  assert.equal(extractLocalViteUrl(output), "http://127.0.0.1:3007");
});

test("keeps a Vite IPv4 loopback URL and ignores network addresses", () => {
  const output = [
    "Network: http://192.168.1.8:3002/",
    "Local: http://127.0.0.1:3002/",
  ].join("\n");
  assert.equal(extractLocalViteUrl(output), "http://127.0.0.1:3002");
});

test("normalizes IPv6 localhost to avoid another service bound on ::1", () => {
  assert.equal(
    extractLocalViteUrl("Local: http://[::1]:3010/"),
    "http://127.0.0.1:3010",
  );
});

test("removes complete ANSI control sequences from forwarded Vite logs", () => {
  assert.equal(stripAnsi("\u001b[1;32mready\u001b[39m"), "ready");
});
