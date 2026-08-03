/**
 * 采集配置与磁盘保护服务。
 *
 * 负责清洗采集频率/降采样配置、按通道限频判断是否入库，
 * 以及在采集前检查磁盘剩余空间，避免数据库写满磁盘。
 */
const DEFAULT_COLLECTION_FREQUENCY_HZ = 12;
const MIN_COLLECTION_FREQUENCY_HZ = 1;
const MAX_COLLECTION_FREQUENCY_HZ = 200;
const DEFAULT_DISK_CHECK_INTERVAL_MS = 1000;

/**
 * 归一化采集频率，防止前端传入空值、负数或过高频率。
 *
 * @param {unknown} value 前端或配置文件传入的采集频率。
 * @param {number} fallbackHz 兜底采集频率。
 * @returns {number} 可用于采集限频的安全频率。
 */
function normalizeCollectFrequency(value, fallbackHz = DEFAULT_COLLECTION_FREQUENCY_HZ) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return normalizeCollectFrequency(fallbackHz, DEFAULT_COLLECTION_FREQUENCY_HZ);
  }
  return Math.min(MAX_COLLECTION_FREQUENCY_HZ, Math.max(MIN_COLLECTION_FREQUENCY_HZ, numberValue));
}

/**
 * 清洗前端传入的采集配置，补齐默认值并限制异常输入。
 *
 * @param {Record<string, unknown>} options 用户设置的采集参数。
 * @param {number} fallbackHz 当前系统采集频率兜底值。
 * @returns {{ frequencyMode: string, frequencyHz: number, matrixDownsample: Record<string, unknown> }} 可直接使用的安全采集配置。
 */
function normalizeCollectOptions(options = {}, fallbackHz = DEFAULT_COLLECTION_FREQUENCY_HZ) {
  const matrixDownsample = options.matrixDownsample && typeof options.matrixDownsample === 'object'
    ? options.matrixDownsample
    : {};
  const frequencyMode = options.frequencyMode === 'serial' ? 'serial' : 'custom';

  return {
    frequencyMode,
    frequencyHz: normalizeCollectFrequency(options.frequencyHz ?? fallbackHz, fallbackHz),
    matrixDownsample: {
      enabled: matrixDownsample.enabled === true,
      sourceWidth: Number(matrixDownsample.sourceWidth) || 32,
      sourceHeight: Number(matrixDownsample.sourceHeight) || 32,
      targetWidth: Number(matrixDownsample.targetWidth) || 16,
      targetHeight: Number(matrixDownsample.targetHeight) || 16,
      blockWidth: Number(matrixDownsample.blockWidth) || 2,
      blockHeight: Number(matrixDownsample.blockHeight) || 2,
      samplePoint: matrixDownsample.samplePoint || 'topLeft',
    },
  };
}

/**
 * 创建采集保存时钟，按通道判断当前帧是否应该入库。
 *
 * @param {{ getOptions: () => object, getFallbackFrequencyHz: () => number }} deps 运行时采集配置读取器。
 * @returns {{ reset: () => void, shouldStore: (channel?: string) => boolean }} 采集保存控制器。
 */
function createCollectionStorageClock({
  getOptions,
  getFallbackFrequencyHz,
} = {}) {
  let lastStorageAt = { sit: 0, back: 0, head: 0 };

  function reset() {
    lastStorageAt = { sit: 0, back: 0, head: 0 };
  }

  function shouldStore(channel = 'sit') {
    const options = typeof getOptions === 'function' ? getOptions() || {} : {};
    const now = Date.now();

    if (options.frequencyMode === 'serial') {
      lastStorageAt[channel] = now;
      return true;
    }

    const fallbackHz = typeof getFallbackFrequencyHz === 'function'
      ? getFallbackFrequencyHz()
      : DEFAULT_COLLECTION_FREQUENCY_HZ;
    const hz = normalizeCollectFrequency(options.frequencyHz ?? fallbackHz, fallbackHz);
    const intervalMs = 1000 / hz;
    const lastAt = lastStorageAt[channel] || 0;

    if (lastAt && now - lastAt < intervalMs) {
      return false;
    }

    lastStorageAt[channel] = now;
    return true;
  }

  return {
    reset,
    shouldStore,
  };
}

/**
 * 读取目录所在磁盘的可用空间。
 *
 * @param {string} dirPath 待检查的目录路径。
 * @param {{ statfsSync?: Function }} fsLike 文件系统接口，默认使用 Node fs。
 * @returns {number | null} 可用字节数；无法读取时返回 null。
 */
function getDirectoryFreeBytes(dirPath, fsLike = require('fs')) {
  try {
    if (!dirPath || typeof fsLike.statfsSync !== 'function') return null;
    const stat = fsLike.statfsSync(dirPath);
    return Number(stat.bavail ?? stat.bfree ?? 0) * Number(stat.bsize || 0);
  } catch {
    return null;
  }
}

/**
 * 创建采集磁盘空间保护器，限制检查频率并在空间不足时回调业务层。
 *
 * @param {{ getDirectory: () => string, minFreeBytes: number, onInsufficientSpace: Function, logger?: object, checkIntervalMs?: number }} deps 运行时依赖。
 * @returns {{ hasEnoughSpace: () => boolean, getFreeBytes: () => number | null }} 磁盘空间保护器。
 */
function createCollectionDiskSpaceGuard({
  getDirectory,
  minFreeBytes,
  onInsufficientSpace,
  logger,
  checkIntervalMs = DEFAULT_DISK_CHECK_INTERVAL_MS,
} = {}) {
  let lastCheckAt = 0;
  // 节流窗口内沿用上次的判断结果，而不是无脑放行。原来窗口内直接 `return true`，
  // 于是空间真的不够时每秒也只有第一帧被拦住，剩下 999 毫秒的帧照写。
  // 代价：空间腾出来之后最多要等一个检查周期（1 秒）才恢复入库 —— 这比漏写划算。
  let lastResult = true;

  function getFreeBytes() {
    const dirPath = typeof getDirectory === 'function' ? getDirectory() : '';
    const freeBytes = getDirectoryFreeBytes(dirPath);
    if (freeBytes == null && logger?.warn) {
      logger.warn('[Collection] failed to check free disk space');
    }
    return freeBytes;
  }

  function hasEnoughSpace() {
    const now = Date.now();
    if (now - lastCheckAt < checkIntervalMs) return lastResult;
    lastCheckAt = now;

    const freeBytes = getFreeBytes();
    // 读不到剩余空间（非 Node 18+ / statfs 不可用）时按「够」处理，与原来一致：
    // 宁可放行也不要因为探测不到就把采集停了。
    if (freeBytes == null || freeBytes >= minFreeBytes) {
      lastResult = true;
      return true;
    }

    lastResult = false;
    // 回调仍然只在真正检查的那一帧触发（每秒一次），所以日志不会被刷屏。
    if (typeof onInsufficientSpace === 'function') {
      onInsufficientSpace({ freeBytes, minFreeBytes });
    }
    return false;
  }

  return {
    getFreeBytes,
    hasEnoughSpace,
  };
}

module.exports = {
  DEFAULT_DISK_CHECK_INTERVAL_MS,
  DEFAULT_COLLECTION_FREQUENCY_HZ,
  MAX_COLLECTION_FREQUENCY_HZ,
  MIN_COLLECTION_FREQUENCY_HZ,
  createCollectionDiskSpaceGuard,
  createCollectionStorageClock,
  getDirectoryFreeBytes,
  normalizeCollectFrequency,
  normalizeCollectOptions,
};
