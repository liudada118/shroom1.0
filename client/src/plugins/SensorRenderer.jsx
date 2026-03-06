/**
 * SensorRenderer.jsx - 传感器组件动态渲染器
 * 
 * 根据 matrixName 从 componentRegistry 中查找对应的组件，
 * 并根据 propsType 传递正确的 props，替代 Home.jsx 中的 if/else 链。
 * 
 * 使用方式:
 *   <SensorRenderer
 *     matrixName={this.state.matrixName}
 *     comRef={this.com}
 *     data={this.data}
 *     local={this.state.local}
 *     hand={this.state.hand}
 *     handleChartsBody={this.handleChartsBody.bind(this)}
 *     handleChartsBody1={this.handleChartsBody1.bind(this)}
 *     changeStateData={this.changeStateData}
 *     changeSelect={this.changeSelect}
 *   />
 */

import React from 'react';
import { getComponentConfig, getDefaultComponentConfig } from './componentRegistry';

/**
 * 根据 propsType 构建对应的 props 对象
 */
function buildProps(propsType, allProps, extraProps = {}) {
  const { comRef, data, local, hand, handleChartsBody, handleChartsBody1, changeStateData, changeSelect } = allProps;

  const base = { ref: comRef, changeSelect };

  switch (propsType) {
    case 'simple':
      return base;

    case 'car':
      return { ...base, changeStateData };

    case 'bed':
      return { ...base, data, handleChartsBody, handleChartsBody1 };

    case 'smallBed':
      return { ...base, data, local, handleChartsBody, handleChartsBody1 };

    case 'hand0205':
      return { ...base, data, local, hand, handleChartsBody, handleChartsBody1, changeStateData };

    case 'standard':
    default:
      return { ...base, data, local, handleChartsBody, handleChartsBody1, changeStateData, ...extraProps };
  }
}

const SensorRenderer = React.forwardRef((props, ref) => {
  const { matrixName, CanvasCom, ...restProps } = props;

  // 从注册表查找组件配置
  const config = getComponentConfig(matrixName) || getDefaultComponentConfig();

  // Num3D 等特殊组件在 Home.jsx 中已单独处理，这里不渲染
  if (!config.component) {
    return null;
  }

  const Component = config.component;
  const componentProps = buildProps(config.propsType, restProps, config.extraProps);

  return (
    <CanvasCom matrixName={matrixName} local={restProps.local}>
      <Component {...componentProps} />
    </CanvasCom>
  );
});

SensorRenderer.displayName = 'SensorRenderer';

export default SensorRenderer;
