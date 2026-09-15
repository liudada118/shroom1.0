import { commandFromLegacyFields } from '../../services/command/commandClient';

/** 捕获本次界面操作作用域；往返同一系统也不能恢复已失效的异步操作。 */
export function capturePortalOperation(owner) {
  const scope = owner._portalScope;
  const system = owner.props.matrixName;
  return () => !owner._portalUnmounted
    && owner._portalScope === scope
    && owner.props.matrixName === system;
}

/** 逐条发送兼容字段映射的正式命令；跨 await 失效即停止，命令错误原样向上传递。 */
export async function executePortalLegacyControl(client, message, isCurrent) {
  const commands = commandFromLegacyFields(message);
  for (const command of commands) {
    if (!isCurrent()) return false;
    await client.executeEnvelope(command);
  }
  return isCurrent();
}
