const WebSocket = require("ws");

const { evaluateSdkAuthorization, getUpgradePath } = require("./auth");

function attachSdkEventStream(httpServer, options) {
  const { eventBus, getStatus, getHealth } = options;
  const wss = new WebSocket.Server({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = getUpgradePath(request.url);
    if (pathname !== "/api/v1/events") {
      socket.destroy();
      return;
    }

    const auth = evaluateSdkAuthorization({
      headers: request.headers,
      query: Object.fromEntries(new URL(request.url, "http://127.0.0.1").searchParams.entries()),
    });

    if (!auth.ok) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws) => {
    const send = (payload) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };

    send({
      type: "runtime.ready",
      timestamp: new Date().toISOString(),
      data: {
        health: getHealth(),
        status: getStatus(),
      },
    });

    const onEvent = (event) => send(event);
    eventBus.on("event", onEvent);

    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    const heartbeatTimer = setInterval(() => {
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }

      ws.isAlive = false;
      ws.ping();
    }, 30000);

    ws.on("close", () => {
      clearInterval(heartbeatTimer);
      eventBus.off("event", onEvent);
    });
  });

  return wss;
}

module.exports = {
  attachSdkEventStream,
};
