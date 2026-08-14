export function sendWebSocketJson(socket, payload) {
  if (!socket || socket.readyState !== 1) return false;

  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch (_error) {
    return false;
  }
}
