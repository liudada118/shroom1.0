const { createHash } = require('node:crypto');
const { queryHistoryDates, queryHistoryChannels, queryChannelHistoryRows, getNativeDb } = require('./historyQueryService');

/** 返回稳定的只读资料错误，不向调用方公开 SQL 或磁盘路径。 */
function recordError(message, status = 400) { return Object.assign(new Error(message), { code: 'ALGORITHM_DATA_INVALID', httpStatus: status }); }

/** 从现有采集库分页读取选定通道；不调用回放控制或修改采集状态。 */
function createAlgorithmRecordService({ getContext, getDatabases }) {
  const records = new Map();
  const readers = new WeakMap();
  let identity = '';
  /** 查询适配器只暴露 SELECT/PRAGMA 读取，历史查询器无法在分析入口建索引。 */
  function reader(db) {
    if (!readers.has(db)) readers.set(db, { prepare(sql) {
      const statement = getNativeDb(db).prepare(sql);
      if (!statement.reader) throw recordError('算法数据入口只允许读取。', 403);
      return { all: (...args) => statement.all(...args), get: (...args) => statement.get(...args) };
    } });
    return readers.get(db);
  }
  /** 系统切换或授权变化后，旧记录标识立即失效。 */
  function context(expected) {
    const current = getContext();
    if (!current.allowed || !current.systemId) throw recordError('请先选择已授权系统。', 403);
    if (identity !== current.systemId) { records.clear(); identity = current.systemId; }
    if (expected && current.systemId !== expected) throw recordError('当前系统已切换，请重新选择算法数据。', 409);
    return current;
  }
  /** 返回当前系统最近采集的通道目录，标识由宿主生成。 */
  function list({ offset = 0 } = {}) {
    const current = context();
    if (!Number.isInteger(offset) || offset < 0 || offset > 10000) throw recordError('记录列表页码无效。');
    const items = [], seen = new Set();
    for (const [role, db] of Object.entries(getDatabases())) {
      if (!db || seen.has(db)) continue;
      seen.add(db);
      for (const { date } of queryHistoryDates(reader(db), 31, offset).slice(0, 30)) {
        if (typeof date !== 'string' || !date || date.length > 256) continue;
        for (const channel of queryHistoryChannels(reader(db), date)) {
          if (channel.displaySystemId && channel.displaySystemId !== current.systemId) continue;
          const id = createHash('sha256').update(JSON.stringify([current.systemId, role, date, channel.channelId])).digest('hex');
          const item = { id, systemId: current.systemId, date, channelId: channel.channelId, channel: channel.sensorLabel || channel.sensorId || role, count: channel.count, maxId: channel.maxId };
          records.set(id, { ...item, db, dbRole: role }); items.push(item);
        }
      }
    }
    while (records.size > 2000) records.delete(records.keys().next().value);
    return { systemId: current.systemId, records: items, offset, nextOffset: items.length ? offset + 30 : null };
  }
  /** 返回真实存储压力值；未存储的原始协议字节不能伪造为原始帧。 */
  function read({ systemId, recordId, offset = 0, limit = 32, maxId } = {}) {
    context(systemId);
    const record = records.get(recordId);
    if (!record || record.systemId !== systemId || record.maxId !== maxId) throw recordError('记录目录已变化，请重新选择采集记录。', 409);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 32 || offset + limit > 1000000) throw recordError('数据读取范围无效。');
    if (getDatabases()[record.dbRole] !== record.db) throw recordError('采集数据库已切换，请刷新记录列表。', 409);
    const rows = queryChannelHistoryRows(reader(record.db), record.date, record.channelId, limit, offset);
    const frames = [];
    for (const row of rows) {
      if (row.id > maxId) break;
      if (typeof row.data !== 'string' || row.data.length > 400000) throw recordError('单帧存储数据过大或格式无效。');
      let value;
      try { value = JSON.parse(row.data); } catch { throw recordError('采集记录含损坏的帧，已停止分析。'); }
      const field = Array.isArray(value) ? null : ['data', 'normalizedData', 'pressureData', 'rawPressureData', 'sitData', 'backData', 'headData'].find((key) => Array.isArray(value?.[key]));
      const values = field ? value[field] : value;
      if (!Array.isArray(values) || !values.length || values.length > 65536 || !values.every((number) => typeof number === 'number' && Number.isFinite(number))) throw recordError('采集帧没有完整、有限的压力数值，不能用于算法分析。');
      if (!Number.isFinite(row.timestamp)) throw recordError('采集帧缺少有效时间戳。');
      frames.push({ id: row.id, timestamp: row.timestamp, values, stage: field || 'stored-array' });
    }
    return { systemId, recordId, frames, nextOffset: offset + frames.length, complete: rows.length < limit || frames.length < rows.length || frames.at(-1)?.id === maxId };
  }
  return { list, read };
}

module.exports = { createAlgorithmRecordService };
