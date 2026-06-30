import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, message } from 'antd';
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  AreaChartOutlined,
  CodeOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { WS_URLS } from '../../constants';
import {
  BRAND_LOGO_SRC,
  getSolutionCarouselSlides,
  SOLUTIONS,
} from './solutionConfig';
import { FeedbackWidget } from './LicensePortalWidgets';
import './LicensePortal.css';

// 产品核心能力（hero 左下三个小块）：可视化展示 / 动态采集 / 多种场景展示
const CAPABILITIES = [
  { key: 'visual', label: '压力可视化展示', icon: <AreaChartOutlined /> },
  { key: 'collect', label: '动态数据采集', icon: <ThunderboltOutlined /> },
  { key: 'scene', label: '多种场景展示', icon: <AppstoreOutlined /> },
];

const LicensePortal = () => {
  const navigate = useNavigate();
  const [accessKey, setAccessKey] = useState(() => localStorage.getItem('shroomAccessKey') || '');
  // 保存密钥：默认勾选；勾选则验证通过后记住密钥，下次自动填入输入框
  const [saveKey, setSaveKey] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [entering, setEntering] = useState(false);
  const [activeSolution, setActiveSolution] = useState('care');
  const [carouselIndexBySolution, setCarouselIndexBySolution] = useState({});

  const wsRef = useRef(null);
  // ws.onmessage 闭包只创建一次，用 ref 读取最新的输入值 / 勾选状态 / 提交标记
  const accessKeyRef = useRef(accessKey);
  const saveKeyRef = useRef(saveKey);
  const isSubmittingRef = useRef(false);

  useEffect(() => { accessKeyRef.current = accessKey; }, [accessKey]);
  useEffect(() => { saveKeyRef.current = saveKey; }, [saveKey]);

  // 连接桌面端本地服务：用于「进入系统」时提交密钥做校验（不改原有验证逻辑）
  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(WS_URLS.MAIN);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        setEntering(false);
        isSubmittingRef.current = false;
      };
      ws.onerror = () => {
        setWsConnected(false);
        setEntering(false);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // 密钥验证错误：仅在用户点击「进入系统」提交后才弹错误框
          // （后端连接/复检时主动推送的 licenseError 不弹，避免一打开就报错）
          if (data.licenseError != null) {
            const wasSubmitting = isSubmittingRef.current;
            isSubmittingRef.current = false;
            setEntering(false);
            if (wasSubmitting) {
              Modal.error({ title: '密钥错误', content: data.licenseError });
            }
            return;
          }

          // 收到有效 date 且后端判定有效（valid !== false）
          if (data.date != null && data.date > 0 && data.valid !== false) {
            // 只响应用户主动点击「进入系统」触发的校验，忽略后端被动推送
            if (!isSubmittingRef.current) return;
            isSubmittingRef.current = false;

            const serverNow = data.nowDate ? parseFloat(data.nowDate) : window.Date.now();
            const endDate = parseFloat(data.date);
            if (endDate <= serverNow) {
              setEntering(false);
              Modal.error({ title: '密钥已过期', content: '该密钥已过期，请输入有效的密钥' });
              return;
            }

            // 验证成功：按勾选决定是否记住密钥（输入框自动回显用）
            if (saveKeyRef.current) {
              localStorage.setItem('shroomAccessKey', accessKeyRef.current.trim());
            } else {
              localStorage.removeItem('shroomAccessKey');
            }
            message.success('密钥验证成功');
            setTimeout(() => navigate('/system'), 500);
          }
        } catch (err) {
          console.error('解析密钥回包失败:', err);
        }
      };
      wsRef.current = ws;
    } catch (error) {
      setWsConnected(false);
    }

    return () => {
      try {
        wsRef.current?.close();
      } catch (error) {
        // ignore
      }
    };
  }, [navigate]);

  const activeSolutionInfo = useMemo(
    () => SOLUTIONS.find((solution) => solution.key === activeSolution) || SOLUTIONS[0],
    [activeSolution]
  );

  const handleCarouselStep = useCallback((solutionKey, carouselSlides, direction) => {
    setActiveSolution(solutionKey);
    const slideCount = carouselSlides.length;
    setCarouselIndexBySolution((prev) => {
      const currentIndex = prev[solutionKey] || 0;
      const nextIndex = (currentIndex + direction + slideCount) % slideCount;
      return { ...prev, [solutionKey]: nextIndex };
    });
  }, []);

  // 进入系统：提交密钥做校验，沿用原有验证逻辑（错误弹原来的弹窗，验证通过才进入）
  const handleEnterSystem = useCallback(() => {
    const key = accessKey.trim();
    if (!key) {
      Modal.error({ title: '密钥错误', content: '密钥不能为空，请输入有效密钥' });
      return;
    }
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      isSubmittingRef.current = true;
      setEntering(true);
      ws.send(JSON.stringify({ date: { date: key, startTime: window.Date.now() } }));
    } else {
      Modal.error({ title: '连接错误', content: '与应用的连接已断开，请重启应用后重试' });
    }
  }, [accessKey]);

  return (
    <main className="portal-page">
      <div className="portal-bg" aria-hidden="true">
        <span className="portal-bg-orb orb-a" />
        <span className="portal-bg-orb orb-b" />
        <span className="portal-bg-grid" />
      </div>

      <header className="portal-topbar">
        <div className="portal-topbar-left">
          <div className="portal-brand">
            <img alt="Shroom" className="portal-logo-img" draggable={false} src={BRAND_LOGO_SRC} />
            <span className="portal-brand-name">Shroom Vision</span>
          </div>
        </div>
        <div className="portal-topbar-right">
          <div className={`portal-status ${wsConnected ? 'is-online' : 'is-offline'}`}>
            <i />
            {wsConnected ? '系统已就绪' : '系统未连接'}
          </div>
          <div className="portal-sdk-badge">
            <CodeOutlined />
            <span>SDK 定制</span>
          </div>
        </div>
      </header>

      <section className="portal-hero">
        <div className="portal-hero-text">
          <span className="portal-hero-tag">
            <SafetyCertificateOutlined />
            柔性压力感知 · 全场景解决方案
          </span>
          <h1>Shroom Vision</h1>
          <p className="portal-hero-desc">
            面向康养、汽车、具身智能等行业场景，一站式完成压力可视化展示、动态数据采集与专业报告输出。
          </p>

          <div className="portal-hero-capabilities">
            <span className="portal-hero-cap-label">核心能力</span>
            <div className="portal-cap-row">
              {CAPABILITIES.map((cap) => (
                <div className="portal-cap-item" key={cap.key}>
                  <span className="portal-cap-icon">{cap.icon}</span>
                  <span className="portal-cap-label-text">{cap.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="portal-access">
          <div className="portal-access-head">
            <h2>访问密钥</h2>
            <p>输入授权密钥，点击进入系统完成验证并开始测量</p>
          </div>
          <div className="portal-access-form">
            <input
              aria-label="访问密钥"
              onChange={(event) => setAccessKey(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleEnterSystem();
              }}
              placeholder="请输入访问密钥"
              type="text"
              value={accessKey}
            />
          </div>
          <label className="portal-access-save">
            <input
              type="checkbox"
              checked={saveKey}
              onChange={(event) => setSaveKey(event.target.checked)}
            />
            <span>保存密钥（下次自动填入）</span>
          </label>
          <button
            className="portal-btn-primary"
            type="button"
            onClick={handleEnterSystem}
            disabled={entering}
          >
            {entering ? '验证中…' : '进入系统'}
            {entering ? null : <ArrowRightOutlined />}
          </button>
          <div className="portal-access-note">
            <LockOutlined />
            密钥验证通过后，将自动加载并解锁对应方案内容
          </div>
        </div>
      </section>

      <section className="portal-grid" aria-label="行业方案">
        {SOLUTIONS.map((solution) => {
          const carouselSlides = getSolutionCarouselSlides(solution);
          const carouselIndex = Math.min(
            carouselIndexBySolution[solution.key] || 0,
            carouselSlides.length - 1
          );
          return (
            <article
              className={`portal-card theme-${solution.color}`}
              key={solution.key}
            >
              <div className="portal-card-head">
                <div className="portal-card-icon">{solution.icon}</div>
                <div className="portal-card-title">
                  <h3>{solution.title}</h3>
                  <p>{solution.subtitle}</p>
                </div>
              </div>

              <div className="portal-card-divider" />

              <div className="portal-carousel">
                {carouselSlides.length > 1 ? (
                  <div className="portal-carousel-viewport">
                    <div
                      className="portal-carousel-track"
                      style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
                    >
                      {carouselSlides.map((slide, slideIndex) => (
                        <div className="portal-carousel-slide" key={`${solution.key}-${slideIndex}`}>
                          <div className="portal-module-row">
                            {slide.map((module) => (
                              <div
                                className={`portal-module ${module.isResearch ? 'is-research' : ''}`}
                                key={module.key}
                              >
                                <span className="portal-module-icon">{module.icon}</span>
                                <span className="portal-module-label">{module.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="portal-module-row">
                    {(carouselSlides[0] || []).map((module) => (
                      <div
                        className={`portal-module ${module.isResearch ? 'is-research' : ''}`}
                        key={module.key}
                      >
                        <span className="portal-module-icon">{module.icon}</span>
                        <span className="portal-module-label">{module.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {carouselSlides.length > 1 ? (
                  <div className="portal-carousel-controls">
                    <button
                      type="button"
                      aria-label="上一组"
                      onClick={() => handleCarouselStep(solution.key, carouselSlides, -1)}
                    >
                      ‹
                    </button>
                    <div className="portal-carousel-progress" aria-hidden="true">
                      <span style={{ width: `${((carouselIndex + 1) / carouselSlides.length) * 100}%` }} />
                    </div>
                    <span className="portal-carousel-count">
                      {carouselIndex + 1}/{carouselSlides.length}
                    </span>
                    <button
                      type="button"
                      aria-label="下一组"
                      onClick={() => handleCarouselStep(solution.key, carouselSlides, 1)}
                    >
                      ›
                    </button>
                  </div>
                ) : null}
              </div>

              <p className="portal-card-detail">{solution.detail}</p>
            </article>
          );
        })}
      </section>

      <footer className="portal-footer">
        <span>Shroom Vision · 柔性压力感知系统</span>
        <span className="portal-footer-dot" />
        <span>© {new window.Date().getFullYear()} JQ Industries</span>
      </footer>

      <FeedbackWidget accessKey={accessKey} activeSolution={activeSolutionInfo?.key} />
    </main>
  );
};

export default LicensePortal;
