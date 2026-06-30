import React, { useState } from 'react';
import { message } from 'antd';
import { CloseOutlined, CommentOutlined, RightOutlined } from '@ant-design/icons';
import { LICENSE_SERVER_BASE_URL } from '../../constants';

const FEEDBACK_TYPES = ['功能建议', '问题反馈', '商务合作', '其他'];

/**
 * 反馈浮窗：提交到授权后台（密钥管理系统）的 /feedback 接口。
 * - accessKey / activeSolution：作为上下文一并提交，便于后台定位来源。
 */
export const FeedbackWidget = ({ accessKey = '', activeSolution = '' }) => {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState(FEEDBACK_TYPES[0]);
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
      message.warning('请填写反馈内容');
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

      message.success('反馈已提交，感谢你的建议');
      resetAndClose();
    } catch (error) {
      console.error('提交反馈失败:', error);
      message.error('反馈提交失败，请稍后重试或检查网络');
      setSubmitting(false);
    }
  };

  return (
    <>
      {open ? (
        <>
          <div className="portal-feedback-mask" onClick={() => !submitting && setOpen(false)} />
          <aside className="portal-feedback-modal" role="dialog" aria-modal="false" aria-label="提交反馈">
            <button
              className="portal-feedback-close"
              type="button"
              onClick={() => !submitting && setOpen(false)}
              aria-label="关闭反馈"
            >
              <CloseOutlined />
            </button>
            <h3>提交反馈</h3>

            <label className="portal-feedback-label">反馈类型</label>
            <div className="portal-feedback-types">
              {FEEDBACK_TYPES.map((type) => (
                <button
                  className={type === feedbackType ? 'is-active' : ''}
                  key={type}
                  type="button"
                  onClick={() => setFeedbackType(type)}
                >
                  {type}
                </button>
              ))}
            </div>

            <label className="portal-feedback-label" htmlFor="portal-feedback-content">
              反馈内容
            </label>
            <div className="portal-feedback-textarea">
              <textarea
                id="portal-feedback-content"
                maxLength={500}
                onChange={(event) => setContent(event.target.value)}
                placeholder="请详细描述您的建议或问题..."
                value={content}
              />
              <span>{content.length}/500</span>
            </div>

            <label className="portal-feedback-label" htmlFor="portal-feedback-contact">
              联系方式（选填）
            </label>
            <input
              className="portal-feedback-input"
              id="portal-feedback-contact"
              maxLength={120}
              onChange={(event) => setContact(event.target.value)}
              placeholder="邮箱 / 手机号 / 微信号"
              type="text"
              value={contact}
            />

            <button
              className="portal-feedback-submit"
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? '提交中…' : '提交反馈'}
            </button>
          </aside>
        </>
      ) : null}

      <button className="portal-feedback-trigger" type="button" onClick={() => setOpen(true)}>
        <CommentOutlined />
        <strong>反馈</strong>
        <RightOutlined />
      </button>
    </>
  );
};
