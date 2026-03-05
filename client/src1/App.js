import "./App.css";
import { HashRouter, Routes, Route } from "react-router-dom";

// import Local from "./components/local/Car";
// import Back from "./components/playBack/Car";
// import Foot from './components/foot/Car'
// import Local from './components/foot/Num32DetectLocal'
import Home from './page/home/Home'
import Demo from "./components/demo/Demo";
import Demo1016 from "./components/demo/Demo1016";
import Demo1010 from "./components/demo/Demo1010";
import Demo24 from "./components/demo/Demo2419";
import Block from "./components/demo/Block";
import DemoC from "./components/demo/Demo copy";
import DemoBed from "./components/demo/DemoBed";
import { Heatmap } from "./components/heatmap/canvas";
// import { I18nProvider, FormattedString } from "i18nLib";
import i18next from "i18next";
import Log from "./components/log/log";
import MatrixDiff from "./components/demo/matrixDiff";
import Date from "./page/date/Date";
import HandBlock from "./components/demo/handBlock";
import LineAdjust from "./components/demo/LineAdjust";
import Can from "./components/demo/can";
i18next.init({
  resources: {
    en: {
      translation: {
        welcome: "Welcome",
        chooseSensor: 'Please select a sensor.',
        realTime: 'Real-time',
        playBack: 'Playback',
        chooseSitSensor: 'Select seat port.',
        chooseBackSensor: 'Select back port.',
        chooseHeadSensor: 'Select head port.',
        closeSensor: 'Close serial port',
        all: "All",
        back: 'Back',
        sit: 'Sit',
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
        key : 'Enter key'
      },
    },
    zh: {
      translation: {
        welcome: "欢迎",
        chooseSensor: '请选择传感器',
        realTime: '实时',
        playBack: '回放',
        chooseSitSensor: '请选择座椅串口',
        chooseBackSensor: '请选择靠背串口',
        chooseHeadSensor: '请选择头枕串口',
        // chooseSensor: '请选择串口',
        closeSensor: '关闭串口',
        all: "整体",
        back: '靠背',
        sit: '座椅',
        col: '采集',
        stop: '停止',
        choosePlaybackTime: '选择数据回放时间',
        meanPress: '平均压力',
        maxPress: '最大压力',
        pressTotal: '压力总和',
        points: "点数",
        area: "面积",
        allPress: "总体压力",
        download: "下载",
        add: '添加',
        delete: '删除',
        guass: "润滑程度",
        color: '颜色',
        filter: "过滤值",
        height: "高度",
        consis: "数据连贯性",
        init: "初始值",
        feaLabel: "特征标签",
        matrix: "矩阵",
        heatmap: "热力图",
        rotate: "旋转",
        boxSelection: '框选',
        rotateX: "绕x轴旋转30°",
        rotateY: "绕y轴旋转30°",
        selectBox: "框选一个矩形区域",
        setData: "数据设置",
        reset: '重置',
        resetContent: '重置矩阵位置',
        resetZero: '清零',
        cancelZero: '取消清零',
        head: '头枕',
        rawData: '原始数据',
        key : '输入密钥'
      },
    },
  },
  lng: localStorage.getItem('language') ? localStorage.getItem('language') : 'en',
});
function App() {
  return (
    <HashRouter>
      <Routes>
      <Route exact path="/handPoint" element={
          // <I18nProvider lng="en">
          <HandBlock i18n={i18next} />
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
        <Route exact path="/line" element={<LineAdjust />} />
        <Route exact path="/can" element={<Can />} />
        <Route exact path="/num1010" element={<Demo1010 />} />
        <Route exact path="/num1016" element={<Demo1016 />} />
        <Route exact path="/carNum" element={<Demo24 />} />
        <Route exact path="/block" element={<Block />} />
        {/* <Route exact path="/num32" element={<DemoC />} />
        <Route exact path="/numBed" element={<DemoBed />} /> */}
        <Route exact path="/log" element={<Log />} />
        <Route exact path="/diff" element={<MatrixDiff />} />
        {/* <Route exact path="/local" element={<Local />} /> */}
        {/* <Route exact path="/back" element={<Back />} /> */}
      </Routes>
    </HashRouter>
  );
}

export default App;
