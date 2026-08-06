/**
 * Prose.jsx - 正文排版件
 *
 * 页面内容用 JSX 写，不引 markdown / MDX。理由：每页都要在正文中间嵌活组件
 * （`<DemoCard>`、从 `core` 读出来的表格），markdown 反而要再拖一整套 MDX 工具链
 * 才能做到同一件事。
 *
 * 代价是标签比 markdown 啰嗦，所以这里备四个最常用的：`Prose`（容器 + 标题 +
 * 引言）、`Section`（带分隔线的二级标题）、`Note`（三种语气的旁注）、
 * `Table`（从数据渲染，配合「文档数据一律从 core 读」那条约定）。
 */

import React from 'react';

/**
 * 页面容器。
 *
 * @param {object} props 组件属性。
 * @param {string} props.title 页面 h1。
 * @param {React.ReactNode} [props.lede] 引言，一到两句。
 * @param {React.ReactNode} props.children 正文。
 * @returns {JSX.Element} 排版容器。
 */
export function Prose({ title, lede, children }) {
  return (
    <article className="docs-prose">
      <h1>{title}</h1>
      {lede && <p className="docs-lede">{lede}</p>}
      {children}
    </article>
  );
}

/**
 * 二级小节。
 *
 * @param {object} props 组件属性。
 * @param {string} props.title 小节标题。
 * @param {React.ReactNode} props.children 小节内容。
 * @returns {JSX.Element} 小节。
 */
export function Section({ title, children }) {
  return (
    <>
      <h2>{title}</h2>
      {children}
    </>
  );
}

/**
 * 旁注。
 *
 * @param {object} props 组件属性。
 * @param {'info'|'warn'|'bad'} [props.tone] 语气：说明 / 注意 / 已知缺陷。
 * @param {string} [props.title] 加粗的首行。
 * @param {React.ReactNode} props.children 正文。
 * @returns {JSX.Element} 旁注块。
 */
export function Note({ tone = 'info', title, children }) {
  const className = tone === 'warn'
    ? 'docs-note docs-note-warn'
    : tone === 'bad'
      ? 'docs-note docs-note-bad'
      : 'docs-note';
  return (
    <div className={className}>
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}

/**
 * 数据表。
 *
 * 刻意只接**数据**不接 JSX 子节点：本站的表格几乎都是从 `core` 的常量对象直接
 * 渲染出来的（契约、预设、参数范围），传数组才能保证「源码改一行，表格跟着变」。
 *
 * @param {object} props 组件属性。
 * @param {string[]} props.head 表头。
 * @param {Array<Array<React.ReactNode>>} props.rows 行数据。
 * @returns {JSX.Element} 表格。
 */
export function Table({ head, rows }) {
  return (
    <table>
      <thead>
        <tr>{head.map((cell) => <th key={cell}>{cell}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          // eslint-disable-next-line react/no-array-index-key -- 行数据无稳定 id，且表格是只读的
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              // eslint-disable-next-line react/no-array-index-key -- 同上
              <td key={cellIndex}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 行内代码。写成组件只为少敲一层 `<code>{'…'}</code>` 的转义。 */
export function C({ children }) {
  return <code>{children}</code>;
}
