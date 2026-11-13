import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const REMARK_PLUGINS = [remarkGfm];

/** 仅开放明确的网页和邮件链接，禁止模型文本导航到应用路由或本地文件。 */
function safeMessageUrl(value) {
  return /^(https?:\/\/|mailto:)/i.test(value) ? value : '';
}

/** 外部链接独立打开，缺失或不支持的地址保留可读文字。 */
function MessageLink({ href, children, title }) {
  return href ? <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>;
}

/** 表格只在消息内部滚动，键盘也能访问宽表的后续列。 */
function MessageTable({ children }) {
  return <div className="shroom-agent-markdown-table" tabIndex={0}><table>{children}</table></div>;
}

/** 回复中的图片保留说明文字，真实附件沿用受控附件预览。 */
function MessageImage({ alt }) {
  return <span>{alt}</span>;
}

const COMPONENTS = { a: MessageLink, table: MessageTable, img: MessageImage };

/** 历史和流式回复共用 Markdown；只渲染文本结构，不执行原始 HTML。 */
function AgentMarkdown({ text = '' }) {
  return <div className="shroom-agent-message-text shroom-agent-markdown">
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS} urlTransform={safeMessageUrl}>{text}</ReactMarkdown>
  </div>;
}

export default memo(AgentMarkdown);
