/**
 * 历史查询服务。
 *
 * 统一封装 matrix 表的索引保障、prepared statement 缓存、日期列表查询、
 * 历史行分页查询和大数据懒加载代理，避免 server.js 直接拼 SQL。
 */
const historyStmtCache = new WeakMap();
const CHANNEL_HISTORY_PAGE_SIZE = 128;

const CHANNEL_HISTORY_METADATA_COLUMNS = Object.freeze([
  ['display_system_id', 'displaySystemId'],
  ['sensor_id', 'sensorId'],
  ['sensor_label', 'sensorLabel'],
  ['sensor_type', 'sensorType'],
  ['output_channel', 'outputChannel'],
  ['schema_version', 'schemaVersion'],
  ['serial_role', 'serialRole'],
  ['serial_port_path', 'serialPortPath'],
  ['baud_rate', 'baudRate'],
  ['parser_channel', 'parserChannel'],
]);

const EMBEDDED_HISTORY_METADATA_PATHS = Object.freeze([
  ['displaySystemId', ['$.displaySystemId']],
  ['sensorId', ['$.sensorId']],
  ['sensorLabel', ['$.sensorLabel', '$.label']],
  ['sensorType', ['$.sensorType']],
  ['outputChannel', ['$.outputChannel']],
  ['schemaVersion', ['$.schemaVersion']],
  ['serialRole', ['$.serialRole', '$.serial.role']],
  ['serialPortPath', ['$.serialPortPath', '$.serial.path']],
  ['baudRate', ['$.baudRate', '$.serial.baudRate']],
  ['parserChannel', ['$.parserChannel', '$.serial.parserChannel']],
]);

const SAFE_HISTORY_JSON = "CASE WHEN json_valid(data) THEN data ELSE '{}' END";
const EMBEDDED_CHANNEL_ID_SQL = `CAST(json_extract(${SAFE_HISTORY_JSON}, '$.channelId') AS TEXT)`;
const EMBEDDED_DISPLAY_SYSTEM_PREDICATE = `(
  COALESCE(json_extract(${SAFE_HISTORY_JSON}, '$.runtimeSource'), '') = 'display-system'
  AND COALESCE(TRIM(${EMBEDDED_CHANNEL_ID_SQL}), '') <> ''
)`;

/**
 * 获取 sqlite 兼容包装对象中的原生数据库连接。
 *
 * @param {object} dbRef 数据库句柄或兼容包装对象。
 * @returns {object | null} 原生数据库连接。
 */
function getNativeDb(dbRef) {
  if (!dbRef) return null;
  return dbRef._db || dbRef.db || (typeof dbRef.prepare === 'function' ? dbRef : null);
}

/**
 * 读取 matrix 的实际列集合；旧库或轻量测试 mock 不支持 PRAGMA 时返回 null。
 *
 * @param {object} dbRef 数据库句柄。
 * @returns {Set<string> | null} 列名集合。
 */
function getMatrixColumnNames(dbRef) {
  const nativeDb = getNativeDb(dbRef);
  if (!nativeDb || typeof nativeDb.prepare !== 'function') return null;
  try {
    const rows = nativeDb.prepare('PRAGMA table_info(matrix)').all();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return new Set(rows.map((row) => row?.name).filter(Boolean));
  } catch {
    return null;
  }
}

/**
 * 检查当前 SQLite 是否带 JSON 函数，用于发现升级前 data JSON 内嵌的 channelId。
 *
 * @param {object} dbRef 数据库句柄。
 * @returns {boolean} 是否可安全执行 json_extract/json_valid。
 */
function supportsHistoryJson(dbRef) {
  const nativeDb = getNativeDb(dbRef);
  if (!nativeDb || typeof nativeDb.prepare !== 'function') return false;
  try {
    return nativeDb.prepare(`SELECT json_extract('{"ok":1}', '$.ok') AS value`).get()?.value === 1;
  } catch {
    return false;
  }
}

/**
 * 构造安全读取旧 matrix.data JSON 字段的 SQL 表达式。
 *
 * @param {string[]} paths JSON path 兜底顺序。
 * @returns {string} COALESCE(json_extract(...)) 表达式。
 */
function buildEmbeddedJsonValueSql(paths) {
  const expressions = paths.map((path) => `json_extract(${SAFE_HISTORY_JSON}, '${path}')`);
  return expressions.length === 1 ? expressions[0] : `COALESCE(${expressions.join(', ')})`;
}

/**
 * 构造严格 channel 过滤；null 排除旧 data JSON 中已带 canonical 身份的 manifest 行。
 *
 * @param {Set<string>|null} columns matrix 列集合。
 * @param {boolean} supportsJson SQLite 是否支持 JSON 函数。
 * @param {string|null} channelId 筛选值。
 * @returns {{clause: string, params: string[]}|null} WHERE 追加片段与参数；无法查询时 null。
 */
function buildChannelHistoryFilter(columns, supportsJson, channelId) {
  const hasColumn = Boolean(columns?.has('channel_id'));
  if (channelId === null) {
    if (hasColumn && supportsJson) {
      return {
        clause: ` AND channel_id IS NULL AND NOT ${EMBEDDED_DISPLAY_SYSTEM_PREDICATE}`,
        params: [],
      };
    }
    if (hasColumn) return { clause: ' AND channel_id IS NULL', params: [] };
    if (supportsJson) {
      return { clause: ` AND NOT ${EMBEDDED_DISPLAY_SYSTEM_PREDICATE}`, params: [] };
    }
    return { clause: '', params: [] };
  }

  if (hasColumn && supportsJson) {
    return {
      clause: ` AND (
        channel_id = ?
        OR (channel_id IS NULL
          AND ${EMBEDDED_DISPLAY_SYSTEM_PREDICATE}
          AND ${EMBEDDED_CHANNEL_ID_SQL} = ?)
      )`,
      params: [channelId, channelId],
    };
  }
  if (hasColumn) return { clause: ' AND channel_id = ?', params: [channelId] };
  if (supportsJson) {
    return {
      clause: ` AND ${EMBEDDED_DISPLAY_SYSTEM_PREDICATE}
        AND ${EMBEDDED_CHANNEL_ID_SQL} = ?`,
      params: [channelId],
    };
  }
  return null;
}

/**
 * 构造空历史统计，供迁移前库与无匹配通道安全降级。
 *
 * @returns {{count: number, minId: number, maxId: number}} 空统计。
 */
function emptyHistoryStats() {
  return { count: 0, minId: 0, maxId: 0 };
}

/**
 * channelId 查询只接受 null 或非空字符串；不 trim，确保数据库严格等值。
 *
 * @param {*} channelId 通道筛选值。
 * @returns {boolean} 是否可用于查询。
 */
function isValidChannelHistoryFilter(channelId) {
  return channelId === null || (typeof channelId === 'string' && channelId.length > 0);
}

/**
 * 将可空元数据加入去重数组。
 *
 * @param {unknown[]} target 目标数组。
 * @param {*} value 待加入值。
 * @returns {void}
 */
function appendUniqueValue(target, value) {
  if (value === null || value === undefined || value === '') return;
  if (!target.includes(value)) target.push(value);
}

/**
 * 单值元数据返回该值；同一会话出现多个物理配置时返回 null，调用方读取复数数组。
 *
 * @param {unknown[]} values 去重值。
 * @returns {*} 唯一值或 null。
 */
function getOnlyValue(values) {
  return values.length === 1 ? values[0] : null;
}

/**
 * 获取并缓存历史查询 prepared statement。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} sql SQL 语句。
 * @returns {object} prepared statement。
 */
function getHistoryStmt(dbRef, sql) {
  const nativeDb = getNativeDb(dbRef);
  if (!nativeDb || typeof nativeDb.prepare !== 'function') {
    throw new Error('invalid history database handle');
  }

  let cache = historyStmtCache.get(nativeDb);
  if (!cache) {
    cache = new Map();
    historyStmtCache.set(nativeDb, cache);
  }

  if (!cache.has(sql)) {
    cache.set(sql, nativeDb.prepare(sql));
  }

  return cache.get(sql);
}

/**
 * 执行历史数据单行查询，并复用 prepared statement。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} sql SQL 语句。
 * @param {Array<unknown>} params 查询参数。
 * @returns {object | undefined} 查询结果。
 */
function dbGetHistory(dbRef, sql, params = []) {
  return getHistoryStmt(dbRef, sql).get(...params);
}

/**
 * 执行历史数据列表查询，并复用 prepared statement。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} sql SQL 语句。
 * @param {Array<unknown>} params 查询参数。
 * @returns {Array<object>} 查询结果列表。
 */
function dbAllHistory(dbRef, sql, params = []) {
  return getHistoryStmt(dbRef, sql).all(...params);
}

/**
 * 确保历史数据表存在按 date/id 查询的索引。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {object} logger 日志对象。
 * @returns {void}
 */
function ensureHistoryIndexes(dbRef, logger) {
  const nativeDb = getNativeDb(dbRef);
  if (!nativeDb || typeof nativeDb.exec !== 'function') return;
  try {
    nativeDb.exec('CREATE INDEX IF NOT EXISTS idx_matrix_date_id ON matrix(date, id)');
  } catch (error) {
    logger?.warn?.('[History] failed to ensure index:', error.message || error);
  }
}

/**
 * 查询指定历史日期的数据量和 ID 范围。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 历史日期标签。
 * @param {object} logger 日志对象。
 * @returns {{ count: number, minId: number, maxId: number }} 历史统计信息。
 */
function getHistoryStats(dbRef, date, logger) {
  if (!dbRef || !date) return { count: 0, minId: 0, maxId: 0 };
  ensureHistoryIndexes(dbRef, logger);
  const row = dbGetHistory(
    dbRef,
    'SELECT COUNT(*) AS count, MIN(id) AS minId, MAX(id) AS maxId FROM matrix WHERE date = ?',
    [date],
  ) || {};

  return {
    count: Number(row.count || 0),
    minId: Number(row.minId || 0),
    maxId: Number(row.maxId || 0),
  };
}

/**
 * 查询指定日期的历史行。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 历史日期标签。
 * @param {number} limit 最大返回条数。
 * @param {number} offset 偏移量。
 * @param {object} logger 日志对象。
 * @returns {Array<object>} 历史行列表。
 */
function queryHistoryRows(dbRef, date, limit, offset = 0, logger) {
  if (!dbRef || !date || limit <= 0) return [];
  ensureHistoryIndexes(dbRef, logger);
  return dbAllHistory(
    dbRef,
    'SELECT * FROM matrix WHERE date = ? ORDER BY id ASC LIMIT ? OFFSET ?',
    [date, limit, Math.max(0, offset)],
  );
}

/**
 * 列出某次采集在一个 matrix 库中实际包含的通道及物理串口元数据。
 *
 * 迁移前已保存到 data JSON 的 manifest channelId 也会被发现，不会混进 null legacy 组；
 * 新行直接按 channel_id 聚合。同一通道物理串口配置变化时，单数字段为 null，完整值保存在
 * serialRoles/serialPortPaths/baudRates/parserChannels 中。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 采集会话标签。
 * @param {object} logger 日志对象。
 * @returns {Array<object>} 通道描述列表。
 */
function queryHistoryChannels(dbRef, date, logger) {
  if (!dbRef || !date) return [];
  const columns = getMatrixColumnNames(dbRef);
  ensureHistoryIndexes(dbRef, logger);
  const hasChannelColumn = Boolean(columns?.has('channel_id'));
  const supportsJson = supportsHistoryJson(dbRef);
  const groups = [];

  const queryGroups = ({ channelExpression, metadata, where, groupBy }) => {
    const groupClause = groupBy.length > 0 ? `GROUP BY ${groupBy.join(', ')}` : '';
    return dbAllHistory(
      dbRef,
      `SELECT ${channelExpression} AS channelId,
        ${metadata.map(({ expression, alias }) => `${expression} AS ${alias}`).join(',\n        ')},
        COUNT(*) AS count,
        MIN(id) AS minId,
        MAX(id) AS maxId
       FROM matrix
       WHERE date = ? AND ${where}
       ${groupClause}
       ORDER BY MIN(id) ASC`,
      [date],
    );
  };

  try {
    const columnMetadata = CHANNEL_HISTORY_METADATA_COLUMNS.map(([column, alias]) => ({
      expression: columns?.has(column) ? column : 'NULL',
      alias,
    }));
    const availableMetadataColumns = CHANNEL_HISTORY_METADATA_COLUMNS
      .map(([column]) => column)
      .filter((column) => columns?.has(column));

    if (hasChannelColumn) {
      groups.push(...queryGroups({
        channelExpression: 'channel_id',
        metadata: columnMetadata,
        where: 'channel_id IS NOT NULL',
        groupBy: ['channel_id', ...availableMetadataColumns],
      }));
    }

    if (supportsJson) {
      const embeddedMetadata = EMBEDDED_HISTORY_METADATA_PATHS.map(([alias, paths]) => ({
        expression: buildEmbeddedJsonValueSql(paths),
        alias,
      }));
      groups.push(...queryGroups({
        channelExpression: EMBEDDED_CHANNEL_ID_SQL,
        metadata: embeddedMetadata,
        where: `${hasChannelColumn ? 'channel_id IS NULL AND ' : ''}${EMBEDDED_DISPLAY_SYSTEM_PREDICATE}`,
        groupBy: [
          EMBEDDED_CHANNEL_ID_SQL,
          ...embeddedMetadata.map(({ expression }) => expression),
        ],
      }));
    }

    groups.push(...queryGroups({
      channelExpression: 'NULL',
      metadata: columnMetadata,
      where: [
        hasChannelColumn ? 'channel_id IS NULL' : '1 = 1',
        supportsJson ? `NOT ${EMBEDDED_DISPLAY_SYSTEM_PREDICATE}` : null,
      ].filter(Boolean).join(' AND '),
      groupBy: availableMetadataColumns,
    }));
  } catch (error) {
    logger?.warn?.('[History] failed to query channels:', error.message || error);
    return [];
  }

  const descriptors = new Map();
  groups.forEach((group) => {
    const channelId = group.channelId == null ? null : String(group.channelId);
    const key = channelId === null ? '__legacy__' : `channel:${channelId}`;
    let descriptor = descriptors.get(key);
    if (!descriptor) {
      descriptor = {
        channelId,
        displaySystemId: group.displaySystemId ?? null,
        sensorId: group.sensorId ?? null,
        sensorLabel: group.sensorLabel ?? null,
        sensorType: group.sensorType ?? null,
        outputChannel: group.outputChannel ?? null,
        schemaVersion: group.schemaVersion == null ? null : Number(group.schemaVersion),
        serialRoles: [],
        serialPortPaths: [],
        baudRates: [],
        parserChannels: [],
        count: 0,
        minId: 0,
        maxId: 0,
      };
      descriptors.set(key, descriptor);
    }

    if (descriptor.displaySystemId == null && group.displaySystemId != null) {
      descriptor.displaySystemId = group.displaySystemId;
    }
    if (descriptor.sensorId == null && group.sensorId != null) descriptor.sensorId = group.sensorId;
    if (descriptor.sensorLabel == null && group.sensorLabel != null) {
      descriptor.sensorLabel = group.sensorLabel;
    }
    if (descriptor.sensorType == null && group.sensorType != null) {
      descriptor.sensorType = group.sensorType;
    }
    if (descriptor.outputChannel == null && group.outputChannel != null) {
      descriptor.outputChannel = group.outputChannel;
    }
    if (group.schemaVersion != null) {
      descriptor.schemaVersion = Math.max(
        Number(descriptor.schemaVersion || 0),
        Number(group.schemaVersion || 0),
      ) || null;
    }
    appendUniqueValue(descriptor.serialRoles, group.serialRole);
    appendUniqueValue(descriptor.serialPortPaths, group.serialPortPath);
    appendUniqueValue(
      descriptor.baudRates,
      group.baudRate == null ? null : Number(group.baudRate),
    );
    appendUniqueValue(descriptor.parserChannels, group.parserChannel);
    descriptor.count += Number(group.count || 0);
    const minId = Number(group.minId || 0);
    const maxId = Number(group.maxId || 0);
    descriptor.minId = descriptor.minId ? Math.min(descriptor.minId, minId) : minId;
    descriptor.maxId = Math.max(descriptor.maxId, maxId);
  });

  return [...descriptors.values()]
    .sort((left, right) => left.minId - right.minId)
    .map((descriptor) => {
      if (descriptor.channelId && (!descriptor.displaySystemId || !descriptor.sensorId)) {
        const separatorIndex = descriptor.channelId.indexOf(':');
        if (separatorIndex > 0) {
          descriptor.displaySystemId ||= descriptor.channelId.slice(0, separatorIndex);
          descriptor.sensorId ||= descriptor.channelId.slice(separatorIndex + 1);
        }
      }
      return {
        ...descriptor,
        serialRole: getOnlyValue(descriptor.serialRoles),
        serialPortPath: getOnlyValue(descriptor.serialPortPaths),
        baudRate: getOnlyValue(descriptor.baudRates),
        parserChannel: getOnlyValue(descriptor.parserChannels),
      };
    });
}

/**
 * 查询一个精确 channelId 的历史统计；null 只匹配 channel_id IS NULL。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 采集会话标签。
 * @param {string|null} channelId canonical channelId，或 null 表示 legacy 行。
 * @param {object} logger 日志对象。
 * @returns {{count: number, minId: number, maxId: number}} 历史统计。
 */
function getChannelHistoryStats(dbRef, date, channelId, logger) {
  if (!dbRef || !date || !isValidChannelHistoryFilter(channelId)) return emptyHistoryStats();
  const columns = getMatrixColumnNames(dbRef);
  const filter = buildChannelHistoryFilter(columns, supportsHistoryJson(dbRef), channelId);
  if (!filter) return emptyHistoryStats();
  ensureHistoryIndexes(dbRef, logger);

  try {
    const row = dbGetHistory(
      dbRef,
      `SELECT COUNT(*) AS count, MIN(id) AS minId, MAX(id) AS maxId
       FROM matrix WHERE date = ?${filter.clause}`,
      [date, ...filter.params],
    ) || {};
    return {
      count: Number(row.count || 0),
      minId: Number(row.minId || 0),
      maxId: Number(row.maxId || 0),
    };
  } catch (error) {
    logger?.warn?.('[History] failed to query channel stats:', error.message || error);
    return emptyHistoryStats();
  }
}

/**
 * 分页读取一个精确 channelId 的历史行；null 不会匹配任何 canonical 行。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 采集会话标签。
 * @param {string|null} channelId canonical channelId，或 null 表示 legacy 行。
 * @param {number} limit 最大返回条数。
 * @param {number} offset 偏移量。
 * @param {object} logger 日志对象。
 * @returns {Array<object>} 历史行。
 */
function queryChannelHistoryRows(dbRef, date, channelId, limit, offset = 0, logger) {
  if (
    !dbRef
    || !date
    || !isValidChannelHistoryFilter(channelId)
    || !Number.isFinite(Number(limit))
    || Number(limit) <= 0
  ) {
    return [];
  }
  const columns = getMatrixColumnNames(dbRef);
  const filter = buildChannelHistoryFilter(columns, supportsHistoryJson(dbRef), channelId);
  if (!filter) return [];
  ensureHistoryIndexes(dbRef, logger);

  const params = [date, ...filter.params];
  params.push(Math.max(1, Math.floor(Number(limit))), Math.max(0, Math.floor(Number(offset) || 0)));
  try {
    return dbAllHistory(
      dbRef,
      `SELECT * FROM matrix
       WHERE date = ?${filter.clause}
       ORDER BY id ASC LIMIT ? OFFSET ?`,
      params,
    );
  } catch (error) {
    logger?.warn?.('[History] failed to query channel rows:', error.message || error);
    return [];
  }
}

/**
 * 查询指定日期前几帧时间戳，用于估算历史回放帧间隔。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 历史日期标签。
 * @param {number} limit 采样条数。
 * @param {object} logger 日志对象。
 * @returns {Array<number>} 时间戳数组。
 */
function queryHistoryTimestampSample(dbRef, date, limit = 21, logger) {
  return queryHistoryRows(dbRef, date, limit, 0, logger)
    .map((row) => row.timestamp)
    .filter((value) => value != null);
}

/**
 * 查询历史采集日期列表。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {number} limit 最大返回条数。
 * @param {number} offset 偏移量。
 * @param {object} logger 日志对象。
 * @returns {Array<object>} 日期行列表。
 */
function queryHistoryDates(dbRef, limit = 500, offset = 0, logger) {
  if (!dbRef) return [];
  try {
    return dbAllHistory(
      dbRef,
      'SELECT DISTINCT date FROM matrix ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [Math.max(0, Number(limit) || 500), Math.max(0, Number(offset) || 0)],
    );
  } catch (error) {
    logger?.error?.('[History] failed to query history dates:', error);
    return [];
  }
}

/**
 * 从指定 ID 开始读取历史行，用于分页或懒加载补充。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 历史日期标签。
 * @param {number} minId 起始 ID。
 * @param {number} limit 最大返回条数。
 * @param {object} logger 日志对象。
 * @returns {Array<object>} 历史行列表。
 */
function queryHistoryRowsFromId(dbRef, date, minId, limit, logger) {
  if (!dbRef || !date || !minId || limit <= 0) return [];
  ensureHistoryIndexes(dbRef, logger);
  return dbAllHistory(
    dbRef,
    'SELECT * FROM matrix WHERE date = ? AND id >= ? ORDER BY id ASC LIMIT ?',
    [date, minId, limit],
  );
}

/**
 * 创建懒加载历史行代理，避免大采集数据一次性读入内存。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 历史日期标签。
 * @param {{ count: number, minId: number }} stats 历史统计信息。
 * @returns {Array<object>} 兼容数组读取的懒加载代理。
 */
function createLazyHistoryRows(dbRef, date, stats) {
  const cache = new Map();
  const maxCacheSize = 512;
  const lengthValue = Number(stats?.count || 0);
  const minId = Number(stats?.minId || 0);

  /**
   * 按下标取一行，带 512 条的**近似** LRU 缓存（512 × 一帧行大小就是这个代理的内存上限）。
   *
   * 越界/无效下标返回 `undefined` 而不抛（数组语义，调用方本来就在用 `if (row)` 判断）。缓存满
   * 了删的是**最早插入**的那条而不是最久未访问的 —— 拖进度条是局部顺序访问，严格 LRU 收益很小。
   *
   * ⚠️ 下标 → id 的换算是 `minId + index`，依赖「同一天的 id 连续无空洞」。用 `id >= ?` +
   * `LIMIT 1` 而非 `id = ?` 是刻意的降级：有空洞（删过行、写入失败过）时取到下一条存在的行，
   * 序列略微错位但**不会返回 undefined 让回放中断** —— 画面跳一帧比整条曲线断掉好。
   *
   * ⚠️ 每次未命中都是一次**同步**数据库查询（见 `sqlite3-compat`），会阻塞事件循环。顺序遍历
   * 几十万行的懒加载序列会让后端卡住 —— 要遍历全序列（如算整段曲线）应走 eager 路径或分批。
   *
   * @param {number} index 行下标。
   * @returns {object|undefined} 历史行；越界或查不到时 undefined。
   */
  const readByIndex = (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= lengthValue || !minId) return undefined;
    if (cache.has(index)) return cache.get(index);

    const row = dbGetHistory(
      dbRef,
      'SELECT * FROM matrix WHERE date = ? AND id >= ? ORDER BY id ASC LIMIT 1',
      [date, minId + index],
    );

    if (cache.size >= maxCacheSize) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    cache.set(index, row);
    return row;
  };

  return new Proxy([], {
    /**
     * 把「读数组」翻译成「查数据库」。
     *
     * 拦截四类：`length`（来自 COUNT，真数组是空的）、三个 `__` 前缀标记（让调用方判断「这是
     * 懒加载的」以及来自哪个库/哪天 —— 用属性而不是 `instanceof`，因为代理伪装成数组、没有自己
     * 的原型可认）、`Symbol.iterator`、以及 `^\d+$` 精确匹配的数字下标（`'1.5'`/`'-1'`/`'01'`
     * 都不算，与真数组下标语义一致）。只实现 `get`：历史数据只读，写入落到空数组上被静默忽略。
     *
     * ⚠️ **代理的目标是一个真空数组，所以 `map`/`filter`/`slice`/`forEach` 都落到空数组的方法
     * 上 —— 不报错，返回 `[]`，静默把几十万帧当成零帧。** 调用方只能用下标循环或 `for...of`。
     * `historySessionService` 那条「lazy 模式下曲线可能只覆盖一部分」的注记就是这个原因。
     *
     * ⚠️ 展开（`[...rows]`）会把整段历史逐行查出来放进内存，正好抵消懒加载的意义。
     */
    get(target, prop) {
      if (prop === 'length') return lengthValue;
      if (prop === '__lazyHistoryRows') return true;
      if (prop === '__historyDate') return date;
      if (prop === '__historyDb') return dbRef;
      if (prop === Symbol.iterator) {
        return function* lazyIterator() {
          for (let i = 0; i < lengthValue; i++) {
            yield readByIndex(i);
          }
        };
      }
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        return readByIndex(Number(prop));
      }
      return target[prop];
    },
  });
}

/**
 * 创建严格按 channelId 分页的懒加载历史代理。
 *
 * canonical 通道在同一 matrix 表内交错写入，不能沿用 `minId + index` 的连续 id 假设；
 * 这里按 128 行分页并使用 OFFSET，确保不会读到相邻通道或重复帧。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 采集会话标签。
 * @param {string|null} channelId canonical channelId，或 null 表示 legacy 行。
 * @param {{count: number}} stats 历史统计。
 * @param {object} logger 日志对象。
 * @returns {Array<object>} 兼容数组下标与迭代器的懒加载代理。
 */
function createLazyChannelHistoryRows(dbRef, date, channelId, stats, logger) {
  const cache = new Map();
  const maxCacheSize = CHANNEL_HISTORY_PAGE_SIZE * 4;
  const lengthValue = Number(stats?.count || 0);

  const remember = (index, row) => {
    if (cache.has(index)) cache.delete(index);
    cache.set(index, row);
    while (cache.size > maxCacheSize) {
      cache.delete(cache.keys().next().value);
    }
  };

  const readByIndex = (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= lengthValue) return undefined;
    if (cache.has(index)) return cache.get(index);

    const pageStart = Math.floor(index / CHANNEL_HISTORY_PAGE_SIZE) * CHANNEL_HISTORY_PAGE_SIZE;
    const pageRows = queryChannelHistoryRows(
      dbRef,
      date,
      channelId,
      Math.min(CHANNEL_HISTORY_PAGE_SIZE, lengthValue - pageStart),
      pageStart,
      logger,
    );
    pageRows.forEach((row, pageIndex) => remember(pageStart + pageIndex, row));
    if (!cache.has(index)) remember(index, undefined);
    return cache.get(index);
  };

  return new Proxy([], {
    get(target, prop) {
      if (prop === 'length') return lengthValue;
      if (prop === '__lazyHistoryRows') return true;
      if (prop === '__historyDate') return date;
      if (prop === '__historyDb') return dbRef;
      if (prop === '__historyChannelId') return channelId;
      if (prop === Symbol.iterator) {
        return function* lazyChannelIterator() {
          for (let i = 0; i < lengthValue; i++) yield readByIndex(i);
        };
      }
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        return readByIndex(Number(prop));
      }
      return target[prop];
    },
  });
}

/**
 * 根据数据规模选择立即加载或懒加载历史行。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 历史日期标签。
 * @param {{ count: number, minId: number }} stats 历史统计信息。
 * @param {boolean} eager 是否立即加载全部行。
 * @param {object} logger 日志对象。
 * @returns {Array<object>} 历史行数组或懒加载代理。
 */
function createHistoryRowsForPlayback(dbRef, date, stats, eager, logger) {
  if (!stats?.count) return [];
  return eager
    ? queryHistoryRows(dbRef, date, stats.count, 0, logger)
    : createLazyHistoryRows(dbRef, date, stats);
}

/**
 * 根据数据规模创建严格按 channelId 隔离的 eager 数组或懒加载代理。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 采集会话标签。
 * @param {string|null} channelId canonical channelId，或 null 表示 legacy 行。
 * @param {{count: number, minId: number, maxId: number}} stats 历史统计。
 * @param {boolean} eager 是否立即加载全部行。
 * @param {object} logger 日志对象。
 * @returns {Array<object>} 历史行数组或懒加载代理。
 */
function createChannelHistoryRowsForPlayback(dbRef, date, channelId, stats, eager, logger) {
  if (!stats?.count || !isValidChannelHistoryFilter(channelId)) return [];
  return eager
    ? queryChannelHistoryRows(dbRef, date, channelId, stats.count, 0, logger)
    : createLazyChannelHistoryRows(dbRef, date, channelId, stats, logger);
}

module.exports = {
  createChannelHistoryRowsForPlayback,
  createHistoryRowsForPlayback,
  createLazyHistoryRows,
  dbAllHistory,
  dbGetHistory,
  ensureHistoryIndexes,
  getChannelHistoryStats,
  getHistoryStats,
  getHistoryStmt,
  getNativeDb,
  queryChannelHistoryRows,
  queryHistoryChannels,
  queryHistoryRows,
  queryHistoryRowsFromId,
  queryHistoryDates,
  queryHistoryTimestampSample,
};
