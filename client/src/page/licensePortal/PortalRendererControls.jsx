import i18n from '../../i18n';
import React, { useEffect, useState } from 'react';
import { trackUsage } from '../../services/usageAnalytics';

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
  return <fieldset className="portal-renderer-controls"><legend>{i18n.t('monitorUi.visualization')}</legend>
    <label><span>{i18n.t('monitorUi.renderMode')}</span><select aria-label={i18n.t('monitorUi.chooseRenderer')} value={controls.value}
      onChange={(event) => {
        const select = rendererRef.current?.selectRenderer;
        if (typeof select !== 'function') return;
        try {
          select.call(rendererRef.current, event.target.value);
          trackUsage('analysis_tool_used', { featureId: 'display_switch', action: 'select_renderer', result: 'success' });
        } catch (error) {
          trackUsage('analysis_tool_used', { featureId: 'display_switch', action: 'select_renderer', result: 'failure' });
          throw error;
        }
        setControls((previous) => ({ ...previous, value: event.target.value }));
      }}>
      {controls.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>
    <small>{i18n.t('monitorUi.rendererHint')}</small>
  </fieldset>;
}
