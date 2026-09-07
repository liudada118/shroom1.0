---
name: add-display-system
description: Generate and install a complete Shroom schema-v3 multi-sensor display system, including protocol, per-sensor mapping, existing-pipeline algorithms, renderer selection, widgets, charts, storage, replay, and CSV consistency.
---

# Add Display System

This skill generates a complete display system without modifying Shroom's permanent backend. Read
[`../policy.json`](../policy.json) completely first, especially `displaySystemGeneration`, `sensorData`,
`algorithmPolicy`, and `changeBoundary`.

## Hard boundary

Use public contracts and APIs only. Do not patch Electron, backend, client, SDK, WebSocket, SQLite, replay, CSV,
or packaged resources. A display-system manifest configures the existing pipeline; it does not replace any part
of it.

If a required protocol, algorithm host, renderer capability, or API is not advertised by the live platform,
stop and explain the missing capability. Do not invent a hidden route or alternate pipeline.

## 1. Discover live capabilities

Read in this order:

1. `GET /api/sdk/contract` returns the raw contract object (not `HttpResult.data`); verify the stable
   `shroom.multi-sensor` contract, manifest schema 3, and `sensor.frame` schema 1. Resolve later route names from
   this response.
2. `GET /api/agent-apps/policy` and obey `data.policy`.
3. `GET /api/display-systems/catalog` through the route advertised by the SDK contract. Use its current
   renderers, visualization algorithms, chart templates/formulas, serial templates, limits, and writable root.
4. Read the live serial protocol preset endpoint advertised by the contract. Do not create a second list.
5. `GET /api/display-systems` and `GET /api/agent-apps` to avoid id collisions. Default to no overwrite.

## 2. Define business identity before protocol detection

For every physical sensor collect or confirm:

- stable `id`;
- user-facing business `label` such as 左手、右手、靠背、座椅;
- unique `outputChannel`;
- explicit `stored` decision;
- sensor `type`, matrix geometry, and physical orientation;
- the temporary COM to inspect, if detection is needed.

Business identity never comes from COM number, protocol, serial order, arrival order, or array index. Multiple
devices may use the same protocol. The user must explicitly map each physical device to its intended sensor.

The canonical identity is always `<displaySystemId>:<sensorId>`; neither part may contain a colon.

## 3. Select or detect each protocol

Before constructing a protocol from prose, compare the document with every live preset. Match on baud rate,
delimiter/header bytes, decoded value type/count, and byte width. If exactly one preset matches, the Agent MUST
copy that preset's complete `protocol` object; it must not reconstruct an equivalent-looking protocol.

A wire document's “frame header + payload + total frame length” describes bytes on the wire. It does not by
itself select Shroom `fixedLength`: that parser cuts the stream from its current byte position and does not search
for a header. When the live preset represents the header as a delimiter with `includeDelimiter:false`, decoding
starts at payload offset `0`; do not duplicate those delimiter bytes as validation or `byteOffset`. For example,
`AA 55 03 99 + 1024 × uint8` at 1000000 baud MUST resolve to a matching delimiter preset when the live catalog
advertises one, rather than being rebuilt as fixed length 1028 with offset 4.

If no preset matches, only construct a protocol when the document states the framing semantics unambiguously.
Do not infer fixed-length framing from a reported total length. Use live detection or ask for evidence when
“header”, “delimiter”, “frame start”, or “frame end” could describe more than one parser configuration.

For a temporary COM, call the contract-advertised protocol detection route with candidate ids from the live
preset catalog. Only `matched` may populate the current sensor, and it must copy the complete returned protocol,
including `includeDelimiter`, validation header and `headerOffset`, checksum type/offset, and whether checksum
range was explicit.

`ambiguous` and `unknown` do not change the draft. Ask for a manual preset or more evidence. Detection answers
only “which wire protocol”; it never assigns left/right/backrest/seat. Do not save the temporary COM in the
manifest.

Protocol `decoding.valueCount` / fixed `framing.frameLength` and display geometry are independent. If the
selected protocol explicitly reads 1024 values while point mapping displays 256, preserve both wire fields;
line/point mapping selects the 256 display points later.

## 4. Choose algorithm, renderer, and charts

Use no algorithm, a declarative JSON algorithm, or another algorithm advertised by the live pipeline. New
arbitrary JavaScript/Python/WASM/native code requires explicit authorization and must still execute through the
existing algorithm host. Never place a data-changing algorithm in renderer HTML.

Treat requested indicators and charts as output-metric requirements before choosing `algorithm.type: "none"`.
Match the user's words against live package names, descriptions, and `metricDefinitions`: a respiration waveform
or trend requires a respiration-signal metric, respiration rate requires a rate metric, a center-of-pressure
trajectory requires paired X/Y metrics, and center offset requires a distance metric. If one compatible registered
package supplies the requested metrics, the Agent MUST select and attach it. It must not replace those outputs
with renderer/chart-side estimates merely because the user did not say the internal package id.

Before generating new Python, inspect `catalog.algorithmPackages` and prefer an exact registered package whose
`compatibility.matrixTotals` includes the current sensor point count. Copy its `packageManifest`,
`algorithmSource`, and `metricDefinitions` into the display-system draft; never reference the read-only package
directory by absolute path. Registered package ids come from the live catalog, not from this skill. If no
compatible package exists, only then use authorized custom Python.

For an authorized Python algorithm, prefer the live catalog's `algorithmPackageContract` over a bare V1 file.
Keep V1 `calculate(raw_data, context)` for simple single-frame compatibility. Use API V2 when the algorithm
loads a model, keeps a time window, needs reset/shutdown, or consumes multiple sensors. Submit the package
manifest as `definitions.sensors[triggerSensor].algorithmPackage` and its Python source as `algorithmSource`;
the corresponding sensor declares `algorithm.type: "python"` and `algorithm.packageManifest`.

A multi-sensor package MUST list stable sensor ids and one trigger sensor. The host aggregates each route only
after protocol decode and line/point mapping, keys `request["frames"]` by sensor id, and applies `latest` or
`strict` software-time synchronization. This does not claim hardware-synchronous sampling. Attach the package
only to its declared trigger sensor; the other routes keep their own per-channel processing and still feed the
aggregator.

Example package manifest:

```json
{
  "schemaVersion": 1,
  "id": "seat-back-fusion",
  "name": "Seat Back Fusion",
  "version": "1.0.0",
  "apiVersion": 2,
  "language": "python",
  "entry": "algorithm.py",
  "runtime": { "python": "3.11", "profile": "bundled-v1" },
  "input": {
    "mode": "multi-sensor",
    "sensors": ["seat", "back"],
    "triggerSensor": "seat",
    "sync": { "strategy": "strict", "maxSkewMs": 20, "maxAgeMs": 200 }
  },
  "output": { "metrics": ["balance"] }
}
```

Resolve renderer intent against live renderer ids and labels before creating an App. If a catalog renderer
directly expresses the request, the Agent MUST use it by default. In particular, “3D point plot”, “3D point
grid”, “3D 点图”, and “3D 点阵” select the live point-grid renderer (currently `pointGrid` when advertised).
Creating a new display system is not authorization to create a new renderer. A custom renderer is allowed only
when the user explicitly requests a new/custom/reference visual that the matching catalog renderer cannot
express, or when no compatible built-in renderer exists.

Choose either:

- an exact built-in renderer id from the live catalog; or
- a custom renderer installed first with [`../add-display-app/SKILL.md`](../add-display-app/SKILL.md), then
  referenced by its returned `agent:<appId>` id.

Use catalog-advertised `chartCards` for scalar formula curves. They are rendered by the host in the existing
sidebar chart area. For XY trajectories, multiple synchronized series, or another chart shape that formulas
cannot express, inspect `GET /api/agent-apps` for a matching `charts[]` descriptor or install one with
[`../add-display-app/SKILL.md`](../add-display-app/SKILL.md). Reference the returned stable id as
`display.chartCards[].agentChartId`; never guess it. A chart card may also declare an output-channel `source`
and JSON `options`, delivered in the sandbox init config. The chart iframe receives the same canonical frame
and stable-identity `channels[]` as the renderer.

Charts consume the selected algorithm package's named metrics when those metrics exist. Presentation-only
fallback calculations require explicit user authorization and must be labelled as proxies. A custom chart iframe
draws only the plot body on a transparent root; it must not recreate the host card background, title, delete
control, summary block, or sidebar spacing, because the host owns that shell.

A custom Agent renderer remains one main-canvas visualization: it must not recreate the application header,
profile controls, summary-card column, chart sidebar, or a complete dashboard shell. Custom chart code belongs
in `app.json.charts[]` and is mounted by the host in the sidebar, never embedded into the main renderer. Neither
surface creates a second storage or CSV truth.

## 5. Build schema-v3 manifest and per-sensor definitions

Always submit a non-empty `sensors[]`. Every sensor explicitly contains all of these fields:

```json
{
  "id": "left-hand",
  "label": "左手",
  "outputChannel": "leftHand",
  "stored": true,
  "type": "pressure-matrix",
  "matrix": { "rows": 16, "cols": 16 },
  "files": {
    "lineOrder": "left-hand/line-order.json",
    "pointOrder": "left-hand/point-order.json",
    "coordinateMap": "left-hand/coordinate-map.json"
  },
  "protocol": {
    "baudRate": 921600,
    "framing": { "type": "delimiter", "delimiter": [170, 85], "includeDelimiter": false },
    "decoding": { "valueType": "uint8", "byteOffset": 0, "valueCount": 256 }
  },
  "algorithm": { "type": "json", "dataFile": "left-hand/algorithm-data.json" }
}
```

Use distinct per-sensor file paths for a multi-sensor system. Submit their content under the exact sensor id:

```json
{
  "definitions": {
    "sensors": {
      "left-hand": {
        "lineOrder": { "order": [1, 2, 3, 4] },
        "pointOrder": {
          "matrix": { "rows": 2, "cols": 2 },
          "points": [[0, 0], [0, 1], [1, 0], [1, 1]]
        },
        "coordinateMap": null,
        "algorithmData": { "scale": 1, "zeroBelow": 0 }
      }
    }
  }
}
```

Do not submit the first route's definitions as a shared top-level substitute. Each sensor owns its line order,
point order, coordinate map, algorithm data, and authorized algorithm source.

For every data widget, explicitly set `source` to the sensor's exact `outputChannel`, for example `leftHand`.
New manifests should not use `leftHandData`, `data`, or widget position as the source. Declare each renderer,
widget, profile, default view/profile, sidebar source, and chart card explicitly, and make every reference resolve.
For a custom renderer, its renderer catalog item, data widget type, and profile renderer use the exact
`agent:<appId>` id.

## 6. Save without overwrite

Send the complete draft to the contract-advertised display-system save route, currently
`POST /api/display-systems`:

```json
{
  "manifest": {
    "schemaVersion": 3,
    "id": "four-zone-demo",
    "name": "四区压力展示",
    "version": "1.0.0",
    "sensors": [],
    "display": {}
  },
  "definitions": { "sensors": {} },
  "overwrite": false
}
```

The example's empty arrays are placeholders; never submit them empty. On id conflict, choose a new id or stop.
Only set `overwrite:true` after the user explicitly authorizes replacement of that exact display-system id.

After a 201 response, call the advertised reload route. Read the saved system's editor/detail response and
verify every sensor independently round-tripped: identity, label, outputChannel, stored, protocol, matrix, files,
algorithm, line/point order, coordinate map, and algorithm data. A first-sensor projection over another route is
a failed installation.

## 7. Activate the system and open its serial channels

Saving only writes files. **A saved system receives no data until it is the active sensor type and its serial
roles are opened.** Both steps are the Agent's responsibility; the platform will not infer them.

1. Activate: `POST /api/commands` with `{ "type": "sensor.switch", "payload": { "sensorType": "<sensors[0].type>" } }`
   (route `http.routes.sensorType` is an equivalent shortcut). `sensorType` MUST be the first sensor's exact
   `type` — it is the activation key shared by every channel of the system; a mismatch leaves every binding in
   `sensor type mismatch` and no frame is dispatched.
2. For every sensor, open its port: `POST /api/commands` with
   `{ "type": "serial.open", "payload": { "role": "<sensors[].id>", "path": "<COM path>", "baudRate": <protocol.baudRate> } }`.
   `role` is the sensor `id` (the platform's `serialRole`), not `outputChannel` and not a legacy alias.
   A role the active manifest does not declare is rejected with `INVALID_COMMAND` before any hardware action.
3. Verify with `GET /api/display-systems`: the system's entries under `runtimeBindings.bindings` MUST show
   `status: "bound"` with no `error`; then `GET /api/serial/status` MUST list each role as open.
4. When a physical COM was supplied, observe the contract-advertised realtime stream and require at least one
   real `sensor.frame` for every opened sensor. Its canonical identity must match the saved sensor and its
   normalized values must have the expected mapped point count (for a full matrix, `rows * cols`). Synthetic
   samples do not satisfy this gate. `bound + open` proves only control-plane setup, not successful framing.

If either command returns `LICENSE_REQUIRED` (403), stop and report — activation is gated by the platform's
license and is not something the Agent can bypass.

If no valid real frame arrives within a bounded observation window, report the system as configured but not
hardware-verified. Do not call the installation complete; preserve parser/validation diagnostics so framing can
be corrected without changing the permanent backend.

## 8. End-to-end acceptance

Use distinct sample values per channel and deliberately vary arrival order. Confirm:

- every widget shows the intended `sensorLabel` and full canonical `channelId`;
- every widget reads its explicit `outputChannel` source and keeps state by `channelId`;
- protocol decode, line order, point order, algorithm, and zeroing execute exactly once in the existing pipeline;
- for each `stored:true` route, realtime `payload.value`, SQLite data, replay `payload.value`, and CSV `realData`
  contain the same final array and identity;
- `stored:false` routes remain realtime-only;
- optional sandbox `channels[]` remains correct when reordered and is not used to infer roles;
- optional sandbox `serial` metadata can show the physical connection but never changes or infers business identity;
- built-in chart cards or custom presentation charts update from the intended route;
- every supplied physical serial route produced a real canonical frame with the expected identity and value count;
- no permanent backend or stable-contract source changed.

Report display-system id, sensor-to-business-role mapping, canonical channel ids, protocol result per sensor,
algorithm choice, renderer ids, chart strategy, save/reload result, activation and serial-open results, and all
acceptance evidence.
