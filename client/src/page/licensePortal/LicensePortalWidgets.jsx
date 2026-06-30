import React, { useState } from 'react';
import { message } from 'antd';
import {
  CloseOutlined,
  CommentOutlined,
  RightOutlined,
} from '@ant-design/icons';

const FEEDBACK_TYPES = ['功能建议', '问题反馈', '商务合作', '其他'];

export const FeedbackWidget = () => {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState(FEEDBACK_TYPES[0]);
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');

  const handleSubmit = () => {
    if (!content.trim()) {
      message.warning('请填写反馈内容');
      return;
    }
    setContent('');
    setContact('');
    setOpen(false);
    message.success('反馈已记录，感谢你的建议');
  };

  return (
    <>
      {open ? (
        <aside className="solution-feedback-modal" role="dialog" aria-modal="false" aria-label="提交反馈">
          <button className="solution-feedback-close" type="button" onClick={() => setOpen(false)} aria-label="关闭反馈">
            <CloseOutlined />
          </button>
          <h3>提交反馈</h3>
          <label className="solution-feedback-label">反馈类型</label>
          <div className="solution-feedback-type-row">
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

          <label className="solution-feedback-label" htmlFor="solution-feedback-content">反馈内容</label>
          <div className="solution-feedback-textarea">
            <textarea
              id="solution-feedback-content"
              maxLength={500}
              onChange={(event) => setContent(event.target.value)}
              placeholder="请详细描述您的建议或问题..."
              value={content}
            />
            <span>{content.length}/500</span>
          </div>

          <label className="solution-feedback-label" htmlFor="solution-feedback-contact">联系方式（选填）</label>
          <input
            id="solution-feedback-contact"
            onChange={(event) => setContact(event.target.value)}
            placeholder="邮箱 / 手机号 / 微信号"
            type="text"
            value={contact}
          />

          <button className="solution-feedback-submit" type="button" onClick={handleSubmit}>
            提交反馈
          </button>
        </aside>
      ) : null}

      <button className="solution-feedback-trigger" type="button" onClick={() => setOpen(true)}>
        <CommentOutlined />
        <strong>反馈</strong>
        <RightOutlined />
      </button>
    </>
  );
};
