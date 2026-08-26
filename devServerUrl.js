const ANSI_SEQUENCE = /\u001b\[[0-?]*[ -/]*[@-~]/g;

function stripAnsi(text) {
  return String(text ?? "").replace(ANSI_SEQUENCE, "");
}

function extractLocalViteUrl(output) {
  const cleanOutput = stripAnsi(output);
  const match = cleanOutput.match(
    /https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):\d+/i,
  );
  if (!match) return null;

  const detectedUrl = new URL(match[0]);
  if (["localhost", "[::1]", "::1"].includes(detectedUrl.hostname.toLowerCase())) {
    detectedUrl.hostname = "127.0.0.1";
  }
  return detectedUrl.origin;
}

module.exports = {
  extractLocalViteUrl,
  stripAnsi,
};
