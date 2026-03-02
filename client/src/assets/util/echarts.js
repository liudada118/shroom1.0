/**
 * echarts.js
 * ECharts Tree-Shaking 桶文件
 *
 * 通过按需导入 ECharts 模块，减少打包体积约 60-70%。
 * 所有使用 ECharts 的组件应从此文件导入，而非直接 import * as echarts from 'echarts'。
 *
 * 使用方式：
 *   import * as echarts from '../../assets/util/echarts';
 *   // 或
 *   import echarts from '../../assets/util/echarts';
 */

import * as echarts from 'echarts/core';

// 图表类型
import { LineChart, BarChart, HeatmapChart, ScatterChart } from 'echarts/charts';

// 组件
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  VisualMapComponent,
  ToolboxComponent,
  MarkLineComponent,
  MarkPointComponent,
} from 'echarts/components';

// 渲染器
import { CanvasRenderer } from 'echarts/renderers';

// 注册所需模块
echarts.use([
  // 图表
  LineChart,
  BarChart,
  HeatmapChart,
  ScatterChart,
  // 组件
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  VisualMapComponent,
  ToolboxComponent,
  MarkLineComponent,
  MarkPointComponent,
  // 渲染器
  CanvasRenderer,
]);

export default echarts;
export { echarts };
