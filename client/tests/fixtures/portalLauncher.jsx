import React, { lazy, Suspense } from 'react';
import gsap from 'gsap';
import { createRoot } from 'react-dom/client';
import { HashRouter, Link, Routes, Route } from 'react-router-dom';
import i18next from '../../src/i18n';
import '../../src/App.css';
import LicensePortal from '../../src/page/licensePortal/LicensePortal';
import { loadMonitoringPage } from '../../src/page/home/loadMonitoringPage';

const actualMonitor = new URLSearchParams(window.location.search).has('actual-monitor');
// 隔离回归可暂停实际时间线截图，不改变生产组件或伪造过渡终态。
window.__portalTestTimeline = gsap.globalTimeline;
const MonitoringPage = lazy(loadMonitoringPage);

/** 隔离入口测试：目标页只回显选中的 id，不加载真实监测页、不操作设备。 */
function EnteredSystem({ onPortalBack }) {
  if (actualMonitor) return <Suspense fallback={<p>正在加载监测页</p>}><MonitoringPage i18n={i18next} /></Suspense>;
  return <main><h1>已进入：{localStorage.getItem('file')}</h1><button type="button" onClick={onPortalBack}>返回测试目录</button></main>;
}

/** 隔离测试只等待模拟页面准备，不预加载监测页和真实硬件模块。 */
async function prepareFixtureSystem() {
  if (window.__portalPrepareGate) await window.__portalPrepareGate;
  if (window.__portalPrepareFailure) throw new Error('fixture preparation failed');
  if (actualMonitor) return loadMonitoringPage();
  return { default: EnteredSystem };
}

createRoot(document.getElementById('root')).render(<HashRouter><Routes>
  <Route path="/" element={<LicensePortal prepareSystem={prepareFixtureSystem} />} />
  <Route path="/system" element={<EnteredSystem />} />
</Routes></HashRouter>);
