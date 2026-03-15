import "./App.css";
import { HashRouter, Routes, Route } from "react-router-dom";
import { App as AntdApp, message } from "antd";
import UpdateNotifier from "./components/updater/UpdateNotifier";

import Home from './page/home/Home'
import Demo from "./components/demo/Demo";
import HandDemo from "./components/demo/handDemo";
import HandLinePressDemo from "./components/demo/handDemoPress";
import Demo1016 from "./components/demo/Demo1016";
import Demo1010 from "./components/demo/Demo1010";
import Demo24 from "./components/demo/Demo2419";
import Block from "./components/demo/Block";
import { Heatmap } from "./components/heatmap/canvas";
import i18next from "i18next";
import Log from "./components/log/log";
import MatrixDiff from "./components/demo/matrixDiff";
import Date from "./page/date/Date";
import HandBlock from "./components/demo/handBlock";
import HandBlock32 from "./components/demo/handBlock32";
import HandBlock24 from "./components/demo/handBlock24";
import HandBlock20 from './components/demo/handBlock20'
import CsvData from "./components/demo/robot";
import HandLine from "./components/demo/handLine0116";
import HandLine0123 from "./components/demo/handLine0123";
import LineAdjust from "./components/demo/LineAdjust";
import Can from "./components/demo/can";
import Num3D from "./components/num/NumWs";
import License from "./page/license/License";
i18next.init({
  resources: {
    en: {
      translation: {
        welcome: "Welcome",
        chooseSensor: 'Please select a sensor.',
        realTime: 'Real-time',
        playBack: 'Playback',
        chooseSitSensor: 'Select seat port.',
        chooseLeftSensor: 'Select left port.',
        chooseRightSensor: 'Select right port.',
        chooseBackSensor: 'Select back port.',
        chooseHeadSensor: 'Select head port.',
        closeSensor: 'Close serial port',
        all: "All",
        back: 'Back',
        sit: 'Sit',
        left: 'Left',
        right: 'Right',
        col: 'Data acquisition',
        stop: 'Stop',
        choosePlaybackTime: 'Select data playback time.',
        meanPress: 'Average Pressure',
        maxPress: 'Maximum pressure',
        pressTotal: 'The sum of pressures',
        points: "Data points",
        area: "Area",
        allPress: "Overall pressure",
        download: "Download",
        delete: 'Delete',
        add: 'Add',
        guass: "Lubrication level",
        color: 'Color',
        filter: "Filtered value",
        height: "Height",
        consis: "Data consistency",
        init: "Initial value",
        feaLabel: "Feature label",
        matrix: "Matrix",
        heatmap: "Heatmap",
        rotate: "Rotate",
        boxSelection: "Box selection",
        rotateX: "Rotate 30° around the x-axis.",
        rotateY: "Rotate 30° around the y-axis.",
        selectBox: "Select a rectangular area.",
        setData: "Data settings",
        reset: 'Reset',
        resetContent: 'Reset matrix position',
        resetZero: 'Reset to zero',
        cancelZero: 'Cancel Zero',
        head: 'Head',
        rawData: 'Raw data',
        key: 'Enter key',
        data2D: '2D Data',
        tel3D: '3D Teleoperation',
        data3D: '3D Data',
        skin3D: '3D Skin',
        modal3D: '3D Model',
        leftHand: 'Left Hand',
        rightHand: 'Right Hand',
        FingersSpread: 'Fingers Spread',
        fist: 'Fist',
        calib: 'Calibrate',
        colData: 'Collect Data',
        clearData: 'Clear Historical Data',
        deviceCal: 'Device Calibration',
        enterColHZ: 'Enter Data Col HZ',
        light: 'light',
        speed: 'Rotation Speed',
        x: 'X Axis',
        y: 'Y Axis',
        z: 'Z Axis',
        size: 'size',
        hand: 'Hand Touch',
        gloves: 'Tactile Gloves',
        robot: 'Tactile Shirt',
        foot: 'Tactile Insoles',
      },
    },
    zh: {
      translation: {
        welcome: '欢迎',
        chooseSensor: '请选择传感器',
        realTime: '实时',
        playBack: '回放',
        chooseSitSensor: '请选择座椅串口',
        chooseBackSensor: '请选择靠背串口',
        chooseLeftSensor: '请选择左手串口',
        chooseLeftFootSensor: '请选择左脚串口',
        chooseRightFootSensor: '请选择右脚串口',
        chooseRightSensor: '请选择右手串口',
        chooseHeadSensor: '请选择头枕串口',
        closeSensor: '关闭串口',
        all: '整体',
        back: '靠背',
        sit: '座椅',
        left: '左',
        right: '右',
        col: '采集',
        stop: '停止',
        choosePlaybackTime: '选择数据回放时间',
        meanPress: '平均压力',
        maxPress: '最大压力',
        pressTotal: '压力总和',
        points: '点数',
        area: '面积',
        allPress: '压力总和',
        download: '下载',
        add: '添加',
        delete: '删除',
        guass: '润滑程度',
        color: '颜色',
        filter: '过滤值',
        height: '高度',
        consis: '数据连贯性',
        init: '初始值',
        feaLabel: '特征标签',
        matrix: '矩阵',
        heatmap: '热力图',
        rotate: '旋转',
        boxSelection: '框选',
        rotateX: '绕x轴旋转30°',
        rotateY: '绕y轴旋转30°',
        selectBox: '框选一个矩形区域',
        setData: '数据设置',
        reset: '重置',
        resetContent: '重置矩阵位置',
        resetZero: '清零',
        cancelZero: '取消清零',
        head: '头枕',
        rawData: '原始数据',
        key: '输入密钥',
        data2D: '2D数字',
        tel3D: '3D遥操',
        data3D: '3D数字',
        skin3D: '3D皮肤',
        modal3D: '3D模型',
        leftHand: '左手',
        rightHand: '右手',
        FingersSpread: '手指平铺',
        fist: '手指握拳',
        calib: '校准',
        colData: '采集数据',
        clearData: '清除历史数据',
        deviceCal: '设备校准',
        enterColHZ: '输入采集频率',
        light: '灯光',
        speed: '转动速度',
        x: 'X轴',
        y: 'Y轴',
        z: 'Z轴',
        size: '大小',
        hand: '手部检测',
        gloves: '手套模型',
        robot: '机器人全身',
        foot: '足底模型',
      },
    },
  },
  lng: localStorage.getItem('language') ? localStorage.getItem('language') : 'zh',
});

// 配置 message 全局设置，确保在 Electron 中正确显示
message.config({
  top: 50,
  duration: 3,
  maxCount: 3,
  getContainer: () => document.body,
});

function App() {
  return (
    <AntdApp>
    <UpdateNotifier />
    <HashRouter>
      <Routes>
        <Route exact path="/handPoint" element={
          // <I18nProvider lng="en">
          <HandBlock i18n={i18next} />
          // </I18nProvider> 
        } />

        <Route exact path="/handRealPoint" element={
          // <I18nProvider lng="en">
          <HandBlock i18n={i18next} />
          // </I18nProvider> 
        } />

        <Route exact path="/handPoint32" element={
          // <I18nProvider lng="en">
          <HandBlock32 i18n={i18next} />
          // </I18nProvider> 
        } />

        <Route exact path="/handPoint24" element={
          // <I18nProvider lng="en">
          <HandBlock24 i18n={i18next} />
          // </I18nProvider> 
        } />

        <Route exact path="/handPoint20" element={
          // <I18nProvider lng="en">
          <HandBlock20 i18n={i18next} />
          // </I18nProvider> 
        } />

        <Route exact path="/robot" element={
          // <I18nProvider lng="en">
          <CsvData i18n={i18next} />
          // </I18nProvider> 
        } />
        <Route exact path="/" element={
          // <I18nProvider lng="en">
          <Date i18n={i18next} />
          // </I18nProvider> 
        } />
        <Route exact path="/system" element={
          // <I18nProvider lng="en">
          <Home i18n={i18next} />
          // </I18nProvider> 
        } />
        <Route exact path="/heatmap" element={<Heatmap />} />
        <Route exact path="/num/:type" element={<Demo />} />
        <Route exact path="/handReal" element={<HandDemo />} />
        <Route exact path="/handLinePressData" element={<HandLinePressDemo />} />
        <Route exact path="/line" element={<LineAdjust />} />
        <Route exact path="/can" element={<Can />} />
        <Route exact path="/num1010" element={<Demo1010 />} />
        <Route exact path="/num1016" element={<Demo1016 />} />
        <Route exact path="/carNum" element={<Demo24 />} />
        <Route exact path="/block" element={<Block />} />
        <Route exact path="/handLine" element={<HandLine />} />
        <Route exact path="/handLine0123" element={<HandLine0123 />} />
        <Route exact path="/log" element={<Log />} />
        <Route exact path="/diff" element={<MatrixDiff />} />
        <Route exact path="/3Dnum" element={<Num3D />} />
        <Route exact path="/license" element={<License />} />
        {/* <Route exact path="/local" element={<Local />} /> */}
        {/* <Route exact path="/back" element={<Back />} /> */}
      </Routes>
    </HashRouter>
    </AntdApp>
  );
}

export default App;
