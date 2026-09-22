const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { compile } = require('./restrictedPython');

const RUNTIME = 'restricted-python-v1';
const STAGES = { 'stored-array': 'processed', data: 'processed', sitData: 'processed', backData: 'processed', headData: 'processed', pressureData: 'processed', normalizedData: 'normalized', rawPressureData: 'calibrated' };

/** 仅把有已测试输入契约的保存版本登记为数值分类包，不执行磁盘上的任意代码。 */
function realtimePackage(draft, includeResolved = false) {
  const input = draft?.report?.inputContract;
  if (draft?.language !== RUNTIME || !/^[A-Za-z0-9_-]{1,50}$/.test(draft.id || '') || typeof draft.systemId !== 'string' || !draft.systemId
    || typeof draft.source !== 'string' || typeof draft.name !== 'string' || !draft.name.trim() || draft.name.length > 100
    || !Array.isArray(draft.labels) || draft.labels.length < 2 || draft.labels.length > 8 || new Set(draft.labels).size !== draft.labels.length
    || draft.labels.some((label) => typeof label !== 'string' || !label.trim() || label.length > 40 || label === '未知')
    || ![16, 32, 64, 128, 256].includes(draft.windowFrames) || !input || !Object.hasOwn(STAGES, input.stage)
    || !Number.isInteger(input.pointCount) || input.pointCount < 1 || input.pointCount > 65536 || input.pointCount * draft.windowFrames > 2000000
    || !Number.isFinite(input.sampleIntervalMs) || input.sampleIntervalMs <= 0 || input.sampleIntervalMs > 5000) return null;
  if (createHash('sha256').update(JSON.stringify(draft.source)).digest('hex') !== draft.report.sourceDigest) return null;
  compile(draft.source);
  const classifier = { source: draft.source, labels: draft.labels, windowFrames: draft.windowFrames, ...input, inputStage: STAGES[input.stage] };
  const revision = createHash('sha256').update(JSON.stringify([draft.systemId, classifier])).digest('hex');
  return { id: `user-${draft.id}`, name: draft.name, version: '1.0.0', runtime: RUNTIME, systemId: draft.systemId, revision,
    description: `用户分类算法 · ${draft.windowFrames} 帧窗口 · ${draft.labels.join(' / ')}${draft.report.split === 'validation' ? ' · 已有独立验证报告' : ' · 仅开发集测试'}`,
    category: 'classification', tags: ['用户算法', '分类'], attachable: true, sampleRateHz: 1000 / input.sampleIntervalMs,
    compatibility: { matrixTotals: [input.pointCount] },
    metricDefinitions: [{ id: 'classIndex', label: '识别类别', unit: '', decimals: 0, panel: 'both', values: { '-1': '未知', ...Object.fromEntries(draft.labels.map((label, index) => [index, label])) } }],
    packageManifest: { input: { mode: 'single-sensor' } },
    ...(includeResolved ? { resolvedPackage: { runtime: RUNTIME, classifier } } : {}) };
}

/** 按文件修订缓存已保存分类包；调用只读目录，不产生或安装 Python 文件。 */
function createRealtimeAlgorithmCatalog(root) {
  const directory = path.join(root, 'algorithm-lab', 'installed');
  const cache = new Map();
  return {
    /** 给系统编辑器或实时服务提供同一份已验证目录。 */
    list({ includeResolved = false } = {}) {
      let names;
      try { names = fs.readdirSync(directory).filter((name) => /^[A-Za-z0-9_-]{1,50}\.json$/.test(name)).slice(0, 1000); } catch { return []; }
      const result = [];
      for (const name of names) {
        try {
          const file = path.join(directory, name), stat = fs.lstatSync(file);
          if (!stat.isFile() || stat.size > 4000000) continue;
          const key = `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
          let entry = cache.get(name);
          if (entry?.key !== key) {
            const draft = JSON.parse(fs.readFileSync(file, 'utf8'));
            entry = { key, item: draft.id === name.slice(0, -5) ? realtimePackage(draft, true) : null }; cache.set(name, entry);
          }
          if (entry.item) { const { resolvedPackage, ...item } = entry.item; result.push(includeResolved ? entry.item : item); }
        } catch { cache.delete(name); }
      }
      for (const name of cache.keys()) if (!names.includes(name)) cache.delete(name);
      return result;
    },
  };
}

module.exports = { RUNTIME, realtimePackage, createRealtimeAlgorithmCatalog };
