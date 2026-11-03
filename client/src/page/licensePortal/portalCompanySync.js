import { isHistoryOnlyLicense, readLicenseAccess } from '../../services/licenseAccess';
import { needsCompanySystemSync } from './portalSystems';

/** 同一授权上下文复用目录同步；换密钥、断线和卸载使旧响应失效。 */
export function createPortalCompanySync({ request, onAvailable, onStatus, onSynced }) {
  let contextKey;
  let current = null;

  /** 取消前端接收，不宣称撤回服务端已经开始的同步。 */
  function cancel() {
    contextKey = undefined;
    current = null;
  }

  /** 按授权语义判断刷新，重复收到内容相同的快照不会取消在途请求。 */
  function update({ key, scope, connected, access, attempt = 0 }) {
    const historyOnly = isHistoryOnlyLicense(access);
    const nextKey = JSON.stringify([String(key || '').trim(), scope === undefined ? 'unverified' : scope,
      connected, access?.state || 'legacy', historyOnly, attempt]);
    if (nextKey === contextKey) return;
    contextKey = nextKey;
    const task = { authoritative: false };
    current = task;
    if (!connected || !String(key || '').trim() || scope === undefined || !needsCompanySystemSync(scope)) {
      onAvailable([]);
      onStatus({ phase: 'idle' });
      return;
    }

    Promise.resolve().then(() => request('/api/system-packages/status')).then(status => {
      // ⚠️ 同步成功后不能让更早的空目录覆盖它，否则公司系统会再次显示未授权。
      if (current !== task || task.authoritative) return;
      onAvailable(historyOnly
        ? (isHistoryOnlyLicense(readLicenseAccess(status)) ? status.historyAvailable || [] : [])
        : (status.available || []).map(item => item.systemId));
    }).catch(() => {});
    if (historyOnly) {
      onStatus({ phase: 'history' });
      return;
    }

    onStatus({ phase: 'loading' });
    Promise.resolve().then(() => request('/api/system-packages/sync', { method: 'POST' })).then(result => {
      if (current !== task) return;
      task.authoritative = true;
      onAvailable((result.available || []).map(item => item.systemId));
      onStatus({ phase: 'synced', result });
      onSynced();
    }).catch(error => {
      if (current !== task) return;
      if ([401, 403].includes(error.status)) {
        task.authoritative = true;
        onAvailable([]);
      }
      onStatus({ phase: 'error', error });
    });
  }

  return { update, cancel };
}
