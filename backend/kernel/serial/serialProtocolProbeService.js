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

class SerialProtocolProbeError extends Error {
  constructor(code, message, { httpStatus = 500, details } = {}) {
    super(message);
    this.name = 'SerialProtocolProbeError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

function closeSerialHandle(port, logger) {
  return new Promise((resolve) => {
    if (!port || typeof port.close !== 'function') {
      resolve();
      return;
    }

    let settled = false;
    const done = (error) => {
      if (settled) return;
      settled = true;
      // open 失败后的 SerialPort 也会走这里；它回 "Port is not open" 只表示没有
      // 遗留 OS 句柄，不需要污染日志。真正打开过的句柄关闭失败才告警。
      if (error && (port.isOpen || port.opening)) {
        logger?.warn?.('[SerialProtocolProbe] close failed', error.message || error);
      }
      resolve();
    };

    try {
      port.close(done);
    } catch (error) {
      done(error);
    }
  });
}

/**
 * 用一个独立、临时的 SerialPort 收原始字节。
 *
 * 不 pipe 到全局 parser，也不注册进 SerialManager；finally 保证成功、超时、运行时
 * error 和提前达到上限四条路径都会关闭句柄。
 */
async function captureSerialAtBaud({
  path,
  baudRate,
  durationMs = DEFAULT_PROBE_DURATION_MS,
  maxBytes = DEFAULT_MAX_CAPTURE_BYTES,
  createSerialPort = defaultCreateSerialPort,
  logger,
} = {}) {
  let port = null;
  try {
    port = createSerialPort({ path, baudRate, autoOpen: false });
    if (!port || typeof port.open !== 'function') {
      throw new Error('serial port factory did not return an openable port');
    }

    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        port.removeListener?.('error', handleOpenError);
        if (error) reject(error);
        else resolve();
      };
      const handleOpenError = (error) => finish(error);
      port.once?.('error', handleOpenError);
      try {
        port.open((error) => finish(error));
      } catch (error) {
        finish(error);
      }
    });

    return await new Promise((resolve, reject) => {
      const chunks = [];
      let byteCount = 0;
      let settled = false;
      let timer = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        port.removeListener?.('data', handleData);
        port.removeListener?.('error', handleRuntimeError);
        port.removeListener?.('close', handleUnexpectedClose);
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

      port.on?.('data', handleData);
      port.once?.('error', handleRuntimeError);
      port.once?.('close', handleUnexpectedClose);
      timer = setTimeout(() => finish(), Math.max(1, Number(durationMs) || DEFAULT_PROBE_DURATION_MS));
    });
  } finally {
    await closeSerialHandle(port, logger);
  }
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
} = {}) {
  async function detect({ path, candidateIds } = {}) {
    const portPath = String(path || '').trim();
    if (!portPath) {
      throw new SerialProtocolProbeError(
        'SERIAL_PATH_REQUIRED',
        'path is required',
        { httpStatus: 400 },
      );
    }

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
    const attemptedBaudRates = [...new Set(
      detectablePresets.map((preset) => Number(preset.protocol.baudRate)),
    )].sort((left, right) => left - right);

    try {
      for (const baudRate of attemptedBaudRates) {
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
          });
          capturesByBaud.set(baudRate, Buffer.from(capture || []));
        } catch (error) {
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
      releaseSerialPath(portPath, reservationToken);
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
