import { hasValidLicenseDate, isExpiredLicenseMessage } from '../../services/ws/messages';
import { isPortalSystemAllowed, readPortalLicenseScope } from './portalSystems';

/**
 * 串起密钥验证与系统切换；只有本次提交的有效授权和 HTTP 确认都到达后才切换。
 * ⚠️ 浏览列表不会调用本控制器；断线、卸载及失败后的迟到消息不能触发跳转。
 */
export function createPortalEntry({ activate, switchSystem, onPhase, onError, onEntered }) {
  let attempt = null;
  let timer = null;
  let scope;

  /** 结束本次等待；不会伪称撤销后端已经接收的命令。 */
  function cancel() {
    attempt = null;
    clearTimeout(timer);
    timer = null;
    onPhase('idle');
  }

  /** 清理忙碌状态并将失败保留在当前入口。 */
  function fail(message) {
    cancel();
    onError(message);
  }

  /** 等待授权命令完成，防止其默认系统晚于用户选择生效。 */
  async function finish(current) {
    try {
      const ack = await current.activation;
      if (attempt !== current) return;
      if (!ack) throw new Error('授权请求未完成，请重试');
      if (!isPortalSystemAllowed(current.system, scope)) {
        throw new Error('当前密钥未授权此系统，请选择可用系统或更换密钥');
      }
      onPhase('switching');
      await switchSystem(current.system.value);
      if (attempt !== current) return;
      cancel();
      onEntered(current.system);
    } catch (error) {
      if (attempt === current) fail(error.message || '进入系统失败，请重试');
    }
  }

  /** 接收既有授权消息，不因后台自动刷新成功而自动进入。 */
  function receive(message) {
    const nextScope = readPortalLicenseScope(message);
    if (nextScope !== undefined) scope = nextScope;
    if (!attempt) return;
    if (message?.licenseError || message?.licenseLocked || message?.valid === false) {
      fail(message.licenseError || message.reason || '密钥无效，请检查后重试');
      return;
    }
    if (!hasValidLicenseDate(message) || attempt.finishing) return;
    if (isExpiredLicenseMessage(message)) {
      fail('密钥已过期，请输入有效密钥');
      return;
    }
    attempt.finishing = true;
    void finish(attempt);
  }

  /** 锁定点击时的系统与密钥，重复点击不会并发提交。 */
  function begin({ system, key, connected }) {
    if (attempt) return;
    if (!system) return onError('请先选择一个展示系统');
    if (!key.trim()) return onError('请输入访问密钥');
    if (!connected) return onError('与应用的连接已断开，请等待重新连接');
    const current = { system, finishing: false };
    scope = undefined;
    attempt = current;
    onError('');
    onPhase('validating');
    timer = setTimeout(() => {
      if (attempt === current) fail('请求超时，请确认连接及当前系统状态后重试');
    }, 20000);
    current.activation = Promise.resolve().then(() => activate(key.trim()));
    current.activation.catch((error) => {
      if (attempt === current) fail(error.message || '授权请求失败');
    });
  }

  return { begin, receive, cancel };
}
