import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AgentMarkdown from './AgentMarkdown';

describe('Agent Markdown 回复', () => {
  it('展示标题、强调、嵌套列表、引用、代码及 GFM 表格', () => {
    const text = ['## 采集结果', '', '**保存完整**，使用 `timestamp`。', '', '1. 连接设备', '   - 检查数据',
      '', '> 保留原始间隔', '', '| hand | 秒数 |', '| --- | ---: |', '| left | 0.125 |',
      '', '```js', 'const frame = "<tag>";', '```', '', '- [x] 已保存', '- [ ] 待分析', '', '~~旧说明~~'].join('\n');
    const html = renderToStaticMarkup(<AgentMarkdown text={text} />);
    expect(html).toContain('<h2>采集结果</h2>');
    expect(html).toContain('<strong>保存完整</strong>');
    expect(html).toContain('<code>timestamp</code>');
    expect(html).toMatch(/<ol>[\s\S]*<ul>[\s\S]*检查数据/);
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<table>');
    expect(html).toContain('<th>hand</th>');
    expect(html).toContain('<td style="text-align:right">0.125</td>');
    expect(html).toContain('<pre><code class="language-js">');
    expect(html).toContain('&lt;tag&gt;');
    expect(html).toContain('disabled=""');
    expect(html).toContain('<del>旧说明</del>');
  });

  it('保留 HTML 原文为文本，图片只显示说明，不生成可执行节点', () => {
    const text = '<script>alert(1)</script>\n\n<img src="https://example.invalid/track" onerror="alert(2)">\n\n![压力示意](https://example.invalid/image.png)';
    const html = renderToStaticMarkup(<AgentMarkdown text={text} />);
    expect(html).not.toMatch(/<(script|img|iframe|svg)\b/);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('压力示意');
  });

  it.each(['javascript:alert%281%29', 'data:text/html,unsafe', 'file:///C:/secret.txt', '//example.invalid', '/settings', '#settings', 'vbscript:unsafe'])('不把不支持的地址变为链接：%s', (url) => {
    const html = renderToStaticMarkup(<AgentMarkdown text={`[说明](${url})`} />);
    expect(html).toContain('说明');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('href=');
  });

  it('普通链接和自动识别网址使用独立窗口且禁止 opener', () => {
    const html = renderToStaticMarkup(<AgentMarkdown text={'[文档](https://example.com/docs)\n\nhttps://example.com\n\n[邮件](mailto:help@example.com)'} />);
    expect(html.match(/<a /g)).toHaveLength(3);
    expect(html.match(/target="_blank" rel="noopener noreferrer"/g)).toHaveLength(3);
  });

  it('流式尚未闭合的代码块仍作为代码，补全后正常展示后续段落', () => {
    const partial = '### 分析\n\n```json\n{"frames": 1634';
    const html = renderToStaticMarkup(<AgentMarkdown text={partial} />);
    expect(html).toContain('<h3>分析</h3>');
    expect(html).toContain('<pre><code class="language-json">');
    expect(html).toContain('1634');
    const complete = renderToStaticMarkup(<AgentMarkdown text={`${partial}}\n\`\`\`\n\n**完成**`} />);
    expect(complete).toContain('</code></pre>');
    expect(complete).toContain('<strong>完成</strong>');
  });
});
