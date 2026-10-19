import React, { useRef } from 'react';
import { Slider } from 'antd';
import { trackUsage } from '../../services/usageAnalytics';

/** Keep slider behavior unchanged and count one completed mouse or keyboard adjustment. */
export default function UsageSlider({ usageFeature, onChange, onChangeComplete, ...props }) {
  const dirty = useRef(false);
  /** Live visual updates stay local; failed callbacks preserve their original exception. */
  function change(value) {
    dirty.current = true;
    try { onChange?.(value); }
    catch (error) {
      if (usageFeature) trackUsage('analysis_tool_used', { featureId: usageFeature, action: 'adjust', result: 'failure' });
      dirty.current = false; throw error;
    }
  }
  /** Antd calls completion after pointer release or keyboard adjustment, never on every drag step. */
  function complete(value) {
    try {
      onChangeComplete?.(value);
      if (dirty.current && usageFeature) trackUsage('analysis_tool_used', { featureId: usageFeature, action: 'adjust', result: 'success' });
    } catch (error) {
      if (dirty.current && usageFeature) trackUsage('analysis_tool_used', { featureId: usageFeature, action: 'adjust', result: 'failure' });
      throw error;
    } finally { dirty.current = false; }
  }
  return <Slider {...props} onChange={change} onChangeComplete={complete} />;
}
