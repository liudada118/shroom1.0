import './App.css'
import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { App as AntdApp, message } from 'antd'
import i18next from './i18n'
import UpdateNotifier from './components/updater/UpdateNotifier'

const Home = lazy(() => import('./page/home/Home'))
const Demo = lazy(() => import('./legacy/demos/Demo'))
const HandDemo = lazy(() => import('./legacy/demos/handDemo'))
const HandLinePressDemo = lazy(() => import('./legacy/demos/handDemoPress'))
const Demo1016 = lazy(() => import('./legacy/demos/Demo1016'))
const Demo1010 = lazy(() => import('./legacy/demos/Demo1010'))
const Demo24 = lazy(() => import('./legacy/demos/Demo2419'))
const Block = lazy(() => import('./legacy/demos/Block'))
const Heatmap = lazy(() => import('./components/heatmap/canvas').then((module) => ({ default: module.Heatmap })))
const Log = lazy(() => import('./components/log/log'))
const MatrixDiff = lazy(() => import('./legacy/demos/matrixDiff'))
const Date = lazy(() => import('./page/date/Date'))
const HandBlock = lazy(() => import('./legacy/demos/handBlock'))
const HandBlock32 = lazy(() => import('./legacy/demos/handBlock32'))
const HandBlock24 = lazy(() => import('./legacy/demos/handBlock24'))
const HandBlock20 = lazy(() => import('./legacy/demos/handBlock20'))
const CsvData = lazy(() => import('./legacy/demos/robot'))
const HandLine = lazy(() => import('./legacy/demos/handLine0116'))
const HandLine0123 = lazy(() => import('./legacy/demos/handLine0123'))
const LineAdjust = lazy(() => import('./legacy/demos/LineAdjust'))
const Can = lazy(() => import('./legacy/demos/can'))
const Num3D = lazy(() => import('./components/num/NumWs'))
const License = lazy(() => import('./page/license/License'))
const LicensePortal = lazy(() => import('./page/licensePortal/LicensePortal'))
const DisplaySystemBuilder = lazy(() => import('./page/displaySystemBuilder/DisplaySystemBuilder'))

// 配置 message 全局设置，确保在 Electron 中正确显示
message.config({
  top: 50,
  duration: 3,
  maxCount: 3,
  getContainer: () => document.body,
})

function App() {
  return (
    <AntdApp>
      <UpdateNotifier />
      <HashRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route exact path='/handPoint' element={<HandBlock i18n={i18next} />} />
            <Route exact path='/handRealPoint' element={<HandBlock i18n={i18next} />} />
            <Route exact path='/handPoint32' element={<HandBlock32 i18n={i18next} />} />
            <Route exact path='/handPoint24' element={<HandBlock24 i18n={i18next} />} />
            <Route exact path='/handPoint20' element={<HandBlock20 i18n={i18next} />} />
            <Route exact path='/robot' element={<CsvData i18n={i18next} />} />
            <Route exact path='/' element={<LicensePortal />} />
            <Route exact path='/key' element={<Date i18n={i18next} />} />
            <Route exact path='/system' element={<Home i18n={i18next} />} />
            <Route exact path='/display-systems' element={<DisplaySystemBuilder />} />
            <Route exact path='/heatmap' element={<Heatmap />} />
            <Route exact path='/num/:type' element={<Demo />} />
            <Route exact path='/handReal' element={<HandDemo />} />
            <Route exact path='/handLinePressData' element={<HandLinePressDemo />} />
            <Route exact path='/line' element={<LineAdjust />} />
            <Route exact path='/can' element={<Can />} />
            <Route exact path='/num1010' element={<Demo1010 />} />
            <Route exact path='/num1016' element={<Demo1016 />} />
            <Route exact path='/carNum' element={<Demo24 />} />
            <Route exact path='/block' element={<Block />} />
            <Route exact path='/handLine' element={<HandLine />} />
            <Route exact path='/handLine0123' element={<HandLine0123 />} />
            <Route exact path='/log' element={<Log />} />
            <Route exact path='/diff' element={<MatrixDiff />} />
            <Route exact path='/3Dnum' element={<Num3D />} />
            <Route exact path='/license' element={<License />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AntdApp>
  )
}

export default App
