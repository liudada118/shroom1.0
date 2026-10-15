import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppstoreOutlined, ArrowRightOutlined, CarOutlined, HeartOutlined, RobotOutlined, SafetyCertificateOutlined, SearchOutlined, UsbOutlined } from '@ant-design/icons';
import { PORTAL_CATEGORIES, filterPortalSystems } from '../page/licensePortal/portalSystems.js';
import { getPortalAccent } from '../page/licensePortal/scene/sceneCatalog.js';
import PressureParticleField from '../page/licensePortal/scene/PressureParticleField.jsx';
import logo from '../assets/开屏IMG/shroom-vision-logo.png';
import { MOBILE_SYSTEMS, canRunMobileSystem } from './mobileSystems.js';

const ICONS = { care: HeartOutlined, vehicle: CarOutlined, embodied: RobotOutlined, custom: AppstoreOutlined };
const CATEGORY_LABELS = { all: '全部', care: '康养', vehicle: '座椅', embodied: '触觉', custom: '定制' };

/** 沿用Shroom首页布局与品牌，当前移动能力说明替代尚未迁移的密钥表单。 */
export function MobileHome({ onOpen, onHost, sceneStatus }) {
  return <main className="portal-page mobile-home">
    <PressureParticleField className="pressure-field" />
    <div ref={onHost} className="portal-mushroom-ambient" aria-hidden="true" />
    <header className="portal-topbar">
      <div className="portal-brand"><img alt="Shroom" className="portal-logo" draggable={false} src={logo} /></div>
      <div className="portal-topbar-actions"><span className="portal-status is-online"><span className="portal-status-dot" />iPad · USB 实时监测</span>
        <button className="portal-sdk-button" type="button" onClick={() => onOpen('all')}><AppstoreOutlined /> 系统列表</button></div>
    </header>
    <div className="portal-split"><div className="portal-content-column">
      <section className="portal-hero"><div className="portal-hero-tag"><SafetyCertificateOutlined />柔性压力感知解决方案</div>
        <h1>Shroom Vision</h1><p className="portal-hero-desc">让柔性压力数据实时可见，快速接入康养、座椅与具身触觉场景。</p></section>
      <section className="portal-access" aria-label="进入监测系统">
        <div className="portal-access-title"><UsbOutlined />连接你的压力传感器</div>
        <div className="portal-access-main"><span className="mobile-access-device">CH340 · 32 × 32 压力矩阵</span>
          <button className="portal-enter-button" type="button" aria-label="选择系统" onClick={() => onOpen('all')}>选择系统 <ArrowRightOutlined aria-hidden="true" /></button></div>
        <p className="portal-access-hint">当前支持 USB 实时收数与展示。密钥授权、保存、回放和算法将在后续接入。</p>
      </section>
      <section className="portal-grid" aria-label="场景分类">{PORTAL_CATEGORIES.map((item) => {
        const Icon = ICONS[item.key];
        return <article key={item.key} className="portal-card"><button type="button" className="portal-card-action" onClick={() => onOpen(item.key)}>
          <span className="portal-card-icon"><Icon /></span><span className="portal-card-title"><strong>{item.title}</strong><small>{item.description}</small></span>
          <ArrowRightOutlined className="portal-card-arrow" /></button></article>;
      })}</section>
    </div><div className="portal-visual-column" aria-hidden="true" /></div>
    <span className="portal-home-scene-status" role="status">{sceneStatus.state === 'error' || sceneStatus.state === 'unavailable' ? '粒子预览不可用，仍可选择系统' : '粒子场景预览 · 非实时数据'}</span>
  </main>;
}

/** 保留原版分类、搜索、粒子预览和进入结构；设备协议未接入时不能启动该系统。 */
export function MobileSystemSelector({ category, onCategory, selectedId, onSelect, onEnter, onBack, onHost, sceneStatus }) {
  const [query, setQuery] = useState('');
  const heading = useRef(null);
  const visible = useMemo(() => filterPortalSystems(MOBILE_SYSTEMS, category, query), [category, query]);
  const selected = MOBILE_SYSTEMS.find((system) => system.value === selectedId) || MOBILE_SYSTEMS[0];
  const supported = canRunMobileSystem(selected.value);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => { setQuery(''); }, [category]);
  return <main className="system-selector-backdrop is-open mobile-selector" style={{ '--system-accent': getPortalAccent(selected) }}>
    <div className="system-selector-dust" aria-hidden="true" />
    <section className="system-selector-panel" aria-labelledby="mobile-selector-heading">
      <aside className="system-selector-list">
        <div className="system-selector-heading"><span className="system-selector-kicker">SHROOM SYSTEM INDEX</span>
          <h2 id="mobile-selector-heading" ref={heading} tabIndex={-1}>选择你的展示系统</h2><p>单击预览，选择已适配的系统进入。</p></div>
        <div className="portal-filter-tabs" aria-label="系统分类">{[{ key: 'all', title: '全部' }, ...PORTAL_CATEGORIES].map((item) =>
          <button type="button" key={item.key} aria-label={item.title} aria-pressed={category === item.key} onClick={() => onCategory(item.key)}>{CATEGORY_LABELS[item.key]}</button>)}</div>
        <label className="portal-system-search"><SearchOutlined /><input aria-label="搜索系统" placeholder="搜索系统名称" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="portal-directory-status"><span>{visible.length} 个系统 · 1 个已适配 USB</span></div>
        <div className="system-options" aria-label="系统列表">{visible.map((system, index) => <button key={system.value} type="button" data-system={system.value}
          className={`system-option portal-system-option ${selectedId === system.value ? 'is-active' : ''}`} aria-pressed={selectedId === system.value}
          style={{ '--system-accent': getPortalAccent(system) }} onClick={() => onSelect(system.value)}>
          <span className="system-option-index">{String(index + 1).padStart(2, '0')}</span><span className="system-option-copy">
            <small>{canRunMobileSystem(system.value) ? 'USB 已适配 · 32×32' : '移动端适配中'}</small><strong>{system.label}</strong></span><ArrowRightOutlined className="system-option-arrow" />
        </button>)}{!visible.length && <div className="portal-no-systems"><strong>没有找到系统</strong><p>试试其他名称，或切换到“全部”。</p></div>}</div>
        <div className="portal-entry-form mobile-catalog-note">本页展示原版系统目录。当前安装包仅接入已验证的 CH340 32×32 数据协议。</div>
      </aside>
      <section className="system-selector-scene" aria-label="系统粒子预览"><div ref={onHost} className="system-scene-particle-host" aria-hidden="true" />
        <div className="system-scene-chrome"><div className="system-scene-grid" /><div className="system-scene-vignette" />
          <span className="system-scene-status" role="status">{sceneStatus.state === 'error' ? '预览加载失败' : '粒子场景预览 · 非实时数据'}</span>
          <div className="system-scene-copy"><span className="system-scene-scan" /><span className="system-scene-eyebrow">{PORTAL_CATEGORIES.find((item) => item.key === selected.category)?.title}</span>
            <h3>{selected.label}</h3><p>{supported ? '连接 CH340，查看32×32实时压力、热力图与原始数字。' : '此系统的数据协议和运行功能尚未适配 iPad。'}</p>
            <button type="button" className="system-scene-enter" aria-label={supported ? '进入该系统' : '暂未适配'} disabled={!supported} onClick={() => onEnter(selected)}>{supported ? '进入该系统' : '暂未适配'} <ArrowRightOutlined aria-hidden="true" /></button>
          </div></div>
      </section>
      <button className="system-selector-close" type="button" aria-label="返回首页" onClick={onBack}>×</button>
    </section>
  </main>;
}
