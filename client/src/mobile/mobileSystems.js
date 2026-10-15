import { getBuiltinSystemOptions } from '../services/displaySystemOptions.js';
import { bilingualConfig } from '../i18n/resources.js';

// ⚠️ 目录名称沿用桌面，但可运行清单只含已实测协议，避免把32×32帧送入其他设备模型。
export const MOBILE_SYSTEMS = getBuiltinSystemOptions((key) => bilingualConfig[key]?.zh || key)
  .filter((system) => system.value !== 'hand0205Double');

/** 判断当前安装包是否已接入该系统的真实USB协议。 */
export function canRunMobileSystem(id) { return id === 'hand'; }
