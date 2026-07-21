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
import i18next from "./i18n";
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
import LicensePortal from "./page/licensePortal/LicensePortal";

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
          // 开屏门户页：展示产品方案 + 输入/缓存密钥（不自动进入，需点击「进入系统」）
          <LicensePortal />
        } />
        <Route exact path="/key" element={
          // 旧密钥输入页（保留兜底：Home/Title 跳转 /?from=system 仍可用此页更新密钥）
          <Date i18n={i18next} />
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


