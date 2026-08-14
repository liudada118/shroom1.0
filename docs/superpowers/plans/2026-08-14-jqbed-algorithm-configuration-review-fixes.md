# Jqbed Algorithm Configuration Review Fixes Implementation Plan

> **For Codex:** Execute this plan with `superpowers:test-driven-development`; keep the 12 formal interaction checks as `USER-SELF-TEST`.

**Goal:** Close the three merge-blocking review findings in WebSocket request lifecycle, pair-field semantics, and the packaged Python native-runtime contract without changing the approved 18-key schema.

**Architecture:** The modal owns two correlated request lifecycles (load and mutation), each with an explicit timeout. `Home` exposes WebSocket connectivity and a reconnect epoch, while every Title request returns an ID only when the frame was actually sent. Reducer transitions preserve dirty drafts across transport failures and remote refreshes. Windows runtime packaging accepts `onbed_filter` only as an external SHA-256-verified input, forces UTF-8, and runs a JSON-line `health` RPC that proves the native module imported.

**Tech Stack:** React 19, Vitest 2, Node.js WebSocket protocol/store tests, Python 3.11 `unittest`, PyInstaller, Vite.

---

### Task 1: Make WebSocket requests observable and draft-safe

**Files:**
- Create: `client/src/page/home/websocketTransport.js`
- Create: `client/src/page/home/websocketTransport.test.js`
- Modify: `client/src/page/home/Home.jsx`
- Modify: `client/src/components/title/Title.jsx`
- Modify: `client/src/components/title/JqbedAlgorithmConfigModal.jsx`
- Modify: `client/src/components/title/jqbedAlgorithmConfig.js`
- Test: `client/src/components/title/jqbedAlgorithmConfig.test.js`
- Test: `test/jqbedAlgorithmProtocol.test.js`
- Modify: `server/jqbedAlgorithmProtocol.js`

- [x] Write failing tests proving send returns false for closed/throwing sockets and true only after `send` succeeds.
- [x] Write failing reducer tests for load/mutation timeout, disconnect, reconnect refresh, stale result rejection, and dirty-draft preservation.
- [x] Write a failing protocol test proving unauthorized GET receives a correlated `action: load` failure and authorized GET receives a correlated success.
- [x] Implement boolean send, connection state/epoch propagation, request IDs, timeout effects, retry UI, and explicit backend GET results.
- [x] Run the targeted Vitest and Node test files until green.

### Task 2: Correct pair and SOS point semantics

**Files:**
- Modify: `client/src/components/title/jqbedAlgorithmConfig.js`
- Modify: `client/src/i18n/resources.js`
- Modify: `client/src/i18n/ja.js`
- Test: `client/src/components/title/jqbedAlgorithmConfig.test.js`

- [x] Write failing literal assertions for front/back, min/max, head/foot, row/column and the SOS pat-point meaning in Chinese, English, and Japanese.
- [x] Assign pair labels per field and update all three languages' label/help copy.
- [x] Run targeted Vitest tests until green.

### Task 3: Enforce and prove the native Python runtime

**Files:**
- Modify: `scripts/build-python-runtime.js`
- Create: `test/buildPythonRuntime.test.js`
- Modify: `python/build_exe.py`
- Modify: `python/app/onbed_filter_example.py`
- Test: `python/tests/test_onbed_filter_config.py`

- [x] Write failing Node tests for mandatory source+hash injection, mismatch rejection, existing-artifact verification, and UTF-8 child environments.
- [x] Write a failing Python test for `health` reporting native import availability.
- [x] Implement `ONBED_FILTER_PYD_SOURCE` + `ONBED_FILTER_PYD_SHA256`, a Windows missing-PYD hard failure, UTF-8 build/probe environments, and packaged-runtime health verification.
- [x] Run targeted Node and Python tests until green.

### Task 4: Document and verify

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `.superpowers/sdd/2026-08-14-jqbed-algorithm-configuration/progress.md`
- Modify: `.superpowers/sdd/2026-08-14-jqbed-algorithm-configuration/task-6-report.md`
- Generated: `build/**`

- [x] Update architecture sections and both architecture logs with request lifecycle, semantic labels, and external native runtime contract.
- [ ] Update ledger/report with remediation evidence; leave all 12 formal interactions exactly `USER-SELF-TEST`.
- [x] Fresh-run relevant Node, Python and Vitest suites, `npm --prefix client run build`, and `npm run prepare-pack-resources` with the external PYD source and SHA-256.
- [x] Run the packaged `health` RPC independently and confirm `onbedFilterAvailable: true`.
- [ ] Review `git diff --check`, status, and staged scope; commit one or a few focused commits without any real PYD or Tk reference file.
