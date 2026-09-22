import { useCallback, useEffect, useReducer, useRef } from 'react';
import { agentErrorMessage, createAgentViewState, reduceAgentView } from './agentState';

/** 连接桌面 Agent；注入 bridge 仅供调用方与测试替换适配器。 */
export default function useAgentController(bridge) {
  const [view, dispatch] = useReducer(reduceAgentView, undefined, createAgentViewState);
  const mounted = useRef(false);
  const eventVersion = useRef(0);

  /** 读取初始状态时，已有的推送状态优先于迟到的读取结果。 */
  const refresh = useCallback(async () => {
    if (!bridge) return;
    const version = eventVersion.current;
    try {
      const result = await bridge.invoke('getState', {});
      if (!mounted.current || version !== eventVersion.current) return;
      if (!result?.ok) throw new Error(agentErrorMessage(result?.error));
      dispatch({ type: 'state', state: result.data });
    } catch (error) {
      if (mounted.current) dispatch({ type: 'error', message: agentErrorMessage(error) });
    }
  }, [bridge]);

  useEffect(() => {
    mounted.current = true;
    let unsubscribe;
    if (bridge) {
      try {
        unsubscribe = bridge.subscribe((event) => {
          if (!mounted.current) return;
          if (event.type === 'state' || event.type === 'runtime.error') eventVersion.current += 1;
          dispatch(event);
        });
        refresh();
      } catch (error) {
        dispatch({ type: 'error', message: agentErrorMessage(error) });
      }
    }
    return () => { mounted.current = false; unsubscribe?.(); };
  }, [bridge, refresh]);

  /** 执行一个白名单桥操作并保留明确的失败反馈。 */
  const invoke = useCallback(async (action, payload = {}) => {
    if (!bridge) throw new Error('请在 Shroom 桌面软件中使用 Agent。');
    dispatch({ type: 'clearError' });
    try {
      const result = await bridge.invoke(action, payload);
      if (!result?.ok) throw new Error(agentErrorMessage(result?.error));
      await refresh();
      return result.data;
    } catch (error) {
      if (mounted.current) dispatch({ type: 'error', message: agentErrorMessage(error) });
      throw error;
    }
  }, [bridge, refresh]);

  return { ...view, invoke, refresh };
}
