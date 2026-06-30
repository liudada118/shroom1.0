import { Modal, message } from 'antd';
import {
  CodeOutlined,
  LockOutlined,
} from '@ant-design/icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { decryptStr } from '../license/aesUtil';
import {
  BRAND_LOGO_SRC,
  getSolutionCarouselSlides,
  getUnlockedSolutions,
  normalizeLicenseFiles,
  SOLUTIONS,
} from '../licensePortal/solutionConfig';
import { FeedbackWidget } from '../licensePortal/LicensePortalWidgets';
import '../licensePortal/LicensePortal.css';
import './index.scss';

export default function Date1() {
  const nav = useNavigate();
  const param = useLocation();
  const wsRef = useRef(null);
  const isSubmitting = useRef(false);
  const submittedFilesRef = useRef([]);
  const [date, setDate] = useState(() => localStorage.getItem('shroomAccessKey') || '');
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [licenseReady, setLicenseReady] = useState(false);
  const [activeSolution, setActiveSolution] = useState('care');
  const [carouselIndexBySolution, setCarouselIndexBySolution] = useState({});
  const [messageApi, contextHolder] = message.useMessage();

  const isFromSystem = useMemo(() => {
    const search = param.search || '';
    const hash = window.location.hash || '';
    const href = window.location.href || '';
    return search.includes('from=system') || search.includes('a=b') ||
      hash.includes('from=system') || hash.includes('a=b') ||
      href.includes('from=system') || href.includes('a=b');
  }, [param.search]);

  const activeSolutionInfo = useMemo(
    () => SOLUTIONS.find((solution) => solution.key === activeSolution) || SOLUTIONS[0],
    [activeSolution]
  );
  const savedAccessKey = localStorage.getItem('shroomAccessKey') || '';
  const canEnterSystem = licenseReady && date.trim() && date.trim() === savedAccessKey.trim();
  const accessActionLabel = loading
    ? '验证中'
    : canEnterSystem
      ? (isFromSystem ? '回到系统' : '进入系统')
      : '保存';

  const updateUnlockedSolutions = useCallback((files) => {
    const nextUnlockedSolutions = getUnlockedSolutions(files);
    if (nextUnlockedSolutions[0]) {
      setActiveSolution(nextUnlockedSolutions[0]);
    }
  }, []);

  const handleCarouselStep = useCallback((solutionKey, carouselSlides, direction) => {
    setActiveSolution(solutionKey);
    const slideCount = carouselSlides.length;
    setCarouselIndexBySolution((prev) => {
      const currentIndex = prev[solutionKey] || 0;
      const nextIndex = (currentIndex + direction + slideCount) % slideCount;
      return {
        ...prev,
        [solutionKey]: nextIndex,
      };
    });
  }, []);

  useEffect(() => {
    const ws = new WebSocket('ws://127.0.0.1:19999');
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (typeof data.licenseKey === 'string' && data.licenseKey.trim() && !isSubmitting.current) {
          setDate(data.licenseKey);
          localStorage.setItem('shroomAccessKey', data.licenseKey);
        }

        if (data.licenseError != null) {
          setLoading(false);
          isSubmitting.current = false;
          setLicenseReady(false);

          if (!data.noLicense) {
            Modal.error({
              title: '密钥错误',
              content: data.licenseError,
            });
          }
          return;
        }

        if (data.selectFlag != null) {
          if (data.selectFlag === 'all') {
            localStorage.setItem('matrixTitle', true);
            localStorage.removeItem('allowedTypes');
          } else if (Array.isArray(data.selectFlag)) {
            localStorage.setItem('matrixTitle', true);
            localStorage.setItem('allowedTypes', JSON.stringify(data.selectFlag));
          } else {
            localStorage.removeItem('matrixTitle');
            localStorage.removeItem('allowedTypes');
          }
        }

        if (data.date != null && data.date > 0) {
          setLoading(false);
          const wasSubmitting = isSubmitting.current;
          isSubmitting.current = false;

          const serverNow = data.nowDate ? parseFloat(data.nowDate) : window.Date.now();
          const endDate = parseFloat(data.date);
          if (endDate <= serverNow) {
            setLicenseReady(false);
            if (wasSubmitting) {
              Modal.error({
                title: '密钥已过期',
                content: '该密钥已过期，请输入有效的密钥',
              });
            }
            return;
          }

          setLicenseReady(true);
          const validFiles = data.file != null
            ? normalizeLicenseFiles(data.file)
            : submittedFilesRef.current;
          if (validFiles.length || wasSubmitting) {
            updateUnlockedSolutions(validFiles);
          }

          if (wasSubmitting) {
            if (typeof data.licenseKey === 'string' && data.licenseKey.trim()) {
              localStorage.setItem('shroomAccessKey', data.licenseKey);
            }
            messageApi.success('密钥验证成功，可手动进入系统');
          }
        }
      } catch (err) {
        console.error('解析消息失败:', err);
      }
    };

    ws.onerror = () => setWsConnected(false);
    ws.onclose = () => setWsConnected(false);

    return () => {
      wsRef.current?.close();
    };
  }, [messageApi, updateUnlockedSolutions]);

  const handleSubmit = useCallback(() => {
    const trimmed = date.trim();
    if (!trimmed) {
      Modal.error({
        title: '密钥错误',
        content: '密钥不能为空，请输入有效密钥',
      });
      return;
    }

    let parsedLicense;
    try {
      parsedLicense = JSON.parse(decryptStr(trimmed));
    } catch (error) {
      Modal.error({
        title: '密钥错误',
        content: '密钥验证失败，请检查后重试',
      });
      return;
    }

    submittedFilesRef.current = normalizeLicenseFiles(parsedLicense.file);
    localStorage.setItem('shroomAccessKey', trimmed);
    setLoading(true);
    isSubmitting.current = true;

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        date: {
          date: trimmed,
          startTime: window.Date.now(),
        },
      }));
    } else {
      setLoading(false);
      isSubmitting.current = false;
      Modal.error({
        title: '连接错误',
        content: '密钥已保存到本地，但与服务器的连接已断开，暂未写入应用配置',
      });
    }
  }, [date]);

  const handleAccessAction = useCallback(() => {
    if (canEnterSystem) {
      nav('/system');
      return;
    }
    handleSubmit();
  }, [canEnterSystem, handleSubmit, nav]);

  return (
    <main className="solution-license-page">
      {contextHolder}
      <header className="solution-topbar">
        <div className="solution-brand">
          <img alt="Shroom" className="solution-logo-img" draggable={false} src={BRAND_LOGO_SRC} />
        </div>
        <div className="solution-top-actions">
          <div className="solution-status">
            <i className={wsConnected ? 'is-online' : 'is-offline'} />
            {wsConnected ? '系统已就绪' : '系统未连接'}
          </div>
          <div className="solution-sdk-badge">
            <CodeOutlined />
            <span>SDK 定制</span>
          </div>
        </div>
      </header>

      <section className="solution-hero">
        <h1>Shroom Vision</h1>
        <p>
          <span>面向康养、汽车、具身智能等行业场景，一站式完成压力可视化展示、动态数据采集与专业报告输出。</span>
        </p>
      </section>

      <section className={`solution-access-panel theme-${activeSolutionInfo.color}`}>
        <div className="solution-access-form">
          <input
            aria-label="访问密钥"
            onChange={(event) => setDate(event.target.value.trim())}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleAccessAction();
            }}
            placeholder="请输入访问密钥"
            type="text"
            value={date}
          />
          <button type="button" onClick={handleAccessAction} disabled={loading}>
            {accessActionLabel}
          </button>
        </div>
        <div className="solution-access-note">
          <LockOutlined />
          密钥验证通过后，将解锁对应方案内容，请手动进入系统
        </div>
      </section>

      <section className="solution-grid" aria-label="行业方案">
        {SOLUTIONS.map((solution) => {
          const carouselSlides = getSolutionCarouselSlides(solution);
          const carouselIndex = Math.min(carouselIndexBySolution[solution.key] || 0, carouselSlides.length - 1);
          return (
            <article
              className={`solution-card theme-${solution.color}`}
              key={solution.key}
            >
              <div className="solution-card-head">
                <div className="solution-head-icon">
                  {solution.icon}
                </div>
                <div>
                  <h2>{solution.title}</h2>
                  <p>{solution.subtitle}</p>
                </div>
              </div>

              <div className="solution-divider" />

              <div className="solution-carousel">
                {carouselSlides.length > 1 ? (
                  <div className="solution-carousel-viewport">
                    <div
                      className="solution-carousel-track"
                      style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
                    >
                      {carouselSlides.map((slide, slideIndex) => (
                        <div className="solution-carousel-slide" key={`${solution.key}-${slideIndex}`}>
                          <div className="solution-module-row">
                            {slide.map((module) => (
                              <div
                                className={`solution-module ${module.isResearch ? 'is-research' : ''}`}
                                key={module.key}
                              >
                                <span className="solution-module-icon">{module.icon}</span>
                                <span>{module.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="solution-module-row">
                    {(carouselSlides[0] || []).map((module) => (
                      <div
                        className={`solution-module ${module.isResearch ? 'is-research' : ''}`}
                        key={module.key}
                      >
                        <span className="solution-module-icon">{module.icon}</span>
                        <span>{module.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                {carouselSlides.length > 1 ? (
                  <>
                    <div className="solution-carousel-controls">
                      <button type="button" onClick={() => handleCarouselStep(solution.key, carouselSlides, -1)}>‹</button>
                      <span>{carouselIndex + 1}/{carouselSlides.length}</span>
                      <button type="button" onClick={() => handleCarouselStep(solution.key, carouselSlides, 1)}>›</button>
                    </div>
                    <div className="solution-carousel-progress" aria-hidden="true">
                      <span style={{ width: `${((carouselIndex + 1) / carouselSlides.length) * 100}%` }} />
                    </div>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      <FeedbackWidget />

    </main>
  );
}
