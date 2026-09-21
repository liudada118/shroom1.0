import { message } from 'antd';

const ROLE_LABELS = { sit: '主传感器', back: '背部/右侧传感器', head: '头部传感器', sensor: '附加传感器' };
const CONNECTION_MESSAGES = {
  LICENSE_REQUIRED: '授权无效或已过期，请检查授权后重新连接',
  COMMAND_REQUEST_FAILED: '无法连接设备服务，请检查服务是否正常运行后重试',
  COMMAND_REQUEST_TIMEOUT: '设备服务响应超时，请检查当前连接状态后重试',
};

/** 为错误加上通道和 COM 路径，原始诊断详情不直接冒充操作建议。 */
export function serialErrorText(error, context = {}) {
  const role = error?.role || context.role;
  const path = error?.path || context.path;
  const label = context.label || ROLE_LABELS[role] || role;
  const prefix = [label, path].filter(Boolean).join(' · ');
  const text = CONNECTION_MESSAGES[error?.code] || error?.message || '串口操作失败，请检查设备连接';
  return `${prefix ? `${prefix}：` : ''}${text}`;
}

/** 统一 HTTP 与状态广播的提示，后台重试不重复刷屏。 */
export function createSerialFeedback(notify = message) {
  const shown = new Map();

  /** 同一通道的同一故障只提示一次；扫描提示间隔至少 10 秒。 */
  function error(errorValue, context = {}) {
    if (errorValue?.code === 'SERIAL_CONNECT_CANCELLED') return;
    const role = errorValue?.role || context.role || 'scan';
    const path = errorValue?.path || context.path || '';
    const key = `${role}:${path}:${errorValue?.code || errorValue?.message}`;
    if (shown.has(key) && (role !== 'scan' || Date.now() - shown.get(key) < 10000)) return;
    shown.set(key, Date.now());
    notify.error({ key: `serial:${role}:${path}`, content: serialErrorText(errorValue, context), duration: 6 });
  }

  /** 连接恢复或新的手动尝试后允许再次报告同类故障。 */
  function reset(role, path) {
    for (const key of shown.keys()) {
      if (key.startsWith(`${role}:${path || ''}:`)) shown.delete(key);
    }
  }

  /** 消费低频后端状态；重连耗尽与中途掉线分别给出可操作提示。 */
  function status(value) {
    if (!value?.role) return;
    if (value.status === 'opening' && !value.retryAttempt) reset(value.role, value.path);
    if (value.status === 'open' && !value.error) reset(value.role, value.path);
    if (!value.error) return;
    if (value.retryAttempt > 0 && value.reconnect) return;
    const suffix = value.retryAttempt > 0 && !value.reconnect ? '；自动重连已停止，请手动重试'
      : value.reconnect && value.error.stage === 'runtime' ? '；正在尝试重新连接' : '';
    error({ ...value.error, message: `${value.error.message}${suffix}` }, value);
  }
  return { error, reset, status };
}

export const serialFeedback = createSerialFeedback();
