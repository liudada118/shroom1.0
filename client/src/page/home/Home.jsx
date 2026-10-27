import React, { useRef, useEffect } from "react";
import Title from "../../components/title/Title";
import { readLicenseAccess, isHistoryOnlyLicense, canUseLicenseCapability, getLicenseExpiryTimestamp } from '../../services/licenseAccess';
import { readCollectionSummary } from '../../services/collectionStatus';
import { finishCollectionBeforeExit } from '../../services/collectionExit';
import { requestJson } from '../../extensions/display-system/api';
import RuntimeStatusNotice from './RuntimeStatusNotice';
import { sendWebSocketJson } from './websocketTransport';
import {
  decodeWebSocketPayload,
  getSensorFrameChannelValue,
  getSensorFrameOutputChannel,
  isSensorFrameForDisplay,
} from '../../services/ws/sensorFrameDecoder';
import { mergeJqbedReturnedSettings, sameJqbedReturnedSettings } from '../../extensions/jqbed/jqbedReturnedSettings';
import { mergeJqbedAlgorithmLogFrame } from '../../extensions/jqbed/jqbedAlgorithmLogState';
import "./index.scss";
import CanvasCar from "../../components/three/carnewTest copy";
import CanvasCarWow from "../../components/three/carnewWow";
import CanvasCarQX from "../../components/three/carQXFbx"
import WholeChair from "../../components/three/wholeChair"
import CanvasCarSofa from "../../components/three/carSofa"
import CanvasDaliegu from "../../components/num/daliegu"
import SmallSample from "../../components/num/smallSample"
import Eye from '../../components/three/eye'
import Car10 from "../../components/three/car10";
import Canvas from "../../components/three/Three";
import CanvasHand from "../../components/three/hand";
import { SceneVisibilityContext } from '../../renderers/sceneVisibility';
import Box100 from "../../components/three/box100_3";
import Car100 from "../../components/car/box100_3";

import Bed4096 from "../../components/three/4096";
import Bed1616 from "../../components/three/1616";
import CanvasnewHand from "../../components/three/newhand";
import Gloves from "../../components/three/gloves";
import Gloves1 from "../../components/three/gloves1";
import Hand0205 from "../../components/three/hand0205 copy";
import Hand0205Double from "../../components/three/hand0205Double";
import GloveMotion from "../../components/three/gloveMotion/GloveMotion";
import GloveTerrain from "../../components/three/gloveTerrain/GloveTerrain";
import { GLOVE_EXHIBITION_MODES, isGloveExhibitionMode, buildGloveExhibitionFrame, gloveExhibitionConfig, resolveGloveQuaternionResetSide, getCalibratedGloveFingers } from './gloveExhibition';
import Minzhen from "../../components/three/minzhen";
import MinzhenSensorPanel from "../../components/minzhen/MinzhenSensorPanel";
import Hand0507 from "../../components/three/hand0507";
import Ware from "../../components/three/ware";
import FootVideo from '../../components/video/foot'
import FootVideo256 from '../../components/video/foot256'
import HandVideo from '../../components/video/hand copy'
import HandVideo1 from '../../components/video/hand'
import Robot from "../../components/video/robot copy 3";
import RobotBlue from "../../components/video/robot copyblue";
import ChairQX from "../../components/video/chairQX";
import RobotBlueSY from '../../components/video/robotSY'
import RobotBlueLCF from "../../components/video/robotLCF";
import RobotBlue0428 from "../../components/video/robot0428";
import HumanBodyCanvas from '../../visualization/human-body/humanBody';
import HumanBodyOptimized from '../../visualization/human-body/HumanBodyOptimized';
import { PRESSURE_VEST_MATRIX, PRESSURE_VEST_PROFILE, PRESSURE_VEST_RAW_LAYOUT, PRESSURE_VEST_SENSOR_INDICES } from '../../components/video/pressureVestConfig';
import { getHumanBodyPressureStatistics } from './humanBodyPressureStatistics';
import CarTq from "../../components/three/carTq";
import Bed from "../../components/three/Bed";
import SmallBed from "../../components/three/smallBed";
import TempFullBed from "../../components/three/tempFullBed";
import SmallM from "../../components/three/smallM";
import SmallRect from "../../components/three/smallRect";
import SmallShort from "../../components/three/Short";
import Sit10 from "../../components/three/sit10";
import Aside from "../../components/aside/Aside";
import ProgressCom from "../../components/progress/Progress";
import plus from "../../assets/images/Plus.png";
import minus from "../../assets/images/Minus.png";
import reset from "../../assets/images/reset.png";
import frontView from "../../assets/images/frontView.svg";
import load from "../../assets/images/load.png";
import enUS from 'antd/locale/en_US';
import jaJP from 'antd/locale/ja_JP';
import zhCN from 'antd/locale/zh_CN';
import refresh from "../../assets/images/refresh.png";
import { useNavigate } from 'react-router-dom'
import { findMax, findMin, initValue, rotate180, rotate90, yanfeng10sit } from "../../assets/util/util";
import { rainbowTextColors, rainbowTextColorsxy } from "../../assets/util/color";
import {
  footLine,
  press,
  calculateY,
  rotateArrayCounter90Degrees,
  calculatePressure,
  objChange,
  arr10to5,
} from "../../assets/util/line";
import { ConfigProvider, Input, Popover, message, Modal, Spin } from "antd";

import { SelectOutlined } from "@ant-design/icons";
import { Num } from "../../components/num/Num";
import HumanBodyRawData from "../../visualization/human-body/HumanBodyRawData";
// `Num3D`（components/num/NumWs.jsx）不再静态 import —— 它的两个渲染点都换成了
// `RendererHost` + `NUM_MATRIX_PRESETS.num3dDefault`，实现在
// `@shroom/frontend/react/numMatrix/backends/canvas2d.js`，经注册表懒加载。
//
// `Num2D` / `Num2DOriginal`（components/num/Num2D.jsx、Num2Doriginal.jsx）同理，
// 两份合成了一个后端 `@shroom/frontend/react/numMatrix/backends/webgl.js`
// （`Num2DOriginal` 的掩码 / POT / 分区布局 / 裸数据转置全部做成了参数开关）。
// 这两个原文件已随本批删除 —— 删掉它们之前 grep 过全仓，除了这两行再无引用方，
// 留壳没有服务对象（`components/num/daliegu.jsx` 里那个 `Num2D` 是它自己的局部同名量）。
import { GloveHandNum2D } from "../../components/num/GloveHandNum2D";
import { LegacyGloveNum2D } from "../../components/num/LegacyGloveNum2D";
import { LegacyGloveNum2DOriginal } from "../../components/num/LegacyGloveNum2DOriginal";
import { calFoot } from "../../assets/util/value";
// `Heatmap`（components/heatmap/canvas.jsx）也不再静态 import —— 那个渲染点换成了
// `RendererHost` + `blobHeatmap`。原路径留了适配壳（`App.jsx:17` 的 /heatmap 路由
// 还在用，而且它一个 prop 都不传，所以壳得自己兜预设），Home 这边直接用参数表。
// `Canvas4096WebGL`（components/webgl/Canvas4096WebGL.jsx）同理，两个渲染点都换成
// `RendererHost` + `webglHeatmap`；那个文件只有本文件一个引用方，所以直接删了、
// 没留壳。它依赖的绘制核 `WebGL.HeatMap copy 2.js` 另有四个 video 组件在用，
// 那个路径留了壳。
import { buildBlobHeatmapParams } from "../../components/heatmap/canvas";
import FootTrack from "../../components/footTrack/footTrack";
import {
  backTypeEvent,
  carFitting,
  headTypeEvent,
  mmghToPress,
  pointToN,
  sitTypeEvent,
  totalToN,
} from "./util";

import { withTranslation } from "react-i18next";
import { getLanguageLocale, normalizeLanguage } from '../../i18n';
import { translateBackendMessage } from '../../i18n/translateBackendMessage';
import { translateDomainLabel } from '../../i18n/translateDomainLabel';
import { speakLocalizedMessage } from './speechSynthesis';
import { createJqbedAlarmSpeechState } from './jqbedAlarmSpeech';
import { chestLine, flLine, frLine, genWebglData, handSkinChange, heatMapMax, hlLine, hrLine, robot0401 } from "./robotUtil";
import { WebGLCanvas } from "../../components/webgl/WebGL.HeatMap copy 2";
import { WS_URLS } from "../../constants";
import { createJsonWebSocket } from "../../services/ws/messages";
import { commandClient } from "../../services/command/commandClient";
import { serialFeedback } from '../../services/serial/serialFeedback';
import { getCurrentSensorTypeFromStatus } from "../../services/sensorStatus";
import { getNativeSystemTemplate, resolveNativeSystemType, selectedNativeSystemId } from '../../displays/nativeSystemTemplates';
import {
  getDisplayDefinition,
  listRuntimeDisplayDefinitions,
  registerRuntimeDisplayDefinition,
} from '../../displays/registry';
import { readManifestChannelFrames } from '../../extensions/display-system/manifestSceneAdapter';
import ManifestSidebarOverlay from '../../extensions/display-system/ManifestSidebarOverlay.jsx';
import PortalAlgorithmMarket from '../licensePortal/PortalAlgorithmMarket.jsx';
import RendererHost from '../../renderers/RendererHost.jsx';
import { resolveRendererFromDefinition } from '../../renderers/registry';
// 只引参数表，不引渲染器本体 —— params.js 是纯函数模块（无 three.js），
// PointGridRenderer.jsx 仍然由 RendererHost 懒加载，不进 Home 的 chunk。
import { LEGACY_PRESETS as POINT_GRID_PRESETS } from '../../renderers/pointGrid/params';
import { LEGACY_PRESETS as NUM_MATRIX_PRESETS } from '../../renderers/numMatrix/params';
// 手部点云是本轮新搬进包的，原路径（components/three/hand0205Point*.jsx）除了
// 这个文件没有别的 import，所以那两个文件直接删了、`renderers/` 下也没留壳 ——
// 这里直接从包里取参数表。同样只引 params，渲染器本体走懒加载。
import { LEGACY_PRESETS as HAND_POINTS_PRESETS } from '@shroom/frontend/core/handPoints';
// 两条热力图是第四轮搬进包的。`webglHeatmap` 的参数表在这里取；`blobHeatmap` 的
// 走上面那个适配壳导出的 `buildBlobHeatmapParams`（它还要读一次阈值存储）。
import { LEGACY_PRESETS as WEBGL_HEATMAP_PRESETS } from '@shroom/frontend/core/webglHeatmap';
import { clearLastFrame, publishFrame } from '../../runtime/frameBus';
import { SCENE_CHANNELS, buildSceneFrame } from '../../runtime/sceneFrame';
import {
  buildDisplayProfileModel,
  resolveChartAppearance,
  resolveDisplayProfile,
} from '../../extensions/display-system/displayProfileRuntime';
import {
  clearDisplayDraftSelection,
} from '../../extensions/display-system/displayDraftState';
import {
  duplicateDisplaySystem,
  saveDisplaySection,
} from '../../extensions/display-system/api';
import { FORMULA_CHART_TEMPLATES } from '../../components/aside/formulaChartTemplates';
import {
  FORMULA_CHART_LIMIT,
  addFormulaChartFromTemplate,
  formulaChartStorageKey,
  hasFormulaCharts,
  listFormulaChartTemplateIds,
  loadFormulaCharts,
  removeFormulaChart,
  resetFormulaCharts,
  subscribeFormulaCharts,
} from '../../components/aside/formulaChartStore';
import {
  readDisplaySelection,
  writeDisplaySelection,
} from '../../extensions/display-system/displayProfileStorage';
import { isClassicColormap } from '../../extensions/display-system/colormaps';
import {
  buildBasicControlCollectionRow,
  buildExtendedControlCollectionRow,
  CONTROL_COMMANDS,
  getControlList,
  getMetricStateUpdate,
  parseControlMessage,
} from "../../services/ws/controlMessages";
import {
  DEFAULT_RENDERER_CONFIG as SMALL_BED_12B_DEFAULT_RENDERER_CONFIG,
  getDisplayOptions as getSmallBed12BDisplayOptions,
  getInitialDisplayState as getSmallBed12BInitialDisplayState,
  normalizeRendererConfig as normalizeSmallBed12BRendererConfig,
} from "./smallBed12BDisplay";

const ANT_DESIGN_LOCALES = Object.freeze({ zh: zhCN, en: enUS, ja: jaJP });

const SINGLE_GLOVE_MATRIX = 'hand0205'
const SINGLE_GLOVE_ALIAS = 'hand0205Single'
const FULL_PACKET_GLOVE_MATRIX = 'handGloveFullPacket'
const DisplaySystemBuilder = React.lazy(() => import('../displaySystemBuilder/DisplaySystemBuilder'))
const ManifestDisplayRenderer = React.lazy(() => import('../../extensions/display-system/ManifestDisplayRenderer.jsx'))
const HAND_0205_DOUBLE_MATRIX = 'hand0205Double'
const MINZHEN_MATRIX = 'minzhen'
const SMALL_BED_NO_ALG_MATRIX = 'smallBedNoAlg'
const SMALL_BED_12B_MATRIX = 'smallBed12B'
const FULL_PACKET_GLOVE_MODES = ['num', 'numoriginal', ...GLOVE_EXHIBITION_MODES]
const WHOLE_CHAIR_MATRIX = 'wholeChair'
const HIDDEN_DISPLAY_MATRIX_TYPES = [SINGLE_GLOVE_ALIAS]
/** 副本使用原生型号选取渲染分支，独立身份另外保留在 systemId。 */
const normalizeDisplayMatrixName = (matrixName) => {
  const nativeType = resolveNativeSystemType(matrixName);
  if (nativeType !== matrixName || selectedNativeSystemId(matrixName) !== matrixName) return nativeType;
  return HIDDEN_DISPLAY_MATRIX_TYPES.includes(matrixName) ? 'hand0205' : matrixName;
}
const filterVisibleDisplayMatrixTypes = (types) =>
  [...new Set(types.map(normalizeDisplayMatrixName).filter(Boolean))]
const resolveBackendDisplayMatrixName = (activeSensorType, allowedTypes, currentMatrixName) => {
  const backendMatrixName = normalizeDisplayMatrixName(activeSensorType)
  const normalizedCurrentMatrixName = normalizeDisplayMatrixName(currentMatrixName)
  const hasRestrictedTypes = Array.isArray(allowedTypes) && allowedTypes.length > 0

  if (backendMatrixName && (!hasRestrictedTypes || allowedTypes.includes(backendMatrixName))) {
    return backendMatrixName
  }
  if (!hasRestrictedTypes || allowedTypes.includes(normalizedCurrentMatrixName)) {
    return normalizedCurrentMatrixName
  }
  return allowedTypes[0] || normalizedCurrentMatrixName
}
const tactileGloveTypes = [SINGLE_GLOVE_MATRIX, HAND_0205_DOUBLE_MATRIX, 'handGlove115200', FULL_PACKET_GLOVE_MATRIX]
// 手套双手同显：这些模式下 sit(左手)/back(右手) 两路数据同时驱动左右手视图，
// 不再按最后选择的串口切换单手；num3D/skin 仍沿用单手切换逻辑
const DUAL_GLOVE_MODES = ['normal', 'num', 'numoriginal', ...GLOVE_EXHIBITION_MODES]
const isDualGloveDisplay = (matrixName, mode) =>
  matrixName !== SINGLE_GLOVE_MATRIX &&
  (tactileGloveTypes.includes(matrixName) || matrixName === HAND_0205_DOUBLE_MATRIX) &&
  DUAL_GLOVE_MODES.includes(mode)
// 2D 数字按手指/手掌形状展示的手套类型（整包手套点位不同，仍用 16x16 矩阵）
const GLOVE_HAND_LAYOUT_TYPES = [HAND_0205_DOUBLE_MATRIX, 'handGlove115200']
const isTactileGloveMappedLength = (matrixName, length) => {
  return length === 147 || (matrixName === 'handGloveFullPacket' && length === 195)
}

/**
 * 走 `numMatrix` 渲染器的展示形式 → 参数预设。
 *
 * 原来是四条 `matrixName == 'xxx' ? <FastNNN .../>` 的三元分支，分别指向
 * `NumThreeColor copy` / `NumThreeColor1024` / `NumThreeColor1024sit`。三份文件
 * 逐行比对后的结论是它们是同一个渲染器（布局公式代数等价，逐点验算见
 * `renderers/numMatrix/pipeline.test.js`），差异全部收进了预设，所以这里换成
 * 一张表 —— 加一个展示形式只需在表里加一行，不必再回来加分支。
 *
 * `normalFast` 与 `fast1024` 两条原本是两个完全相同的分支，指向同一份文件。
 */
const NUM_MATRIX_SCENES = {
  fast256: NUM_MATRIX_PRESETS.fast256,
  normalFast: NUM_MATRIX_PRESETS.fast1024,
  fast1024: NUM_MATRIX_PRESETS.fast1024,
  fast1024sit: NUM_MATRIX_PRESETS.fast1024sit,
}

/**
 * 原始矩阵统一使用蓝底数字；索引仅用于展示，尺寸仍取真实通道。
 * 小床帧已在分派入口转置，不能再套 jqbed 的 rawTranspose。
 * @param {string} matrixName 当前原生型号。
 * @param {object} definition 运行期展示定义。
 * @param {{width?:number,height?:number}} matrixSize 后端回传的矩阵尺寸。
 * @returns {object} 数字渲染器参数。
 */
const buildNumMatrixParams = (matrixName, definition, matrixSize = {}) => {
  const fromManifest = definition?.source === 'manifest';
  return {
    ...NUM_MATRIX_PRESETS.webglRawDefault,
    frameInput: 'raw',
    ...(matrixName === SMALL_BED_12B_MATRIX ? { decimalScale: 10, chartPadding: 5, totalMetric: 'max' } : {}),
    gridWidth: fromManifest ? definition.matrix?.width : matrixName === 'matCol' ? 16
      : matrixName === SMALL_BED_12B_MATRIX ? matrixSize.width : 32,
    gridHeight: fromManifest ? definition.matrix?.height : matrixName === 'matCol' ? 10
      : matrixName === SMALL_BED_12B_MATRIX ? matrixSize.height : 32,
    manageSidebar: !fromManifest && matrixName !== MINZHEN_MATRIX,
  };
}

/**
 * 「数字」`num` 这条通路的 `matrixName` → 预设映射。
 *
 * 原来是 `<Num2D matrixName={...}>` 自己在组件里判：`carCol` 一支给 10×9、
 * `footVideo` 一支走双画布、手套四型走 147 点散布。分支就那三处，折成三行表。
 *
 * ⚠️ `robot1` 落到 `webglNumDefault` 是**故意的，画面本来就是空的** ——
 * `Num2D.changeWsData147` 的 else 分支只处理足底，机器人帧进来只更新侧栏读数。
 * 这条通路要显示机器人得用「原始数据」，见 `webglNumDefault` 的注释。
 *
 * @param {string} matrixName 当前展示形式。
 * @returns {object} 传给 RendererHost 的 params。
 */
const buildWebglNumParams = (matrixName) => {
  if (matrixName === FULL_PACKET_GLOVE_MATRIX) return NUM_MATRIX_PRESETS.webglNumGloveFullPacket
  if (tactileGloveTypes.includes(matrixName)) return NUM_MATRIX_PRESETS.webglNumGlove
  if (matrixName === 'footVideo') return NUM_MATRIX_PRESETS.webglNumFoot
  if (matrixName === 'carCol') return NUM_MATRIX_PRESETS.webglNumCarCol
  return NUM_MATRIX_PRESETS.webglNumDefault
}

/**
 * 「原始数据」走 `Num2Doriginal` 那一支的 `matrixName` → 预设映射。
 *
 * 这张表是 `Num2Doriginal.jsx:554-571` 的尺寸 `if/else` 加
 * `changeWsData147`（940-1014）的通路 `if/else` 合起来的全部内容。原实现有
 * 12+ 处 `props.matrixName ==`，折平成这 10 行 —— 加一款设备从此是加一行数据。
 *
 * `jqbed` 是 `RAW_TRANSPOSE_MATRIX_TYPES` 四个键里**唯一走得到这条通路的**
 * （`smallBed` 三型在数据分派入口已转置），所以只有它要转置。
 *
 * @param {string} matrixName 当前展示形式。
 * @returns {object} 传给 RendererHost 的 params。
 */
const buildWebglRawParams = (matrixName) => {
  if (matrixName === FULL_PACKET_GLOVE_MATRIX) return NUM_MATRIX_PRESETS.webglRawGloveFullPacket
  if (tactileGloveTypes.includes(matrixName)) return NUM_MATRIX_PRESETS.webglRawGlove
  if (matrixName === 'footVideo') return NUM_MATRIX_PRESETS.webglRawFoot
  if (matrixName === 'robotSY') return NUM_MATRIX_PRESETS.webglRawRobotSY
  if (matrixName === 'robotLCF') return NUM_MATRIX_PRESETS.webglRawRobotLCF
  if (matrixName === 'robot1') return NUM_MATRIX_PRESETS.webglRawRobot1
  if (matrixName === 'carCol') return NUM_MATRIX_PRESETS.webglRawCarCol
  if (matrixName === 'daliegu') return NUM_MATRIX_PRESETS.webglRawDaliegu
  if (matrixName === 'smallSample') return NUM_MATRIX_PRESETS.webglRawSmallSample
  if (matrixName === tempFullBedMatrix) return NUM_MATRIX_PRESETS.webglRawTempFullBed
  if (matrixName === 'bed4096num') return NUM_MATRIX_PRESETS.webglRawBed4096num
  if (matrixName === 'jqbed') return NUM_MATRIX_PRESETS.webglRawTransposed
  return NUM_MATRIX_PRESETS.webglRawDefault
}

const getMappedPressurePayload = (jsonObject, matrixName) => {
  if (matrixName === 'handGloveFullPacket') {
    return jsonObject.mappedArr195 ?? jsonObject.newArr147 ?? jsonObject.newArr
  }
  return jsonObject.newArr ?? jsonObject.newArr147
}

const parsePressurePayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload
  }
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload)
    } catch (error) {
      return []
    }
  }
  return []
}

const getRawPressurePayload = (jsonObject, channel) => {
  const rawPressureData = parseMaybeJsonPayload(jsonObject.rawPressureData, null)
  if (Array.isArray(rawPressureData) && rawPressureData.length >= 256) {
    return rawPressureData
  }
  return jsonObject.realArr ?? getSensorFrameChannelValue(jsonObject, channel)
}

const parseMaybeJsonPayload = (payload, fallback = null) => {
  if (payload == null) {
    return fallback
  }
  if (typeof payload !== 'string') {
    return payload
  }
  try {
    return JSON.parse(payload)
  } catch {
    return fallback
  }
}

/**
 * 兼容浏览器字符串消息和桌面运行时已经解析好的对象消息。
 */
const parseWebSocketEventPayload = (event) => {
  const payload = decodeWebSocketPayload(event?.data)
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : null
}

const getHumanBodyPartArray = (part) => {
  const parsedPart = parseMaybeJsonPayload(part, null)
  if (Array.isArray(parsedPart)) {
    return parsedPart
  }

  const arrPayload = parsedPart?.arr ?? parsedPart?.data ?? parsedPart?.value
  const parsedArr = parseMaybeJsonPayload(arrPayload, arrPayload)
  if (Array.isArray(parsedArr)) {
    return parsedArr
  }

  if (typeof parsedArr === 'string') {
    const splitArr = parsedArr
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value))
    return splitArr.length ? splitArr : null
  }

  return Array.isArray(parsedArr) ? parsedArr : null
}

const getHumanBodyFrameData = (payload) => {
  const source = getHumanBodyPartArray(payload)
  if (!source) {
    return new Array(1024).fill(0)
  }
  return source.length >= 1024 ? source.slice(0, 1024) : robot0401(source)
}

const isCar = (str) => {
  const arr = ['yanfeng10', 'car', 'car10', 'volvo', 'footVideo', 'hand0507', ...tactileGloveTypes, 'carQX', WHOLE_CHAIR_MATRIX, 'eye' , 'sofa']
  return arr.includes(str)
}

let newArr = new Array(5).fill(0)
let rightHandNewArr = new Array(5).fill(0)
let controlFlag = true;
const controlArr = [
  { labelKey: 'home.seatControls.seatForward', info: "座椅向前" },
  { labelKey: 'home.seatControls.backrestBackward', info: "靠背向后" },
  { labelKey: 'home.seatControls.backrestForward', info: "靠背向前" },
  { labelKey: 'home.seatControls.backrestInflate', info: "靠背气囊充气" },
  { labelKey: 'home.seatControls.backrestDeflate', info: "靠背气囊放气" },
  { labelKey: 'home.seatControls.cushionDown', info: "坐垫向下移动腿部气囊放气" },
  { labelKey: 'home.seatControls.legDeflate', info: "坐垫向下移动腿部气囊放气" },
  { labelKey: 'home.seatControls.cushionUp', info: "坐垫向上移动腿部气囊充气" },
  { labelKey: 'home.seatControls.legInflate', info: "坐垫向上移动腿部气囊充气" },
  { labelKey: 'home.seatControls.rightBolsterInflate', info: "侧翼右侧气囊充气" },
  { labelKey: 'home.seatControls.leftBolsterInflate', info: "侧翼左侧气囊充气" },
  { labelKey: 'home.seatControls.rightBolsterDeflate', info: "侧翼右侧气囊放气" },
  { labelKey: 'home.seatControls.leftBolsterDeflate', info: "侧翼左侧气囊放气" },
];

let collection = JSON.parse(localStorage.getItem("collection"))
  ? JSON.parse(localStorage.getItem("collection"))
  : [["hunch", "front", "flank", "标签", "座椅", "靠背"]];

let ws,
  ws1,
  ws2,
  wsControl,
  wsReconnectTimer = null, // 息屏后自动重连定时器
  xvalue = localStorage.getItem('bedx') ? Number(localStorage.getItem('bedx')) : 0,
  zvalue = localStorage.getItem('bedz') ? Number(localStorage.getItem('bedz')) : 0,
  sitIndexArr = new Array(4).fill(0),
  backIndexArr = new Array(4).fill(0),
  sitPress = 0,
  backPress = 0,
  ctx,
  ctxCircle;
let backTotal = 0,
  backMean = 0,
  backMax = 0,
  backMin = 0,
  backPoint = 0,
  backArea = 0,
  headTotal = 0,
  headMean = 0,
  headMax = 0,
  headMin = 0,
  headPoint = 0,
  headArea = 0,
  sitTotal = 0,
  sitMean = 0,
  sitMax = 0,
  sitMin = 0,
  sitPoint = 0,
  sitArea = 0,
  clearFlag = false,
  lastArr = [];

class Com extends React.Component {
  constructor(props) {
    super(props);
  }
  shouldComponentUpdate(nextProps, nextState) {
    return false;
  }
  render() {
    return <>{this.props.children}</>;
  }
}

class CanvasCom extends React.Component {
  constructor(props) {
    super(props);
  }
  // colormapKey 和 variantKey 的区别在于要不要重建场景：
  // variantKey 进了 childBaseKey，一变就换 key、整场重挂（数字精灵图这类
  // 烘焙资源只能这么换）；colormapKey 只放行一次 re-render，子组件原地收到新
  // 的 colormap prop，逐帧上色的场景（hand）当场换色，相机视角不丢。
  // 两者都必须是稳定字符串 —— resolveDisplayProfile 每次返回的都是新对象，
  // 直接比对象会让这个 shouldComponentUpdate 形同虚设。
  // chartKey 同理，它放行的是包着 Aside 的那一层：侧栏曲线换了外观要重画，
  // 但 Aside 绝不能重挂（它持有全部实时读数），所以只放行 re-render。
  // viewKey 走的是和 colormapKey 一样的路子：旋转角、正视图、框选开关这些
  // 「视图状态」本来是靠 this.com.current.changeGroupRotate(...) 命令式推的，
  // 但它们是拖滑块才变的低频状态，不是每帧数据，该走 props。
  // 同样必须是稳定字符串（如 `${rotX}:${rotZ}:${view}:${selectFlag}`）——
  // 传对象等于没写这一行。
  shouldComponentUpdate(nextProps, nextState) {
    if (this.props.colormapKey != nextProps.colormapKey) return true;
    if (this.props.chartKey != nextProps.chartKey) return true;
    if (this.props.viewKey != nextProps.viewKey) return true;
    // 调节抽屉挂载时只更新插槽，不改变画布 key 或重建场景。
    if (this.props.controlsHost !== nextProps.controlsHost) return true;
    if (this.props.local !== null && this.props.local !== undefined) {
      return this.props.matrixName != nextProps.matrixName
        || this.props.local != nextProps.local
        || this.props.variantKey != nextProps.variantKey
    }
    return this.props.matrixName != nextProps.matrixName || this.props.variantKey != nextProps.variantKey;
  }
  render() {
    const localKey =
      this.props.local === null || this.props.local === undefined
        ? "default"
        : this.props.local
          ? "playback"
          : "realtime";
    const childBaseKey = `${this.props.matrixName}:${localKey}:${this.props.variantKey || 'default'}`;

    return (
      <>
        {React.Children.map(this.props.children, (child, index) => {
          if (!React.isValidElement(child)) {
            return child;
          }
          return React.cloneElement(child, {
            key: `${childBaseKey}:${index}`,
          });
        })}
      </>
    );
  }
}

let totalArr = [],
  totalPointArr = [],
  wsMatrixName = "foot";
let startPressure = 0,
  time = 0;
let wsPointDataSit = [],
  wsPointDataSitWidth = 32, // 坐垂矩阵列宽，默认 32，hand0205 为 16
  wsPointDataBack = [],
  wsPointDataHead = [],
  wsPointDataBackZero = [],
  wsPointDataSitZero = [],
  wsPointDataHeadZero = [],
  meanSmooth = 0,
  maxSmooth = 0,
  pointSmooth = 0,
  areaSmooth = 0,
  pressSmooth = 0,
  pressureSmooth = 0,
  sitDataFlag = false,
  arrSmooth = [16, 16],
  latestFingerPointsL = new Array(5).fill(0),
  latestFingerPointsR = new Array(5).fill(0),
  totalSmooth = 0,
  leftValueSmooth = 0,
  leftPropSmooth = 0,
  rightValueSmooth = 0,
  rightPropSmooth = 0,
  leftTopPropSmooth = 0,
  rightTopPropSmooth = 0,
  leftBottomPropSmooth = 0,
  rightBottomPropSmooth = 0,
  canvasWidth = 300;


let ctxbig,
  ctxsit,
  ctxback,
  ctxbig1,
  oneFlag = false;
let timer;
const thrott = (fun) => {
  if (!timer) {
    timer = setTimeout(() => {
      fun();
      timer = null;
    }, 1000);
  }
};

let timer1;
const thrott1 = (fun) => {
  if (!timer1) {
    timer1 = setTimeout(() => {
      fun();
      timer1 = null;
    }, 100);
  }
};

// const sensorArr = [
//   { label: '沃尔沃', value: 'volvo' },
//   // { label: '延峰10', value: 'yanfeng10' },
//   // { label: '脚型检测', value: 'foot' },
//   // { label: '手部检测', value: 'hand' },
//   // { label: '手部检测(蓝', value: 'handBlue' },
//   // { label: '汽车座椅', value: 'car' },
//   // { label: '床垫监测', value: 'bigBed' },
//   // { label: '汽车靠背(量产)', value: 'car10' },
//   // { label: '本地自适应', value: 'localCar' },
//   // { label: '席悦座椅', value: 'sit10' },
//   // { label: '席悦1.0', value: 'smallBed' },
//   // { label: '小床128', value: 'smallBed1' },
//   // { label: '小矩阵1', value: 'smallM' },
//   // { label: '矩阵2', value: 'rect' },
//   // { label: 'T-short', value: 'short' },
//   // { label: '唐群座椅', value: 'CarTq' },
//   // { label: '座椅采集', value: 'sitCol' },
//   // { label: '小床褥采集', value: 'matCol' },
//   // { label: '正常测试', value: 'normal' },
//   // { label: '席悦2.0', value: 'xiyueReal1' },
//   // { label: '小床监测', value: 'jqbed' },
// ]
const petCareMatrixArr = ['petCare', 'petCareMini']
const isPetCareMatrix = (type) => petCareMatrixArr.includes(type)
const tempFullBedMatrix = 'tempFullBed'
const bedArr = ['jqbed', tempFullBedMatrix, ...petCareMatrixArr, 'xiyueReal1', 'smallBed', SMALL_BED_NO_ALG_MATRIX, 'smallBed1']
const displayRendererConfigMatrixArr = ['smallBed', SMALL_BED_NO_ALG_MATRIX, 'smallBed12B', 'matCol', WHOLE_CHAIR_MATRIX, MINZHEN_MATRIX, 'jqbed', ...petCareMatrixArr]
const HUMAN_BODY_DEFAULT_COLOR = 1555
const HUMAN_BODY_DEFAULT_SIZE = 31
const HUMAN_BODY_OPTIMIZED_MATRIX = 'humanBodyOptimized'
const isHumanBodyMatrix = (matrixName) => ['humanBody', HUMAN_BODY_OPTIMIZED_MATRIX, PRESSURE_VEST_MATRIX].includes(matrixName)
const HUMAN_BODY_OLD_DEFAULT_COLOR_VALUES = [1205, 5000]
const HUMAN_BODY_OLD_DEFAULT_SIZE_VALUES = [20, 60]
const MINZHEN_NORMAL_DEFAULT_COLOR = 415
const MINZHEN_RAW_DEFAULT_COLOR = 25
const MINZHEN_OLD_DEFAULT_COLOR_VALUES = [1205]

const initConfig = {
  bed: {
    valueg1: 2,
    valuej1: 1205,
    valuel1: 5,
    valuef1: 6,
    value1: 0.72,  //高度
  },
  smallBed12B: { ...SMALL_BED_12B_DEFAULT_RENDERER_CONFIG },
  wholeChair: {
    valueg1: 2,
    valuej1: 25,
    valuel1: 4,
    valuef1: 6,
    value1: 15,
    valuelInit1: 500,
  },
  minzhen: {
    valueg1: 2,
    valuej1: MINZHEN_NORMAL_DEFAULT_COLOR,
    valuel1: 5,
    valuef1: 6,
    value1: 0.72,
    valuelInit1: 500,
  },
  petCare: {
    valueg1: 2,
    valuej1: 1205,
    valuel1: 5,
    valuef1: 6,
    value1: 0.72,  //楂樺害
    valuelInit1: 500,
  },
  petCareMini: {
    valueg1: 2,
    valuej1: 2900,
    valuel1: 5,
    valuef1: 6,
    value1: 0.7,
    valuelInit1: 500,
  },
  sit: {
    valueg1: 4.3,
    valuej1: 1705,
    valuel1: 11,
    valuef1: 14,
    value1: 3.54,  //高度
  },
  // chairQX（matrixName === 'carQX'）。数值照抄 carQXFbx.jsx 里同名变量的初值，
  // 不给它单独一条就会落到 initConfig['bed']：颜色量程 1205、高度 0.72，
  // 对这套 16×16 座椅点图偏得太多（实测柔化后的值只到 ~560）。
  carQX: {
    valueg1: 4,
    valuej1: 255,
    valuel1: 1,
    valuef1: 2,
    value1: 2.1,  //高度
    valuelInit1: 500,
  }
}

initConfig.humanBody = {
  valueg1: 2,
  valuej1: HUMAN_BODY_DEFAULT_COLOR,
  valuel1: 5,
  valuef1: 6,
  value1: 0.72,
  sizeValue: HUMAN_BODY_DEFAULT_SIZE,
}

initConfig[HUMAN_BODY_OPTIMIZED_MATRIX] = {
  ...initConfig.humanBody,
}
initConfig[PRESSURE_VEST_MATRIX] = { ...initConfig.humanBody }

initConfig.petCare = {
  valueg1: 2,
  valuej1: 2900,
  valuel1: 5,
  valuef1: 6,
  value1: 0.7,
  valuelInit1: 500,
}

initConfig.petCareMini = {
  valueg1: 2,
  valuej1: 2900,
  valuel1: 5,
  valuef1: 6,
  value1: 0.7,
  valuelInit1: 500,
}

const matrixNameToType = (type) => {
  if (isPetCareMatrix(type)) {
    return type
  } else if (type === 'smallBed12B') {
    return type
  } else if (bedArr.includes(type)) {
    return 'bed'
  } else {
    return type
  }
}

const normalizeHumanBodySizeValue = (sizeValue) => {
  const nextValue = Number(sizeValue)
  if (!Number.isFinite(nextValue)) {
    return HUMAN_BODY_DEFAULT_SIZE
  }
  return Math.min(200, Math.max(1, nextValue))
}

initConfig.minzhen__normal = {
  ...initConfig.minzhen,
  valuej1: MINZHEN_NORMAL_DEFAULT_COLOR,
}

initConfig.minzhen__numoriginal = {
  ...initConfig.minzhen,
  valuej1: MINZHEN_RAW_DEFAULT_COLOR,
}

/**
 * Get cached config from localStorage.
 * Supports two-dimensional cache: sensorType + mode.
 * First tries sensorType__mode key, then falls back to sensorType key.
 */
const getLocalStorageConfig = ({ sensorType, mode }) => {
  let config = JSON.parse(localStorage.getItem('valueConfig'))
  if (!config || !Object.keys(config).length) {
    return undefined
  }

  let result = {}
  // First merge base sensorType config (backward compatible)
  if (config[sensorType] && Object.keys(config[sensorType]).length) {
    result = { ...config[sensorType] }
  }
  // Then merge mode-specific config (higher priority)
  if (mode) {
    const modeKey = `${sensorType}__${mode}`
    if (config[modeKey] && Object.keys(config[modeKey]).length) {
      result = { ...result, ...config[modeKey] }
    }
  }

  return Object.keys(result).length ? result : undefined
}

const hasModeColorConfig = ({ sensorType, mode }) => {
  if (!mode) {
    return false
  }
  const config = JSON.parse(localStorage.getItem('valueConfig'))
  const modeConfig = config?.[`${sensorType}__${mode}`]
  return modeConfig && Object.prototype.hasOwnProperty.call(modeConfig, 'valuej1')
}

/**
 * Get merged config: defaults + localStorage cache.
 * @param {string} sensorType - sensor type name
 * @param {string} mode - display mode (numMatrixFlag), optional
 */
const getConfig = ({ sensorType, mode }) => {
  if (!sensorType) {
    return initConfig['bed']
  }
  const realType = matrixNameToType(sensorType)
  const modeDefaultKey = mode ? `${realType}__${mode}` : ''
  const init = modeDefaultKey && initConfig[modeDefaultKey]
    ? initConfig[modeDefaultKey]
    : initConfig[realType]
      ? initConfig[realType]
      : initConfig['bed']
  const local = getLocalStorageConfig({ sensorType: realType, mode })
  const modeConfig = JSON.parse(localStorage.getItem('valueConfig'))?.[modeDefaultKey];
  const mergedConfig = { ...init, ...local, ...gloveExhibitionConfig(mode, modeConfig) }
  if (isHumanBodyMatrix(realType)) {
    if (HUMAN_BODY_OLD_DEFAULT_COLOR_VALUES.includes(Number(mergedConfig.valuej1))) {
      mergedConfig.valuej1 = HUMAN_BODY_DEFAULT_COLOR
    }
    if (HUMAN_BODY_OLD_DEFAULT_SIZE_VALUES.includes(Number(mergedConfig.sizeValue))) {
      mergedConfig.sizeValue = HUMAN_BODY_DEFAULT_SIZE
    }
    mergedConfig.sizeValue = normalizeHumanBodySizeValue(mergedConfig.sizeValue)
  }
  if (realType === MINZHEN_MATRIX) {
    const modeDefaultColor = mode === 'numoriginal' ? MINZHEN_RAW_DEFAULT_COLOR : MINZHEN_NORMAL_DEFAULT_COLOR
    const hasExplicitModeColor = hasModeColorConfig({ sensorType: realType, mode })
    const currentColor = Number(mergedConfig.valuej1)
    if (
      MINZHEN_OLD_DEFAULT_COLOR_VALUES.includes(currentColor) ||
      (mode === 'numoriginal' && !hasExplicitModeColor && currentColor === MINZHEN_NORMAL_DEFAULT_COLOR)
    ) {
      mergedConfig.valuej1 = modeDefaultColor
    }
  }
  if (realType === SMALL_BED_12B_MATRIX) {
    return normalizeSmallBed12BRendererConfig(mergedConfig)
  }
  return mergedConfig
}

/**
 * 取展示系统的偏好存储 id。manifest 系统与 ManifestDisplayRenderer 用同一份
 * 规则，读写的是同一个 localStorage 键。
 *
 * 老展示系统没有 `displaySystemId`，回落到 `definition.type`；`normal` 这类
 * 连注册表条目都没有的，再回落到矩阵名。总之每个展示系统一个键，配色不互相串味。
 *
 * @param {object} definition 展示系统运行时定义，可为空。
 * @param {string} matrixName 当前矩阵名，兜底用。
 * @returns {string} 偏好 id。
 */
const getDisplayProfileId = (definition, matrixName) => (
  definition?.displaySystemId || definition?.type || matrixName || 'unknown'
);

/**
 * 读某个矩阵对应展示系统的画布偏好。没存过就是空对象，一切按默认值渲染。
 *
 * 运行页继续应用已保存的配色和图表偏好，不依赖画布零件入口。
 *
 * @param {string} matrixName 当前矩阵名。
 * @returns {object} 画布偏好，无则空对象。
 */
const readDisplayCanvasSelection = (matrixName) => (
  readDisplaySelection(getDisplayProfileId(getDisplayDefinition(matrixName), matrixName))
);

/**
 * 读图表卡片清单；第一次进这个展示系统时用 manifest 声明的默认卡片播种。
 *
 * 靠 `hasFormulaCharts` 而不是"清单是不是空的"来判断有没有播过 —— 用户主动
 * 把卡片全删了也是一种状态，不该每次进来又给他种回去。
 *
 * manifest 没声明默认卡片时**什么都不写**：写一个空数组会把键建出来，
 * 以后 manifest 真的声明了默认卡片也再也播不进去了。
 *
 * @param {string} matrixName 当前矩阵名。
 * @returns {object[]} 图表卡片清单。
 */
const seedFormulaChartsFromManifest = (matrixName) => {
  if (hasFormulaCharts(matrixName)) return loadFormulaCharts(matrixName);
  const baseline = getDisplayDefinition(matrixName)?.page?.chartCards;
  if (!baseline?.length) return [];
  return resetFormulaCharts(matrixName, baseline);
};

const getDefaultModeForMatrix = (matrixName, currentMode = "normal") => {
  const runtimeDefinition = getDisplayDefinition(matrixName)
  if (runtimeDefinition?.source === 'manifest') {
    return runtimeDefinition.sceneMode || 'numoriginal'
  }
  if (isGloveExhibitionMode(currentMode) && !tactileGloveTypes.includes(matrixName)) currentMode = 'normal';
  if (matrixName === SMALL_BED_12B_MATRIX) {
    return "numoriginal";
  }
  if (matrixName === "matCol") {
    return currentMode === "numoriginal" ? "numoriginal" : "normal";
  }
  if (matrixName === WHOLE_CHAIR_MATRIX) {
    return "normal";
  }
  if (matrixName === tempFullBedMatrix) {
    return currentMode === "numoriginal" ? "numoriginal" : "normal";
  }
  if (matrixName === MINZHEN_MATRIX) {
    return currentMode === "numoriginal" ? "numoriginal" : "normal";
  }
  if (isHumanBodyMatrix(matrixName)) {
    return currentMode === "numoriginal" ? "numoriginal" : "skin";
  }
  if (matrixName === SINGLE_GLOVE_MATRIX || matrixName === HAND_0205_DOUBLE_MATRIX) {
    return ['normal', 'num', 'num3D', 'numoriginal', 'skin', ...GLOVE_EXHIBITION_MODES].includes(currentMode) ? currentMode : 'normal';
  }
  if (matrixName === FULL_PACKET_GLOVE_MATRIX) {
    return FULL_PACKET_GLOVE_MODES.includes(currentMode) ? currentMode : "num";
  }
  return currentMode;
}

const createDefaultFingerPoints = (fallbackValue = 0) => new Array(5).fill(fallbackValue)

const normalizeFingerPoints = (points, fallbackValue = 0) => {
  const fallback = createDefaultFingerPoints(fallbackValue)
  if (!Array.isArray(points) || points.length !== 5) {
    return fallback
  }

  return points.map((value, index) => {
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? Math.round(numberValue) : fallback[index]
  })
}

const createDefaultFingerCalibration = () => [
  createDefaultFingerPoints(0),
  createDefaultFingerPoints(255),
]

const cloneFingerCalibration = (calibration) => {
  if (!Array.isArray(calibration) || calibration.length !== 2) {
    return createDefaultFingerCalibration()
  }

  return [
    normalizeFingerPoints(calibration[0], 0),
    normalizeFingerPoints(calibration[1], 255),
  ]
}

const readFingerCalibration = (key) => {
  const raw = localStorage.getItem(key)
  if (!raw) {
    return createDefaultFingerCalibration()
  }

  try {
    const parsed = JSON.parse(raw)
    const isValid =
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      Array.isArray(parsed[0]) &&
      parsed[0].length === 5 &&
      Array.isArray(parsed[1]) &&
      parsed[1].length === 5

    if (!isValid) {
      throw new Error('invalid finger calibration shape')
    }

    return cloneFingerCalibration(parsed)
  } catch {
    localStorage.removeItem(key)
    return createDefaultFingerCalibration()
  }
}

const updateLatestFingerPoints = (points, isRightHand = false) => {
  const normalizedPoints = normalizeFingerPoints(points, 0)
  if (isRightHand) {
    latestFingerPointsR = normalizedPoints
  } else {
    latestFingerPointsL = normalizedPoints
  }
  return normalizedPoints
}

const getLatestFingerPoints = (hand = 'left') => (
  hand === 'right' ? [...latestFingerPointsR] : [...latestFingerPointsL]
)

const isRightHandPayload = (jsonObject, fallback = false) => {
  const side = jsonObject?.handSide ?? jsonObject?.outputSide
  return typeof side === 'string' ? side.toLowerCase() === 'right' : fallback
}

var backFlag, hz = 12, sitFlag, realHzFrameCount = 0, realHzLastTime = Date.now(),
  fingerArrL = readFingerCalibration('fingerArrL'),
  fingerArrR = readFingerCalibration('fingerArrR'),
  fingerArr = fingerArrL; // 默认指向左手，兼容旧逻辑

// 单手时代可能只校准过一只手：缺失一侧沿用另一侧的校准基准，
// 避免未校准的那只手弯曲值被默认基准(0~255)钳死、手指不随压力弯曲
if (!localStorage.getItem('fingerArrR') && localStorage.getItem('fingerArrL')) {
  fingerArrR = readFingerCalibration('fingerArrL')
} else if (!localStorage.getItem('fingerArrL') && localStorage.getItem('fingerArrR')) {
  fingerArrL = readFingerCalibration('fingerArrR')
  fingerArr = fingerArrL
}

let onBedState = []
class Home extends React.Component {
  constructor(props) {
    super(props);
    this.sceneVisibility = { current: true };
    let storedAllowedTypes = null;
    try {
      const parsedAllowedTypes = JSON.parse(localStorage.getItem('allowedTypes') || 'null');
      storedAllowedTypes = Array.isArray(parsedAllowedTypes)
        ? filterVisibleDisplayMatrixTypes(parsedAllowedTypes)
        : null;
    } catch (err) {
      storedAllowedTypes = null;
    }

    // 上次收到的传感器类型清单（{time,flat,map}）：首屏先用它兜底，避免空列表；WS 连上后会刷新
    let storedSensorTypeList = null;
    try {
      const parsed = JSON.parse(localStorage.getItem('sensorTypeList') || 'null');
      if (parsed && Array.isArray(parsed.flat)) storedSensorTypeList = parsed;
    } catch (err) {
      storedSensorTypeList = null;
    }

    // 使用上次由配置器或传感器选择器激活的类型，避免重新进入主界面后回退到固定传感器。
    const initialMatrixName = normalizeDisplayMatrixName(localStorage.getItem('file') || 'hand0205');
    const initialMode = getDefaultModeForMatrix(initialMatrixName);
    const initialMatrixConfig = getConfig({ sensorType: initialMatrixName, mode: initialMode });
    // 播种必须在读 chartWidgetIds 之前 —— 后者从存储里算高亮，
    // 顺序反了首帧的零件方块就不会亮。
    const initialChartCards = seedFormulaChartsFromManifest(initialMatrixName);

    this.state = {
      humanBodySettingsHost: null,
      hand: true,
      matrixName: initialMatrixName,
      systemId: localStorage.getItem('file') || initialMatrixName,
      valueg1: initialMatrixConfig.valueg1,
      valuej1: initialMatrixConfig.valuej1,
      valuel1: initialMatrixConfig.valuel1,
      valuef1: initialMatrixConfig.valuef1,
      value1: initialMatrixConfig.value1,
      sizeValue: initialMatrixConfig.sizeValue ?? HUMAN_BODY_DEFAULT_SIZE,
      valuelInit1: initialMatrixConfig.valuelInit1 ?? initValue.valuelInit1,
      valueMult: initValue.valueMult,
      compen: initValue.compen,
      port: [{ value: " ", label: "" }],
      portname: "",
      portnameBack: "",
      portnameHead: '',
      portnameSensor: '',
      matrixTitle: localStorage.getItem('matrixTitle') === 'false' ? false : true,
      allowedTypes: storedAllowedTypes,
      sensorTypeList: storedSensorTypeList,
      local: false,
      dataArr: [],
      index: 0,
      playflag: false,
      selectFlag: false,
      colFlag: true,
      colNum: 0,
      history: "now",
      jqbedAlgorithmConfig: null,
      halowStatus: null,
      jqbedAlgorithmConfigResult: null,
      jqbedAlgorithmStatus: { state: 'waiting', error: null },
      jqbedReturnedSettings: null,
      jqbedAlgorithmLogFrame: null,
      jqbedAlgorithmLogSubscription: null,
      wsConnected: false,
      wsConnectionEpoch: 0,
      numMatrixFlag: initialMode,
      centerFlag: false,
      carState: "all",
      leftFlag: false,
      rightFlag: false,
      lineFlag: false,
      pressNum: false,
      press: false,
      dataTime: "",
      pointFlag: false,
      pressChart: false,
      newArr: [],
      newArr1: [],
      ymax: 200,
      control: [],
      hunch: "",
      front: "",
      flank: "",
      pressValue: '',
      colWebFlag: false,
      colOneFlag: false,
      csvData: JSON.parse(localStorage.getItem("collection"))
        ? JSON.parse(localStorage.getItem("collection"))
        : [["hunch", "front", "flank", "标签", "座椅", "靠背"]],
      length: JSON.parse(localStorage.getItem("collection"))
        ? JSON.parse(localStorage.getItem("collection")).length
        : 1,
      dataName: "",
      width: "",
      height: "",
      pressToArea: 0,
      newValue: 0,
      welFlag: false,
      leg: 0,
      butt: 0,
      locale: 'en',
      calibration: false,
      showType: 'hand',
      licenseModalVisible: false,
      licenseAccess: props?.licenseAccess,
      collectionSummary: null,
      licenseModalType: '',
      licenseModalExpireDate: '',
      licenseModalRemainDays: 0,
      licenseLockedVisible: false,
      licenseLockReason: '',
      minzhenSensorInfo: {},
      hz: 12,
      realHz: 0,
      smallBedMatrixWidth: 32,
      smallBedMatrixHeight: 32,
      displaySystemBuilderOpen: false,
      portalAlgorithmMarketOpen: false,
      // manifest 展示系统的画布偏好（配色 / 叠加层）。构造时就读出来，
      // 免得首帧按 classic 渲染完再因为偏好不同重建一次场景。
      displaySelection: readDisplayCanvasSelection(initialMatrixName),
      // 已经在侧栏里的图表卡片对应的模板 id，只用来给零件方块加高亮。
      // 卡片本身由 Aside 从 store 里读，这里不重复持有定义。
      chartWidgetIds: listFormulaChartTemplateIds(
        initialMatrixName,
        FORMULA_CHART_TEMPLATES,
        initialChartCards,
      ),
      // 完整的图表卡片清单，只给草稿层的脏判定用。上面那份 id 清单不够 ——
      // 用弹窗建的卡片没有 templateId，不在 FORMULA_CHART_TEMPLATES 里，
      // 但它同样是"用户还没保存的改动"。
      chartCards: initialChartCards,
      timeArr: [],
      historyTimeArr: [],
      ...getSmallBed12BInitialDisplayState(),
    };
    this.com = React.createRef();
    this.manifestDisplay = React.createRef();
    this.data = React.createRef();
    this.title = React.createRef();
    this.portalChartDropTarget = React.createRef();
    this.line = React.createRef();
    this.track = React.createRef();
    this.progress = React.createRef();
    this.handL = React.createRef();
    this.handR = React.createRef();
    this.footL = React.createRef();
    this.footR = React.createRef();
    this.sitIndexArr = new Array(4).fill(0);
    this.backIndexArr = new Array(4).fill(0);
    this.headIndexArr = new Array(4).fill(0);

    // 场景组件的图表回调，原先在 render 里写作
    // `handleChartsBody={this.handleChartsBody.bind(this)}`，重复了 60 次。
    // 每次 render 都 bind 一次会生成新函数引用 —— 对 CanvasCom 那道
    // shouldComponentUpdate 来说无所谓（它本来就只认几个稳定字符串键），
    // 但对任何走 memo/浅比较的子树来说等于每帧都在说"我变了"。
    // 在构造函数里绑一次，render 里只做展开。
    this.handleChartsBody = this.handleChartsBody.bind(this);
    this.handleChartsBody1 = this.handleChartsBody1.bind(this);
    // Title 那一束同理，原先在 render 里各 bind 一次。
    this.changeWs = this.changeWs.bind(this);
    this.colPushData = this.colPushData.bind(this);
    this.delPushData = this.delPushData.bind(this);
    this.changeCalibration = this.changeCalibration.bind(this);
    this.colFingerData = this.colFingerData.bind(this);

    // 两条现成的组合。分两条而不是一条，是因为仓库里本来就有 10 处
    // 刻意不传 changeStateData —— 合成一条会给那 10 个组件多喂一个 prop，
    // 收敛重复不该顺手改变谁收到什么。
    this.sceneChartProps = {
      handleChartsBody: this.handleChartsBody,
      handleChartsBody1: this.handleChartsBody1,
      changeStateData: this.changeStateData,
      changeSelect: this.changeSelect,
    };
    this.sceneChartPropsBasic = {
      handleChartsBody: this.handleChartsBody,
      handleChartsBody1: this.handleChartsBody1,
      changeSelect: this.changeSelect,
    };
  }

  syncDisplayRendererConfig = () => {
    if (!displayRendererConfigMatrixArr.includes(this.state.matrixName)
      && !(tactileGloveTypes.includes(this.state.matrixName) && this.state.numMatrixFlag === 'gloveTerrain')) {
      return;
    }

    const rendererConfig = {
      valueg: this.state.valueg1,
      valuej: this.state.valuej1,
      valuel: this.state.valuel1,
      valuef: this.state.valuef1,
      value: this.state.value1,
      valuelInit: this.state.valuelInit1,
    };

    if (this.com.current?.sitValue) {
      this.com.current.sitValue(rendererConfig);
    }
    if (this.com.current?.backValue) {
      this.com.current.backValue(rendererConfig);
    }
  }

  parseGloveRawMatrix = (rawData) => {
    if (rawData == null) {
      return null;
    }

    let parsedData = rawData;
    if (!Array.isArray(parsedData)) {
      try {
        parsedData = JSON.parse(parsedData);
      } catch (error) {
        return null;
      }
    }

    if (!Array.isArray(parsedData) || parsedData.length < 256) {
      return null;
    }

    return parsedData.slice(0, 256).map((value) => {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : 0;
    });
  }

  syncGloveRawPressureStats = (rawData) => {
    if (!tactileGloveTypes.includes(this.state.matrixName)) {
      return false;
    }

    const rawMatrix = this.parseGloveRawMatrix(rawData);
    if (!rawMatrix) {
      return false;
    }

    const positivePointCount = rawMatrix.filter((value) => value > 0).length;
    const totalPres = rawMatrix.reduce((sum, value) => sum + value, 0);
    const maxPres = findMax(rawMatrix);
    const meanPres = totalPres / (positivePointCount || 1);

    this.data.current?.changeData({
      meanPres: meanPres.toFixed(2),
      maxPres,
      point: positivePointCount,
      totalPres: totalPres.toFixed(0),
    });

    return true;
  }

  handleManifestSidebarData = ({
    values = [],
    rawData = values,
    metrics = {},
    algorithmMetrics = {},
    displaySystemId = '',
    channelId = '',
    outputChannel = '',
    sensorId = '',
    sensorLabel = '',
    sensorType = '',
    timestamp = null,
    matrix = {},
    serial = null,
    channels = [],
  }) => {
    this.data.current?.changeData({
      totalPres: metrics.totalPressure || 0,
      meanPres: metrics.averagePressure || 0,
      maxPres: metrics.maxPressure || 0,
      point: metrics.activePoints || 0,
      area: metrics.area || 0,
      algorithmMetrics,
      channelId,
      outputChannel,
      sensorId,
      sensorLabel,
      serial,
    });
    this.data.current?.updateFormulaCharts(values, metrics, algorithmMetrics, rawData, {
      displaySystemId,
      channelId,
      outputChannel,
      sensorId,
      sensorLabel,
      sensorType,
      timestamp,
      matrix,
      serial,
      channels,
    });
    if (!values.length) return;
    const chartMax = values.reduce((max, value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, 1);
    this.data.current?.handleCharts(values, chartMax);
    this.data.current?.handleChartsArea(values, chartMax);
  }

  /**
   * 将当前 Display System 的每一路帧送进同一个 Manifest 画布。
   * sidebar.source 只决定左侧统计取哪一路，不参与画布帧是否已处理的判断。
   */
  handleManifestSceneFrame = (message, definition) => {
    const routedFrames = readManifestChannelFrames(message, [
      definition?.displaySystemId,
      definition?.type,
    ], definition?.sensors);
    if (!routedFrames.length) return false;

    this.manifestDisplay.current?.pushFrames?.(routedFrames);
    return true;
  }

  appendControlCollectionRow = (row) => {
    if (!canUseLicenseCapability(this.state.licenseAccess, 'canAcquire')) return;
    collection.push(row);
    localStorage.setItem("collection", JSON.stringify(collection));
    this.setState({ csvData: collection, length: collection.length });
  }

  getControlCollectionState = (updates = {}) => ({
    ...this.state,
    ...updates,
  })

  handleControlMessage = (rawMessage, options = {}) => {
    const parsedMessage = parseControlMessage(rawMessage);
    const metricStateUpdate = getMetricStateUpdate(parsedMessage);

    if (metricStateUpdate) {
      const nextState = this.getControlCollectionState(metricStateUpdate);
      this.setState(metricStateUpdate);

      if (
        options.welcomeFlow &&
        parsedMessage.type === '2' &&
        oneFlag &&
        nextState.hunch &&
        nextState.front &&
        nextState.flank
      ) {
        this.appendControlCollectionRow([
          nextState.hunch,
          nextState.front,
          nextState.flank,
          CONTROL_COMMANDS.WELCOME_END,
        ]);
        oneFlag = false;
      }

      if (options.collectOnFrontMetric && parsedMessage.type === '2' && nextState.colWebFlag) {
        this.appendControlCollectionRow(
          buildBasicControlCollectionRow(nextState, wsPointDataSit, wsPointDataBack)
        );
      }

      if (options.collectEveryMessage && nextState.colWebFlag) {
        this.appendControlCollectionRow(
          buildExtendedControlCollectionRow(nextState, wsPointDataSit, wsPointDataBack)
        );
      }
      return;
    }

    if (options.welcomeFlow && parsedMessage.raw === CONTROL_COMMANDS.WELCOME_END) {
      oneFlag = true;
      this.setState({ welFlag: true });
    }

    const commandStateUpdate = {};
    if (!options.legacySideAirbag && parsedMessage.backTime !== undefined) {
      commandStateUpdate.backTime = parsedMessage.backTime;
    }

    const controlCommandName = options.legacySideAirbag ? parsedMessage.raw : parsedMessage.name;
    if (controlFlag) {
      const controlList = getControlList(controlCommandName, {
        expandInitialBackAirbag: options.expandInitialBackAirbag,
        legacySideAirbag: options.legacySideAirbag,
      });
      commandStateUpdate.control = controlList;

      if (
        (options.expandInitialBackAirbag || options.legacySideAirbag) &&
        controlList.length > 1
      ) {
        controlFlag = false;
      }
    } else {
      commandStateUpdate.control = getControlList(controlCommandName);
    }

    const nextState = this.getControlCollectionState(commandStateUpdate);
    this.setState(commandStateUpdate);

    if (options.collectEveryMessage && nextState.colWebFlag) {
      this.appendControlCollectionRow(
        buildExtendedControlCollectionRow(nextState, wsPointDataSit, wsPointDataBack)
      );
    }
  }

  connectControlSocket = (ip, options = {}) => {
    if (wsControl) {
      try {
        wsControl.onclose = null;
        wsControl.onerror = null;
        wsControl.close();
      } catch {}
    }

    wsControl = new WebSocket(`ws://${ip}:23001/ws/msg`);
    wsControl.onopen = () => {
      console.info("connect success");
    };
    wsControl.onmessage = (event) => {
      this.handleControlMessage(event.data, options);
    };
    wsControl.onerror = () => {};
    wsControl.onclose = () => {};
  }

/** 将单手末帧按系统身份、实时/回放及记录隔离。 */
  getSingleGloveFrameSourceKey = () => `${this.state.systemId || this.state.matrixName}:${this.state.local}:${this.state.dataTime || ''}`;

  /** 切换采集来源时丢弃双手末帧与趋势。 */
  resetSingleGloveFrameCache = () => {
    this.singleGloveFrameSourceKey = this.getSingleGloveFrameSourceKey();
    this.singleGloveFrames = {};
    this.singleGloveTrendKey = null;
    this.singleGlovePressureTrend = [];
    this.singleGloveAreaTrend = [];
    this.gloveExhibitionFrames = {};
  }

  /** 缓存并分派两路手套展示帧，场景切换只重放显示，不写回设备或采集。 */
  updateGloveExhibitionFrame = (message, channel, channelPressure) => {
    if (!tactileGloveTypes.includes(this.state.matrixName) || !this.isCurrentDisplayFrame(message)) return;
    if (this.gloveExhibitionSource !== this.getSingleGloveFrameSourceKey()) {
      this.gloveExhibitionSource = this.getSingleGloveFrameSourceKey();
      this.gloveExhibitionFrames = {};
    }
    const side = isRightHandPayload(message, channel === 'back') ? 'right' : 'left';
    const frame = buildGloveExhibitionFrame({ message, channel, channelPressure,
      rawPressure: getRawPressurePayload(message, channel), calibration: side === 'right' ? fingerArrR : fingerArrL });
    frame.statsPressure = this.parseGloveRawMatrix(getRawPressurePayload(message, channel));
    this.gloveExhibitionFrames[frame.side] = frame;
    if (!isGloveExhibitionMode(this.state.numMatrixFlag)) return;
    if (frame.fingerPoints) updateLatestFingerPoints(frame.fingerPoints, frame.side === 'right');
    if (this.state.matrixName !== SINGLE_GLOVE_MATRIX) this.syncGloveRawPressureStats(getRawPressurePayload(message, channel));
    this.com.current?.updateFrame?.(frame);
  }

  /** 缓存当前系统的真实双手末帧，切换显示手时复用。 */
  cacheSingleGloveFrame = (payload) => {
    if (this.state.matrixName !== SINGLE_GLOVE_MATRIX || this.singleGloveReplaying || !this.isCurrentDisplayFrame(payload)) return;
    if (this.singleGloveFrameSourceKey !== this.getSingleGloveFrameSourceKey()) this.resetSingleGloveFrameCache();
    for (const [side, channel] of [['left', 'sit'], ['right', 'back']]) {
      if (!getSensorFrameChannelValue(payload, channel)) continue;
      this.singleGloveFrames[side] = JSON.parse(JSON.stringify(payload));
    }
  }

  /** 仅向当前展示重放选中手末帧，不向设备或采集存储发数据。 */
  replaySelectedSingleGloveFrame = () => {
    if (this.state.matrixName !== SINGLE_GLOVE_MATRIX) return;
    if (this.singleGloveFrameSourceKey !== this.getSingleGloveFrameSourceKey()) this.resetSingleGloveFrameCache();
    const side = this.state.hand ? 'left' : 'right';
    const dataKey = this.state.hand ? 'sitData' : 'backData';
    const frame = this.singleGloveFrames[side] || {
      [dataKey]: new Array(256).fill(0),
      newArr147: new Array(147).fill(0),
      rotate: null,
      backFlag: !this.state.hand,
    };
    this.singleGloveReplaying = true;
    try {
      const event = { data: JSON.stringify(frame) };
      this.wsData(event);
      if (side === 'right') this.ws1Data(event);
    } finally {
      this.singleGloveReplaying = false;
    }
  }

  /** 单手侧栏由选中手原始 256 点驱动，隔离渲染器重复统计。 */
  getSingleGloveRendererDataRef = () => {
    if (!this.singleGloveRendererDataRef) {
      const pressureKeys = new Set(['meanPres', 'maxPres', 'point', 'totalPres', 'area', 'pressure']);
      this.singleGloveRendererDataRef = { current: {
        changeData: (values) => {
          const extraValues = Object.fromEntries(Object.entries(values).filter(([key]) => !pressureKeys.has(key)));
          if (Object.keys(extraValues).length) this.data.current?.changeData(extraValues);
        },
        handleCharts: () => {},
        handleChartsArea: () => {},
      } };
    }
    return this.singleGloveRendererDataRef;
  }

  /** 更新选中手的原始压力统计与有限长度趋势。 */
  syncSingleGloveRawPressureStats = (rawData) => {
    const rawMatrix = this.parseGloveRawMatrix(rawData);
    if (!rawMatrix) return;
    this.syncGloveRawPressureStats(rawMatrix);
    const trendKey = `${this.state.matrixName}:${this.state.hand ? 'left' : 'right'}`;
    if (this.singleGloveTrendKey !== trendKey) {
      this.singleGlovePressureTrend = [];
      this.singleGloveAreaTrend = [];
      this.singleGloveTrendKey = trendKey;
    }
    const pressure = rawMatrix.reduce((sum, value) => sum + value, 0);
    const point = rawMatrix.filter((value) => value > 0).length;
    const pressureTrend = this.singleGlovePressureTrend;
    const areaTrend = this.singleGloveAreaTrend;
    if (!this.singleGloveReplaying || pressureTrend.length === 0) {
      if (pressureTrend.length >= 60) pressureTrend.shift();
      if (areaTrend.length >= 60) areaTrend.shift();
      pressureTrend.push(pressure);
      areaTrend.push(point);
    }
    if (!this.state.local) {
      this.data.current?.handleCharts([...pressureTrend], findMax(pressureTrend) + 20);
      this.data.current?.handleChartsArea([...areaTrend], findMax(areaTrend) + 20);
    }
  }

  syncHumanBodyRawPressureStats = (rawData) => {
    if (!isHumanBodyMatrix(this.state.matrixName)) {
      return false;
    }

    const rawMatrix = getHumanBodyFrameData(rawData);
    if (!Array.isArray(rawMatrix) || rawMatrix.length < 1024) {
      return false;
    }

    const sensorIndices = this.state.matrixName === PRESSURE_VEST_MATRIX ? PRESSURE_VEST_SENSOR_INDICES : undefined;
    const { point, totalPres, maxPres, meanPres } = getHumanBodyPressureStatistics(rawMatrix, sensorIndices);
    if (this.humanBodyTrendMatrix !== this.state.matrixName) {
      this.humanBodyPressureTrend = [];
      this.humanBodyAreaTrend = [];
      this.humanBodyTrendMatrix = this.state.matrixName;
    }
    const pressureTrend = this.humanBodyPressureTrend || (this.humanBodyPressureTrend = []);
    const areaTrend = this.humanBodyAreaTrend || (this.humanBodyAreaTrend = []);

    if (pressureTrend.length >= 20) pressureTrend.shift();
    if (areaTrend.length >= 20) areaTrend.shift();
    pressureTrend.push(totalPres);
    areaTrend.push(point);

    this.data.current?.changeData({
      meanPres: meanPres.toFixed(2),
      maxPres,
      point,
      area: point,
      totalPres: totalPres.toFixed(0),
    });
    this.data.current?.handleCharts(pressureTrend, Math.max(1, findMax(pressureTrend)));
    this.data.current?.handleChartsArea(areaTrend, Math.max(1, findMax(areaTrend)));
    return true;
  }

  componentDidMount() {
    this.props.onPortalLeaveGuard?.(this.preparePortalExit);
    this.jqbedAlarmSpeechState?.reset();
    this.jqbedAlarmSpeechBlocked = false;
    this.jqbedAlarmSpeechStatus = null;
    this.jqbedAlarmSpeechSource = null;
    this.setState({ wsConnected: false, jqbedReturnedSettings: null, jqbedAlgorithmLogFrame: null, jqbedAlgorithmLogSubscription: null });
    // window.alert(window.innerWidth)
    if (this._portalFontSize === undefined) this._portalFontSize = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = `${window.innerWidth / 120}px`;
    this.syncDisplayRendererConfig();
    // componentDidMount 被 window.__wsReconnect 反复重入，订阅只能建一次。
    if (!this._unsubscribeFormulaCharts) {
      this._unsubscribeFormulaCharts = subscribeFormulaCharts(this.handleFormulaChartsChanged);
    }
    // 暴露全局重连函数，供主进程 executeJavaScript 直接调用
    // 确保重连时 onmessage、wsData 等 React 回调完整绑定
    window.__wsReconnect = () => {
      console.info('[WS] 全局重连函数被调用，开始重连 WebSocket...');
      if (ws) {
        try { ws.onclose = null; ws.onerror = null; ws.close(); } catch(e) {}
      }
      this.componentDidMount();
    };

    var c2 = document.getElementById("myChartBig");

    if (c2) ctxbig = c2.getContext("2d");

    var c1 = document.getElementById("myChartBig1");

    if (c1) ctxbig1 = c1.getContext("2d");
    const ip = "k2.bodyta.com";
    // if (this.state.matrixName === 'localCar') {
    //   ws = new WebSocket(`ws://${ip}:23001/ws/data`)
    //   ws1 = new WebSocket(`ws://${ip}:23001/ws/data1`)
    // }
    // // else if (this.state.matrixName === 'yanfeng10') {
    // //   ws = new WebSocket("ws://sensor.bodyta.com:8888/bed/ec4d3e7ec6e5");
    // // }
    ws = createJsonWebSocket(WS_URLS.MAIN);
    // 坐垫、靠背和头枕共用这一条连接，按消息字段或订阅通道区分。
    ws.onopen = () => {
      // connection opened
      console.info("connect success");
      this.jqbedAlarmSpeechState?.reset();
      this.jqbedAlarmSpeechBlocked = false;
      this.jqbedAlarmSpeechStatus = null;
      this.jqbedAlarmSpeechSource = null;
      this.setState((previousState) => ({
        wsConnected: true,
        wsConnectionEpoch: previousState.wsConnectionEpoch + 1,
        jqbedReturnedSettings: null,
        jqbedAlgorithmLogFrame: null,
        jqbedAlgorithmLogSubscription: null,
      }));
      // ⚠️ 重进监测页和 WS 重连只同步状态，关闭串口会意外中断正在运行的采集。
      // 主动请求传感器类型清单（请求-应答；主进程连接时也会主动 push 一次）
      this.wsSendObj({ getSensorTypes: true })
      this._collectionStatusController?.abort();
      const collectionController = new AbortController();
      this._collectionStatusController = collectionController;
      const collectionStatusEpoch = this._collectionStatusEpoch || 0;
      requestJson('/api/collection/status', { signal: collectionController.signal }).then(payload => {
        if (!collectionController.signal.aborted && collectionStatusEpoch === (this._collectionStatusEpoch || 0)) this.applyCollectionSummary(payload.collectionSummary || payload);
      }).catch(() => {});
    };
    ws.onmessage = (e) => {
      const message = parseWebSocketEventPayload(e);
      if (!message || !this.isCurrentDisplayFrame(message)) return;
      this.wsData(e, message);
      // 统一在主 WS 中处理靠背和头枕数据（原 ws1/ws2）
      if (isCar(this.state.matrixName) && getSensorFrameChannelValue(message, 'back')) {
        this.ws1Data(e, message);
      }
      if (
        getSensorFrameChannelValue(message, 'head')
        && (this.state.matrixName == "volvo" || this.state.matrixName == "carQX" || this.state.matrixName == WHOLE_CHAIR_MATRIX)
      ) {
        this.ws2Data(e, message);
      }
    };
    ws.onerror = (e) => {
      // an error occurred
      console.warn('[WS] 连接错误，将在 3s 后重连');
    };
    ws.onclose = (e) => {
      this.jqbedAlarmSpeechState?.reset();
      this.jqbedAlarmSpeechStatus = null;
      this.jqbedAlarmSpeechSource = null;
      this.setState({ wsConnected: false, jqbedReturnedSettings: null, jqbedAlgorithmLogFrame: null, jqbedAlgorithmLogSubscription: null });
      // 息屏或网络中断后自动重连
      console.warn('[WS] 连接断开，3s 后自动重连...');
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      wsReconnectTimer = setTimeout(() => {
        if (!ws || ws.readyState === WebSocket.CLOSED) {
          console.info('[WS] 尝试重新连接...');
          this.componentDidMount();
        }
      }, 3000);
    };

    if (this.state.matrixName === "localCar") {
      this.connectControlSocket(ip, {
        collectEveryMessage: true,
        expandInitialBackAirbag: true,
        welcomeFlow: true,
      });
    }

    // 监听主进程的息屏/唤醒事件，唤醒后重连 WebSocket
    if (window.electronAPI) {
      window.electronAPI.on('power-resume', () => {
        console.info('[Power] 系统唤醒，检查 WebSocket 连接状态...');
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          console.warn('[Power] WebSocket 已断开，尝试重连...');
          if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
          wsReconnectTimer = setTimeout(() => {
            this.componentDidMount();
          }, 1000);
        } else {
          console.info('[Power] WebSocket 状态正常 (readyState=1)，无需重连');
        }
      });
      window.electronAPI.on('power-suspend', () => {
        console.warn('[Power] 系统将息屏/锁屏，当前 WS readyState=', ws ? ws.readyState : 'no ws');
      });
    }


  }

  componentWillUnmount() {
    this.props.onPortalLeaveGuard?.(null);
    this._collectionStatusController?.abort();
    clearLastFrame();
    if (this.props.portalEmbedded) document.documentElement.style.fontSize = this._portalFontSize;
    if (this._unsubscribeFormulaCharts) {
      this._unsubscribeFormulaCharts();
      this._unsubscribeFormulaCharts = null;
    }
    this.jqbedAlarmSpeechState?.reset();
    this.jqbedAlarmSpeechStatus = null;
    this.jqbedAlarmSpeechSource = null;
    // 清理自动重连定时器
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = null;
    }
    if (ws) {
      ws.onclose = null; // 移除 onclose 防止卸载时触发重连
      ws.close();
    }
    if (wsControl) {
      wsControl.onclose = null;
      wsControl.onerror = null;
      wsControl.close();
      wsControl = null;
    }
    // 清理节流定时器，防止内存泄漏
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (timer1) {
      clearTimeout(timer1);
      timer1 = null;
    }
    // 采集计时的秒表：卸载时不停会一直往一个已卸载的 ref 上写。
    this.stopCollectionTimer();
  }

  colPushData() {
    this.appendControlCollectionRow(
      buildBasicControlCollectionRow(this.state, wsPointDataSit, wsPointDataBack)
    );
  }

  delPushData() {
    collection = [["hunch", "front", "flank", "标签", "座椅", "靠背"]];
    localStorage.removeItem("collection");
    this.setState({
      collection: [["hunch", "front", "flank", "标签", "座椅", "靠背"]],
      length: 1,
    });
  }

  changeWs(ip) {
    if (ws) {
      ws.close();
    }
    // [优化] ws1 已不再需要
    this.initCar();
    const that = this;

    // ws = new WebSocket(`ws://${ip}:1880/ws/data`)
    ws = createJsonWebSocket(`ws://${ip}:23001/ws/data`);
    ws.onopen = () => {
      // connection opened
      console.info("connect success");
    };
    ws.onmessage = (e) => {
      const message = parseWebSocketEventPayload(e);
      if (!message || !that.isCurrentDisplayFrame(message)) return;
      that.wsData(e, message);
      // 统一在主 WS 中处理靠背数据
      if (isCar(that.state.matrixName) && getSensorFrameChannelValue(message, 'back')) {
        that.ws1Data(e, message);
      }
    };
    ws.onerror = (e) => {
      // an error occurred
      console.warn('[WS] 连接错误，将在 3s 后重连');
    };
    ws.onclose = (e) => {
      // 息屏或网络中断后自动重连
      console.warn('[WS] 连接断开，3s 后自动重连...');
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      wsReconnectTimer = setTimeout(() => {
        if (!ws || ws.readyState === WebSocket.CLOSED) {
          console.info('[WS] 尝试重新连接...');
          this.componentDidMount();
        }
      }, 3000);
    };

    this.connectControlSocket(ip, {
      collectOnFrontMetric: true,
      legacySideAirbag: true,
    });
  }

  /** 返回当前展示接受的身份，数据帧与设备姿态事件共用同一隔离边界。 */
  getCurrentDisplayIdentities = () => {
    const definition = getDisplayDefinition(this.state.matrixName);
    if (definition?.source === 'builtin-template') return [definition.displaySystemId];
    return [
      this.state.matrixName,
      definition?.displaySystemId,
      definition?.type,
    ];
  };

  /** 按展示系统身份隔离wildcard帧，避免同名sit/back/head跨系统覆盖。 */
  isCurrentDisplayFrame = (message) => {
    return isSensorFrameForDisplay(message, this.getCurrentDisplayIdentities());
  };



  /** 仅用显式合法的矩阵尺寸更新画布，普通状态消息不能把 16×16 重置为 32×32。 */
  syncSmallBed12BMatrixSize(jsonObject = {}) {
    if (this.state.matrixName !== SMALL_BED_12B_MATRIX) {
      return;
    }

    const matrix = jsonObject.matrix || jsonObject.metadata?.matrix;
    const nextWidth = Number(jsonObject.matrixWidth ?? matrix?.cols);
    const nextHeight = Number(jsonObject.matrixHeight ?? matrix?.rows);
    if (!Number.isInteger(nextWidth) || nextWidth <= 0 || nextWidth > 256
      || !Number.isInteger(nextHeight) || nextHeight <= 0 || nextHeight > 256) return;
    if (
      nextWidth !== this.state.smallBedMatrixWidth ||
      nextHeight !== this.state.smallBedMatrixHeight
    ) {
      this.setState({
        smallBedMatrixWidth: nextWidth,
        smallBedMatrixHeight: nextHeight,
      });
    }
  }

  /** 接收调节抽屉的参数插槽，保留当前人体画布和实时数据。 */
  setHumanBodySettingsHost = (humanBodySettingsHost) => {
    if (this.state.humanBodySettingsHost !== humanBodySettingsHost) this.setState({ humanBodySettingsHost });
  }

  /**
   * 将后端切换结果立即应用到主界面。
   * WebSocket 状态消息和配置器“保存并显示”共用该入口，避免两套切换状态发生偏差。
   */
  applyCurrentSensorType = (sensorType) => {
    if (!sensorType) return;
    localStorage.setItem('file', sensorType);
    const nextMatrixName = normalizeDisplayMatrixName(sensorType);
    const nextMode = getDefaultModeForMatrix(nextMatrixName, this.state.numMatrixFlag);
    this.setState({
      matrixName: nextMatrixName,
      systemId: sensorType,
      numMatrixFlag: nextMode,
      minzhenSensorInfo: {},
      ...getConfig({ sensorType: nextMatrixName, mode: nextMode }),
    });
  };

  /**
   * 读「临期提醒最近一次弹出的日期」（YYYY-MM-DD）。
   * 存 localStorage 而不是内存，是为了关掉应用重开也不会再弹一次 —— 一天就是一天。
   * 读不到（隐私模式、被禁用、配额满）时返回 null，也就是照常提醒：
   * 宁可多提醒一次，也不能因为存储坏了就永远不提醒。
   */
  getLicenseWarnedDay() {
    try {
      return localStorage.getItem('licenseExpiryWarnedDay');
    } catch (err) {
      return null;
    }
  }

  /** 记下今天已经提醒过。写失败就算了，下次照常弹，不影响主流程。 */
  setLicenseWarnedDay(day) {
    try {
      localStorage.setItem('licenseExpiryWarnedDay', day);
    } catch (err) {
      console.warn('[密钥检查] 无法记录提醒日期，临期提醒可能重复弹出', err);
    }
  }

  /** 接收停止或设备切换时清空实时画面；只改展示缓存，不发布或保存模拟零帧。 */
  clearHalowDisplay = () => {
    if (![HUMAN_BODY_OPTIMIZED_MATRIX, PRESSURE_VEST_MATRIX].includes(resolveNativeSystemType(this.state.systemId || this.state.matrixName))
      || this.state.history !== 'now') return;
    clearLastFrame();
    const empty = new Array(1024).fill(0);
    if (this.state.numMatrixFlag === 'numoriginal') this.com.current?.changeHumanBodyData?.(empty);
    else this.com.current?.sitData?.({ wsPointData: empty });
    this.humanBodyPressureTrend = [];
    this.humanBodyAreaTrend = [];
    this.data.current?.changeData({ meanPres: '0.00', maxPres: 0, point: 0, area: 0, totalPres: '0' });
    this.data.current?.initCharts();
    this.setState({ realHz: 0 });
  }

  /** 仅在当前实时小床会话中播报算法确认的告警。 */
  syncJqbedAlarmSpeech = (jsonObject, event) => {
    if (event?.target && event.target !== ws) return;
    const speechState = this.jqbedAlarmSpeechState ||
      (this.jqbedAlarmSpeechState = createJqbedAlarmSpeechState());
    const licenseInvalidated = jsonObject.licenseLocked || jsonObject.noLicense || jsonObject.licenseError != null;
    if (licenseInvalidated) this.jqbedAlarmSpeechBlocked = true;
    else if (jsonObject.selectFlag != null) {
      const selectedTypes = Array.isArray(jsonObject.selectFlag) ? jsonObject.selectFlag : [jsonObject.selectFlag];
      this.jqbedAlarmSpeechBlocked = jsonObject.selectFlag !== 'all' && !selectedTypes.includes('jqbed');
    }

    // Socket messages may be batched before React commits the corresponding status update.
    if (jsonObject.jqbedAlgorithmStatus) this.jqbedAlarmSpeechStatus = jsonObject.jqbedAlgorithmStatus;
    const status = this.jqbedAlarmSpeechStatus || this.state.jqbedAlgorithmStatus;
    const permitted = !Array.isArray(this.state.allowedTypes) || this.state.allowedTypes.includes('jqbed');
    const fileSensor = Array.isArray(jsonObject.file) ? jsonObject.file[0] : jsonObject.file;
    const packetSensor = jsonObject.activeSensorType ||
      (typeof fileSensor === 'string' && fileSensor !== 'all' ? fileSensor : null);
    if (packetSensor) this.jqbedAlarmSpeechSource = packetSensor;
    if (this.jqbedAlarmSpeechBlocked || !permitted ||
      this.state.matrixName !== 'jqbed' || this.state.history !== 'now' || this.state.local ||
      !this.state.wsConnected || status?.state !== 'ready' ||
      (this.jqbedAlarmSpeechSource && this.jqbedAlarmSpeechSource !== 'jqbed')) {
      speechState.reset();
      return;
    }

    const diagnostics = jsonObject.jqbedAlgorithmDiagnostics;
    if (diagnostics?.sensorType !== 'jqbed') return;
    for (const alertKey of speechState.observe(diagnostics)) {
      speakLocalizedMessage(
        this.props.t(`home.alerts.${alertKey}`),
        this.props.i18n.language,
        { alertKey },
      );
    }
  };

  /** 保留本次会话的最近有效床型和灵敏度回传。 */
  syncJqbedReturnedSettings = (jsonObject) => {
    const status = jsonObject.jqbedAlgorithmStatus;
    const invalidated = status && ['waiting', 'error'].includes(status.state);
    const diagnostics = jsonObject.jqbedAlgorithmDiagnostics;
    if (!invalidated && !diagnostics) return;

    this.setState((previousState) => {
      if (invalidated || ['waiting', 'error'].includes(previousState.jqbedAlgorithmStatus?.state) ||
        previousState.matrixName !== 'jqbed' || previousState.history !== 'now' ||
        previousState.local || !previousState.wsConnected) {
        return previousState.jqbedReturnedSettings == null ? null : { jqbedReturnedSettings: null };
      }
      if (diagnostics?.sensorType !== 'jqbed') return null;
      const nextSettings = mergeJqbedReturnedSettings(previousState.jqbedReturnedSettings, diagnostics.reserved_bytes);
      return sameJqbedReturnedSettings(previousState.jqbedReturnedSettings, nextSettings)
        ? null
        : { jqbedReturnedSettings: nextSettings };
    });
  };

  /** 按当前客户端订阅合并实时算法字段，来源失效时清空。 */
  syncJqbedAlgorithmLog = (jsonObject, event) => {
    if (event?.target && event.target !== ws) return;
    const subscription = jsonObject.jqbedAlgorithmLogSubscription;
    const frame = jsonObject.jqbedAlgorithmLog;
    const invalidated = ['waiting', 'error'].includes(jsonObject.jqbedAlgorithmStatus?.state);
    const licenseInvalidated = jsonObject.licenseLocked || jsonObject.noLicense || jsonObject.licenseError != null;
    if (!subscription && !frame && !invalidated && !licenseInvalidated) return;
    if (licenseInvalidated) {
      this.jqbedAlgorithmLogRequestId = null;
      this.jqbedAlgorithmLogRequested = false;
    }

    this.setState((previousState) => {
      const permitted = !Array.isArray(previousState.allowedTypes) || previousState.allowedTypes.includes('jqbed');
      if (licenseInvalidated || !permitted || previousState.matrixName !== 'jqbed' ||
        previousState.history !== 'now' || previousState.local || !previousState.wsConnected) {
        return previousState.jqbedAlgorithmLogFrame == null && previousState.jqbedAlgorithmLogSubscription == null
          ? null : { jqbedAlgorithmLogFrame: null, jqbedAlgorithmLogSubscription: null };
      }
      const matchingAck = subscription && (subscription.subscribed !== true || this.jqbedAlgorithmLogRequested !== false) &&
        (!subscription.requestId || !this.jqbedAlgorithmLogRequestId ||
        subscription.requestId === this.jqbedAlgorithmLogRequestId);
      const nextSubscription = matchingAck ? subscription : previousState.jqbedAlgorithmLogSubscription;
      let nextFrame = previousState.jqbedAlgorithmLogFrame;
      if (invalidated || (matchingAck && (!subscription.ok || !subscription.subscribed))) nextFrame = null;
      if (!invalidated && frame?.sensorType === 'jqbed' && nextSubscription?.ok === true &&
        nextSubscription.subscribed === true && this.jqbedAlgorithmLogRequested !== false &&
        frame.outputs && typeof frame.outputs === 'object' && !Array.isArray(frame.outputs)) {
        if (nextFrame?.sequence !== frame.sequence || nextFrame?.receivedAt !== frame.receivedAt) {
          nextFrame = mergeJqbedAlgorithmLogFrame(nextFrame, frame);
        }
      }
      return nextFrame === previousState.jqbedAlgorithmLogFrame && nextSubscription === previousState.jqbedAlgorithmLogSubscription
        ? null : { jqbedAlgorithmLogFrame: nextFrame, jqbedAlgorithmLogSubscription: nextSubscription };
    });
  };

  wsData = (e, decodedMessage = null) => {
    // A replaced socket may still dispatch a queued message; it cannot update the current session.
    if (e.target && e.target !== ws) return;
    sitPress = 0;
    const jsonObject = decodedMessage || parseWebSocketEventPayload(e);
    if (!jsonObject) return;
    const nextLicenseAccess = readLicenseAccess(jsonObject);
    const effectiveLicenseAccess = nextLicenseAccess === undefined ? this.state.licenseAccess : nextLicenseAccess;
    const historyOnly = isHistoryOnlyLicense(effectiveLicenseAccess);
    if (nextLicenseAccess !== undefined) {
      this.setState({ licenseAccess: nextLicenseAccess, ...(historyOnly ? { licenseModalVisible: false, licenseLockedVisible: false } : {}) });
      if (historyOnly && this._licenseModal) { this._licenseModal.destroy?.(); this._licenseModal = null; }
    }
    if (jsonObject.collectionSummary) this.applyCollectionSummary(jsonObject.collectionSummary);
    this.cacheSingleGloveFrame(jsonObject);
    if (jsonObject.halowStatus) this.setState({ halowStatus: jsonObject.halowStatus });
    if (jsonObject.halowClear) this.clearHalowDisplay();
    if (jsonObject.serialStatus) {
      serialFeedback.status(jsonObject.serialStatus);
      window.dispatchEvent(new CustomEvent('shroom-serial-status', { detail: jsonObject.serialStatus }));
    }
    if (jsonObject.serialNotice) serialFeedback.error(jsonObject.serialNotice);
    const sitFrameData = getSensorFrameChannelValue(jsonObject, 'sit');
    if (Array.isArray(jsonObject.pressArr) && Array.isArray(jsonObject.areaArr) && jsonObject.length != null) {
      this.data.current?.setPlaybackCharts(jsonObject);
    }
    if (jsonObject.index != null) this.data.current?.setPlaybackChartIndex(jsonObject.index);
    this.syncSmallBed12BMatrixSize(jsonObject);

    if (jsonObject.jqbedAlgorithmConfig) {
      this.setState({ jqbedAlgorithmConfig: jsonObject.jqbedAlgorithmConfig });
    }
    if (jsonObject.jqbedAlgorithmConfigResult) {
      this.setState({ jqbedAlgorithmConfigResult: jsonObject.jqbedAlgorithmConfigResult });
    }
    if (jsonObject.jqbedAlgorithmStatus) {
      this.setState({
        jqbedAlgorithmStatus: jsonObject.jqbedAlgorithmStatus,
        ...(['waiting', 'error'].includes(jsonObject.jqbedAlgorithmStatus.state)
          ? { jqbedReturnedSettings: null, jqbedAlgorithmLogFrame: null } : {}),
      });
    }
    // 后端 HTTP 写接口（Agent / 脚本）改了展示系统目录。Builder 在进程内保存时自己派发这个
    // DOM 事件；这里把后端广播翻译成同一个事件，顶部菜单就能沿用既有的重拉逻辑。
    if (jsonObject.displaySystemsUpdated) {
      window.dispatchEvent(new CustomEvent('shroom-display-systems-updated', {
        detail: jsonObject.displaySystemsUpdated,
      }));
    }

    const currentDisplayDefinition = getDisplayDefinition(this.state.matrixName);
    const hasPressureFrame = Boolean(
      getSensorFrameOutputChannel(jsonObject)
      && getSensorFrameChannelValue(jsonObject),
    );
    // ⚠️ 目录尚未返回或副本型号还在切换时不分派旧处理器，否则重载后的首帧会抛错。
    if (hasPressureFrame && (!currentDisplayDefinition
      || (currentDisplayDefinition.nativeSourceType && currentDisplayDefinition.nativeSourceType !== this.state.matrixName))) return;
    // 采集计时不在这里了：它改成由 `startCollectionTimer` 的定时器驱动，不再蹭帧。
    // 之前这段代码在帧处理链里，于是既受「显示系统提前 return」影响（manifest
    // 传感器数字恒为 0），也受帧率影响（没帧进来秒表就停）。

    if (currentDisplayDefinition?.source === 'manifest' && hasPressureFrame) {
      const handled = this.handleManifestSceneFrame(jsonObject, currentDisplayDefinition);
      if (handled || jsonObject.displaySystemId) return;
    } else if (hasPressureFrame && !this.isCurrentDisplayFrame(jsonObject)) {
      // canonical 帧按 displaySystemId 隔离；缺少身份的旧帧由兼容边界继续透传。
      return;
    }
    this.syncJqbedAlarmSpeech(jsonObject, e);

    // 传感器类型清单（{time,flat,map}）：存到 state 并落地 localStorage 兜底
    if (jsonObject.sensorTypeList && Array.isArray(jsonObject.sensorTypeList.flat)) {
      this.setState({ sensorTypeList: jsonObject.sensorTypeList });
      try { localStorage.setItem('sensorTypeList', JSON.stringify(jsonObject.sensorTypeList)); } catch (err) { /* ignore */ }
      return;
    }

    if (jsonObject.collectionStorageError != null) {
      const errorInfo = jsonObject.collectionStorageError || {};
      const text = errorInfo.message || this.props.t('home.databaseFull');
      if (this.props.messageApi) {
        this.props.messageApi.error(text, 6);
      } else {
        message.error(text, 6);
      }
      return;
    }

    if (jsonObject.csvDownloadProgress != null) {
      window.dispatchEvent(new CustomEvent('shroom-csv-download-status', {
        detail: jsonObject,
      }));
      return;
    }

    // download 弹窗判断 - 放在最前面确保不被其他逻辑阻断
    if (jsonObject.download != null) {
      console.log('[download弹窗] 收到download消息:', jsonObject.download);
      const { t } = this.props;
      const i18nKeys = ['deleteSuccess', 'export csv success', 'export csv failed'];
      const displayMsg = i18nKeys.includes(jsonObject.download) && t
        ? t(jsonObject.download)
        : jsonObject.download;
      window.dispatchEvent(new CustomEvent('shroom-csv-download-status', {
        detail: {
          ...jsonObject,
          displayMsg,
        },
      }));
      if (this.props.messageApi) {
        this.props.messageApi.info(displayMsg);
      } else {
        message.info(displayMsg);
      }
      return;
    }

    //处理空数组
    if (jsonObject.autoConnectHand0205Double != null) {
      const result = jsonObject.autoConnectHand0205Double;
      if (result.success) {
        this.setState({
          portname: result.portname || '',
          portnameBack: result.portnameBack || '',
          hand: true,
        });
        const text = result.message || this.props.t('home.glovesConnected');
        if (this.props.messageApi) {
          this.props.messageApi.success(text);
        } else {
          message.success(text);
        }
      } else {
        const text = result.message || this.props.t('home.glovesConnectFailed');
        if (this.props.messageApi) {
          this.props.messageApi.error(text);
        } else {
          message.error(text);
        }
      }
      return;
    }

    sitDataFlag = false;

    if (jsonObject.data != null) {
      // const data = JSON.parse(jsonObject.data)
      // console.log(jsonObject.data)
      const humanBodyPayload = parseMaybeJsonPayload(jsonObject.data, {})
      const normalizedHumanBodyPayload = parseMaybeJsonPayload(humanBodyPayload?.data, humanBodyPayload) || {}
      const {
        HL,
        HR,
        FL,
        FR,
        ALLBODY,
        BODY,
        hl,
        hr,
        fl,
        fr,
        allbody: lowerAllbody,
        body: lowerBody,
      } = normalizedHumanBodyPayload

      let flArr = new Array(60).fill(0), frArr = new Array(60).fill(0),
        hrArr = new Array(147).fill(0), hlArr = new Array(147).fill(0), allbody = new Array(1024).fill(0), body = new Array(1024).fill(0)

      const flSource = getHumanBodyPartArray(FL ?? fl)
      const frSource = getHumanBodyPartArray(FR ?? fr)
      const hrSource = getHumanBodyPartArray(HR ?? hr)
      const hlSource = getHumanBodyPartArray(HL ?? hl)
      const allbodySource = getHumanBodyPartArray(ALLBODY ?? lowerAllbody)
      const bodySource = getHumanBodyPartArray(BODY ?? lowerBody)

      if (flSource) flArr = flLine(flSource)
      if (frSource) frArr = frLine(frSource)
      if (hrSource) hrArr = hrLine(hrSource)
      if (hlSource) hlArr = hlLine(hlSource)
      // if (BODY && BODY.arr) body = chestLine(BODY.arr)
      if (allbodySource) allbody = allbodySource.length >= 1024 ? allbodySource.slice(0, 1024) : robot0401(allbodySource)
      if (bodySource) body = bodySource.length >= 1024 ? bodySource.slice(0, 1024) : robot0401(bodySource)
      // console.log(FL)

      // flArr = flLine(FL.arr)

      // flArr = new Array(60).fill(100)
      // console.log(flArr)
      const newArr = genWebglData([
        { arr: hlArr, width: 20, height: 20, order: 2, interp1: 1, interp2: 1 },
        { arr: hrArr, width: 20, height: 20, order: 2, interp1: 1, interp2: 1 },
        { arr: flArr, width: 20, height: 20, order: 2, interp1: 1, interp2: 1 },
        { arr: frArr, width: 20, height: 20, order: 2, interp1: 1, interp2: 1 },
        { arr: allbody, width: 32, height: 32, order: 2, interp1: 1, interp2: 1 },
        { arr: body, width: 32, height: 32, order: 2, interp1: 1, interp2: 1 },
      ])
      if (isHumanBodyMatrix(this.state.matrixName)) {
        const humanBodySource = allbody.some((value) => value > 0) ? allbody : body
        this.syncHumanBodyRawPressureStats(humanBodySource)

        if (this.state.numMatrixFlag === 'numoriginal') {
          this.com.current?.changeHumanBodyData?.(humanBodySource)
        } else {
          this.com.current?.sitData?.({ wsPointData: humanBodySource })
        }
      }
      // console.log(newArr)
      const WebGLCanvas1 = new WebGLCanvas()
      const z = WebGLCanvas1.render({
        width: 512 / 4,
        height: 2048 / 4 * 8,
        radius: 20,
        max: heatMapMax,
        min: 1,
        filter: 12,
        class: 'body'
      }, newArr, 'dynamic');

      // const HLdata = jsonObject.data
      // const newData = allFrameData.map((arr) => {
      //   if (arr.length) {
      //     return genData(arr)
      //   } else {
      //     return genData(new Array(1024).fill(0))
      //   }
      // })
      // const newArr = genAllData(newData, { canvasHeight: 2048 / 4 / 2, canvasWidth: 512 / 4 })

      // // console.log(newData)

      // const WebGLCanvas1 = new WebGLCanvas()
      // const z = WebGLCanvas1.render({
      //   width: 512 / 4,
      //   height: 2048 / 4 * 8,
      //   radius: 20,
      //   max: heatMapMax,
      //   min: 1,
      //   filter: 12,
      //   class: 'body'
      // }, newArr, 'dynamic');
      // console.log(z)
      // console.log(itemRefs)
      // itemRefs.current?.forEach((item, index) => {
      //   item.drawHeatmap(z[0], index)
      // })
    }

    // ====== 授权锁定（时间回拨/篡改）→ 弹"请联系厂商重新获取密钥" ======
    if (jsonObject.licenseLocked) {
      this.setState({
        licenseLockedVisible: true,
        licenseLockReason: translateBackendMessage(jsonObject.reason, this.props.t)
          || this.props.t('license.anomalyDetected'),
      });
    }

    // ====== 密钥过期检查 ======
    // 处理密钥错误提示
    if (jsonObject.licenseError != null && !historyOnly) {
      // 无有效密钥时跳转到密钥输入页
      if (jsonObject.noLicense) {
        Modal.error({
          title: this.props.t('license.errorTitle'),
          content: translateBackendMessage(jsonObject.licenseError, this.props.t),
          onOk: () => {
            window.location.hash = '#/?from=system';
          }
        });
      } else {
        // 过期/暂停/吊销等：给“重新获取授权”按钮，点一下清缓存 + 立刻联网复查
        //（后台续期或恢复后无需重启即时生效）。用单例避免每次轮询重复弹窗。
        if (!this._licenseModal) {
          this._licenseModal = Modal.confirm({
            title: this.props.t('license.statusPrompt'),
            content: this.props.t('license.refreshInstruction', {
              reason: translateBackendMessage(jsonObject.licenseError, this.props.t)
                || this.props.t('license.validationFailed'),
            }),
            okText: this.props.t('license.refreshAuthorization'),
            keyboard: false,                                   // 禁 ESC 关闭
            maskClosable: false,                               // 点遮罩不关
            cancelButtonProps: { style: { display: 'none' } }, // 隐藏“关闭”：暂停/吊销/过期时不允许关掉继续用
            onOk: () => {
              // 点击后清缓存+立刻复查；仍无效会由状态广播再次弹出，恢复有效才不再弹——不留“关了继续用”的口子
              this._licenseModal = null;
              this.wsSendObj({ refreshLicense: true });
            },
          });
        }
      }
    }

    const endDate = getLicenseExpiryTimestamp(jsonObject);
    if (endDate !== null) {
      const serverNow = jsonObject.nowDate ? parseFloat(jsonObject.nowDate) : Date.now();
      const remainMs = endDate - serverNow;
      const remainDays = Math.ceil(remainMs / 86400000);
      const expireDateStr = new Date(endDate).toLocaleString(
        getLanguageLocale(this.props.i18n.language)
      );
      console.log('[密钥检查] endDate:', endDate, 'serverNow:', serverNow, 'remainMs:', remainMs, 'remainDays:', remainDays);

      if (remainMs <= 0 && !historyOnly) {
        console.log('[密钥检查] 密钥已过期，弹出提示');
        this.setState({
          licenseModalVisible: true,
          licenseModalType: 'expired',
          licenseModalExpireDate: expireDateStr,
          licenseModalRemainDays: 0
        });
      } else if (remainMs > 0 && remainDays <= 7) {
        // 临期提醒每天只弹一次。
        //
        // 后端每次复检（configManager.js RECHECK_INTERVAL_MS）都会无条件广播授权状态，
        // 所以这个分支跟着复检的节奏进。复检原来是 30 秒一次，这个分支又没有任何抑制，
        // 用户点掉「知道了」半分钟后又弹 —— 临期 7 天里要点两万次。
        // 复检现在放到 2h 了，但节流仍然要留着：重连、重新校验密钥也会触发广播。
        //
        // 用 serverNow 而不是本地时钟算「今天」：本地时钟可以被改，改一下就能骗过节流，
        // 而 serverNow 是后端 licenseManager 维护的可信时间（防回拨），和判到期用的是同一个源。
        const warnedDayKey = new Date(serverNow).toLocaleDateString('en-CA'); // YYYY-MM-DD
        if (this.getLicenseWarnedDay() !== warnedDayKey) {
          console.log('[密钥检查] 密钥即将过期，剩余', remainDays, '天，今日首次提醒');
          this.setLicenseWarnedDay(warnedDayKey);
          this.setState({
            licenseModalVisible: true,
            licenseModalType: 'warning',
            licenseModalExpireDate: expireDateStr,
            licenseModalRemainDays: remainDays
          });
        }
      }
    }

    const currentSensorType = getCurrentSensorTypeFromStatus(jsonObject)
      || (
        typeof jsonObject.activeSensorType === 'string' && jsonObject.activeSensorType.trim()
          ? jsonObject.activeSensorType.trim()
          : null
      )
    if (currentSensorType) this.applyCurrentSensorType(currentSensorType)

    // 旧版数组 file 仍作为授权范围兼容；标量 file/currentSensorType 只切换当前系统。
    if (jsonObject.file != null && jsonObject.selectFlag == null && !currentSensorType) {
      if (jsonObject.file === 'all') {
        localStorage.removeItem('allowedTypes')
        this.setState({ matrixTitle: true, allowedTypes: null })
      } else if (Array.isArray(jsonObject.file) && jsonObject.file.length) {
        // 多类型模式：使用数组第一个作为默认类型
        const allowedTypes = filterVisibleDisplayMatrixTypes(jsonObject.file)
        const nextMatrixName = normalizeDisplayMatrixName(allowedTypes[0] || jsonObject.file[0])
        const nextMode = getDefaultModeForMatrix(nextMatrixName, this.state.numMatrixFlag)
        localStorage.setItem('matrixTitle', false)
        localStorage.setItem('allowedTypes', JSON.stringify(allowedTypes))
        this.setState({
          matrixTitle: false,
          allowedTypes,
          matrixName: nextMatrixName,
          systemId: nextMatrixName,
          numMatrixFlag: nextMode,
          minzhenSensorInfo: {},
          ...getConfig({ sensorType: nextMatrixName, mode: nextMode }),
        })
        localStorage.setItem('file', selectedNativeSystemId(nextMatrixName))
      } else {
        this.setState({ matrixTitle: true })
      }
    }

    if (jsonObject.selectFlag != null) {
      // 全部授权：显示所有类型下拉框
      localStorage.setItem('matrixTitle', true)
      if (jsonObject.selectFlag === 'all') {
        localStorage.removeItem('allowedTypes')
        const nextMatrixName = resolveBackendDisplayMatrixName(
          jsonObject.activeSensorType,
          null,
          this.state.matrixName
        )
        const nextState = { matrixTitle: true, allowedTypes: null }
        if (nextMatrixName !== this.state.matrixName) {
          const nextMode = getDefaultModeForMatrix(nextMatrixName, this.state.numMatrixFlag)
          Object.assign(nextState, {
            matrixName: nextMatrixName,
            systemId: selectedNativeSystemId(nextMatrixName),
            numMatrixFlag: nextMode,
            minzhenSensorInfo: {},
            portname: '',
            portnameBack: '',
            portnameHead: '',
            portnameSensor: '',
            ...getConfig({ sensorType: nextMatrixName, mode: nextMode }),
          })
          localStorage.setItem('file', selectedNativeSystemId(nextMatrixName))
        }
        this.setState(nextState)
      } else {
        const allowedTypesRaw = Array.isArray(jsonObject.selectFlag)
          ? jsonObject.selectFlag
          : [jsonObject.selectFlag].filter(Boolean)
        const allowedTypes = filterVisibleDisplayMatrixTypes(allowedTypesRaw)
        localStorage.setItem('allowedTypes', JSON.stringify(allowedTypes))
        const nextState = { matrixTitle: true, allowedTypes }
        const currentMatrixName = normalizeDisplayMatrixName(currentSensorType || this.state.matrixName)
        // 新协议已经明确给出当前 runtime 时，授权刷新只更新范围，不再把自定义系统强制切走。
        if (!currentSensorType && (currentMatrixName !== this.state.matrixName || (allowedTypes.length && !allowedTypes.includes(this.state.matrixName)))) {
          const nextMatrixName = allowedTypes[0] || currentMatrixName
          const nextMode = getDefaultModeForMatrix(nextMatrixName, this.state.numMatrixFlag)
          Object.assign(nextState, {
            matrixName: nextMatrixName,
            systemId: selectedNativeSystemId(nextMatrixName),
            numMatrixFlag: nextMode,
            minzhenSensorInfo: {},
            portname: '',
            portnameBack: '',
            portnameHead: '',
            portnameSensor: '',
            ...getConfig({ sensorType: nextMatrixName, mode: nextMode }),
          })
          localStorage.setItem('file', selectedNativeSystemId(nextMatrixName))

          const backendMatrixName = normalizeDisplayMatrixName(jsonObject.activeSensorType)
          if (!backendMatrixName || backendMatrixName !== nextMatrixName) {
            this.wsSendObj(nextMatrixName === SMALL_BED_12B_MATRIX
              ? {
                file: nextMatrixName,
                smallBed12BDisplayOptions: getSmallBed12BDisplayOptions(
                  this.state.smallBed12BRealtimeMatrixMode,
                  this.state.smallBed12BRealtimeSamplePoint,
                ),
              }
              : { file: nextMatrixName })
          } else if (nextMatrixName === SMALL_BED_12B_MATRIX) {
            this.wsSendObj({
              smallBed12BDisplayOptions: getSmallBed12BDisplayOptions(
                this.state.smallBed12BRealtimeMatrixMode,
                this.state.smallBed12BRealtimeSamplePoint,
              ),
            })
          }
        }
        this.setState(nextState)
      }
    }

    // Read diagnostics after processing system context; configuration/rate values are not returned settings.
    this.syncJqbedReturnedSettings(jsonObject);
    this.syncJqbedAlgorithmLog(jsonObject, e);

    if (jsonObject.backFlag != null) {
      backFlag = jsonObject.backFlag;
      // 根据左右手切换 fingerArr 指向
      fingerArr = backFlag ? fingerArrR : fingerArrL;
    }

    if (jsonObject.hz != null) {
      hz = jsonObject.hz
      if (this.state.hz !== hz) {
        this.setState({ hz: hz })
      }
    }

    if (jsonObject.rate != null) {
      this.data.current?.changeData(jsonObject.rate);
      // jqbed speech uses merged alarms from the independent diagnostics channel.
      if (this.state.matrixName === 'smallBed') {
        if (onBedState.length >= 2) onBedState.shift();
        onBedState.push(jsonObject.rate.stateInBbed);
        if (onBedState[0] != onBedState[1]) {
          const alertKey = { 0: 'leftBed', 3: 'fallRisk', 4: 'satUp' }[onBedState[1]];
          if (alertKey) speakLocalizedMessage(
            this.props.t(`home.alerts.${alertKey}`), this.props.i18n.language, { alertKey },
          );
        }
        if (jsonObject.rate.sosflag) speakLocalizedMessage(
          this.props.t('home.alerts.emergency'), this.props.i18n.language, { alertKey: 'emergency' },
        );
      }
    }

    if (jsonObject.petCare != null) {
      this.data.current?.changeData(jsonObject.petCare);
    }

    if (jsonObject.petCareMini != null) {
      this.data.current?.changeData(jsonObject.petCareMini);
    }

    if (jsonObject.temperatureData != null) {
      this.data.current?.changeData({
        temperatureData: jsonObject.temperatureData,
        temperatureAvg: jsonObject.temperatureAvg,
      });
    }

    if (jsonObject.tempObj != null) {
      this.setState({ minzhenSensorInfo: jsonObject.tempObj });
      this.com.current?.sensorData?.(jsonObject);
    }

    if (sitFrameData) {
      if (this.state.matrixName === SINGLE_GLOVE_MATRIX && this.state.hand) {
        this.syncSingleGloveRawPressureStats(getRawPressurePayload(jsonObject, 'sit'));
      }
      // 统计真实采样频率
      realHzFrameCount++;
      const now = Date.now();
      if (now - realHzLastTime >= 1000) {
        const realHz = Math.round(realHzFrameCount * 1000 / (now - realHzLastTime));
        if (this.state.realHz !== realHz) {
          this.setState({ realHz: realHz });
        }
        realHzFrameCount = 0;
        realHzLastTime = now;
      }

      // 采集计时已经提到本函数开头（显示系统提前 return 之前），这里不再重复计数。

      let selectArr;
      let wsPointData = sitFrameData;
      let rotate = jsonObject.rotate;

      if (!Array.isArray(wsPointData)) {
        wsPointData = JSON.parse(wsPointData);
      }

      this.updateGloveExhibitionFrame(jsonObject, 'sit', wsPointData);


      // wsPointDataSit = wsPointData;
      // wsPointDataSit = wsPointDataSit.map((a) => Math.round(a));

      // 网络版
      // if(this.state.matrixName === 'yanfeng10'){
      //   wsPointDataSit = yanfeng10sit(wsPointDataSit)
      // }
      // console.log(fingerArr)
      if (isHumanBodyMatrix(this.state.matrixName)) {
        const humanBodySource = getHumanBodyFrameData(wsPointData)
        this.syncHumanBodyRawPressureStats(humanBodySource)
        if (this.state.numMatrixFlag === 'numoriginal') {
          this.com.current?.changeHumanBodyData?.(humanBodySource)
        } else {
          sitTypeEvent[this.state.matrixName]({
            that: this,
            wsPointData: humanBodySource,
            backFlag,
            state: this.state.carState,
            local: this.state.local,
            press: this.state.press,
            rotate,
            jsonObject,
            wsPointDataSitZero: wsPointDataSitZero,
            fingerArr: fingerArr
          });
        }
      } else if (this.state.matrixName !== 'handGloveFullPacket' && !isGloveExhibitionMode(this.state.numMatrixFlag)) {
        sitTypeEvent[this.state.matrixName]({
          that: this,
          wsPointData,
          backFlag,
          state: this.state.carState,
          local: this.state.local,
          press: this.state.press,
          rotate,
          jsonObject,
          wsPointDataSitZero: wsPointDataSitZero,
          fingerArr: fingerArr
          // compen : this.state.compen

        });
      }

      // 发布一帧规范数据到帧总线。
      //
      // **和上面的 sitTypeEvent 并行，不是替代。** 已经迁到 renderers/ 的
      // 渲染器传 frameChannel 就能自己订到帧（见 RendererHost），不必让 Home
      // 认识它的方法名；还留在 components/three/ 的场景组件继续走
      // sitTypeEvent → util.js → this.com.current.xxx() 那条老路。
      // 两条路并存是绞杀者模式的必要状态：一组一组往总线上搬，
      // 每搬完一组就从老路上摘一段，不需要一次性切换。
      publishFrame(buildSceneFrame({
        values: wsPointData,
        side: this.state.matrixName === HAND_0205_DOUBLE_MATRIX
          ? (backFlag ? SCENE_CHANNELS.RIGHT : SCENE_CHANNELS.LEFT)
          : undefined,
        showType: this.state.showType,
        width: wsPointDataSitWidth,
        meta: {
          matrixName: this.state.matrixName,
          numMatrixFlag: this.state.numMatrixFlag,
          local: this.state.local,
        },
      }));
    }

    if (jsonObject.handReset != null) {
      if (tactileGloveTypes.includes(this.state.matrixName)) {
        const side = resolveGloveQuaternionResetSide(jsonObject, {
          dual: this.state.matrixName !== SINGLE_GLOVE_MATRIX,
          hand: this.state.hand, acceptedIdentities: this.getCurrentDisplayIdentities(),
        });
        // ⚠️ 硬件初始化会更换设备姿态基准，必须等通知后的有效帧，不能复用初始化前的缓存。
        if (side) {
          const exhibitionFrame = this.gloveExhibitionFrames?.[side];
          if (exhibitionFrame) exhibitionFrame.quaternion = null;
          const cachedFrame = this.singleGloveFrames?.[side];
          if (cachedFrame) {
            cachedFrame.rotate = null;
            cachedFrame.orientation = null;
            if (cachedFrame.payload) cachedFrame.payload.orientation = null;
          }
          const hiddenSingleHand = this.state.matrixName === SINGLE_GLOVE_MATRIX
            && this.state.numMatrixFlag === 'normal' && side !== (this.state.hand ? 'left' : 'right');
          if (!hiddenSingleHand) this.com.current?.resetHand?.(side, { waitForNextFrame: true });
        }
      } else {
        this.com.current?.resetHand?.();
      }
    }



    if ((this.state.hand || this.state.matrixName === HAND_0205_DOUBLE_MATRIX) && this.state.numMatrixFlag == 'normal' && jsonObject.rotate != null && tactileGloveTypes.includes(this.state.matrixName)) {
      let rotate = jsonObject.rotate;
      // sitTypeEvent[this.state.matrixName]({
      //   that: this,
      //   wsPointData,
      //   backFlag,
      //   state: this.state.carState,
      //   local: this.state.local,
      //   press: this.state.press,
      //   rotate,
      //   wsPointDataSitZero: wsPointDataSitZero,
      //   fingerArr: fingerArr
      //   // compen : this.state.compen
      // });
    }

    // 网络版
    // if(this.state.matrixName === 'yanfeng10' && jsonObject.data != null){
    //   let wsPointData = jsonObject.data;

    //   if (!Array.isArray(wsPointData)) {
    //     wsPointData = JSON.parse(wsPointData);
    //   }



    //   wsPointDataSit = wsPointData;
    //   wsPointDataSit = yanfeng10sit(wsPointDataSit)
    //   console.log(wsPointDataSit)
    //   sitTypeEvent[this.state.matrixName]({
    //     that: this,
    //     wsPointData : wsPointDataSit,
    //     backFlag,
    //     local: this.state.local,
    //     press: this.state.press,
    //     // compen : this.state.compen
    //   });
    // }


    const sitMappedPressurePayload = getMappedPressurePayload(jsonObject, this.state.matrixName)
    if (sitFrameData && !isGloveExhibitionMode(this.state.numMatrixFlag) &&
      sitMappedPressurePayload != null &&
      (['robot1', 'footVideo'].includes(this.state.matrixName) || this.state.matrixName.includes('robot') ||
        this.state.matrixName.includes('hand') || this.state.matrixName == 'Num3D')) {
      const that = this
      let wsPointData = parsePressurePayload(sitMappedPressurePayload);
      // console.log(wsPointData , 'wsPointData')
      let rotate = jsonObject.rotate;

      // if (['robot1', 'footVideo'].includes(this.state.matrixName)) {
      //   if (this.state.numMatrixFlag.includes('num')) {
      //     let newArr = [...wsPointData]
      //     this.com.current?.changeWsData147([...newArr])

      //   }
      //   return
      // }

      if ((this.state.hand || isDualGloveDisplay(this.state.matrixName, this.state.numMatrixFlag)) && this.state.matrixName.includes('hand')) {



        if (this.state.matrixName == 'Num3D') {
          // let newArr = [...wsPointData]
          // if (that.state.showType == 'finger') {
          //   that.com.current?.changeWsData(newArr);
          // } else {

          // }

          // let wsPointData = jsonObject.newArr147;
          let newArr = [...wsPointData]
          if (this.state.showType == 'hand') {
            this.com.current?.changeWsData147([...newArr])
          }


          newArr.splice(5 * 15, 0, 0);
          newArr.splice(5 * 15, 0, 0);
          newArr.splice(5 * 15, 0, 0);

          if (this.state.showType == 'finger') {
            this.com.current?.changeWsDatafinger(newArr)
          } else if (this.state.showType == 'palm') {
            this.com.current?.changeWsDatapalm(newArr)
          }

        }
        else {

          if (isTactileGloveMappedLength(this.state.matrixName, wsPointData.length)) {

            if (this.state.numMatrixFlag == 'normal') {
              // 3D 遥操模式：
              // 1. 将 256 字节原始数据写入 wsPointDataSit，供 Aside 侧边栏显示压力数山
              let rawSitData = getRawPressurePayload(jsonObject, 'sit');
              if (!Array.isArray(rawSitData)) rawSitData = JSON.parse(rawSitData);
              wsPointDataSit = [...rawSitData];
              wsPointDataSitWidth = 16; // hand0205 是 16×16 矩阵
              this.syncGloveRawPressureStats(rawSitData);

              if (this.state.matrixName === 'handGloveFullPacket') {
                const renderData = parsePressurePayload(sitFrameData);
                that.com.current?.sitData({
                  wsPointData: renderData,
                  statsData: rawSitData,
                  local: that.state.local
                });
              }

              // 2. 将映射数据压缩为 5 个点，用于遥操控制（手指弯折/旋转）。
              // 弯指必须基于未清零数据：清零后指根静息值归零，与校准基准对不上，弯曲会恒为 0
              const bendSourceRaw = parseMaybeJsonPayload(jsonObject.newArr147Raw, null)
              const bendSource = Array.isArray(bendSourceRaw) && bendSourceRaw.length >= 75 ? bendSourceRaw : wsPointData
              let fivePoints = []
              if (jsonObject.newArr != null) {
                for (let i = 0; i < 5; i++) {
                  let num = 0
                  for (let j = 0; j < 3; j++) {
                    const index = j * 10 + i * 2
                    num += bendSource[index]
                    num += bendSource[index + 1]
                  }
                  fivePoints[i] = num
                }
                fivePoints = [...fivePoints].reverse()
              } else {
                for (let i = 0; i < 5; i++) {
                  let num = 0
                  const j = 4
                  const index = j * 15 + i * 3
                  num += bendSource[index]
                  num += bendSource[index + 1]
                  num += bendSource[index + 2]
                  fivePoints[i] = num
                }
              }
              const isDoubleGlove = isDualGloveDisplay(this.state.matrixName, 'normal')
              const isRightPayload = isDoubleGlove ? isRightHandPayload(jsonObject, false) : this.state.matrixName === SINGLE_GLOVE_MATRIX ? false : !!backFlag
              const currentFingerPoints = updateLatestFingerPoints(fivePoints, isRightPayload)

              const com = isDoubleGlove && isRightPayload
                ? {
                  changeHandAngle: that.com.current?.changeRightHandAngle,
                  calibration: that.com.current?.calibrationRight,
                }
                : this.state.matrixName == 'hand0507' ? that.com.current?.handL : that.com.current
              const currentFingerCalibration = isDoubleGlove || this.state.matrixName === SINGLE_GLOVE_MATRIX
                ? (isRightPayload ? fingerArrR : fingerArrL)
                : fingerArr
              if (isDoubleGlove && !isRightPayload) {
                that.com.current?.sitData({
                  wsPointData: wsPointData ? [...wsPointData] : [],
                  statsData: rawSitData,
                  local: that.state.local
                });
              }

              if (!that.state.calibration) {
                if (rotate && Array.isArray(rotate) && rotate.length >= 4 && !rotate.some(v => v == null || isNaN(v))) {
                  let arr = [-rotate[0], rotate[1], rotate[2], rotate[3]]
                  if (!arr.some(v => Math.abs(v) > 1)) {
                    com?.changeHandAngle(arr)
                  }
                }
                if (currentFingerCalibration) {
                  if (!currentFingerCalibration[0] || !Array.isArray(currentFingerCalibration[0])) currentFingerCalibration[0] = new Array(5).fill(0)
                  if (!currentFingerCalibration[1] || !Array.isArray(currentFingerCalibration[1])) currentFingerCalibration[1] = new Array(5).fill(255)
                  const baseArr = []
                  for (let i = 0; i < 5; i++) {
                    baseArr.push((currentFingerCalibration[1][i] || 0) - (currentFingerCalibration[0][i] || 0))
                  }
                  const bendArr = isDoubleGlove && isRightPayload ? rightHandNewArr : newArr
                  for (let i = 0; i < 5; i++) {
                    const rawValue = currentFingerPoints[i]
                    if (rawValue == null || isNaN(rawValue)) continue;
                    const numberValue = Math.round((rawValue - (currentFingerCalibration[0][i] || 0)) / (baseArr[i] ? baseArr[i] : 1) * 100) / 100
                    const value = numberValue < 0 ? 0 : numberValue >= 1 ? 1 : numberValue
                    bendArr[i] = bendArr[i] + (value - bendArr[i]) / 3
                  }
                  com?.calibration(bendArr)
                }
              }
            } else if (this.state.numMatrixFlag == 'numoriginal' && tactileGloveTypes.includes(this.state.matrixName)) {
              // 手套原始数据模式：sit 路默认左手，双手协议按包内 handSide 分流
              const gloveSide = isRightHandPayload(jsonObject, false) ? 'right' : 'left'
              let newArr = [...wsPointData]
              if (this.com.current?.changeWsData147R) {
                this.com.current.changeWsData147R([...newArr], gloveSide)
              } else {
                this.com.current?.changeWsData147([...newArr], gloveSide)
              }
            } else if (this.state.numMatrixFlag == 'num' && tactileGloveTypes.includes(this.state.matrixName)) {
              const gloveSide = isRightHandPayload(jsonObject, false) ? 'right' : 'left'
              if (this.state.matrixName === 'handGloveFullPacket') {
                const rawData = this.parseGloveRawMatrix(getRawPressurePayload(jsonObject, 'sit'));
                if (rawData) {
                  this.com.current?.changeWsData256([...rawData], gloveSide)
                }
              } else {
                // 手套2D数字模式：旧手套使用 sitData 的原始256数据点，以16x16矩阵显示
                let rawData = getRawPressurePayload(jsonObject, 'sit');
                if (rawData && !Array.isArray(rawData)) {
                  rawData = JSON.parse(rawData);
                }
                if (rawData && rawData.length >= 256) {
                  this.com.current?.changeWsData256([...rawData.slice(0, 256)], gloveSide)
                } else {
                  this.com.current?.changeWsData147([...wsPointData], gloveSide)
                }
              }
            } else if (this.state.numMatrixFlag == 'num3D' && tactileGloveTypes.includes(this.state.matrixName)) {
              // 手套3D数字模式：使用映射数据，跟之前一样
              let newArr = [...wsPointData]
              if (this.com.current?.changeWsData147R) {
                this.com.current.changeWsData147R([...newArr])
              } else {
                this.com.current?.changeWsData147([...newArr])
              }
            } else if (this.state.numMatrixFlag.includes('num')) {
              let newArr = [...wsPointData]
              if (this.com.current?.changeWsData147R) {
                this.com.current.changeWsData147R([...newArr])
              } else {
                this.com.current?.changeWsData147([...newArr])
              }
            } else if (this.state.numMatrixFlag == 'skin') {
              let newArr = [...wsPointData]
              console.log(wsPointData)
              wsPointData = handSkinChange(wsPointData)
              that.com.current?.sitData({
                wsPointData: wsPointData,
                newArr: newArr,
                local: that.state.local
              });
            }
          } else {

            const rotate = wsPointData.splice(wsPointData.length - 4, wsPointData.length)
            if (this.state.numMatrixFlag == 'normal') {
              let arr = []
              if (jsonObject.newArr != null) {
                for (let i = 0; i < 5; i++) {
                  let num = 0
                  for (let j = 0; j < 3; j++) {
                    const index = j * 10 + i * 2
                    num += wsPointData[index]
                    num += wsPointData[index + 1]
                  }
                  arr[i] = num
                }
                wsPointData = [...arr].reverse()
              } else {
                for (let i = 0; i < 5; i++) {
                  let num = 0
                  // for (let j = 0; j < 3; j++) {
                  const j = 4
                  const index = j * 15 + i * 3
                  num += wsPointData[index]
                  num += wsPointData[index + 1]
                  num += wsPointData[index + 2]
                  // }
                  arr[i] = num
                }
                wsPointData = [...arr]


              }





              wsPointDataSit = wsPointData;
              wsPointDataSit = wsPointDataSit.map((a) => Math.round(a));
              wsPointDataSitWidth = 32;
              const isDoubleGlove = isDualGloveDisplay(this.state.matrixName, 'normal')
              const isRightPayload = isDoubleGlove ? isRightHandPayload(jsonObject, false) : this.state.matrixName === SINGLE_GLOVE_MATRIX ? false : !!backFlag
              const currentFingerPoints = updateLatestFingerPoints(wsPointDataSit, isRightPayload)
              const rawSitData = getRawPressurePayload(jsonObject, 'sit');
              this.syncGloveRawPressureStats(rawSitData);

              if (that.state.numMatrixFlag == "normal") {

                if (this.state.matrixName != 'handVideo1') {
                  that.com.current?.sitData({
                    wsPointData: wsPointData ? wsPointData : [],
                    statsData: this.parseGloveRawMatrix(rawSitData) || undefined,
                    local: that.state.local
                  });
                } else {
                  that.com.current?.sitData({
                    local: that.state.local
                  });
                }


              } else if (that.state.numMatrixFlag == "heatmap") {
                that.com.current?.bthClickHandle(wsPointData);
              }

              const com = isDoubleGlove && isRightPayload
                ? {
                  changeHandAngle: that.com.current?.changeRightHandAngle,
                  calibration: that.com.current?.calibrationRight,
                }
                : this.state.matrixName == 'hand0507' ? that.com.current?.handL : that.com.current
              const currentFingerCalibration = isDoubleGlove || this.state.matrixName === SINGLE_GLOVE_MATRIX
                ? (isRightPayload ? fingerArrR : fingerArrL)
                : fingerArr

              if (!that.state.calibration) {
                //  z 
                if (rotate && Array.isArray(rotate) && rotate.length >= 4 && !rotate.some(v => v == null || isNaN(v))) {
                  let arr = [-rotate[0], rotate[1], rotate[2], rotate[3]]
                  // 过滤四元数绝对值超过1的异常数据
                  if (!arr.some(v => Math.abs(v) > 1)) {
                    com?.changeHandAngle(arr)
                  }
                }

                if (currentFingerCalibration) {
                  if (!currentFingerCalibration[0] || !Array.isArray(currentFingerCalibration[0])) {
                    currentFingerCalibration[0] = new Array(5).fill(0)
                  }
                  if (!currentFingerCalibration[1] || !Array.isArray(currentFingerCalibration[1])) {
                    currentFingerCalibration[1] = new Array(5).fill(255)
                  }
                  const baseArr = []
                  for (let i = 0; i < 5; i++) {
                    baseArr.push((currentFingerCalibration[1][i] || 0) - (currentFingerCalibration[0][i] || 0))
                  }

                  const bendArr = isDoubleGlove && isRightPayload ? rightHandNewArr : newArr
                  for (let i = 0; i < 5; i++) {
                    const rawValue = currentFingerPoints[i]
                    if (rawValue == null || isNaN(rawValue)) continue;
                    const numberValue = Math.round((rawValue - (currentFingerCalibration[0][i] || 0)) / (baseArr[i] ? baseArr[i] : 1) * 100) / 100
                    const value = (numberValue) < 0 ? 0 : (numberValue) >= 1 ? 1 : (numberValue)

                    bendArr[i] = bendArr[i] + (value - bendArr[i]) / 3
                  }

                  com?.calibration(bendArr)
                }
              } else {

                // that.com.current?.calibration([0,0,0])
                // that.com.current?.handZero()
                // that.com.current?.calibration([0,0,0])
              }
            } else if (this.state.numMatrixFlag == 'numoriginal' && tactileGloveTypes.includes(this.state.matrixName)) {
              // 手套原始数据模式：sit 路默认左手，双手协议按包内 handSide 分流
              const gloveSide = isRightHandPayload(jsonObject, false) ? 'right' : 'left'
              let newArr = [...wsPointData]
              if (this.com.current?.changeWsData147R) {
                this.com.current.changeWsData147R([...newArr], gloveSide)
              } else {
                this.com.current?.changeWsData147([...newArr], gloveSide)
              }
            } else if (this.state.numMatrixFlag == 'num' && tactileGloveTypes.includes(this.state.matrixName)) {
              const gloveSide = isRightHandPayload(jsonObject, false) ? 'right' : 'left'
              if (this.state.matrixName === 'handGloveFullPacket') {
                const rawData = this.parseGloveRawMatrix(getRawPressurePayload(jsonObject, 'sit'));
                if (rawData) {
                  this.com.current?.changeWsData256([...rawData], gloveSide)
                }
              } else {
                // 手套2D数字模式：旧手套使用 sitData 的原始256数据点，以16x16矩阵显示
                let rawData = getRawPressurePayload(jsonObject, 'sit');
                if (rawData && !Array.isArray(rawData)) {
                  rawData = JSON.parse(rawData);
                }
                if (rawData && rawData.length >= 256) {
                  this.com.current?.changeWsData256([...rawData.slice(0, 256)], gloveSide)
                } else {
                  this.com.current?.changeWsData147([...wsPointData], gloveSide)
                }
              }
            } else if (this.state.numMatrixFlag == 'num3D' && tactileGloveTypes.includes(this.state.matrixName)) {
              // 手套3D数字模式：使用映射数据，跟之前一样
              let newArr = [...wsPointData]
              if (this.com.current?.changeWsData147R) {
                this.com.current.changeWsData147R([...newArr])
              } else {
                this.com.current?.changeWsData147([...newArr])
              }
            } else if (this.state.numMatrixFlag.includes('num')) {
              let newArr = [...wsPointData]
              if (this.com.current?.changeWsData147R) {
                this.com.current.changeWsData147R([...newArr])
              } else {
                this.com.current?.changeWsData147([...newArr])
              }
            } else if (this.state.numMatrixFlag == 'skin') {
              console.log(wsPointData)
              wsPointData = handSkinChange(wsPointData)
              that.com.current?.sitData({
                wsPointData: wsPointData,
                local: that.state.local
              });
            }
          }
        }


      } else {
        // console.log(this.state.matrixName)
        if (this.state.matrixName == 'footVideo') {
          if (this.state.numMatrixFlag.includes('num')) {
            let newArr = [...wsPointData]

            // this.com.current?.changeWsData147([...newArr])
            this.com.current?.changeWsData147R({ left: [...newArr] })
          }
        } else if (this.state.matrixName.includes('robot')) {
          if (this.state.numMatrixFlag.includes('num')) {
            let newArr = [...wsPointData]
            this.com.current?.changeWsData147([...newArr])
          }
        }

      }
    }


    if (jsonObject.sitType != null) {
      this.data.current?.changeData({
        sitCol: jsonObject.sitType
      });
    }

    if (jsonObject.port != null) {
      const port = [];
      jsonObject.port.forEach((a, index) => {
        port.push({
          value: a.path,
          label: a.path,
        });
      });

      this.setState({
        port: port,

      });
    }
    if (jsonObject.length != null) {
      this.setState({
        length: jsonObject.length,
      });
    }
    if (jsonObject.time != null) {
      this.setState({
        time: jsonObject.time,
        timeArr: Array.isArray(jsonObject.time) ? jsonObject.time : [],
      });
    }
    if (jsonObject.historyTimeArr != null) {
      this.setState({
        historyTimeArr: Array.isArray(jsonObject.historyTimeArr)
          ? jsonObject.historyTimeArr
          : [],
      });
    }
    if (jsonObject.timeArr != null) {
      // const arr = []
      const arr = jsonObject.timeArr; //.map((a, index) => a.date);

      // if (this.state.matrixName == "car") {
      let obj = [];

      arr.forEach((a, index) => {
        obj.push({
          value: a.info || a.date,
          label: translateDomainLabel(a.name || a.date, this.props.t),
        });
      });

      this.setState({ dataArr: obj });
      // } else {
      //   let obj = [];
      //   arr.forEach((a, index) => {
      //     obj.push({
      //       value: a.date,
      //       label: a.name,
      //     });
      //   });

      //   this.setState({ dataArr: obj });
      // }
    }

    if (jsonObject.index != null) {
      this.progress.current?.changeIndex(jsonObject.index);
    }

    if (jsonObject.areaArr != null) {
      const max = findMax(jsonObject.areaArr);
      this.data.current?.handleChartsArea(jsonObject.areaArr, max + 100);
      this.max = max;
      this.areaArr = jsonObject.areaArr;
      this.setState({
        areaArr: jsonObject.areaArr,
      });
    }

    if (jsonObject.pressArr != null) {
      const max = findMax(jsonObject.pressArr);
      // if (this.state.matrixName == "car" || this.state.matrixName == "bigBed" || this.state.matrixName == "carCol" || this.state.matrixName == "matCol" || this.state.matrixName == "bigBed" || this.state.matrixName == "volvo" || this.state.matrixName == "sit10" || this.state.matrixName == "hand" || this.state.matrixName == "smallBed" || this.state.matrixName == "jqbed" || this.state.matrixName == "xiyueReal1" || this.state.matrixName == "yanfeng10") {
      if (this.state.matrixName != "foot") {
        this.data.current?.handleCharts(jsonObject.pressArr, max + 100);
        this.pressMax = max;
        this.pressArr = jsonObject.pressArr;
        this.setState({
          pressArr: jsonObject.pressArr,
        });
      }
    }

  };



  ws1Data = (e, decodedMessage = null) => {
    const jsonObject = decodedMessage || parseWebSocketEventPayload(e);
    if (!jsonObject) return;
    const backFrameData = getSensorFrameChannelValue(jsonObject, 'back');
    // let wsPointData = getSensorFrameChannelValue(jsonObject, 'back');
    this.cacheSingleGloveFrame(jsonObject);
    // if (!Array.isArray(wsPointData)) {
    //   wsPointData = JSON.parse(wsPointData);
    // }
    // let sitFlag;
    // console.log('ws1Data')

    if (jsonObject.sitFlag != null) {
      sitFlag = jsonObject.sitFlag;
    }

    if (backFrameData) {
      if (this.state.matrixName === SINGLE_GLOVE_MATRIX && !this.state.hand) {
        this.syncSingleGloveRawPressureStats(getRawPressurePayload(jsonObject, 'back'));
      }
      // 右手（backData 路径）统计真实采样频率
      if (this.state.matrixName.includes('hand') || this.state.matrixName == 'handGlove115200') {
        realHzFrameCount++;
        const nowHz = Date.now();
        if (nowHz - realHzLastTime >= 1000) {
          const realHz = Math.round(realHzFrameCount * 1000 / (nowHz - realHzLastTime));
          if (this.state.realHz !== realHz) {
            this.setState({ realHz: realHz });
          }
          realHzFrameCount = 0;
          realHzLastTime = nowHz;
        }
      }

      // 这里原来还有第二个计数器（`isCar(matrixName) && !sitFlag` 时 `changeNum(num)`，
      // 显示的是帧数、没有 `/12*hz`），走靠背通道。它和上面坐垫那个写的是**同一个**
      // `changeNum` 槽位，改成定时器计时后两者会互相盖写，所以一并删掉：
      // 这个数字现在全局统一由 `startCollectionTimer` 的秒表驱动。
      wsPointDataBack = backFrameData;
      // console.log(wsPointDataBack)
      if (!Array.isArray(wsPointDataBack)) {
        wsPointDataBack = JSON.parse(wsPointDataBack);
      }

      this.updateGloveExhibitionFrame(jsonObject, 'back', wsPointDataBack);

      if (
        !isGloveExhibitionMode(this.state.numMatrixFlag) && this.state.matrixName !== "bigBed" &&
        this.state.matrixName !== "foot" &&
        this.state.matrixName !== "handGloveFullPacket" &&
        this.state.matrixName !== HAND_0205_DOUBLE_MATRIX
      ) {
        backTypeEvent[this.state.matrixName]({
          that: this,
          jsonObject,
          sitFlag,
          state: this.state.carState,
          local: this.state.local,
          wsPointDataBackZero: wsPointDataBackZero
        });
      }
    }

    const backMappedPressurePayload = getMappedPressurePayload(jsonObject, this.state.matrixName)
    if (backFrameData && !isGloveExhibitionMode(this.state.numMatrixFlag) &&
      backMappedPressurePayload != null &&
      (['robot1', 'footVideo'].includes(this.state.matrixName) || this.state.matrixName.includes('hand') || this.state.matrixName == 'Num3D')) {

      const that = this
      let wsPointData = parsePressurePayload(backMappedPressurePayload);
      let rotate = jsonObject.rotate;

      // [fix] robot 已在块1处理，块2 不再重复处理
      if (this.state.matrixName.includes('robot')) {
        // 跳过 robot
      } else if (this.state.matrixName == 'footVideo') {
        // footVideo 已在块1 backTypeEvent 中处理，跳过
      } else if ((!this.state.hand || isDualGloveDisplay(this.state.matrixName, this.state.numMatrixFlag)) && this.state.matrixName.includes('hand')) {


        if (this.state.matrixName == 'Num3D') {
          // let newArr = [...wsPointData]
          // if (that.state.showType == 'finger') {
          //   that.com.current?.changeWsData(newArr);
          // } else {

          // }

          // let wsPointData = jsonObject.newArr147;
          let newArr = [...wsPointData]
          if (this.state.showType == 'hand') {
            this.com.current?.changeWsData147([...newArr])
          }


          newArr.splice(5 * 15, 0, 0);
          newArr.splice(5 * 15, 0, 0);
          newArr.splice(5 * 15, 0, 0);

          if (this.state.showType == 'finger') {
            this.com.current?.changeWsDatafinger(newArr)
          } else if (this.state.showType == 'palm') {
            this.com.current?.changeWsDatapalm(newArr)
          }

        }
        else {
          if (isTactileGloveMappedLength(this.state.matrixName, wsPointData.length)) {
            if (this.state.numMatrixFlag == 'normal') {
              // 弯指必须基于未清零数据：清零后指根静息值归零，与校准基准对不上，弯曲会恒为 0
              const bendSourceRaw = parseMaybeJsonPayload(jsonObject.newArr147Raw, null)
              const bendSource = Array.isArray(bendSourceRaw) && bendSourceRaw.length >= 75 ? bendSourceRaw : wsPointData
              let arr = []
              if (jsonObject.newArr != null) {
                for (let i = 0; i < 5; i++) {
                  let num = 0
                  for (let j = 0; j < 3; j++) {
                    const index = j * 10 + i * 2
                    num += bendSource[index]
                    num += bendSource[index + 1]
                  }
                  arr[i] = num
                }
                wsPointData = [...arr].reverse()
              } else {
                for (let i = 0; i < 5; i++) {
                  let num = 0
                  // for (let j = 0; j < 3; j++) {
                  const j = 4
                  const index = j * 15 + i * 3
                  num += bendSource[index]
                  num += bendSource[index + 1]
                  num += bendSource[index + 2]
                  // }
                  arr[i] = num
                }
                wsPointData = [...arr]


              }



              const isDoubleGlove = isDualGloveDisplay(this.state.matrixName, 'normal')
              const isRightPayload = isDoubleGlove ? isRightHandPayload(jsonObject, true) : this.state.matrixName === SINGLE_GLOVE_MATRIX ? true : !!backFlag
              const com = isDoubleGlove
                ? {
                  changeHandAngle: that.com.current?.changeRightHandAngle,
                  calibration: that.com.current?.calibrationRight,
                }
                : this.state.matrixName == 'hand0507' ? that.com.current?.handL : that.com.current
              const writeHandData = isDoubleGlove ? that.com.current?.rightData : that.com.current?.sitData

              wsPointDataSit = wsPointData;
              wsPointDataSit = wsPointDataSit.map((a) => Math.round(a));
              wsPointDataSitWidth = 32;
              const currentFingerPoints = updateLatestFingerPoints(wsPointDataSit, isRightPayload)
              const rawBackData = getRawPressurePayload(jsonObject, 'back');
              this.syncGloveRawPressureStats(rawBackData);
              const currentFingerCalibration = isDoubleGlove || this.state.matrixName === SINGLE_GLOVE_MATRIX
                ? (isRightPayload ? fingerArrR : fingerArrL)
                : fingerArr

              if (that.state.numMatrixFlag == "normal") {

                if (this.state.matrixName != 'handVideo1') {
                  const renderData = this.state.matrixName === 'handGloveFullPacket'
                    ? parsePressurePayload(backFrameData)
                    : wsPointData;
                  writeHandData?.({
                    wsPointData: renderData ? renderData : [],
                    statsData: this.parseGloveRawMatrix(rawBackData) || undefined,
                    local: that.state.local
                  });
                } else {
                  writeHandData?.({
                    local: that.state.local
                  });
                }


              } else if (that.state.numMatrixFlag == "heatmap") {
                that.com.current?.bthClickHandle(wsPointData);
              }


              if (!that.state.calibration) {
                //  z 
                if (rotate && Array.isArray(rotate) && rotate.length >= 4 && !rotate.some(v => v == null || isNaN(v))) {
                  let arr = [-rotate[0], rotate[1], rotate[2], rotate[3]]
                  // 过滤四元数绝对值超过1的异常数据
                  if (!arr.some(v => Math.abs(v) > 1)) {
                    com?.changeHandAngle(arr)
                  }
                }

                if (currentFingerCalibration) {
                  if (!currentFingerCalibration[0] || !Array.isArray(currentFingerCalibration[0])) {
                    currentFingerCalibration[0] = new Array(5).fill(0)
                  }
                  if (!currentFingerCalibration[1] || !Array.isArray(currentFingerCalibration[1])) {
                    currentFingerCalibration[1] = new Array(5).fill(255)
                  }
                  const baseArr = []
                  for (let i = 0; i < 5; i++) {
                    baseArr.push((currentFingerCalibration[1][i] || 0) - (currentFingerCalibration[0][i] || 0))
                  }


                  for (let i = 0; i < 5; i++) {
                    const rawValue = currentFingerPoints[i]
                    if (rawValue == null || isNaN(rawValue)) continue;
                    const numberValue = Math.round((rawValue - (currentFingerCalibration[0][i] || 0)) / (baseArr[i] ? baseArr[i] : 1) * 100) / 100
                    const value = (numberValue) < 0 ? 0 : (numberValue) >= 1 ? 1 : (numberValue)

                    const bendArr = isDoubleGlove ? rightHandNewArr : newArr
                    bendArr[i] = bendArr[i] + (value - bendArr[i]) / 3
                  }

                  com?.calibration(isDoubleGlove ? rightHandNewArr : newArr)
                }
              } else {

                // that.com.current?.calibration([0,0,0])
                // that.com.current?.handZero()
                // that.com.current?.calibration([0,0,0])
              }
            } else if (this.state.numMatrixFlag == 'numoriginal' && tactileGloveTypes.includes(this.state.matrixName)) {
              // 手套原始数据模式：back 路为右手，渲染到右手画布
              let newArr = [...wsPointData]
              this.com.current?.changeWsData147([...newArr], 'right')
            } else if (this.state.numMatrixFlag == 'num' && tactileGloveTypes.includes(this.state.matrixName)) {
              if (this.state.matrixName === 'handGloveFullPacket') {
                const rawData = this.parseGloveRawMatrix(getRawPressurePayload(jsonObject, 'back'));
                if (rawData) {
                  this.com.current?.changeWsData256([...rawData], 'right')
                }
              } else {
                // 手套2D数字模式：旧手套使用 realArr（原始256字节）渲染16x16矩阵
                let rawData = getRawPressurePayload(jsonObject, 'back');
                if (rawData && !Array.isArray(rawData)) {
                  rawData = JSON.parse(rawData);
                }
                if (rawData && rawData.length >= 256) {
                  this.com.current?.changeWsData256([...rawData.slice(0, 256)], 'right')
                } else {
                  this.com.current?.changeWsData147([...wsPointData], 'right')
                }
              }
            } else if (this.state.numMatrixFlag == 'num3D' && tactileGloveTypes.includes(this.state.matrixName)) {
              // 手套3D数字模式：使用映射数据，跟之前一样
              let newArr = [...wsPointData]
              this.com.current?.changeWsData147([...newArr])
            } else if (this.state.numMatrixFlag.includes('num')) {
              let newArr = [...wsPointData]
              this.com.current?.changeWsData147([...newArr])
            } else if (this.state.numMatrixFlag == 'skin') {

              let newArr = [...wsPointData]
              wsPointData = handSkinChange(wsPointData)
              that.com.current?.sitData({
                wsPointData: wsPointData,
                newArr: newArr,
                local: that.state.local
              });
            }
          } else {
            const rotate = wsPointData.splice(wsPointData.length - 4, wsPointData.length)
            if (this.state.numMatrixFlag == 'normal') {
              let arr = []
              if (jsonObject.newArr != null) {
                for (let i = 0; i < 5; i++) {
                  let num = 0
                  for (let j = 0; j < 3; j++) {
                    const index = j * 10 + i * 2
                    num += wsPointData[index]
                    num += wsPointData[index + 1]
                  }
                  arr[i] = num
                }
                wsPointData = [...arr].reverse()
              } else {
                for (let i = 0; i < 5; i++) {
                  let num = 0
                  // for (let j = 0; j < 3; j++) {
                  const j = 4
                  const index = j * 15 + i * 3
                  num += wsPointData[index]
                  num += wsPointData[index + 1]
                  num += wsPointData[index + 2]
                  // }
                  arr[i] = num
                }
                wsPointData = [...arr]


              }



              const isDoubleGlove = isDualGloveDisplay(this.state.matrixName, 'normal')
              const isRightPayload = isDoubleGlove ? isRightHandPayload(jsonObject, true) : this.state.matrixName === SINGLE_GLOVE_MATRIX ? true : !!backFlag
              const com = isDoubleGlove
                ? {
                  changeHandAngle: that.com.current?.changeRightHandAngle,
                  calibration: that.com.current?.calibrationRight,
                }
                : this.state.matrixName == 'hand0507' ? that.com.current?.handL : that.com.current
              const writeHandData = isDoubleGlove ? that.com.current?.rightData : that.com.current?.sitData
              wsPointDataSit = wsPointData;
              wsPointDataSit = wsPointDataSit.map((a) => Math.round(a));
              wsPointDataSitWidth = 32;
              const currentFingerPoints = updateLatestFingerPoints(wsPointDataSit, isRightPayload)
              const rawBackData = getRawPressurePayload(jsonObject, 'back');
              this.syncGloveRawPressureStats(rawBackData);
              const currentFingerCalibration = isDoubleGlove || this.state.matrixName === SINGLE_GLOVE_MATRIX
                ? (isRightPayload ? fingerArrR : fingerArrL)
                : fingerArr
              if (that.state.numMatrixFlag == "normal") {
                if (this.state.matrixName != 'handVideo1') {
                  writeHandData?.({
                    wsPointData: wsPointData ? wsPointData : [],
                    statsData: this.parseGloveRawMatrix(rawBackData) || undefined,
                    local: that.state.local
                  });
                } else {
                  writeHandData?.({
                    local: that.state.local
                  });
                }


              } else if (that.state.numMatrixFlag == "heatmap") {
                that.com.current?.bthClickHandle(wsPointData);
              }


              if (!that.state.calibration) {
                //  z 
                if (rotate && Array.isArray(rotate) && rotate.length >= 4 && !rotate.some(v => v == null || isNaN(v))) {
                  let arr = [-rotate[0], rotate[1], rotate[2], rotate[3]]
                  // 过滤四元数绝对值超过1的异常数据
                  if (!arr.some(v => Math.abs(v) > 1)) {
                    com?.changeHandAngle(arr)
                  }
                }

                if (currentFingerCalibration) {
                  if (!currentFingerCalibration[0] || !Array.isArray(currentFingerCalibration[0])) {
                    currentFingerCalibration[0] = new Array(5).fill(0)
                  }
                  if (!currentFingerCalibration[1] || !Array.isArray(currentFingerCalibration[1])) {
                    currentFingerCalibration[1] = new Array(5).fill(255)
                  }
                  const baseArr = []
                  for (let i = 0; i < 5; i++) {
                    baseArr.push((currentFingerCalibration[1][i] || 0) - (currentFingerCalibration[0][i] || 0))
                  }


                  for (let i = 0; i < 5; i++) {
                    const rawValue = currentFingerPoints[i]
                    if (rawValue == null || isNaN(rawValue)) continue;
                    const numberValue = Math.round((rawValue - (currentFingerCalibration[0][i] || 0)) / (baseArr[i] ? baseArr[i] : 1) * 100) / 100
                    const value = (numberValue) < 0 ? 0 : (numberValue) >= 1 ? 1 : (numberValue)

                    const bendArr = isDoubleGlove ? rightHandNewArr : newArr
                    bendArr[i] = bendArr[i] + (value - bendArr[i]) / 3
                  }

                  com?.calibration(isDoubleGlove ? rightHandNewArr : newArr)
                }
              } else {

                // that.com.current?.calibration([0,0,0])
                // that.com.current?.handZero()
                // that.com.current?.calibration([0,0,0])
              }
            } else if (this.state.numMatrixFlag == 'numoriginal' && tactileGloveTypes.includes(this.state.matrixName)) {
              // 手套原始数据模式：back 路为右手，渲染到右手画布
              let newArr = [...wsPointData]
              this.com.current?.changeWsData147([...newArr], 'right')
            } else if (this.state.numMatrixFlag == 'num' && tactileGloveTypes.includes(this.state.matrixName)) {
              if (this.state.matrixName === 'handGloveFullPacket') {
                const rawData = this.parseGloveRawMatrix(getRawPressurePayload(jsonObject, 'back'));
                if (rawData) {
                  this.com.current?.changeWsData256([...rawData], 'right')
                }
              } else {
                // 手套2D数字模式：旧手套使用 realArr（原始256字节）渲染16x16矩阵
                let rawData = getRawPressurePayload(jsonObject, 'back');
                if (rawData && !Array.isArray(rawData)) {
                  rawData = JSON.parse(rawData);
                }
                if (rawData && rawData.length >= 256) {
                  this.com.current?.changeWsData256([...rawData.slice(0, 256)], 'right')
                } else {
                  this.com.current?.changeWsData147([...wsPointData], 'right')
                }
              }
            } else if (this.state.numMatrixFlag == 'num3D' && tactileGloveTypes.includes(this.state.matrixName)) {
              // 手套3D数字模式：使用映射数据，跟之前一样
              let newArr = [...wsPointData]
              this.com.current?.changeWsData147([...newArr])
            } else if (this.state.numMatrixFlag.includes('num')) {
              let newArr = [...wsPointData]
              this.com.current?.changeWsData147([...newArr])
            } else if (this.state.numMatrixFlag == 'skin') {
              wsPointData = handSkinChange(wsPointData)
              that.com.current?.sitData({
                wsPointData: wsPointData,
                local: that.state.local
              });
            }
          }


        }
      } else {
        if (this.state.matrixName == 'footVideo') {
          if (this.state.numMatrixFlag.includes('num')) {
            let newArr = [...wsPointData]



            this.com.current?.changeWsData147R({ right: [...newArr] })
          }
        }
      }

    }

    if (jsonObject.timeArr != null) {
      // const arr = []

      const arr = jsonObject.timeArr; //.map((a, index) => a.date);

      let obj = [];
      arr.forEach((a, index) => {
        obj.push({
          value: a.info,
          label: translateDomainLabel(a.name, this.props.t),
        });
      });
      this.setState({ dataArr: obj });
    }

    if (jsonObject.length != null) {
      this.setState({
        length: jsonObject.length,
      });
    }
    if (jsonObject.time != null) {
      this.setState({
        time: jsonObject.time,
        timeArr: Array.isArray(jsonObject.time) ? jsonObject.time : [],
      });
    }

    if (jsonObject.historyTimeArr != null) {
      this.setState({
        historyTimeArr: Array.isArray(jsonObject.historyTimeArr)
          ? jsonObject.historyTimeArr
          : [],
      });
    }

    if (jsonObject.index != null) {
      this.progress.current?.changeIndex(jsonObject.index);
    }

    if (jsonObject.areaArr != null) {
      const max = findMax(jsonObject.areaArr);
      this.data.current?.handleChartsArea(jsonObject.areaArr, max + 100);
      this.max = max;
      this.areaArr = jsonObject.areaArr;
      this.setState({
        areaArr: jsonObject.areaArr,
      });
    }

    if (jsonObject.pressArr != null) {
      const max = findMax(jsonObject.pressArr);

      if (
        this.state.matrixName != 'foot'
      ) {
        this.data.current?.handleCharts(jsonObject.pressArr, max + 100);
        this.pressMax = max;
        this.pressArr = jsonObject.pressArr;
        this.setState({
          pressArr: jsonObject.pressArr,
        });
      }
    }
  };

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.portalSceneOnly !== this.props.portalSceneOnly) {
      this.syncPortalSceneOnly(Boolean(this.props.portalSceneOnly));
    }
    if (this.props.licenseAccess !== undefined && prevProps.licenseAccess !== this.props.licenseAccess) {
      const licenseAccess = readLicenseAccess({ licenseAccess: this.props.licenseAccess });
      const historyOnly = isHistoryOnlyLicense(licenseAccess);
      this.setState({ licenseAccess, ...(historyOnly ? { licenseModalVisible: false, licenseLockedVisible: false, colWebFlag: false, colOneFlag: false } : {}) });
      if (historyOnly && this._licenseModal) { this._licenseModal.destroy?.(); this._licenseModal = null; }
    }
    const systemChanged = prevState.matrixName !== this.state.matrixName || prevState.systemId !== this.state.systemId;
    if ((prevState.local && !this.state.local) || systemChanged) {
      this.data.current?.initCharts();
    }
    if (this.state.selectFlag && (prevState.matrixName !== this.state.matrixName
      || prevState.numMatrixFlag !== this.state.numMatrixFlag || prevState.history !== this.state.history)) {
      // 新场景已挂载，不能用旧框选命令去开启新场景的选区。
      this.setState({ selectFlag: false, width: 0, height: 0 });
      this.sitIndexArr = new Array(4).fill(0);
      this.backIndexArr = new Array(4).fill(0);
      this.handIndexArr = new Array(4).fill(0);
    }
    if ((prevState.matrixName === this.state.matrixName && prevState.numMatrixFlag !== this.state.numMatrixFlag)
      || (!prevState.local && this.state.local)) {
      this.props.onPortalDataView?.();
    }
    // 换展示形式时丢掉总线上的末帧。不丢的话，下一个渲染器挂上来会先收到
    // 一帧属于上一台设备的数据（订阅时的补发），画出一帧错的东西。
    if (systemChanged) {
      clearLastFrame();
      this.props.onPortalSystemChange?.(this.state.systemId || this.state.matrixName);
    }
    const jqbedReturnedSourceChanged =
      prevState.matrixName !== this.state.matrixName ||
      prevState.history !== this.state.history ||
      prevState.local !== this.state.local ||
      prevState.wsConnected !== this.state.wsConnected ||
      prevState.wsConnectionEpoch !== this.state.wsConnectionEpoch ||
      (Array.isArray(prevState.allowedTypes) ? prevState.allowedTypes.includes('jqbed') : true) !==
        (Array.isArray(this.state.allowedTypes) ? this.state.allowedTypes.includes('jqbed') : true);
    if (jqbedReturnedSourceChanged) {
      this.jqbedAlarmSpeechState?.reset();
      this.jqbedAlarmSpeechSource = this.state.matrixName;
      this.jqbedAlgorithmLogRequestId = null;
      this.jqbedAlgorithmLogRequested = false;
      if (this.state.jqbedReturnedSettings != null || this.state.jqbedAlgorithmLogFrame != null ||
        this.state.jqbedAlgorithmLogSubscription != null) {
        this.setState({ jqbedReturnedSettings: null, jqbedAlgorithmLogFrame: null, jqbedAlgorithmLogSubscription: null });
      }
    }
    if (['waiting', 'error'].includes(this.state.jqbedAlgorithmStatus?.state)) {
      this.jqbedAlarmSpeechState?.reset();
    }

    const singleGloveSourceChanged =
      prevState.matrixName !== this.state.matrixName ||
      prevState.systemId !== this.state.systemId ||
      prevState.local !== this.state.local ||
      prevState.dataTime !== this.state.dataTime ||
      (prevState.colFlag === true && this.state.colFlag === false);
    if (singleGloveSourceChanged) {
      this.resetSingleGloveFrameCache();
      if (this.state.calibration && this.state.numMatrixFlag === 'gloveMotion') {
        this.setState({ calibration: false });
      }
    }
    if (isGloveExhibitionMode(this.state.numMatrixFlag) && prevState.numMatrixFlag !== this.state.numMatrixFlag) {
      Object.values(this.gloveExhibitionFrames || {}).forEach((frame) => this.com.current?.updateFrame?.(frame));
      if (this.state.matrixName !== SINGLE_GLOVE_MATRIX) {
        const primary = this.gloveExhibitionFrames?.left || this.gloveExhibitionFrames?.right;
        if (primary?.statsPressure) this.syncGloveRawPressureStats(primary.statsPressure);
      }
    }
    if (this.state.matrixName === SINGLE_GLOVE_MATRIX && (
      singleGloveSourceChanged || prevState.hand !== this.state.hand || prevState.numMatrixFlag !== this.state.numMatrixFlag
    )) {
      this.com.current?.changeModal?.(this.state.hand);
      this.replaySelectedSingleGloveFrame();
    }


    if (
      this.state.matrixName === WHOLE_CHAIR_MATRIX &&
      this.state.numMatrixFlag !== "normal"
    ) {
      const nextMode = getDefaultModeForMatrix(this.state.matrixName, this.state.numMatrixFlag);
      this.setState({
        numMatrixFlag: nextMode,
        ...getConfig({ sensorType: this.state.matrixName, mode: nextMode }),
      });
      return;
    }

    if (
      this.state.matrixName === FULL_PACKET_GLOVE_MATRIX &&
      !FULL_PACKET_GLOVE_MODES.includes(this.state.numMatrixFlag)
    ) {
      const nextMode = getDefaultModeForMatrix(this.state.matrixName, this.state.numMatrixFlag);
      this.setState({
        numMatrixFlag: nextMode,
        ...getConfig({ sensorType: this.state.matrixName, mode: nextMode }),
      });
      return;
    }

    const rendererConfigChanged =
      prevState.matrixName !== this.state.matrixName ||
      prevState.numMatrixFlag !== this.state.numMatrixFlag ||
      prevState.valueg1 !== this.state.valueg1 ||
      prevState.valuej1 !== this.state.valuej1 ||
      prevState.valuel1 !== this.state.valuel1 ||
      prevState.valuef1 !== this.state.valuef1 ||
      prevState.value1 !== this.state.value1 ||
      prevState.valuelInit1 !== this.state.valuelInit1;

    if (rendererConfigChanged || (this.state.numMatrixFlag === 'gloveTerrain' && singleGloveSourceChanged)) {
      this.syncDisplayRendererConfig();
    }

    // 换展示系统就换一套画布偏好，否则上一个系统选的配色会跟着带过来。
    if (systemChanged) {
      const cards = seedFormulaChartsFromManifest(this.state.matrixName);
      this.setState({
        displaySelection: readDisplayCanvasSelection(this.state.matrixName),
        chartWidgetIds: listFormulaChartTemplateIds(
          this.state.matrixName,
          FORMULA_CHART_TEMPLATES,
          cards,
        ),
        chartCards: cards,
      });
    }
  }

  /**
   * 拖一张图表卡片到页面上。
   *
   * 图表清单不在 `displaySelection` 里（那是画布和曲线外观的键），而在
   * `shroom.formulaCharts.v1.<matrixName>`，所以这里走 store 而不是
   * `persistDisplaySelection`；`Aside` 自己订阅 store，不需要再传 props 下去。
   *
   * @param {{id: string}} part 图表卡片零件。
   * @returns {void}
   */
  addChartWidget = (part) => {
    const template = FORMULA_CHART_TEMPLATES.find((item) => item.id === part?.id);
    if (!template) return;
    const result = addFormulaChartFromTemplate(this.state.matrixName, template);
    if (result.ok) return;
    // 加是幂等的：再拖一次不当成删除 —— 用户可能已经改过这张图的公式，
    // 静默毁掉他的编辑比"什么都没发生"糟得多。
    if (result.reason === 'exists') {
      message.info(`“${template.name}”已经在侧栏了`);
      return;
    }
    if (result.reason === 'limit') {
      message.warning(`最多同时显示 ${FORMULA_CHART_LIMIT} 张公式图表`);
    }
  };

  /**
   * 把图表卡片拖回零件栏 = 删除它。
   *
   * @param {string} id 图表 id。
   * @returns {void}
   */
  removeChartWidget = (id) => {
    removeFormulaChart(this.state.matrixName, id);
  };

  /**
   * store 里的图表清单变了，重算零件方块的高亮。
   *
   * @param {string} matrixName 发生变化的展示系统。
   * @param {object[]} definitions 新的图表清单。
   * @returns {void}
   */
  handleFormulaChartsChanged = (matrixName, definitions) => {
    if (formulaChartStorageKey(matrixName) !== formulaChartStorageKey(this.state.matrixName)) return;
    this.setState({
      chartWidgetIds: listFormulaChartTemplateIds(matrixName, FORMULA_CHART_TEMPLATES, definitions),
      chartCards: Array.isArray(definitions) ? definitions : [],
    });
  };

  /**
   * 保存画布配置（零件栏拖放的落点）。
   *
   * 写的是 ManifestDisplayRenderer 用的那个键，所以配置器页面和主界面
   * 看到的是同一份偏好。老展示系统按 `definition.type` 各存各的。
   *
   * @param {object} canvas 新的画布配置。
   * @returns {void}
   */
  updateDisplayCanvas = (canvas) => {
    this.persistDisplaySelection({ canvas });
  };

  /**
   * 保存侧栏压力曲线的外观偏好。
   *
   * 和画布配置分开存（`selection.charts` 对 `selection.canvas`），换画布配色
   * 不会顺手把曲线也换掉，两块表面各记各的。
   *
   * @param {object} charts 新的图表外观。
   * @returns {void}
   */
  updateChartAppearance = (charts) => {
    this.persistDisplaySelection({ charts });
  };

  /**
   * 把偏好合并进 state 并落盘。两块表面共用这一条通路，
   * 存储键的算法只有一处。
   *
   * @param {object} patch 要合并的偏好字段。
   * @param {{replace?: boolean}} [options] `replace` 时整份替换而不是合并 ——
   *        撤销要的是"删掉 canvas / charts 两个字段"，合并做不到删。
   * @returns {void}
   */
  persistDisplaySelection = (patch, options = {}) => {
    const { matrixName } = this.state;
    const nextSelection = options.replace
      ? { ...patch }
      : { ...this.state.displaySelection, ...patch };
    this.setState({ displaySelection: nextSelection });
    writeDisplaySelection(
      getDisplayProfileId(getDisplayDefinition(matrixName), matrixName),
      nextSelection,
    );
  };

  /**
   * 撤销：把外观和图表卡片一起退回基线。
   *
   * 基线 = 展示系统 manifest 里声明的那份（没声明就是内置默认值），
   * 不是"出厂设置" —— 保存过一次之后，基线就是刚保存的样子。
   *
   * 弹确认框而不是直接撤：一键全撤很彻底，但用户可能辛苦建了几张公式图表，
   * 所以把会丢的东西逐条列出来，让他自己决定。
   *
   * @param {{changes: Array<{label: string}>}} draft 草稿状态，来自 `describeDisplayDraft`。
   * @returns {void}
   */
  revertDisplayDraft = (draft) => {
    if (!draft?.changes?.length) return;
    Modal.confirm({
      title: '撤销未保存的改动？',
      okText: '撤销',
      cancelText: '再想想',
      content: (
        <div>
          <p>会做这几件事：</p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {draft.changes.map((change) => <li key={change.label}>{change.label}</li>)}
          </ul>
        </div>
      ),
      onOk: () => {
        const { matrixName } = this.state;
        // 只删 canvas / charts 两个字段。整键删掉会把 profileId / rendererId /
        // algorithmId 一起带走 —— 那是"我在看哪个模式"，撤销不该把视图也切走。
        this.persistDisplaySelection(
          clearDisplayDraftSelection(this.state.displaySelection),
          { replace: true },
        );
        resetFormulaCharts(matrixName, getDisplayDefinition(matrixName)?.page?.chartCards);
      },
    });
  };

  /**
   * 把草稿层落回这个展示系统自己的 `display-system.json`（保存）。
   *
   * **保存 = 写基线 + 清草稿。** 少了后半步，草稿层会一直盖在新基线上面，
   * 状态带就永远显示"有未保存的改动"。
   *
   * 失败时**绝不清草稿** —— 后端没开着的时候清掉，用户拖了半天的东西就凭空
   * 没了，这比保存失败本身严重得多。
   *
   * @param {object} payload `buildDisplaySectionPayload` 的结果。
   * @returns {Promise<void>} 落盘完成。
   */
  saveDisplayDraft = async (payload) => {
    const { matrixName } = this.state;
    const displaySystemId = getDisplayDefinition(matrixName)?.displaySystemId;
    if (!displaySystemId) return;
    try {
      const result = await saveDisplaySection(displaySystemId, payload);
      // 先把新基线注册进去，再清草稿 —— 顺序反了的话中间那一帧会拿旧基线
      // 配空草稿，界面会闪一下回到保存前的样子。
      if (result?.displaySystem?.runtimeDefinition) {
        registerRuntimeDisplayDefinition(result.displaySystem.runtimeDefinition);
      }
      this.persistDisplaySelection(
        clearDisplayDraftSelection(this.state.displaySelection),
        { replace: true },
      );
      resetFormulaCharts(matrixName, getDisplayDefinition(matrixName)?.page?.chartCards);
      message.success('已保存到展示系统目录，这就是新的基线');
    } catch (error) {
      message.error(
        error?.code === 'DISPLAY_SYSTEM_READ_ONLY'
          ? '这是软件自带的展示系统，改不了它本身，请用「另存为」建一份自己的'
          : `保存失败：${error?.message || error}`,
      );
    }
  };

  /**
   * 另存为：把整个展示系统目录复制一份，把当前外观写进新的那份。
   *
   * 这是自带展示系统唯一的保存出路。成功后**留在原地只提示**，不切展示系统 ——
   * 现场正在采数据时突然切走会中断串口和采集。
   *
   * @param {object} payload `buildDisplaySectionPayload` 的结果。
   * @returns {void}
   */
  saveDisplayDraftAs = (payload) => {
    const definition = getDisplayDefinition(this.state.matrixName);
    const sourceId = definition?.displaySystemId;
    if (!sourceId) return;
    // 名字用户改，id 从源 id 派生 —— 名字可以是中文，id 要落成文件夹名。
    let name = `${definition.label || sourceId} 副本`;
    Modal.confirm({
      title: '另存为新的展示模块',
      okText: '另存为',
      cancelText: '取消',
      content: (
        <div>
          <p style={{ margin: '0 0 8px' }}>
            会把整个展示系统文件夹复制一份，把当前外观写进新的那份。
            原来那份不受影响，当前测量也不会中断。
          </p>
          <Input
            defaultValue={name}
            maxLength={40}
            onChange={(event) => { name = event.target.value; }}
          />
        </div>
      ),
      onOk: () => this.duplicateCurrentDisplaySystem(sourceId, name, payload),
    });
  };

  /**
   * 执行另存为的请求。id 在已加载的展示系统里避重，撞上了就加后缀。
   *
   * @param {string} sourceId 源展示系统 id。
   * @param {string} name 新模块的名字。
   * @param {object} payload `buildDisplaySectionPayload` 的结果。
   * @returns {Promise<void>} 请求完成。
   */
  duplicateCurrentDisplaySystem = async (sourceId, name, payload) => {
    const taken = new Set(
      listRuntimeDisplayDefinitions().map((item) => item.displaySystemId).filter(Boolean),
    );
    let id = `${sourceId}-copy`;
    for (let index = 2; taken.has(id); index += 1) id = `${sourceId}-copy-${index}`;
    try {
      const result = await duplicateDisplaySystem(sourceId, {
        id,
        name: String(name || '').trim(),
        ...payload,
      });
      if (result?.displaySystem?.runtimeDefinition) {
        registerRuntimeDisplayDefinition(result.displaySystem.runtimeDefinition);
      }
      // 顶部传感器菜单在听这个事件，收到就重新拉一次清单，新模块立刻出现在里面。
      window.dispatchEvent(new CustomEvent('shroom-display-systems-updated'));
      message.success(`已另存为「${result?.manifest?.name || name}」，可在顶部传感器菜单里切换过去`);
    } catch (error) {
      message.error(
        error?.code === 'DISPLAY_SYSTEM_EXISTS'
          ? `目录里已经有一个叫 ${id} 的展示系统了，先把它改名或删掉再试`
          : `另存为失败：${error?.message || error}`,
      );
      // 抛回去让确认框留在原地，用户改个名字就能重试，不用从头再点一遍。
      throw error;
    }
  };

  ws2Data = (e, decodedMessage = null) => {
    const jsonObject = decodedMessage || parseWebSocketEventPayload(e);
    if (!jsonObject) return;
    const headFrameData = getSensorFrameChannelValue(jsonObject, 'head');
    if (headFrameData) {
      let wsPointData = headFrameData
      wsPointDataHead = wsPointData;
      if (!Array.isArray(wsPointDataHead)) {
        wsPointDataHead = JSON.parse(wsPointDataHead);
      }

      // console.log(wsPointData , 'wsPointData')

      if (wsPointDataHeadZero.length) {
        wsPointDataHead = wsPointDataHead.map((a, index) => a - wsPointDataHeadZero[index] > 0 ? a - wsPointDataHeadZero[index] : 0)
      }

      headTypeEvent[this.state.matrixName]({
        that: this,
        wsPointData: wsPointDataHead,
        sitFlag,
        backFlag,
        state: this.state.carState,
        local: this.state.local,
        wsPointDataHeadZero: wsPointDataHeadZero
      });

      // const selectArr = [];
      // // console.log(that.backIndexArr,that.sitIndexArr)
      // for (let i = that.headIndexArr[0]; i <= that.headIndexArr[1]; i++) {
      //   for (
      //     let j = 31 - that.headIndexArr[3];
      //     j <= 31 - that.headIndexArr[2];
      //     j++
      //   ) {
      //     selectArr.push(wsPointData[i * 32 + j]);
      //   }
      // }

      // let DataArr;
      // if (
      //   that.headIndexArr.every((a) => a == 0)
      // ) {
      //   DataArr = [...wsPointData];
      // } else {
      //   DataArr = [...selectArr];
      // }


      // this.com.current?.headData({
      //   wsPointData: wsPointDataHead,
      // });
    }

  }

  searchName(arr, name) {
    // console.log(arr,name)
    // arr.forEach((a,index) => {
    //   if(a == name || a.split('|').includes(name)){
    //     // console.log('yes')
    //     return a.split('|')[1]
    //   }
    // })
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] == name || arr[i].split('|').includes(name)) {
        // console.log('yes')
        return arr[i].split('|')[1]
      }
    }
    return false
  }

  wsSendObj = (obj) => {
    if ((obj?.flag === true && !canUseLicenseCapability(this.state.licenseAccess, 'canAcquire'))
      || (obj?.download && !canUseLicenseCapability(this.state.licenseAccess, 'canExport'))) {
      message.warning('当前授权仅允许查看和分析历史数据，不能采集或导出。');
      return Promise.resolve([]);
    }
    if (obj?.file) obj = { ...obj, file: selectedNativeSystemId(obj.file) };
    const isJqbedAlgorithmCommand = Boolean(
      obj?.getJqbedAlgorithmConfig
      || obj?.setJqbedAlgorithmConfig
      || obj?.resetJqbedAlgorithmConfig
      || typeof obj?.subscribeJqbedAlgorithmLog === 'boolean'
    );
    if (isJqbedAlgorithmCommand) {
      const state = ws ? ws.readyState : 'no ws';
      const sent = sendWebSocketJson(ws, obj);
      if (typeof obj.subscribeJqbedAlgorithmLog === 'boolean') {
        this.jqbedAlgorithmLogRequestId = obj.requestId || null;
        this.jqbedAlgorithmLogRequested = sent && obj.subscribeJqbedAlgorithmLog;
        this.setState({ jqbedAlgorithmLogFrame: null, jqbedAlgorithmLogSubscription: null });
      }
      if (!sent) {
        console.warn(`[WS Send] 无法发送， ws.readyState=${state}`, obj);
      }
      return sent;
    }

    return commandClient.executeLegacyControl(obj).catch((error) => {
      console.warn('[command] control request failed', error, obj);
      if (Object.keys(obj || {}).some((key) => /^(serialReset|.*Port|.*Close)$/.test(key))) {
        serialFeedback.error(error);
      }
      return [];
    });
  };

  /** 原生副本等待服务端许可与采集状态检查；拒绝时保留当前页面和端口。 */
  changeMatrix = async (e) => {
    const nativeSwitch = Boolean(getNativeSystemTemplate(e) || getNativeSystemTemplate(this.state.systemId));
    if (nativeSwitch) {
      try { await commandClient.execute('sensor.switch', { sensorType: e }); }
      catch (error) { message.error(error.message || '系统切换失败，请停止采集并检查授权。'); return false; }
    }
    const nextMatrixName = normalizeDisplayMatrixName(e);
    const nextMode = getDefaultModeForMatrix(nextMatrixName, this.state.numMatrixFlag);
    const configObj = getConfig({ sensorType: nextMatrixName, mode: nextMode })
    const wasLocal = this.state.local;
    localStorage.setItem('file', e);

    // 1. 先停止回放，确保后端不再发送旧数据
    this.wsSendObj({ play: false });
    // 2. 关闭所有串口，确保切换前旧串口完全停止
    if (!nativeSwitch) this.wsSendObj({ sitClose: true, backClose: true, headClose: true, sensorClose: true });
    // 3. 再发送 file 切换，后端切换数据库并重置回放状态
    const smallBed12BDisplayOptions = getSmallBed12BDisplayOptions(
      this.state.smallBed12BRealtimeMatrixMode,
      this.state.smallBed12BRealtimeSamplePoint,
    );
    if (!nativeSwitch) this.wsSendObj(nextMatrixName === SMALL_BED_12B_MATRIX
      ? { file: nextMatrixName, smallBed12BDisplayOptions }
      : { file: nextMatrixName });
    else if (nextMatrixName === SMALL_BED_12B_MATRIX) this.wsSendObj({ smallBed12BDisplayOptions });

    // 4. 清空前端数据
    this.data.current?.changeData({ meanPres: 0, maxPres: 0, point: 0, area: 0, totalPres: 0, pressure: 0 });
    this.data.current?.initCharts();
    this.areaArr = null;
    this.pressArr = null;
    this.max = 0;
    this.pressMax = 0;

    // 5. 重置回放控件（播放状态 + 滑块位置）
    this.progress.current?.resetPlay();

    this.setState({
      matrixName: nextMatrixName,
      systemId: e,
      jqbedReturnedSettings: null,
      jqbedAlgorithmLogFrame: null,
      jqbedAlgorithmLogSubscription: null,
      numMatrixFlag: nextMode,
      ...configObj,
      dataArr: [],
      dataTime: '',
      areaArr: null,
      pressArr: null,
      playflag: false,
      portname: '',
      portnameBack: '',
      portnameHead: '',
      portnameSensor: '',
      minzhenSensorInfo: {},
      smallBedMatrixWidth: nextMatrixName === SMALL_BED_12B_MATRIX
        ? (smallBed12BDisplayOptions.matrixMode === '16x16' ? 16 : 32)
        : 32,
      smallBedMatrixHeight: nextMatrixName === SMALL_BED_12B_MATRIX
        ? (smallBed12BDisplayOptions.matrixMode === '16x16' ? 16 : 32)
        : 32,
    });

    // 6. 如果当前在回放模式，重新请求新 db 的时间列表
    if (wasLocal) {
      // 延迟发送，确保后端先处理 file 切换
      setTimeout(() => {
        this.wsSendObj({ local: true });
      }, 100);
    }
    // 网络版
    // if (e === 'yanfeng10') {
    //   ws.close()
    //   ws = new WebSocket("ws://sensor.bodyta.com:8888/bed/ec4d3e7ec6e5");

    //   ws.onopen = () => {
    //     // connection opened
    //     console.info("connect success");
    //     this.wsSendObj({
    //       file: this.state.matrixName,
    //       sitClose: true,
    //       backClose: true
    //     })
    //   };
    //   ws.onmessage = (e) => {
    //     // console.log(e)
    //     this.wsData(e);
    //   };
    //   ws.onerror = (e) => {
    //     // an error occurred
    //   };
    //   ws.onclose = (e) => {
    //     // connection closed
    //   };
    // }else{
    //   ws.close()
    //   ws = new WebSocket("ws://127.0.0.1:19999");
    //   ws.onopen = () => {
    //     // connection opened
    //     console.info("connect success");
    //     this.wsSendObj({
    //       file: this.state.matrixName,
    //       sitClose: true,
    //       backClose: true
    //     })
    //   };
    //   ws.onmessage = (e) => {
    //     this.wsData(e);
    //   };
    //   ws.onerror = (e) => {
    //     // an error occurred
    //   };
    //   ws.onclose = (e) => {
    //     // connection closed
    //   };

    // }
    wsMatrixName = e;
  };

  handleChartsBody(arr, max, index) {
    const canvas = document.getElementById("myChartBig");

    if (canvas && ctxbig) {
      this.drawChart({ ctx: ctxbig, arr, max, canvas, index });
    }
  }

  handleChartsBody1(arr, max, index) {
    const canvas = document.getElementById("myChartBig1");

    if (canvas && ctxbig1) {
      this.drawChart({ ctx: ctxbig1, arr, max, canvas, index });
    }
  }

  initBigCtx() {
    var c2 = document.getElementById("myChartBig");

    if (c2) ctxbig = c2.getContext("2d");

    var c1 = document.getElementById("myChartBig1");

    if (c1) ctxbig1 = c1.getContext("2d");
  }

  initCar() {
    var c2 = document.getElementById("myChartsit");

    if (c2) ctxsit = c2.getContext("2d");
    var c1 = document.getElementById("myChartback");

    if (c1) ctxback = c1.getContext("2d");
  }

  handleChartsSit(arr, max, index) {
    const canvas = document.getElementById("myChartsit");

    if (canvas && ctxsit) {
      this.drawChart({ ctx: ctxsit, arr, max, canvas });
    }
  }

  handleChartsBack(arr, max, index) {
    const canvas = document.getElementById("myChartback");

    if (canvas && ctxback) {
      this.drawChart({ ctx: ctxback, arr, max, canvas });
    }
  }

  drawChart({ ctx, arr, max, canvas, index }) {
    // 清空画布
    const data = arr.map((a) => (a * 150) / max);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 计算数据点之间的间距
    var gap = canvas.width / (data.length + 1);

    // 绘制曲线
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.moveTo(gap, canvas.height - data[0]);

    for (var i = 1; i < data.length - 2; i++) {
      var xMid = (gap * (i + 1) + gap * (i + 2)) / 2;
      var yMid =
        (canvas.height - data[i + 1] + canvas.height - data[i + 2]) / 2;
      ctx.quadraticCurveTo(
        gap * (i + 1),
        canvas.height - data[i + 1],
        xMid,
        yMid
      );
    }

    // 连接最后两个数据点
    ctx.quadraticCurveTo(
      gap * (data.length - 1),
      canvas.height - data[data.length - 1],
      gap * data.length,
      canvas.height - data[data.length - 1]
    );

    // 设置曲线样式
    ctx.strokeStyle = "#991BFA";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (index != null) {
      ctx.beginPath();
      ctx.moveTo(gap * index, canvas.height);
      ctx.lineTo(gap * index, 0);
      ctx.strokeStyle = "#01F1E3";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
    }
  }

  changeLocal = (value) => {
    this.setState({ local: value, jqbedReturnedSettings: null, jqbedAlgorithmLogFrame: null, jqbedAlgorithmLogSubscription: null });
    // changeDateArr(matrixName)

    this.wsSendObj(value ? { local: true } : { play: false, local: false, history: false });
  };

  // formatter = (value) => {

  //   return `${value}%`
  // };

  changeValue = (value) => {
    return value < 4 ? 0 : value >= 68 ? 31 : Math.round((value - 4) / 2 - 1);
  };

  changeFootValue = (value) => {
    return value < 4 ? 0 : value >= 36 ? 15 : Math.round((value - 4) / 2 - 1);
  };

  changeHeadXValue = (value) => {
    return value < 2 ? 0 : value >= 42 ? 10 : Math.round((value - 2) / 4 - 1);
  }

  changeHeadYValue = (value) => {
    return value < 2 ? 0 : value >= 30 ? 6 : Math.round((value - 2) / 4 - 1);
  }

  changeBedValue = (value) => {
    return value < 4
      ? 0
      : value >= 4 + 64 * 2
        ? 64 - 1
        : Math.round((value - 4) / 2 - 1);
  };

  changeSmallBedValue = (value) => {
    return value < 4
      ? 0
      : value >= 4 + 64 * 2
        ? 32 - 1
        : Math.round((value - 4) / 4 - 1);
  };

  changeSelect = (obj, type) => {
    if (!obj || !obj.sit) return;
    let sit = [...obj.sit];
    // console.log(sit)
    if (!sit.every((a) => a == 0) && (this.state.carState == "sit" || this.state.carState == "all")) {
      const sitIndex = sit.length
        ? sit.map((a, index) => {
          if (this.state.matrixName === "foot") {
            if (index == 0 || index == 1) {
              return this.changeFootValue(a);
            } else {
              return this.changeValue(a);
            }
          } else if (this.state.matrixName === "bigBed") {
            if (index == 0 || index == 1) {
              return this.changeBedValue(a);
            } else {
              return this.changeValue(a);
            }
          } else if (this.state.matrixName === "smallBed" || this.state.matrixName === SMALL_BED_NO_ALG_MATRIX || this.state.matrixName === "smallBed12B") {
            if (index == 0 || index == 1) {
              return this.changeSmallBedValue(a);
            } else {
              return this.changeValue(a);
            }
          } else {
            return this.changeValue(a);
          }
        })
        : new Array(4).fill(0);

      this.sitIndexArr = sitIndex;

      if (!sitIndex.every((a) => a == 0) && this.state.carState != "back") {
        // thrott(this.wsSendObj.bind(this, { sitIndex }))
        this.wsSendObj({ sitIndex });
      }

      const selectArr = [];
      for (let i = this.sitIndexArr[0]; i <= this.sitIndexArr[1]; i++) {
        for (let j = this.sitIndexArr[2]; j <= this.sitIndexArr[3]; j++) {
          selectArr.push(wsPointDataSit[i * wsPointDataSitWidth + j]);
        }
      }

      let DataArr;

      if (this.sitIndexArr.every((a) => a == 0)) {
        DataArr = [...wsPointDataSit];
      } else {
        DataArr = [...selectArr];
      }
      // DataArr = DataArr.map((a) => (a < 5 ? 0 : a));
      // 框选后或者无框选的数据
      const total = DataArr.reduce((a, b) => a + b, 0);
      const length = DataArr.filter((a, index) => a > 0).length;

      sitPoint = DataArr.filter((a) => a > 10).length;
      const sitTotalvalue = DataArr.reduce((a, b) => a + b, 0);
      sitMax = findMax(DataArr);
      sitArea = sitPoint;
      const sitPressure = carFitting(sitTotal / (sitPoint ? sitPoint : 1));
      // sitTotal = mmghToPress(sitPressure, sitArea)
      // sitTotal = totalToN(sitTotal)
      sitTotal = [...DataArr]
        .map((a) => pointToN(a))
        .reduce((a, b) => a + b, 0);
      sitMax = (sitMax / (sitTotalvalue ? sitTotalvalue : 1)) * sitTotal;
      sitMean = sitTotal / (sitPoint ? sitPoint : 1);

      this.data.current?.changeData({
        meanPres: sitMean.toFixed(2),
        maxPres: sitMax.toFixed(2),
        totalPres: sitTotal.toFixed(2),
        point: sitPoint,
        area: sitArea,
        pressure: sitPressure,
      });
    }

    if (
      obj.back &&
      !obj.back.every((a) => a == 0) &&
      (this.state.carState == "back" || this.state.carState == "all")
    ) {
      let back = [...obj.back];
      if (back.length) {
        // if(!this.state.matrixName == 'volvo'){
        //   back[2] = Math.round(back[2] / 2);
        //   back[3] = Math.round(back[3] / 2);
        // }else{
        back[2] = Math.round(back[2]);
        back[3] = Math.round(back[3]);
        // }

      }
      // console.log(obj.back)
      const backIndex = back.length
        ? back.map((a, index) => {
          if (this.state.matrixName === "foot") {
            if (index == 0 || index == 1) {
              return this.changeFootValue(a);
            } else {
              return this.changeValue(a);
            }
          } else {
            return this.changeValue(a);
          }
        })
        : new Array(4).fill(0);

      this.backIndexArr = backIndex;
      if (!backIndex.every((a) => a == 0) && this.state.carState != "sit") {
        // thrott1(this.wsSendObj.bind(this, { backIndex }))
        this.wsSendObj({ backIndex });
      }

      const selectArr = [];
      for (let i = this.backIndexArr[0]; i <= this.backIndexArr[1]; i++) {
        for (
          let j = 31 - this.backIndexArr[3];
          j <= 31 - this.backIndexArr[2];
          j++
        ) {
          selectArr.push(wsPointDataBack[i * 32 + j]);
        }
      }

      let DataArr;
      if (

        this.backIndexArr.every((a) => a == 0)
      ) {
        DataArr = [...wsPointDataBack];
      } else {
        DataArr = [...selectArr];
      }

      // DataArr = DataArr.map((a) => (a < 5 ? 0 : a));
      const backTotalvalue = DataArr.reduce((a, b) => a + b, 0);
      backTotal = DataArr.reduce((a, b) => a + b, 0);
      backPoint = DataArr.filter((a) => a > 10).length;
      // backMean = parseInt(backTotal / (backPoint ? backPoint : 1));
      backMax = findMax(DataArr);
      backArea = backPoint;
      const backPressure = carFitting(backTotal / (backPoint ? backPoint : 1));
      // backTotal = mmghToPress(backPressure, backArea)
      // backTotal = totalToN(backTotal, 1.3)
      // console.log(DataArr);
      backTotal = [...DataArr]
        .map((a) => pointToN(a))
        .reduce((a, b) => a + b, 0);
      backMax = (backMax / (backTotalvalue ? backTotalvalue : 1)) * backTotal;
      backMean = backTotal / (backPoint ? backPoint : 1);

      this.data.current?.changeData({
        meanPres: backMean.toFixed(2),
        maxPres: backMax.toFixed(2),
        totalPres: backTotal.toFixed(2),
        point: backPoint,
        area: backArea,
        pressure: backPressure,
      });
    }

    if (obj.head &&
      !obj.head.every((a) => a == 0) &&
      (this.state.carState == "head" || this.state.carState == "all")) {
      let head = [...obj.head];
      if (head.length) {

        head[2] = Math.round(head[2]);
        head[3] = Math.round(head[3]);


      }
      // console.log(obj.head)
      const headIndex = head.length
        ? head.map((a, index) => {

          if (index == 0 || index == 1) {
            return this.changeHeadXValue(a);
          } else {
            return this.changeHeadYValue(a);
          }


        })
        : new Array(4).fill(0);

      this.headIndexArr = headIndex;
      if (!headIndex.every((a) => a == 0) && this.state.carState != "sit") {
        // thrott1(this.wsSendObj.bind(this, { headIndex }))
        this.wsSendObj({ headIndex });
      }

      const selectArr = [];
      for (let i = this.headIndexArr[0]; i <= this.headIndexArr[1]; i++) {
        for (
          let j = 10 - this.headIndexArr[3];
          j <= 10 - this.headIndexArr[2];
          j++
        ) {
          selectArr.push(wsPointDataHead[i * 10 + j]);
        }
      }

      let DataArr;
      if (

        this.headIndexArr.every((a) => a == 0)
      ) {
        DataArr = [...wsPointDataHead];
      } else {
        DataArr = [...selectArr];
      }

      // DataArr = DataArr.map((a) => (a < 5 ? 0 : a));
      const headTotalvalue = DataArr.reduce((a, b) => a + b, 0);
      headTotal = DataArr.reduce((a, b) => a + b, 0);
      headPoint = DataArr.filter((a) => a > 10).length;
      // headMean = parseInt(headTotal / (headPoint ? headPoint : 1));
      headMax = findMax(DataArr);
      headArea = headPoint;
      const headPressure = carFitting(headTotal / (headPoint ? headPoint : 1));
      // headTotal = mmghToPress(headPressure, headArea)
      // headTotal = totalToN(headTotal, 1.3)
      // console.log(DataArr);
      headTotal = [...DataArr]
        .map((a) => pointToN(a))
        .reduce((a, b) => a + b, 0);
      headMax = (headMax / (headTotalvalue ? headTotalvalue : 1)) * headTotal;
      headMean = headTotal / (headPoint ? headPoint : 1);

      this.data.current?.changeData({
        meanPres: headMean.toFixed(2),
        maxPres: headMax.toFixed(2),
        totalPres: headTotal.toFixed(2),
        point: headPoint,
        area: headArea,
        pressure: headPressure,
      });
    }

  };

  changeStateData = (obj) => {
    this.setState((previousState) => {
      const sourceChanged = ['matrixName', 'history', 'local'].some((key) =>
        Object.prototype.hasOwnProperty.call(obj, key) && previousState[key] !== obj[key]);
      return { ...obj, ...(sourceChanged ? {
        jqbedReturnedSettings: null, jqbedAlgorithmLogFrame: null, jqbedAlgorithmLogSubscription: null,
      } : {}) };
    });
  };

  /** 小床纯点图临时切到现有3D视图，恢复界面时还原原显示模式。 */
  syncPortalSceneOnly = (enabled) => {
    if (this.state.matrixName !== SMALL_BED_NO_ALG_MATRIX) return;
    if (enabled) {
      this._portalPreviousMode = this.state.numMatrixFlag;
      if (this.state.selectFlag) this.changePortalSelection(false);
      this.title.current?.closePortalPanelsForScene?.();
      this.setState({ portalAlgorithmMarketOpen: false, displaySystemBuilderOpen: false, selectFlag: false,
        ...(this.state.numMatrixFlag !== 'normal' ? { numMatrixFlag: 'normal',
          ...getConfig({ sensorType: this.state.matrixName, mode: 'normal' }) } : {}) });
    } else {
      const previousMode = this._portalPreviousMode;
      this._portalPreviousMode = null;
      if (previousMode && previousMode !== this.state.numMatrixFlag) this.setState({ numMatrixFlag: previousMode,
        ...getConfig({ sensorType: this.state.matrixName, mode: previousMode }) });
    }
  };

  /** 手动采集开关起停本地秒表，宿主回执再由 applyCollectionSummary 校正。 */
  setColValueFlag = (value) => {
    this._collecting = value;
    if (value) {
      this.startCollectionTimer();
    } else {
      this.stopCollectionTimer();
    }
  };

  /** 后台中断/停止回执同步开关与秒表，恢复页面时沿用真实采集起止时间。 */
  applyCollectionSummary = (value) => {
    const collectionSummary = readCollectionSummary(value);
    if (!collectionSummary) return;
    this._collectionStatusEpoch = (this._collectionStatusEpoch || 0) + 1;
    const collecting = collectionSummary.phase === 'collecting';
    const previousId = this._collectionSessionId;
    this.setState({ collectionSummary, colFlag: !collecting });
    if (collecting) {
      if (!this._collecting || !this._collectionTimerId || (collectionSummary.id && previousId !== collectionSummary.id)) {
        this.startCollectionTimer(collectionSummary.startedAt);
      }
    } else {
      if (collectionSummary.startedAt) this._collectionStartedAt = collectionSummary.startedAt;
      this.stopCollectionTimer(collectionSummary.stoppedAt || collectionSummary.completedAt);
    }
    this._collectionSessionId = collectionSummary.id;
    this._collecting = collecting;
  };

  /** 门户退出先停止接收并等待尾帧保存；失败保留当前页面以便再次退出。 */
  preparePortalExit = async ({ signal } = {}) => {
    if (signal?.aborted) throw signal.reason || new DOMException('退出已取消', 'AbortError');
    if (this.state.matrixName === 'localCar') {
      await new Promise(resolve => this.setState({ colWebFlag: false }, resolve));
      this.setColValueFlag(false);
      return;
    }
    await finishCollectionBeforeExit({ signal, onSummary: this.applyCollectionSummary });
    this.setColValueFlag(false);
    this.setState({ colFlag: true });
  };

  /**
   * 用宿主起点驱动采集秒表，重进页面沿用已采时长。
   * ⚠️ 不能按渲染帧计时，否则高频串口加速秒表、无新帧时停表。
   * Title 会取 ceil，先取整秒避免定时器毫秒漂移导致跳秒。
   */
  startCollectionTimer = (startedAt = Date.now()) => {
    this.stopCollectionTimer();
    this._collectionStartedAt = startedAt;
    this.title.current?.changeNum(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    this._collectionTimerId = setInterval(() => {
      this.title.current?.changeNum(Math.max(0, Math.floor((Date.now() - this._collectionStartedAt) / 1000)));
    }, 1000);
  };

  /** 停止并保留最终时长，宿主提供 stoppedAt 时冻结在实际停止接收的时刻。 */
  stopCollectionTimer = (stoppedAt) => {
    const wasRunning = Boolean(this._collectionTimerId);
    if (this._collectionTimerId) {
      clearInterval(this._collectionTimerId);
      this._collectionTimerId = null;
    }
    if (Number.isFinite(this._collectionStartedAt) && (wasRunning || Number.isFinite(stoppedAt))) {
      this.title.current?.changeNum(Math.max(0, Math.floor(((stoppedAt ?? Date.now()) - this._collectionStartedAt) / 1000)));
    }
  };

  dataZero = () => {
    wsPointDataSitZero = [...wsPointDataSit]
    wsPointDataBackZero = [...wsPointDataBack]
    wsPointDataHeadZero = [...wsPointDataHead]
  }

  changeAside(obj) {
    this.data.current.changeData(obj)
  }

  dataZero0 = () => {
    wsPointDataSitZero = []
    wsPointDataBackZero = []
    wsPointDataHeadZero = []
  }

  changeCalibration() {
    this.setState({
      calibration: !this.state.calibration
    })
  }

  /** 用新的本侧校准基准重算末帧，不必等待下一份串口数据。 */
  refreshGloveExhibitionCalibration = (hand) => {
    const frame = this.gloveExhibitionFrames?.[hand];
    if (!frame?.fingerPoints) return;
    frame.fingers = getCalibratedGloveFingers(frame.fingerPoints, hand === 'right' ? fingerArrR : fingerArrL);
    if (this.state.numMatrixFlag === 'gloveMotion') this.com.current?.updateFrame?.(frame);
  };

  /** 分别保存左右手的平铺/握拳采样，立即更新炫酷摇操缓存的弯指结果。 */
  colFingerData(index, hand = 'left') {
    const key = hand === 'right' ? 'fingerArrR' : 'fingerArrL'
    const arr = readFingerCalibration(key)
    arr[index] = getLatestFingerPoints(hand)
    if (hand === 'right') {
      fingerArrR = arr
    } else {
      fingerArrL = arr
    }
    // 同步当前 fingerArr 指向
    fingerArr = backFlag ? fingerArrR : fingerArrL
    localStorage.setItem(key, JSON.stringify(arr))
    this.refreshGloveExhibitionCalibration(hand);
  }

  /** 清除两侧手指校准并恢复默认基准，同步刷新当前线网的末帧。 */
  clearFingerCalibration = () => {
    localStorage.removeItem('fingerArrL');
    localStorage.removeItem('fingerArrR');
    fingerArrL = createDefaultFingerCalibration();
    fingerArrR = createDefaultFingerCalibration();
    fingerArr = backFlag ? fingerArrR : fingerArrL;
    this.refreshGloveExhibitionCalibration('left');
    this.refreshGloveExhibitionCalibration('right');
  };

  /** 工具箱复用原生框选开关与统计索引，关闭时同步清掉旧选区。 */
  changePortalSelection = (enabled) => {
    const renderer = this.getActiveRendererRef().current;
    if (typeof renderer?.changeSelectFlag !== 'function') return;
    renderer.changeSelectFlag(!enabled, this.state.local);
    this.setState({ selectFlag: enabled, ...(!enabled ? { width: 0, height: 0 } : {}) });
    if (!enabled) {
      this.sitIndexArr = new Array(4).fill(0);
      this.backIndexArr = new Array(4).fill(0);
      this.handIndexArr = new Array(4).fill(0);
    }
  };

  /** 统一工具区读取当前展示系统的实例，避免生成系统仍调用旧原生画布。 */
  getActiveRendererRef = () => getDisplayDefinition(this.state.matrixName)?.source === 'manifest'
    ? this.manifestDisplay : this.com;

  render() {
    // rotate: "旋转",
    this.sceneVisibility.current = !this.props.externalScene;
    // boxSelection: '框选',
    // rotateX: "绕x轴旋转30°",
    // rotateY: "绕y轴旋转30°",
    // selectBox: "框选一个矩形区域"
    const { t, i18n } = this.props;
    const antdLocale = ANT_DESIGN_LOCALES[normalizeLanguage(i18n.language)];

    const text = t('rotate');
    const text2 = t('boxSelection');
    const textReset = t('reset')
    const modeCanvasMatrixName = `${this.state.matrixName}:${this.state.numMatrixFlag}`;
    const runtimeDisplayDefinition = getDisplayDefinition(this.state.matrixName)
    // 展示系统 manifest 声明了已注册的渲染器插件时走插件路径，否则为 null
    // 并回落到下面的既有场景分支。当前没有任何 manifest 声明插件渲染器，
    // 因此该值恒为 null，现网行为不变。
    const manifestRenderer = runtimeDisplayDefinition?.source === 'manifest'
      ? resolveRendererFromDefinition(runtimeDisplayDefinition)
      : null;
    // 沿用配置器的解析链及已有偏好；无 page 的旧系统使用 classic 默认配色。
    const canvasProfileModel = buildDisplayProfileModel(runtimeDisplayDefinition?.page);
    const canvasProfile = resolveDisplayProfile(canvasProfileModel, this.state.displaySelection);
    // 配色标识拆成两个 prop 是因为两类场景换色的代价不同：
    // - Fast1024 的颜色烘在数字精灵图里，只能整场重建 → 并进 variantKey；
    // - CanvasHand 逐帧算色 → 只需 colormapKey 放行一次 re-render，原地换色。
    // classic（= 改动前的样子）不进 key：没动过配色的展示系统拿到的
    // variantKey 与改动前逐字一致，重建时机一点没变。3D 场景的 classic 走各自
    // 原有的 jet，本来就没有 reverse 这一说，所以 reverse 也一并忽略。
    const canvasColormap = canvasProfile.colormap;
    const canvasColormapKey = isClassicColormap(canvasColormap)
      ? undefined
      : `${canvasColormap.id}${canvasColormap.reverse ? '|reverse' : ''}`;
    // 侧栏压力曲线的外观。图表和画布是两块表面，各自一个字段、互不影响。
    // 和画布同样是三层：manifest 的 chartAppearance 在下、用户偏好在上。
    const chartAppearance = resolveChartAppearance(canvasProfileModel, this.state.displaySelection);
    // Aside 外面那层 CanvasCom 的 shouldComponentUpdate 会拦掉 re-render，
    // 换了图表零件必须靠这个稳定字符串放行一次；它不进 childBaseKey，
    // 所以 Aside 不重挂 —— 它持有全部实时状态，重挂就等于清空侧栏读数。
    const chartAppearanceKey = [
      chartAppearance.colormap.id,
      chartAppearance.colormap.reverse ? 'reverse' : '',
      ...chartAppearance.overlays,
    ].filter(Boolean).join('|');
    const canvasVariantKey = [
      this.state.systemId,
      runtimeDisplayDefinition?.runtimeRevision,
      canvasColormapKey,
    ].filter(Boolean).join('|') || undefined;
    const gloveRendererData = this.state.matrixName === SINGLE_GLOVE_MATRIX
      ? this.getSingleGloveRendererDataRef()
      : this.data;
    const contentReset = (
      <div>
        <p>{t('resetContent')}</p>
      </div>
    );
    const content = (
      <div>
        <p>{t('rotateX')}</p>
      </div>
    );

    const content1 = (
      <div>
        <p>{t('rotateY')}</p>
      </div>
    );

    const content2 = (
      <div>
        <p>{t('selectBox')}</p>
      </div>
    );
    const colors = this.state.matrixName === 'volvo'
      ? rainbowTextColorsxy.slice(0, rainbowTextColorsxy.length - 7) //rainbowTextColors 
      : rainbowTextColorsxy.slice(0, rainbowTextColorsxy.length - 7)
    return (
      <ConfigProvider locale={antdLocale}>
        <div className={`home${this.props.portalEmbedded ? ' home-portal-embedded' : ''}`}>
          <RuntimeStatusNotice licenseAccess={this.state.licenseAccess} collectionSummary={this.state.collectionSummary} onRefreshLicense={() => this.wsSendObj({ refreshLicense: true })} />
          {this.state.matrixName != "robot0428" ? <div className="setIcons">
            {!this.props.portalEmbedded && <div className="setIconItem setIconItem1">
              <Popover placement="top" title={text} content={content}>
                <div
                  className="setIcon marginB10"
                  onClick={() => {
                    xvalue++;

                    // 脚型方向旋转
                    if (xvalue < 3) {
                      if (
                        this.com.current &&
                        this.com.current.changeGroupRotate
                      ) {
                        this.com.current?.changeGroupRotate({ x: xvalue });
                      }
                    } else {
                      xvalue = 0;
                      if (
                        this.com.current &&
                        this.com.current.changeGroupRotate
                      ) {
                        this.com.current?.changeGroupRotate({ x: xvalue });
                      }
                    }

                    localStorage.setItem('bedx', xvalue)
                    // 汽车方向旋转

                    if (xvalue < 3) {
                      if (
                        this.com.current &&
                        this.com.current.changePointRotation
                      ) {
                        this.com.current?.changePointRotation({
                          direction: "x",
                          value: xvalue,
                          type: this.state.carState,
                        });
                      }
                    } else {
                      xvalue = 0;
                      if (
                        this.com.current &&
                        this.com.current.changePointRotation
                      ) {
                        this.com.current?.changePointRotation({
                          direction: "x",
                          value: xvalue,
                          type: this.state.carState,
                        });
                      }
                    }
                  }}
                >
                  <img src={plus} alt="" />
                </div>
              </Popover>

              <Popover
                placement="top"
                title={text}
                content={content1}
              // arrow={mergedArrow}
              >
                <div
                  className="setIcon marginB10"
                  onClick={() => {
                    zvalue++;
                    // 脚型方向旋转
                    if (zvalue < 3) {
                      if (
                        this.com.current &&
                        this.com.current.changeGroupRotate
                      ) {
                        this.com.current?.changeGroupRotate({ z: zvalue });
                      }
                    } else {
                      zvalue = 0;
                      if (
                        this.com.current &&
                        this.com.current.changeGroupRotate
                      ) {
                        this.com.current?.changeGroupRotate({ z: zvalue });
                      }
                    }
                    localStorage.setItem('bedz', zvalue)
                    // 汽车方向旋转
                    if (zvalue < 3) {
                      if (
                        this.com.current &&
                        this.com.current.changePointRotation
                      ) {
                        this.com.current?.changePointRotation({
                          direction: "z",
                          value: zvalue,
                          type: this.state.carState,
                        });
                      }
                    } else {
                      zvalue = 0;
                      if (
                        this.com.current &&
                        this.com.current.changePointRotation
                      ) {
                        this.com.current?.changePointRotation({
                          direction: "z",
                          value: zvalue,
                          type: this.state.carState,
                        });
                      }
                    }
                  }}
                >
                  <img src={minus} alt="" />
                </div>
              </Popover>

              <Popover
                placement="top"
                title={textReset}
                content={contentReset}
              // arrow={mergedArrow}
              >
                <div
                  className="setIcon "
                  onClick={() => {
                    // zvalue++;
                    // // 脚型方向旋转
                    // if (zvalue < 3) {
                    //   if (
                    //     this.com.current &&
                    //     this.com.current.changeGroupRotate
                    //   ) {
                    //     this.com.current?.changeGroupRotate({ z: 0, x: 0 });
                    //     this.com.current?.reset()
                    //   }
                    // } else {
                    //   zvalue = 0;
                    //   if (
                    //     this.com.current &&
                    //     this.com.current.changeGroupRotate
                    //   ) {
                    //     this.com.current?.changeGroupRotate({ z: 0, x: 0 });
                    //     this.com.current?.reset()
                    //   }
                    // }
                    // localStorage.setItem('bedz', zvalue)
                    // // 汽车方向旋转
                    // if (zvalue < 3) {
                    //   if (
                    //     this.com.current &&
                    //     this.com.current.changePointRotation
                    //   ) {
                    //     this.com.current?.changePointRotation({
                    //       direction: "z",
                    //       value: zvalue,
                    //       type: this.state.carState,
                    //     });
                    //     this.com.current?.reset()
                    //   }
                    // } else {
                    //   zvalue = 0;
                    //   if (
                    //     this.com.current &&
                    //     this.com.current.changePointRotation
                    //   ) {
                    //     this.com.current?.changePointRotation({
                    //       direction: "z",
                    //       value: zvalue,
                    //       type: this.state.carState,
                    //     });
                    //     this.com.current?.reset()
                    //   }
                    // }
                    this.com.current?.reset(this.state.carState)
                  }}
                >
                  <img src={reset} alt="" />
                </div>
              </Popover>

              <Popover
                placement="top"
                title={t('frontView')}
                content={<div><p>{t('frontViewContent')}</p></div>}
              >
                <div
                  className="setIcon marginB10"
                  style={{ marginTop: '10px' }}
                  onClick={() => {
                    xvalue = 0;
                    zvalue = 0;
                    localStorage.setItem('bedx', 0);
                    localStorage.setItem('bedz', 0);
                    if (this.com.current && this.com.current.changeGroupRotate) {
                      this.com.current?.changeGroupRotate({ x: 0, z: 0 });
                    }
                    if (this.com.current && this.com.current.changePointRotation) {
                      this.com.current?.changePointRotation({ direction: 'x', value: 0, type: this.state.carState });
                      this.com.current?.changePointRotation({ direction: 'z', value: 0, type: this.state.carState });
                    }
                    // Set front view (rotateX=0, rotateZ=0) for Num3D component
                    if (this.com.current && this.com.current.setFrontView) {
                      this.com.current?.setFrontView();
                    }
                  }}
                >
                  <img src={frontView} alt="" />
                </div>
              </Popover>

            </div>}
            {this.state.matrixName == "foot" ? (
              <Popover
                placement="top"
                title={t('common.refresh')}
                content={<div><p>{t('home.refreshTrack')}</p></div>}
              >
                <div className="setIconItem setIconItem2">
                  <div className="setIcon">
                    <img
                      src={refresh}
                      alt=""
                      onClick={() => {
                        this.track.current?.canvasInit();
                      }}
                    />
                  </div>
                </div>
              </Popover>
            ) : null}

            <div className="setIconItem setIconItem2">
              {this.state.matrixName == "foot" ? (
                <Popover
                  placement="top"
                  title={t('download')}
                  content={<div><p>{t('home.downloadTrack')}</p></div>}
                >
                  <div
                    className="setIcon marginB10"
                    onClick={() => {
                      if (!canUseLicenseCapability(this.state.licenseAccess, 'canExport')) { message.warning('当前授权不允许导出数据或分析结果。'); return; }
                      const that = this;

                      this.track.current?.loadImg({
                        arrSmooth: that.arrSmooth,
                        rightTopPropSmooth: that.rightTopPropSmooth,
                        leftTopPropSmooth: that.leftTopPropSmooth,
                        leftBottomPropSmooth: that.leftBottomPropSmooth,
                        rightPropSmooth: that.rightPropSmooth,
                        leftPropSmooth: that.leftPropSmooth,
                        rightBottomPropSmooth: that.rightBottomPropSmooth,
                      });
                    }}
                  >
                    <img src={load} alt="" />
                  </div>
                </Popover>
              ) : null}

              <Popover placement="top" title={text2} content={content2}>
                <div
                  className="setIcon"
                  onClick={() => {
                    const flag = this.state.selectFlag;
                    // setSelectFlag(!flag)
                    this.setState({
                      selectFlag: !flag,
                    });
                    this.getActiveRendererRef().current?.changeSelectFlag?.(flag, this.state.local);



                    if (flag) {
                      this.setState({ width: 0, height: 0 });
                      this.sitIndexArr = new Array(4).fill(0);
                      this.backIndexArr = new Array(4).fill(0);
                      this.handIndexArr = new Array(4).fill(0);
                    }
                  }}
                >
                  {/* <img src={icon2} alt="" /> */}
                  <SelectOutlined
                    style={{
                      color: this.state.selectFlag ? "#fff" : "#4c4671",
                      fontSize: "20px",
                    }}
                    color={this.state.selectFlag ? "#fff" : "#4c4671"}
                  />
                  {/* <input type="file" id='fileInput' onChange={(e) => getPath(e)}
            /> */}
                </div>
              </Popover>
            </div>
          </div> : ''}

          {this.state.matrixName != "robot0428" ? <div
            style={{
              position: "fixed",
              display: "flex",
              flexDirection: "column",
              right: "3%",
              height: "55%",
              bottom: "6%",
              boxSizing: "border-box",
            }}
          >

            {/* {colors
              .map((items, indexs) => {
                return (
                  <div
                    key={`${colors[items]}${indexs}`}
                    style={{
                      display: "flex",
                      height: `${100 /
                        colors.slice(0, colors.length - 7)
                          .length
                        }%`,
                      alignItems: "center",
                      padding: "3px",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flex: 1,
                        padding: "0px 10px",
                      }}
                    >
                      <div
                        className="switch"
                        style={{
                          color: "#ccc",
                          // minWidth: "80px",
                          textAlign: "left",
                        }}
                      >
                        {(
                          ((this.state.valuej1 / 100) *
                            (colors.length - 1 - indexs)) /
                          colors.length
                        ).toFixed(2)}
                        N/cm^2
                      </div>
                      <div className="switchLevels"></div>
                    </div>
                    <div
                      style={{
                        width: 50,
                        height: "100%",
                        backgroundColor: `rgb(${items})`,
                      }}
                    ></div>
                  </div>
                );
              })} */}
          </div> : ''}

          {this.state.matrixName != "robot0428" ? <div
            style={{
              position: 'absolute',
              top: '8%'
            }}
          >
            <div>
              <canvas ref={this.handL}></canvas>
              <canvas ref={this.footL}></canvas>
            </div>
            <div>
              <canvas ref={this.handR}></canvas>
              <canvas ref={this.footR}></canvas>
            </div>

          </div> : ''}

          <Title
            licenseAccess={this.state.licenseAccess}
            collectionSummary={this.state.collectionSummary}
            hand={this.state.hand}
            changeAside={this.changeAside}
            i18n={i18n}
            messageApi={this.props.messageApi}
            initBigCtx={this.initBigCtx}
            valueg1={this.state.valueg1}
            value1={this.state.value1}
            valuef1={this.state.valuef1}
            valuel1={this.state.valuel1}
            valuej1={this.state.valuej1}
            sizeValue={this.state.sizeValue}
            valuelInit1={this.state.valuelInit1}
            compen={this.state.compen}
            ymax={this.state.ymax}
            locale={this.state.locale}
            ref={this.title}
            matrixTitle={this.state.matrixTitle}
            systemId={this.state.systemId}
            onRuntimeDefinitionsLoaded={() => this.applyCurrentSensorType(localStorage.getItem('file'))}
            allowedTypes={this.state.allowedTypes}
            sensorTypeList={this.state.sensorTypeList ? this.state.sensorTypeList.flat : null}
            com={this.getActiveRendererRef()}
            track={this.track}
            port={this.state.port}
            portname={this.state.portname}
            portnameBack={this.state.portnameBack}
            portnameHead={this.state.portnameHead}
            portnameSensor={this.state.portnameSensor}
            local={this.state.local}
            dataArr={this.state.dataArr}
            matrixName={this.state.matrixName}
            smallBed12BRealtimeMatrixMode={this.state.smallBed12BRealtimeMatrixMode}
            smallBed12BRealtimeSamplePoint={this.state.smallBed12BRealtimeSamplePoint}
            history={this.state.history}
            jqbedAlgorithmConfig={this.state.jqbedAlgorithmConfig}
            halowStatus={this.state.halowStatus}
            jqbedAlgorithmConfigResult={this.state.jqbedAlgorithmConfigResult}
            jqbedAlgorithmStatus={this.state.jqbedAlgorithmStatus}
            jqbedReturnedSettings={this.state.jqbedReturnedSettings}
            jqbedAlgorithmLogFrame={this.state.jqbedAlgorithmLogFrame}
            jqbedAlgorithmLogSubscription={this.state.jqbedAlgorithmLogSubscription}
            wsConnected={this.state.wsConnected}
            wsConnectionEpoch={this.state.wsConnectionEpoch}
            wsSendObj={this.wsSendObj}
            changeMatrix={this.changeMatrix}
            changeLocal={this.changeLocal}
            colFlag={this.state.colFlag}
            changeStateData={this.changeStateData}
            setColValueFlag={this.setColValueFlag}
            dataZero={this.dataZero}
            dataZero0={this.dataZero0}
            numMatrixFlag={this.state.numMatrixFlag}
            centerFlag={this.state.centerFlag}
            data={this.data}
            dataTime={this.state.dataTime}
            pointFlag={this.state.pointFlag}
            valueMult={this.state.valueMult}
            pressChart={this.state.pressChart}
            changeWs={this.changeWs}
            hunch={this.state.hunch}
            front={this.state.front}
            csvData={this.state.csvData}
            length={this.state.length}
            colWebFlag={this.state.colWebFlag}
            colPushData={this.colPushData}
            delPushData={this.delPushData}
            calibration={this.state.calibration}
            changeCalibration={this.changeCalibration}
            colFingerData={this.colFingerData}
            clearFingerCalibration={this.clearFingerCalibration}
            openDisplaySystemBuilder={() => this.setState({ displaySystemBuilderOpen: true })}
            onPortalBack={this.props.onPortalBack}
            portalEmbedded={this.props.portalEmbedded}
            portalSceneOnly={this.props.portalSceneOnly}
            portalSceneOnlyControl={this.props.portalSceneOnlyControl}
            portalToolsHost={this.props.portalToolsHost}
            onHumanBodySettingsHost={this.setHumanBodySettingsHost}
            portalChartsVisible={this.props.portalChartsVisible}
            onPortalChartsToggle={this.props.onPortalChartsToggle}
            onPortalResetPlayback={() => this.progress.current?.resetPlay()}
            onPortalPlaybackStarted={() => this.progress.current?.setPlaying(true)}
            portalSelectionActive={this.state.selectFlag}
            onPortalSelectionChange={this.changePortalSelection}
            portalAlgorithmMarketOpen={this.state.portalAlgorithmMarketOpen}
            onPortalAlgorithmsToggle={() => this.setState({ portalAlgorithmMarketOpen: !this.state.portalAlgorithmMarketOpen })}
          />

          {this.props.portalEmbedded && <PortalAlgorithmMarket key={this.state.matrixName}
            open={this.state.portalAlgorithmMarketOpen} matrixName={this.state.matrixName}
            displaySystemId={runtimeDisplayDefinition?.displaySystemId || this.state.matrixName}
            inputKind={runtimeDisplayDefinition?.source === 'manifest' ? 'matrix' : 'statistics'}
            metricDefinitions={runtimeDisplayDefinition?.source === 'manifest' ? runtimeDisplayDefinition.page?.sidebar?.algorithmMetrics : undefined}
            dropTargetRef={this.portalChartDropTarget}
            onShowCharts={() => { if (!this.props.portalChartsVisible) this.props.onPortalChartsToggle?.(); }}
            onClose={() => this.setState({ portalAlgorithmMarketOpen: false })}
            onConfigure={() => {
              if (this.title.current?.canUseJqbedAlgorithmConfig()) this.title.current.setState({ jqbedAlgorithmConfigOpen: true });
              else this.setState({ displaySystemBuilderOpen: true });
            }} />}

          <Modal
            className="display-system-builder-shell"
            open={this.state.displaySystemBuilderOpen}
            footer={null}
            width="calc(100vw - 32px)"
            style={{ maxWidth: 1500, top: 16, paddingBottom: 0 }}
            maskClosable={false}
            destroyOnHidden
            onCancel={() => this.setState({ displaySystemBuilderOpen: false })}
          >
            <React.Suspense fallback={<div className="display-system-builder-loading"><Spin /></div>}>
              <DisplaySystemBuilder
                embedded
                onActivated={this.applyCurrentSensorType}
                onClose={() => this.setState({ displaySystemBuilderOpen: false })}
              />
            </React.Suspense>
          </Modal>

          {this.state.matrixName != "robot0428" ? <ManifestSidebarOverlay
            containerRef={this.portalChartDropTarget}
            portalEmbedded={this.props.portalEmbedded}
            enabled={!this.props.portalEmbedded && runtimeDisplayDefinition?.source === 'manifest' && runtimeDisplayDefinition.page?.layout?.presentation !== 'immersive'}
          ><CanvasCom matrixName={modeCanvasMatrixName} chartKey={chartAppearanceKey}>
            <Aside
              i18n={i18n}
              locale={this.state.locale}
              ref={this.data}
              chartAppearance={chartAppearance}
              matrixName={this.state.matrixName}
              displaySystemId={runtimeDisplayDefinition?.displaySystemId || this.state.matrixName}
              matrixShape={runtimeDisplayDefinition?.matrix}
              numMatrixFlag={this.state.numMatrixFlag}
              sidebarConfig={runtimeDisplayDefinition?.source === 'manifest' ? runtimeDisplayDefinition.page?.sidebar : null}
            />
          </CanvasCom></ManifestSidebarOverlay> : ''}

          {/* ⚠️ 旧渲染器还承担部分侧栏计算，粒子视图只隐藏画面，不能卸载后伪造读数。 */}
          <SceneVisibilityContext.Provider value={this.sceneVisibility}>
          <div className={this.props.portalEmbedded ? 'portal-data-renderer' : undefined}
            style={this.props.portalEmbedded ? undefined : { display: 'contents' }}
            inert={Boolean(this.props.externalScene)} aria-hidden={Boolean(this.props.externalScene)}>
          {runtimeDisplayDefinition?.source === 'manifest' ? (
            <React.Suspense fallback={<div className="manifest-renderer-loading"><Spin /></div>}>
              <ManifestDisplayRenderer
                ref={this.manifestDisplay}
                definition={runtimeDisplayDefinition}
                onSidebarData={this.handleManifestSidebarData}
                enabled={false}
              />
            </React.Suspense>
          ) : tactileGloveTypes.includes(this.state.matrixName) && isGloveExhibitionMode(this.state.numMatrixFlag) ? (
            this.state.numMatrixFlag === 'gloveMotion'
              ? <GloveMotion key={this.getSingleGloveFrameSourceKey()} ref={this.com} hand={this.state.hand} dual={this.state.matrixName !== SINGLE_GLOVE_MATRIX}
                  data={gloveRendererData} local={this.state.local} />
              : <GloveTerrain key={this.getSingleGloveFrameSourceKey()} ref={this.com} hand={this.state.hand} dual={this.state.matrixName !== SINGLE_GLOVE_MATRIX}
                  data={gloveRendererData} local={this.state.local} />
          ) : this.state.numMatrixFlag == "num" &&
            this.state.matrixName != WHOLE_CHAIR_MATRIX &&
            (this.state.matrixName == "foot" ||
              this.state.matrixName == "hand" || this.state.matrixName == "carCol" || this.state.matrixName == "jqbed" || this.state.matrixName == tempFullBedMatrix || ['petCare', 'petCareMini'].includes(this.state.matrixName) ||
              this.state.carState == "back" ||
              this.state.carState == "sit") ? (
            <Num ref={this.com} matrixName={this.state.matrixName} />
          ) : this.state.numMatrixFlag == "heatmap" &&
            (this.state.matrixName == "foot" || this.state.matrixName == "carCol" || this.state.matrixName == "jqbed" || ['petCare', 'petCareMini'].includes(this.state.matrixName) ||
              this.state.matrixName == "hand" ||
              this.state.carState == "back" ||
              this.state.carState == "sit") ? (
            <RendererHost
              rendererId="blobHeatmap"
              // 原来是 `<Heatmap matrixName={...}>`。matrixName 只判一件事：是不是
              // `carCol`（那支走 10×9 / max 300 / radius 100）。那条判断连同
              // `carValuej` 的存储读取一起折进了 buildBlobHeatmapParams。
              params={buildBlobHeatmapParams(this.state.matrixName)}
              label="斑点热力"
              rendererRef={this.com}
              // ⚠️ **刻意不传 `data` / `local` / sceneChartProps** —— 原件从不碰
              // `props.data`，这条展示形式下侧栏读数与两条曲线本来就是不动的。渲染器
              // 那边虽然补了 `changeData`，但 `data` 不传就整段不执行，画面与读数
              // 都与原来逐一相同。要让这条通路也喂侧栏是另一件事，记在积压里。
              />
          ) :

            this.state.numMatrixFlag == "num3D" && [...tactileGloveTypes, 'robot1', 'footVideo'].includes(this.state.matrixName) ?
              <CanvasCom matrixName={modeCanvasMatrixName} local={this.state.local}>
                <RendererHost
                  rendererId="numMatrix"
                  // 原来是 `<Num3D matrixName={...}>`。NumWs 只用 matrixName 判
                  // 一件事：是不是 `carCol`（那支走 10×9）。这条分支的
                  // matrixName 只会是手套四型 / robot1 / footVideo，所以恒定
                  // 走 32×32 那条预设；`carCol` 那支由 num3dCarCol 预设承接。
                  params={NUM_MATRIX_PRESETS.num3dDefault}
                  label="3D 数字"
                  rendererRef={this.com}
                  colormap={canvasColormap}
                  data={gloveRendererData}
                  local={this.state.local}
                  {...this.sceneChartProps} />
              </CanvasCom>
              : this.state.numMatrixFlag == "num" && GLOVE_HAND_LAYOUT_TYPES.includes(this.state.matrixName) ?
                <CanvasCom matrixName={modeCanvasMatrixName} local={this.state.local}>
                  <GloveHandNum2D ref={this.com}
                    data={this.data}
                    local={this.state.local} />
                </CanvasCom>
              : this.state.numMatrixFlag == "num" && this.state.matrixName === SINGLE_GLOVE_MATRIX ?
                <CanvasCom matrixName={modeCanvasMatrixName} local={this.state.local}>
                  <LegacyGloveNum2D ref={this.com}
                    matrixName={this.state.matrixName}
                    data={gloveRendererData}
                    local={this.state.local}
                    handleChartsBody={this.handleChartsBody.bind(this)}
                    handleChartsBody1={this.handleChartsBody1.bind(this)}
                    changeStateData={this.changeStateData}
                    changeSelect={this.changeSelect} />
                </CanvasCom>
              : this.state.numMatrixFlag == "num" && [...tactileGloveTypes, 'robot1', 'footVideo'].includes(this.state.matrixName) ?
                <CanvasCom matrixName={modeCanvasMatrixName} local={this.state.local}>
                  <RendererHost
                    rendererId="numMatrix"
                    // 原来是 `<Num2D matrixName={...}>`。matrixName 的三处分支
                    // 折进了 buildWebglNumParams，渲染器不再认识那串字符串。
                    params={buildWebglNumParams(this.state.matrixName)}
                    label="数字"
                    rendererRef={this.com}
                    colormap={canvasColormap}
                    data={this.data}
                    local={this.state.local}
                    {...this.sceneChartProps} />
                </CanvasCom>
                :

                this.state.numMatrixFlag == "numoriginal" && this.state.matrixName == 'bed4096' ?
                  <CanvasCom matrixName={modeCanvasMatrixName} local={this.state.local}>
                    <RendererHost
                      rendererId="webglHeatmap"
                      // 原来是 `<Canvas4096WebGL>`，一个 prop 都不用挑 —— 它没有
                      // matrixName 分支，写死的 64×64 / 1024² / radius 24 / 边缘清零
                      // 窗口 [6,58] / 左右镜像 / ×1.8 全部收进了 bed4096 这条预设。
                      params={WEBGL_HEATMAP_PRESETS.bed4096}
                      label="热力图"
                      rendererRef={this.com}
                      data={this.data}
                      local={this.state.local}
                      {...this.sceneChartProps} />
                  </CanvasCom>
                  :
                  this.state.numMatrixFlag == "numoriginal" && this.state.matrixName == 'bed4096num' ?
                  <CanvasCom matrixName={modeCanvasMatrixName} local={this.state.local}>
                    <RendererHost
                      rendererId="numMatrix"
                      // 原来是 `<Fast256 size={1}>`：size 覆盖预设里的 4，
                      // 网格由 `64 / size` 推出 64×64 = 4096 格。
                      params={{ ...NUM_MATRIX_PRESETS.fast256, size: 1 }}
                      label="数字矩阵"
                      rendererRef={this.com}
                      data={this.data}
                      local={this.state.local}
                      {...this.sceneChartProps} />
                  </CanvasCom>
                  :
                  this.state.numMatrixFlag == "numoriginal" && manifestRenderer ?
                  <CanvasCom
                    matrixName={modeCanvasMatrixName}
                    local={this.state.local}
                    variantKey={runtimeDisplayDefinition?.runtimeRevision}
                  >
                    <RendererHost
                      rendererId={manifestRenderer.rendererId}
                      params={manifestRenderer.params}
                      label={runtimeDisplayDefinition?.label}
                      rendererRef={this.com}
                      // 这条分支原先漏了这两项。pointGrid 不读它们所以没人踩到，
                      // 但 numMatrix 两项都读 —— 一个声明 numMatrix 的 manifest
                      // 会静默丢掉配色与坐标表。与下面那条分支保持一致。
                      colormap={canvasColormap}
                      coordinateMap={runtimeDisplayDefinition?.coordinateMap}
                      data={this.data}
                      local={this.state.local}
                      {...this.sceneChartProps} />
                  </CanvasCom>
                  :
                  this.state.numMatrixFlag == "numoriginal" && (
                    runtimeDisplayDefinition?.source === 'manifest'
                    || ['hand', 'handSinglePoint', MINZHEN_MATRIX, 'smallBed', SMALL_BED_NO_ALG_MATRIX, SMALL_BED_12B_MATRIX, 'matCol'].includes(this.state.matrixName)
                  ) ?
                  <>
                    <CanvasCom
                      matrixName={modeCanvasMatrixName}
                      local={this.state.local}
                      variantKey={canvasVariantKey}
                      viewKey={this.state.matrixName === SMALL_BED_12B_MATRIX
                        ? `${this.state.smallBedMatrixWidth}x${this.state.smallBedMatrixHeight}` : undefined}
                    >
                      <RendererHost
                        rendererId="numMatrix"
                        params={buildNumMatrixParams(
                          this.state.matrixName,
                          runtimeDisplayDefinition,
                          {
                            width: this.state.smallBedMatrixWidth,
                            height: this.state.smallBedMatrixHeight,
                          },
                        )}
                        label={runtimeDisplayDefinition?.label || "数字矩阵"}
                        rendererRef={this.com}
                        // 这两项走 props 而不是 params：配色是用户在画布配置器里的
                        // 实时选择，坐标表是数据。两者都在 contract.js 的
                        // RENDERER_PROPS 里，由 RendererHost 原样透传。
                        colormap={canvasColormap}
                        coordinateMap={runtimeDisplayDefinition?.source === 'manifest' ? runtimeDisplayDefinition.coordinateMap : undefined}
                        data={this.data}
                        local={this.state.local}
                        {...this.sceneChartProps} />
                    </CanvasCom>
                    {this.state.matrixName === MINZHEN_MATRIX ? (
                      <MinzhenSensorPanel sensorInfo={this.state.minzhenSensorInfo} />
                    ) : null}
                  </>
                  :
                  this.state.numMatrixFlag == "numoriginal" && this.state.matrixName === SINGLE_GLOVE_MATRIX ?
                  <CanvasCom matrixName={modeCanvasMatrixName} local={this.state.local}>
                    <LegacyGloveNum2DOriginal ref={this.com}
                      matrixName={this.state.matrixName}
                      data={gloveRendererData}
                      local={this.state.local}
                      handleChartsBody={this.handleChartsBody.bind(this)}
                      handleChartsBody1={this.handleChartsBody1.bind(this)}
                      changeStateData={this.changeStateData}
                      changeSelect={this.changeSelect} />
                  </CanvasCom>
                  :
                  this.state.numMatrixFlag == "numoriginal" && [...tactileGloveTypes, 'robot1', 'footVideo', 'robotSY', 'robotLCF', 'normal', 'jqbed', tempFullBedMatrix, 'petCare', 'petCareMini', 'daliegu', 'smallSample'].includes(this.state.matrixName) ?
                  <CanvasCom matrixName={modeCanvasMatrixName} local={this.state.local}>
                    <RendererHost
                      rendererId="numMatrix"
                      // 原来是 `<Num2DOriginal matrixName={...}>`，12+ 处
                      // matrixName 分支折进了 buildWebglRawParams。
                      params={buildWebglRawParams(this.state.matrixName)}
                      label="原始数据"
                      rendererRef={this.com}
                      colormap={canvasColormap}
                      data={this.data}
                      local={this.state.local}
                      {...this.sceneChartProps} />
                  </CanvasCom>
                  :
                  this.state.numMatrixFlag == "skin" && [...tactileGloveTypes, 'robot1', 'footVideo'].includes(this.state.matrixName) ?
                    <CanvasCom matrixName={modeCanvasMatrixName} local={this.state.local}>
                      <HandVideo1
                        ref={this.com}
                        data={gloveRendererData}
                        local={this.state.local}
                        hand={this.state.hand}
                        {...this.sceneChartProps} />
                    </CanvasCom>
                    :
                    this.state.numMatrixFlag == "numoriginal" && isHumanBodyMatrix(this.state.matrixName) ?
                    <CanvasCom matrixName={modeCanvasMatrixName} local={this.state.local}>
                      <HumanBodyRawData
                        ref={this.com}
                        data={this.data}
                        local={this.state.local}
                        layout={this.state.matrixName === PRESSURE_VEST_MATRIX ? PRESSURE_VEST_RAW_LAYOUT : undefined}
                        manageStats={this.state.matrixName !== PRESSURE_VEST_MATRIX}
                      />
                    </CanvasCom>
                    :
                    this.state.numMatrixFlag == "skin" && this.state.matrixName == 'humanBody' ?
                    <CanvasCom matrixName={this.state.matrixName} local={this.state.local}>
                      <HumanBodyCanvas
                        ref={this.com}
                        data={this.data}
                        local={this.state.local}
                        renderOptions={{
                          max: this.state.valuej1,
                          size: this.state.sizeValue ?? HUMAN_BODY_DEFAULT_SIZE,
                          filter: this.state.valuef1,
                        }}
                        {...this.sceneChartProps} />
                    </CanvasCom>
                    :
                    // ⚠️ 人体与背心的旧模式仍显示人体，避免落入末尾的汽车座椅兜底。
                    this.state.numMatrixFlag !== "numoriginal" && [HUMAN_BODY_OPTIMIZED_MATRIX, PRESSURE_VEST_MATRIX].includes(this.state.matrixName) ?
                    <CanvasCom matrixName={this.state.matrixName} local={this.state.local} controlsHost={this.state.humanBodySettingsHost}>
                      <HumanBodyOptimized
                        ref={this.com}
                        portalEmbedded={this.props.portalEmbedded}
                        settingsHost={this.state.humanBodySettingsHost}
                        data={this.data}
                        local={this.state.local}
                        sensorProfile={this.state.matrixName === PRESSURE_VEST_MATRIX ? PRESSURE_VEST_PROFILE : undefined}
                        manageStats={this.state.matrixName !== PRESSURE_VEST_MATRIX}
                        renderOptions={{
                          max: this.state.valuej1,
                          size: this.state.sizeValue ?? HUMAN_BODY_DEFAULT_SIZE,
                          filter: this.state.valuef1,
                        }}
                      />
                    </CanvasCom>
                    :

                    this.state.matrixName == "foot" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <Canvas ref={this.com} changeSelect={this.changeSelect} />
                      </CanvasCom>
                    ) : this.state.matrixName == MINZHEN_MATRIX ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <Minzhen
                          portalEmbedded={this.props.portalEmbedded}
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "hand" || this.state.matrixName == "handSinglePoint" || this.state.matrixName == "handBlue" || this.state.matrixName == "sit" ? (
                      <>
                        <CanvasCom matrixName={this.state.matrixName}
                          local={this.state.local}
                          colormapKey={canvasColormapKey}
                        >
                          <CanvasHand
                            ref={this.com}
                            portalEmbedded={this.props.portalEmbedded}
                            colormap={canvasColormap}
                            data={this.data}
                            local={this.state.local}
                            {...this.sceneChartProps} />
                        </CanvasCom>
                      </>
                    ) : this.state.matrixName == "sit100" || this.state.matrixName == "back100" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <Box100
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "car100" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <Car100
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "bed4096" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <RendererHost
                          rendererId="webglHeatmap"
                          params={WEBGL_HEATMAP_PRESETS.bed4096}
                          label="热力图"
                          rendererRef={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "bed1616" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <Bed1616
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : NUM_MATRIX_SCENES[this.state.matrixName] ? (
                      // 原来是 fast256 / normalFast / fast1024 / fast1024sit
                      // 四条分支，指向三份 NumThreeColor。见 NUM_MATRIX_SCENES。
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <RendererHost
                          rendererId="numMatrix"
                          params={NUM_MATRIX_SCENES[this.state.matrixName]}
                          label="数字矩阵"
                          rendererRef={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "bed4096num" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <Bed4096
                          portalEmbedded={this.props.portalEmbedded}
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "carCol" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <RendererHost
                          rendererId="pointGrid"
                          params={POINT_GRID_PRESETS.carCol}
                          label="点阵热力（3D）"
                          rendererRef={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "Num3D" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <RendererHost
                          rendererId="numMatrix"
                          // 这个渲染点原先连 matrixName 都没传，NumWs 里
                          // `props.matrixName == 'carCol'` 恒为假 —— 32×32。
                          params={NUM_MATRIX_PRESETS.num3dDefault}
                          label="3D 数字"
                          rendererRef={this.com}
                          colormap={canvasColormap}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : tactileGloveTypes.includes(this.state.matrixName) ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        {this.state.matrixName === SINGLE_GLOVE_MATRIX ? (
                          <Hand0205
                            portalEmbedded={this.props.portalEmbedded}
                            hand={this.state.hand}
                            ref={this.com}
                            data={gloveRendererData}
                            local={this.state.local}
                            {...this.sceneChartProps} />
                        ) : (
                          <Hand0205Double
                            portalEmbedded={this.props.portalEmbedded}
                            hand={this.state.hand}
                            ref={this.com}
                            data={gloveRendererData}
                            local={this.state.local}
                            {...this.sceneChartProps} />
                        )}
                      </CanvasCom>
                    ) : this.state.matrixName == "hand0507" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <Hand0507
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "hand0205Point" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <RendererHost
                          rendererId="handPoints"
                          params={HAND_POINTS_PRESETS.hand0205}
                          label="手部点云"
                          rendererRef={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "hand0205Point147" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <RendererHost
                          rendererId="handPoints"
                          // 与上一条同一个渲染器，只换预设：147 那份的净差就是
                          // interp 2→4、order 4→6、点表、以及另外几个尺寸参数。
                          params={HAND_POINTS_PRESETS.hand0205_147}
                          label="手部点云（147）"
                          rendererRef={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "ware" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <Ware
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "footVideo" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <FootVideo
                          portalEmbedded={this.props.portalEmbedded}
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "footVideo256" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <FootVideo256
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "handVideo" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <HandVideo
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "handVideo1" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <HandVideo1
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "robot" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <Robot
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "robot1" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <RobotBlue
                          portalEmbedded={this.props.portalEmbedded}
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "chairQX" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <ChairQX
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "robotSY" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <RobotBlueSY
                          portalEmbedded={this.props.portalEmbedded}
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "robotLCF" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <RobotBlueLCF
                          portalEmbedded={this.props.portalEmbedded}
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "robot0428" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <RobotBlue0428
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "humanBody" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <HumanBodyCanvas
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          renderOptions={{
                            max: this.state.valuej1,
                            size: this.state.sizeValue ?? HUMAN_BODY_DEFAULT_SIZE,
                            filter: this.state.valuef1,
                          }}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "normal" ? (
                      <>
                        <CanvasCom matrixName={this.state.matrixName}
                          local={this.state.local}
                          colormapKey={canvasColormapKey}
                        >
                          <CanvasHand
                            ref={this.com}
                            portalEmbedded={this.props.portalEmbedded}
                            colormap={canvasColormap}
                            data={this.data}
                            local={this.state.local}
                            {...this.sceneChartProps} />
                        </CanvasCom>
                      </>
                    ) : this.state.matrixName == "newHand" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <CanvasnewHand
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "gloves" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <Gloves
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "gloves1" || this.state.matrixName == "gloves2" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <Gloves1
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "sitCol" ? (
                      <>
                        <CanvasCom matrixName={this.state.matrixName}
                          local={this.state.local}
                          colormapKey={canvasColormapKey}
                        >
                          <CanvasHand
                            ref={this.com}
                            colormap={canvasColormap}
                            portalEmbedded={this.props.portalEmbedded}
                            data={this.data}
                            local={this.state.local}
                            {...this.sceneChartProps} />
                        </CanvasCom>
                      </>
                    ) : this.state.matrixName == "matCol" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <RendererHost
                          rendererId="pointGrid"
                          params={POINT_GRID_PRESETS.matCol}
                          label="点阵热力（3D）"
                          rendererRef={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "matColPos" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <RendererHost
                          rendererId="pointGrid"
                          params={POINT_GRID_PRESETS.matCol}
                          label="点阵热力（3D）"
                          rendererRef={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "CarTq" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <CarTq
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "car" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <CanvasCar
                          ref={this.com}
                          changeSelect={this.changeSelect}
                          changeStateData={this.changeStateData}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == "volvo" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <CanvasCarWow
                          ref={this.com}
                          changeSelect={this.changeSelect}
                          changeStateData={this.changeStateData}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == "carQX" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <CanvasCarQX
                          portalEmbedded={this.props.portalEmbedded}
                          ref={this.com}
                          changeSelect={this.changeSelect}
                          changeStateData={this.changeStateData}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == WHOLE_CHAIR_MATRIX ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <WholeChair
                          portalEmbedded={this.props.portalEmbedded}
                          ref={this.com}
                          changeSelect={this.changeSelect}
                          changeStateData={this.changeStateData}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == "sofa" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <CanvasCarSofa
                          ref={this.com}
                          changeSelect={this.changeSelect}
                          changeStateData={this.changeStateData}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == "smallSample" ? (
                      <CanvasCom matrixName={this.state.matrixName}
                        local={this.state.local}
                      >
                        <SmallSample
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps} />
                      </CanvasCom>
                    ) : this.state.matrixName == "daliegu" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <CanvasDaliegu
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartProps}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == "eye" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <Eye
                          ref={this.com}
                          changeSelect={this.changeSelect}
                          changeStateData={this.changeStateData}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == "bigBed" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <Bed
                          ref={this.com}
                          data={this.data}
                          {...this.sceneChartPropsBasic}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == "sit10" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <Sit10
                          ref={this.com}
                          {...this.sceneChartPropsBasic}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == "smallBed" || this.state.matrixName == SMALL_BED_NO_ALG_MATRIX || this.state.matrixName == SMALL_BED_12B_MATRIX ? (
                      <CanvasCom
                        matrixName={this.state.matrixName}
                        variantKey={this.state.matrixName === SMALL_BED_12B_MATRIX ? `${this.state.smallBedMatrixWidth}x${this.state.smallBedMatrixHeight}` : undefined}
                      >
                        <SmallBed
                          matrixName={this.state.matrixName}
                          portalEmbedded={this.props.portalEmbedded}
                          matrixWidth={this.state.matrixName === SMALL_BED_12B_MATRIX ? this.state.smallBedMatrixWidth : undefined}
                          matrixHeight={this.state.matrixName === SMALL_BED_12B_MATRIX ? this.state.smallBedMatrixHeight : undefined}
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartPropsBasic}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == "jqbed" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <SmallBed
                          portalEmbedded={this.props.portalEmbedded}
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartPropsBasic}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == tempFullBedMatrix ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <TempFullBed
                          ref={this.com}
                          matrixWidth={15}
                          matrixHeight={12}
                          xStretch={1}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartPropsBasic}
                        />
                      </CanvasCom>
                    ) : ['petCare', 'petCareMini'].includes(this.state.matrixName) ? (
                      <>
                        <CanvasCom matrixName={this.state.matrixName}
                          colormapKey={canvasColormapKey}
                        >
                          <CanvasHand
                            ref={this.com}
                            colormap={canvasColormap}
                            portalEmbedded={this.props.portalEmbedded}
                            data={this.data}
                            local={this.state.local}
                            {...this.sceneChartProps}
                          />
                        </CanvasCom>
                      </>
                    ) : this.state.matrixName == "xiyueReal1" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <SmallBed
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartPropsBasic}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == "smallBed1" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <SmallBed
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartPropsBasic}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == "smallM" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <SmallM
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartPropsBasic}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == "rect" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <SmallRect
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}

                          {...this.sceneChartPropsBasic}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == "short" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <SmallShort
                          ref={this.com}
                          data={this.data}
                          local={this.state.local}
                          {...this.sceneChartPropsBasic}
                        />
                      </CanvasCom>
                    ) : this.state.matrixName == "yanfeng10" ? (
                      <CanvasCom matrixName={this.state.matrixName}>
                        <Car10 ref={this.com} changeSelect={this.changeSelect} />
                      </CanvasCom>
                    ) :

                      (
                        <CanvasCom matrixName={this.state.matrixName}>
                          <Car10 ref={this.com} changeSelect={this.changeSelect} />
                        </CanvasCom>
                      )
          }

          </div>
          </SceneVisibilityContext.Provider>
          {/* 全床压力曲线 */}
          {this.state.matrixName === "bigBed" ? (
            <div
              style={{
                position: "fixed",
                visibility: this.state.pressChart ? "hidden" : "unset",
                width: "60%",
                right: "20%",
                bottom: "100px",
              }}
            >
              <canvas
                id="myChartBig1"
                style={{ height: "300px", width: "100%" }}
              ></canvas>
              {/* <canvas id="myChartBig" style={{ height: '300px', width: '100%' }}></canvas> */}
            </div>
          ) : null}

          {/* {this.state.matrixName === 'localCar' ?
          <div style={{ position: "fixed", display : 'flex' ,visibility: this.state.pressChart ? 'hidden' : 'unset', width: '60%', right: "20%", bottom: "100px" }}>
            <canvas id="myChartsit" style={{ height: '300px',flex : 1 }}></canvas>
            <canvas id="myChartback" style={{ height: '300px',flex : 1 }}></canvas>
          </div>
          : null} */}

          {/* 进度条 */}
          {this.state.local ? (
            <ProgressCom
              ref={this.progress}
              dataTime={this.state.dataTime}
              matrixName={this.state.matrixName}
              data={this.data}
              areaArr={this.state.areaArr}
              pressArr={this.state.pressArr}
              length={this.state.length - 1}
              max={this.max}
              time={this.state.time}
              timeArr={this.state.timeArr}
              historyTimeArr={this.state.historyTimeArr}
              pressMax={this.pressMax}
              wsSendObj={this.wsSendObj}
            />
          ) : null}
          {/* 脚型重心画图 */}
          {this.state.matrixName == "foot" ? (
            <CanvasCom matrixName={this.state.matrixName}>
              <FootTrack ref={this.track} />
            </CanvasCom>
          ) : null}

          {this.state.matrixName == "localCar" ? (
            <div
              style={{
                position: "fixed",
                bottom: "6%",
                right: "20%",
                borderRadius: "10px",
                color: "#fff",
                fontSize: "1.5rem",
              }}
            >
              {controlArr.map((a, index) => {
                // console.log(this.searchName(this.state.control, a.info))
                return (
                  <p
                    key={a.labelKey}
                    style={{
                      color: this.state.control.includes(a.info)
                        ? "#0cf862"
                        : "#fff",
                      fontWeight: "bold",
                      transition: 'color 0.5s ease'
                    }}
                  >
                    {t(a.labelKey)}
                  </p>
                );
              })}
              <p>{t('home.debug.hunch')}: {this.state.hunch}</p>
              <p>{t('home.debug.front')}: {this.state.front}</p>
              <p>{t('home.debug.flank')}: {this.state.flank}</p>
              <p>{t('home.debug.seatValue')}: {this.state.pressToArea}</p>
              {/* wsPointData.filter(a => a > 40).length > 45 ? 2 : wsPointData.filter(a => a > 40).length <10  ? 0 : 1 */}
              <p>{t('home.bodyType')} {this.state.newValue > 45 ? 2 : this.state.newValue < 10 ? 0 : 1} -- {this.state.newValue}</p>
              <p>{t('home.debug.backTime')}: {this.state.backTime}</p>

            </div>
          ) : null}

          {/* <div style={{ position: "fixed", bottom: "20px", color: "#fff" }}>
            <div
              style={{ border: "1px solid #01F1E3" }}
              onClick={() => {
                const press = this.state.press;
                this.setState({
                  press: !press,
                });
              }}
            >
              {this.state.press ? "分压" : "不分压"}
            </div>
            <div
              style={{ border: "1px solid #01F1E3" }}
              onClick={() => {
                const pressNum = this.state.pressNum;
                this.setState({
                  pressNum: !pressNum,
                });
              }}
            >
              {this.state.pressNum ? "压力算法" : "不压力算法"}
            </div>
          </div> */}
          {/* <div style={{ position: "fixed", right: "20%", bottom: "20px" }}>
          {this.state.newArr.length
            ? this.state.newArr.map((a, indexs) => {
              return (
                <div style={{ display: "flex", color: "#fff" }}>
                  {a.map((b, index) => {
                    return <div style={{ width: 40 }}>{b}</div>;
                  })}
                </div>
              );
            })
            : null}
        </div>

        <div style={{ position: "fixed", right: "20%", bottom: "400px" }}>
          {this.state.newArr1.length
            ? this.state.newArr1.map((a, indexs) => {
              return (
                <div style={{ display: "flex", color: "#fff" }}>
                  {a.map((b, index) => {
                    return <div style={{ width: 40 }}>{b}</div>;
                  })}
                </div>
              );
            })
            : null}
        </div> */}
        </div>

          {/* ====== 右下角采样频率显示 ====== */}
          <div className="portal-sample-rate" style={{
            position: 'fixed',
            bottom: '70px',
            right: '20px',
            backgroundColor: 'rgba(25, 25, 50, 0.85)',
            color: '#01F1E3',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 999,
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(1, 241, 227, 0.3)',
            userSelect: 'none',
          }}>
            <span style={{ color: '#aaa', fontWeight: 'normal', marginRight: '4px' }}>Hz</span>
            {this.state.realHz}
          </div>

          {/* ====== 密钥过期提示弹窗 ====== */}
          <Modal
            open={this.state.licenseModalVisible}
            onOk={() => {
              this.setState({ licenseModalVisible: false })
              // 密钥已过期时，点击确定跳转到密钥输入页
              if (this.state.licenseModalType === 'expired') {
                window.location.hash = '#/?from=system';
              }
            }}
            onCancel={() => this.setState({ licenseModalVisible: false })}
            okText={this.state.licenseModalType === 'expired' ? t('license.goEnterKey') : t('license.acknowledge')}
            cancelButtonProps={{ style: { display: this.state.licenseModalType === 'expired' ? 'none' : 'none' } }}
            centered
            width={480}
            closable={false}
            maskClosable={false}
            className={this.state.licenseModalType === 'expired' ? 'license-expired-modal' : 'license-warning-modal'}
            title={
              <span>
                {this.state.licenseModalType === 'expired' ? t('license.expiredHeading') : t('license.expiringHeading')}
              </span>
            }
          >
            {this.state.licenseModalType === 'expired' ? (
              <div>
                <p>{t('license.expiredAt', { date: this.state.licenseModalExpireDate })}</p>
                <p>{t('license.featuresDisabled')}</p>
                <p className="hint">{t('license.obtainNewKey')}</p>
              </div>
            ) : (
              <div>
                <p>{t('license.expiresAt', { date: this.state.licenseModalExpireDate })}</p>
                <p>{t('license.remaining', { days: this.state.licenseModalRemainDays })}</p>
                <p className="hint">{t('license.renewSoon')}</p>
              </div>
            )}
          </Modal>

          {/* ====== 授权锁定弹窗（时间回拨/篡改，需厂商解锁码） ====== */}
          <Modal
            open={this.state.licenseLockedVisible}
            centered
            width={480}
            closable={false}
            maskClosable={false}
            keyboard={false}
            okText={t('common.confirm')}
            cancelButtonProps={{ style: { display: 'none' } }}
            className="license-expired-modal"
            title={<span>{t('license.anomaly')}</span>}
            onOk={() => {
              this.setState({ licenseLockedVisible: false });
              window.location.hash = '#/?from=system';
            }}
          >
            <div>
              <p>{this.state.licenseLockReason || t('license.anomalyDetected')}</p>
              <p className="hint">{t('license.anomalyAction')}</p>
            </div>
          </Modal>

      </ConfigProvider>
    );
  }
}

// HOC 包装：通过 message.useMessage() 获取 contextHolder 和 messageApi
function withMessageApi(WrappedComponent) {
  return React.forwardRef((props, ref) => {
    const [messageApi, contextHolder] = message.useMessage();
    return (
      <>
        {contextHolder}
        <WrappedComponent {...props} ref={ref} messageApi={messageApi} />
      </>
    );
  });
}

const HomeWithMessage = withMessageApi(Home);
export default withTranslation()((HomeWithMessage));

// export const WithNavigation = (Component) => {
//   const navigate = useNavigate()
//   return (props) => <Component {...props} navigate={navigate} />;
// };
