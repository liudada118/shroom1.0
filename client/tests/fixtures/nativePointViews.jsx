import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { readWorkspaceToolSupport } from '../../src/page/licensePortal/PortalWorkspaceTools';
import SmallBed from '../../src/components/three/smallBed';
import TempFullBed from '../../src/components/three/tempFullBed';
import Bed from '../../src/components/three/Bed';
import SmallM from '../../src/components/three/smallM';
import Rect from '../../src/components/three/smallRect';
import Short from '../../src/components/three/Short';
import Bed1616 from '../../src/components/three/1616';
import Bed4096 from '../../src/components/three/4096';
import NewHand from '../../src/components/three/newhand';
import Normal from '../../src/components/three/Three';
import Sit10 from '../../src/components/three/sit10';
import Gloves from '../../src/components/three/gloves';
import Gloves1 from '../../src/components/three/gloves1';
import Ware from '../../src/components/three/ware';
import Box100 from '../../src/components/three/box100_3';

const renderers = { smallBed: SmallBed, smallBed12B: SmallBed, tempFullBed: TempFullBed, bigBed: Bed,
  smallM: SmallM, rect: Rect, short: Short, bed1616: Bed1616, bed4096num: Bed4096,
  newHand: NewHand, normal: Normal, sit10: Sit10, gloves: Gloves, gloves1: Gloves1,
  ware: Ware, sit100: Box100 };

/** 仅测试真实点图工具，不连接串口、算法服务或客户数据库。 */
function NativePointViews() {
  const [name, setName] = useState('smallBed');
  const renderer = useRef(null);
  const stats = useRef({ changeData() {}, handleCharts() {}, handleChartsArea() {} });
  const disposedViews = useRef([]);
  useEffect(() => {
    window.__pointViews = {
      names: Object.keys(renderers),
      /** 切换真实渲染器，同时保留旧句柄用于检查卸载状态。 */
      mount(next) { disposedViews.current.push(renderer.current?.getViewTools?.()); setName(next); },
      /** 按真实工具箱的能力判断读取状态。 */
      snapshot() {
        const support = readWorkspaceToolSupport(renderer.current);
        return { name, available: Boolean(support.view), select: support.select,
          state: support.view?.getState(), disposed: disposedViews.current.map((view) => view?.getState().available),
          oldAction: disposedViews.current.at(-1)?.rotate('x') };
      },
      /** 转发真实工具 API，不直接访问或修改 Three.js 对象。 */
      command(method, ...args) { return renderer.current?.getViewTools?.()?.[method](...args); },
      /** 验证旧面板复位、倾角调整和压力输入，保持生产渲染器封装。 */
      rendererCommand(method, ...args) { return renderer.current?.[method]?.(...args); },
    };
  }, [name]);
  const Renderer = renderers[name];
  return <Renderer key={name} ref={renderer} index={0} matrixName={name}
    matrixWidth={name === 'smallBed12B' ? 16 : undefined} matrixHeight={name === 'smallBed12B' ? 64 : undefined}
    data={stats} local changeSelect={() => {}} changeStateData={() => {}}
    handleChartsBody={() => {}} handleChartsBody1={() => {}} />;
}

createRoot(document.getElementById('root')).render(<NativePointViews />);
