import { hasValidLicenseDate, isExpiredLicenseMessage } from '../../services/ws/messages';
import { isPortalSystemAllowed, readPortalLicenseScope } from './portalSystems';

/**
 * 验证密钥后更新目录，或继续切换所选系统。
 * ⚠️ 授权范围只读本次 HTTP 回执；其他窗口的广播不能完成当前请求。
 */
export function createPortalEntry({ activate, switchSystem, onPhase, onError, onEntered, onValidated, onInvalidated }) {
  let attempt = null;
  let timer = null;

  /** 结束本次等待；不会伪称撤销后端已经接收的命令。 */
  function cancel() {
    attempt = null;
    clearTimeout(timer);
    timer = null;
    onPhase('idle');
  }

  /** 清理忙碌状态并将失败保留在当前入口。 */
  function fail(message) {
    if (!attempt?.validated) onInvalidated?.();
    cancel();
    onError(message);
  }

  /** 等待与提交密钥绑定的授权回执，再更新列表或进入系统。 */
  async function finish(current) {
    try {
      const ack = await activate(current.key);
      if (attempt !== current) return;
      const activation = ack?.data?.results?.find((result) => result.name === 'license-activation');
      if (activation?.activationCode === 'OK' && !Object.hasOwn(activation, 'payload')) {
        throw new Error('授权服务版本较旧，请完全退出并重新启动 Shroom 后重试');
      }
      const payload = activation?.payload;
      if (!hasValidLicenseDate(payload)) throw new Error('密钥验证未返回有效授权，请重试');
      if (isExpiredLicenseMessage(payload)) throw new Error('密钥已过期，请输入有效密钥');
      const scope = readPortalLicenseScope(payload);
      if (scope === undefined) throw new Error('未读取到密钥授权范围，请重试');
      current.validated = true;
      onValidated?.(scope, current.key);
      if (!current.system) { cancel(); return; }
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

  /** 撤销授权或锁定消息立即取消当前操作；普通成功广播不推进请求。 */
  function receive(message) {
    if (!attempt) return;
    if (isExpiredLicenseMessage(message)) { fail('密钥已过期，请输入有效密钥'); return; }
    if (message?.licenseError || message?.licenseLocked || message?.valid === false) {
      fail(message.licenseError || message.reason || '密钥无效，请检查后重试');
      return;
    }
  }

  /** 锁定当前密钥及可选目标；重复点击不并发提交。 */
  function start({ system, key, connected }) {
    if (attempt) return;
    const normalizedKey = typeof key === 'string' ? key.trim() : '';
    if (!normalizedKey) return onError('请输入访问密钥');
    if (!connected) return onError('与应用的连接已断开，请等待重新连接');
    const current = { system, key: normalizedKey, validated: false };
    attempt = current;
    onError('');
    onPhase('validating');
    timer = setTimeout(() => {
      if (attempt === current) fail('请求超时，请确认连接及当前系统状态后重试');
    }, 20000);
    void finish(current);
  }

  /** 进入前再次校验密钥，所选系统必须在最新授权范围内。 */
  function begin(options) {
    if (!options.system) return onError('请先选择一个展示系统');
    start(options);
  }

  /** 只验证并更新系统列表，不发送系统切换命令。 */
  function validate({ key, connected }) {
    start({ key, connected });
  }

  return { begin, validate, receive, cancel };
}
