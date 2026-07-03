import { existsSync } from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const projectRoot = new URL("..", import.meta.url).pathname;
const clientRoot = new URL("../client/", import.meta.url).pathname;
const port = Number(process.env.PORT || 3010);
const url = process.env.CHECK_URL || `http://127.0.0.1:${port}/`;
const savedAccessKey = "cached-key-from-config";
const tolerance = 2;
const viewports = [
  { name: "macbook-air-1280x800", width: 1280, height: 800 },
  { name: "macbook-pro-1440x820", width: 1440, height: 820 },
  { name: "macbook-pro-1440x956", width: 1440, height: 956 },
  { name: "macbook-pro-1512x982", width: 1512, height: 982 },
];

function waitForHttp(targetUrl, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(targetUrl, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${targetUrl}`));
          return;
        }
        setTimeout(tick, 250);
      });
    };
    tick();
  });
}

const vite = spawn(
  "npm",
  ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  {
    cwd: clientRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  },
);

let viteOutput = "";
vite.stdout.on("data", (chunk) => { viteOutput += chunk.toString(); });
vite.stderr.on("data", (chunk) => { viteOutput += chunk.toString(); });

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const launchOptions = process.platform === "darwin" && existsSync(chromePath)
  ? { executablePath: chromePath }
  : {};

const failures = [];

try {
  await waitForHttp(url);
  const browser = await chromium.launch(launchOptions);
  try {
    const keyPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await keyPage.addInitScript((key) => {
      class MockWebSocket {
        static OPEN = 1;
        static CLOSED = 3;

        constructor() {
          this.readyState = MockWebSocket.OPEN;
          setTimeout(() => {
            this.onopen?.({});
            this.onmessage?.({ data: JSON.stringify({ savedAccessKey: key }) });
            this.onmessage?.({ data: JSON.stringify({ licenseError: "未检测到有效密钥，请输入密钥后使用", noLicense: true }) });
          }, 0);
        }

        send() {}
        close() {
          this.readyState = MockWebSocket.CLOSED;
          this.onclose?.({});
        }
      }

      window.WebSocket = MockWebSocket;
    }, savedAccessKey);
    await keyPage.goto(url, { waitUntil: "networkidle" });
    await keyPage.waitForSelector('input[aria-label="访问密钥"]', { timeout: 10000 });
    await keyPage.waitForTimeout(300);
    const inputValue = await keyPage.locator('input[aria-label="访问密钥"]').inputValue();
    if (inputValue !== savedAccessKey) {
      failures.push(`saved key was not prefilled: expected ${savedAccessKey}, got ${inputValue || "<empty>"}`);
    }
    await keyPage.close();

    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      await page.addInitScript((key) => {
        class MockWebSocket {
          static OPEN = 1;
          static CLOSED = 3;

          constructor() {
            this.readyState = MockWebSocket.OPEN;
            setTimeout(() => {
              this.onopen?.({});
              this.onmessage?.({ data: JSON.stringify({ savedAccessKey: key }) });
              this.onmessage?.({ data: JSON.stringify({ licenseError: "未检测到有效密钥，请输入密钥后使用", noLicense: true }) });
            }, 0);
          }

          send() {}
          close() {
            this.readyState = MockWebSocket.CLOSED;
            this.onclose?.({});
          }
        }

        window.WebSocket = MockWebSocket;
      }, savedAccessKey);
      await page.goto(url, { waitUntil: "networkidle" });

      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const portalPage = document.querySelector(".portal-page");
        const portalGrid = document.querySelector(".portal-grid");
        const footer = document.querySelector(".portal-footer");
        const feedback = document.querySelector(".portal-feedback-trigger");
        const bottom = Math.max(
          portalPage?.getBoundingClientRect().bottom ?? 0,
          portalGrid?.getBoundingClientRect().bottom ?? 0,
          footer?.getBoundingClientRect().bottom ?? 0,
          feedback?.getBoundingClientRect().bottom ?? 0,
        );

        return {
          clientHeight: doc.clientHeight,
          scrollHeight: Math.max(doc.scrollHeight, body.scrollHeight),
          contentBottom: bottom,
        };
      });

      const overflow = Math.max(
        metrics.scrollHeight - metrics.clientHeight,
        metrics.contentBottom - metrics.clientHeight,
      );

      if (overflow > tolerance) {
        failures.push(
          `${viewport.name}: content exceeds viewport by ${Math.ceil(overflow)}px ` +
          `(client=${metrics.clientHeight}, scroll=${metrics.scrollHeight}, bottom=${Math.ceil(metrics.contentBottom)})`,
        );
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }
} finally {
  vite.kill("SIGTERM");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("License portal regression check passed");
