const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildDisplaySystemBuilderCatalog,
  buildDisplaySystemRuntimeDefinition,
  createDisplaySystemWorkspaceService,
  loadDisplaySystemDirectory,
} = require('../../displaySystems');
const { loadSerialProtocolPresets } = require('../../serial/protocols');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-display-builder-'));

try {
  const service = createDisplaySystemWorkspaceService({ writableRoot: temporaryRoot });
  const manifest = {
    id: 'page-created-demo',
    name: 'Page Created Demo',
    version: '1.0.0',
    sensor: {
      type: 'pageCreatedDemo',
      matrix: { rows: 2, cols: 2 },
      ports: ['sit'],
    },
    protocol: {
      baudRate: 115200,
      framing: { type: 'fixedLength', frameLength: 4 },
      decoding: { valueType: 'uint8', byteOffset: 0, valueCount: 4 },
    },
    algorithm: { type: 'json' },
    display: {
      views: [{ id: 'main', type: 'heatmap', source: 'data' }],
      widgets: [{ id: 'main', type: 'heatmap', source: 'data' }],
      renderers: [{ id: 'heatmap', type: 'heatmap' }],
      visualizationAlgorithms: [{ id: 'identity', type: 'identity' }],
      profiles: [{
        id: 'default',
        renderer: 'heatmap',
        visualizationAlgorithm: 'identity',
        widgets: ['main'],
      }],
      defaultView: 'main',
      defaultProfile: 'default',
    },
  };

  const saved = service.save({
    manifest,
    definitions: { algorithmData: { scale: 2, zeroBelow: 3 } },
  });
  assert.strictEqual(saved.id, 'page-created-demo');
  assert.ok(fs.existsSync(path.join(saved.directory, 'display-system.json')));

  const loaded = loadDisplaySystemDirectory(saved.directory, { validateFiles: true });
  assert.strictEqual(loaded.ok, true);
  assert.deepStrictEqual(
    JSON.parse(fs.readFileSync(path.join(saved.directory, 'line-order.json'), 'utf8')).order,
    [1, 2, 3, 4]
  );
  assert.strictEqual(service.read(loaded.config).definitions.algorithmData.scale, 2);
  assert.ok(service.getCatalog().renderers.some((renderer) => renderer.id === 'heatmap'));
  assert.strictEqual(service.getCatalog().serialTemplates.length, 3);
  assert.strictEqual(service.getCatalog().displayTemplates.length, 2);
  assert.deepStrictEqual(
    service.getCatalog().algorithmModes.map((item) => item.id),
    ['none', 'json', 'code'],
  );
  assert.deepStrictEqual(
    service.getCatalog().codeLanguages.map((item) => item.id),
    ['js', 'python'],
  );
  const serialTemplates = new Map(
    service.getCatalog().serialTemplates.map((template) => [template.id, template])
  );
  assert.strictEqual(serialTemplates.get('pressure-fixed-length').defaults.baudRate, 1000000);
  assert.strictEqual(serialTemplates.get('pressure-fixed-length').defaults.framingType, 'fixedLength');
  assert.strictEqual(serialTemplates.get('pressure-u8-tail').defaults.baudRate, 921600);
  assert.strictEqual(serialTemplates.get('pressure-u8-tail').defaults.framingType, 'delimiter');
  assert.strictEqual(serialTemplates.get('pressure-adc16-tail').defaults.valueType, 'uint16le');
  assert.ok(service.getCatalog().baudRates.includes(1000000));

  const pointDrivenManifest = {
    ...manifest,
    id: 'point-driven-demo',
    name: 'Point Driven Demo',
    sensor: {
      ...manifest.sensor,
      type: 'pointDrivenDemo',
      matrix: { rows: 99, cols: 99 },
    },
    protocol: {
      ...manifest.protocol,
      framing: { type: 'delimiter', delimiter: 'AA 55 03 99' },
      decoding: { ...manifest.protocol.decoding, valueCount: 999 },
    },
    algorithm: { type: 'none' },
  };
  const pointDriven = service.save({
    manifest: pointDrivenManifest,
    definitions: {
      pointOrder: [[0, 1], [1, 2]],
      coordinateMap: [
        [[10, 30], [20, 30], [30, 30]],
        [[10, 10], [20, 10], [30, 10]],
      ],
    },
  });
  const pointDrivenSavedManifest = JSON.parse(
    fs.readFileSync(path.join(pointDriven.directory, 'display-system.json'), 'utf8'),
  );
  const pointDrivenSavedPoints = JSON.parse(
    fs.readFileSync(path.join(pointDriven.directory, 'point-order.json'), 'utf8'),
  );
  const pointDrivenSavedCoordinates = JSON.parse(
    fs.readFileSync(path.join(pointDriven.directory, 'coordinate-map.json'), 'utf8'),
  );
  assert.deepStrictEqual(pointDrivenSavedManifest.sensor.matrix, { rows: 2, cols: 3 });
  assert.strictEqual(pointDrivenSavedManifest.protocol.decoding.valueCount, 2);
  assert.deepStrictEqual(
    pointDrivenSavedManifest.protocol.framing.delimiter,
    [0xAA, 0x55, 0x03, 0x99],
  );
  assert.deepStrictEqual(pointDrivenSavedPoints.matrix, { rows: 2, cols: 3 });
  assert.deepStrictEqual(pointDrivenSavedPoints.points, [[0, 1], [1, 2]]);
  assert.deepStrictEqual(pointDrivenSavedManifest.files.coordinateMap, 'coordinate-map.json');
  assert.deepStrictEqual(pointDrivenSavedCoordinates.matrix, { rows: 2, cols: 3 });
  assert.deepStrictEqual(pointDrivenSavedCoordinates.coordinates[1][2], [30, 10]);
  assert.deepStrictEqual(
    JSON.parse(fs.readFileSync(path.join(pointDriven.directory, 'line-order.json'), 'utf8')).order,
    [1, 2],
  );
  const loadedPointDriven = loadDisplaySystemDirectory(pointDriven.directory, { validateFiles: true });
  assert.strictEqual(loadedPointDriven.ok, true);
  assert.deepStrictEqual(loadedPointDriven.config.coordinateMap.bounds, {
    minX: 10,
    maxX: 30,
    minY: 10,
    maxY: 30,
    width: 20,
    height: 20,
  });
  assert.strictEqual(
    buildDisplaySystemRuntimeDefinition(loadedPointDriven.config).displayMetadata.coordinateMap.pointCount,
    6,
  );
  assert.deepStrictEqual(
    service.read(loadedPointDriven.config).definitions.coordinateMap.coordinates[0][0],
    [10, 30],
  );

  assert.throws(() => service.save({ manifest }), /already exists/);
  assert.doesNotThrow(() => service.save({ manifest, overwrite: true }));
  assert.throws(() => service.save({ manifest: { ...manifest, id: '../escape' } }), /may only contain/);
  const javascriptSaved = service.save({
    manifest: {
      ...manifest,
      id: 'javascript-demo',
      sensor: { ...manifest.sensor, type: 'javascriptDemo' },
      algorithm: { type: 'js', timeoutMs: 250 },
    },
    definitions: {
      algorithmSource: `module.exports = function calculate(rawData, context) {
  return { data: context.normalizedData, metrics: { firstRaw: rawData[0] || 0 } };
};`,
    },
  });
  assert.ok(fs.existsSync(path.join(javascriptSaved.directory, 'algorithm.js')));
  const loadedJavascript = loadDisplaySystemDirectory(javascriptSaved.directory, {
    validateFiles: true,
  });
  assert.strictEqual(loadedJavascript.config.algorithm.input.source, 'rawData');
  assert.match(service.read(loadedJavascript.config).definitions.algorithmSource, /rawData/);

  const pythonSaved = service.save({
    manifest: {
      ...manifest,
      id: 'python-demo',
      sensor: { ...manifest.sensor, type: 'pythonDemo' },
      algorithm: { type: 'python', timeoutMs: 500 },
    },
    definitions: {
      algorithmSource: `def calculate(raw_data, context):
    return {"data": context["normalized_data"], "metrics": {"first_raw": raw_data[0]}}
`,
    },
  });
  assert.ok(fs.existsSync(path.join(pythonSaved.directory, 'algorithm.py')));
  assert.strictEqual(
    JSON.parse(fs.readFileSync(path.join(pythonSaved.directory, 'display-system.json'), 'utf8'))
      .algorithm.entry,
    'algorithm.py',
  );

  // ──────────────────────────────────────────────────────────────────────
  // saveDisplaySection —— 只动 display 段，其余字段逐字保留
  // ──────────────────────────────────────────────────────────────────────

  // 手写一份 v3 多传感器 manifest 放在**可写根之外**，模拟自带展示系统的目录：
  // 嵌套的 files 路径、sensors[]、自定义 metadata。这些都是 Builder 的 save()
  // 会重写掉的东西，也正是这条窄通路必须原样留下的东西。
  const nestedRoot = path.join(temporaryRoot, '__resource__', 'nested-multi');
  fs.mkdirSync(path.join(nestedRoot, 'cushion'), { recursive: true });
  fs.writeFileSync(
    path.join(nestedRoot, 'cushion', 'line-order.json'),
    JSON.stringify({ matrix: { rows: 2, cols: 2 }, order: [1, 2, 3, 4] }),
  );
  fs.writeFileSync(path.join(nestedRoot, 'algorithm.js'), 'module.exports = () => ({});\n');
  const nestedManifest = {
    schemaVersion: 3,
    id: 'nested-multi',
    name: 'Nested Multi',
    version: '2.1.0',
    sensors: [{
      id: 'cushion',
      type: 'nestedCushion',
      outputChannel: 'sit',
      matrix: { rows: 2, cols: 2 },
      files: { lineOrder: 'cushion/line-order.json' },
      protocol: {
        baudRate: 921600,
        framing: { type: 'fixedLength', frameLength: 4 },
        decoding: { valueType: 'uint8', valueCount: 4 },
      },
    }],
    algorithm: { type: 'js', entry: 'algorithm.js', timeoutMs: 250 },
    display: {
      widgets: [{ id: 'main', type: 'heatmap', source: 'sitData' }],
      canvas: { colormap: 'thermal' },
    },
    metadata: { origin: 'system', vendor: 'acme' },
  };
  const nestedManifestPath = path.join(nestedRoot, 'display-system.json');
  fs.writeFileSync(nestedManifestPath, `${JSON.stringify(nestedManifest, null, 2)}\n`);

  const sectionSaved = service.saveDisplaySection({ manifestPath: nestedManifestPath }, {
    canvas: { colormap: { id: 'viridis', reverse: true }, overlays: ['legend'] },
    chartAppearance: { colormap: { id: 'inferno' }, overlays: ['gridLines'] },
    chartCards: [{ templateId: 'raw-total', name: '总和', formula: 'sum()', decimals: 1 }],
  });
  assert.strictEqual(sectionSaved.id, 'nested-multi');
  assert.strictEqual(sectionSaved.directory, nestedRoot);

  const sectionOnDisk = JSON.parse(fs.readFileSync(nestedManifestPath, 'utf8'));
  // **这几条是防 manifest 被改坏的关键**：Builder 的 save() 会强制 schemaVersion 2、
  // 把 files 扁平化成 'line-order.json'、重建 algorithm 段。走这条通路一个都不许变。
  assert.strictEqual(sectionOnDisk.schemaVersion, 3);
  assert.deepStrictEqual(sectionOnDisk.sensors, nestedManifest.sensors);
  assert.strictEqual(sectionOnDisk.sensors[0].files.lineOrder, 'cushion/line-order.json');
  assert.deepStrictEqual(sectionOnDisk.algorithm, nestedManifest.algorithm);
  assert.deepStrictEqual(sectionOnDisk.metadata, { origin: 'system', vendor: 'acme' });
  assert.strictEqual(sectionOnDisk.version, '2.1.0');
  // display 段里没被 patch 的字段（widgets）也要留着，只有那三段被替换。
  assert.deepStrictEqual(sectionOnDisk.display.widgets, nestedManifest.display.widgets);
  assert.deepStrictEqual(sectionOnDisk.display.canvas.colormap, { id: 'viridis', reverse: true });
  assert.deepStrictEqual(sectionOnDisk.display.chartAppearance.overlays, ['gridLines']);
  assert.strictEqual(sectionOnDisk.display.chartCards[0].formula, 'sum()');
  // 落盘的是归一后的规范形状：用户拿这个文件夹去二开，里面写着什么就是他学到的写法。
  assert.deepStrictEqual(sectionOnDisk.display.chartCards[0], {
    templateId: 'raw-total',
    name: '总和',
    formula: 'sum()',
    unit: '',
    decimals: 1,
    color: '',
  });
  // canvas.widgets 缺省的含义是"跟随 display.widgets"。归一不许把当时那份抄成
  // 一份显式清单，否则以后改 display.widgets 画布就跟不上了。
  assert.strictEqual('widgets' in sectionOnDisk.display.canvas, false);

  // undefined 表示"这次不改这一段" —— 只保存配色的那次请求不该顺手清空图表卡片。
  service.saveDisplaySection({ manifestPath: nestedManifestPath }, { canvas: { colormap: 'classic' } });
  const afterPartial = JSON.parse(fs.readFileSync(nestedManifestPath, 'utf8'));
  assert.strictEqual(afterPartial.display.chartCards.length, 1);
  assert.deepStrictEqual(afterPartial.display.chartAppearance.overlays, ['gridLines']);
  // null 才是"清掉这一段回到内置默认"。
  service.saveDisplaySection({ manifestPath: nestedManifestPath }, { chartCards: null });
  assert.strictEqual(
    JSON.parse(fs.readFileSync(nestedManifestPath, 'utf8')).display.chartCards,
    undefined,
  );

  // 校验不通过时抛错并带上明细，磁盘上那份不许被动过。
  const beforeInvalid = fs.readFileSync(nestedManifestPath, 'utf8');
  assert.throws(
    () => service.saveDisplaySection({ manifestPath: nestedManifestPath }, {
      chartAppearance: { overlays: ['legend'] },
    }),
    /validation failed/,
  );
  assert.strictEqual(fs.readFileSync(nestedManifestPath, 'utf8'), beforeInvalid);
  // patch 里不认的字段一律不落盘 —— 这条通路只动 display 段那三个字段。
  service.saveDisplaySection({ manifestPath: nestedManifestPath }, { protocol: { baudRate: 9600 } });
  assert.strictEqual(
    JSON.parse(fs.readFileSync(nestedManifestPath, 'utf8')).display.protocol,
    undefined,
  );

  // ──────────────────────────────────────────────────────────────────────
  // duplicate —— 自带展示系统唯一的保存出路
  // ──────────────────────────────────────────────────────────────────────

  const duplicated = service.duplicate({ manifestPath: nestedManifestPath }, {
    id: 'nested-multi-copy',
    name: '我的坐垫',
    canvas: { colormap: 'iceFire', overlays: ['legend', 'gridLines'] },
    chartCards: [{ templateId: 'peak', name: '峰值', formula: 'rawMax()' }],
  });
  assert.strictEqual(duplicated.directory, path.join(temporaryRoot, 'nested-multi-copy'));
  // 必须递归：v3 的线序文件在 cushion/ 子目录里，只复制顶层就是个读不出数据的空壳。
  assert.ok(fs.existsSync(path.join(duplicated.directory, 'cushion', 'line-order.json')));
  assert.ok(fs.existsSync(path.join(duplicated.directory, 'algorithm.js')));

  const copyOnDisk = JSON.parse(
    fs.readFileSync(path.join(duplicated.directory, 'display-system.json'), 'utf8'),
  );
  assert.strictEqual(copyOnDisk.id, 'nested-multi-copy');
  assert.strictEqual(copyOnDisk.name, '我的坐垫');
  // origin 必须被改写成 user，否则副本明明躺在可写目录里也会被判成不可编辑，
  // 用户再也保存不了第二次。
  assert.strictEqual(copyOnDisk.metadata.origin, 'user');
  assert.strictEqual(copyOnDisk.metadata.derivedFrom, 'nested-multi');
  assert.strictEqual(copyOnDisk.metadata.vendor, 'acme');
  assert.strictEqual(copyOnDisk.schemaVersion, 3);
  assert.strictEqual(copyOnDisk.sensors[0].files.lineOrder, 'cushion/line-order.json');
  assert.strictEqual(copyOnDisk.display.canvas.colormap.id, 'iceFire');
  assert.deepStrictEqual(copyOnDisk.display.chartCards.map((card) => card.templateId), ['peak']);
  // 源目录一个字节都没被动过。
  assert.strictEqual(fs.readFileSync(nestedManifestPath, 'utf8').includes('"iceFire"'), false);

  // 撞名要报出来，不能静默覆盖用户已经建好的那份。
  const collision = (() => {
    try {
      service.duplicate({ manifestPath: nestedManifestPath }, { id: 'nested-multi-copy' });
      return null;
    } catch (error) {
      return error;
    }
  })();
  assert.strictEqual(collision?.code, 'DISPLAY_SYSTEM_EXISTS');
  // 没写名字时兜一个「XXX 副本」，而不是留空。
  const unnamed = service.duplicate({ manifestPath: nestedManifestPath }, { id: 'nested-multi-2' });
  assert.strictEqual(unnamed.manifest.name, 'Nested Multi 副本');
  assert.throws(
    () => service.duplicate({ manifestPath: nestedManifestPath }, { id: '../escape' }),
    /may only contain/,
  );

  // -------------------------------------------------------------------------
  // 串口协议预设 → Builder 的 serialTemplates
  //
  // 「新建传感器」页面的模板卡片必须和协议预设库同源：用户往可写目录丢一份 JSON，
  // 卡片就该多一张，选中就把 protocol 段填好。这一组锁的是那层字段翻译。
  // -------------------------------------------------------------------------
  const presetBackedCatalog = buildDisplaySystemBuilderCatalog({
    serialProtocolPresets: loadSerialProtocolPresets().presets,
  });

  // 三份内置模板一个都不能少 —— 旧 manifest 的 metadata.builder.serialTemplate 还指着它们。
  ['pressure-fixed-length', 'pressure-u8-tail', 'pressure-adc16-tail'].forEach((id) => {
    assert.ok(
      presetBackedCatalog.serialTemplates.some((template) => template.id === id),
      `内置模板 ${id} 不见了，旧 manifest 会认不出自己的模板`,
    );
  });

  const standardTemplate = presetBackedCatalog.serialTemplates.find((item) => item.id === 'standard-1024');
  assert.ok(standardTemplate, '预设没有变成 serialTemplate');
  // 分隔符要还原成 Builder 输入框的写法，和内置模板逐字一致的格式。
  assert.strictEqual(standardTemplate.defaults.delimiter, 'AA 55 03 99');
  assert.strictEqual(standardTemplate.defaults.framingType, 'delimiter');
  assert.strictEqual(standardTemplate.defaults.baudRate, 1000000);
  assert.strictEqual(standardTemplate.defaults.valueType, 'uint8');
  assert.strictEqual(standardTemplate.defaults.bytesPerValue, 1);
  assert.strictEqual(standardTemplate.defaults.dataBits, 8);
  assert.strictEqual(standardTemplate.defaults.transportType, 'binary');
  assert.ok(standardTemplate.description, '卡片没有描述文字');
  assert.deepStrictEqual(standardTemplate.matrix, { width: 32, height: 32, total: 1024 });

  // 双字节预设：bytesPerValue 决定定长帧长，配错会算出一半长度的帧。
  const smallBedTemplate = presetBackedCatalog.serialTemplates.find((item) => item.id === 'small-bed-12b');
  assert.strictEqual(smallBedTemplate.defaults.bytesPerValue, 2);
  assert.strictEqual(smallBedTemplate.defaults.dataBits, 12);
  assert.strictEqual(smallBedTemplate.defaults.delimiter, 'AA 00 55 00 03 00 99 00');

  // 预设用的波特率必须并进下拉档位，否则选中预设后波特率框是个没有选项的裸数字。
  assert.ok(presetBackedCatalog.baudRates.includes(3000000), '大床的 3000000 没有进波特率档位');
  assert.deepStrictEqual(
    [...presetBackedCatalog.baudRates].sort((left, right) => left - right),
    presetBackedCatalog.baudRates,
    '波特率档位没有按升序排列',
  );
  assert.strictEqual(
    new Set(presetBackedCatalog.baudRates).size,
    presetBackedCatalog.baudRates.length,
    '波特率档位有重复项',
  );

  // 同 id 时预设覆盖内置模板，且只留一份。
  const overridden = buildDisplaySystemBuilderCatalog({
    serialProtocolPresets: [{
      id: 'pressure-u8-tail',
      label: '我改过的 921600',
      protocol: {
        baudRate: 460800,
        framing: { type: 'fixedLength', frameLength: 64 },
        decoding: { valueType: 'uint32le', valueCount: 16 },
      },
    }],
  }).serialTemplates.filter((template) => template.id === 'pressure-u8-tail');
  assert.strictEqual(overridden.length, 1, '同 id 应该只保留一份');
  assert.strictEqual(overridden[0].label, '我改过的 921600');
  assert.strictEqual(overridden[0].defaults.delimiter, '', '定长帧不该带分隔符');
  // 四字节类型的宽度要走宽度表，不能靠 valueType 里有没有 '16' 猜。
  assert.strictEqual(overridden[0].defaults.bytesPerValue, 4);

  // 一个预设都没有时退化成原来的三份模板，目录页不会因此变空。
  assert.deepStrictEqual(
    buildDisplaySystemBuilderCatalog().serialTemplates.map((template) => template.id),
    ['pressure-fixed-length', 'pressure-u8-tail', 'pressure-adc16-tail'],
  );

  // 服务默认不带预设源，getCatalog 仍然可用（旧调用方不传也不炸）。
  assert.ok(service.getCatalog().serialTemplates.length >= 3);
  // 注入之后 getCatalog 每次重新读，用户新丢的 JSON 刷新页面即可见。
  let presetCalls = 0;
  const wiredService = createDisplaySystemWorkspaceService({
    writableRoot: temporaryRoot,
    listSerialProtocolPresets: () => {
      presetCalls += 1;
      return loadSerialProtocolPresets().presets;
    },
  });
  assert.ok(wiredService.getCatalog().serialTemplates.some((item) => item.id === 'standard-1024'));
  wiredService.getCatalog();
  assert.strictEqual(presetCalls, 2, 'getCatalog 应该每次都重新取预设');

  console.log('workspaceService.test.js passed');
} finally {
  const resolved = path.resolve(temporaryRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir()))) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
