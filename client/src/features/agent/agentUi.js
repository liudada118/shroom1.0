import i18n, { getLanguageLocale } from '../../i18n';
import { agentUi } from '../../i18n/agentAuditTranslations';

const sourceKeys = new Map(Object.entries(agentUi).map(([key, value]) => [value.zh.trim(), key]));

/** 为组件和纯状态格式化函数使用同一组 Agent 界面词条。 */
export function agentUiText(key, values) {
  return i18n.t(`agentUi.${key}`, values);
}

/** 固定反馈保存词条标识，切换语言时重新翻译；服务端原始错误直接显示。 */
export function agentUiMessage(message) {
  return message && typeof message === 'object' && message.key
    ? agentUiText(message.key, message.values) : message;
}

/** 只翻译已登记的固定标签，未知服务端内容保持原样。 */
export function agentKnownLabel(value) {
  const key = sourceKeys.get(String(value ?? '').trim());
  return key ? agentUiText(key) : value;
}

/** 按应用所选语言显示时间，不跟随操作系统的默认语言。 */
export function agentDate(value) {
  return new Date(value).toLocaleString(getLanguageLocale(i18n.language), { hour12: false });
}
