/**
 * 采集磁盘空间保护器的行为测试。
 *
 * 这里不注入假 fs —— `createCollectionDiskSpaceGuard` 内部调
 * `getDirectoryFreeBytes(dirPath)` 时用的是默认的 `require('fs')`，注不进去。
 * 改用真实目录 + 两个极端阈值来驱动两条分支：
 *
 * - `minFreeBytes: 0` —— 任何盘都够，走「空间充足」分支
 * - `minFreeBytes: Number.MAX_SAFE_INTEGER` —— 任何盘都不够，走「空间不足」分支
 *
 * 这样不依赖跑测试的机器上还剩多少空间。
 */
const assert = require('assert');
const path = require('path');
const {
  DEFAULT_DISK_CHECK_INTERVAL_MS,
  createCollectionDiskSpaceGuard,
} = require('../../services/collection/collectionService');

const realDir = path.resolve(__dirname, '..', '..');

assert.strictEqual(DEFAULT_DISK_CHECK_INTERVAL_MS, 1000);

// 空间充足：放行，且节流窗口内继续放行。
{
  const guard = createCollectionDiskSpaceGuard({
    getDirectory: () => realDir,
    minFreeBytes: 0,
    checkIntervalMs: 60000,
    onInsufficientSpace: () => assert.fail('空间充足时不该回调 onInsufficientSpace'),
  });

  assert.strictEqual(guard.hasEnoughSpace(), true);
  assert.strictEqual(guard.hasEnoughSpace(), true);
  assert.ok(guard.getFreeBytes() > 0);
}

// 空间不足：拦住，**且节流窗口内继续拦住**。
//
// 这是本次修复的正主。原实现在节流窗口内直接 `return true`，于是每秒只有第一帧
// 被拦下、剩下 999 毫秒的帧照写 —— 磁盘满了也停不住。现在窗口内沿用上次结果。
{
  const calls = [];
  const guard = createCollectionDiskSpaceGuard({
    getDirectory: () => realDir,
    minFreeBytes: Number.MAX_SAFE_INTEGER,
    checkIntervalMs: 60000,
    onInsufficientSpace: (info) => calls.push(info),
  });

  assert.strictEqual(guard.hasEnoughSpace(), false);
  assert.strictEqual(guard.hasEnoughSpace(), false, '节流窗口内不许放行');
  assert.strictEqual(guard.hasEnoughSpace(), false);

  // 回调只在真正做检查的那一次触发，不会被每帧刷屏。
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].minFreeBytes, Number.MAX_SAFE_INTEGER);
  assert.ok(Number.isFinite(calls[0].freeBytes));
}

// 读不到剩余空间时按「够」处理：探测失败不该把采集停了。
{
  const guard = createCollectionDiskSpaceGuard({
    getDirectory: () => '',
    minFreeBytes: Number.MAX_SAFE_INTEGER,
    checkIntervalMs: 60000,
    logger: { warn: () => {} },
    onInsufficientSpace: () => assert.fail('探测不到剩余空间时不该判定为不足'),
  });

  assert.strictEqual(guard.getFreeBytes(), null);
  assert.strictEqual(guard.hasEnoughSpace(), true);
}

console.log('collectionDiskSpaceGuard.test.js passed');
