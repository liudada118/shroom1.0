import { useEffect } from 'react';
import { bindWorkspaceViewPersistence } from '../../services/workspaceViewConfig';

/** 视角保存独立于工具箱显隐，纯点图模式和异步场景同样恢复。 */
export default function WorkspaceViewPersistence({ rendererRef, systemId, sensorType, mode, history }) {
  useEffect(() => {
    const binding = bindWorkspaceViewPersistence({ rendererRef, systemId, sensorType, mode });
    return () => binding.dispose();
  }, [rendererRef, systemId, sensorType, mode, history]);
  return null;
}
