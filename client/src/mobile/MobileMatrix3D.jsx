import React, { useEffect, useRef } from 'react';
import { subscribeFrames } from '@shroom/frontend/core';
import HandMatrix from '../components/three/hand.jsx';
import pointSprite from '../assets/images/circle.png';
import { mobileRendererParameters } from './mobileViewParameters.js';

/** 复用原版32×32点图；只适配帧总线和离线贴图，不更改USB字节或矩阵方向。 */
export default function MobileMatrix3D({ rendererRef, parameters }) {
  const statistics = useRef(null);
  const lastFrame = useRef(Array(1024).fill(0));
  const tuning = useRef(mobileRendererParameters('points', parameters));
  useEffect(() => {
    tuning.current = mobileRendererParameters('points', parameters);
    rendererRef.current?.sitValue(tuning.current);
    // ⚠️ 原点图过滤会清除内部点值；每次调参须重推未过滤帧，否则降低阈值后热点不会恢复。
    rendererRef.current?.sitData({ wsPointData: lastFrame.current, valuelInit: tuning.current.valuelInit });
  }, [parameters, rendererRef]);
  useEffect(() => {
    return subscribeFrames((frame) => {
      const values = frame?.channels?.sit;
      if (Array.isArray(values) && values.length === 1024) {
        lastFrame.current = [...values];
        rendererRef.current?.sitData({ wsPointData: lastFrame.current, valuelInit: tuning.current.valuelInit });
      }
    });
  }, [rendererRef]);
  return <HandMatrix ref={rendererRef} data={statistics} local portalEmbedded pointSprite={pointSprite} />;
}
