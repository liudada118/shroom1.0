import React, { lazy, Suspense } from 'react';
import '@ant-design/v5-patch-for-react-19';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import '../../src/i18n';
import '../../src/App.css';
import '../../src/page/licensePortal/FiberPortal.css';
import '../../src/page/licensePortal/PortalLauncher.css';
import DisplaySystemBuilder from '../../src/extensions/display-system/DisplaySystemBuilder';
import PortalMonitoringLayer from '../../src/page/licensePortal/PortalMonitoringLayer';
import { getDisplayDefinition } from '../../src/displays/registry';
const Home = lazy(() => import('../../src/page/home/Home'));

/** 以真实门户样式包裹原生 Home，验证副本进入后的展示。 */
function Monitor() {
  const id = localStorage.getItem('file');
  const definition = getDisplayDefinition(id);
  return <div className="fiber-portal"><PortalMonitoringLayer component={Home} system={{ value: id, label: definition?.label }} onBack={() => {}} onPreviewChange={() => {}} /></div>;
}

// 只用于浏览器隔离回归；接口和 WebSocket 由测试脚本拦截。
createRoot(document.getElementById('root')).render(<HashRouter><Suspense fallback={<p>加载中</p>}><Routes>
  <Route path="/" element={<DisplaySystemBuilder />} />
  <Route path="/system" element={<Monitor />} />
</Routes></Suspense></HashRouter>);
