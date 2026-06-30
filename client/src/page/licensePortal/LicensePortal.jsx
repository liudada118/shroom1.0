import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import {
  CodeOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { decryptStr } from '../license/aesUtil';
import {
  BRAND_LOGO_SRC,
  getSolutionCarouselSlides,
  getUnlockedSolutions,
  normalizeLicenseFiles,
  SOLUTIONS,
} from './solutionConfig';
import { FeedbackWidget } from './LicensePortalWidgets';
import './LicensePortal.css';

const LicensePortal = () => {
  const [accessKey, setAccessKey] = useState(() => localStorage.getItem('shroomAccessKey') || '');
  const [wsConnected, setWsConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSolution, setActiveSolution] = useState('care');
  const [carouselIndexBySolution, setCarouselIndexBySolution] = useState({});
  const wsRef = useRef(null);
  const pendingKeyRef = useRef('');

  useEffect(() => {
    try {
      const ws = new WebSocket('ws://localhost:19999');
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        setSaving(false);
        pendingKeyRef.current = '';
      };
      ws.onerror = () => {
        setWsConnected(false);
        setSaving(false);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (typeof data.licenseKey === 'string' && data.licenseKey.trim() && !pendingKeyRef.current) {
            setAccessKey(data.licenseKey);
            localStorage.setItem('shroomAccessKey', data.licenseKey);
          }

          if (data.licenseError != null) {
            if (data.noLicense && !pendingKeyRef.current) {
              return;
            }
            setSaving(false);
            pendingKeyRef.current = '';
            message.error(data.licenseError);
            return;
          }

          if (pendingKeyRef.current && data.date != null && data.date > 0) {
            if (typeof data.licenseKey === 'string' && data.licenseKey.trim()) {
              localStorage.setItem('shroomAccessKey', data.licenseKey);
            }
            pendingKeyRef.current = '';
            setSaving(false);
            message.success('密钥已保存，并已写入应用配置');
          }
        } catch (error) {
          console.error('解析密钥保存回包失败:', error);
        }
      };
      wsRef.current = ws;
    } catch (error) {
      setWsConnected(false);
    }

    return () => {
      wsRef.current?.close();
    };
  }, []);

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
      return {
        ...prev,
        [solutionKey]: nextIndex,
      };
    });
  }, []);

  const handleSave = useCallback(() => {
    const key = accessKey.trim();
    if (!key) {
      message.warning('请输入访问密钥');
      return;
    }

    let decrypted;
    try {
      decrypted = JSON.parse(decryptStr(key));
    } catch (error) {
      message.error('密钥验证失败，请检查后重试');
      return;
    }

    const files = normalizeLicenseFiles(decrypted.file);
    const nextUnlockedSolutions = getUnlockedSolutions(files);
    if (nextUnlockedSolutions[0]) {
      setActiveSolution(nextUnlockedSolutions[0]);
    }

    localStorage.setItem('shroomAccessKey', key);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      pendingKeyRef.current = key;
      setSaving(true);
      wsRef.current.send(JSON.stringify({ date: { date: key } }));
    } else {
      message.warning('密钥已保存到本地，应用未连接，暂未写入应用配置');
    }
  }, [accessKey]);

  return (
    <main className="solution-license-page">
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
            onChange={(event) => setAccessKey(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSave();
            }}
            placeholder="请输入访问密钥"
            type="text"
            value={accessKey}
          />
          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? '保存中' : '保存'}
          </button>
        </div>
        <div className="solution-access-note">
          <LockOutlined />
          密钥验证通过后，将自动加载并解锁对应方案内容
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
};

export default LicensePortal;
