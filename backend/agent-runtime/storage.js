const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { agentError } = require('./errors');

/** 写入同目录临时文件后替换，失败时保留原始记录。 */
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(handle, JSON.stringify(value));
    fs.fsyncSync(handle);
  } finally { fs.closeSync(handle); }
  try { fs.renameSync(temporary, file); }
  catch (error) {
    try { fs.unlinkSync(temporary); } catch { /* 原记录仍保留。 */ }
    throw error;
  }
}

/** 读取有限大小的 JSON；损坏记录不得当成空白会话覆盖。 */
function readJson(file, fallback, maximumBytes = 12 * 1024 * 1024) {
  if (!fs.existsSync(file)) return fallback;
  try {
    if (fs.statSync(file).size > maximumBytes) throw new Error('record too large');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw agentError('AGENT_STORAGE_INVALID', 'Agent 本地记录无法读取，请保留记录并检查存储目录。');
  }
}

/** 创建独立的任务存储，不连接采集数据库。 */
function createAgentStorage(root) {
  const stateFile = path.join(root, 'state.json');
  /** 记录 ID 只能定位当前 Agent 目录内的单个文件。 */
  function recordPath(directory, id, extension = '.json') {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw agentError('AGENT_INPUT_INVALID', '会话或附件标识无效。');
    return path.join(root, directory, `${id}${extension}`);
  }
  return {
    load: () => readJson(stateFile, null),
    save: (state) => writeJsonAtomic(stateFile, state),
    archive: (conversation) => writeJsonAtomic(recordPath('conversations', conversation.id), conversation),
    readConversation: (id) => readJson(recordPath('conversations', id), null),
    /** 按文件读取历史记录，单个损坏记录不阻止其他会话显示。 */
    listConversations() {
      const directory = path.join(root, 'conversations');
      if (!fs.existsSync(directory)) return [];
      return fs.readdirSync(directory).filter((name) => /^[A-Za-z0-9_-]{1,80}\.json$/.test(name)).map((name) => {
        const id = name.slice(0, -5);
        try { const value = readJson(recordPath('conversations', id), null); return value?.id === id && Array.isArray(value.messages) && Array.isArray(value.tasks) && Array.isArray(value.attachments) ? value : { id, unavailable: true }; }
        catch { return { id, unavailable: true }; }
      });
    },
    /** 图片二进制单独保存，避免每次任务状态更新重写原图。 */
    saveImage(id, base64) {
      const file = recordPath('attachments', id, '.image');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(base64, 'base64'), { flag: 'wx', mode: 0o600 });
    },
    /** 只在发送已选择图片时读取原图，损坏或缺失时明确报错。 */
    readImage(id) {
      const file = recordPath('attachments', id, '.image');
      try {
        const stat = fs.statSync(file);
        if (!stat.isFile() || !stat.size || stat.size > 8 * 1024 * 1024) throw new Error('invalid image');
        return fs.readFileSync(file).toString('base64');
      } catch { throw agentError('AGENT_ATTACHMENT_NOT_FOUND', '原图片无法读取，请重新添加附件。'); }
    },
  };
}

module.exports = { createAgentStorage, writeJsonAtomic, readJson };
