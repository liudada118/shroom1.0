const { ShroomClient } = require("../index");

async function main() {
  const client = new ShroomClient({
    baseUrl: "http://127.0.0.1:19245",
    token: process.env.SHROOM_SDK_TOKEN || "",
  });

  const health = await client.health();
  const status = await client.status();

  console.log("health:", health);
  console.log("status:", status);
  console.log("collect:", await client.collectStatus());

  client.events.onFrame((frame) => {
    console.log("frame:", frame.channel, frame.frameLength);
  });

  client.events.on("device.status", (data) => {
    console.log("device.status", data);
  });

  client.events.on("collect.state", (data) => {
    console.log("collect.state", data);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
