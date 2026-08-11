/**
 * CodeBlock.jsx - 高亮代码块
 *
 * prismjs 的 `components/prism-*.js` 是 UMD 脚本，靠副作用往 `Prism.languages`
 * 上挂语法，**不导出任何东西**。所以下面那两句 side-effect import 不能省，
 * 也不能改写成命名导入 —— 少了它们 `Prism.languages.jsx` 是 undefined，
 * `highlight()` 会抛。
 *
 * 主题**不引 prism 自带的 css**，配色写在 `styles.css` 的 `.docs-code .token.*` 里。
 * 理由：prism 的主题文件会给 `pre[class*="language-"]` 加上自己的 padding /
 * 背景 / 圆角，和站点的卡片样式打架，最后还是要一条条盖回来。
 */

import Prism from 'prismjs';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-json.js';
import React from 'react';

/**
 * 高亮一段代码。
 *
 * @param {object} props 组件属性。
 * @param {string} props.code 源码文本。
 * @param {'jsx'|'javascript'|'json'|'bash'} [props.language] 语言，默认 jsx。
 * @param {string} [props.path] 头部显示的文件路径。
 * @param {string} [props.note] 头部右侧的一句说明。
 * @returns {JSX.Element} 代码块。
 */
export default function CodeBlock({ code, language = 'jsx', path, note }) {
  const [copied, setCopied] = React.useState(false);
  const html = React.useMemo(() => {
    const grammar = Prism.languages[language];
    // 未登记的语言（比如 bash）就不高亮，但**必须仍然转义** ——
    // 否则源码里的 `<RendererHost />` 会被当成真 HTML 插进 DOM。
    if (!grammar) {
      return String(code).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    }
    return Prism.highlight(String(code), grammar, language);
  }, [code, language]);

  const copyCode = React.useCallback(async () => {
    const text = String(code);
    let success = false;
    try {
      await navigator.clipboard.writeText(text);
      success = true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      success = document.execCommand('copy');
      textarea.remove();
    }
    if (!success) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }, [code]);

  return (
    <div>
      <div className="docs-code-head">
        <span className="docs-code-path">{path}</span>
        <span className="docs-code-note">{note}</span>
        <button type="button" className="docs-code-copy" onClick={copyCode}>
          {copied ? '已复制' : '复制代码'}
        </button>
      </div>
      <pre className="docs-code">
        {/* eslint-disable-next-line react/no-danger -- 内容是 Prism 转义后的自家源码 */}
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
