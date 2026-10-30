import { hasValidLicenseDate, isExpiredLicenseMessage } from '../../services/ws/messages';
import { isPortalSystemAllowed, readPortalLicenseScope } from './portalSystems';
import { readLicenseAccess, isHistoryOnlyLicense } from '../../services/licenseAccess';

/**
 * 验证密钥后更新目录，同一连接内进入系统复用已确认的授权。
 * ⚠️ 仅接受绑定密钥的HTTP回执或宿主启动快照，普通广播不能完成在途验证。
 */
export function createPortalEntry({ activate, switchSystem, getManagedIds = () => [], onPhase, onError, onEntered, onValidated, onInvalidated }) {
  let attempt = null;
  let timer = null;
  let verified = null;

  /** 检查授权结果结构和范围，保持正常到期后的历史只读入口。 */
  function readAuthorization(payload) {
    const access = readLicenseAccess(payload);
    if (!hasValidLicenseDate(payload)) throw new Error('密钥验证未返回有效授权，请重试');
    if (access !== undefined && !access.canReadHistory) throw new Error('当前授权不允许进入系统，请检查密钥状态');
    if (isExpiredLicenseMessage(payload) && !isHistoryOnlyLicense(access)) throw new Error('密钥已过期，请输入有效密钥');
    const scope = readPortalLicenseScope(payload);
    if (scope === undefined) throw new Error('未读取到密钥授权范围，请重试');
    return { access, scope };
  }

  /** 仅在相同密钥的授权和电脑凭证仍有效时复用，时间基于宿主快照推进。 */
  function reusable(key) {
    if (!verified || verified.key !== key) return null;
    const { payload, receivedAt } = verified;
    const access = readLicenseAccess(payload);
    if (isHistoryOnlyLicense(access)) return verified;
    const elapsed = Math.max(0, Date.now() - receivedAt);
    const currentTime = (Number(payload.nowDate) || receivedAt) + elapsed;
    const deadlines = [payload.date, access?.expiresAt, access?.licenseExpiresAt]
      .map(Number).filter(value => Number.isFinite(value) && value > 0);
    return deadlines.length && Math.min(...deadlines) > currentTime ? verified : null;
  }

  /** 接入启动时与当前输入密钥匹配的宿主快照，不接受在途验证的替代结果。 */
  function restore({ key, payload }) {
    if (attempt || typeof key !== 'string' || !key.trim()) return false;
    try {
      readAuthorization(payload);
      verified = { key: key.trim(), payload, receivedAt: Date.now() };
      return true;
    } catch { return false; }
  }

  /** 结束本次等待；不会伪称撤销后端已经接收的命令。 */
  function cancel() {
    attempt = null;
    clearTimeout(timer);
    timer = null;
    onPhase('idle');
  }

  /** 换密钥、断线或撤销时清除已验证身份，并取消迟到的页面跳转。 */
  function invalidate() {
    verified = null;
    cancel();
  }

  /** 清理忙碌状态并将失败保留在当前入口。 */
  function fail(message) {
    if (!attempt?.validated) { verified = null; onInvalidated?.(); }
    cancel();
    onError(message);
  }

  /** 首次验证等待HTTP回执，后续进入沿用结果并检查目标范围及本地签名目录。 */
  async function finish(current) {
    try {
      let payload = current.authorization?.payload;
      if (!current.authorization) {
        const ack = await activate(current.key);
        if (attempt !== current) return;
        const activation = ack?.data?.results?.find((result) => result.name === 'license-activation');
        if (activation?.activationCode === 'OK' && !Object.hasOwn(activation, 'payload')) {
          throw new Error('授权服务版本较旧，请完全退出并重新启动 Shroom 后重试');
        }
        payload = activation?.payload;
      }
      const { access, scope } = readAuthorization(payload);
      current.validated = true;
      if (!current.authorization) {
        verified = { key: current.key, payload, receivedAt: Date.now() };
        if (access === undefined) onValidated?.(scope, current.key);
        else onValidated?.(scope, current.key, access);
      }
      if (!current.system) { cancel(); return; }
      // ⚠️ 每次进入公司系统仍读取本地签名目录，不能用已移除的系统清单放行。
      const managedIds = current.system.managed ? await getManagedIds(payload) : [];
      if (attempt !== current) return;
      if (!isPortalSystemAllowed(current.system, scope, managedIds)) {
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
    const access = readLicenseAccess(message);
    const scope = readPortalLicenseScope(message);
    if (verified && ((typeof message?.licenseKey === 'string' && message.licenseKey.trim() !== verified.key)
      || (scope !== undefined && JSON.stringify(scope) !== JSON.stringify(readPortalLicenseScope(verified.payload))))) verified = null;
    if (isHistoryOnlyLicense(access)) {
      if (verified && !isHistoryOnlyLicense(readLicenseAccess(verified.payload))) verified = null;
      return;
    }
    if (isExpiredLicenseMessage(message)) { verified = null; if (attempt) fail('密钥已过期，请输入有效密钥'); return; }
    if (message?.licenseError || message?.licenseLocked || message?.valid === false) {
      verified = null;
      if (attempt) fail(message.licenseError || message.reason || '密钥无效，请检查后重试');
      return;
    }
    if (access !== undefined && !access.canReadHistory) {
      verified = null;
      if (attempt) fail('当前授权不允许进入系统，请检查密钥状态');
    }
  }

  /** 锁定当前密钥及可选目标；重复点击不并发提交。 */
  function start({ system, key, connected }, forceValidation = false) {
    if (attempt) return;
    const normalizedKey = typeof key === 'string' ? key.trim() : '';
    if (!normalizedKey) return onError('请输入访问密钥');
    if (!connected) { verified = null; return onError('与应用的连接已断开，请等待重新连接'); }
    const authorization = forceValidation ? null : reusable(normalizedKey);
    if (!authorization) verified = null;
    const current = { system, key: normalizedKey, validated: Boolean(authorization), authorization };
    attempt = current;
    onError('');
    onPhase(authorization ? 'switching' : 'validating');
    timer = setTimeout(() => {
      if (attempt === current) fail('请求超时，请确认连接及当前系统状态后重试');
    }, 20000);
    void finish(current);
  }

  /** 已验证的同一密钥直接切换；首次或失效时才发起授权请求。 */
  function begin(options) {
    if (!options.system) return onError('请先选择一个展示系统');
    start(options);
  }

  /** 只验证并更新系统列表，不发送系统切换命令。 */
  function validate({ key, connected }) {
    start({ key, connected }, true);
  }

  return { begin, validate, receive, cancel, restore, invalidate };
}
