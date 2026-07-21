import React, { useState } from 'react';
import { message } from 'antd';
import { CloseOutlined, CommentOutlined, RightOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { LICENSE_SERVER_BASE_URL } from '../../constants';

const FEEDBACK_TYPES = [
  { value: '功能建议', labelKey: 'feedback.types.feature' },
  { value: '问题反馈', labelKey: 'feedback.types.issue' },
  { value: '商务合作', labelKey: 'feedback.types.business' },
  { value: '其他', labelKey: 'feedback.types.other' },
];

/**
 * 反馈浮窗：提交到授权后台（密钥管理系统）的 /feedback 接口。
 * - accessKey / activeSolution：作为上下文一并提交，便于后台定位来源。
 */
export const FeedbackWidget = ({ accessKey = '', activeSolution = '' }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState(FEEDBACK_TYPES[0].value);
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetAndClose = () => {
    setContent('');
    setContact('');
    setOpen(false);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      message.warning(t('feedback.required'));
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      const appVersion =
        (typeof window !== 'undefined' && window.electronAPI?.getVersion
          ? await window.electronAPI.getVersion().catch(() => '')
          : '') || '';

      const res = await fetch(`${LICENSE_SERVER_BASE_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: feedbackType,
          content: trimmed,
          contact: contact.trim(),
          // 上下文：脱敏后的密钥片段（仅取尾部，便于后台关联又不泄露完整密钥）
          licenseKeyTail: accessKey ? String(accessKey).slice(-12) : '',
          solution: activeSolution || '',
          appVersion,
          platform: (typeof window !== 'undefined' && window.electronAPI?.platform) || 'web',
          source: 'desktop-portal',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      if (data && data.ok === false) {
        throw new Error(data.error || '提交失败');
      }

      message.success(t('feedback.success'));
      resetAndClose();
    } catch (error) {
      console.error('提交反馈失败:', error);
      message.error(t('feedback.failed'));
      setSubmitting(false);
    }
  };

  return (
    <>
      {open ? (
        <>
          <div className="portal-feedback-mask" onClick={() => !submitting && setOpen(false)} />
          <aside className="portal-feedback-modal" role="dialog" aria-modal="false" aria-label={t('feedback.title')}>
            <button
              className="portal-feedback-close"
              type="button"
              onClick={() => !submitting && setOpen(false)}
              aria-label={t('feedback.close')}
            >
              <CloseOutlined />
            </button>
            <h3>{t('feedback.title')}</h3>

            <label className="portal-feedback-label">{t('feedback.type')}</label>
            <div className="portal-feedback-types">
              {FEEDBACK_TYPES.map((type) => (
                <button
                  className={type.value === feedbackType ? 'is-active' : ''}
                  key={type.value}
                  type="button"
                  onClick={() => setFeedbackType(type.value)}
                >
                  {t(type.labelKey)}
                </button>
              ))}
            </div>

            <label className="portal-feedback-label" htmlFor="portal-feedback-content">
              {t('feedback.content')}
            </label>
            <div className="portal-feedback-textarea">
              <textarea
                id="portal-feedback-content"
                maxLength={500}
                onChange={(event) => setContent(event.target.value)}
                placeholder={t('feedback.contentPlaceholder')}
                value={content}
              />
              <span>{content.length}/500</span>
            </div>

            <label className="portal-feedback-label" htmlFor="portal-feedback-contact">
              {t('feedback.contact')}
            </label>
            <input
              className="portal-feedback-input"
              id="portal-feedback-contact"
              maxLength={120}
              onChange={(event) => setContact(event.target.value)}
              placeholder={t('feedback.contactPlaceholder')}
              type="text"
              value={contact}
            />

            <button
              className="portal-feedback-submit"
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? t('feedback.submitting') : t('feedback.submit')}
            </button>
          </aside>
        </>
      ) : null}

      <button
        aria-label={t('feedback.trigger')}
        className="portal-feedback-trigger"
        title={t('feedback.trigger')}
        type="button"
        onClick={() => setOpen(true)}
      >
        <CommentOutlined />
        <strong>{t('feedback.trigger')}</strong>
        <RightOutlined />
      </button>
    </>
  );
};
