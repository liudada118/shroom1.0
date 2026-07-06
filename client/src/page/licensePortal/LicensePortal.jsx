import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, message } from 'antd';
import {
  ArrowRightOutlined,
  CodeOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { WS_URLS } from '../../constants';
import accessKeyIcon from '../../assets/开屏IMG/ChatGPT Image 2026年7月1日 11_54_17.png';
import {
  BRAND_LOGO_SRC,
  getSolutionCarouselSlides,
  SOLUTIONS,
} from './solutionConfig';
import { FeedbackWidget } from './LicensePortalWidgets';
import './LicensePortal.css';

const LicensePortal = () => {
  const navigate = useNavigate();
  const [accessKey, setAccessKey] = useState('');
  // 密钥保存和下次回填以后端 config.txt 为准，前端只负责展示后端下发的 licenseKey。
  const [saveKey, setSaveKey] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [entering, setEntering] = useState(false);
  const [activeSolution, setActiveSolution] = useState('care');
  const [carouselIndexBySolution, setCarouselIndexBySolution] = useState({});

  const wsRef = useRef(null);
  // ws.onmessage 闭包只创建一次，用 ref 读取最新的输入值 / 提交标记
  const accessKeyRef = useRef(accessKey);
  const isSubmittingRef = useRef(false);

  useEffect(() => { accessKeyRef.current = accessKey; }, [accessKey]);

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

          if (typeof data.licenseKey === 'string' && data.licenseKey.trim()) {
            const key = data.licenseKey.trim();
            if (!accessKeyRef.current.trim()) {
              setAccessKey(key);
            }
          }

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
        </div>
      </section>

      <section className="portal-access" aria-label="访问密钥">
        <div className="portal-access-title">
          <span className="portal-access-icon">
            <img alt="访问密钥" draggable={false} src={accessKeyIcon} />
          </span>
          <h2>访问密钥</h2>
        </div>
        <div className="portal-access-main">
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
          <button
            className="portal-btn-primary"
            type="button"
            onClick={handleEnterSystem}
            disabled={entering}
          >
            {entering ? '验证中…' : '进入系统'}
            {entering ? null : <ArrowRightOutlined />}
          </button>
        </div>
        <label className="portal-access-save">
          <input
            type="checkbox"
            checked={saveKey}
            onChange={(event) => setSaveKey(event.target.checked)}
          />
          <span>保存密钥（下次自动填入）</span>
        </label>
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
        <span>Shroom Vision</span>
        <span className="portal-footer-dot" />
        <span>© {new window.Date().getFullYear()} JQ Industries</span>
      </footer>

      <FeedbackWidget accessKey={accessKey} activeSolution={activeSolutionInfo?.key} />
    </main>
  );
};

export default LicensePortal;
