const { createSerialPort: defaultCreateSerialPort } = require('@shroom/backend/serial/serialHelper.js');
const {
  DEFAULT_MIN_COMPLETE_FRAMES,
  DEFAULT_MIN_MATCH_RATIO,
  detectProtocolFromCaptures,
  isDetectableProtocolPreset,
} = require('@shroom/backend/protocol/serialProtocolDetector.js');
const { loadSerialProtocolPresets } = require('@shroom/backend/protocol/presets/index.js');
const {
  releaseSerialPath,
  reserveSerialPath,
} = require('@shroom/backend/serial/serialPathReservation.js');

const DEFAULT_PROBE_DURATION_MS = 1000;
const DEFAULT_MAX_CAPTURE_BYTES = 2 * 1024 * 1024;
const DEFAULT_PROBE_OPEN_TIMEOUT_MS = 5000;
const DEFAULT_PROBE_CLOSE_TIMEOUT_MS = 3000;
const { getNativeDetectionConfig, detectNativeCapture } = require('./nativeSerialDetection');

/** 中止探测后不再尝试下一档波特率，也不返回可用于连接的旧结果。 */
function assertProbeActive(signal) {
  if (signal?.aborted) throw new SerialProtocolProbeError('SERIAL_CONNECT_CANCELLED', 'serial detection cancelled', { httpStatus: 409 });
}

class SerialProtocolProbeError extends Error {
  constructor(code, message, { httpStatus = 500, details } = {}) {
    super(message);
    this.name = 'SerialProtocolProbeError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

/** 有界等待临时串口关闭；pendingRelease 仅在驱动确实释放后完成，供路径锁延迟释放。 */
function closeSerialHandle(port, logger, { openSettled, timeoutMs = DEFAULT_PROBE_CLOSE_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    if (!port) {
      resolve({ ok: true });
      return;
    }
    let settled = false;
    let released = false;
    let opening = Boolean(openSettled);
    let closing = false;
    let release;
    const pendingRelease = new Promise((done) => { release = done; });
    const timer = setTimeout(() => fail(new Error('serial port close timeout')), Math.max(1, Number(timeoutMs) || DEFAULT_PROBE_CLOSE_TIMEOUT_MS));
    /** 返回关闭失败，但继续监听迟到的 open/close，不能提前解除路径占用。 */
    function fail(cause) {
      if (settled || released) return;
      settled = true;
      clearTimeout(timer);
      logger?.warn?.('[SerialProtocolProbe] close pending', cause?.message || cause);
      resolve({ ok: false, pendingRelease, error: new SerialProtocolProbeError('SERIAL_CLOSE_FAILED',
        '端口仍在释放，请稍后重试。', { httpStatus: 409 }) });
    }
    /** 物理关闭确认后移除清理监听并释放等待者。 */
    function confirmRelease() {
      if (released || opening) return;
      released = true;
      clearTimeout(timer);
      port.removeListener?.('close', handleClose);
      port.removeListener?.('error', handleCleanupError);
      release();
      if (!settled) { settled = true; resolve({ ok: true }); }
    }
    /** 关闭事件只在原始 open 已结束后才证明该实例不再持有硬件。 */
    function handleClose() { if (!opening) confirmRelease(); }
    /** 清理阶段吸收驱动迟到的错误，同时保留未释放路径锁。 */
    function handleCleanupError(error) { fail(error); }
    /** 迟到的成功打开也必须立即关闭，不能成为后台幽灵句柄。 */
    function attemptClose() {
      if (opening || released || closing) return;
      if (port.isOpen !== true && port.opening !== true && typeof port.close !== 'function') { confirmRelease(); return; }
      if (typeof port.close !== 'function') { fail(new Error('serial port cannot close')); return; }
      closing = true;
      try {
        port.close((error) => {
          closing = false;
          if (port.isOpen !== true && port.opening !== true) confirmRelease();
          else fail(error || new Error('serial port remains open'));
        });
      } catch (error) {
        closing = false;
        if (port.isOpen !== true && port.opening !== true) confirmRelease();
        else fail(error);
      }
    }
    port.on?.('close', handleClose);
    port.on?.('error', handleCleanupError);
    if (openSettled) Promise.resolve(openSettled).then(() => { opening = false; attemptClose(); }, fail);
    else attemptClose();
  });
}

/**
 * 用一个独立、临时的 SerialPort 收原始字节。
 *
 * 不接入全局 parser 或采集链路；所有结束路径都请求关闭。
 * ⚠️ 未确认关闭时抛错并携带 pendingRelease，调用方必须等它完成后才能释放路径锁。
 */
async function captureSerialAtBaud({
  path,
  baudRate,
  durationMs = DEFAULT_PROBE_DURATION_MS,
  maxBytes = DEFAULT_MAX_CAPTURE_BYTES,
  createSerialPort = defaultCreateSerialPort,
  logger,
  signal,
  openTimeoutMs = DEFAULT_PROBE_OPEN_TIMEOUT_MS,
  closeTimeoutMs = DEFAULT_PROBE_CLOSE_TIMEOUT_MS,
} = {}) {
  let port = null;
  let failure = null;
  let captured = null;
  let driverOpenSettled = null;
  /** 覆盖 await 切换监听器的间隙，驱动迟到 error 不能成为未处理事件。 */
  const handleLateError = () => {};
  try {
    assertProbeActive(signal);
    port = createSerialPort({ path, baudRate, autoOpen: false });
    port?.on?.('error', handleLateError);
    if (!port || typeof port.open !== 'function') {
      throw new Error('serial port factory did not return an openable port');
    }

    let resolveDriverOpen;
    driverOpenSettled = new Promise((resolve) => { resolveDriverOpen = resolve; });
    await new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => finish(new SerialProtocolProbeError('SERIAL_CONNECT_TIMEOUT',
        'serial detection open timed out', { httpStatus: 504 })), Math.max(1, Number(openTimeoutMs) || DEFAULT_PROBE_OPEN_TIMEOUT_MS));
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        port.removeListener?.('error', handleOpenError);
        signal?.removeEventListener('abort', handleOpenAbort);
        if (error) reject(error);
        else resolve();
      };
      const handleOpenError = (error) => finish(error);
      const handleOpenAbort = () => finish(new SerialProtocolProbeError('SERIAL_CONNECT_CANCELLED', 'serial detection cancelled', { httpStatus: 409 }));
      port.once?.('error', handleOpenError);
      signal?.addEventListener('abort', handleOpenAbort, { once: true });
      try {
        if (signal?.aborted) { resolveDriverOpen(); handleOpenAbort(); return; }
        port.open((error) => { resolveDriverOpen(); finish(error); });
      } catch (error) {
        resolveDriverOpen();
        finish(error);
      }
    });

    assertProbeActive(signal);

    captured = await new Promise((resolve, reject) => {
      const chunks = [];
      let byteCount = 0;
      let settled = false;
      let timer = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        port.removeListener?.('data', handleData);
        port.removeListener?.('error', handleRuntimeError);
        port.removeListener?.('close', handleUnexpectedClose);
        signal?.removeEventListener('abort', handleAbort);
      };
      const finish = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve(Buffer.concat(chunks, byteCount));
      };
      const handleData = (chunk) => {
        if (settled || byteCount >= maxBytes) return;
        const bytes = Buffer.from(chunk || []);
        const remaining = maxBytes - byteCount;
        const accepted = bytes.length > remaining ? bytes.subarray(0, remaining) : bytes;
        if (accepted.length) {
          chunks.push(accepted);
          byteCount += accepted.length;
        }
        if (byteCount >= maxBytes) finish();
      };
      const handleRuntimeError = (error) => finish(error);
      const handleUnexpectedClose = () => finish(new Error('serial port closed during protocol probe'));
      const handleAbort = () => finish(new SerialProtocolProbeError('SERIAL_CONNECT_CANCELLED', 'serial detection cancelled', { httpStatus: 409 }));

      port.on?.('data', handleData);
      port.once?.('error', handleRuntimeError);
      port.once?.('close', handleUnexpectedClose);
      signal?.addEventListener('abort', handleAbort, { once: true });
      timer = setTimeout(() => finish(), Math.max(1, Number(durationMs) || DEFAULT_PROBE_DURATION_MS));
    });
  } catch (error) {
    failure = error;
  }
  const cleanup = await closeSerialHandle(port, logger, { openSettled: driverOpenSettled, timeoutMs: closeTimeoutMs });
  if (cleanup.ok) port?.removeListener?.('error', handleLateError);
  else cleanup.pendingRelease.then(() => port?.removeListener?.('error', handleLateError));
  if (!cleanup.ok) {
    failure ||= cleanup.error;
    failure.pendingRelease = cleanup.pendingRelease;
  }
  if (failure) throw failure;
  return captured;
}

function normalizePath(value) {
  return String(value || '').trim().toLowerCase();
}

function listSerialStatuses(serialManager) {
  if (!serialManager || typeof serialManager.getStatus !== 'function') {
    throw new SerialProtocolProbeError(
      'SERIAL_STATUS_UNAVAILABLE',
      'serial status is unavailable; protocol probe refused to open the port',
      { httpStatus: 503 },
    );
  }

  let statuses;
  try {
    statuses = serialManager.getStatus();
  } catch (error) {
    throw new SerialProtocolProbeError(
      'SERIAL_STATUS_UNAVAILABLE',
      `unable to verify serial port state: ${error.message || error}`,
      { httpStatus: 503 },
    );
  }
  if (statuses == null) return [];
  return Array.isArray(statuses) ? statuses : [statuses];
}

function findBusyPortStatus(serialManager, path) {
  const target = normalizePath(path);
  if (serialManager?.isPathBusy?.(target)) return { path: target, status: 'busy' };
  const busyStates = new Set(['opening', 'open']);
  return listSerialStatuses(serialManager).find((status) => (
    normalizePath(status?.path) === target
    && (status?.isOpen === true || busyStates.has(String(status?.status || '').toLowerCase()))
  )) || null;
}

function normalizeCandidateIds(candidateIds) {
  if (candidateIds == null) return null;
  if (!Array.isArray(candidateIds)) {
    throw new SerialProtocolProbeError(
      'INVALID_CANDIDATE_IDS',
      'candidateIds must be an array of protocol preset ids',
      { httpStatus: 400 },
    );
  }

  const ids = [...new Set(candidateIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) {
    throw new SerialProtocolProbeError(
      'INVALID_CANDIDATE_IDS',
      'candidateIds must contain at least one protocol preset id',
      { httpStatus: 400 },
    );
  }
  return ids;
}

function createSerialProtocolProbeService({
  serialManager,
  serialProtocolDirectories = [],
  loadPresets = loadSerialProtocolPresets,
  captureAtBaud = captureSerialAtBaud,
  createSerialPort = defaultCreateSerialPort,
  durationMs = DEFAULT_PROBE_DURATION_MS,
  maxCaptureBytes = DEFAULT_MAX_CAPTURE_BYTES,
  minCompleteFrames = DEFAULT_MIN_COMPLETE_FRAMES,
  minMatchRatio = DEFAULT_MIN_MATCH_RATIO,
  logger,
  assertCanProbe = () => {},
  prepareConnection,
} = {}) {
  /** 按当前设备默认值优先探测固定五档；识别成功即停止，不擅自重配业务端口。 */
  async function detectConnection({ path, connection, signal }) {
    const config = getNativeDetectionConfig(connection);
    if (!config) return { status: 'unsupported', path, match: null, compatible: false };
    assertCanProbe();
    assertProbeActive(signal);
    const preparing = connection.connectionId != null;
    if (preparing && typeof prepareConnection !== 'function') {
      throw new SerialProtocolProbeError('SERIAL_STATUS_UNAVAILABLE', 'connection preparation is unavailable', { httpStatus: 503 });
    }
    const busy = preparing ? null : findBusyPortStatus(serialManager, path);
    const reservation = busy ? null : reserveSerialPath(path);
    if (!reservation) throw new SerialProtocolProbeError('SERIAL_PORT_BUSY', 'serial port is busy', { httpStatus: 409 });
    const diagnostics = { attemptedBaudRates: [], failedBaudRates: [], capturedBytesByBaud: {} };
    let last = { status: 'unknown', reason: 'insufficient-data', match: null, candidates: [], compatible: false };
    let totalBytes = 0;
    let pendingRelease;
    try {
      if (preparing) {
        const prepared = await prepareConnection({ path, connection, signal });
        assertProbeActive(signal);
        if (prepared?.status === 'reading') return prepared;
      }
      for (const baudRate of config.baudRates) {
        assertCanProbe();
        assertProbeActive(signal);
        if (findBusyPortStatus(serialManager, path)) throw new SerialProtocolProbeError('SERIAL_PORT_BUSY', 'serial port is busy', { httpStatus: 409 });
        diagnostics.attemptedBaudRates.push(baudRate);
        let bytes;
        try {
          bytes = Buffer.from(await captureAtBaud({ path, baudRate, durationMs, maxBytes: maxCaptureBytes, createSerialPort, logger, signal }) || []);
        } catch (error) {
          if (error.pendingRelease) { pendingRelease = error.pendingRelease; throw error; }
          assertProbeActive(signal);
          diagnostics.failedBaudRates.push(baudRate);
          continue;
        }
        assertProbeActive(signal);
        assertCanProbe();
        diagnostics.capturedBytesByBaud[baudRate] = bytes.length;
        totalBytes += bytes.length;
        last = detectNativeCapture(bytes, baudRate, config, { minCompleteFrames, minMatchRatio });
        if (last.status !== 'unknown') break;
      }
      if (diagnostics.failedBaudRates.length === diagnostics.attemptedBaudRates.length) {
        throw new SerialProtocolProbeError('SERIAL_PROTOCOL_PROBE_FAILED', 'unable to probe serial port at any candidate baud rate', { httpStatus: 503 });
      }
      if (last.status === 'unknown') last.reason = totalBytes ? 'no-match' : 'insufficient-data';
      return { ...last, path, defaultBaudRate: config.defaultBaudRate, diagnostics };
    } finally {
      if (pendingRelease) pendingRelease.then(() => releaseSerialPath(path, reservation));
      else releaseSerialPath(path, reservation);
    }
  }

  /** Builder保留预设识别；原生连接使用默认优先的五档探测。 */
  async function detect({ path, candidateIds, connection, signal } = {}) {
    const portPath = String(path || '').trim();
    if (!portPath) {
      throw new SerialProtocolProbeError(
        'SERIAL_PATH_REQUIRED',
        'path is required',
        { httpStatus: 400 },
      );
    }

    if (connection) return detectConnection({ path: portPath, connection, signal });
    assertCanProbe();
    assertProbeActive(signal);

    const requestedIds = normalizeCandidateIds(candidateIds);
    const loaded = loadPresets({ extraDirectories: serialProtocolDirectories });
    const allPresets = loaded.presets || [];
    const byId = new Map(allPresets.map((preset) => [preset.id, preset]));
    if (requestedIds) {
      const missingIds = requestedIds.filter((id) => !byId.has(id));
      if (missingIds.length) {
        throw new SerialProtocolProbeError(
          'UNKNOWN_PROTOCOL_PRESET',
          `unknown protocol preset id: ${missingIds.join(', ')}`,
          { httpStatus: 400, details: { missingIds } },
        );
      }
    }

    const selectedPresets = requestedIds ? requestedIds.map((id) => byId.get(id)) : allPresets;
    const detectablePresets = selectedPresets.filter(isDetectableProtocolPreset);
    if (!detectablePresets.length) {
      return {
        status: 'unknown',
        reason: 'no-detectable-candidates',
        path: portPath,
        match: null,
        candidates: [],
        diagnostics: {
          attemptedBaudRates: [],
          skippedCandidateIds: selectedPresets.map((preset) => preset.id),
          invalidPresetCount: loaded.invalid?.length || 0,
        },
      };
    }

    const busyStatus = findBusyPortStatus(serialManager, portPath);
    const reservationToken = busyStatus ? null : reserveSerialPath(portPath);
    if (!reservationToken || busyStatus) {
      throw new SerialProtocolProbeError(
        'SERIAL_PORT_BUSY',
        'serial port is busy',
        { httpStatus: 409, details: busyStatus || { path: portPath, status: 'probing' } },
      );
    }

    const capturesByBaud = new Map();
    const failedBaudRates = [];
    let pendingRelease;
    const attemptedBaudRates = [...new Set(
      detectablePresets.map((preset) => Number(preset.protocol.baudRate)),
    )].sort((left, right) => left - right);

    try {
      for (const baudRate of attemptedBaudRates) {
        assertCanProbe();
        assertProbeActive(signal);
        const becameBusy = findBusyPortStatus(serialManager, portPath);
        if (becameBusy) {
          throw new SerialProtocolProbeError(
            'SERIAL_PORT_BUSY',
            'serial port became busy during protocol probe',
            { httpStatus: 409, details: becameBusy },
          );
        }
        try {
          const capture = await captureAtBaud({
            path: portPath,
            baudRate,
            durationMs,
            maxBytes: maxCaptureBytes,
            createSerialPort,
            logger,
            signal,
          });
          capturesByBaud.set(baudRate, Buffer.from(capture || []));
        } catch (error) {
          if (error.pendingRelease) { pendingRelease = error.pendingRelease; throw error; }
          assertProbeActive(signal);
          // 一个驱动不支持某个高波特率时，不能丢掉其它波特率已经收集到的有效证据。
          // 失败项只进诊断；所有波特率都打不开时才把整次探测判为失败。
          failedBaudRates.push(baudRate);
          logger?.warn?.(
            `[SerialProtocolProbe] ${portPath} at ${baudRate} baud failed`,
            error.message || error,
          );
        }
      }

      if (!capturesByBaud.size) {
        throw new SerialProtocolProbeError(
          'SERIAL_PROTOCOL_PROBE_FAILED',
          'unable to probe serial port at any candidate baud rate',
          { httpStatus: 503, details: { path: portPath, attemptedBaudRates } },
        );
      }

      assertProbeActive(signal);
      assertCanProbe();
      const detection = detectProtocolFromCaptures({
        presets: detectablePresets,
        capturesByBaud,
        minCompleteFrames,
        minMatchRatio,
      });
      return {
        ...detection,
        path: portPath,
        protocol: detection.match?.protocol || null,
        diagnostics: {
          attemptedBaudRates,
          failedBaudRates,
          capturedBytesByBaud: Object.fromEntries(
            attemptedBaudRates.map((baudRate) => [baudRate, capturesByBaud.get(baudRate)?.length || 0]),
          ),
          skippedCandidateIds: selectedPresets
            .filter((preset) => !isDetectableProtocolPreset(preset))
            .map((preset) => preset.id),
          invalidPresetCount: loaded.invalid?.length || 0,
          scores: detection.scores,
        },
      };
    } finally {
      if (pendingRelease) pendingRelease.then(() => releaseSerialPath(portPath, reservationToken));
      else releaseSerialPath(portPath, reservationToken);
    }
  }

  return { detect };
}

module.exports = {
  DEFAULT_MAX_CAPTURE_BYTES,
  DEFAULT_PROBE_DURATION_MS,
  SerialProtocolProbeError,
  captureSerialAtBaud,
  closeSerialHandle,
  createSerialProtocolProbeService,
  findBusyPortStatus,
};
