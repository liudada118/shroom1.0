# Offline Pressure Grid template

This directory is a minimal sandbox renderer package. The normative rules are
[`../../policy.json`](../../policy.json), and the installation workflow is
[`../SKILL.md`](../SKILL.md).

- Parse `app.json` and send it as `POST /api/agent-apps` body field `manifest`.
- Send both `frontend/index.html` and `frontend/app.js` as UTF-8 entries in `files`.
- Do not also send `app.json` in `files`; the installer creates it from `manifest`.
- Keep `overwrite: false` unless the user explicitly authorizes replacement of this exact id.
- After installation, select the renderer as `agent:pressure-grid-demo`.
- The host's dynamic response CSP is authoritative; do not add a meta CSP that could weaken it or block
  opaque-origin package assets.

The HTML and its external local script are fully offline. The script announces `shroom.renderer.ready` at startup
and after every valid idempotent `init`, accepts only parent-window
`shroom.renderer.init` and `shroom.renderer.frame` messages, renders the current route's `payload.values`, keeps
optional `payload.channels[]` state by full canonical `channelId`, and reports malformed messages through
`shroom.renderer.error`. Optional whitelisted `serial` metadata is displayed only as connection diagnostics.
The template is a single main-canvas visualization. Keep generated apps on this surface: charts are declared as
display-system formula `chartCards` are rendered by the host in the existing sidebar. When a formula cannot
express an XY or multi-series chart, add a local entry under `app.json.charts[]`; the host still mounts it in
that same sidebar, never inside the main renderer iframe.
