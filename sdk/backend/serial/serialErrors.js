const SERIAL_ERROR_MESSAGES = Object.freeze({
  SERIAL_CONNECT_BUSY: '正在连接中，请稍后再试',
  SERIAL_PORT_BUSY: '串口被占用或访问被拒绝，请关闭其他程序或其他通道，并检查权限后重试',
  SERIAL_PERMISSION_DENIED: '没有访问串口的权限，请检查设备驱动和系统权限',
  SERIAL_PORT_NOT_FOUND: '串口设备不存在或已拔出，请检查 USB 连接并刷新串口列表',
  SERIAL_PORT_RESERVED: '串口正在进行协议识别，请等待识别结束后重试',
  SERIAL_OPEN_FAILED: '串口打开失败，请检查设备连接后重试',
  SERIAL_CONNECT_TIMEOUT: '连接超时，请重新插拔设备后重试',
  SERIAL_CONNECT_CANCELLED: '串口连接已取消',
  SERIAL_DISCONNECTED: '设备连接已断开，请检查 USB 连接',
  SERIAL_RUNTIME_ERROR: '串口通信异常，请检查设备连接',
  SERIAL_CLOSE_FAILED: '串口关闭失败，请重新插拔设备后重试',
  SERIAL_NO_DATA: '串口已打开，但未收到数据，请检查设备是否开始发送',
  SERIAL_NO_FRAME: '未收到完整数据帧，请检查设备、波特率和协议配置',
  SERIAL_BAD_FRAMES: '设备数据连续校验失败，请检查波特率和协议配置',
  SERIAL_LIST_FAILED: '串口列表读取失败，请检查设备驱动后重试',
  SERIAL_NO_PORTS: '未检测到串口设备，请检查 USB 连接和设备驱动',
  SERIAL_NO_MATCH: '未检测到符合筛选条件的 WCH/CH34x 串口设备，请检查设备和驱动',
});

/** 将底层错误转换成带通道、阶段及用户提示的串口错误。 */
function createSerialError(code, detail, { role, path, stage = 'open' } = {}) {
  const error = new Error(SERIAL_ERROR_MESSAGES[code] || SERIAL_ERROR_MESSAGES.SERIAL_OPEN_FAILED);
  Object.assign(error, { code, detail: detail?.message || String(detail || ''), role, path, stage,
    httpStatus: code === 'SERIAL_CONNECT_TIMEOUT' ? 504 : 409 });
  return error;
}

/** 优先使用系统错误码分类；Windows access denied 可能代表占用，提示同时保留权限原因。 */
function normalizeSerialError(error, context = {}, fallback = 'SERIAL_OPEN_FAILED') {
  if (SERIAL_ERROR_MESSAGES[error?.code]) return error;
  const text = `${error?.code || ''} ${error?.message || error || ''}`.toLowerCase();
  let code = fallback;
  if (/busy|already open|cannot lock|access denied/.test(text)) code = 'SERIAL_PORT_BUSY';
  else if (/eacces|eperm|permission|denied/.test(text)) code = 'SERIAL_PERMISSION_DENIED';
  else if (/enoent|not found|no such|does not exist|cannot find/.test(text)) code = 'SERIAL_PORT_NOT_FOUND';
  return createSerialError(code, error, context);
}

/** 生成可通过 HTTP/系统事件传输的错误详情。 */
function serializeSerialError(error) {
  if (!error) return null;
  return { code: error.code, message: error.message, detail: error.detail,
    role: error.role, path: error.path, stage: error.stage };
}

module.exports = { createSerialError, normalizeSerialError, serializeSerialError };
