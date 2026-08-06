/**
 * DemoCard.jsx - 活预览 + 「显示代码」折叠
 *
 * 这个组件是整个文档站的**核心承诺**：折叠出来的源码，就是上面那块画面正在跑的
 * 那个文件本身。用法固定成两句 import：
 *
 * ```jsx
 * import Demo from './demos/CustomRenderer.jsx';
 * import source from './demos/CustomRenderer.jsx?raw';
 *
 * <DemoCard title="…" path="src/demos/CustomRenderer.jsx" source={source}>
 *   <Demo />
 * </DemoCard>
 * ```
 *
 * 同一个文件被 import 两次：一次拿组件去跑，一次拿文本去显示。**两者不可能漂移**
 * —— 这是选「手写 React 应用」而不是 VitePress 的唯一理由。放弃这条约定，
 * 这个站就该用 VitePress 重写。
 *
 * 源码默认折叠。展开的是 `<pre>` 而不是 iframe / 编辑器：读者的目的是「抄一段
 * 到自己项目里」，可选中的纯文本是最短路径。在线可编辑是另一个量级的东西
 * （要 in-browser 转译 + 沙箱），不在本轮范围。
 */

import React from 'react';

import CodeBlock from './CodeBlock.jsx';
import Live from './Live.jsx';

/**
 * 一张 demo 卡片。
 *
 * @param {object} props 组件属性。
 * @param {string} props.title 标题。
 * @param {string} [props.sub] 副标题，一句话说明这块在演示什么。
 * @param {string} [props.source] `?raw` 引进来的源码文本。不传就没有「显示代码」。
 * @param {string} [props.path] 源码路径，显示在代码块头部。
 * @param {React.ReactNode} [props.controls] 画面上方的参数控件区。
 * @param {number} [props.height] 舞台高度，透传给 `Live`。
 * @param {'scaled'|'actual'} [props.mode] 舞台模式，透传给 `Live`。
 * @param {string} [props.hint] 舞台角标，透传给 `Live`。
 * @param {React.ReactNode} props.children 要跑的组件。
 * @returns {JSX.Element} 卡片。
 */
export default function DemoCard({
  title,
  sub,
  source,
  path,
  controls,
  height,
  mode,
  hint,
  children,
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <section className="docs-card">
      <header className="docs-card-head">
        <div>
          <div className="docs-card-title">{title}</div>
          {sub && <div className="docs-card-sub">{sub}</div>}
        </div>
        {source && (
          <button type="button" className="docs-card-toggle" onClick={() => setOpen(!open)}>
            {open ? '收起代码' : '显示代码'}
          </button>
        )}
      </header>

      {controls && <div className="docs-card-controls">{controls}</div>}

      <Live height={height} mode={mode} hint={hint}>{children}</Live>

      {source && open && (
        <div className="docs-card-source">
          <CodeBlock
            code={source}
            path={path}
            note="这就是上面那块画面正在跑的文件"
          />
        </div>
      )}
    </section>
  );
}
