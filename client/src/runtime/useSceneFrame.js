import { useEffect, useRef } from 'react';
import { subscribeFrames } from './frameBus';

/**
 * useSceneFrame.js - 渲染器侧的订阅 hook
 *
 * **刻意不叫 `useFrame`** —— react-three-fiber 有一个同名 API，重名会让
 * 以后读代码的人误以为这是 r3f 的东西。
 *
 * handler 存进 ref 而不是进依赖数组：渲染器的帧回调多半是内联箭头函数，
 * 每次渲染都是新引用，直接进依赖会导致**每渲染一次就退订重订一次**。
 * 存 ref 之后订阅只在挂载时建立一次，卸载时退掉。
 */

/**
 * 订阅帧总线。
 *
 * @param {(frame: object) => void} handler 帧回调。传 null 表示暂不订阅。
 * @param {boolean} [enabled] 是否启用订阅，默认 true。
 */
export function useSceneFrame(handler, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeFrames((frame) => {
      const fn = handlerRef.current;
      if (typeof fn === 'function') fn(frame);
    });
  }, [enabled]);
}

export default useSceneFrame;
