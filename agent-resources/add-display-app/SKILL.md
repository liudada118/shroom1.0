---
name: add-display-app
description: Create and install a local, offline Shroom display app using a built-in renderer or a sandboxed agent renderer without modifying the permanent backend pipeline.
---

# Add Display App

Use this skill only for display-app generation and installation. The authoritative machine rules are
[`../policy.json`](../policy.json). Read that file completely before doing any work; this document is a workflow,
not a replacement for the policy.

## Non-negotiable boundary

- Do not modify `app/electron/`, `backend/`, `sdk/backend/`, `client/`, the stable contract, SQLite schema,
  WebSocket gateway, playback, CSV, `package.json`, or packaged application files.
- Install through `POST /api/agent-apps`. App files are local data consumed by the sandbox host, not application
  source patches.
- Renderer code is presentation-only. It never opens serial ports, SQLite, arbitrary HTTP, WebSocket, Electron
  IPC, Node, shell, or the filesystem, and it never downloads a dependency. If the live host explicitly allows
  it, `fetch` may read only a packaged file below this app's exact `/api/agent-apps/:id/files/` prefix.
- The sandbox is a capability boundary for reviewed packaged code, not a guarantee against malicious code or
  CPU/memory exhaustion. Review source and assets before installation; forbid navigation, dynamic downloads,
  obfuscation, and deliberately resource-exhausting work.
- Never read or generate top-level `sitData`, `backData`, or `headData`. Values arrive only in the sandbox frame
  message described below, projected from canonical `sensor.frame.payload.value`.
- Never infer a business role from COM, protocol, port order, frame order, or array index. Keep every route keyed
  by the full canonical `channelId`; show the host-provided `sensorLabel`.

If the request cannot be completed inside those boundaries, stop and explain which platform capability is missing.

## Required discovery

Before creating files, call these APIs in order:

1. `GET /api/sdk/contract` — this response is the raw contract object, not an `HttpResult` and not `data.*`.
   Use its live routes, stable contract versions, available channels, algorithms, protocol presets, and
   renderer/catalog capabilities. Do not rely on remembered values.
2. `GET /api/agent-apps/policy` — require `data.policy.schemaVersion === 1` and obey the returned policy.
3. `GET /api/agent-apps` — inspect `data.apps` and do not reuse an existing id unless the user explicitly asks
   to replace that exact app.

Stop on an unavailable or incompatible contract. Do not work around a missing API by editing the application.

## Choose the renderer

Prefer an exact built-in renderer id advertised by the live contract/catalog when it can express the requested
view. Do not guess a built-in name.

Use a custom app only when needed. After installation, its platform renderer id is `agent:<appId>`, where
`appId` is `app.json.id`. The internal `renderer.id` defaults to `main`; it is not the platform selector.

## Start from the template

Copy [`template/app.json`](template/app.json) and
[`template/frontend/index.html`](template/frontend/index.html) plus
[`template/frontend/app.js`](template/frontend/app.js) into a new staging directory. Keep all assets inside that
directory and use forward-slash relative paths. Keep executable JavaScript in local external files: the host CSP
does not permit inline scripts.

Update `app.json`:

- `schemaVersion` remains `1`.
- `id` is a new lowercase kebab id matching
  `^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$` and is at most 64 characters.
- `name` is the user-facing app name and `version` is a semantic version.
- `renderer.entry` names a supplied local file, normally `frontend/index.html`.
- `permissions` remains `['sensor.read']` unless the live policy explicitly supports a narrower set.

Do not put channel ids or COM paths in `app.json`; each iframe receives its sensor identity at runtime through
`shroom.renderer.init`.

## Sandbox message contract

The host sends only these version-1 messages:

```js
{
  type: 'shroom.renderer.init',
  schemaVersion: 1,
  payload: {
    appId, rendererId, widgetId, label,
    displaySystemId, sensorId, sensorLabel, sensorType, outputChannel, channelId
  }
}

{
  type: 'shroom.renderer.frame',
  schemaVersion: 1,
  payload: {
    displaySystemId, sensorId, sensorLabel, sensorType, outputChannel, channelId,
    timestamp, values, rawValues, matrix, metrics, algorithmMetrics, serial,
    channels // optional multi-sensor extension; each item has the same identity/data fields
  }
}
```

`values` is `(finite number|null)[]`. Require
`channelId === displaySystemId + ':' + sensorId`, accept `frame` only after `init`, and reject a frame whose
`channelId` differs from the initialized channel. The top-level fields always describe the current widget route.
When optional `channels[]` is present, validate every item and keep multi-sensor state in a map keyed by its full
`channelId`; never use the array index as identity. Single-channel hosts may omit `channels`. Listen only when
`event.source === window.parent`.

`serial` is optional read-only diagnostic metadata at the top level and in each `channels[]` item. Use only its
whitelisted `role`, `portId`, `path`, `baudRate`, `parserChannel`, `status`, `isOpen`, and `openedAt` fields. It may
change after reconnect and never defines left/right/backrest/seat identity; never expect a handle, method, parser
object, or Electron object.

The renderer sends only:

```js
{ type: 'shroom.renderer.ready', schemaVersion: 1, payload: {} }
{ type: 'shroom.renderer.error', schemaVersion: 1, payload: { message: '...' } }
```

Use `window.parent.postMessage(...)`; opaque sandbox origins require the host to authenticate by iframe window,
not by trusting arbitrary message content. Do not add control messages or send frame values back.
Treat `init` as idempotent. Emit `ready` once when the script starts and again after every valid `init`; this
recovers when the startup `ready` fires before the host listener is attached.

## Algorithms

Choose no algorithm or an existing declared algorithm from the live platform contract. Existing algorithms run
upstream in the permanent pipeline, so the renderer simply displays the resulting `values`.

New arbitrary JavaScript, Python, WASM, native code, package, DLL, or runtime dependency requires explicit user
authorization. Even when authorized, it must use the existing algorithm host and pipeline; never hide an
algorithm inside renderer HTML.

## Build the install request

Parse `app.json` as `manifest`. Do not include `app.json` again in `files`; the server writes it from `manifest`.
Encode text as UTF-8 and binary assets as base64:

```json
{
  "manifest": {
    "schemaVersion": 1,
    "id": "pressure-grid-demo",
    "name": "Offline Pressure Grid",
    "version": "1.0.0",
    "renderer": {
      "id": "main",
      "label": "Pressure Grid",
      "entry": "frontend/index.html",
      "height": 520
    },
    "permissions": ["sensor.read"]
  },
  "files": [
    {
      "path": "frontend/index.html",
      "encoding": "utf8",
      "content": "<!doctype html>..."
    },
    {
      "path": "frontend/app.js",
      "encoding": "utf8",
      "content": "(() => {...})();"
    }
  ],
  "overwrite": false
}
```

Limits: renderer height 160–2000 pixels, at most 128 files, 24 MiB decoded per file, 32 MiB decoded total, and 240 characters per portable
relative path. Duplicate paths, traversal, absolute paths, URLs, symlinks, and `files/app.json` are invalid.

Send the request to `POST /api/agent-apps`. A successful `HttpResult.data.app.rendererId` must equal
`agent:<manifest.id>`. Handle stable `AGENT_APP_*` error codes; never retry `AGENT_APP_EXISTS` with
`overwrite:true` without explicit authorization.

Call `POST /api/agent-apps/reload` only if the live contract or install response requires it, then confirm the app
appears in `GET /api/agent-apps` without errors.

## Acceptance checks

Before reporting completion:

1. Parse both `app.json` and the installed policy as strict JSON.
2. Confirm every file is local, included once, within limits, and reachable under
   `/api/agent-apps/:id/files/*` after installation.
3. Confirm the host response CSP blocks external connections and navigation (including `navigate-to 'none'`) and
   restricts scripts/assets to this app's exact static-file prefix. Renderer HTML must not try to weaken or
   replace this policy; keep scripts packaged and external (no inline script), with no remote URL, dynamic
   download, or forbidden API. Same-package fetch is allowed only when the live policy advertises the exact
   current-app static prefix.
4. In the sandbox, observe startup `ready`, send the same valid `init` more than once, and verify every valid init
   is handled idempotently and answered with `ready`; then send a `frame` and verify values render and
   `sensorLabel` plus canonical `channelId` are visible. If `serial` is present, it may be shown as read-only
   connection diagnostics without changing the sensor identity.
5. Send a wrong version, malformed values, and a different current channel; verify the renderer emits `error`
   and does not replace the last valid frame. When testing `channels[]`, verify state is keyed by canonical
   `channelId` and remains correct when array order changes.
6. Confirm the install used `overwrite:false` and no permanent backend or stable-contract file changed.

Report the app id, `agent:<appId>` renderer id, installed version, selected channel ids, test results, and any
feature that was refused by policy.
