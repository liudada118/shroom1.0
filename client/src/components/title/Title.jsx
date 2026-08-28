import React from 'react'
import { Menu, Slider, Button, Select, message, notification, Divider, Space, Radio, Drawer, Modal, Progress, Tooltip } from 'antd';
import { PlusOutlined, SettingOutlined, SlidersOutlined } from '@ant-design/icons';
import exchange from '../../assets/images/exchange.png'
import option from '../../assets/images/Option.png'
import logo from '../../assets/images/logo.png'
import shroomWordmark from '../../assets/images/shroom.png'
import './title.scss'
import Input from 'antd/es/input/Input';
import { CSVLink, CSVDownload } from 'react-csv';
import { timeStampToDate, timeStampToDateNospace } from '../../assets/util/util';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { withTranslation } from "react-i18next";
import { NavLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { bthClickHandle as heatmapBthClickHandle } from '../onestep/heatmap';
import { registerRuntimeDisplayDefinition } from '../../displays/registry';
import { buildAccessibleSensorOptions } from '../../services/sensorStatus';
import { translateDomainLabel } from '../../i18n/translateDomainLabel';
import { getLanguageLocale } from '../../i18n';
import JqbedAlgorithmConfigModal from './JqbedAlgorithmConfigModal';
import { getJqbedConfigAccess } from './jqbedAlgorithmConfig';
import {
  PRESSURE_SCENES,
  readPressureScene,
  resolveDisplaySwitchZero,
  resolvePressureSceneChangeZero,
  writePressureScene,
} from './displaySwitchZeroPolicy';
let collection = JSON.parse(localStorage.getItem('collection'))
  ? JSON.parse(localStorage.getItem('collection'))
  : [['hunch', 'front', '标签']];

const maxValue = 1000

let loadData = ''
const HUMAN_BODY_COLOR_SLIDER_MAX = 5000
const HUMAN_BODY_DEFAULT_COLOR = 1555
const HUMAN_BODY_DEFAULT_SIZE = 31
const HUMAN_BODY_OPTIMIZED_MATRIX = 'humanBodyOptimized'
const isHumanBodyMatrixTitle = (matrixName) => ['humanBody', HUMAN_BODY_OPTIMIZED_MATRIX].includes(matrixName)
const HUMAN_BODY_OLD_DEFAULT_COLOR_VALUES = [1205, 5000]
const HUMAN_BODY_OLD_DEFAULT_SIZE_VALUES = [20, 60]
const MINZHEN_NORMAL_DEFAULT_COLOR = 415
const MINZHEN_RAW_DEFAULT_COLOR = 25
const MINZHEN_OLD_DEFAULT_COLOR_VALUES = [1205]
const SMALL_BED_12B_PRESSURE_DEFAULT_COLOR = 25
const SMALL_BED_12B_PRESSURE_COLOR_MAX = 30
const SMALL_BED_12B_PRESSURE_DEFAULT_SMOOTH = 2
const SMALL_BED_12B_OLD_DEFAULT_COLOR_VALUES = [30, 80, 2205, 4000]
const SMALL_BED_12B_OLD_DEFAULT_SMOOTH_VALUES = [5]
const SMALL_BED_12B_PRESSURE_DEFAULT_FILTER = 0
const SMALL_BED_12B_OLD_DEFAULT_FILTER_VALUES = [6]
const SMALL_BED_12B_PRESSURE_DEFAULT_INIT_FILTER = 0
const SMALL_BED_12B_OLD_DEFAULT_INIT_FILTER_VALUES = [500]

const canvasToPngBlob = (canvas) => new Promise((resolve) => {
  if (!canvas || typeof canvas.toBlob !== 'function') {
    resolve(null)
    return
  }
  canvas.toBlob((blob) => resolve(blob), 'image/png')
})

const createOneStepPdfHeatmapCanvas = (peakFrameData) => {
  if (!Array.isArray(peakFrameData) || peakFrameData.length < 4096) {
    return null
  }
  return heatmapBthClickHandle(peakFrameData)
}

const configureOneStepPdfMessage = () => {
  message.config({
    top: 80,
    duration: 3,
    maxCount: 3,
    prefixCls: 'ant-message',
    getContainer: () => document.body,
  })
}

// Default config values (same as Home.jsx initConfig)
const titleInitConfig = {
  bed: { valueg1: 2, valuej1: 1205, valuel1: 5, valuef1: 6, value1: 0.72 },
  smallBed12B: { valueg1: 2, valuej1: SMALL_BED_12B_PRESSURE_DEFAULT_COLOR, valuel1: SMALL_BED_12B_PRESSURE_DEFAULT_SMOOTH, valuef1: SMALL_BED_12B_PRESSURE_DEFAULT_FILTER, value1: 0.1, valuelInit1: SMALL_BED_12B_PRESSURE_DEFAULT_INIT_FILTER },
  wholeChair: { valueg1: 2, valuej1: 25, valuel1: 4, valuef1: 6, value1: 15, valuelInit1: 500 },
  minzhen: { valueg1: 2, valuej1: MINZHEN_NORMAL_DEFAULT_COLOR, valuel1: 5, valuef1: 6, value1: 0.72, valuelInit1: 500 },
  petCare: { valueg1: 2, valuej1: 2900, valuel1: 5, valuef1: 6, value1: 0.7, valuelInit1: 500 },
  petCareMini: { valueg1: 2, valuej1: 2900, valuel1: 5, valuef1: 6, value1: 0.7, valuelInit1: 500 },
  sit: { valueg1: 4.3, valuej1: 1705, valuel1: 11, valuef1: 14, value1: 3.54 },
  humanBody: { valueg1: 2, valuej1: HUMAN_BODY_DEFAULT_COLOR, valuel1: 5, valuef1: 6, value1: 0.72, sizeValue: HUMAN_BODY_DEFAULT_SIZE },
}
titleInitConfig[HUMAN_BODY_OPTIMIZED_MATRIX] = { ...titleInitConfig.humanBody }
titleInitConfig.minzhen__normal = {
  ...titleInitConfig.minzhen,
  valuej1: MINZHEN_NORMAL_DEFAULT_COLOR,
}
titleInitConfig.minzhen__numoriginal = {
  ...titleInitConfig.minzhen,
  valuej1: MINZHEN_RAW_DEFAULT_COLOR,
}
const createDefaultHumanTransform = () => ({
  position: { x: 0, y: 26, z: -9.5 },
  rotation: { x: -140, y: 0, z: -180 },
})
const petCareMatrixTypes_title = ['petCare', 'petCareMini']
const tempFullBedType_title = 'tempFullBed'
const smallBedNoAlgType_title = 'smallBedNoAlg'
const smallBed12BType_title = 'smallBed12B'
const wholeChairType_title = 'wholeChair'
const minzhenType_title = 'minzhen'
const tactileGloveTypes_title = ['hand0205', 'handGlove115200', 'handGloveFullPacket']
const fullPacketGloveType_title = 'handGloveFullPacket'
const calibratableGloveTypes_title = tactileGloveTypes_title.filter((type) => type !== fullPacketGloveType_title)
const isPetCareMatrixTitle = (type) => petCareMatrixTypes_title.includes(type)
const bedArr_title = ['bigBed', 'smallBed', smallBedNoAlgType_title, smallBed12BType_title, 'bed4096', 'bed4096num', 'matColPos', 'jqbed', tempFullBedType_title, ...petCareMatrixTypes_title]
const matrixNameToType_title = (type) => type === smallBed12BType_title ? type : isPetCareMatrixTitle(type) ? type : bedArr_title.includes(type) ? 'bed' : type
const getColorSliderMax = (matrixName) => {
  if (matrixName === smallBed12BType_title) return SMALL_BED_12B_PRESSURE_COLOR_MAX
  if (isPetCareMatrixTitle(matrixName)) return 5000
  if (isHumanBodyMatrixTitle(matrixName)) return HUMAN_BODY_COLOR_SLIDER_MAX
  return 1000
}
const getColorSliderStep = () => 10
const normalizeHumanBodySizeValue = (sizeValue) => {
  const nextValue = Number(sizeValue);
  if (!Number.isFinite(nextValue)) {
    return HUMAN_BODY_DEFAULT_SIZE;
  }
  return Math.min(200, Math.max(1, nextValue));
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
 * Get merged config from localStorage cache, supporting sensorType + mode two-dimensional cache.
 */
const getConfig = ({ sensorType, mode }) => {
  if (!sensorType) return titleInitConfig['bed']
  const realType = matrixNameToType_title(sensorType)
  const modeDefaultKey = mode ? `${realType}__${mode}` : ''
  const init = modeDefaultKey && titleInitConfig[modeDefaultKey]
    ? titleInitConfig[modeDefaultKey]
    : titleInitConfig[realType]
      ? titleInitConfig[realType]
      : titleInitConfig['bed']
  let config = JSON.parse(localStorage.getItem('valueConfig'))
  if (!config) return { ...init }
  let result = {}
  if (config[realType] && Object.keys(config[realType]).length) {
    result = { ...config[realType] }
  }
  if (mode) {
    const modeKey = `${realType}__${mode}`
    if (config[modeKey] && Object.keys(config[modeKey]).length) {
      result = { ...result, ...config[modeKey] }
    }
  }
  const mergedConfig = { ...init, ...result }
  if (isHumanBodyMatrixTitle(realType)) {
    if (HUMAN_BODY_OLD_DEFAULT_COLOR_VALUES.includes(Number(mergedConfig.valuej1))) {
      mergedConfig.valuej1 = HUMAN_BODY_DEFAULT_COLOR
    }
    if (HUMAN_BODY_OLD_DEFAULT_SIZE_VALUES.includes(Number(mergedConfig.sizeValue))) {
      mergedConfig.sizeValue = HUMAN_BODY_DEFAULT_SIZE
    }
    mergedConfig.sizeValue = normalizeHumanBodySizeValue(mergedConfig.sizeValue)
  }
  if (realType === minzhenType_title) {
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
  if (
    realType === smallBed12BType_title &&
    (
      Number(mergedConfig.valuej1) > SMALL_BED_12B_PRESSURE_COLOR_MAX ||
      SMALL_BED_12B_OLD_DEFAULT_COLOR_VALUES.includes(Number(mergedConfig.valuej1))
    )
  ) {
    mergedConfig.valuej1 = SMALL_BED_12B_PRESSURE_DEFAULT_COLOR
  }
  if (
    realType === smallBed12BType_title &&
    SMALL_BED_12B_OLD_DEFAULT_SMOOTH_VALUES.includes(Number(mergedConfig.valuel1))
  ) {
    mergedConfig.valuel1 = SMALL_BED_12B_PRESSURE_DEFAULT_SMOOTH
  }
  if (
    realType === smallBed12BType_title &&
    SMALL_BED_12B_OLD_DEFAULT_FILTER_VALUES.includes(Number(mergedConfig.valuef1))
  ) {
    mergedConfig.valuef1 = SMALL_BED_12B_PRESSURE_DEFAULT_FILTER
  }
  if (
    realType === smallBed12BType_title &&
    SMALL_BED_12B_OLD_DEFAULT_INIT_FILTER_VALUES.includes(Number(mergedConfig.valuelInit1))
  ) {
    mergedConfig.valuelInit1 = SMALL_BED_12B_PRESSURE_DEFAULT_INIT_FILTER
  }
  return mergedConfig
}

/**
 * @param {*} param0  sensorType 传感器类型, valueType 需要修改的值的类型, value 需要修改的值, mode 展示模式
 * Save setting value to localStorage cache, keyed by sensorType + mode
 */
const changeLocalStroage = ({ sensorType, valueType, value, mode }) => {
  let config = JSON.parse(localStorage.getItem('valueConfig'))
  if (!config) {
    config = {}
  }
  const cacheKeys = []
  if (mode) {
    cacheKeys.push(`${sensorType}__${mode}`)
  }
  if (!mode || isHumanBodyMatrixTitle(sensorType)) {
    cacheKeys.push(sensorType)
  }

  cacheKeys.forEach((cacheKey) => {
    if (!config[cacheKey]) {
      config[cacheKey] = {}
    }
    config[cacheKey][valueType] = value
  })
  localStorage.setItem('valueConfig', JSON.stringify(config))
}

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

// 展会

// const sensorArr = [
//     { label: '席悦1.0', value: 'smallBed' },
//     { label: '席悦2.0', value: 'xiyueReal1' },
//     // { label: '小床监测', value: 'jqbed' },
//     // { label: '沃尔沃', value: 'volvo' },
// ]
// React.translate = t;


// const [current, setCurrent] = useState('now');
// const [carCurrent, setCarCurrent] = useState('all');
// const [show, setShow] = useState(false)
class Title extends React.Component {
  constructor() {
    super()
    this.state = {
      current: 'now',
      carCurrent: 'all',
      show: false,
      resetZero: false,
      pressureScene: readPressureScene(),
      num: 0,
      dataTime: '',
      clickState: true,
      colName: '',
      csvData: JSON.parse(localStorage.getItem('collection'))
        ? JSON.parse(localStorage.getItem('collection'))
        : [['hunch', 'front', '标签']],
      length: JSON.parse(localStorage.getItem('collection'))
        ? JSON.parse(localStorage.getItem('collection')).length
        : 1,
      ip: localStorage.getItem('ip') ? localStorage.getItem('ip') : '',

      dataName: '',
      items: localStorage.getItem('sitType') ? JSON.parse(localStorage.getItem('sitType')) : [],
      name: '',
      items1: localStorage.getItem('sitType1') ? JSON.parse(localStorage.getItem('sitType1')) : [],
      name1: '',
      realname: '',
      realname1: '',
      loadName: '',
      collectAge: '',
      collectGender: '男',
      pdfModalOpen: false,
      csvDownloadModalOpen: false,
      csvDownloadStage: 'config',
      csvDownloadPath: localStorage.getItem('csvDownloadPath') || '',
      csvDownloadFormat: 'csv',
      csvDownloadFiles: [],
      csvDownloadDir: '',
      csvDownloadMessage: '',
      csvDownloadProgress: 0,
      csvDownloadProgressDetail: null,
      open: false,
      fingerIndex: 0,
      colHZ: 12,
      collectionModalOpen: false,
      collectLabel: '',
      collectFrequencyMode: 'serial',
      collectMatrixMode: '16x16',
      collectSamplePoint: 'topLeft',
      smallBed12BDisplaySettingsOpen: false,
      smallBed12BRealtimeMatrixMode: localStorage.getItem('smallBed12BRealtimeMatrixMode') === '16x16' ? '16x16' : '32x32',
      smallBed12BRealtimeSamplePoint: localStorage.getItem('smallBed12BRealtimeSamplePoint') || 'topLeft',
      pdfLoading: false,
      humanTransform: createDefaultHumanTransform(),
      dynamicSensors: [],
      jqbedAlgorithmConfigOpen: false,
    }
    this.inputRef = React.createRef(null)
    this.inputRef1 = React.createRef(null)
    this.handleCsvDownloadStatus = this.handleCsvDownloadStatus.bind(this)
  }

  componentDidMount() {
    console.log(this.props, 'props')
    window.addEventListener('shroom-csv-download-status', this.handleCsvDownloadStatus)
    window.addEventListener('shroom-display-systems-updated', this.loadDynamicSensors)
    this.loadDynamicSensors()
    this.initializeLegacyState()
  }

  /** 重新读取后端已加载的 Display Systems，并同步前端运行时注册表。 */
  loadDynamicSensors = () => {
    fetch('http://127.0.0.1:19245/api/display-systems')
      .then((response) => response.json())
      .then((payload) => {
        const definitions = payload?.displaySystems?.runtimeDefinitions || []
        const dynamicSensors = definitions
          .map((definition) => registerRuntimeDisplayDefinition(definition))
          .filter(Boolean)
          .map((definition) => ({ label: definition.label, value: definition.type }))
        this.setState({ dynamicSensors })
      })
      .catch((error) => console.warn('[DisplaySystems] load failed', error))
  }

  initializeLegacyState() {
    if (this.props.matrixName === 'sitCol' || this.props.matrixName === 'handBlue') {
      if (localStorage.getItem('sitType1')) {
        console.log('localSetState')
        this.setState({
          items1: ['正常_1', '脊柱侧弯_2', '前倾_3', '驼背_4', '二郎腿_5', ...JSON.parse(localStorage.getItem('sitType1'))]
        })
      } else {
        console.log('setState')
        this.setState({
          items1: ['正常_1', '脊柱侧弯_2', '前倾_3', '驼背_4', '二郎腿_5']
        })
      }
    } else if (this.props.matrixName === 'matCol') {
      if (localStorage.getItem('sitType1')) {
        console.log('localSetState')
        this.setState({
          items1: ['其他_1', '平躺_2', '侧睡_3', '趴睡_4', '其他_5', ...JSON.parse(localStorage.getItem('sitType1'))]
        })
      } else {
        console.log('setState')
        this.setState({
          items1: ['其他_1', '平躺_2', '侧睡_3', '趴睡_4', '其他_5',]
        })
      }
    } else if (this.props.matrixName === 'matColPos') {
      if (localStorage.getItem('sitType1')) {
        console.log('localSetState')
        this.setState({
          items1: ['平躺_0', '左侧躺_1', '右侧躺_2', ...JSON.parse(localStorage.getItem('sitType1'))]
        })
      } else {
        console.log('setState')
        this.setState({
          items1: ['平躺_0', '左侧躺_1', '右侧躺_2',]
        })
      }
    }
  }

  componentWillUnmount() {
    window.removeEventListener('shroom-csv-download-status', this.handleCsvDownloadStatus)
    window.removeEventListener('shroom-display-systems-updated', this.loadDynamicSensors)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.matrixName !== this.props.matrixName && this.props.matrixName === 'humanBody') {
      this.setState({
        humanTransform: createDefaultHumanTransform(),
      })
    }
    if (this.state.jqbedAlgorithmConfigOpen && !this.canUseJqbedAlgorithmConfig()) {
      this.closeJqbedAlgorithmConfig();
    }
  }

  getSmallBed12BDisplayState = () => {
    if (this.props.matrixName !== smallBed12BType_title) return {};
    const matrixMode = this.props.smallBed12BRealtimeMatrixMode === '16x16' ? '16x16' : '32x32';
    const matrixSize = matrixMode === '16x16' ? 16 : 32;
    return {
      smallBed12BDisplayOptions: {
        matrixMode,
        samplePoint: this.props.smallBed12BRealtimeSamplePoint || 'topLeft',
      },
      smallBedMatrixWidth: matrixSize,
      smallBedMatrixHeight: matrixSize,
    };
  }

  withSmallBed12BDisplayOptions = (payload = {}) => {
    const displayState = this.getSmallBed12BDisplayState();
    if (!displayState.smallBed12BDisplayOptions) return payload;
    return {
      ...payload,
      smallBed12BDisplayOptions: displayState.smallBed12BDisplayOptions,
    };
  }

  withSmallBed12BDisplayState = (state = {}) => {
    const displayState = this.getSmallBed12BDisplayState();
    if (!displayState.smallBed12BDisplayOptions) return state;
    const { smallBed12BDisplayOptions, ...matrixState } = displayState;
    return {
      ...state,
      ...matrixState,
    };
  }


  onClick = (e) => {
    console.log('click ', e.key);
    this.props.data.current?.changeData({ meanPres: 0, maxPres: 0, point: 0, area: 0, totalPres: 0, pressure: 0 })
    if (this.props.matrixName === 'foot') { this.props.track.current?.canvasInit() }
    this.props.data.current?.initCharts()
    if (e.key === 'now') {
      // this.props.changeLocal(false)
      this.props.wsSendObj({
        play: false,
        local: false,
        history: false
      })
      this.props.changeStateData({ history: 'now', local: false })
    } else if (e.key === 'playback') {
      // this.props.changeLocal(true)
      this.props.wsSendObj(this.withSmallBed12BDisplayOptions({
        local: true,
        history: false
      }))
      this.props.changeStateData(this.withSmallBed12BDisplayState({ history: 'playback', index: 0, local: true }))



    } else {
      this.props.changeStateData(this.withSmallBed12BDisplayState({ history: 'history', index: 0, local: true }))
      // this.props.changeLocal(true)


      if (this.state.dataTime != '') {
        this.props.wsSendObj(this.withSmallBed12BDisplayOptions({
          local: true,
          history: true
        }))
      } else {
        this.props.wsSendObj(this.withSmallBed12BDisplayOptions({
          local: true,
          // history : true
        }))
      }
    }
    this.setState({
      current: e.key
    })
    // setCurrent(e.key);
  };

  onCarClick = (e) => {
    if (this.state.clickState) {
      if (e.key === 'sit') {
        this.setState({
          carCurrent: 'sit',
          clickState: false
        })

        if (this.props.numMatrixFlag == 'normal') this.props.com.current?.actionSit()
        this.props.changeStateData({ carState: 'sit' })
      } else if (e.key === 'back') {
        this.setState({
          carCurrent: 'back',
          clickState: false
        })
        if (this.props.numMatrixFlag == 'normal') this.props.com.current?.actionBack()
        this.props.changeStateData({ carState: 'back' })
      } else if (e.key === 'head') {
        this.setState({
          carCurrent: 'head',
          clickState: false
        })
        if (this.props.numMatrixFlag == 'normal') this.props.com.current?.actionHead()
        this.props.changeStateData({ carState: 'head' })
      } else {
        this.setState({
          carCurrent: 'all',
          clickState: false
        })
        if (this.props.numMatrixFlag == 'normal') this.props.com.current?.actionAll()
        this.props.changeStateData({ carState: 'all' })
        this.props.changeStateData({ numMatrixFlag: 'normal' })
      }
    }

    setTimeout(() => {
      this.setState({
        clickState: true
      })
    }, 1000);
  }

  changeNum = (num) => {
    this.setState({
      num: num
    })
  }

  onChange = (value) => {
    // this.props.changeStateData({ dataName: })
    this.setState({ realname: value })
    this.setState({ colName: value + this.state.realname1 })
  };

  onSearch = (value) => {
    console.log('search:', value);
  };

  filterOption = (input, option) =>
    (option?.label ?? '').toLowerCase().includes(input.toLowerCase());
  changeMatrixType(e) {
    // this.props.handleChangeCom(e);
    console.log(e);
    // file 切换移到 changeMatrix 中统一管理，确保 play:false 先于 file 到达后端
    this.props.changeMatrix(e)
    if (e === 'bigBed') {
      this.props.initBigCtx()
    } else if (e === 'sitCol') {
      if (localStorage.getItem('sitType1')) {
        console.log('localSetState')
        this.setState({
          items1: ['正常_1', '脊柱侧弯_2', '前倾_3', '驼背_4', '二郎腿_5', ...JSON.parse(localStorage.getItem('sitType1'))]
        })
      } else {
        console.log('setState')
        this.setState({
          items1: ['正常_1', '脊柱侧弯_2', '前倾_3', '驼背_4', '二郎腿_5']
        })
      }
    } else if (e === 'matCol') {
      if (localStorage.getItem('sitType1')) {
        console.log('localSetState')
        this.setState({
          items1: ['其他_1', '平躺_2', '侧睡_3', '趴睡_4', '其他_5', ...JSON.parse(localStorage.getItem('sitType1'))]
        })
      } else {
        console.log('setState')
        this.setState({
          items1: ['其他_1', '平躺_2', '侧睡_3', '趴睡_4', '其他_5',]
        })
      }
    }

    // this.props.changeDateArr(e.info)
    // if (ws && ws.readyState === 1)
    //   ws.send(JSON.stringify({ sitPort: e }));
  }


  onNameChange = (event) => {
    this.setState({ name: event.target.value });
    console.log(event.target.value)
    // this.setState({ colName:  event.target.value + timeStampToDateNospace(Date.parse(new Date())) })
  };
  addItem = (e) => {
    e.preventDefault();
    const items = this.state.items
    this.setState({ items: [...items, this.state.name], name: '' });
    // this.setState({});
    localStorage.setItem('sitType', JSON.stringify([...items, this.state.name]))
    setTimeout(() => {
      this.inputRef.current?.focus();
    }, 0);
  };

  onChange1 = (value) => {
    this.setState({ realname1: value })
    this.setState({ colName: this.state.realname + value })
  };

  onNameChange1 = (event) => {
    this.setState({ name1: event.target.value });
  };
  addItem1 = (e) => {
    e.preventDefault();
    const items = this.state.items1
    this.setState({ items1: [...items, this.state.name1], name1: '' });
    // this.setState({});
    localStorage.setItem('sitType1', JSON.stringify([...items, this.state.name1]))
    setTimeout(() => {
      this.inputRef.current?.focus();
    }, 0);
  };

  openCsvDownloadModal = () => {
    if (!this.state.dataTime) {
      message.warning(this.props.t('collection.chooseHistory'));
      return;
    }
    this.setState({
      csvDownloadModalOpen: true,
      csvDownloadStage: 'config',
      csvDownloadFiles: [],
      csvDownloadDir: this.state.csvDownloadPath || '',
      csvDownloadMessage: '',
      csvDownloadProgress: 0,
      csvDownloadProgressDetail: null,
    });
  }

  chooseCsvDownloadPath = async () => {
    if (!window.electronAPI?.invoke) {
      message.warning(this.props.t('csv.selectUnsupported'));
      return;
    }
    const result = await window.electronAPI.invoke('file-dialog', {
      properties: ['openDirectory', 'createDirectory'],
      title: this.props.t('csv.chooseFolderTitle'),
    });
    const selectedPath = result?.filePaths?.[0];
    if (selectedPath) {
      this.setState({ csvDownloadPath: selectedPath, csvDownloadDir: selectedPath });
      localStorage.setItem('csvDownloadPath', selectedPath);
    }
  }

  openCsvPath = async (targetPath) => {
    if (!targetPath) return;
    if (!window.electronAPI?.invoke) {
      message.warning(this.props.t('csv.openUnsupported'));
      return;
    }
    const result = await window.electronAPI.invoke('open-path', { filePath: targetPath });
    if (!result?.success) {
      message.error(result?.error || this.props.t('csv.openFailed'));
    }
  }

  startCsvDownload = async () => {
    if (!this.state.dataTime) {
      message.warning(this.props.t('collection.chooseHistory'));
      return;
    }
    if (this.state.csvDownloadFormat !== 'csv') {
      message.warning(this.props.t('csv.csvOnly'));
      return;
    }
    const downloadPath = (this.state.csvDownloadPath || '').trim();
    if (downloadPath && window.electronAPI?.invoke) {
      const validateResult = await window.electronAPI.invoke('validate-path', { path: downloadPath });
      if (!validateResult?.success) {
        message.error(this.props.t('csv.pathUnavailable', {
          error: validateResult?.error || this.props.t('csv.unknownError'),
        }));
        return;
      }
      localStorage.setItem('csvDownloadPath', downloadPath);
    }
    this.setState({
      csvDownloadStage: 'exporting',
      csvDownloadFiles: [],
      csvDownloadDir: downloadPath,
      csvDownloadProgress: 0,
      csvDownloadProgressDetail: null,
      csvDownloadMessage: this.props.t('csv.exportingShort'),
    });
    this.props.wsSendObj({
      download: this.state.dataTime,
      downloadOptions: {
        path: downloadPath,
        format: this.state.csvDownloadFormat,
        language: this.props.i18n?.language || 'zh',
      },
    });
  }

  handleCsvDownloadStatus(event) {
    const detail = event.detail || {};
    if (detail.csvDownloadProgress != null) {
      const progress = detail.csvDownloadProgress || {};
      this.setState({
        csvDownloadModalOpen: true,
        csvDownloadStage: 'exporting',
        csvDownloadDir: detail.downloadDir || progress.dir || this.state.csvDownloadDir || this.state.csvDownloadPath,
        csvDownloadProgress: Math.max(0, Math.min(100, Number(progress.percent) || 0)),
        csvDownloadProgressDetail: progress,
        csvDownloadMessage: progress.currentFile
          ? this.props.t('csv.exportingFile', { file: progress.currentFile })
          : this.props.t('csv.exportingShort'),
      });
      return;
    }
    if (!['export csv success', 'export csv failed'].includes(detail.download)) {
      return;
    }
    const nextFiles = Array.isArray(detail.downloadFiles) ? detail.downloadFiles : [];
    const mergedFiles = Array.from(new Set([...(this.state.csvDownloadFiles || []), ...nextFiles]));
    if (detail.download === 'export csv success') {
      this.setState({
        csvDownloadModalOpen: true,
        csvDownloadStage: 'done',
        csvDownloadFiles: mergedFiles,
        csvDownloadDir: detail.downloadDir || this.state.csvDownloadDir || this.state.csvDownloadPath,
        csvDownloadProgress: 100,
        csvDownloadMessage: detail.displayMsg || this.props.t('export csv success'),
      });
      return;
    }
    this.setState({
      csvDownloadModalOpen: true,
      csvDownloadStage: 'error',
      csvDownloadFiles: mergedFiles,
      csvDownloadDir: detail.downloadDir || this.state.csvDownloadDir || this.state.csvDownloadPath,
      csvDownloadMessage: detail.downloadError || detail.displayMsg || this.props.t('export csv failed'),
    });
  }

  renderCsvDownloadModal(t) {
    const stage = this.state.csvDownloadStage;
    const isConfig = stage === 'config';
    const isExporting = stage === 'exporting';
    const isDone = stage === 'done';
    const isError = stage === 'error';
    const fileList = this.state.csvDownloadFiles || [];
    const folderPath = this.state.csvDownloadDir || this.state.csvDownloadPath;
    const progressDetail = this.state.csvDownloadProgressDetail || {};
    const progressPercent = Math.max(0, Math.min(100, Math.round(Number(this.state.csvDownloadProgress) || 0)));
    const progressWritten = Number(progressDetail.written) || 0;
    const progressTotal = Number(progressDetail.total) || 0;

    return (
      <Modal
        title={isConfig ? t('csv.config') : t('csv.progress')}
        open={this.state.csvDownloadModalOpen}
        okText={isConfig ? t('csv.start') : t('common.close')}
        cancelText={t('common.cancel')}
        confirmLoading={isExporting}
        closable={!isExporting}
        maskClosable={!isExporting}
        onOk={isConfig ? this.startCsvDownload : () => this.setState({ csvDownloadModalOpen: false })}
        onCancel={() => {
          if (!isExporting) {
            this.setState({ csvDownloadModalOpen: false });
          }
        }}
        cancelButtonProps={{ style: isConfig ? undefined : { display: 'none' } }}
      >
        {isConfig ? (
          <Space direction='vertical' style={{ width: '100%' }} size={12}>
            <div>
              <div style={{ marginBottom: 4 }}>{t('csv.savePath')}</div>
              <Input
                placeholder={t('csv.defaultPath')}
                value={this.state.csvDownloadPath}
                onChange={(e) => this.setState({ csvDownloadPath: e.target.value })}
              />
            </div>
            <Space>
              <Button onClick={this.chooseCsvDownloadPath}>{t('csv.chooseFolder')}</Button>
              <Button disabled={!folderPath} onClick={() => this.openCsvPath(folderPath)}>{t('csv.openFolder')}</Button>
            </Space>
            <div>
              <div style={{ marginBottom: 4 }}>{t('csv.format')}</div>
              <Select
                style={{ width: '100%' }}
                value={this.state.csvDownloadFormat}
                onChange={(value) => this.setState({ csvDownloadFormat: value })}
                options={[{ label: 'CSV', value: 'csv' }]}
              />
            </div>
          </Space>
        ) : null}

        {isExporting ? (
          <div>
            <Progress percent={progressPercent} status='active' />
            <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
              {progressDetail.currentFile
                ? t('csv.fileProgress', { file: progressDetail.currentFile })
                : t('csv.preparingFile')}
            </div>
            <div style={{ color: '#666', fontSize: 12 }}>
              {progressTotal
                ? t('csv.rowProgress', {
                  written: progressWritten.toLocaleString(getLanguageLocale(this.props.i18n?.language)),
                  total: progressTotal.toLocaleString(getLanguageLocale(this.props.i18n?.language)),
                })
                : t('csv.calculatingRows')}
              {progressDetail.fileCount
                ? t('csv.fileCount', { index: progressDetail.fileIndex || 1, count: progressDetail.fileCount })
                : ''}
            </div>
            <p>{t('csv.exporting')}</p>
            <p style={{ color: '#666' }}>{t('csv.outputHint')}</p>
          </div>
        ) : null}

        {isDone ? (
          <Space direction='vertical' style={{ width: '100%' }} size={12}>
            <div>{this.state.csvDownloadMessage || t('export csv success')}</div>
            {fileList.length ? fileList.map((filePath) => (
              <div key={filePath} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filePath}</span>
                <Button size='small' onClick={() => this.openCsvPath(filePath)}>{t('common.open')}</Button>
              </div>
            )) : <div>{t('csv.noPath')}</div>}
            <Button disabled={!folderPath} onClick={() => this.openCsvPath(folderPath)}>{t('csv.openDownloadFolder')}</Button>
          </Space>
        ) : null}

        {isError ? (
          <Space direction='vertical' style={{ width: '100%' }} size={12}>
            <div style={{ color: '#ff4d4f' }}>{this.state.csvDownloadMessage || t('export csv failed')}</div>
            <Button disabled={!folderPath} onClick={() => this.openCsvPath(folderPath)}>{t('csv.openDownloadFolder')}</Button>
          </Space>
        ) : null}
      </Modal>
    );
  }

  getCollectionBaseName = () => {
    const manualName = (this.state.collectLabel || '').trim();
    const featureName1 = (this.state.realname || '').trim();
    const featureName2 = (this.state.realname1 || '').trim();
    return [manualName, featureName1, featureName2].filter(Boolean).join('_');
  }

  openCollectionModal = () => {
    this.setState({
      collectionModalOpen: true,
      collectLabel: this.state.collectLabel || '',
    });
  }

  closeCollectionModal = () => {
    this.setState({ collectionModalOpen: false });
  }

  stopCollection = () => {
    const flag = this.props.colFlag;
    this.props.wsSendObj({ colHZ: this.state.colHZ, flag });
    if (this.props.matrixName == 'sitCol' && loadData) {
      this.props.wsSendObj({
        colHZ: this.state.colHZ,
        download: loadData,
        downloadOptions: {
          language: this.props.i18n?.language || 'zh',
        },
      })
    }
    this.props.changeStateData({ colFlag: !flag });
    this.props.setColValueFlag(flag);
  }

  startCollectionWithOptions = () => {
    const formattedDate = Date.now();
    const baseName = this.getCollectionBaseName();
    const collectHz = Math.max(1, Number(this.state.colHZ) || 12);
    const frequencyMode = this.state.collectFrequencyMode === 'custom' ? 'custom' : 'serial';
    const collectOptions = {
      frequencyMode,
      frequencyHz: frequencyMode === 'custom' ? collectHz : null,
      matrixDownsample: { enabled: false },
    };
    const nextLoadData = baseName
      ? `${baseName}_${timeStampToDateNospace(formattedDate)} ${formattedDate}`
      : '';

    this.props.wsSendObj({
      colHZ: frequencyMode === 'custom' ? collectHz : null,
      flag: true,
      collectOptions,
      ...(nextLoadData ? { colName: nextLoadData } : { time: formattedDate }),
    });

    if (nextLoadData) {
      loadData = nextLoadData;
    } else {
      loadData = '';
    }

    this.props.changeStateData({ colFlag: false });
    this.props.setColValueFlag(true);
    this.setState({ collectionModalOpen: false, colHZ: collectHz });
  }

  renderCollectionModal(t) {
    return (
      <Modal
        className='collectionModal'
        title={t('collection.config')}
        open={this.state.collectionModalOpen}
        okText={t('collection.start')}
        cancelText={t('common.cancel')}
        onOk={this.startCollectionWithOptions}
        onCancel={this.closeCollectionModal}
        destroyOnHidden
      >
        <Space direction='vertical' style={{ width: '100%' }} size={12}>
          <div>
            <div style={{ marginBottom: 4 }}>{t('collection.name')}</div>
            <Input
              placeholder={t('collection.nameHint')}
              value={this.state.collectLabel}
              onChange={(e) => this.setState({ collectLabel: e.target.value })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>{t('collection.featureLabel')}</div>
            <div className='collectionHelpText'>
              {t('collection.featureHelp')}
            </div>
            <div className='collectionFeatureRow'>
              <div className='collectionFieldLabel'>{t('collection.feature1')}</div>
              <div className='collectionHelpText'>{t('collection.feature1Hint')}</div>
              <Select
                popupClassName='collectionSelectDropdown'
                style={{ width: '100%' }}
                placeholder={t('collection.selectFeature1')}
                value={this.state.realname || undefined}
                onChange={this.onChange}
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <Divider style={{ margin: '8px 0' }} />
                    <Space style={{ padding: '0 8px 4px' }}>
                      <Input
                        placeholder={t('collection.addLabel')}
                        ref={this.inputRef}
                        value={this.state.name}
                        onChange={this.onNameChange}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                      <Button icon={<PlusOutlined />} onClick={this.addItem}>{t('add')}</Button>
                      <Button onClick={() => {
                        this.setState({ items: [] })
                        localStorage.removeItem('sitType')
                      }}>{t('delete')}</Button>
                    </Space>
                  </>
                )}
                options={this.state.items.map((item) => ({
                  label: translateDomainLabel(item, t),
                  value: item,
                }))}
              />
            </div>
            <div className='collectionFeatureRow'>
              <div className='collectionFieldLabel'>{t('collection.feature2')}</div>
              <div className='collectionHelpText'>{t('collection.feature2Hint')}</div>
              <Select
                popupClassName='collectionSelectDropdown'
                style={{ width: '100%' }}
                placeholder={t('collection.selectFeature2')}
                value={this.state.realname1 || undefined}
                onChange={this.onChange1}
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <Divider style={{ margin: '8px 0' }} />
                    <Space style={{ padding: '0 8px 4px' }}>
                      <Input
                        placeholder={t('collection.addLabel')}
                        ref={this.inputRef1}
                        value={this.state.name1}
                        onChange={this.onNameChange1}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                      <Button icon={<PlusOutlined />} onClick={this.addItem1}>{t('add')}</Button>
                      <Button onClick={() => {
                        this.setState({ items1: [] })
                        localStorage.removeItem('sitType1')
                      }}>{t('delete')}</Button>
                    </Space>
                  </>
                )}
                options={this.state.items1.map((item) => ({
                  label: translateDomainLabel(item, t),
                  value: item,
                }))}
              />
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>{t('collection.frequency')}</div>
            <Radio.Group
              value={this.state.collectFrequencyMode}
              onChange={(e) => this.setState({ collectFrequencyMode: e.target.value })}
              optionType='button'
              buttonStyle='solid'
              options={[
                { label: t('collection.followSerial'), value: 'serial' },
                { label: t('collection.customFrequency'), value: 'custom' },
              ]}
            />
            {this.state.collectFrequencyMode === 'serial' ? (
              <div className='collectionHelpText' style={{ marginTop: 8 }}>
                {t('collection.serialRateHint')}
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <Input
                  type='number'
                  min={1}
                  step={1}
                  value={this.state.colHZ}
                  onChange={(e) => this.setState({ colHZ: e.target.value })}
                  addonAfter='Hz'
                />
                <div className='collectionHelpText' style={{ marginTop: 6 }}>
                  {t('collection.targetRateHint')}
                </div>
              </div>
            )}
          </div>
        </Space>
      </Modal>
    );
  }

  applySmallBed12BDisplaySettings = (next = {}) => {
    const matrixMode = next.matrixMode || this.state.smallBed12BRealtimeMatrixMode;
    const samplePoint = next.samplePoint || this.state.smallBed12BRealtimeSamplePoint;
    const normalizedMode = matrixMode === '16x16' ? '16x16' : '32x32';
    const normalizedSamplePoint = samplePoint || 'topLeft';
    localStorage.setItem('smallBed12BRealtimeMatrixMode', normalizedMode);
    localStorage.setItem('smallBed12BRealtimeSamplePoint', normalizedSamplePoint);
    this.setState({
      smallBed12BRealtimeMatrixMode: normalizedMode,
      smallBed12BRealtimeSamplePoint: normalizedSamplePoint,
    });
    this.props.changeStateData({
      numMatrixFlag: 'numoriginal',
      smallBed12BRealtimeMatrixMode: normalizedMode,
      smallBed12BRealtimeSamplePoint: normalizedSamplePoint,
      smallBedMatrixWidth: normalizedMode === '16x16' ? 16 : 32,
      smallBedMatrixHeight: normalizedMode === '16x16' ? 16 : 32,
    });
    this.props.wsSendObj({
      smallBed12BDisplayOptions: {
        matrixMode: normalizedMode,
        samplePoint: normalizedSamplePoint,
      },
    });
  }

  renderSmallBed12BDisplaySettings(t) {
    return (
      <Modal
        className='collectionModal'
        title={t('display.settings')}
        open={this.state.smallBed12BDisplaySettingsOpen}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        onOk={() => this.setState({ smallBed12BDisplaySettingsOpen: false })}
        onCancel={() => this.setState({ smallBed12BDisplaySettingsOpen: false })}
        destroyOnHidden
      >
        <Space direction='vertical' style={{ width: '100%' }} size={12}>
          <div>
            <div style={{ marginBottom: 4 }}>{t('display.realtimeMatrix')}</div>
            <Radio.Group
              value={this.state.smallBed12BRealtimeMatrixMode}
              onChange={(e) => this.applySmallBed12BDisplaySettings({ matrixMode: e.target.value })}
              optionType='button'
              buttonStyle='solid'
              options={[
                { label: '32x32', value: '32x32' },
                { label: '16x16', value: '16x16' },
              ]}
            />
            <div className='collectionHelpText' style={{ marginTop: 8 }}>
              {t('display.matrixHint')}
            </div>
          </div>
          {this.state.smallBed12BRealtimeMatrixMode === '16x16' ? (
            <div>
              <div style={{ marginBottom: 4 }}>{t('display.samplePosition')}</div>
              <Radio.Group
                value={this.state.smallBed12BRealtimeSamplePoint}
                onChange={(e) => this.applySmallBed12BDisplaySettings({ samplePoint: e.target.value })}
                optionType='button'
                buttonStyle='solid'
                options={[
                  { label: t('display.topLeft'), value: 'topLeft' },
                  { label: t('display.topRight'), value: 'topRight' },
                  { label: t('display.bottomLeft'), value: 'bottomLeft' },
                  { label: t('display.bottomRight'), value: 'bottomRight' },
                ]}
              />
            </div>
          ) : null}
        </Space>
      </Modal>
    );
  }

  openOneStepPdfModal = () => {
    if (!this.state.dataTime) {
      message.warning(this.props.t('collection.chooseExportData'));
      return;
    }
    this.setState({ pdfModalOpen: true });
  }

  generateOneStepPdfReport = async () => {
    const date = this.state.dataTime;
    const collectName = (this.state.realname || '').trim() || this.props.t('common.unknown');
    const collectAge = (this.state.collectAge || '').trim() || '0';
    const collectGender = this.state.collectGender || '男';
    const colName = this.state.colName || date;
    this.setState({ pdfLoading: true });
    const pdfMessageKey = 'oneStepPdfExport';
    configureOneStepPdfMessage();
    message.loading({ content: this.props.t('report.generating'), key: pdfMessageKey, duration: 0 });
    try {
      const res = await axios({
        method: 'post',
        url: 'http://127.0.0.1:19245/getDbHeatmap',
        data: { time: date, collectName, age: collectAge, gender: collectGender, date }
      });
      if (res.status !== 200 || res.data?.code !== 0) {
        message.error({ content: res.data?.message || this.props.t('report.peakFailed'), key: pdfMessageKey, duration: 3 });
        return;
      }

      const peakFrameData = res.data?.data?.peak_frame_data;
      if (!Array.isArray(peakFrameData) || peakFrameData.length < 4096) {
        message.error({ content: this.props.t('report.emptyPeak'), key: pdfMessageKey, duration: 3 });
        return;
      }

      const canvas = createOneStepPdfHeatmapCanvas(peakFrameData);
      if (!canvas) {
        message.error({ content: this.props.t('report.heatmapFailed'), key: pdfMessageKey, duration: 3 });
        return;
      }

      const blob = await canvasToPngBlob(canvas);
      if (!blob) {
        message.error({ content: this.props.t('report.exportHeatmapFailed'), key: pdfMessageKey, duration: 3 });
        return;
      }

      const formData = new FormData();
      formData.append('file', blob, 'canvas.png');
      formData.append('selector', '#uploadCanvas');
      formData.append('filename', encodeURIComponent(colName));
      formData.append('date', date);
      formData.append('collectName', encodeURIComponent(collectName));
      formData.append('age', collectAge);
      formData.append('gender', collectGender);

      const uploadRes = await axios.post('http://127.0.0.1:19245/uploadCanvas', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (uploadRes.data?.code !== 0) {
        message.error({ content: uploadRes.data?.message || this.props.t('report.pdfFailed'), key: pdfMessageKey, duration: 3 });
        return;
      }

      const pdfFilePath = uploadRes.data?.data?.pdfFilePath || '';
      this.setState({ pdfModalOpen: false });
      message.destroy(pdfMessageKey);
      setTimeout(() => {
        configureOneStepPdfMessage();
        if (this.props.messageApi) {
          this.props.messageApi.success(this.props.t('report.pdfSuccess'), 5);
        } else {
          message.success({ content: this.props.t('report.pdfSuccess'), duration: 5 });
        }
      }, 100);
      notification.success({
        message: this.props.t('report.reportSuccess'),
        description: pdfFilePath
          ? this.props.t('report.savedAt', { path: pdfFilePath })
          : this.props.t('report.generated'),
        duration: 0,
        btn: pdfFilePath ? (
          <Button
            size='small'
            type='primary'
            onClick={() => {
              if (window.electronAPI?.invoke) {
                window.electronAPI.invoke('open-folder', { filePath: pdfFilePath });
              }
            }}
          >{this.props.t('csv.openFolder')}</Button>
        ) : null,
      });
    } catch (err) {
      message.error({ content: err?.response?.data?.message || err?.message || this.props.t('report.requestFailed'), key: pdfMessageKey, duration: 3 });
    } finally {
      this.setState({ pdfLoading: false });
    }
  }

  /**
   * Determine which setting parameters to show based on matrixName + numMatrixFlag (display mode)
   * Returns JSX for the Drawer slider content
   */
  renderSettingSliders(t) {
    const matrixName = this.props.matrixName;
    const mode = this.props.numMatrixFlag; // 'normal' | 'num' | 'num3D' | 'numoriginal' | 'skin'
    const cacheMode = mode; // mode dimension for cache

    // Sensor type groups
    // 'carQX' 就是 chairQX，走的是 carQXFbx.jsx 的 3D 点场景，和 wholeChair 同一套
    // sitValue/backValue 接口，之前漏在 group1 外面，所以设置抽屉里一个滑块都不出。
    const group1 = ['hand', 'handSinglePoint', 'normal', 'footVideo', 'smallBed', smallBedNoAlgType_title, smallBed12BType_title, wholeChairType_title, minzhenType_title, 'carQX', 'jqbed', tempFullBedType_title, 'petCare', 'petCareMini', 'bed4096', 'bed4096num']; // 3D point scene / WebGL heatmap
    const group2 = ['robot1', 'robotSY', 'robotLCF']; // Robots
    const group3 = tactileGloveTypes_title; // Tactile gloves
    const group4 = ['fast256', 'fast1024', 'matCol']; // High-speed / compact matrix raw point renderers

    // Determine which parameters to show
    let showGuass = false;    // Smoothness
    let showSize = false;     // Size
    let showSpeed = false;    // Rotation speed
    let showColor = false;    // Color
    let showFilter = false;   // Filter value
    let showHeight = false;   // Height
    let showConsis = false;   // Data consistency
    let showInit = false;     // Initial value
    let showHumanTransform = false; // Human model transform

    if (isHumanBodyMatrixTitle(matrixName) && mode !== 'numoriginal') {
      showSize = true;
      showColor = true;
      showFilter = true;
      showHumanTransform = matrixName === 'humanBody';
    } else if (group1.includes(matrixName)) {
      if (mode === 'numoriginal' && ['hand', 'handSinglePoint', minzhenType_title, 'bed4096', 'bed4096num'].includes(matrixName)) {
        // raw data mode: no Gaussian; Gaussian only controls 3D point scenes.
        showColor = true;
        showFilter = true;
      } else if (matrixName === 'bed4096') {
        // bed4096 normal mode: WebGL heatmap - size, color, filter
        showSize = true;
        showColor = true;
        showFilter = true;
      } else if (matrixName === 'bed4096num') {
        // bed4096num normal mode: 3D point scene - smoothness, color, filter, height, consistency, init
        showGuass = true;
        showColor = true;
        showFilter = true;
        showHeight = true;
        showConsis = true;
        showInit = true;
      } else {
        // Group 1: 3D point scene - smoothness, color, filter, height, consistency, init
        showGuass = true;
        showColor = true;
        showFilter = true;
        showHeight = true;
        showConsis = true;
        showInit = true;
      }
    } else if (group2.includes(matrixName)) {
      if (mode === 'numoriginal') {
        // Robot raw data mode: only color
        showColor = true;
      } else {
        // Robot normal mode: size, color, filter, init, speed
        showSize = true;
        showColor = true;
        showFilter = true;
        showInit = true;
        showSpeed = true;
      }
    } else if (group3.includes(matrixName)) {
      if (mode === 'skin') {
        // Glove 3D skin mode: size, color, filter, init
        showSize = true;
        showColor = true;
        showFilter = true;
        showInit = true;
      } else if (['num3D', 'num', 'numoriginal'].includes(mode)) {
        // Glove 3D digit / 2D digit / raw data: only color
        showColor = true;
      } else {
        // Glove normal 3D mode: show all relevant
        showGuass = true;
        showColor = true;
        showFilter = true;
        showHeight = true;
        showConsis = true;
        showInit = true;
      }
    } else if (group4.includes(matrixName)) {
      // High-speed: color, filter, init
      showColor = true;
      showFilter = true;
      showInit = true;
    } else {
      // Other sensor types: show nothing for now
      return null;
    }

    // Helper to push value to component via ref methods
    const pushSitBack = (obj) => {
      if (this.props.com.current) {
        if (this.props.com.current.sitValue) {
          this.props.com.current.sitValue(obj);
        }
        if (this.props.com.current.backValue) {
          this.props.com.current.backValue(obj);
        }
      }
    };

    const pushChangeColor = (obj) => {
      if (this.props.com.current && this.props.com.current.changeColor) {
        this.props.com.current.changeColor(obj);
      }
    };

    const pushHumanTransform = (transformPatch) => {
      const nextTransform = {
        position: {
          ...this.state.humanTransform.position,
          ...(transformPatch.position ?? {}),
        },
        rotation: {
          ...this.state.humanTransform.rotation,
          ...(transformPatch.rotation ?? {}),
        },
      };

      this.setState({ humanTransform: nextTransform });

      if (this.props.com.current?.changeModelTransform) {
        this.props.com.current.changeModelTransform(transformPatch);
      }
    };

    const resetHumanTransform = () => {
      const defaultTransform = createDefaultHumanTransform();
      this.setState({ humanTransform: defaultTransform });

      if (this.props.com.current?.changeModelTransform) {
        this.props.com.current.changeModelTransform(defaultTransform);
      }
    };

    return (
      <div className='slideContent' style={{ width: '300px' }}>
        <div className="flexcenter" style={{ flex: 1, flexDirection: "column" }}>

          {/* Smoothness / Gaussian */}
          {showGuass && (
            <div className="progerssSlide" style={{ display: "flex", alignItems: "center" }}>
              <div className='dataTitle'>{t('guass')}</div>
              <Slider
                min={0.1} max={8} step={0.1}
                value={this.props.valueg1}
                onChange={(value) => {
                  localStorage.setItem("carValueg", value);
                  this.props.changeStateData({ valueg1: value });
                  changeLocalStroage({ sensorType: matrixName, valueType: 'valueg1', value, mode: cacheMode });
                  pushSitBack({ valueg: value });
                }}
                style={{ width: '200px' }}
              />
            </div>
          )}

          {/* Size */}
          {showSize && (
            <div className="progerssSlide" style={{ display: "flex", alignItems: "center" }}>
              <div className='dataTitle'>{t('size')}</div>
              <Slider
                min={1}
                max={isHumanBodyMatrixTitle(matrixName) ? 200 : 50}
                step={isHumanBodyMatrixTitle(matrixName) ? 1 : 0.1}
                value={isHumanBodyMatrixTitle(matrixName) ? (this.props.sizeValue ?? HUMAN_BODY_DEFAULT_SIZE) : undefined}
                onChange={(value) => {
                  if (isHumanBodyMatrixTitle(matrixName)) {
                    this.props.changeStateData({ sizeValue: value });
                  }
                  changeLocalStroage({ sensorType: matrixName, valueType: 'sizeValue', value, mode: cacheMode });
                  pushChangeColor({ size: value });
                }}
                style={{ width: '200px' }}
              />
            </div>
          )}

          {/* Rotation Speed */}
          {showSpeed && (
            <div className="progerssSlide" style={{ display: "flex", alignItems: "center" }}>
              <div className='dataTitle'>{t('speed')}</div>
              <Slider
                min={1} max={20} step={1}
                onChange={(value) => {
                  changeLocalStroage({ sensorType: matrixName, valueType: 'speedValue', value, mode: cacheMode });
                  pushChangeColor({ speedValue: value });
                }}
                style={{ width: '200px' }}
              />
            </div>
          )}

          {/* Color */}
          {showColor && (
            <div className="progerssSlide" style={{ display: "flex", alignItems: "center" }}>
              <div className='dataTitle'>{t('color')}</div>
              <Slider
                min={5} max={getColorSliderMax(matrixName)} step={getColorSliderStep(matrixName)}
                value={this.props.valuej1}
                onChange={(value) => {
                  localStorage.setItem("carValuej", value);
                  this.props.changeStateData({ valuej1: value });
                  changeLocalStroage({ sensorType: matrixName, valueType: 'valuej1', value, mode: cacheMode });
                  pushSitBack({ valuej: value });
                  pushChangeColor({ max: value });
                }}
                style={{ width: '200px' }}
              />
            </div>
          )}

          {/* Filter */}
          {showFilter && (
            <div className="progerssSlide" style={{ display: "flex", alignItems: "center" }}>
              <div className='dataTitle'>{t('filter')}</div>
              <Slider
                min={0} max={100} step={2}
                value={this.props.valuef1}
                onChange={(value) => {
                  localStorage.setItem("carValuef", value);
                  this.props.changeStateData({ valuef1: value });
                  changeLocalStroage({ sensorType: matrixName, valueType: 'valuef1', value, mode: cacheMode });
                  pushSitBack({ valuef: value });
                  pushChangeColor({ filter: value });
                }}
                style={{ width: '200px' }}
              />
            </div>
          )}

          {/* Height */}
          {showHeight && (
            <div className="progerssSlide" style={{ display: "flex", alignItems: "center" }}>
              <div className='dataTitle'>{t('height')}</div>
              <Slider
                min={0.1} max={15} step={0.02}
                value={this.props.value1}
                onChange={(value) => {
                  localStorage.setItem("carValue", value);
                  this.props.changeStateData({ value1: value });
                  changeLocalStroage({ sensorType: matrixName, valueType: 'value1', value, mode: cacheMode });
                  pushSitBack({ value: value });
                }}
                style={{ width: '200px' }}
              />
            </div>
          )}

          {/* Data Consistency */}
          {showConsis && (
            <div className="progerssSlide" style={{ display: "flex", alignItems: "center" }}>
              <div className='dataTitle'>{t('consis')}</div>
              <Slider
                min={1} max={20} step={1}
                value={this.props.valuel1}
                onChange={(value) => {
                  localStorage.setItem("carValuel", value);
                  this.props.changeStateData({ valuel1: value });
                  changeLocalStroage({ sensorType: matrixName, valueType: 'valuel1', value, mode: cacheMode });
                  pushSitBack({ valuel: value });
                }}
                style={{ width: '200px' }}
              />
            </div>
          )}

          {/* Initial Value */}
          {showInit && (
            <div className="progerssSlide" style={{ display: "flex", alignItems: "center" }}>
              <div className='dataTitle'>{t('init')}</div>
              <Slider
                min={1} max={5000} step={500}
                value={this.props.valuelInit1}
                onChange={(value) => {
                  localStorage.setItem("carValueInit", value);
                  this.props.changeStateData({ valuelInit1: value });
                  changeLocalStroage({ sensorType: matrixName, valueType: 'valuelInit1', value, mode: cacheMode });
                  pushSitBack({ valuelInit: value });
                }}
                style={{ width: '200px' }}
              />
            </div>
          )}

          {showHumanTransform && (
            <>
              <Divider style={{ borderColor: 'rgba(255,255,255,0.18)', margin: '12px 0 8px' }}>{t('display.humanTransform')}</Divider>

              <div className="progerssSlide" style={{ display: "flex", alignItems: "center" }}>
                <div className='dataTitle'>{t('display.positionX')}</div>
                <Slider
                  min={-200} max={200} step={0.5}
                  value={this.state.humanTransform.position.x}
                  onChange={(value) => pushHumanTransform({ position: { x: value } })}
                  style={{ width: '200px' }}
                />
              </div>

              <div className="progerssSlide" style={{ display: "flex", alignItems: "center" }}>
                <div className='dataTitle'>{t('display.positionY')}</div>
                <Slider
                  min={-200} max={200} step={0.5}
                  value={this.state.humanTransform.position.y}
                  onChange={(value) => pushHumanTransform({ position: { y: value } })}
                  style={{ width: '200px' }}
                />
              </div>

              <div className="progerssSlide" style={{ display: "flex", alignItems: "center" }}>
                <div className='dataTitle'>{t('display.positionZ')}</div>
                <Slider
                  min={-200} max={200} step={0.5}
                  value={this.state.humanTransform.position.z}
                  onChange={(value) => pushHumanTransform({ position: { z: value } })}
                  style={{ width: '200px' }}
                />
              </div>

              <div className="progerssSlide" style={{ display: "flex", alignItems: "center" }}>
                <div className='dataTitle'>{t('display.rotationX')}</div>
                <Slider
                  min={-180} max={180} step={1}
                  value={this.state.humanTransform.rotation.x}
                  onChange={(value) => pushHumanTransform({ rotation: { x: value } })}
                  style={{ width: '200px' }}
                />
              </div>

              <div className="progerssSlide" style={{ display: "flex", alignItems: "center" }}>
                <div className='dataTitle'>{t('display.rotationY')}</div>
                <Slider
                  min={-180} max={180} step={1}
                  value={this.state.humanTransform.rotation.y}
                  onChange={(value) => pushHumanTransform({ rotation: { y: value } })}
                  style={{ width: '200px' }}
                />
              </div>

              <div className="progerssSlide" style={{ display: "flex", alignItems: "center" }}>
                <div className='dataTitle'>{t('display.rotationZ')}</div>
                <Slider
                  min={-180} max={180} step={1}
                  value={this.state.humanTransform.rotation.z}
                  onChange={(value) => pushHumanTransform({ rotation: { z: value } })}
                  style={{ width: '200px' }}
                />
              </div>

              <Button style={{ marginTop: 8 }} onClick={resetHumanTransform}>{t('display.resetHuman')}</Button>
            </>
          )}

        </div>
      </div>
    );
  }

  requestJqbedAlgorithmConfig = () => {
    if (!this.canUseJqbedAlgorithmConfig()) return null;
    const requestId = crypto.randomUUID();
    const sent = this.props.wsSendObj({ getJqbedAlgorithmConfig: true, requestId });
    return sent ? requestId : null;
  }

  canUseJqbedAlgorithmConfig = () => {
    const access = getJqbedConfigAccess({
      matrixName: this.props.matrixName,
      history: this.props.history,
    });
    return access.visible && !access.disabled;
  }

  saveJqbedAlgorithmConfig = (values) => {
    if (!this.canUseJqbedAlgorithmConfig()) return null;
    const requestId = crypto.randomUUID();
    const sent = this.props.wsSendObj({ setJqbedAlgorithmConfig: values, requestId });
    return sent ? requestId : null;
  }

  resetJqbedAlgorithmConfig = () => {
    if (!this.canUseJqbedAlgorithmConfig()) return null;
    const requestId = crypto.randomUUID();
    const sent = this.props.wsSendObj({ resetJqbedAlgorithmConfig: true, requestId });
    return sent ? requestId : null;
  }

  closeJqbedAlgorithmConfig = () => {
    this.setState({ jqbedAlgorithmConfigOpen: false });
  }

  render() {
    const routerStr = this.props.matrixName == 'yanfeng10' ? '10a10' : this.props.matrixName == 'smallSample' ? '10a10' : this.props.matrixName == 'matCol' || this.props.matrixName == 'matColPos' ? '16a10' : this.props.matrixName == 'bed4096' ? '64a64' : this.props.matrixName == 'carCol' ? '10a9' : '32a32'
    const { t, i18n } = this.props;
    const jqbedConfigAccess = getJqbedConfigAccess({
      matrixName: this.props.matrixName,
      history: this.props.history,
    });


    // 全量传感器类型列表
    const builtInSensorArr = [
      { label: t('sensorHand'), value: 'hand' },
      { label: t('sensorHand0205'), value: 'hand0205' },
      { label: t('sensorHand0205Double'), value: 'hand0205Double' },
      { label: t('sensorHandGlove115200'), value: 'handGlove115200' },
      { label: t('sensorHandGloveFullPacket'), value: 'handGloveFullPacket' },
      { label: t('sensorSmallSample'), value: 'smallSample' },
      { label: t('sensorRobot1'), value: 'robot1' },
      { label: t('sensorRobotSY'), value: 'robotSY' },
      { label: t('sensorRobotLCF'), value: 'robotLCF' },
      { label: t('sensorFootVideo'), value: 'footVideo' },
      { label: t('sensorDaliegu'), value: 'daliegu' },
      { label: t('sensorBed4096num'), value: 'bed4096num' },
      { label: t('sensorBed4096'), value: 'bed4096' },
      { label: t('sensorJqbed'), value: 'jqbed' },
      { label: t('sensorSmallBedNoAlg'), value: smallBedNoAlgType_title },
      { label: t('sensorSmallBed12B'), value: smallBed12BType_title },
      { label: t('sensorMatCol'), value: 'matCol' },
      { label: t('sensorTempFullBed'), value: tempFullBedType_title },
      { label: t('sensorPetCare'), value: 'petCare' },
      { label: t('sensorPetCareMini'), value: 'petCareMini' },
      { label: t('sensorWholeChair'), value: wholeChairType_title },
      { label: t('sensorMinzhen'), value: minzhenType_title },
      { label: t('sensorFast256'), value: 'fast256' },
      { label: t('sensorFast1024'), value: 'fast1024' },
      { label: t('sensorHandSinglePoint'), value: 'handSinglePoint' },
      { label: t('sensorNormal'), value: 'normal' },
      { label: t('sensorHumanBody'), value: 'humanBody' },
      { label: t('chairQX'), value: 'carQX' },
      { label: t('sensorHumanBodyOptimized'), value: HUMAN_BODY_OPTIMIZED_MATRIX },
    ]

    const sensorArr = buildAccessibleSensorOptions({
      builtInSensors: builtInSensorArr,
      dynamicSensors: this.state.dynamicSensors,
      allowedTypes: this.props.allowedTypes,
    });

    const navItems = [
      {
        label: t('realTime'),
        key: 'now',
      },
      {
        label: t('playBack'),
        key: 'playback',
      },
    ];

    const carItems = this.props.matrixName === minzhenType_title ? [
      {
        label: t('all'),
        key: 'all',
      },
      {
        label: t('sit'),
        key: 'sit',
      },
    ] : [
      {
        label: t('all'),
        key: 'all',
      },
      {
        label: t('back'),
        key: 'back',
      },
      {
        label: t('sit'),
        key: 'sit',
      }, {
        label: t('head'),
        key: 'head',
      },
    ];
    const isMinzhenAnimationMode = this.props.matrixName === minzhenType_title && this.props.numMatrixFlag === 'normal';
    // console.log('title')
    return <div className="title">
      {/* <h2>bodyta</h2> */}
      <div className="titleBrand">
        <img className="titleBrandLogo" src={logo} alt="JQ Industries" />
        <img className="titleBrandWordmark" src={shroomWordmark} alt="Shroom" />
      </div>
        <div className="titleItems">
          <Button
            className="titleButton"
            icon={<SettingOutlined />}
            title="展示系统配置器"
            aria-label="展示系统配置器"
            onClick={() => this.props.openDisplaySystemBuilder?.()}
          />
          <Select
          style={{ width: '130px' }}
          placeholder={t('chooseSensor')}
          value={this.props.matrixName}
          onChange={(e) => {
            this.changeMatrixType(e)
            if (!isHumanBodyMatrixTitle(e)) {
              this.props.changeStateData({
                numMatrixFlag: 'normal'
              })
            }

            this.props.wsSendObj({ resetZero: false })
            this.setState({ resetZero: false, dataTime: '' })

            this.props.changeStateData({
              portname: '',
              portnameBack: '',
              portnameHead: '',
              portnameSensor: ''
            })
            this.props.wsSendObj({ serialReset: true })
          }}
          options={sensorArr}
        />


        {
          this.props.matrixName.includes('fast') || this.props.matrixName == 'normalFast' || this.props.matrixName == 'bed4096' || this.props.matrixName == 'bed4096num' || this.props.matrixName == 'bed1616' || this.props.matrixName == 'fast256' || this.props.matrixName == 'footVideo256' || this.props.matrixName == 'daliegu' || this.props.matrixName == 'smallSample' ? <Input placeholder={t('enterBaudRate')} onChange={(e) => {
            const value = e.target.value
            this.props.wsSendObj({
              baudRate: value
            })
          }} /> : ''
        }

        <Menu className='menu' onClick={this.onClick} selectedKeys={[this.state.current]} mode="horizontal" items={navItems} />
        {this.props.matrixName != 'localCar' ? this.props.history === 'now' ? this.props.matrixName != 'car' && this.props.matrixName != 'car10' && this.props.matrixName != 'sofa' && this.props.matrixName != 'yanfeng10' && this.props.matrixName != 'volvo' && this.props.matrixName != 'carQX' && this.props.matrixName != wholeChairType_title && this.props.matrixName != minzhenType_title && this.props.matrixName != 'hand0507' && !tactileGloveTypes_title.includes(this.props.matrixName) && this.props.matrixName != 'footVideo' && this.props.matrixName != 'eye' ? <><Select

          style={{ marginRight: 6, width: 140 }}
          placeholder={t('chooseSensor')}
          value={this.props.portname || undefined}
          onOpenChange={() => {
            this.props.wsSendObj({ serialReset: true })
          }}

          onSelect={(e) => {
            this.props.wsSendObj({ sitPort: e })
            this.props.changeStateData({ portname: e })

          }}
          options={this.props.port}
        >
        </Select> <div></div></> : <><Select

          style={{ marginRight: 6, width: 140 }}
          placeholder={tactileGloveTypes_title.includes(this.props.matrixName) ? t('chooseLeftSensor') : this.props.matrixName == 'footVideo' ? t('chooseLeftFootSensor') : t('chooseSitSensor')}
          value={this.props.portname ? `${this.props.portname}${[...tactileGloveTypes_title, 'footVideo', 'eye'].includes(this.props.matrixName) ? t('left') : (t('sit'))}` : undefined}
          onOpenChange={() => {
            this.props.wsSendObj({ serialReset: true })
          }}
          onSelect={(e) => {

            console.log(e);
            this.props.wsSendObj({ sitPort: e })
            this.props.changeStateData({ portname: e })
            this.props.changeStateData({
              hand: true
            })
            if (this.props.com.current?.changeModal) this.props.com.current?.changeModal(true)

          }}
          options={this.props.port}
        >
        </Select>


          {this.props.matrixName === minzhenType_title ? <Select
            placeholder={t('minzhen.otherData')}
            style={{ marginRight: 6, width: 160 }}
            value={this.props.portnameSensor ? `${this.props.portnameSensor} (${t('minzhen.otherData')})` : undefined}
            onOpenChange={() => {
              this.props.wsSendObj({ serialReset: true })
            }}
            onSelect={(e) => {
              console.log(e);
              this.props.wsSendObj({ sensorPort: e })
              this.props.changeStateData({ portnameSensor: e })
            }}
            options={this.props.port}
          >
          </Select> : null}


          {this.props.matrixName !== minzhenType_title ? <Select
            // value={this.props.portnameBack}
            placeholder={tactileGloveTypes_title.includes(this.props.matrixName) ? t('chooseRightSensor') : this.props.matrixName == 'footVideo' ? t('chooseRightFootSensor') : t('chooseBackSensor')}
            style={{ marginRight: 6, width: 140 }}
            value={this.props.portnameBack ? `${this.props.portnameBack}${[...tactileGloveTypes_title, 'footVideo'].includes(this.props.matrixName) ? t('right') : (t('back'))}` : undefined}
            onOpenChange={() => {
              this.props.wsSendObj({ serialReset: true })
            }}
            onSelect={(e) => {
              // this.props.handleChangeCom(e);
              console.log(e);
              this.props.wsSendObj({ backPort: e })

              this.props.changeStateData({ portnameBack: e })

              this.props.changeStateData({
                hand: false
              })
              if (this.props.com.current?.changeModal) this.props.com.current?.changeModal(false)

            }}

            options={this.props.port}
          >
          </Select> : null}

          {this.props.matrixName == 'volvo' || this.props.matrixName == 'carQX' || this.props.matrixName == wholeChairType_title ? <Select
            // value={this.props.portnameBack}
            placeholder={t('chooseHeadSensor')}
            style={{ width: 140 }}
            value={this.props.portnameHead ? `${this.props.portnameHead}(${t('head')})` : undefined}
            onOpenChange={() => {
              this.props.wsSendObj({ serialReset: true })
            }}
            onSelect={(e) => {
              // this.props.handleChangeCom(e);
              console.log(e);
              this.props.wsSendObj({ headPort: e })
              this.props.changeStateData({ portnameHead: e })

            }}

            options={this.props.port}
          >
          </Select> : null}

        </> : <Select
          // value={this.props.dataArr}
          placeholder={t('choosePlaybackTime')}
          style={{ marginRight: 20 }}
          onChange={(e) => {
            // this.props.handleChangeCom(e);
            if (this.props.matrixName === 'foot') {
              this.props.track.current?.canvasInit()
            }

            console.log(e);
            this.props.changeStateData({ dataTime: e })
            this.setState({ dataTime: e })
            this.props.wsSendObj(this.withSmallBed12BDisplayOptions({ getTime: e, index: 0 }))
            if (this.props.history === 'history') {
              this.props.wsSendObj(this.withSmallBed12BDisplayOptions({ getTime: e, index: 0, history: true }))
            } else {
              this.props.wsSendObj(this.withSmallBed12BDisplayOptions({ getTime: e, index: 0 }))
            }
            // this.props.wsSendObj({port : e})
            // if (ws && ws.readyState === 1)
            //   ws.send(JSON.stringify({ sitPort: e }));
          }}
          value={this.state.dataTime || undefined}
          options={this.props.dataArr}
        >

        </Select> :
          <>
            <Input value={this.state.ip} onChange={(e) => {
              localStorage.setItem('ip', e.target.value)
              this.setState({ ip: e.target.value })
            }} placeholder={t('display.ipPlaceholder')} />
            <Button onClick={() => { this.props.changeWs(this.state.ip) }}>{t('display.connect')}</Button>
          </>

        }




        {this.props.matrixName != 'car10' && [...tactileGloveTypes_title, 'footVideo', 'robot1', 'robotSY', 'robotLCF', 'hand', 'handSinglePoint', 'normal', 'smallBed', smallBedNoAlgType_title, smallBed12BType_title, 'matCol', 'jqbed', tempFullBedType_title, 'petCare', 'petCareMini', minzhenType_title, 'daliegu', 'smallSample', 'bed4096', 'bed4096num', 'humanBody', HUMAN_BODY_OPTIMIZED_MATRIX].includes(this.props.matrixName) ?
          <Select
            defaultValue={this.props.numMatrixFlag}
            style={{ width: 90 }}
            value={this.props.numMatrixFlag}
            onChange={(value) => {
              // Load cached config for the new mode
              const modeConfig = getConfig({ sensorType: this.props.matrixName, mode: value })
              this.props.changeStateData({ numMatrixFlag: value, ...modeConfig })

              if (calibratableGloveTypes_title.includes(this.props.matrixName)) {
                if (['normal', 'skin'].includes(this.props.numMatrixFlag)) {
                  this.props.com.current?.changeModal(this.props.hand)
                }

                if (value == 'normal') {
                  // 检查手指校准数据是否存在
                  const fingerL = localStorage.getItem('fingerArrL')
                  const fingerR = localStorage.getItem('fingerArrR')
                  if (!fingerL && !fingerR) {
                    message.warning(t('noCalibData'))
                  } else if (!fingerL) {
                    message.warning(t('noCalibDataL'))
                  } else if (!fingerR) {
                    message.warning(t('noCalibDataR'))
                  }
                }
              }

              // 清零决策见 displaySwitchZeroPolicy.js：演示场景每次切换都以当下读数为零点，
              // 真实场景一律不动基准（清零只走抽屉里的手动按钮）。手套切 3D 遥操是唯一
              // 与场景无关的例外 —— 遥操必须跑在未清零数据上，两种场景都取消清零。
              const zeroCommand = resolveDisplaySwitchZero({
                sensorType: this.props.matrixName,
                nextMode: value,
                scene: this.state.pressureScene,
                cancelZeroSensorTypes: calibratableGloveTypes_title,
              })
              if (zeroCommand) {
                this.props.wsSendObj(zeroCommand)
                this.setState({ resetZero: zeroCommand.resetZero })
              }
            }}
            options={this.props.matrixName === smallBed12BType_title ? [
              { value: 'numoriginal', label: t('rawData') },
            ] : this.props.matrixName === fullPacketGloveType_title ? [
              { value: 'num', label: t('data2D') },
              { value: 'numoriginal', label: t('rawData') },
            ] : tactileGloveTypes_title.includes(this.props.matrixName) ? [
              { value: 'num', label: t('data2D') },
              { value: 'normal', label: t('tel3D') },
              { value: 'num3D', label: t('data3D') },
              { value: 'numoriginal', label: t('rawData') },
              { value: 'skin', label: t('skin3D') },
            ] : this.props.matrixName == 'footVideo' ? [
              { value: 'num', label: t('data2D') },
              { value: 'normal', label: t('modal3D') },
              { value: 'numoriginal', label: t('rawData') },
            ] : this.props.matrixName.includes('robot') ? [
              { value: 'normal', label: t('modal3D') },
              { value: 'numoriginal', label: t('rawData') },
            ] : this.props.matrixName === tempFullBedType_title ? [
              { value: 'normal', label: t('modal3D') },
              { value: 'numoriginal', label: t('rawData') },
            ] : ['hand', 'handSinglePoint', 'normal', 'smallBed', smallBedNoAlgType_title, smallBed12BType_title, 'matCol', 'jqbed', 'petCare', 'petCareMini', minzhenType_title, 'daliegu', 'smallSample'].includes(this.props.matrixName) ? [
              { value: 'normal', label: t('modal3D') },
              { value: 'numoriginal', label: t('rawData') },
            ] : this.props.matrixName == 'bed4096' || this.props.matrixName == 'bed4096num' ? [
              { value: 'normal', label: t('modal3D') },
              { value: 'numoriginal', label: t('rawData') },
            ] : isHumanBodyMatrixTitle(this.props.matrixName) ? [
              { value: 'skin', label: t('skin3D') },
              { value: 'numoriginal', label: t('rawData') },
            ] : []}
          /> : ''
        }

        {this.props.matrixName === smallBed12BType_title ? (
          <Button
            className='titleButton'
            onClick={() => this.setState({ smallBed12BDisplaySettingsOpen: true })}
          >
            {t('display.settings')}
          </Button>
        ) : null}

        {
          calibratableGloveTypes_title.includes(this.props.matrixName) ?
            <Modal
              mask={false}
              width={450}
              className='calibModal'
              title={t('deviceCal')}
              closable={{ 'aria-label': 'Custom Close Button' }}
              open={this.props.calibration}
              onOk={() => {
                this.props.changeStateData({
                  calibration: false
                })
              }}
              onCancel={() => {
                this.props.changeStateData({
                  calibration: false
                })
              }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                <Select
                  defaultValue={this.state.calibHand || 'left'}
                  style={{ width: 100 }}
                  onChange={(e) => {
                    this.setState({ calibHand: e })
                  }}
                  options={[
                    { value: 'left', label: t('leftHand') },
                    { value: 'right', label: t('rightHand') },
                  ]}
                />
                <Select
                  defaultValue={this.state.fingerIndex}
                  style={{ width: 120 }}
                  onChange={(e) => {
                    this.setState({
                      fingerIndex: e
                    })
                    if (e == 1) {
                      this.props.com.current?.calibration(new Array(5).fill(1))
                    } else {
                      this.props.com.current?.calibration(new Array(5).fill(0))
                    }
                  }}
                  options={[
                    { value: 0, label: t('FingersSpread') },
                    { value: 1, label: t('fist') },
                  ]}
                />
              </div>

              <Button
                onClick={() => {
                  this.props.colFingerData(this.state.fingerIndex, this.state.calibHand || 'left')
                }}
              >{t('colData')}</Button>
              <Button
                onClick={() => {
                  localStorage.removeItem('fingerArrL')
                  localStorage.removeItem('fingerArrR')
                }}
              >{t('clearData')}</Button>

            </Modal>
            : ""
        }



        {/* {this.props.matrixName == 'hand0205' || this.props.matrixName == 'handGlove115200' ?
          <div className="asideContent firstAside" style={{
            position: 'absolute', right: '20%', top: '80px',
            opacity: this.props.calibration ? 1 : 0, transition: 'opacity 0.5s ease', border: '1px solid #2a5bc5',
            flexDirection: 'column'
          }}>

            <h2 className="asideTitle">设备校准</h2>
            <Select
              defaultValue={this.state.fingerIndex}
              style={{ width: 120 }}
              onChange={(e) => {
                this.setState({
                  fingerIndex: e
                })
                if (e == 1) {
                  this.props.com.current?.calibration(new Array(5).fill(1))
                } else {
                  this.props.com.current?.calibration(new Array(5).fill(0))
                }
              }}
              options={[
                { value: 0, label: '手指平铺' },
                { value: 1, label: '手指握拳' },
              ]}
            />

            <Button
              onClick={() => {
                this.props.colFingerData(this.state.fingerIndex, this.state.calibHand || 'left')
              }}
            >采集数据</Button>
            <Button
              onClick={() => {
                localStorage.removeItem('fingerArrL')
                localStorage.removeItem('fingerArrR')
              }}
            >清除历史数据</Button>
            <div>
              <Button>完成</Button>
            </div>


          </div>
          : ''} */}

        {/* {this.props.matrixName == 'hand0205' ?
          <Select
            defaultValue={this.props.hand}
            style={{ width: 80 }}
            onChange={(e) => {
              console.log(e)
              this.props.changeStateData({
                hand: e
              })
              this.props.com.current?.changeModal(e)
            }}
            options={[
              { value: true, label: t('leftHand') },
              { value: false, label: t('rightHand') },
            ]}
          />

          : ''} */}


        {calibratableGloveTypes_title.includes(this.props.matrixName) && this.props.numMatrixFlag == 'normal' ? <Button className='titleButton'
          onClick={() => {
            // this.props.com.current?.calibration()
            // this.setState({
            //   calibration: !this.state.calibration
            // })



            // 校准弹框
            this.props.changeCalibration()

            // 手固定
            this.props.com.current?.handZero()
          }}
        >{t('calib')}</Button> : calibratableGloveTypes_title.includes(this.props.matrixName) && this.props.numMatrixFlag == 'skin' ? <Button className='titleButton'
          onClick={() => {
            // this.props.com.current?.calibration()
            // this.setState({
            //   calibration: !this.state.calibration
            // })
            // this.props.changeCalibration()
            this.props.com.current?.handZero()
          }}
        >{t('display.fixed')}</Button> : ''}

        <Button onClick={() => {
          this.props.wsSendObj({
            sitClose: true,
            backClose: true,
            headClose: true,
            sensorClose: true
          })
          // 清空前端串口选择状态
          this.props.changeStateData({
            portname: '',
            portnameBack: '',
            portnameHead: '',
            portnameSensor: ''
          })
        }} className='titleButton'>
          {t('closeSensor')}
        </Button>




        <Select
          defaultValue={this.props.i18n.language}
          style={{ width: 108 }}
          onChange={(value) => {
            localStorage.setItem('language', value)
            this.props.i18n.changeLanguage(value)
          }}
          options={[
            { value: 'zh', label: t('common.chinese') },
            { value: 'en', label: t('common.english') },
            { value: 'ja', label: t('common.japanese') },
          ]}
        />


        {this.props.matrixName == 'car' || this.props.matrixName == 'car10' || this.props.matrixName == 'localCar' || this.props.matrixName == 'yanfeng10' || this.props.matrixName == 'volvo' || isMinzhenAnimationMode ?


          <Menu className='menu' onClick={this.onCarClick} selectedKeys={[this.state.carCurrent]} mode="horizontal" items={carItems} />
          : null}
        {!this.props.local ?
          <>
            {/* {this.props.matrixName == 'car' ? <Input placeholder='输入采集文件名称' onChange={(e) => { this.setState({ colName: e.target.value }) }} /> : null} */}

            {this.props.matrixName == 'localCar' ?
              <Input placeholder={t('collection.featureLabel')} onChange={(e) => { this.props.changeStateData({ dataName: e.target.value }) }} />
              : null}
            {/* <Input type='number' placeholder={t('enterColHZ')} onChange={(e) => { this.setState({ colHZ: e.target.value }) }} /> */}
            <Button
              className='titleButton'
              onClick={() => {

                if (this.props.matrixName !== 'localCar') {
                  const flag = this.props.colFlag
                  if (flag) {
                    this.openCollectionModal()
                  } else {
                    this.stopCollection()
                  }
                } else {

                  const flag = this.props.colWebFlag
                  console.log(flag)
                  this.props.changeStateData({ colWebFlag: !flag })
                }
              }}>{this.props.colFlag ? t('col') : t('stop')}{this.props.matrixName == 'localCar' ? this.props.length - 1 : Math.ceil(this.state.num)}
            </Button>
            {this.props.matrixName == 'localCar' ?

              <>
                <Button onClick={() => {
                  this.props.colPushData()
                }} className='titleButton'>
                  {t('display.singleCollection')}
                </Button>
                <Button className='titleButton'>
                  <CSVLink
                    // ref={downloadRef}

                    filename={`${new Date().getTime()}.csv`}
                    data={this.props.csvData}
                    style={{ color: '#5A5A89', textDecoration: 'none' }}
                  >
                    {t('download')}
                  </CSVLink> </Button> </> : null}

            {this.props.matrixName == 'localCar' ?
              <Button className='titleButton' onClick={() => {

                this.props.delPushData()
              }}>{t('delete')}</Button> : null}
          </>
          : <> <Button
            className='titleButton'
            onClick={this.openCsvDownloadModal}
          >{t('download')}</Button>
            <Button
              className='titleButton'
              onClick={() => {
                this.props.wsSendObj({ delete: this.state.dataTime })
              }}
            >{t('delete')}</Button>

          </>
        }

        {
          this.props.matrixName === 'car' && this.props.local ? <Button className='titleButton' onClick={() => {
            this.props.wsSendObj({ variety: true })
          }} >{t('display.pressureChange')}</Button> : null
        }

        {this.props.matrixName === 'bigBed' ? <Button className='titleButton' onClick={() => {
          const flag = this.props.pressChart
          this.props.changeStateData({ pressChart: !flag })
          this.props.initBigCtx()
        }}>{t('display.pressureCurve')}</Button> : null}

        {this.props.matrixName === 'bigBed' ? <Button className='titleButton' onClick={() => {

          if (this.props.com.current) {
            this.props.com.current.logData()
          }
          // this.props.initPressCtx()
        }}>{t('display.printCurve')}</Button> : null}



        {this.props.matrixName == 'foot' ? <Button
          className='titleButton'
          onClick={() => {
            const flag = this.props.centerFlag
            this.props.changeStateData({ centerFlag: !flag })
            console.log(this.props.com.current)
            this.props.com.current?.changeCenterFlag(flag)
            if (flag) {
              this.props.track.current?.canvasInit()
            }
          }}>{!this.props.centerFlag ? t('display.centerOfPressure') : t('display.hide')}</Button> : null}
        {this.props.matrixName === 'bed4096' && this.props.local ? (
          <>
            <Button
              className='titleButton'
              disabled={!this.state.dataTime || this.state.pdfLoading}
              loading={this.state.pdfLoading}
              onClick={this.openOneStepPdfModal}
            >{t('report.exportPdf')}</Button>
            <Modal
              title={t('report.formTitle')}
              open={this.state.pdfModalOpen}
              confirmLoading={this.state.pdfLoading}
              okText={t('report.generate')}
              cancelText={t('common.cancel')}
              onOk={this.generateOneStepPdfReport}
              onCancel={() => this.setState({ pdfModalOpen: false })}
              destroyOnHidden
            >
              <Space direction='vertical' style={{ width: '100%' }} size={12}>
                <div>
                  <div style={{ marginBottom: 4 }}>{t('report.name')}</div>
                  <Input
                    placeholder={t('report.namePlaceholder')}
                    value={this.state.realname}
                    onChange={(e) => this.setState({ realname: e.target.value })}
                  />
                </div>
                <div>
                  <div style={{ marginBottom: 4 }}>{t('report.age')}</div>
                  <Input
                    placeholder={t('report.agePlaceholder')}
                    value={this.state.collectAge}
                    onChange={(e) => this.setState({ collectAge: e.target.value })}
                  />
                </div>
                <div>
                  <div style={{ marginBottom: 4 }}>{t('report.gender')}</div>
                  <Select
                    style={{ width: '100%' }}
                    value={this.state.collectGender}
                    onChange={(e) => this.setState({ collectGender: e })}
                    options={[
                      { label: t('common.male'), value: '男' },
                      { label: t('common.female'), value: '女' },
                    ]}
                  />
                </div>
              </Space>
            </Modal>
          </>
        ) : null}
      </div>


      {
        this.props.matrixName == 'Num3D' ? <Select
          // value={this.props.portnameBack}
          placeholder={t('chooseBackSensor')}
          style={{ marginRight: 20, width: 60 }}

          onOpenChange={() => {}}
          onSelect={(e) => {

            // if (e == 1) {
            //   this.props.com.current?.calibration(new Array(5).fill(1))
            // } else {
            //   this.props.com.current?.calibration(new Array(5).fill(0))
            // }
            this.props.changeStateData({ showType: e })


          }}

          options={[
            { value: 'finger', label: t('display.middleFinger') },
            { value: 'palm', label: t('display.palm') },
            { value: 'hand', label: t('display.wholeHand') },
          ]}
        ></Select> : ''
      }

      {this.renderCsvDownloadModal(t)}
      {this.renderCollectionModal(t)}
      {this.renderSmallBed12BDisplaySettings(t)}

      <JqbedAlgorithmConfigModal
        open={this.state.jqbedAlgorithmConfigOpen}
        envelope={this.props.jqbedAlgorithmConfig}
        operationResult={this.props.jqbedAlgorithmConfigResult}
        algorithmStatus={this.props.jqbedAlgorithmStatus}
        connected={this.props.wsConnected}
        connectionEpoch={this.props.wsConnectionEpoch}
        onRequest={this.requestJqbedAlgorithmConfig}
        onSave={this.saveJqbedAlgorithmConfig}
        onReset={this.resetJqbedAlgorithmConfig}
        onClose={this.closeJqbedAlgorithmConfig}
      />

      {jqbedConfigAccess.visible ? (
        <Tooltip title={t(jqbedConfigAccess.tooltipKey)}>
          <span
            className="jqbedAlgorithmConfigTooltipTarget"
            tabIndex={jqbedConfigAccess.disabled ? 0 : undefined}
          >
            <button
              type="button"
              className="jqbedAlgorithmConfigTrigger"
              disabled={jqbedConfigAccess.disabled}
              onClick={() => this.setState({ jqbedAlgorithmConfigOpen: true })}
              aria-label={t('jqbedAlgorithmConfig.open')}
            >
              <SlidersOutlined />
            </button>
          </span>
        </Tooltip>
      ) : null}

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img onClick={() => {
          const show = this.state.show
          this.setState({
            open: true
          })
        }} className='optionImg' src={option} alt="" />
        <Drawer style={{ backgroundColor: 'rgba(21,18,42,0.8)' }} title={t('setData')} onClose={() => { this.setState({ open: false }) }} open={this.state.open}>
          {this.renderSettingSliders(t)}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 演示场景 / 真实场景：决定切展示模式时要不要自动做预压力清零 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ color: '#fff', fontSize: 13 }}>{t('pressureScene.label')}</span>
              <Radio.Group
                value={this.state.pressureScene}
                buttonStyle='solid'
                onChange={(e) => {
                  const pressureScene = writePressureScene(e.target.value)
                  const zeroCommand = resolvePressureSceneChangeZero(pressureScene)
                  const sent = this.props.wsSendObj(zeroCommand)
                  this.setState({
                    pressureScene,
                    resetZero: sent ? zeroCommand.resetZero : this.state.resetZero,
                  })
                  if (sent) this.props.changeAside?.(zeroCommand)
                }}
              >
                <Radio.Button value={PRESSURE_SCENES.real}>{t('pressureScene.real')}</Radio.Button>
                <Radio.Button value={PRESSURE_SCENES.demo}>{t('pressureScene.demo')}</Radio.Button>
              </Radio.Group>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 1.5 }}>
                {this.state.pressureScene === PRESSURE_SCENES.demo
                  ? t('pressureScene.demoHint')
                  : t('pressureScene.realHint')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button className='titleButton' onClick={() => {
                const zeroCommand = { resetZero: true }
                if (this.props.wsSendObj(zeroCommand)) {
                  this.props.changeAside?.(zeroCommand)
                  this.setState(zeroCommand)
                }
              }}>{t('resetZero')}</Button>
              <Button className='titleButton' onClick={() => {
                const zeroCommand = { resetZero: false }
                if (this.props.wsSendObj(zeroCommand)) {
                  this.props.changeAside?.(zeroCommand)
                  this.setState(zeroCommand)
                }
              }}>{t('cancelZero')}</Button>
              <NavLink to={`/num/${routerStr}`}>
                <Button className='titleButton' onClick={() => {
                  this.props.dataZero0()
                }}>{t('rawData')}</Button>
              </NavLink>
              <NavLink to={`/?from=system`}>
                <Button className='titleButton'>{t('key')}</Button>
              </NavLink>
            </div>
          </div>
        </Drawer>
      </div>





    </div>
      ;
  };
}
export default withTranslation('translation', { withRef: true })(Title);
