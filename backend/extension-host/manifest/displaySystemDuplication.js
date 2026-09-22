const { createHash } = require('crypto');

/** 对编辑视图生成版本摘要，连同映射和算法文件一起检查复制源是否变化。 */
function displaySystemEditorDigest(editor) {
  return createHash('sha256').update(JSON.stringify(editor)).digest('hex');
}

/** 保留原系统结构生成副本；独立身份避免新入口与源系统按 sensor.type 去重。 */
function buildDisplaySystemDuplicateManifest(manifest, options, display) {
  const next = JSON.parse(JSON.stringify(manifest));
  next.id = options.id;
  next.name = String(options.name || '').trim() || `${manifest.name || options.id} 副本`;
  next.display = display;
  // ⚠️ 副本必须标为 user，否则继承 system 来源后会变成不可编辑。
  next.metadata = { ...next.metadata, origin: 'user', derivedFrom: String(manifest.id || '') };
  if (options.independentSensorTypes === true) {
    if (next.sensor) next.sensor.type = options.id;
    if (Array.isArray(next.sensors)) {
      next.sensors = next.sensors.map((sensor, index) => ({ ...sensor, type: index ? `${options.id}-${index + 1}` : options.id }));
    }
  }
  return next;
}

module.exports = { buildDisplaySystemDuplicateManifest, displaySystemEditorDigest };
