/**
 * useWebSocket.js
 * 自定义 WebSocket Hook
 *
 * 将 Home.js 中重复的 WebSocket 连接、消息处理、断开逻辑
 * 统一封装为可复用的 React Hook，消除重复代码，
 * 并自动管理连接生命周期（组件卸载时自动关闭连接）。
 *
 * 使用示例：
 *   const { sendMessage, readyState } = useWebSocket('ws://127.0.0.1:19999', {
 *     onMessage: (data) => console.log(data),
 *     onOpen: () => console.log('已连接'),
 *   });
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * WebSocket 连接状态枚举（与 WebSocket.readyState 对应）
 */
export const ReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

/**
 * @param {string} url - WebSocket 服务器地址
 * @param {object} options - 配置项
 * @param {function} [options.onMessage] - 收到消息时的回调，参数为已解析的 JSON 对象
 * @param {function} [options.onOpen] - 连接建立时的回调
 * @param {function} [options.onClose] - 连接关闭时的回调
 * @param {function} [options.onError] - 连接出错时的回调
 * @param {boolean} [options.enabled=true] - 是否启用连接（false 时不建立连接）
 * @returns {{ sendMessage: function, readyState: number, wsRef: React.MutableRefObject }}
 */
export function useWebSocket(url, options = {}) {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    enabled = true,
  } = options;

  const wsRef = useRef(null);
  const [readyState, setReadyState] = useState(ReadyState.CLOSED);

  // 使用 ref 保存回调，避免 useEffect 因回调引用变化而重复执行
  const onMessageRef = useRef(onMessage);
  const onOpenRef    = useRef(onOpen);
  const onCloseRef   = useRef(onClose);
  const onErrorRef   = useRef(onError);

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onOpenRef.current    = onOpen;    }, [onOpen]);
  useEffect(() => { onCloseRef.current   = onClose;   }, [onClose]);
  useEffect(() => { onErrorRef.current   = onError;   }, [onError]);

  useEffect(() => {
    if (!enabled || !url) return;

    const ws = new WebSocket(url.trim());
    wsRef.current = ws;
    setReadyState(ReadyState.CONNECTING);

    ws.onopen = () => {
      setReadyState(ReadyState.OPEN);
      onOpenRef.current?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current?.(data);
      } catch {
        // 非 JSON 数据直接传递原始字符串
        onMessageRef.current?.(event.data);
      }
    };

    ws.onerror = (event) => {
      console.error('[useWebSocket] 连接错误:', url, event);
      onErrorRef.current?.(event);
    };

    ws.onclose = (event) => {
      setReadyState(ReadyState.CLOSED);
      onCloseRef.current?.(event);
    };

    // 组件卸载时自动关闭连接
    return () => {
      if (ws.readyState === ReadyState.OPEN || ws.readyState === ReadyState.CONNECTING) {
        ws.close();
      }
    };
  }, [url, enabled]);

  /**
   * 向服务器发送 JSON 数据
   * @param {object} data - 要发送的数据对象
   */
  const sendMessage = useCallback((data) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === ReadyState.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      console.warn('[useWebSocket] 尝试在连接未就绪时发送消息，当前状态:', ws?.readyState);
    }
  }, []);

  return { sendMessage, readyState, wsRef };
}
