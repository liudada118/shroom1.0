import React, { useEffect, useState } from 'react';

/** 在统一工具区选择当前画布渲染器，异步挂载后读取能力，不发送设备命令。 */
export default function PortalRendererControls({ rendererRef, active = true }) {
  const [controls, setControls] = useState(null);
  useEffect(() => {
    if (!active) return undefined;
    /** 仅面板打开时跟随画布能力变化；传感帧不触发设置刷新。 */
    const refresh = () => {
      const next = rendererRef?.current?.getDisplayControls?.() || null;
      setControls((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    refresh();
    const timer = setInterval(refresh, 250);
    return () => clearInterval(timer);
  }, [active, rendererRef]);
  if (!active || !controls?.options?.length) return null;
  return <fieldset className="portal-renderer-controls"><legend>中间可视化</legend>
    <label><span>渲染方式</span><select aria-label="选择渲染器" value={controls.value}
      onChange={(event) => {
        rendererRef.current?.selectRenderer?.(event.target.value);
        setControls((previous) => ({ ...previous, value: event.target.value }));
      }}>
      {controls.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>
    <small>切换只改变中间画布，图表、算法和采集保持当前配置。</small>
  </fieldset>;
}
