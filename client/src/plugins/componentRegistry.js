/**
 * componentRegistry.js - 前端组件注册表
 * 
 * 将 matrixName 到 3D 组件的映射从 Home.jsx 中的 if/else 链
 * 提取为数据驱动的注册表，实现组件的动态查找。
 * 
 * 每个条目定义了:
 *   - component: React 组件的 lazy import 路径
 *   - props: 该组件需要的额外 props 类型
 *   - type: 'standard' | 'car' | 'simple' 决定传递哪些 props
 */

import CanvasCar from "../components/three/carnewTest copy";
import CanvasCarWow from "../components/three/carnewWow";
import CanvasCarQX from "../components/three/carQX";
import CanvasCarSofa from "../components/three/carSofa";
import CanvasDaliegu from "../components/num/daliegu";
import Eye from '../components/three/eye';
import Car10 from "../components/three/car10";
import Canvas from "../components/three/Three";
import CanvasHand from "../components/three/hand";
import Car100 from "../components/car/box100_3";
import Bed4096 from "../components/three/4096";
import Bed1616 from "../components/three/1616";
import Fast256 from '../components/three/NumThreeColor copy';
import Fast1024 from '../components/three/NumThreeColor1024';
import Fast1024sit from '../components/three/NumThreeColor1024sit';
import CanvasnewHand from "../components/three/newhand";
import Gloves from "../components/three/gloves";
import Gloves1 from "../components/three/gloves1";
import Carcol from "../components/three/carCol";
import Hand0205 from "../components/three/hand0205 copy";
import Hand0507 from "../components/three/hand0507";
import Hand0205Point from "../components/three/hand0205Point";
import Hand0205Point147 from "../components/three/hand0205Point147";
import Ware from "../components/three/ware";
import FootVideo from '../components/video/foot';
import FootVideo256 from '../components/video/foot256';
import HandVideo from '../components/video/hand copy';
import HandVideo1 from '../components/video/hand';
import Robot from "../components/video/robot copy 3";
import RobotBlue from "../components/video/robot copyblue";
import RobotBlueSY from '../components/video/robotSY';
import RobotBlueLCF from "../components/video/robotLCF";
import RobotBlue0428 from "../components/video/robot0428";
import MatCol from "../components/three/matCol";
import CarTq from "../components/three/carTq";
import Bed from "../components/three/Bed";
import SmallBed from "../components/three/smallBed";
import SmallM from "../components/three/smallM";
import SmallRect from "../components/three/smallRect";
import SmallShort from "../components/three/Short";
import Sit10 from "../components/three/sit10";
import Box100 from "../components/car/box100";
import SmallSample from "../components/three/smallSample";
import ChairQX from "../components/three/chairQX";

/**
 * props 类型说明:
 * - 'standard': 传递 ref, data, local, handleChartsBody, handleChartsBody1, changeStateData, changeSelect
 * - 'car': 传递 ref, changeSelect, changeStateData
 * - 'simple': 传递 ref, changeSelect
 * - 'hand0205': 传递 ref, data, local, hand, handleChartsBody, handleChartsBody1, changeStateData, changeSelect
 * - 'bed': 传递 ref, data, handleChartsBody, handleChartsBody1, changeSelect
 * - 'smallBed': 传递 ref, data, local, handleChartsBody, handleChartsBody1, changeSelect
 */

const componentRegistry = {
  // === 基础矩阵 ===
  foot: { component: Canvas, propsType: 'simple' },
  hand: { component: CanvasHand, propsType: 'standard' },
  handBlue: { component: CanvasHand, propsType: 'standard' },
  sit: { component: CanvasHand, propsType: 'standard' },
  sitCol: { component: CanvasHand, propsType: 'standard' },
  normal: { component: CanvasHand, propsType: 'standard' },

  // === 汽车座椅 ===
  car: { component: CanvasCar, propsType: 'car' },
  car10: { component: Car10, propsType: 'simple' },
  car100: { component: Car100, propsType: 'standard' },
  volvo: { component: CanvasCarWow, propsType: 'car' },
  carQX: { component: CanvasCarQX, propsType: 'car' },
  sofa: { component: CanvasCarSofa, propsType: 'car' },
  carCol: { component: Carcol, propsType: 'standard' },
  CarTq: { component: CarTq, propsType: 'standard' },
  yanfeng10: { component: Car10, propsType: 'simple' },
  sit10: { component: Sit10, propsType: 'simple' },
  sit100: { component: Box100, propsType: 'standard' },
  back100: { component: Box100, propsType: 'standard' },
  chairQX: { component: ChairQX, propsType: 'standard' },

  // === 床垫 ===
  bigBed: { component: Bed, propsType: 'bed' },
  smallBed: { component: SmallBed, propsType: 'smallBed' },
  smallBed1: { component: SmallBed, propsType: 'smallBed' },
  jqbed: { component: SmallBed, propsType: 'smallBed' },
  xiyueReal1: { component: SmallBed, propsType: 'smallBed' },
  smallM: { component: SmallM, propsType: 'smallBed' },
  rect: { component: SmallRect, propsType: 'smallBed' },
  short: { component: SmallShort, propsType: 'smallBed' },
  bed4096: { component: Bed4096, propsType: 'standard' },
  bed1616: { component: Bed1616, propsType: 'standard' },
  bed4096num: { component: Fast256, propsType: 'standard', extraProps: { size: 1 } },

  // === 手套 ===
  hand0205: { component: Hand0205, propsType: 'hand0205' },
  hand0507: { component: Hand0507, propsType: 'standard' },
  hand0205Point: { component: Hand0205Point, propsType: 'standard' },
  hand0205Point147: { component: Hand0205Point147, propsType: 'standard' },
  newHand: { component: CanvasnewHand, propsType: 'standard' },
  gloves: { component: Gloves, propsType: 'standard' },
  gloves1: { component: Gloves1, propsType: 'standard' },
  gloves2: { component: Gloves1, propsType: 'standard' },
  ware: { component: Ware, propsType: 'standard' },
  Num3D: { component: null, propsType: 'standard' }, // Num3D 在 Home.jsx 中特殊处理

  // === 足底 ===
  footVideo: { component: FootVideo, propsType: 'standard' },
  footVideo256: { component: FootVideo256, propsType: 'standard' },

  // === 视频手 ===
  handVideo: { component: HandVideo, propsType: 'standard' },
  handVideo1: { component: HandVideo1, propsType: 'standard' },

  // === 机器人 ===
  robot: { component: Robot, propsType: 'standard' },
  robot1: { component: RobotBlue, propsType: 'standard' },
  robotSY: { component: RobotBlueSY, propsType: 'standard' },
  robotLCF: { component: RobotBlueLCF, propsType: 'standard' },
  robot0428: { component: RobotBlue0428, propsType: 'standard' },

  // === 快速矩阵 ===
  fast256: { component: Fast256, propsType: 'standard' },
  fast1024: { component: Fast1024, propsType: 'standard' },
  fast1024sit: { component: Fast1024sit, propsType: 'standard' },

  // === 其他 ===
  matCol: { component: MatCol, propsType: 'standard' },
  matColPos: { component: MatCol, propsType: 'standard' },
  daliegu: { component: CanvasDaliegu, propsType: 'standard' },
  eye: { component: Eye, propsType: 'car' },
  smallSample: { component: SmallSample, propsType: 'standard' },
};

/**
 * 获取指定 matrixName 对应的组件和 props 类型
 * @param {string} matrixName 
 * @returns {{ component: React.Component, propsType: string, extraProps?: object } | null}
 */
export function getComponentConfig(matrixName) {
  return componentRegistry[matrixName] || null;
}

/**
 * 获取默认组件配置（当 matrixName 不在注册表中时）
 */
export function getDefaultComponentConfig() {
  return { component: Car10, propsType: 'simple' };
}

export default componentRegistry;
