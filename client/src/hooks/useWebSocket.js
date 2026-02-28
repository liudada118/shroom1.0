/**
 * useWebSocket.js
 * WebSocket 连接管理自定义 Hook
 *
 * 封装 WebSocket 连接的完整生命周期管理，替代 Home.js 中
 * 手动管理 3 个 WebSocket 连接（ws/ws1/ws2）的重复代码。
 *
 * 特性：
 *   - 自动连接与断线重连
 *   - 连接状态追踪
 *   - JSON 消息自动序列化/反序列化
 *   - 组件卸载时自动清理
 *
 * 使用示例：
 *   const { sendMessage, lastMessage, readyState } = useWebSocket('ws://localhost:19999', {
 *     onMessage: (data) => console.log(data),
 *     autoReconnect: true,
 *   });
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/** WebSocket 连接状态枚举 */
export const ReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

/**
 * @param {string} url - WebSocket 服务器地址
 * @param {object} options - 配置选项
 * @param {boolean} [options.enabled=true] - 是否启用连接
 * @param {boolean} [options.autoReconnect=true] - 是否自动重连
 * @param {number} [options.reconnectInterval=3000] - 重连间隔（毫秒）
 * @param {number} [options.maxReconnectAttempts=10] - 最大重连次数
 * @param {function} [options.onMessage] - 消息回调 (parsedData, rawEvent) => void
 * @param {function} [options.onOpen] - 连接成功回调
 * @param {function} [options.onClose] - 连接关闭回调
 * @param {function} [options.onError] - 错误回调
 * @returns {{ sendMessage, sendRaw, lastMessage, readyState, reconnect, disconnect }}
 */
export default function useWebSocket(url, options = {}) {
  const {
    enabled = true,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    onMessage,
    onOpen,
    onClose,
    onError,
  } = options;

  const wsRef = useRef(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const unmountedRef = useRef(false);

  const [readyState, setReadyState] = useState(ReadyState.CLOSED);
  const [lastMessage, setLastMessage] = useState(null);

  // 保存最新的回调引用，避免重连时闭包问题
  const callbacksRef = useRef({ onMessage, onOpen, onClose, onError });
  callbacksRef.current = { onMessage, onOpen, onClose, onError };

  const connect = useCallback(() => {
    if (unmountedRef.current || !enabled || !url) return;

    // 清理旧连接
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      if (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
    }

    try {
      const ws = new WebSocket(url.trim());
      wsRef.current = ws;
      setReadyState(ReadyState.CONNECTING);

      ws.onopen = (event) => {
        if (unmountedRef.current) return;
        setReadyState(ReadyState.OPEN);
        reconnectCountRef.current = 0;
        callbacksRef.current.onOpen?.(event);
      };

      ws.onmessage = (event) => {
        if (unmountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          callbacksRef.current.onMessage?.(data, event);
        } catch {
          // 非 JSON 数据直接传递
          setLastMessage(event.data);
          callbacksRef.current.onMessage?.(event.data, event);
        }
      };

      ws.onclose = (event) => {
        if (unmountedRef.current) return;
        setReadyState(ReadyState.CLOSED);
        callbacksRef.current.onClose?.(event);

        // 自动重连
        if (autoReconnect && reconnectCountRef.current < maxReconnectAttempts) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectCountRef.current++;
            console.info(`[useWebSocket] 第 ${reconnectCountRef.current} 次重连: ${url}`);
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (event) => {
        if (unmountedRef.current) return;
        console.error('[useWebSocket] 连接错误:', url);
        callbacksRef.current.onError?.(event);
      };
    } catch (err) {
      console.error('[useWebSocket] 连接创建失败:', err);
    }
  }, [url, enabled, autoReconnect, reconnectInterval, maxReconnectAttempts]);

  // 连接管理
  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  /**
   * 发送 JSON 消息
   * @param {object} data - 要发送的数据对象
   */
  const sendMessage = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('[useWebSocket] 连接未就绪，消息未发送');
    }
  }, []);

  /**
   * 发送原始字符串消息
   * @param {string} data - 原始字符串
   */
  const sendRaw = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  /**
   * 手动触发重连
   */
  const reconnect = useCallback(() => {
    reconnectCountRef.current = 0;
    connect();
  }, [connect]);

  /**
   * 手动断开连接（不自动重连）
   */
  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimerRef.current);
    reconnectCountRef.current = maxReconnectAttempts; // 阻止自动重连
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, [maxReconnectAttempts]);

  return {
    sendMessage,
    sendRaw,
    lastMessage,
    readyState,
    reconnect,
    disconnect,
    wsRef,
  };
}

// 同时支持命名导出，兼容原有引用
export { useWebSocket };
