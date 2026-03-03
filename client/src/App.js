import "./App.css";
import { HashRouter, Routes, Route } from "react-router-dom";

// import Local from "./components/local/Car";
// import Back from "./components/playBack/Car";
// import Foot from './components/foot/Car'
// import Local from './components/foot/Num32DetectLocal'
import Home from './page/home/Home'
import Demo from "./components/demo/Demo";
import HandDemo from "./components/demo/handDemo";
import HandLineDemo from "./components/demo/handDemo copy";
import HandLinePressDemo from "./components/demo/handDemoPress";
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
import HandBlock32 from "./components/demo/handBlock32";
import HandBlock24 from "./components/demo/handBlock24";
import HandBlock20 from './components/demo/handBlock20'
import CsvData from "./components/demo/robot";
import HandLine from "./components/demo/handLine0116";
import HandLine0123 from "./components/demo/handLine0123";
import LineAdjust from "./components/demo/LineAdjust";
import LineAdjust1 from "./components/demo/LineAdjust copy";

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
        welcome: 'Welcome',
        chooseSensor: 'Please select a sensor.',
        realTime: 'Real-time',
        playBack: 'Playback',
        chooseSitSensor: 'Select seat port.',
        chooseBackSensor: 'Select back port.',
        chooseLeftSensor: 'Select left port.',
        chooseLeftFootSensor: 'Select left foot port.',
        chooseRightFootSensor: 'Select right foot port.',
        chooseRightSensor: 'Select right port.',
        chooseHeadSensor: 'Select head port.',
        closeSensor: 'Close serial port',
        all: 'All',
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
        points: 'Data points',
        area: 'Area',
        allPress: 'Overall pressure',
        download: 'Download',
        add: 'Add',
        delete: 'Delete',
        guass: 'Lubrication level',
        color: 'Color',
        filter: 'Filtered value',
        height: 'Height',
        consis: 'Data consistency',
        init: 'Initial value',
        feaLabel: 'Feature label',
        matrix: 'Matrix',
        heatmap: 'Heatmap',
        rotate: 'Rotate',
        boxSelection: 'Box selection',
        rotateX: 'Rotate 30 deg around x-axis',
        rotateY: 'Rotate 30 deg around y-axis',
        selectBox: 'Select a rectangular area.',
        setData: 'Data settings',
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
        light: 'Light',
        speed: 'Rotation Speed',
        x: 'X Axis',
        y: 'Y Axis',
        z: 'Z Axis',
        size: 'Size',
        hand: 'Hand Touch',
        gloves: 'Tactile Gloves',
        robot: 'Tactile Shirt',
        foot: 'Tactile Insoles',
      },
    },
  },
  lng: localStorage.getItem('language') ? localStorage.getItem('language') : 'zh',
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
        <Route exact path="/handLineData" element={<HandLineDemo />} />
        <Route exact path="/handLinePressData" element={<HandLinePressDemo />} />
        <Route exact path="/line" element={<LineAdjust />} />
        <Route exact path="/line1" element={<LineAdjust1 />} />
        <Route exact path="/can" element={<Can />} />
        <Route exact path="/num1010" element={<Demo1010 />} />
        <Route exact path="/num1016" element={<Demo1016 />} />
        <Route exact path="/carNum" element={<Demo24 />} />
        <Route exact path="/block" element={<Block />} />
        <Route exact path="/handLine" element={<HandLine />} />
        <Route exact path="/handLine0123" element={<HandLine0123 />} />
        {/* <Route exact path="/num32" element={<DemoC />} />
        <Route exact path="/numBed" element={<DemoBed />} /> */}
        <Route exact path="/log" element={<Log />} />
        <Route exact path="/diff" element={<MatrixDiff />} />
        <Route exact path="/3Dnum" element={<Num3D />} />
        <Route exact path="/license" element={<License />} />
        {/* <Route exact path="/local" element={<Local />} /> */}
        {/* <Route exact path="/back" element={<Back />} /> */}
      </Routes>
    </HashRouter>
  );
}

export default App;
