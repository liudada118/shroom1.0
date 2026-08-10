/**
 * Pitfalls.jsx - 「坑与已知妥协」页
 *
 * 这页是全站唯一一页**故意讲缺点**的。它存在的理由：拆包时留下的妥协要么写下来，
 * 要么下一个人踩一遍。
 *
 * 权威来源是 `backend/tests/sdk/backendPackageInvariants.test.js` —— 那个文件的三个
 * 函数就是这页前三节。文档能过期，测试不能；所以每节都指名那条断言，
 * 妥协哪天被消掉了，测试会先红，然后有人回来删这一节。
 *
 * peer 依赖表从包的真 `package.json` 读（`exports` 里有 `./package.json`）；
 * 垫片表从 `docs/shims/*.js` 真扫。都不手抄。
 */

import pkg from '@shroom/backend/package.json';
import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

/** 本站给 node 内置模块配的垫片，构建期真扫出来。 */
const SHIMS = import.meta.glob('../../shims/*.js', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** 每个垫片是「能用的替代」还是「抛错桩」，以及谁需要它。 */
const SHIM_NOTES = {
  'events.js': {
    kind: '可用替代',
    who: <span><C>telemetry/channelBus.js</C> 的 EventEmitter</span>,
    what: '只实现了 on / off / once / emit —— 包里只用到这四个',
  },
  'crypto.js': {
    kind: '可用替代',
    who: <span><C>contract/commandProtocol.js</C> 生成 requestId</span>,
    what: '转发浏览器原生 crypto.randomUUID()',
  },
  'fs.js': {
    kind: '抛错桩',
    who: <span><C>processing/configMappingExecutor.js</C>、<C>protocol/presets/index.js</C></span>,
    what: '一调用就抛。故意的：静默返回空比一条明确的错难查得多',
  },
  'path.js': {
    kind: '抛错桩',
    who: <span><C>logger.js</C>（声明了没用）、<C>protocol/presets/index.js</C></span>,
    what: '同上。配它主要是为了让构建输出干净',
  },
};

const PEER_USE = {
  serialport: '开串口。/serial、/session 要',
  '@serialport/parser-delimiter': '按分隔符切帧。/serial 要',
  'better-sqlite3': '落库。/storage、/session 要',
  'csv-writer': '导出 CSV。/export 要',
  ws: 'WebSocket 客户端。/client 要',
};

const NO_PEER = `// 只要算法：一个 peer 依赖都不用装
const { applyLineOrder } = require('@shroom/backend/processing');
const { decodeProtocolValues } = require('@shroom/backend/protocol');
const { SENSOR_DEFINITIONS } = require('@shroom/backend/sensors');`;

const IGNORE = `// forge.config.js —— 打包时把两个文档站都排除掉
packagerConfig: {
  ignore: [
    /^\\/sdk\\/frontend\\/(example|docs)($|\\/)/,
    /^\\/sdk\\/backend\\/docs($|\\/)/,
  ],
}`;

export default function Pitfalls() {
  const shims = Object.entries(SHIMS)
    .map(([path, source]) => ({
      file: path.split('/').pop(),
      lines: source.split('\n').length,
    }))
    .sort((a, b) => a.file.localeCompare(b.file));

  const peers = Object.keys(pkg.peerDependencies || {}).sort();
  const optional = peers.filter((name) => pkg.peerDependenciesMeta?.[name]?.optional);

  return (
    <Prose
      title="坑与已知妥协"
      lede="拆包留下的东西。写在这儿，比让下一个人踩一遍便宜。"
    >
      <p>
        下面前三节对应 <C>backend/tests/sdk/backendPackageInvariants.test.js</C> 里的三个断言。
        那个文件放在包外，因为要查的东西一半在包外 —— 包自己是自洽的，
        是仓库里同时存在两份而已。
        <strong>妥协哪天被消掉，测试会先红</strong>，那时候回来删掉对应的一节。
      </p>

      <Section title="妥协 1：commandSchema.json 有两份">
        <p>
          <C>shared/commandSchema.json</C> 和 <C>@shroom/backend/contract/commandSchema.json</C>
          {' '}是同一份文件的两个副本。
        </p>
        <p>
          <strong>为什么不 require 过去：</strong>包里写
          {' '}<C>require('../../../shared/commandSchema.json')</C> 要往上跑四级、跑出包根。
          在这个仓库里解析得开，<C>npm pack</C> 装出来就崩 —— 前端包
          {' '}<C>@shroom/frontend</C> 踩过一次，它 README 的「已知缺口」里记着。
        </p>
        <p>
          <strong>为什么不合并：</strong>这个 JSON 现在有 5 个消费者。除了上面两处，还有
          {' '}<C>client/src/services/command/commandSchema.js</C> 和
          {' '}<C>sdk/frontend/src/client/commands.js</C>。动它要同时改前端包和 client，
          归属问题留到统一 <C>shared/</C> 那轮。
        </p>
        <Note tone="warn" title="所以：改了一份就要改另一份">
          <C>testCommandSchemaNoDrift()</C> 用 <C>deepStrictEqual</C> 比两份，
          长歪了测试立刻红。它不会替你同步，只会拦住你。
        </Note>
      </Section>

      <Section title="妥协 2：传感器元数据有两份，波特率写两遍">
        <Table
          head={['哪一份', '存什么']}
          rows={[
            [<C>@shroom/backend/sensors</C>, <span><C>SENSOR_DEFINITIONS</C> —— 矩阵尺寸、通道、能力标签、波特率</span>],
            [<C>@shroom/backend/session</C>, <span><C>DEFAULT_SENSOR_PROFILES</C> —— 分帧、解码偏移、波特率</span>],
          ]}
        />
        <p>
          <strong>为什么这轮没合并：</strong><C>getDefaultBaudRate()</C> 里有注册表表达不了的规则 ——
          <C>robot</C> 是<strong>前缀包含匹配</strong>（不是精确键），而
          {' '}<C>footVideo</C> / <C>eye</C> / <C>daliegu</C> 这几个类型压根不在注册表里。
          强行合并会悄悄改掉某些类型的波特率，那种改动没人能在 review 里看出来。
        </p>
        <p>
          <strong>会怎么咬人：</strong>一边改了另一边没改，表现是
          <strong>「串口能开，但一帧都解不出来」</strong>，而且<strong>不报错</strong>。
          这是本页最值得记住的一条 —— 加新传感器类型时两边都要填，
          流程见<a href="#/add-sensor">加一种自己的传感器</a>第三步。
        </p>
        <Note title="测试只守得住交集">
          <C>testBaudRateAgreement()</C> 对<strong>两份表都认识</strong>的类型断言波特率一致。
          只在一边出现的类型（比如上面那三个）它管不到 —— 那正是妥协还没消掉的部分。
        </Note>
      </Section>

      <Section title="妥协 3（已经收口）：backend 不许再用相对路径伸进 sdk/">
        <p>
          搬家之后 <C>backend/**</C> 引用包一律走包名。留一条
          {' '}<C>require('../../sdk/backend/...')</C> 进来，<C>file:</C> 依赖这层就白做了 ——
          那等于只是换了个目录名。
        </p>
        <p>
          <C>testBackendDoesNotReachIntoSdkDirectory()</C> 递归扫
          {' '}<C>backend/**/*.js</C> 的每一条 <C>require('./…')</C>，解析出绝对路径后
          看有没有落进 <C>sdk/</C>。这条现在是绿的，属于「已经收口、靠测试保持」。
        </p>
      </Section>

      <Section title="坑 4：validateFrame() 不数字节">
        <Note tone="bad" title="截断的帧会被静默地少解一批值">
          <p>
            <C>validateFrame()</C> 在协议没声明 <C>validation</C> 时
            <strong>直接返回 true，一个字节都不数</strong>（<C>displaySystemProtocol.js:292</C>）。
            而内置预设<strong>全都没写 <C>validation</C></strong>。
          </p>
          <p>
            于是一帧 1024 点的数据被砍到 614 字节时：校验通过 →
            <C>decodeProtocolValues()</C> 返回 <strong>614 个值</strong>，不抛错、不警告。
            画面上是「传感器坏了半边」，日志里干干净净。
          </p>
          <p>
            两个办法：给协议声明 <C>validation.checksum</C> 且 <C>byteOffset</C> 用
            <strong>绝对偏移</strong>（帧一短，偏移落到帧外，才会返回
            {' '}<C>{'{ ok: false, reason: \'length\' }'}</C>）；或者调用方自己比
            {' '}<C>values.length</C> 和 <C>config.decoding.valueCount</C>。
          </p>
          <p>
            <a href="#/protocol">协议与解码</a>那页的 demo 可以把这两条都拨出来看。
          </p>
        </Note>
        <p>
          这一条是<strong>写这个文档站时才发现的</strong>：因为约定了活预览必须跑真函数，
          造了一帧短的喂进去，才看见校验居然放行。照 JSDoc 抄的话会写成
          「validateFrame 会挡掉短帧」—— 那是错的，而且已经差点写进这个站里。
        </p>
      </Section>

      <Section title={`坑 5：${peers.length} 个 peer 依赖，装不装看你用哪层`}>
        <p>
          {optional.length} 个全部标了 <C>optional: true</C>，所以
          {' '}<C>npm install</C> <strong>不会自动装</strong>，也不会警告。
          只用算法层的话这是好事（下面这段一个 peer 都不用装）：
        </p>
        <CodeBlock code={NO_PEER} language="javascript" />
        <p>
          代价是：<strong>用到没装的那层时，错误发生在 require 的那一刻</strong>，
          消息是 <C>Cannot find module 'serialport'</C> —— 看起来像包坏了，其实是没装 peer。
        </p>
        <Table
          head={['peer 依赖', '版本', '谁要它']}
          rows={peers.map((name) => [
            <C>{name}</C>,
            pkg.peerDependencies[name],
            PEER_USE[name] || <em>（未登记）</em>,
          ])}
        />
      </Section>

      <Section title="坑 6：file: 依赖是软链，打包时会 EPERM">
        <p>
          <C>"@shroom/backend": "file:sdk/backend"</C> 在 <C>node_modules</C> 里建的是
          <strong>软链</strong>，不是副本。日常开发很好 —— 改包内文件立刻生效，不用重装。
          但 electron 打包时 <C>derefSymlinks</C> 要跟着链接把真文件复制过去，
          Windows 上没有权限建/读符号链接就是 <C>EPERM</C>。
        </p>
        <p>
          出现这个错先看两条：终端是不是管理员 / 开发者模式；以及
          {' '}<C>node_modules/@shroom/backend</C> 是不是<strong>断链</strong>了
          （包目录改过名、git 换过分支之后常见）。重装一次
          {' '}<C>npm install</C> 就能重建链接。
        </p>
        <Note tone="warn" title="还有一条：文档站必须排除在打包之外">
          <p>
            两个文档站各自有自己的 <C>node_modules</C>（react + vite）。漏掉排除规则的话，
            它们会整个被打进安装包 —— 体积上去了，而且用户根本用不到。
          </p>
          <CodeBlock code={IGNORE} language="javascript" />
          <p>
            <C>electron-builder</C> 那侧对应的是 <C>build.files</C> 里的
            {' '}<C>!sdk/backend/docs/**</C>。<strong>两处都要写</strong>，两个打包器互不认识对方的配置。
          </p>
        </Note>
      </Section>

      <Section title={`坑 7：这个站给浏览器配了 ${shims.length} 个 node 垫片`}>
        <Note tone="bad" title="这些垫片是文档站的代价，不是包的要求">
          <C>@shroom/backend</C> 是<strong>给 Node 用的</strong>。本站能跑活预览，
          是因为把<strong>纯计算层</strong>塞进了浏览器，并给它顶层 require 的 node 内置模块配了替身。
          <strong>不要照着这个配置在浏览器里用这个 SDK</strong> ——
          串口 / SQLite / CSV / WebSocket 那几层根本没法跑，垫片也救不了。
        </Note>
        <Table
          head={['垫片', '行数', '类型', '谁需要', '实现了什么']}
          rows={shims.map((item) => {
            const note = SHIM_NOTES[item.file] || {};
            return [
              <C>{item.file}</C>,
              `${item.lines}`,
              note.kind === '抛错桩'
                ? <span className="docs-verdict docs-verdict-false">{note.kind}</span>
                : <span className="docs-verdict docs-verdict-true">{note.kind || '—'}</span>,
              note.who || <em>（未登记）</em>,
              note.what || <em>（未登记）</em>,
            ];
          })}
        />
        <p>
          还有两处不在这张表里，因为它们是<strong>全局标识符</strong>而不是 import ——
          alias 改写不了，只能在 <C>src/main.jsx</C> 里挂进 <C>globalThis</C>：
        </p>
        <Table
          head={['全局', '谁碰它', '什么时候碰']}
          rows={[
            [
              <C>Buffer</C>,
              <span><C>decodeProtocolValues</C> / <C>validateFrame</C> / <C>computeChecksum</C> 里的 <C>Buffer.from()</C></span>,
              '函数被调用时',
            ],
            [
              <C>process</C>,
              <span><C>logger.js:27,30</C> 和 <C>processing/lineOrders.js:35</C> 顶层读 <C>process.env</C></span>,
              <strong>模块加载时</strong>,
            ],
          ]}
        />
        <p>
          「什么时候碰」这一列决定了漏掉时的症状：<C>Buffer</C> 漏了是某个功能崩，
          <C>process</C> 漏了是 <strong>整页白屏</strong> ——
          <C>ReferenceError: process is not defined</C>，页面连渲染都开始不了。
        </p>
        <Note tone="warn" title="这一条是 build 和 SSR 检查都抓不到的">
          <p>
            <C>vite build</C> 只管打包不管执行；SSR 检查跑在 Node 里，而 Node 本来就有
            {' '}<C>process</C>。两道关都绿，浏览器里四页白屏。
          </p>
          <p>
            它是<strong>拿浏览器真点一遍才露出来的</strong>。那一遍现在是一条命令：
            {' '}<C>npm run sdk:backend-docs-click</C>（见下一节）。
            三道关<strong>互相盖不住</strong>，缺一不可。
          </p>
        </Note>
        <p>
          两个抛错桩<strong>不是偷懒</strong>：让 <C>fs</C> 静默返回空，
          「0 份预设」这种结果会一路飘到页面上，看起来像数据没了；
          抛错则当场指出「这个能力在浏览器里做不了」。
        </p>
      </Section>

      <Section title="坑 8：optimizeDeps.include 漏一行就白屏">
        <p>
          包是 CJS，又是软链装进来的，而 Vite <strong>默认不预构建 linked 依赖</strong>。
          没预构建就等于把 <C>module.exports = {'{…}'}</C> 原样丢给浏览器，
          <C>module is not defined</C>，白屏。
        </p>
        <p>
          所以 <C>docs/vite.config.js</C> 的 <C>optimizeDeps.include</C> 里
          <strong>每一个会被 import 的子路径都要显式列出来</strong>。加一页用到新子模块，
          就往那个数组加一行。
        </p>
        <p>
          生产构建走另一条路（rollup 的 commonjs 插件），对应
          {' '}<C>build.commonjsOptions.include</C>。那条规则有个反直觉的地方：
          <strong>它匹配的是真实路径，不是包名</strong> —— 软链解析之后 rollup 拿到的 id
          是 <C>…/sdk/backend/processing/lineOrders.js</C>，里面没有
          {' '}<C>@shroom/backend</C> 这几个字。按包名写会以
          {' '}<C>"default" is not exported by …</C> 报错。
        </p>
        <Note title="漏了会立刻白屏，不会悄悄错">
          这是这一串配置里唯一让人安心的地方：错法很吵。相比之下上面妥协 2 那种
          「波特率对不上、串口能开但解不出帧」才是真难查的。
        </Note>
      </Section>

      <Section title="怎么确认这些还是真的">
        <CodeBlock
          code={`npm test                        # 含 backendPackageInvariants.test.js，守妥协 1-3
npm run sdk:backend-smoke       # 包内自洽 10 项：各层能加载、端到端跑通、根出口不预加载 peer
npm run sdk:backend-docs-build  # 本站能打出静态产物
npm run sdk:backend-docs-check  # SSR 逐页渲染，抓「表格读崩」
npm run sdk:backend-docs-click  # 真浏览器点十页，抓白屏和拨开关才炸的分支`}
          language="bash"
        />
        <Table
          head={['这道关', '抓什么', '抓不到什么']}
          rows={[
            [<C>build</C>, 'import 解析不了、CJS 转换失败', '一切运行期的事 —— 它只打包，不执行'],
            [<span><C>check</C>（SSR）</span>, '表格从包里读崩、首屏渲染抛错', '浏览器独有的坑（比如上面那个 process）'],
            [<C>click</C>, <span>白屏、拨开关才炸的分支、<C>?raw</C> 没读到源码、子路径下资源 404</span>, '长得对不对（那得人眼看）'],
          ]}
        />
        <p>
          中间那条值得解释：本站几乎每张表都是<strong>渲染时</strong>才从包里读的。
          改一个常量把某张表读崩，<C>vite build</C> 照样绿 —— 因为它只管打包，不管渲染。
          SSR 检查会逐页 <C>renderToStaticMarkup</C>，那时候才炸出来。
        </p>
        <p>
          最后那条会自己起一个静态服务器、<strong>故意把产物挂在子路径下</strong>
          （<C>/some/sub/path/</C>）再点 —— 顺手验了 <C>base: './'</C>。
          它用系统里的 Edge / Chrome，不下载 playwright 自带的 chromium。
        </p>
      </Section>
    </Prose>
  );
}
