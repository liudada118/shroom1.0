# Shroom JS SDK

Minimal local client for the Shroom Runtime API.

## Quick Start

```bash
cd sdk/js
npm install
node examples/basic.js
```

## Usage

```js
const { ShroomClient } = require("./index");

const client = new ShroomClient({
  baseUrl: "http://127.0.0.1:19245",
  token: process.env.SHROOM_SDK_TOKEN || "",
});

async function main() {
  console.log(await client.health());
  console.log(await client.status());
  console.log(await client.listPorts());
  console.log(await client.probeDevice({ portPath: "COM3", sensorType: "car10" }));

  client.events.onFrame((frame) => {
    console.log(frame.channel, frame.frameLength, frame.frame);
  });

  client.events.on("device.status", (status) => {
    console.log("device.status", status);
  });

  client.events.on("collect.state", (state) => {
    console.log("collect.state", state);
  });
}

main().catch(console.error);
```

## Supported Calls

- `health()`
- `status()`
- `listPorts()`
- `refreshPorts()`
- `license()`
- `collectStatus()`
- `startCollect(options)`
- `stopCollect(options)`
- `probeDevice(options)`
- `connectDevice(options)`
- `disconnectDevice(options)`

## Supported Events

- `runtime.ready`
- `device.status`
- `device.error`
- `ports.updated`
- `collect.frame`
- `collect.state`
- `collect.saved`

Frame subscription example:

```js
client.events.onFrame((frame) => {
  console.log(frame.channel, frame.sensorType, frame.frameLength);
});

client.events.onFrame((frame) => {
  console.log(frame.frame);
}, { channel: "sit" });
```

Typical SDK flow:

```js
const ports = await client.listPorts();
await client.connectDevice({
  sensorType: "car10",
  sitPort: ports.ports[0]?.path,
});

await client.startCollect({
  sessionName: "customer-demo-001",
});

setTimeout(async () => {
  await client.stopCollect();
  console.log(await client.collectStatus());
}, 5000);
```
